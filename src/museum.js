import * as THREE from 'three';

/** 展厅内部半尺寸：x ∈ [-halfX, halfX]，z ∈ [-halfZ, halfZ] */
export const ROOM = {
  halfX: 15,
  halfZ: 11,
  height: 6,
  thickness: 0.4,
};

const PEDESTAL_HEIGHT = 1.05;
const PEDESTAL_RADIUS = 0.62;
const FLOAT_HEIGHT = 0.62;

const WALL_COLOR = 0x2b2f3c;
const FLOOR_TINT = 0xd8d2c6;

/** 中央与两侧的展品：全部由基本几何体拼成 */
const ARTIFACTS = [
  {
    shape: 'sphere',
    name: '紫晶球体',
    tag: '展品 01 · 雕塑',
    desc: '一整块紫晶打磨而成的球体，表面隐约可见细密的生长纹理。它会在展台上缓慢自转，把光线折成一道道紫色的弧。',
    pos: [-9, -6.5],
    color: 0x8f7bff,
  },
  {
    shape: 'icosahedron',
    name: '碎面水晶',
    tag: '展品 02 · 雕塑',
    desc: '二十面体切面构成的晶体，棱角被抛光成半透明。旋转时每个面都会闪一下，像被风吹动的湖面。',
    pos: [-9, 0],
    color: 0x54d6d1,
  },
  {
    shape: 'cylinder',
    name: '古柱残段',
    tag: '展品 03 · 建筑构件',
    desc: '出土的石柱残段，直径约一米，柱身留有竖直的凿痕。它曾是某座神庙廊柱的一部分。',
    pos: [-9, 6.5],
    color: 0xc9b48a,
  },
  {
    shape: 'torusKnot',
    name: '环结 · 无穷',
    tag: '展品 04 · 主体雕塑',
    desc: '展厅的中心：一条首尾相衔的环面纽结。数学上它是三叶结的一个变体，视觉上它只是一次没有尽头的绕行。',
    pos: [0, 0],
    color: 0xffb35c,
    center: true,
  },
  {
    shape: 'cone',
    name: '塔尖模型',
    tag: '展品 05 · 建筑构件',
    desc: '一座宝塔顶部的等比模型，圆锥由下至上收分成尖顶，表面刻有细密的横向叠涩线。',
    pos: [9, -6.5],
    color: 0xe0725f,
  },
  {
    shape: 'torus',
    name: '时光之环',
    tag: '展品 06 · 雕塑',
    desc: '中空的圆环，像一枚立起来的日晷。正午的阳光穿过环心时，地面上会留下一道完整的光斑。',
    pos: [9, 0],
    color: 0x6fa8ff,
  },
  {
    shape: 'box',
    name: '石碑',
    tag: '展品 07 · 碑刻',
    desc: '一方矮厚的石碑，碑面刻着已经风化的文字，只有边角的装饰纹样还清晰可辨。',
    pos: [9, 6.5],
    color: 0x9bd07a,
  },
];

/** 墙面画作：wall 指定墙面，offset 是墙面上的横向坐标 */
const PAINTINGS = [
  { wall: 'north', offset: -9 },
  { wall: 'north', offset: 0 },
  { wall: 'north', offset: 9 },
  { wall: 'south', offset: -9 },
  { wall: 'south', offset: 0 },
  { wall: 'south', offset: 9 },
  { wall: 'west', offset: -5.5 },
  { wall: 'west', offset: 5.5 },
  { wall: 'east', offset: -5.5 },
  { wall: 'east', offset: 5.5 },
];

const PAINTING_TITLES = [
  ['晨雾中的山谷', '布面油画 · 180 × 220 cm'],
  ['无名之城的黄昏', '综合材料 · 160 × 200 cm'],
  ['海面的第九次呼吸', '布面丙烯 · 180 × 220 cm'],
  ['两株松树', '木板油彩 · 150 × 190 cm'],
  ['静物：陶罐与光', '布面油画 · 160 × 200 cm'],
  ['夜行列车', '纸本设色 · 170 × 210 cm'],
  ['蓝房间', '布面油画 · 150 × 190 cm'],
  ['远方的信号塔', '数字微喷 · 160 × 200 cm'],
  ['折叠的时间', '综合材料 · 150 × 190 cm'],
  ['冬日温室', '布面油画 · 160 × 200 cm'],
];

