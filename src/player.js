import * as THREE from 'three';
import { loadCharacter, pickClips, CHARACTER_CONFIG } from './character.js';

/**
 * 外部角色模型（相对 index.html）。
 * 这是一个带内嵌 PBR 贴图的 FBX：几何与贴图都会被加载，
 * 但它本身没有骨骼与动画曲线，走跑跳由程序化整体律动代替；
 * 若换成带骨骼动画的 FBX，会自动改用 AnimationMixer 播放其中匹配的片段。
 * 传 null 则一直用程序化人物。
 */
const CHARACTER_URL = './Human.fbx';

const EYE_HEIGHT = 1.5;
// 第一人称的镜头高度，对齐头部球体（y=1.72）的眼位
const FIRST_PERSON_EYE_HEIGHT = 1.68;
const CAMERA_DISTANCE = 4.8;
const GRAVITY = 22;
const JUMP_SPEED = 7.4;
const WALK_SPEED = 3.4;
const RUN_SPEED = 6.4;

// 俯仰角限制：第三人称不能压太低（镜头会钻到地板下），第一人称则可以抬头看穹顶
const PITCH_LIMITS = {
  third: [-0.4, 1.15],
  first: [-1.15, 1.3],
};

const COLORS = {
  skin: 0xe8b48c,
  shirt: 0x3f7f8f,
  pants: 0x2b3550,
  shoes: 0x1b1f2b,
  hair: 0x241d19,
};

function makeLimb(material, radius, length) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 6, 12), material);
}

/** 释放被替换掉的程序化人物，避免几何与材质泄漏 */
function disposeObject(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose?.();
  });
}

/** 用基础几何体拼出一个可动画的人形，返回模型与各关节 */
function buildCharacter() {
  const skin = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.65 });
  const pants = new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.75 });
  const shoes = new THREE.MeshStandardMaterial({ color: COLORS.shoes, roughness: 0.5 });
  const hair = new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.85 });

  const model = new THREE.Group();

  // 躯干
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 16), shirt);
  torso.position.y = 1.17;
  torso.castShadow = true;
  model.add(torso);

  // 头与头发
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  model.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairCap.position.y = 1.75;
  model.add(hairCap);

  // 脖子
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12), skin);
  neck.position.y = 1.53;
  model.add(neck);

  // 腿：以髋关节为轴心，方便摆动
  const hips = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.12 * side, 0.88, 0);

    const leg = makeLimb(pants, 0.1, 0.82);
    leg.position.y = -0.41;
    leg.castShadow = true;
    hip.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), shoes);
    shoe.position.set(0, -0.8, 0.04);
    shoe.castShadow = true;
    hip.add(shoe);

    model.add(hip);
    hips.push(hip);
  }

  // 手臂：以肩关节为轴心
  const shoulders = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.3 * side, 1.42, 0);

    const arm = makeLimb(shirt, 0.085, 0.6);
    arm.position.y = -0.3;
    arm.castShadow = true;
    shoulder.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), skin);
    hand.position.y = -0.62;
    hand.castShadow = true;
    shoulder.add(hand);

    model.add(shoulder);
    shoulders.push(shoulder);
  }

  const meshes = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.receiveShadow = true;
    meshes.push(child);
  });

  return { model, meshes, hips, shoulders };
}

export class Player {
  constructor({ scene, room, colliders, spawn, characterUrl = CHARACTER_URL }) {
    this.room = room;
    this.colliders = colliders;
    this.radius = 0.42;

    this.position = spawn.clone();
    this.velocity = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.onGround = true;

    this.yaw = 0;
    this.pitch = 0.24;
    this.sensitivity = 0.0022;
    this.mode = 'third';
    this.modelHidden = false;

    this.facing = Math.PI;
    this.walkPhase = 0;
    this.speed = 0;

    const character = buildCharacter();
    this.character = character;

    // 层级：root（世界坐标） → tilt（程序化律动：起伏/前倾/侧摆） → model（rotation.y = 朝向）
    // 分成两层，是为了让「朝向」和「律动」互不干扰，两种模型都能复用。
    this.tilt = new THREE.Group();
    this.tilt.add(character.model);
    this.character.tilt = this.tilt;
    this.character.external = null;

    this.root = new THREE.Group();
    this.root.add(this.tilt);
    this.root.position.copy(this.position);
    scene.add(this.root);

    this.characterUrl = characterUrl;
    if (characterUrl) this.loadExternalCharacter(characterUrl);

    this.cameraPosition = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.cameraReady = false;
  }

