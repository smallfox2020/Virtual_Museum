import * as THREE from 'three';
import { createMuseum, ROOM, LAYOUT } from './museum.js';
import { Input } from './input.js';
import { Player, CHARACTER_URL } from './player.js';
import { preloadCharacter } from './character.js';
import { createHud } from './hud.js';
import { createInspector } from './inspector.js';
import { createFortune } from './fortune.js';
import { createArtifactObject } from './artifacts.js';
import { createAudio } from './audio.js';
import { createReader } from './reader.js';
import { createMinimap } from './minimap.js';
import { createRoomTitle } from './roomtitle.js';
import { createQuiz } from './quiz/quiz.js';
import { createThumbnailer } from './thumbnails.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1118);
scene.fog = new THREE.Fog(0x0e1118, 34, 90);

// 金属（青铜、金、钢）没有环境反射会发黑，用程序生成的室内环境贴图补上
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.12;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);

// 先把角色模型的下载挂上，与下面的展厅搭建并行进行（6.9 MB，能省下好几秒）
preloadCharacter(CHARACTER_URL);

const museum = createMuseum(scene);
const input = new Input(canvas);
const hud = createHud();
const inspector = createInspector(document.getElementById('inspect-canvas'));
const fortune = createFortune({
  canvas: document.getElementById('fortune-canvas'),
  onInspect: (artifact) => openArtifactInspector(artifact),
});
const audio = createAudio();
const reader = createReader();
const minimap = createMinimap({ layout: LAYOUT, exhibits: museum.interactables });
const roomTitle = createRoomTitle({ zones: LAYOUT.zones });

const player = new Player({
  scene,
  room: ROOM,
  colliders: museum.colliders,
  spawn: museum.spawn,
});

input.onLockChange = (locked) => {
  if (locked) hud.markStarted();
  hud.setLocked(locked);
};

/* ---------- 展品侦探：题库与控制器 ---------- */

let puzzles = [];
try {
  const response = await fetch('./data/puzzles.json');
  if (response.ok) puzzles = await response.json();
} catch (error) {
  console.warn('[quiz] 题库加载失败：', error);
}

const thumbnail = createThumbnailer();
const quiz = createQuiz({
  puzzles,
  thumbnail,
  speak: (text) => reader.announce(text),
  onReveal: (puzzle) => playExhibitCinematic(puzzle),
  onSpatialHint: (name) => spatialHint(name),
  onOpen: () => {
    reader.stop();
    hudRoot.classList.add('quiz-open');
    input.exitLock();
  },
  onClose: () => {
    reader.stop();
    hudRoot.classList.remove('quiz-open');
    resumeScene();
  },
});

/* ---------- 右上角：音乐与设置 ---------- */

const musicBtn = document.getElementById('music-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings');
const volumeInput = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const readerToggle = document.getElementById('reader-toggle');
const readerState = document.getElementById('reader-state');
const quizBtn = document.getElementById('quiz-btn');

audio.setVolume(Number(volumeInput.value) / 100);

musicBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  audio.unlock();
  musicBtn.classList.toggle('playing', audio.toggle());
});

settingsBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  settingsPanel.classList.toggle('hidden');
});

quizBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  openQuiz();
});

volumeInput.addEventListener('input', () => {
  audio.setVolume(Number(volumeInput.value) / 100);
  volumeValue.textContent = volumeInput.value;
});

/* ---------- 设置面板：朗读器开关 ---------- */

function applyReaderUI() {
  const on = reader.isEnabled();
  readerToggle.setAttribute('aria-checked', on ? 'true' : 'false');
  readerState.textContent = on ? '已启用' : '未启用';
}

if (!reader.supported) {
  readerToggle.disabled = true;
  readerState.textContent = '不可用';
}
applyReaderUI();

// 朗读器默认开启（原来默认关闭，用户希望进场景就能用）
if (reader.supported && !reader.isEnabled()) {
  reader.toggle();
  applyReaderUI();
}

readerToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  if (!reader.supported) return;
  reader.toggle();
  applyReaderUI();
  hud.showToast(reader.isEnabled() ? '朗读器已启用 · 在界面内按 L 朗读' : '朗读器已关闭');
});

/* ---------- 设置面板：小地图 ---------- */

function bindCheckToggle(buttonId, stateId, onChange, defaultOn = false) {
  const button = document.getElementById(buttonId);
  const state = document.getElementById(stateId);
  let value = defaultOn;
  const render = () => {
    button.setAttribute('aria-checked', value ? 'true' : 'false');
    button.classList.toggle('on', value);
    state.textContent = value ? '开启' : '关闭';
  };
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    value = !value;
    render();
    onChange(value);
  });
  render();
  onChange(value); // 默认值也要应用一次，否则开关是「开」而功能没开
  return { isOn: () => value };
}

