import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createArtifactObject } from './artifacts.js';

/**
 * 展品缩略图渲染器：用一块离屏 WebGL 画布把展品渲染成 dataURL 图片。
 * 抽签结果卡与猜谜游戏的「局部 / 剪影 / 图鉴」共用，按展品名缓存。
 */
/**
 * 缓存版本号。外部模型是异步换进来的，换完旧缩略图就作废了 ——
 * 把版本号 +1，缓存键随之改变，下一次就会重新截取。
 */
let generation = 0;

export function bumpThumbnailGeneration() {
  generation += 1;
}

export function createThumbnailer({ size = 440 } = {}) {
  const cache = new Map();
  let rig = null;

  function ensureRig() {
    if (rig) return rig;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.85;
    pmrem.dispose();

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xfff3e2, 2.3);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ecdff, 1.1);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.45, 0.06, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.5, metalness: 0.3 }),
    );
    stage.position.y = -0.05;
    scene.add(stage);

    const holder = new THREE.Group();
    scene.add(holder);

    rig = {
      renderer,
      scene,
      holder,
      stage,
      camera: new THREE.PerspectiveCamera(34, 1, 0.05, 100),
    };
    return rig;
  }

  return function thumbnail(artifact) {
    const key = artifact.name + "#" + generation;
    if (cache.has(key)) return cache.get(key);
    const current = ensureRig();

    current.holder.clear();
    const { object } = createArtifactObject(artifact);
    current.holder.add(object);

    const box = new THREE.Box3().setFromObject(object);
    const dimensions = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.0 / (Math.max(dimensions.x, dimensions.y, dimensions.z) || 1);
    object.scale.setScalar(scale);
    object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const halfHeight = (dimensions.y * scale) / 2;
    current.stage.position.y = -halfHeight - 0.05;
    current.stage.scale.setScalar(Math.max(0.5, Math.min(1.4, Math.max(dimensions.x, dimensions.z) * scale)));

    current.camera.position.set(0, 0.35, 3.5);
    current.camera.lookAt(0, 0.05, 0);
    current.renderer.render(current.scene, current.camera);

    const url = current.renderer.domElement.toDataURL('image/png');
    cache.set(key, url);
    return url;
  };
}
