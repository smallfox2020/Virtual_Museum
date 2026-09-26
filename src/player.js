import * as THREE from 'three';
import { loadCharacter, loadAnimationClips, calibrateClipSpeeds, measureJumpClip, pickClips, CHARACTER_CONFIG, DEFAULT_ANIMATIONS } from './character.js';

/**
 * 外部角色模型（相对 index.html）。
 *
 * 这是 Mixamo 绑定过的版本：带骨骼与蒙皮（65 根 mixamorig 骨骼），
 * 因此 T 形姿势重姿态会自动跳过（T 形就是绑定姿势）。
 * 走 / 跑 / 跳 / 待机 由 DEFAULT_ANIMATIONS 里的动画 FBX 提供，
 * 它们与角色是同一套骨架，按骨骼名直接绑定，不需要重定向。
 * 传 null 则一直用程序化人物。
 */
export const CHARACTER_URL = './animations/HumanRigged.fbx';

/**
 * 角色身高（米）。与 character.js 的 CHARACTER_CONFIG.targetHeight 保持一致，
 * 镜头高度由它推导，改这一个数就能整体调高/调矮。
 * 当前 1.98 m（比模型原始归一值 1.78 m 高 0.2）。
 */
const CHARACTER_HEIGHT = 1.98;
/** 第三人称看向的高度（头部附近） */
const EYE_HEIGHT = CHARACTER_HEIGHT * 0.84;
/** 第一人称的眼位（模型的眼睛在身高 92% 处） */
const FIRST_PERSON_EYE_HEIGHT = CHARACTER_HEIGHT * 0.93;
// 房间放大到 48 × 80 m 后，4.8 m 的跟随距离会让人物显得很小，拉近到 3.4 m
const CAMERA_DISTANCE = 3.4;
const GRAVITY = 22;
/**
 * 跳跃初速。物理滞空时间 = 2 × JUMP_SPEED / GRAVITY。
 * 跳跃动画只在「滞空」这段时间里放完离地→落地，所以两者必须对齐（见 setupJumpAction）。
 * 当前值：跳高 ≈ 6.6² / (2 × 22) ≈ 0.99 m，滞空 ≈ 0.6 s。
 */
const JUMP_SPEED = 6.6;
/**
 * 移动速度。这两个值需要和动画的自然速度量级匹配，否则脚底会打滑。
 * 实际播放倍速会在运行时用「当前速度 ÷ 动画自然速度」自动标定（见 calibrateClipSpeeds）。
 * 实测动画自然速度：走路 ≈ 1.65 m/s、跑步 ≈ 2.43 m/s，对应下面的倍速约 1.15× / 1.60×。
 */