bindCheckToggle('minimap-toggle', 'minimap-state', (on) => {
  minimap.setVisible(on);
}, true);

bindCheckToggle('roomtitle-toggle', 'roomtitle-state', (on) => {
  roomTitle.setEnabled(on);
}, true);

document.addEventListener('mousedown', (event) => {
  if (settingsPanel.classList.contains('hidden')) return;
  if (settingsPanel.contains(event.target) || settingsBtn.contains(event.target)) return;
  settingsPanel.classList.add('hidden');
});

/* ---------- 交互 ---------- */

const inspectOverlay = document.getElementById('inspect');
const inspectTag = document.getElementById('inspect-tag');
const inspectTitle = document.getElementById('inspect-title');
const hudRoot = document.getElementById('hud');

let activeItem = null; // 附近可交互的展品
let panelItem = null; // 面板里正在介绍的展品

// 指针锁定失败（部分浏览器/环境不可用）时也要能继续，输入会退化为按住拖动
const enterScene = () => {
  hud.markStarted();
  input.requestLock();
};
document.getElementById('overlay').addEventListener('mousedown', enterScene);
document.getElementById('resume').addEventListener('mousedown', enterScene);

function openPanel(item) {
  reader.stop();
  panelItem = item;
  closeInspector();
  hud.showInfo(item);
  input.exitLock();
}

/** 打开序厅的抽签小游戏；指针锁定与输入交给游戏接管 */
function openFortune() {
  reader.stop();
  closeInspector();
  hud.hideInfo();
  panelItem = null;
  fortune.open();
  hudRoot.classList.add('fortune-open');
  input.exitLock();
}

/** 打开展品侦探猜谜小游戏 */
function openQuiz() {
  if (cinematic.active) return;
  if (!puzzles.length) {
    hud.showToast('题库加载失败，无法开始猜谜');
    return;
  }
  reader.stop();
  closeInspector();
  hud.hideInfo();
  panelItem = null;
  quiz.open();
}

/* ---------- 猜谜答对后的 3D 反馈：飞到展品前 + 高亮 + 方位提示 ---------- */

const fly = { active: false, t: 0, duration: 0.9, from: { x: 0, z: 0, yaw: 0 }, to: { x: 0, z: 0, yaw: 0 }, onDone: null };
const cinematic = { active: false };
let highlight = null;

function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function findExhibit(name) {
  const matches = museum.interactables.filter((item) => item.title === name);
  // 有的展板与展品同名（如「越王勾践剑」），优先取真正的 3D 展品
  return matches.find((item) => item.kind === 'artifact') ?? matches[0] ?? null;
}

function startFly(to, duration, onDone) {
  fly.from = { x: player.position.x, z: player.position.z, yaw: player.yaw };
  fly.to = to;
  fly.duration = duration;
  fly.t = 0;
  fly.active = true;
  fly.onDone = onDone ?? null;
}

function flyToExhibit(name, onDone) {
  const item = findExhibit(name);
  if (!item) return false;
  const ex = item.position.x;
  const ez = item.position.z;
  let dx = player.position.x - ex;
  let dz = player.position.z - ez;
  let length = Math.hypot(dx, dz);
  if (length < 0.001) {
    dx = 0;
    dz = 1;
    length = 1;
  }
  dx /= length;
  dz /= length;
  startFly({ x: ex + dx * 2.4, z: ez + dz * 2.4, yaw: Math.atan2(dx, dz) }, 0.9, onDone);
  return true;
}

function highlightExhibit(name) {
  const item = findExhibit(name);
  if (!item) return;
  if (!highlight) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.045, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd464, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const light = new THREE.PointLight(0xffd88a, 0, 9, 2);
    light.position.y = 1.7;
    group.add(light);
    group.userData = { ring, light, t: 0, active: false };
    scene.add(group);
    highlight = group;
  }
  highlight.position.set(item.position.x, 0.05, item.position.z);
  highlight.userData.t = 0;
  highlight.userData.active = true;
  highlight.visible = true;
}

