import * as THREE from 'three';
import { createMuseum, ROOM } from './museum.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { createHud } from './hud.js';
import { createInspector } from './inspector.js';
import { createAudio } from './audio.js';
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

const museum = createMuseum(scene);
const input = new Input(canvas);
const hud = createHud();
const inspector = createInspector(document.getElementById('inspect-canvas'));
const audio = createAudio();

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

/* ---------- 右上角：音乐与设置 ---------- */

const musicBtn = document.getElementById('music-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings');
const volumeInput = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');

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

volumeInput.addEventListener('input', () => {
  audio.setVolume(Number(volumeInput.value) / 100);
  volumeValue.textContent = volumeInput.value;
});

document.addEventListener('mousedown', (event) => {
  if (settingsPanel.classList.contains('hidden')) return;
  if (settingsPanel.contains(event.target) || settingsBtn.contains(event.target)) return;
  settingsPanel.classList.add('hidden');
});

/* ---------- 交互 ---------- */

const inspectOverlay = document.getElementById('inspect');
const inspectTag = document.getElementById('inspect-tag');
const inspectTitle = document.getElementById('inspect-title');

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
  panelItem = item;
  closeInspector();
  hud.showInfo(item);
  input.exitLock();
}

/** 按 E / Esc 关掉介绍，直接回到漫游，不需要再点一次画面 */
function closePanel() {
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
  inspector.close();
  inspectOverlay.classList.add('hidden');
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE') {
    if (inspector.isOpen()) return;
    if (hud.isPanelOpen()) closePanel();
    else if (activeItem) openPanel(activeItem);
  } else if (event.code === 'KeyO') {
    openInspector();
  } else if (event.code === 'Escape') {
    // Esc 在观察模式里回到介绍面板，在介绍面板里回到场景
    if (inspector.isOpen()) closeInspector();
    else if (hud.isPanelOpen()) closePanel();
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

  const blockInput = hud.isPanelOpen() || inspector.isOpen();
  input.enabled = !blockInput;

  player.update(dt, camera, input, !blockInput);
  museum.update(dt, elapsed);

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
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// 方便在浏览器控制台里调试：window.museumApp.museum / .player / .audio ...
window.museumApp = { scene, camera, renderer, museum, player, input, hud, inspector, audio };