  update(dt, camera, input, allowLook = true) {
    if (allowLook) this.applyMouseLook(input);

    const intent = input.movement();
    const maxSpeed = intent.run ? RUN_SPEED : WALK_SPEED;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const desired = new THREE.Vector3()
      .addScaledVector(forward, intent.z)
      .addScaledVector(right, intent.x)
      .multiplyScalar(maxSpeed);

    const responsiveness = 1 - Math.exp(-16 * dt);
    this.velocity.lerp(desired, responsiveness);
    this.speed = this.velocity.length();

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 跳跃与重力
    if (input.consumeJump() && this.onGround) {
      this.verticalVelocity = JUMP_SPEED;
      this.onGround = false;
    }
    this.verticalVelocity -= GRAVITY * dt;
    this.position.y += this.verticalVelocity * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.verticalVelocity = 0;
      this.onGround = true;
    }

    this.resolveCollisions();
    this.updateFacing(dt);
    this.animate(dt);

    this.root.position.copy(this.position);
    this.updateCamera(dt, camera);
  }

  /** 第一人称 / 第三人称互相切换（V 键），返回切换后的模式 */
  toggleMode() {
    this.setMode(this.mode === 'third' ? 'first' : 'third');
    return this.mode;
  }

  setMode(mode) {
    if (mode === this.mode) return this.mode;
    this.mode = mode;

    this.setModelHidden(mode === 'first');

    // 两种视角的俯仰范围不同，切换后先夹一次
    const [minPitch, maxPitch] = PITCH_LIMITS[this.mode];
    this.pitch = THREE.MathUtils.clamp(this.pitch, minPitch, maxPitch);

    // 换视角时不做插值，否则镜头会从旧位置一路滑过去
    this.cameraReady = false;
    return this.mode;
  }

  /**
   * 第一人称时隐藏自身模型。
   *
   * 这里关的是材质的 colorWrite / depthWrite，而不是 mesh.visible：
   * 阴影 pass 开头就是 `if (object.visible === false) return`，用 visible 会把自己的
   * 影子也一起弄没；而阴影用的是内部 depth 材质，跟 colorWrite 无关。
   * depthWrite 同样要关——否则“看不见”的身体依旧写深度，低头时会在地面上抠出一块黑洞。
   */
  setModelHidden(hidden) {
    if (this.modelHidden === hidden) return;
    this.modelHidden = hidden;
    this.applyModelVisibility();
  }

  /** 把当前的显示状态刷到所有材质上（材质可能是数组，需要展开） */
  applyModelVisibility() {
    const hidden = this.modelHidden;
    const seen = new Set();
    for (const mesh of this.character.meshes) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material || seen.has(material)) continue;
        seen.add(material);
        material.colorWrite = !hidden;
        material.depthWrite = !hidden;
      }
    }
  }

  /**
   * 异步换上外部 FBX 角色。
   * 加载期间保持程序化人物可见，成功后无缝替换；失败则继续用程序化人物，不影响漫游。
   */
  async loadExternalCharacter(url) {
    try {
      const { object, clips, stats } = await loadCharacter(url);
      if (this.disposed) return;

      const previous = this.character.model;
      this.tilt.remove(previous);
      disposeObject(previous);

      this.tilt.add(object);

      const meshes = [];
      object.traverse((node) => {
        if (node.isMesh) meshes.push(node);
      });

      const mixer = clips.length ? new THREE.AnimationMixer(object) : null;
      const actions = {};
      if (mixer) {
        const picked = pickClips(clips);
        for (const [slot, clip] of Object.entries(picked)) {
          const action = mixer.clipAction(clip);
          if (slot === 'jump') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          actions[slot] = action;
        }
      }

      this.character.model = object;
      this.character.meshes = meshes;
      this.character.hips = [];
      this.character.shoulders = [];
      this.character.external = {
        object,
        mixer,
        actions,
        current: null,
        slot: null,
        hasClips: clips.length > 0,
        stats,
        facingOffset: CHARACTER_CONFIG.facingOffset,
      };

      // 第一人称下换模型时要重新应用隐藏
      this.applyModelVisibility();
      return this.character.external;
    } catch (error) {
      console.warn('[player] 外部角色加载失败，继续使用程序化人物：', error);
      return null;
    }
  }

  applyMouseLook(input) {
    const delta = input.consumeMouseDelta();
    if (delta.x === 0 && delta.y === 0) return;

    this.yaw -= delta.x * this.sensitivity;
    // y 轴反转：鼠标向上推，镜头向上抬
    this.pitch += delta.y * this.sensitivity;

    const [minPitch, maxPitch] = PITCH_LIMITS[this.mode];
    this.pitch = THREE.MathUtils.clamp(this.pitch, minPitch, maxPitch);
  }

  resolveCollisions() {
    const { halfX, halfZ } = this.room;
    const limitX = halfX - this.radius;
    const limitZ = halfZ - this.radius;

    this.position.x = THREE.MathUtils.clamp(this.position.x, -limitX, limitX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limitZ, limitZ);

    // 障碍物：展台/立柱是圆柱，隔墙/钟架是轴对齐长方体
    for (const collider of this.colliders) {
      if (collider.halfX !== undefined) {
        const dx = this.position.x - collider.x;
        const dz = this.position.z - collider.z;
        const overlapX = collider.halfX + this.radius - Math.abs(dx);
        const overlapZ = collider.halfZ + this.radius - Math.abs(dz);
        if (overlapX <= 0 || overlapZ <= 0) continue;

        // 沿穿透较浅的一轴推出，贴着墙面滑动
        if (overlapX < overlapZ) {
          this.position.x += dx >= 0 ? overlapX : -overlapX;
        } else {
          this.position.z += dz >= 0 ? overlapZ : -overlapZ;
        }
        continue;
      }

      const dx = this.position.x - collider.x;
      const dz = this.position.z - collider.z;
      const minDistance = collider.radius + this.radius;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= minDistance * minDistance) continue;

      const distance = Math.sqrt(distanceSq) || 0.0001;
      const push = (minDistance - distance) / distance;
      this.position.x += dx * push;
      this.position.z += dz * push;
    }
  }

  updateFacing(dt) {
    let target = this.facing;
    if (this.mode === 'first') {
      // 第一人称：身体朝向跟着镜头，投影与四肢才不会指错方向
      target = this.yaw + Math.PI;
    } else if (this.speed > 0.25) {
      target = Math.atan2(this.velocity.x, this.velocity.z);
    }

    let diff = target - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * (1 - Math.exp(-12 * dt));

    // 外部模型可能自带朝向偏移（面朝 -Z 的模型需要加 π）
    const offset = this.character.external?.facingOffset ?? 0;
    this.character.model.rotation.y = this.facing + offset;
  }

  animate(dt) {
    const { hips, shoulders, tilt, external } = this.character;
    const amplitude = Math.min(this.speed / WALK_SPEED, 1.4);
    this.walkPhase += dt * (4 + this.speed * 1.9);

    // ① 有骨骼动画：交给 AnimationMixer
    if (external && external.hasClips) {
      this.updateSkeletalAnimation(dt, amplitude);
      return;
    }

    // ② 外部模型但没有骨骼动画：整体律动（该模型的客观限制，见 README）
    if (external) {
      const step = Math.sin(this.walkPhase);
      const moving = THREE.MathUtils.clamp(this.speed / WALK_SPEED, 0, 1.4);
      tilt.position.y = this.onGround ? Math.abs(step) * 0.055 * moving : 0;
      tilt.rotation.x = -0.07 * moving + step * 0.012 * moving;
      tilt.rotation.z = step * 0.022 * moving;
      // 起跳/落地时给一点压缩拉伸
      const stretch = this.onGround ? 1 : THREE.MathUtils.clamp(1 + this.verticalVelocity * 0.006, 0.96, 1.06);
      tilt.scale.set(1, stretch, 1);
      return;
    }

    // ③ 程序化人物：原来的关节动画
    const swing = Math.sin(this.walkPhase) * 0.55 * amplitude;
    hips[0].rotation.x = swing;
    hips[1].rotation.x = -swing;
    shoulders[0].rotation.x = -swing * 0.8;
    shoulders[1].rotation.x = swing * 0.8;
    shoulders[1].rotation.z = -0.08;

    // 走动时轻微起伏
    const bob = Math.abs(Math.sin(this.walkPhase)) * 0.045 * amplitude;
    tilt.position.y = this.onGround ? bob : 0.02;
  }

  /** 走 / 跑 / 跳 / 待机 四态，按速度与是否着地切换，切换时交叉淡入淡出 */
  updateSkeletalAnimation(dt, amplitude) {
    const external = this.character.external;
    const { actions, mixer } = external;

    let slot = 'idle';
    if (!this.onGround) slot = 'jump';
    else if (this.speed > WALK_SPEED * 1.08) slot = 'run';
    else if (this.speed > 0.25) slot = 'walk';

    // 缺哪个片段就退到已有的那个
    if (!actions[slot]) slot = actions[slot === 'jump' ? 'walk' : 'idle'] ? (slot === 'jump' ? 'walk' : 'idle') : Object.keys(actions)[0];
    const next = actions[slot];

    if (next && external.slot !== slot) {
      if (external.current) external.current.fadeOut(0.18);
      next.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      external.current = next;
      external.slot = slot;
    }

    // 步频跟速度对齐，避免脚底打滑
    if (actions.walk && slot === 'walk') {
      actions.walk.timeScale = THREE.MathUtils.clamp(this.speed / WALK_SPEED, 0.55, 1.7);
    }
    if (actions.run && slot === 'run') {
      actions.run.timeScale = THREE.MathUtils.clamp(this.speed / RUN_SPEED, 0.6, 1.5);
    }

    // 没有位移的片段也需要一点整体起伏，否则看起来像在地上滑
    const step = Math.sin(this.walkPhase);
    this.character.tilt.rotation.x = -0.05 * amplitude;
    this.character.tilt.rotation.z = step * 0.015 * amplitude;

    if (mixer) mixer.update(dt);
  }

  updateCamera(dt, camera) {
    if (this.mode === 'first') this.updateFirstPersonCamera(camera);
    else this.updateThirdPersonCamera(dt, camera);
  }

  /** 第一人称：镜头就在眼睛上，视线方向与第三人称完全一致，切换时不会跳（身体由 setModelHidden 收起） */
  updateFirstPersonCamera(camera) {
    const amplitude = Math.min(this.speed / WALK_SPEED, 1.4);
    const bob = this.onGround ? Math.abs(Math.sin(this.walkPhase)) * 0.028 * amplitude : 0;

    camera.position.set(
      this.position.x,
      this.position.y + FIRST_PERSON_EYE_HEIGHT + bob,
      this.position.z,
    );

    const cosPitch = Math.cos(this.pitch);
    this.cameraTarget.set(
      camera.position.x - Math.sin(this.yaw) * cosPitch,
      camera.position.y - Math.sin(this.pitch),
      camera.position.z - Math.cos(this.yaw) * cosPitch,
    );
    camera.lookAt(this.cameraTarget);
  }

  updateThirdPersonCamera(dt, camera) {
    this.cameraTarget.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);

    const horizontal = Math.cos(this.pitch) * CAMERA_DISTANCE;
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.pitch) * CAMERA_DISTANCE,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal,
    );

    // 别让镜头穿到墙外或地板下
    const margin = 0.45;
    desired.x = THREE.MathUtils.clamp(desired.x, -this.room.halfX + margin, this.room.halfX - margin);
    desired.z = THREE.MathUtils.clamp(desired.z, -this.room.halfZ + margin, this.room.halfZ - margin);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.5, this.room.height - 0.3);

    if (!this.cameraReady) {
      this.cameraPosition.copy(desired);
      this.cameraReady = true;
    } else {
      this.cameraPosition.lerp(desired, 1 - Math.exp(-14 * dt));
    }

    camera.position.copy(this.cameraPosition);
    camera.lookAt(this.cameraTarget);
  }
}
