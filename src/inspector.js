import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * 观察模式（在介绍面板里按 O 进入）：
 * 单独一块透明画布叠在被 backdrop-filter 虚化的场景之上，只画这一件器物。
 * 拖动鼠标旋转、滚轮缩放、按 Esc 回到介绍面板。
 */
export function createInspector(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.radius = 3;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9ecdff, 1.5);
  rim.position.set(-4, 2.5, -3.5);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(0, -3, 2);
  scene.add(fill);

  // 展台
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.4, 0.08, 56),
    new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.35, metalness: 0.45 }),
  );
  stage.receiveShadow = true;
  scene.add(stage);

  const pivot = new THREE.Group();
  scene.add(pivot);

  let visible = false;
  let holder = null;
  let yaw = 0.6;
  let pitch = 0.26;
  let distance = 3.6;
  let targetDistance = 3.6;
  let dragging = false;
  let idle = 0;
  let lastX = 0;
  let lastY = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    idle = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * 0.008;
    pitch = clamp(pitch + (event.clientY - lastY) * 0.006, -1.15, 1.15);
    lastX = event.clientX;
    lastY = event.clientY;
    idle = 0;
  });

  const endDrag = (event) => {
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      targetDistance = clamp(targetDistance * Math.exp(event.deltaY * 0.0012), 1.7, 9);
      idle = 0;
    },
    { passive: false },
  );

  /** 把任意 Object3D 克隆进观察场景（共享几何与材质，不额外占显存） */
  function open(object, info) {
    close();
    const clone = object.clone(true);
    clone.traverse((child) => {
      if (child.isMesh || child.isInstancedMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    const inner = new THREE.Group();
    inner.add(clone);
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 1.55 / (Math.max(size.x, size.y, size.z) || 1);
    inner.scale.setScalar(scale);
    inner.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    holder = new THREE.Group();
    holder.add(inner);
    holder.userData.info = info ?? {};
    pivot.add(holder);

    stage.position.y = -(size.y * scale) / 2 - 0.05;
    stage.scale.setScalar(Math.max(0.55, Math.min(1.6, Math.max(size.x, size.z) * scale)));

    yaw = 0.6;
    pitch = 0.26;
    targetDistance = 3.6;
    distance = 3.6;
    idle = 0;
    visible = true;
  }

  function close() {
    if (holder) {
      pivot.remove(holder);
      holder = null;
    }
    visible = false;
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    if (!visible) return;
    if (!dragging) {
      idle += dt;
      if (idle > 2) yaw += dt * 0.32;
    }
    distance += (targetDistance - distance) * (1 - Math.exp(-10 * dt));
    pivot.rotation.y = yaw;

    const height = Math.sin(pitch) * distance;
    const radius = Math.cos(pitch) * distance;
    camera.position.set(0, height, radius);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  return {
    open,
    close,
    resize,
    update,
    isOpen: () => visible,
    /** 当前观察的展品信息，用于标题 */
    info: () => (holder ? holder.userData.info : null),
    /** 调试用：观察场景的渲染统计 */
    debug: () => ({
      visible,
      children: pivot.children.length,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
      client: [canvas.clientWidth, canvas.clientHeight],
      camera: camera.position.toArray().map((v) => +v.toFixed(2)),
    }),
  };
}