const WALK_SPEED = 1.9;
const RUN_SPEED = 3.9;

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
  constructor({ scene, room, colliders, spawn, characterUrl = CHARACTER_URL, animationFiles = DEFAULT_ANIMATIONS }) {
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
    this.animationFiles = animationFiles;
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
  /**
   * 异步换上外部 FBX 角色。
   *
   * 分成两步，为的是让模型尽快出现：
   *   ① 角色本体一解析完就立刻换上（加载期间保持程序化人物可见，不挡漫游）；
   *   ② 走 / 跑 / 跳动画在后台继续加载，到货后再接上动画系统。
   * 单个动画文件就有 7 MB，等它们全部就绪才换模型会让开场白等很久。
   */
  async loadExternalCharacter(url) {
    const started = performance.now();
    try {
      const { object, clips, stats } = await loadCharacter(url);
      if (this.disposed) return;
      console.log(`[player] 角色就绪，共 ${Math.round(performance.now() - started)} ms`);

      const previous = this.character.model;
      this.tilt.remove(previous);
      disposeObject(previous);

      this.tilt.add(object);

      const meshes = [];
      object.traverse((node) => {
        if (node.isMesh) meshes.push(node);
      });

      this.character.model = object;
      this.character.meshes = meshes;
      this.character.hips = [];
      this.character.shoulders = [];
      this.character.external = {
        object,
        mixer: null,
        actions: {},
        current: null,
        slot: null,
        hasClips: false,
        clips: [],
        slots: [],
        clipSpeeds: {},
        jump: null,
        stats,
        facingOffset: CHARACTER_CONFIG.facingOffset,
      };

      // 立刻可见（第一人称下换模型也要重新应用隐藏）
      this.applyModelVisibility();

      // 动画在后台加载，不阻塞模型显示
      this.loadAnimations(object, clips);
      return this.character.external;
    } catch (error) {
      console.warn('[player] 外部角色加载失败，继续使用程序化人物：', error);
      return null;
    }
  }

  /** 后台加载动画并接上动画系统 */
  async loadAnimations(object, ownClips) {
    const started = performance.now();
    try {
      // 角色自带的片段往往只是一个单帧姿势（Mixamo 的 "mixamo.com"）
      let allClips = (ownClips || []).filter((clip) => clip.duration > 0.05);
      if (this.animationFiles?.length) {
        allClips = allClips.concat(await loadAnimationClips(this.animationFiles));
      }
      if (this.disposed || this.character.model !== object) return;

      const external = this.character.external;
      const mixer = allClips.length ? new THREE.AnimationMixer(object) : null;
      const actions = {};
      if (mixer) {
        const picked = pickClips(allClips);
        for (const [slot, clip] of Object.entries(picked)) {
          const action = mixer.clipAction(clip);
          if (slot === 'jump') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          actions[slot] = action;
        }

        // 速度标定：量出每个片段自身的地面速度，以及跳跃的离地窗口
        const { speeds, details } = calibrateClipSpeeds(allClips, object);
        external.clipSpeeds = speeds;
        external.jump = actions.jump ? measureJumpClip(actions.jump.getClip(), object) : null;

        const lines = Object.entries(details).map(
          ([slot, d]) => `${slot}：步长 ${d.step} m，抬脚 ${d.lift} m → 自然速度 ${d.speed} m/s`,
        );
        if (lines.length) console.log('[player] 动画速度标定：\n  ' + lines.join('\n  '));
        if (external.jump) {
          const j = external.jump;
          console.log(
            `[player] 跳跃片段标定：时长 ${j.duration}s，脚抬高 ${j.lift} m，` +
              `离地 ${j.airborneStart}s → 落地 ${j.contactTime}s` +
              (j.startsAirborne ? '（⚠ 片段一开始就在空中，属于「下落→落地」动画，没有起跳段）' : ''),
          );
        }
      }

      external.mixer = mixer;
      external.actions = actions;
      external.hasClips = allClips.length > 0;
      external.slots = Object.keys(actions);
      external.clips = allClips.map((clip) => `${clip.name}(${clip.duration.toFixed(2)}s)`);

      console.log(
        `[player] 动画就绪（角色出现后又用了 ${Math.round(performance.now() - started)} ms）\n` +
          `  可用槽位：${external.slots.join(', ') || '（无）'}\n` +
          `  片段清单：${external.clips.join('  ')}`,
      );
    } catch (error) {
      console.warn('[player] 动画加载失败，暂用程序化律动：', error);
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
      next.reset().setEffectiveWeight(1).fadeIn(0.18);
      if (slot === 'jump') this.setupJumpAction(next);
      next.play();
      external.current = next;
      external.slot = slot;
    }

    // 步频跟速度对齐，避免脚底打滑：倍速 = 当前速度 ÷ 该动画自身的自然速度
    const clipSpeeds = external.clipSpeeds || {};
    if (actions.walk && slot === 'walk') {
      const natural = clipSpeeds.walk || WALK_SPEED;
      actions.walk.timeScale = THREE.MathUtils.clamp(this.speed / natural, 0.45, 2.2);
    }
    if (actions.run && slot === 'run') {
      const natural = clipSpeeds.run || RUN_SPEED;
      actions.run.timeScale = THREE.MathUtils.clamp(this.speed / natural, 0.5, 2.2);
    }

    // 只保留一点点前倾。不要再在这里叠程序化侧摆：
    // walkPhase 的推进速度（4 + speed × 1.9）与 Mixamo 片段的播放速率没有关系，
    // 两个不同步的摆动叠在一起会「打拍子」，表现出来就是走路时人往一边歪。
    // 片段本身已经有自然的身体侧摆，叠加只会破坏它。
    this.character.tilt.rotation.x = -0.04 * amplitude;
    this.character.tilt.rotation.z = 0;

    if (mixer) mixer.update(dt);
  }

  /**
   * 把跳跃动画的「落地瞬间」对齐到物理落地的时刻。
   *
   * 物理滞空时间 = 2 × JUMP_SPEED / GRAVITY。
   * 动画里脚从离地到落地的时段是 [airborneStart, contactTime]，
   * 把这段拉伸/压缩到刚好等于滞空时间，脚就不会「提前落地」或者「落地后还在空中划」。
   *
   * 对 Mixamo 的 Landing 类片段（一开始就在空中）airborneStart ≈ 0，同样适用。
   */
  setupJumpAction(action) {
    const jump = this.character.external?.jump;
    const airTime = (2 * JUMP_SPEED) / GRAVITY;
    if (!jump || !(jump.contactTime > jump.airborneStart)) {
      action.timeScale = 1;
      return;
    }
    const span = jump.contactTime - jump.airborneStart;
    action.time = jump.airborneStart; // 从脚离开地面那一帧开始放
    action.timeScale = THREE.MathUtils.clamp(span / airTime, 0.25, 3);
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

  /** 第三人称镜头是否会插进内墙（矩形碰撞体） */
  cameraBlocked(x, z) {
    const margin = 0.32;
    for (const collider of this.colliders) {
      if (collider.halfX === undefined) continue;
      if (
        Math.abs(x - collider.x) < collider.halfX + margin &&
        Math.abs(z - collider.z) < collider.halfZ + margin
      ) {
        return true;
      }
    }
    return false;
  }

  updateThirdPersonCamera(dt, camera) {
    this.cameraTarget.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);

    const horizontal = Math.cos(this.pitch) * CAMERA_DISTANCE;
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.pitch) * CAMERA_DISTANCE,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal,
    );

    // 镜头不要穿过展厅内墙：从人物头部向目标位置步进，遇到墙就把镜头拉近
    const originX = this.cameraTarget.x;
    const originZ = this.cameraTarget.z;
    let allowed = 1;
    const steps = 16;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (this.cameraBlocked(originX + (desired.x - originX) * t, originZ + (desired.z - originZ) * t)) {
        allowed = (i - 1) / steps;
        break;
      }
    }
    const tight = allowed < 1;
    if (tight) {
      const safe = Math.max(0.16, allowed);
      desired.x = originX + (desired.x - originX) * safe;
      desired.z = originZ + (desired.z - originZ) * safe;
      desired.y = this.cameraTarget.y + (desired.y - this.cameraTarget.y) * Math.max(safe, 0.45);
    }

    // 别让镜头穿到墙外或地板下
    const margin = 0.45;
    desired.x = THREE.MathUtils.clamp(desired.x, -this.room.halfX + margin, this.room.halfX - margin);
    desired.z = THREE.MathUtils.clamp(desired.z, -this.room.halfZ + margin, this.room.halfZ - margin);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.5, this.room.height - 0.3);

    if (!this.cameraReady) {
      this.cameraPosition.copy(desired);
      this.cameraReady = true;
    } else {
      // 被墙挡住时立刻贴上来，避免镜头停在墙体里
      this.cameraPosition.lerp(desired, tight ? 1 : 1 - Math.exp(-14 * dt));
    }

    camera.position.copy(this.cameraPosition);
    camera.lookAt(this.cameraTarget);
  }
}
