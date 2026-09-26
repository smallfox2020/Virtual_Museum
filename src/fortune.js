import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARTIFACTS, createArtifactObject, artifactStory } from './artifacts.js';

/**
 * 序厅「摇签问古」抽签小游戏。
 *
 * 流程：
 *   签筒视图 → 点击「摇晃签筒」晃动 1 秒 → 点击某支木签 → 木签弹出并单独展示
 *   → 按 E（或点击木签）查看该展品的故事（打字机效果，E 可跳过，滚轮翻阅）
 *   → 按 O 单独观察器物 → 按 Esc 退出抽签回到展馆。
 *
 * 签筒用一块独立的透明 WebGL 画布绘制，叠在被 backdrop-filter 虚化的场景之上。
 */
export function createFortune({ canvas, onInspect }) {
  const root = document.getElementById('fortune');
  const shakeBtn = document.getElementById('fortune-shake');
  const tip = document.getElementById('fortune-tip');
  const resultEl = document.getElementById('fortune-result');
  const slip = resultEl.querySelector('.fortune-slip');
  const againBtn = document.getElementById('fortune-again');
  const fateEl = document.getElementById('fortune-fate');
  const imageEl = document.getElementById('fortune-image');
  const storyTag = document.getElementById('fortune-story-tag');
  const storyTitle = document.getElementById('fortune-story-title');
  const storyBody = document.getElementById('fortune-story-body');
  const storyHintText = document.getElementById('fortune-story-hint-text');
  const storyEl = document.getElementById('fortune-story');

  /* ================= 签筒场景 ================= */

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 2.15, 3.9);
  camera.lookAt(0, 1.0, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const keyLight = new THREE.DirectionalLight(0xfff2e0, 2.5);
  keyLight.position.set(2.5, 5, 4);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x9ecdff, 1.1);
  rimLight.position.set(-3.5, 2.5, -3);
  scene.add(rimLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(0, -2, 2.5);
  scene.add(fillLight);

  const tube = new THREE.Group();
  scene.add(tube);

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0x7d4f2c,
    roughness: 0.58,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x35211a, roughness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8ae4e, metalness: 0.92, roughness: 0.3 });
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xe6d3a6, roughness: 0.62 });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.8, 0.12, 40), darkMat);
  base.position.y = -0.06;
  tube.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 1.05, 40, 1, true), tubeMat);
  body.position.y = 0.525;
  tube.add(body);

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 40), darkMat);
  bottom.position.y = 0.1;
  tube.add(bottom);

  for (const y of [0.28, 0.82]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.028, 10, 44), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    tube.add(ring);
  }

  /** 木签卷面：签头（露出筒口的部分）是素木，签文写在签腰——抽出来才看得到 */
  function makeStickFaceTexture(text) {
    const w = 64;
    const h = 1216;
    const face = document.createElement('canvas');
    face.width = w;
    face.height = h;
    const ctx = face.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#c4ab7d');
    grad.addColorStop(0.5, '#f2e4c0');
    grad.addColorStop(1, '#c4ab7d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 签文绘制在贴图下半部（v < 0.489，即低于筒口），筒里看不到
    if (text === '大吉') {
      ctx.font = '700 46px "KaiTi","STKaiti","Kaiti SC",serif';
      ctx.fillText('大', w / 2, h * 0.6);
      ctx.fillText('吉', w / 2, h * 0.7);
    } else {
      ctx.font = '700 52px "KaiTi","STKaiti","Kaiti SC",serif';
      ctx.fillText('吉', w / 2, h * 0.65);
    }
    const texture = new THREE.CanvasTexture(face);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  const faceTextures = { 吉: makeStickFaceTexture('吉'), 大吉: makeStickFaceTexture('大吉') };

  const sticks = [];
  const hitTargets = [];

  // 抽签结果不放回：一轮抽完 21 件展品才重新洗牌，保证连续抽到的结果都不同
  let deck = [];
  function drawArtifact() {
    if (deck.length === 0) {
      deck = ARTIFACTS.slice();
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.pop();
  }

  const createStick = (x, z, angle) => {
    const group = new THREE.Group();
    const baseY = (Math.random() - 0.5) * 0.12;
    const baseRotZ = (Math.random() - 0.5) * 0.1;
    const baseRotX = (Math.random() - 0.5) * 0.1;
    const fortune = Math.random() < 0.45 ? '大吉' : '吉';
    const phase = Math.random() * Math.PI * 2;

    group.position.set(x, baseY, z);
    // 签面朝向筒外：局部 +z 旋转到径向方向
    group.rotation.set(baseRotX, Math.PI / 2 - angle, baseRotZ);

    // 扁木签：两个大面（+z / -z）都贴上签文，从筒内、筒外看都是正字
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTextures[fortune],
      roughness: 0.6,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    const slip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.9, 0.026),
      [stickMat, stickMat, stickMat, stickMat, faceMat, faceMat],
    );
    slip.position.y = 1.07;
    slip.castShadow = true;
    group.add(slip);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.95, 0.12), hitMat);
    hit.position.y = 1.07;
    group.add(hit);
    hit.userData.stick = group;

    group.userData = { baseY, baseRotZ, baseRotX, fortune, phase, labelMat: faceMat };
    tube.add(group);

    sticks.push(group);
    hitTargets.push(hit);
    return group;
  };

  /** 洗牌：重新随机每支签的高低、倾角、相位与吉/大吉，并同步更新签面贴图 */
  function shuffleSticks() {
    for (const stick of sticks) {
      const u = stick.userData;
      u.baseY = (Math.random() - 0.5) * 0.2;
      u.baseRotZ = (Math.random() - 0.5) * 0.18;
      u.baseRotX = (Math.random() - 0.5) * 0.18;
      u.phase = Math.random() * Math.PI * 2;
      u.fortune = Math.random() < 0.45 ? '大吉' : '吉';
      u.labelMat.map = faceTextures[u.fortune];
    }
  }

  for (const ring of [
    { radius: 0.42, count: 16 },
    { radius: 0.17, count: 8 },
  ]) {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.radius * 3;
      createStick(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, angle);
    }
  }

  /* ================= 展品缩略图 ================= */

  const thumbCache = new Map();
  let thumb = null;

  /** 用一件临时画布把展品渲染成图片（按展品名缓存） */
  function artifactImage(artifact) {
    if (thumbCache.has(artifact.name)) return thumbCache.get(artifact.name);

    if (!thumb) {
      const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbRenderer.setPixelRatio(1);
      thumbRenderer.setSize(440, 440, false);
      thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
      thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      thumbRenderer.toneMappingExposure = 1.12;

      const thumbScene = new THREE.Scene();
      const pmremThumb = new THREE.PMREMGenerator(thumbRenderer);
      thumbScene.environment = pmremThumb.fromScene(new RoomEnvironment(), 0.04).texture;
      thumbScene.environmentIntensity = 0.85;
      pmremThumb.dispose();

      thumbScene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const tKey = new THREE.DirectionalLight(0xfff3e2, 2.3);
      tKey.position.set(3, 5, 4);
      thumbScene.add(tKey);
      const tRim = new THREE.DirectionalLight(0x9ecdff, 1.1);
      tRim.position.set(-4, 2, -3);
      thumbScene.add(tRim);

      const stage = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.45, 0.06, 48),
        new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.5, metalness: 0.3 }),
      );
      stage.position.y = -0.05;
      thumbScene.add(stage);

      const holder = new THREE.Group();
      thumbScene.add(holder);

      thumb = {
        renderer: thumbRenderer,
        scene: thumbScene,
        holder,
        stage,
        camera: new THREE.PerspectiveCamera(34, 1, 0.05, 100),
      };
    }

    thumb.holder.clear();
    const { object } = createArtifactObject(artifact);
    thumb.holder.add(object);

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.0 / (Math.max(size.x, size.y, size.z) || 1);
    object.scale.setScalar(scale);
    object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const halfHeight = (size.y * scale) / 2;
    thumb.stage.position.y = -halfHeight - 0.05;
    thumb.stage.scale.setScalar(Math.max(0.5, Math.min(1.4, Math.max(size.x, size.z) * scale)));

    thumb.camera.position.set(0, 0.35, 3.5);
    thumb.camera.lookAt(0, 0.05, 0);
    thumb.renderer.render(thumb.scene, thumb.camera);

    const url = thumb.renderer.domElement.toDataURL('image/png');
    thumbCache.set(artifact.name, url);
    return url;
  }

  /* ================= 状态 ================= */

  let open = false;
  let state = 'tube'; // tube | shaking | popping | result | story
  let shakeT = 0;
  let popT = 0;
  let idleT = 0;
  let canDraw = false;
  let hovered = null;
  let selected = null;

  const typing = { active: false, full: '', shown: 0, t: 0, doneAt: 0 };
  const CHAR_MS = 22;

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  function setHover(stick) {
    if (hovered === stick) return;
    if (hovered) {
      hovered.position.y = hovered.userData.baseY;
      hovered.userData.labelMat.emissiveIntensity = 0;
    }
    hovered = stick;
    if (hovered) {
      hovered.position.y = hovered.userData.baseY + 0.16;
      hovered.userData.labelMat.emissive.setHex(0x5a2a10);
      hovered.userData.labelMat.emissiveIntensity = 0.65;
    }
  }

  function resetSticks() {
    setHover(null);
    for (const stick of sticks) {
      stick.position.y = stick.userData.baseY;
      stick.rotation.z = stick.userData.baseRotZ;
      stick.rotation.x = stick.userData.baseRotX;
    }
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickStick(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length ? hits[0].object.userData.stick : null;
  }

  canvas.addEventListener('pointermove', (event) => {
    if (!open || state !== 'tube' || !canDraw) {
      setHover(null);
      return;
    }
    setHover(pickStick(event));
  });

  canvas.addEventListener('pointerleave', () => setHover(null));

  canvas.addEventListener('click', (event) => {
    if (!open || state !== 'tube' || !canDraw) return;
    const stick = pickStick(event);
    if (!stick) return;
    selected = stick;
    state = 'popping';
    popT = 0;
    canDraw = false;
    shakeBtn.disabled = true;
    setHover(null);
  });

  shakeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!open || state !== 'tube') return;
    shuffleSticks();
    state = 'shaking';
    shakeT = 0;
    canDraw = false;
    shakeBtn.disabled = true;
    tip.textContent = '签筒正在晃动……';
  });

  /* ================= 视图切换 ================= */

  function showResult() {
    state = 'result';
    // 抽签不放回：从洗好的牌堆里取一件，连续抽取不会重复
    const artifact = drawArtifact();
    selected.userData.artifact = artifact;
    const { fortune } = selected.userData;
    fateEl.textContent = fortune;
    fateEl.classList.toggle('great', fortune === '大吉');
    imageEl.src = artifactImage(artifact);
    imageEl.alt = artifact.name;
    root.classList.add('result-open');
    resultEl.classList.remove('hidden');
  }

  function openStory() {
    if (!selected) return;
    const artifact = selected.userData.artifact;
    storyTag.textContent = artifact.tag ?? '';
    storyTitle.textContent = artifact.name;
    typing.full = artifactStory(artifact);
    typing.shown = 0;
    typing.t = 0;
    typing.active = true;
    typing.doneAt = 0;
    storyBody.textContent = '';
    storyBody.scrollTop = 0;
    storyHintText.textContent = '跳过';
    storyEl.classList.remove('hidden');
    root.classList.add('story-open');
    state = 'story';
  }

  function finishTyping() {
    typing.active = false;
    typing.doneAt = performance.now();
    storyBody.textContent = typing.full;
    storyHintText.textContent = '返回木签';
  }

  function closeStory() {
    typing.active = false;
    storyEl.classList.add('hidden');
    root.classList.remove('story-open');
    state = 'result';
  }

  /** 把抽出的签放回签筒，可以直接再抽一支 */
  function backToTube() {
    typing.active = false;
    selected = null;
    state = 'tube';
    canDraw = true;
    root.classList.remove('result-open', 'story-open');
    resultEl.classList.add('hidden');
    storyEl.classList.add('hidden');
    resetSticks();
    tip.textContent = '点击木签，再抽一支灵签';
    shakeBtn.disabled = false;
  }

  slip.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state === 'result') openStory();
  });

  againBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state === 'result') backToTube();
  });

  /* ================= 对外接口 ================= */

  function openGame() {
    open = true;
    state = 'tube';
    canDraw = false;
    selected = null;
    hovered = null;
    typing.active = false;
    root.classList.remove('hidden', 'result-open', 'story-open');
    resultEl.classList.add('hidden');
    storyEl.classList.add('hidden');
    tip.textContent = '先摇晃签筒，再从中抽出一支灵签';
    shakeBtn.disabled = false;
    resetSticks();
    resize();
  }

  function closeGame() {
    open = false;
    state = 'tube';
    canDraw = false;
    selected = null;
    typing.active = false;
    root.classList.add('hidden');
    root.classList.remove('result-open', 'story-open');
    resultEl.classList.add('hidden');
    storyEl.classList.add('hidden');
    resetSticks();
  }

  /** 键盘处理，返回 true 表示事件已被游戏消费 */
  function handleKey(code) {
    if (!open) return false;

    if (code === 'Escape') {
      // 直接退出抽签，回到展馆继续参观
      closeGame();
      return true;
    }

    if (code === 'KeyE') {
      if (state === 'result') {
        openStory();
        return true;
      }
      if (state === 'story') {
        if (typing.active) {
          finishTyping();
        } else if (performance.now() - typing.doneAt > 600) {
          // 文字已全部显示时再按 E 才回到木签，避免连按两下直接跳过故事
          closeStory();
        }
        return true;
      }
      return false;
    }

    if (code === 'KeyO') {
      if (state === 'result' && selected) {
        onInspect?.(selected.userData.artifact);
        return true;
      }
      return false;
    }

    return false;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    if (!open) return;
    idleT += dt;

    if (state === 'shaking') {
      shakeT += dt;
      const amp = Math.max(0, 1 - shakeT / 1.0);
      tube.rotation.z = Math.sin(shakeT * 30) * 0.22 * amp;
      tube.position.y = Math.abs(Math.sin(shakeT * 17)) * 0.07 * amp;
      // 每支签各自随机相位抖动，看起来像在筒里被洗牌
      for (const stick of sticks) {
        const { baseY, baseRotZ, baseRotX, phase } = stick.userData;
        stick.position.y = baseY + Math.sin(shakeT * 34 + phase) * 0.14 * amp;
        stick.rotation.z = baseRotZ + Math.sin(shakeT * 28 + phase) * 0.07 * amp;
        stick.rotation.x = baseRotX + Math.sin(shakeT * 22 + phase * 1.3) * 0.05 * amp;
      }
      if (shakeT >= 1.0) {
        tube.rotation.z = 0;
        tube.position.y = 0;
        resetSticks();
        state = 'tube';
        canDraw = true;
        shakeBtn.disabled = false;
        tip.textContent = '点击木签，抽出一支灵签';
      }
    } else if (state === 'popping') {
      popT += dt;
      const k = Math.min(1, popT / 0.45);
      const eased = 1 - Math.pow(1 - k, 3);
      selected.position.y = selected.userData.baseY + eased * 1.15;
      selected.rotation.z = selected.userData.baseRotZ + eased * 0.1;
      if (k >= 1) showResult();
    } else if (state === 'tube') {
      tube.rotation.z = Math.sin(idleT * 1.1) * 0.012;
      tube.position.y = Math.sin(idleT * 0.9) * 0.015;
      tube.rotation.y = Math.sin(idleT * 0.4) * 0.06;
    }

    if (typing.active) {
      typing.t += dt * 1000;
      const count = Math.floor(typing.t / CHAR_MS);
      if (count >= typing.full.length) {
        finishTyping();
      } else if (count !== typing.shown) {
        typing.shown = count;
        storyBody.textContent = typing.full.slice(0, count);
      }
    }

    renderer.render(scene, camera);
  }

  return {
    open: openGame,
    close: closeGame,
    update,
    resize,
    handleKey,
    isOpen: () => open,
    isStoryOpen: () => state === 'story',
    isResultOpen: () => state === 'result',
    selectedArtifact: () => (selected ? selected.userData.artifact : null),
    /** 当前故事文本框里的全部文字，供朗读器使用 */
    storyText: () => typing.full,
  };
}
