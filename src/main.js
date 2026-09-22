import * as THREE from 'three';
import { createMuseum, ROOM } from './museum.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { createHud } from './hud.js';

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
scene.fog = new THREE.Fog(0x0e1118, 28, 58);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

const museum = createMuseum(scene);
const input = new Input(canvas);
const hud = createHud();

const player = new Player({
  scene,
  room: ROOM,
  colliders: museum.colliders,
  spawn: new THREE.Vector3(0, 0, 9),
});

input.onLockChange = (locked) => hud.setLocked(locked);

/* ---------- 交互 ---------- */

let activeItem = null;

document.getElementById('overlay').addEventListener('mousedown', () => input.requestLock());

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE') {
    if (hud.isPanelOpen()) {
      closePanel();
    } else if (activeItem) {
      hud.showInfo(activeItem);
      input.exitLock();
    }
  } else if (event.code === 'Escape' && hud.isPanelOpen()) {
    closePanel();
  }
});

function closePanel() {
  hud.hideInfo();
  hud.setLocked(input.pointerLocked);
}

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

  const blockInput = hud.isPanelOpen();
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
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