const PAINTING_DESC =
  '画面以概括的色块与弧线构成，不指向具体的地点，而更接近一次回望时残留的印象。近看可以看到笔触层层覆盖的痕迹。';

/* ------------------------------------------------------------------ */
/* 程序化贴图                                                          */
/* ------------------------------------------------------------------ */

function makeFloorTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d9d3c7';
  ctx.fillRect(0, 0, size, size);

  // 每张贴图铺 2 × 2 块地砖，即每块砖约 1 个世界单位
  ctx.strokeStyle = '#bfb7a8';
  ctx.lineWidth = 5;
  for (let i = 0; i <= 2; i += 1) {
    const p = (i * size) / 2;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let i = 0; i < 160; i += 1) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(ROOM.halfX, ROOM.halfZ);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeCeilingTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#20232e';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 2; i += 1) {
    const p = (i * size) / 2;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 用 canvas 画出一幅抽象的“画作” */
function makePaintingTexture(index) {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const hue = (index * 67) % 360;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, `hsl(${hue}, 46%, 22%)`);
  gradient.addColorStop(0.55, `hsl(${(hue + 28) % 360}, 52%, 42%)`);
  gradient.addColorStop(1, `hsl(${(hue + 62) % 360}, 58%, 66%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // 太阳 / 月亮
  ctx.fillStyle = `hsla(${(hue + 180) % 360}, 90%, 78%, 0.9)`;
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.26, h * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // 山峦
  const baseY = h * 0.72;
  ctx.fillStyle = `hsla(${hue}, 40%, 14%, 0.85)`;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);
  ctx.lineTo(w * 0.22, baseY - h * 0.16);
  ctx.lineTo(w * 0.45, baseY - h * 0.03);
  ctx.lineTo(w * 0.66, baseY - h * 0.2);
  ctx.lineTo(w, baseY - h * 0.06);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `hsla(${(hue + 90) % 360}, 45%, 20%, 0.8)`;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);

  // 几道笔触
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * (0.2 + i * 0.045));
    ctx.lineTo(w * (0.4 + i * 0.1), h * (0.18 + i * 0.05));
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 展品几何体                                                          */
/* ------------------------------------------------------------------ */

function makeArtifactGeometry(shape, center) {
  const s = center ? 1.65 : 1;
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(0.42 * s, 48, 32);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(0.46 * s, 0);
    case 'cylinder':
      return new THREE.CylinderGeometry(0.34 * s, 0.36 * s, 0.95 * s, 28);
    case 'torusKnot':
      return new THREE.TorusKnotGeometry(0.42 * s, 0.14 * s, 180, 24);
    case 'cone':
      return new THREE.ConeGeometry(0.42 * s, 0.95 * s, 28);
    case 'torus':
      return new THREE.TorusGeometry(0.4 * s, 0.15 * s, 24, 64);
    case 'box':
      return new THREE.BoxGeometry(0.72 * s, 0.9 * s, 0.32 * s);
    default:
      return new THREE.DodecahedronGeometry(0.45 * s);
  }
}

function makeArtifactMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.32,
    metalness: 0.45,
    emissive: new THREE.Color(color).multiplyScalar(0.16),
  });
}

/* ------------------------------------------------------------------ */
/* 展厅构建                                                            */
/* ------------------------------------------------------------------ */

function buildShell(scene) {
  const { halfX, halfZ, height, thickness } = ROOM;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(halfX * 2, halfZ * 2),
    new THREE.MeshStandardMaterial({
      map: makeFloorTexture(),
      color: FLOOR_TINT,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(halfX * 2, halfZ * 2),
    new THREE.MeshStandardMaterial({
      map: makeCeilingTexture(),
      color: 0x8a90a0,
      roughness: 1,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  scene.add(ceiling);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.92 });
  const walls = [
    { size: [halfX * 2 + thickness * 2, height, thickness], pos: [0, height / 2, -halfZ - thickness / 2] },
    { size: [halfX * 2 + thickness * 2, height, thickness], pos: [0, height / 2, halfZ + thickness / 2] },
    { size: [thickness, height, halfZ * 2 + thickness * 2], pos: [-halfX - thickness / 2, height / 2, 0] },
    { size: [thickness, height, halfZ * 2 + thickness * 2], pos: [halfX + thickness / 2, height / 2, 0] },
  ];

  for (const { size, pos } of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMaterial);
    wall.position.set(...pos);
    wall.receiveShadow = true;
    scene.add(wall);
  }

  // 踢脚线
  const skirtMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1e27, roughness: 0.6 });
  const skirtHeight = 0.22;
  const skirts = [
    { size: [halfX * 2, skirtHeight, 0.06], pos: [0, skirtHeight / 2, -halfZ + 0.03] },
    { size: [halfX * 2, skirtHeight, 0.06], pos: [0, skirtHeight / 2, halfZ - 0.03] },
    { size: [0.06, skirtHeight, halfZ * 2], pos: [-halfX + 0.03, skirtHeight / 2, 0] },
    { size: [0.06, skirtHeight, halfZ * 2], pos: [halfX - 0.03, skirtHeight / 2, 0] },
  ];
  for (const { size, pos } of skirts) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(...size), skirtMaterial);
    skirt.position.set(...pos);
    scene.add(skirt);
  }

  // 天花板灯带
  const stripMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f6ff,
    emissive: 0xdfe6ff,
    emissiveIntensity: 1.1,
    roughness: 0.4,
  });
  for (const x of [-7, 0, 7]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, halfZ * 1.5), stripMaterial);
    strip.position.set(x, height - 0.1, 0);
    scene.add(strip);
  }
}

function buildColumns(scene, colliders) {
  const material = new THREE.MeshStandardMaterial({ color: 0xbfc4d2, roughness: 0.75 });
  const positions = [
    [-7, -8.5],
    [7, -8.5],
    [-7, 8.5],
    [7, 8.5],
  ];

  for (const [x, z] of positions) {
    const column = new THREE.Group();

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, ROOM.height - 0.5, 24),
      material,
    );
    shaft.position.y = ROOM.height / 2;
    shaft.castShadow = true;
    column.add(shaft);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), material);
    base.position.y = 0.15;
    base.castShadow = true;
    column.add(base);

    const capital = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), material);
    capital.position.y = ROOM.height - 0.4;
    capital.castShadow = true;
    column.add(capital);

    column.position.set(x, 0, z);
    scene.add(column);
    colliders.push({ x, z, radius: 0.85 });
  }
}

function buildPedestal(scene, artifact, colliders) {
  const radius = artifact.center ? PEDESTAL_RADIUS * 1.6 : PEDESTAL_RADIUS;
  const height = artifact.center ? PEDESTAL_HEIGHT + 0.25 : PEDESTAL_HEIGHT;
  const [x, z] = artifact.pos;

  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4f60, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 32), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const topMaterial = new THREE.MeshStandardMaterial({ color: 0x24283a, roughness: 0.35, metalness: 0.3 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, 0.08, 32), topMaterial);
  top.position.y = height + 0.04;
  top.receiveShadow = true;
  group.add(top);

  group.position.set(x, 0, z);
  scene.add(group);

  colliders.push({ x, z, radius: radius + 0.3 });

  // 悬浮在展台上方的展品
  const mesh = new THREE.Mesh(
    makeArtifactGeometry(artifact.shape, artifact.center),
    makeArtifactMaterial(artifact.color),
  );
  const baseY = height + 0.08 + FLOAT_HEIGHT;
  mesh.position.set(x, baseY, z);
  mesh.castShadow = true;
  scene.add(mesh);

  return {
    mesh,
    baseY,
    spin: artifact.center ? 0.42 : 0.7,
    interactable: {
      position: new THREE.Vector3(x, 1.4, z),
      radius: 2.9,
      title: artifact.name,
      tag: artifact.tag,
      desc: artifact.desc,
    },
  };
}

function buildPainting(scene, config, index, interactables) {
  const { halfX, halfZ } = ROOM;
  const group = new THREE.Group();
  const width = 1.6;
  const height = 2.0;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.16, height + 0.16, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x2a2a22, roughness: 0.55, metalness: 0.35 }),
  );
  frame.position.z = -0.06;
  frame.castShadow = true;
  group.add(frame);

  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: makePaintingTexture(index), roughness: 0.85 }),
  );
  group.add(picture);

  let rotationY = 0;
  const y = 2.55;

  if (config.wall === 'north') {
    group.position.set(config.offset, y, -halfZ + 0.06);
  } else if (config.wall === 'south') {
    group.position.set(config.offset, y, halfZ - 0.06);
    rotationY = Math.PI;
  } else if (config.wall === 'west') {
    group.position.set(-halfX + 0.06, y, config.offset);
    rotationY = Math.PI / 2;
  } else {
    group.position.set(halfX - 0.06, y, config.offset);
    rotationY = -Math.PI / 2;
  }

  group.rotation.y = rotationY;
  scene.add(group);

  const [title, medium] = PAINTING_TITLES[index % PAINTING_TITLES.length];
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  interactables.push({
    position: group.position.clone().addScaledVector(normal, 1.5).setY(1.4),
    radius: 2.6,
    title,
    tag: medium,
    desc: PAINTING_DESC,
  });
}

function buildLights(scene) {
  const { height, halfX, halfZ } = ROOM;

  scene.add(new THREE.AmbientLight(0x4d5670, 0.45));
  scene.add(new THREE.HemisphereLight(0xbdd0ff, 0x3a3128, 0.5));

  const sun = new THREE.DirectionalLight(0xfff2dd, 1.45);
  sun.position.set(9, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -halfX - 2;
  sun.shadow.camera.right = halfX + 2;
  sun.shadow.camera.top = halfZ + 2;
  sun.shadow.camera.bottom = -halfZ - 2;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // 天花板灯具
  const lampPoints = [
    [-7, -5],
    [7, -5],
    [-7, 5],
    [7, 5],
  ];
  for (const [x, z] of lampPoints) {
    const lamp = new THREE.PointLight(0xffe9c8, 16, 24, 2);
    lamp.position.set(x, height - 0.45, z);
    scene.add(lamp);
  }

  // 中央展品的聚光灯
  const spot = new THREE.SpotLight(0xfff3e0, 90, 14, 0.55, 0.45, 2);
  spot.position.set(0, height - 0.4, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  scene.add(spot);
  spot.target.position.set(0, 0, 0);
  scene.add(spot.target);
}

/* ------------------------------------------------------------------ */
/* 对外接口                                                            */
/* ------------------------------------------------------------------ */

export function createMuseum(scene) {
  const colliders = [];
  const interactables = [];
  const animated = [];

  buildShell(scene);
  buildLights(scene);
  buildColumns(scene, colliders);

  for (const artifact of ARTIFACTS) {
    animated.push(buildPedestal(scene, artifact, colliders));
  }

  PAINTINGS.forEach((config, index) => buildPainting(scene, config, index, interactables));

  for (const item of animated) interactables.push(item.interactable);

  return {
    colliders,
    interactables,
    update(dt, elapsed) {
      for (const item of animated) {
        item.mesh.rotation.y += item.spin * dt;
        item.mesh.position.y = item.baseY + Math.sin(elapsed * 1.4 + item.baseY) * 0.07;
        item.mesh.rotation.x = Math.sin(elapsed * 0.6) * 0.08;
      }
    },
  };
}