/** 答对后的过场：隐藏答题 UI → 切第一人称 → 飞到展品前 → 自动旋转展示一圈 → 飞回原位 → 恢复答题 UI */
function playExhibitCinematic(puzzle) {
  const item = findExhibit(puzzle.answer);
  if (!item?.model || cinematic.active) return;
  cinematic.active = true;
  const saved = { x: player.position.x, z: player.position.z, yaw: player.yaw, mode: player.mode };

  quiz.setCinematic(true);
  reader.stop();
  player.setMode('first');
  // 抬高视角：默认平视展品，而不是低头看展台基座
  player.pitch = 0;
  highlightExhibit(puzzle.answer);

  flyToExhibit(puzzle.answer, () => {
    inspector.open(item.model, { title: item.title, tag: item.tag });
    inspectTag.textContent = item.tag ?? '';
    inspectTitle.textContent = item.title ?? '';
    inspectOverlay.classList.remove('hidden');
    inspector.resize();
    reader.announce(`${puzzle.answer}。${puzzle.explanation}${puzzle.funFact ? ` ${puzzle.funFact}` : ''}`);
    inspector.spinOnce(1, () => {
      // 关闭观察（不打断导览语音），再飞回原位
      inspector.close();
      inspectOverlay.classList.add('hidden');
      startFly({ x: saved.x, z: saved.z, yaw: saved.yaw }, 0.9, () => {
        player.setMode(saved.mode);
        cinematic.active = false;
        quiz.setCinematic(false);
      });
    });
  });
}

/** 答错时的空间方位提示 */
function spatialHint(name) {
  const item = findExhibit(name);
  if (!item) return '它不在你附近，换个展厅找找。';
  const dx = item.position.x - player.position.x;
  const dz = item.position.z - player.position.z;
  const distance = Math.hypot(dx, dz);
  const forward = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
  const right = { x: -forward.z, z: forward.x };
  const dotF = distance > 0.001 ? (dx * forward.x + dz * forward.z) / distance : 1;
  const dotR = distance > 0.001 ? (dx * right.x + dz * right.z) / distance : 0;
  let direction = dotF > 0.6 ? '正前方' : dotF < -0.5 ? '身后' : dotF > 0 ? '前方' : '后方';
  if (Math.abs(dotR) > 0.45) direction += dotR > 0 ? '偏右' : '偏左';
  const range = distance < 6 ? '就在附近' : distance < 14 ? `约 ${Math.round(distance)} 米外` : '在展厅另一头';
  return `它在你${direction}，${range}。`;
}

/** 指针锁定再次可用 */
function resumeScene() {
  input.enabled = true;
  input.requestLock();
}

/** 按 E / Esc 关掉介绍，直接回到漫游，不需要再点一次画面 */
function closePanel() {
  reader.stop();
  closeInspector();
  hud.hideInfo();
  panelItem = null;
  // 面板打开时输入是被禁用的，这里先放开再抢回指针锁定
  input.enabled = true;
  input.requestLock();
}

function openInspector() {
  const item = panelItem ?? activeItem;
  if (!item?.model || inspector.isOpen()) return;
  inspector.open(item.model, { title: item.title, tag: item.tag });
  inspectTag.textContent = item.tag ?? '';
  inspectTitle.textContent = item.title ?? '';
  inspectOverlay.classList.remove('hidden');
  inspector.resize();
}

function closeInspector() {
  if (!inspector.isOpen()) return;
  reader.stop();
  inspector.close();
  inspectOverlay.classList.add('hidden');
}

/** 从抽签结果里按 O 单独观察对应展品的 3D 模型 */
function openArtifactInspector(artifact) {
  if (!artifact) return;
  reader.stop();
  const { object } = createArtifactObject(artifact);
  inspector.open(object, { title: artifact.name, tag: artifact.tag });
  inspectTag.textContent = artifact.tag ?? '';
  inspectTitle.textContent = artifact.name;
  inspectOverlay.classList.remove('hidden');
  inspector.resize();
}

/** 按 L：朗读当前交互界面里的文字（正在朗读时再按一次则停止） */
function readCurrentInterface() {
  if (reader.isSpeaking()) {
    reader.stop();
    return;
  }
  if (!reader.isEnabled()) {
    hud.showToast('请先在设置里启用朗读器');
    return;
  }

  let text = '';
  if (fortune.isStoryOpen()) text = fortune.storyText();
  else if (hud.isPanelOpen()) text = hud.panelText();
  else if (inspector.isOpen()) text = [inspectTag.textContent, inspectTitle.textContent].filter(Boolean).join('。');

  if (!text) {
    hud.showToast('当前界面没有可朗读的文字');
    return;
  }
  reader.speak(text);
  hud.showToast('朗读中…再按 L 停止');
}

window.addEventListener('keydown', (event) => {
  // 答对后的过场动画期间屏蔽一切按键，避免打断展示
  if (cinematic.active) return;
  if (event.code === 'KeyE') {
    if (inspector.isOpen()) return;
    if (quiz.isOpen()) {
      if (quiz.isHunting()) {
        if (!activeItem) hud.showToast('走近一件展品再按 E');
        else if (activeItem.kind === 'artifact') quiz.tryHuntAnswer(activeItem);
        else hud.showToast('这是展板，按线索去找真正的展品');
      }
      return;
    }
    if (fortune.isOpen()) {
      reader.stop();
      fortune.handleKey('KeyE');
      if (!fortune.isOpen()) {
        hudRoot.classList.remove('fortune-open');
        resumeScene();
      }
      return;
    }
    if (hud.isPanelOpen()) closePanel();
    else if (activeItem) {
      if (activeItem.kind === 'fortune') openFortune();
      else if (activeItem.kind === 'quiz') openQuiz();
      else openPanel(activeItem);
    }
  } else if (event.code === 'KeyO') {
    if (quiz.isOpen()) return;
    if (fortune.isOpen()) {
      fortune.handleKey('KeyO');
      return;
    }
    openInspector();
  } else if (event.code === 'KeyV') {
    // 面板/观察/抽签/猜谜模式是模态的，那里不切视角
    if (inspector.isOpen() || hud.isPanelOpen() || fortune.isOpen() || quiz.isOpen()) return;
    hud.setViewMode(player.toggleMode());
  } else if (event.code === 'KeyL') {
    event.preventDefault();
    readCurrentInterface();
  } else if (event.code === 'Escape') {
    // Esc 在观察模式里回到介绍面板，在介绍面板/抽签/猜谜里回到场景
    if (inspector.isOpen()) closeInspector();
    else if (quiz.isOpen()) quiz.handleKey('Escape');
    else if (fortune.isOpen()) {
      reader.stop();
      fortune.handleKey('Escape');
      if (!fortune.isOpen()) {
        hudRoot.classList.remove('fortune-open');
        resumeScene();
      }
    } else if (hud.isPanelOpen()) closePanel();
  }
});

function findNearestInteractable() {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const item of museum.interactables) {
    const dx = item.position.x - player.position.x;
    const dz = item.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < item.radius && distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/* ---------- 尺寸 ---------- */

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  inspector.resize();
  fortune.resize();
}

window.addEventListener('resize', resize);
resize();
hud.setLocked(false);

/* ---------- 主循环 ---------- */

const clock = new THREE.Clock();
let elapsed = 0;
let frameCount = 0;
let fpsTimer = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const blockInput = hud.isPanelOpen() || inspector.isOpen() || fortune.isOpen() || quiz.blocksInput();
  input.enabled = !blockInput;

  // 答对后相机飞向展品
  if (fly.active) {
    fly.t += dt;
    const k = Math.min(1, fly.t / fly.duration);
    const eased = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
    player.position.x = fly.from.x + (fly.to.x - fly.from.x) * eased;
    player.position.z = fly.from.z + (fly.to.z - fly.from.z) * eased;
    player.yaw = fly.from.yaw + shortestAngle(fly.from.yaw, fly.to.yaw) * eased;
    player.velocity.x = 0;
    player.velocity.z = 0;
    if (k >= 1) {
      fly.active = false;
      const done = fly.onDone;
      fly.onDone = null;
      done?.();
    }
  }

  player.update(dt, camera, input, !blockInput);
  museum.update(dt, elapsed);
  // 阴影相机跟着玩家走：房间有 48 × 80 m，固定范围的阴影贴图精度不够
  museum.updateShadowFocus?.(player.position.x, player.position.z);

  minimap.update(player);
  if (!blockInput && !cinematic.active) roomTitle.update(dt, player.position);

  // 高亮光圈与灯光
  if (highlight?.userData.active) {
    const u = highlight.userData;
    u.t += dt;
    const life = 5;
    const k = u.t / life;
    if (k >= 1) {
      u.active = false;
      highlight.visible = false;
      u.light.intensity = 0;
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(u.t * 6);
      highlight.scale.setScalar(1 + pulse * 0.18);
      u.ring.material.opacity = (1 - k) * (0.45 + pulse * 0.5);
      u.light.intensity = (1 - k) * (7 + pulse * 7);
    }
  }

  activeItem = blockInput ? null : findNearestInteractable();
  hud.setPrompt(activeItem);

  frameCount += 1;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    hud.setStats(
      `${Math.round(frameCount / fpsTimer)} FPS · 坐标 ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`,
    );
    frameCount = 0;
    fpsTimer = 0;
  }

  renderer.render(scene, camera);
  inspector.update(dt);
  fortune.update(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// 方便在浏览器控制台里调试：window.museumApp.museum / .player / .audio ...
window.museumApp = { scene, camera, renderer, museum, player, input, hud, inspector, fortune, quiz, audio, reader, thumbnail, puzzles, minimap, roomTitle };
