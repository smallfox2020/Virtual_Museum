import * as THREE from 'three';
import { ARTIFACTS, createArtifactObject, buildChimeBells, materials } from './artifacts.js';
import * as tex from './textures.js';

/* ================================================================== */
/* 平面布局：一条中央长廊串起两侧四个展厅，南端序厅、北端编钟厅           */
/*                                                                    */
/*                    北端：编钟厅（曾侯乙编钟 · 通高 12 m）             */
/*         ┌──────────────────────────────────────────┐               */
/*         │           曾 侯 乙 编 钟                    │  z: -27~-13   */
/*         └────────────────┬─────────────────────────┘               */
/*    ┌────────────┐    ┌────┴────┐    ┌────────────┐                 */
/*    │ 曾侯乙墓厅  │    │  长 廊   │    │  青铜器厅   │  z: 0~13       */
/*    ├────────────┤    │ 书画立轴 │    ├────────────┤                 */
/*    │  楚文化厅   │    │         │    │  陶瓷厅    │  z: -13~0      */
/*    └────────────┘    └────┬────┘    └────────────┘                 */
/*         ┌────────────────┴─────────────────────────┐               */
/*         │              序厅 · 导览图                 │  z: 13~27     */
/*         └──────────────────────────────────────────┘               */
/* ================================================================== */

export const ROOM = {
  halfX: 15,
  halfZ: 27,
  height: 12,
  thickness: 0.5,
};

const WALL_T = 0.3;
const DOOR_HALF = 1.7;
const DOOR_TOP = 3.6;

const CORRIDOR_HALF = 4;
const Z_LINE = 13;

const PEDESTAL_HEIGHT = 1;
const PEDESTAL_RADIUS = 0.6;
const FLOAT_HEIGHT = 0.45;

/** 各展厅平面：[x0, x1, z0, z1] */
const ZONES = [
  { id: 'entrance', name: '序厅', sub: '导览 · 前言', rect: [-15, 15, 13, 27], height: 7.5, fill: '#efe9da' },
  { id: 'corridor', name: '长廊', sub: '书画立轴', rect: [-4, 4, -13, 13], height: 6.2, fill: '#e6dfd0' },
  { id: 'bronze', name: '青铜器厅', sub: '罍 · 鼎 · 簋 · 镜 · 壶', rect: [4, 15, 0, 13], height: 5.2, fill: '#dcd6c6' },
  { id: 'ceramic', name: '陶瓷厅', sub: '青花 · 青瓷 · 彩陶', rect: [4, 15, -13, 0], height: 5.2, fill: '#dcd6c6' },
  { id: 'zenghouyi', name: '曾侯乙墓展厅', sub: '尊盘 · 鉴缶 · 建鼓座', rect: [-15, -4, 0, 13], height: 5.2, fill: '#dcd6c6' },
  { id: 'chu', name: '楚文化展厅', sub: '剑 · 鼓 · 镇墓兽', rect: [-15, -4, -13, 0], height: 5.2, fill: '#dcd6c6' },
  { id: 'bells', name: '编钟厅', sub: '曾侯乙编钟', rect: [-15, 15, -27, -13], height: 12, fill: '#e9e2d3' },
];

const zone = (id) => ZONES.find((item) => item.id === id);

/** 观众出生点（序厅中轴） */
const SPAWN = [0, 22.5];

/** 隔墙中心线，供几何与导览图共用 */
const WALL_SEGMENTS = [
  // 长廊西墙（留出曾侯乙墓厅与楚文化厅两个门洞）
  [-CORRIDOR_HALF, -Z_LINE, -CORRIDOR_HALF, -8.2],
  [-CORRIDOR_HALF, -4.8, -CORRIDOR_HALF, 4.8],
  [-CORRIDOR_HALF, 8.2, -CORRIDOR_HALF, Z_LINE],
  // 长廊东墙
  [CORRIDOR_HALF, -Z_LINE, CORRIDOR_HALF, -8.2],
  [CORRIDOR_HALF, -4.8, CORRIDOR_HALF, 4.8],
  [CORRIDOR_HALF, 8.2, CORRIDOR_HALF, Z_LINE],
  // 侧厅与序厅之间
  [-15, Z_LINE, -CORRIDOR_HALF, Z_LINE],
  [CORRIDOR_HALF, Z_LINE, 15, Z_LINE],
  // 侧厅与编钟厅之间
  [-15, -Z_LINE, -CORRIDOR_HALF, -Z_LINE],
  [CORRIDOR_HALF, -Z_LINE, 15, -Z_LINE],
  // 同侧两个展厅之间
  [-15, 0, -CORRIDOR_HALF, 0],
  [CORRIDOR_HALF, 0, 15, 0],
];

/** 门洞（画在导览图上） */
const DOOR_SIGNS = [
  { x: CORRIDOR_HALF, z: 6.5, name: '青铜器厅', sub: 'BRONZE HALL' },
  { x: CORRIDOR_HALF, z: -6.5, name: '陶瓷厅', sub: 'CERAMICS' },
  { x: -CORRIDOR_HALF, z: 6.5, name: '曾侯乙墓展厅', sub: 'ZENGHOUYI TOMB' },
  { x: -CORRIDOR_HALF, z: -6.5, name: '楚文化展厅', sub: 'CHU CULTURE' },
];

/* ------------------------------------------------------------------ */
/* 书画立轴（长廊两侧墙）                                               */
/* ------------------------------------------------------------------ */

const SCROLL_KINDS = ['shanshui', 'zhuzi', 'shufa', 'huaniao', 'shanshui', 'shufa'];

const SCROLLS = [
  { kind: 'shanshui', title: '楚山烟雨图', tag: '立轴 · 纸本水墨', desc: '烟云横锁，远峰只用淡墨一抹。楚地多水，画家把「空」留给了江面，也留给了看画的人。' },
  { kind: 'zhuzi', title: '墨竹图轴', tag: '立轴 · 纸本墨笔', desc: '竹竿用中锋写出，节节分明；竹叶以「个」字、「介」字叠排，一笔下去便有风。' },
  { kind: 'shufa', title: '行书七言诗轴', tag: '立轴 · 纸本墨书', desc: '行书讲究「行而不断」，笔锋在纸上提按转折，字与字之间靠气脉相连，而不是靠连笔。' },
  { kind: 'huaniao', title: '梅花山雀图', tag: '立轴 · 纸本设色', desc: '梅枝自左下斜出，花朵用没骨法点染，一只山雀收翅立于枝头，整幅画的重心就落在它的爪上。' },
  { kind: 'shanshui', title: '长江万里图（局部）', tag: '长卷 · 纸本水墨', desc: '长江出三峡、过江汉，画面上是连绵的水与山。长卷要一段段展开来看，观者的视线就是行船的路线。' },
  { kind: 'shufa', title: '隶书对联', tag: '对联 · 纸本墨书', desc: '隶书横画「蚕头燕尾」，一字之中有一笔主笔舒展，其余笔画收敛，整幅便稳如磐石。' },
];

/** 长廊两侧各 6 幅，避开两个门洞 */
const SCROLL_SLOTS = [-11.8, -9.2, -2.4, 2.4, 9.2, 11.8];

/* ------------------------------------------------------------------ */
/* 展板                                                                */
/* ------------------------------------------------------------------ */

const PANELS = [
  {
    wall: 'south',
    offset: 0,
    plan: true,
  },
  {
    wall: 'south',
    offset: -10,
    title: '前言',
    subtitle: 'PREFACE',
    body: '荆楚大地，长江中游。这里出土过改写中国音乐史的编钟，也出土过见证春秋霸业的青铜剑。展厅沿一条中央长廊展开：南端是序厅，北端是通高的编钟厅，两侧分别是曾侯乙墓、楚文化、青铜器与陶瓷四个展厅。',
  },
  {
    wall: 'south',
    offset: 10,
    title: '参观路线',
    subtitle: 'ROUTE',
    body: '由序厅向北进入长廊，长廊两侧是书画立轴与四个展厅的门洞；走到长廊尽头便进入编钟厅，曾侯乙编钟正悬在厅的正中。走近任意展品或展板按 E 查看介绍，在介绍界面按 O 可以单独观察这件器物。',
  },
  {
    wall: 'east',
    offset: 6.5,
    title: '青铜礼乐',
    subtitle: 'RITUAL BRONZE',
    body: '青铜器是先秦的「礼器」：鼎盛肉、簋盛黍稷、罍与壶盛酒。它们的数量与组合规定了使用者的身份，「钟鸣鼎食」说的正是这套制度。',
  },
  {
    wall: 'east',
    offset: 10.5,
    title: '铜罍与铜镜',
    subtitle: 'LEI AND MIRROR',
    body: '罍是大型盛酒器，小口广肩，肩上有衔环；铜镜的正面打磨光洁可以照容，背面则铸出蟠螭纹与弦纹，是青铜器中少见的「生活用器」。',
  },
  {
    wall: 'east',
    offset: -6.5,
    title: '土与火的艺术',
    subtitle: 'CLAY AND FIRE',
    body: '从屈家岭的彩陶到元代的青花，湖北的陶瓷史横跨五千年。高岭土与钴蓝在窑火中相遇，才有了梅瓶上那一抹永不褪色的蓝。',
  },
  {
    wall: 'east',
    offset: -10.5,
    title: '元青花',
    subtitle: 'BLUE AND WHITE',
    body: '元青花以进口的苏麻离青为料，发色浓艳并带有铁锈斑。人物故事题材存世极少，腹部四面开光的「四爱图」梅瓶是其中最完整的一件。',
  },
  {
    wall: 'west',
    offset: 6.5,
    title: '曾侯乙墓',
    subtitle: 'ZENGHOUYI TOMB',
    body: '1978 年发掘于随州擂鼓墩。墓主是战国早期曾国的国君乙，随葬品一万五千余件，其中青铜器总重约十吨，被称为「二十世纪最重要的考古发现之一」。',
  },
  {
    wall: 'west',
    offset: 10.5,
    title: '一钟双音',
    subtitle: 'TWO TONES',
    body: '曾侯乙编钟的每一件钟都能敲出两个乐音：正鼓音与侧鼓音。合瓦形的钟体让两音互不干扰，钟体上的铭文则记录了两千四百年前的乐律体系。',
  },
  {
    wall: 'west',
    offset: -6.5,
    title: '楚文化',
    subtitle: 'CHU CULTURE',
    body: '楚人尚赤、尚巫、尚凤。漆器以黑漆为地、朱漆为纹，青铜器走向细密繁复的失蜡工艺。楚文化的精神，一半是奇诡的想象，一半是精密的技艺。',
  },
  {
    wall: 'west',
    offset: -10.5,
    title: '越王勾践剑',
    subtitle: 'THE SWORD',
    body: '1965 年江陵望山一号楚墓出土。剑身满饰菱形暗格纹，近格处铸鸟篆铭文「越王鸠浅自作用剑」。出土时寒光凛冽、几乎不见锈蚀，被誉为「天下第一剑」。',
  },
  {
    wall: 'north',
    offset: -10,
    title: '曾侯乙编钟',
    subtitle: 'CHIME BELLS',
    body: '六十五件青铜编钟分三层八组悬挂在曲尺形钟架上，总重两千五百余公斤。钟体与钟枚上共有三千七百余字铭文，音域跨五个半八度。',
  },
  {
    wall: 'north',
    offset: 0,
    title: '青铜铸造',
    subtitle: 'CASTING',
    body: '尊盘口沿的透雕蟠虺纹由无数细小的铜梗焊接而成，至今难以复制。分范合铸、失蜡法、焊接与嵌错——先秦工匠把这些技术推到了极致。',
  },
  {
    wall: 'north',
    offset: 10,
    title: '乐悬制度',
    subtitle: 'MUSIC RITUAL',
    body: '「王宫悬，诸侯轩悬」。钟磬的悬挂方式本身就是等级：曾侯乙以诸侯之礼下葬，曲尺形的三面钟架正合「轩悬」之制。',
  },
];

/* ================================================================== */
/* 建筑                                                                */
/* ================================================================== */

const PALETTE = {
  wall: 0xd9d2c4,
  red: 0x9c2b24,
  gold: 0xc79a2c,
  peacock: 0x1e6f88,
  ink: 0x2a2f3a,
};

function buildShell(scene) {
  const { halfX, halfZ, height, thickness } = ROOM;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(halfX * 2, halfZ * 2),
    new THREE.MeshStandardMaterial({ map: tex.makeFloorTexture(halfX, halfZ), roughness: 0.8, metalness: 0.06 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.92 });
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

  // 黑漆踢脚
  const skirtMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1620, roughness: 0.55 });
  const skirtHeight = 0.26;
  const skirts = [
    { size: [halfX * 2, skirtHeight, 0.08], pos: [0, skirtHeight / 2, -halfZ + 0.04] },
    { size: [halfX * 2, skirtHeight, 0.08], pos: [0, skirtHeight / 2, halfZ - 0.04] },
    { size: [0.08, skirtHeight, halfZ * 2], pos: [-halfX + 0.04, skirtHeight / 2, 0] },
    { size: [0.08, skirtHeight, halfZ * 2], pos: [halfX - 0.04, skirtHeight / 2, 0] },
  ];
  for (const { size, pos } of skirts) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(...size), skirtMaterial);
    skirt.position.set(...pos);
    scene.add(skirt);
  }

  // 长廊地面嵌线：把长廊与两侧展厅分开
  const inlay = new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.6 });
  for (const x of [-CORRIDOR_HALF, CORRIDOR_HALF]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, Z_LINE * 2), inlay);
    line.position.set(x, 0.012, 0);
    scene.add(line);
  }

  buildCeilings(scene);
}

/** 每个展厅一块吊顶；长廊与编钟厅留出天窗 */
function buildCeilings(scene) {
  const slab = (rect, y, repeatScale = 2) => {
    const [x0, x1, z0, z1] = rect;
    const material = new THREE.MeshStandardMaterial({
      map: tex.makeCeilingTexture((x1 - x0) / repeatScale, (z1 - z0) / repeatScale),
      color: 0x9aa0ac,
      roughness: 1,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), material);
    box.position.set((x0 + x1) / 2, y + 0.15, (z0 + z1) / 2);
    scene.add(box);
    return box;
  };

  // 序厅、四个侧厅
  slab(zone('entrance').rect, zone('entrance').height);
  for (const id of ['bronze', 'ceramic', 'zenghouyi', 'chu']) {
    slab(zone(id).rect, zone(id).height);
  }

  // 长廊：中间留一条天窗光带
  const ch = zone('corridor').height;
  slab([-CORRIDOR_HALF, -1, -Z_LINE, Z_LINE], ch);
  slab([1, CORRIDOR_HALF, -Z_LINE, Z_LINE], ch);
  const stripGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(2, Z_LINE * 2),
    new THREE.MeshBasicMaterial({ map: tex.makeSkylightTexture(), side: THREE.DoubleSide }),
  );
  stripGlass.rotation.x = Math.PI / 2;
  stripGlass.position.set(0, ch + 0.7, 0);
  scene.add(stripGlass);
  for (const x of [-1, 1]) {
    const well = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.9, Z_LINE * 2),
      new THREE.MeshStandardMaterial({ color: 0xcfc7b8, roughness: 0.85 }),
    );
    well.position.set(x, ch + 0.35, 0);
    scene.add(well);
  }

  // 编钟厅：方形天窗
  const bh = zone('bells').height;
  const sky = { x0: -4.5, x1: 4.5, z0: -23.5, z1: -16.5 };
  slab([-15, 15, -27, sky.z0], bh);
  slab([-15, 15, sky.z1, -13], bh);
  slab([-15, sky.x0, sky.z0, sky.z1], bh);
  slab([sky.x1, 15, sky.z0, sky.z1], bh);
  const skyGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(sky.x1 - sky.x0, sky.z1 - sky.z0),
    new THREE.MeshBasicMaterial({ map: tex.makeSkylightTexture(), side: THREE.DoubleSide }),
  );
  skyGlass.rotation.x = Math.PI / 2;
  skyGlass.position.set((sky.x0 + sky.x1) / 2, bh + 1.1, (sky.z0 + sky.z1) / 2);
  scene.add(skyGlass);
  for (const [sx, sz, w, d] of [
    [sky.x0, (sky.z0 + sky.z1) / 2, 0.3, sky.z1 - sky.z0],
    [sky.x1, (sky.z0 + sky.z1) / 2, 0.3, sky.z1 - sky.z0],
    [(sky.x0 + sky.x1) / 2, sky.z0, sky.x1 - sky.x0, 0.3],
    [(sky.x0 + sky.x1) / 2, sky.z1, sky.x1 - sky.x0, 0.3],
  ]) {
    const well = new THREE.Mesh(
      new THREE.BoxGeometry(w, 1.3, d),
      new THREE.MeshStandardMaterial({ color: 0xcfc7b8, roughness: 0.85 }),
    );
    well.position.set(sx, bh + 0.55, sz);
    scene.add(well);
  }

  // 灯槽
  const stripMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6f2e6,
    emissive: 0xffeccc,
    emissiveIntensity: 1.25,
    roughness: 0.5,
  });
  const strips = [
    { size: [0.4, 0.1, Z_LINE * 1.7], pos: [-3.5, ch - 0.06, 0] },
    { size: [0.4, 0.1, Z_LINE * 1.7], pos: [3.5, ch - 0.06, 0] },
    { size: [0.4, 0.1, 10], pos: [12.5, 5.05, 4] },
    { size: [0.4, 0.1, 10], pos: [12.5, 5.05, -4] },
    { size: [0.4, 0.1, 10], pos: [-12.5, 5.05, 4] },
    { size: [0.4, 0.1, 10], pos: [-12.5, 5.05, -4] },
    { size: [14, 0.12, 0.4], pos: [0, 7.35, 17] },
    { size: [14, 0.12, 0.4], pos: [0, 7.35, 23] },
  ];
  for (const { size, pos } of strips) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(...size), stripMaterial);
    strip.position.set(...pos);
    scene.add(strip);
  }
}

/** 隔墙、门楣、匾额 */
function buildPartitions(scene, colliders) {
  const wallMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.9 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.6 });

  for (const [x0, z0, x1, z1] of WALL_SEGMENTS) {
    const width = Math.abs(x1 - x0) || WALL_T;
    const depth = Math.abs(z1 - z0) || WALL_T;
    const alongCorridor = Math.abs(x1 - x0) < 0.001;
    const height = alongCorridor ? zone('corridor').height : zone('bronze').height;

    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    wall.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    colliders.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfX: width / 2, halfZ: depth / 2 });

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.16, depth + 0.06), trimMaterial);
    cap.position.set((x0 + x1) / 2, height + 0.08, (z0 + z1) / 2);
    scene.add(cap);
  }

  // 长廊两端的大开口：门楣 + 匾额
  for (const [z, name, sub] of [
    [Z_LINE, '序厅', 'PREFACE HALL'],
    [-Z_LINE, '编钟厅', 'CHIME BELL HALL'],
  ]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_HALF * 2 + WALL_T * 2, 1.8, WALL_T), wallMaterial);
    beam.position.set(0, zone('corridor').height - 0.9, z);
    scene.add(beam);
    addSign(scene, name, sub, [0, zone('corridor').height - 1.0, z + (z > 0 ? 0.2 : -0.2)], z > 0 ? Math.PI : 0, 3.6);
  }

  // 四个侧厅门洞的门楣与匾额
  for (const door of DOOR_SIGNS) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, zone('corridor').height - DOOR_TOP, DOOR_HALF * 2),
      wallMaterial,
    );
    lintel.position.set(door.x, (zone('corridor').height + DOOR_TOP) / 2, door.z);
    scene.add(lintel);

    addSign(
      scene,
      door.name,
      door.sub,
      [door.x + (door.x > 0 ? 0.2 : -0.2), zone('corridor').height - 0.85, door.z],
      door.x > 0 ? Math.PI / 2 : -Math.PI / 2,
      2.9,
    );
  }
}

/** 匾额（黑漆描金） */
function addSign(scene, name, sub, position, rotationY, width) {
  const texture = tex.makeSignTexture(name, sub);
  const height = (width * texture.image.height) / texture.image.width;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    emissive: 0x241512,
    emissiveIntensity: 0.45,
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plaque.position.set(...position);
  plaque.rotation.y = rotationY;
  scene.add(plaque);
}

/** 长廊两侧的书画立轴 */
function buildScrolls(scene, interactables) {
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.6 });
  const width = 1.25;
  const height = 2.35;

  let index = 0;
  for (const side of [1, -1]) {
    for (const z of SCROLL_SLOTS) {
      const data = SCROLLS[index % SCROLLS.length];
      const group = new THREE.Group();
      group.position.set(side * (CORRIDOR_HALF - 0.16), 2.55, z);
      group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      const texture = tex.makeScrollTexture(data.kind, index);
      const picture = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, emissive: 0x14120e, emissiveIntensity: 0.4 }),
      );
      group.add(picture);

      for (const y of [height / 2 + 0.06, -height / 2 - 0.06]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, width + 0.24, 12), frameMaterial);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(0, y, 0);
        group.add(rod);
      }
      scene.add(group);

      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
      interactables.push({
        position: group.position.clone().addScaledVector(normal, 1.3).setY(1.5),
        radius: 2.5,
        title: data.title,
        tag: data.tag,
        desc: data.desc,
        model: group,
      });
      index += 1;
    }
  }
}

/** 展板 */
function buildPanel(scene, config, interactables) {
  const { halfX, halfZ } = ROOM;
  const group = new THREE.Group();
  const width = config.plan ? 3.9 : 2.6;
  const height = config.plan ? 2.55 : 1.8;
  const y = 2.7;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x2a1d18, roughness: 0.55, metalness: 0.3 }),
  );
  frame.position.z = -0.06;
  frame.castShadow = true;
  group.add(frame);

  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: tex.makePanelTexture({ ...config, layout: LAYOUT }),
      roughness: 0.85,
      emissive: 0x151310,
      emissiveIntensity: 0.4,
    }),
  );
  group.add(picture);

  let rotationY = 0;
  if (config.wall === 'north') {
    group.position.set(config.offset, y, -halfZ + 0.07);
  } else if (config.wall === 'south') {
    group.position.set(config.offset, y, halfZ - 0.07);
    rotationY = Math.PI;
  } else if (config.wall === 'west') {
    group.position.set(-halfX + 0.07, y, config.offset);
    rotationY = Math.PI / 2;
  } else {
    group.position.set(halfX - 0.07, y, config.offset);
    rotationY = -Math.PI / 2;
  }
  group.rotation.y = rotationY;
  scene.add(group);

  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  interactables.push({
    position: group.position.clone().addScaledVector(normal, 1.6).setY(1.5),
    radius: config.plan ? 3.4 : 2.6,
    title: config.plan ? '展厅平面图' : config.title,
    tag: config.plan ? '序厅 · 导览' : `展板 · ${config.subtitle ?? ''}`.trim(),
    desc: config.plan
      ? '一条中央长廊贯穿南北：南端是序厅，北端是通高的编钟厅；长廊两侧是曾侯乙墓、楚文化、青铜器与陶瓷四个展厅，展厅之间互不相通，都要经过长廊进出。'
      : config.body,
    model: picture,
  });
}

/* ------------------------------------------------------------------ */
/* 序厅：摇签台                                                        */
/* ------------------------------------------------------------------ */

/** 序厅里的小木台，上面放着一只签筒，靠近后按 E 打开抽签小游戏 */
function buildFortuneStand(scene, colliders, interactables) {
  const m = materials();
  const x = 5.4;
  // 背靠序厅北面的隔墙（z = 13），桌子正面朝南
  const z = 13.6;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4b32, roughness: 0.72 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.55 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe3d2a8, roughness: 0.62 });
  const cinnabar = new THREE.MeshStandardMaterial({ color: 0x9c2b24, roughness: 0.55 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.86), darkWood);
  top.position.y = 0.95;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.3, 0.72), wood);
  apron.position.y = 0.78;
  group.add(apron);

  for (const [legX, legZ] of [
    [-0.55, -0.32],
    [0.55, -0.32],
    [-0.55, 0.32],
    [0.55, 0.32],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.66, 10), darkWood);
    leg.position.set(legX, 0.34, legZ);
    leg.castShadow = true;
    group.add(leg);
  }

  // 签筒
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.17, 0.56, 26, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x7d4f2c, roughness: 0.58, side: THREE.DoubleSide }),
  );
  tube.position.y = 1.3;
  tube.castShadow = true;
  group.add(tube);

  const tubeBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 26), darkWood);
  tubeBottom.position.y = 1.03;
  group.add(tubeBottom);

  for (const y of [1.08, 1.52]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 8, 28), m.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }

  // 露在筒口外的木签
  for (let i = 0; i < 15; i += 1) {
    const angle = (i / 15) * Math.PI * 2;
    const radius = i % 2 ? 0.06 : 0.13;
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, 0.02), ivory);
    stick.position.set(Math.cos(angle) * radius, 1.58, Math.sin(angle) * radius);
    stick.rotation.set((Math.random() - 0.5) * 0.18, angle, (Math.random() - 0.5) * 0.18);
    group.add(stick);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.12, 0.022), cinnabar);
    tip.position.set(stick.position.x, 1.9, stick.position.z);
    tip.rotation.copy(stick.rotation);
    group.add(tip);
  }

  // 台前的小木牌
  const signTexture = tex.makeSignTexture('摇签问古', 'DIVINATION');
  const signHeight = 0.72 * (signTexture.image.height / signTexture.image.width);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, signHeight),
    new THREE.MeshStandardMaterial({
      map: signTexture,
      roughness: 0.6,
      emissive: 0x241512,
      emissiveIntensity: 0.4,
    }),
  );
  sign.position.set(0, 0.78, 0.365);
  group.add(sign);

  scene.add(group);
  colliders.push({ x, z, radius: 0.75 });
  interactables.push({
    position: new THREE.Vector3(x, 1.4, z),
    radius: 2.7,
    title: '灵签筒',
    tag: '序厅 · 摇签问古',
    desc: '案上立着一只漆木签筒，里面插着数十支灵签。摇一摇，抽一支，看看今日与哪件展品有缘。',
    kind: 'fortune',
  });
}

/* ------------------------------------------------------------------ */
/* 序厅：展品侦探线索板                                                */
/* ------------------------------------------------------------------ */

/** 序厅里的斜面线索板，靠近后按 E 打开猜谜小游戏 */
function buildDetectiveStand(scene, colliders, interactables) {
  const m = materials();
  const x = -5.4;
  const z = 13.6;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.7 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x33231a, roughness: 0.55 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x27403a, roughness: 0.78 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 20), darkWood);
  base.position.y = 0.06;
  base.castShadow = true;
  group.add(base);

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), wood);
  post.position.y = 0.62;
  post.castShadow = true;
  group.add(post);

  // 斜面展板
  const panel = new THREE.Group();
  panel.position.set(0, 1.3, 0.04);
  panel.rotation.x = -0.5;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.76, 0.05), darkWood);
  frame.position.z = -0.035;
  frame.castShadow = true;
  panel.add(frame);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.68, 0.05), boardMat);
  panel.add(slab);

  const lens = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 28), m.gold);
  lens.position.set(-0.24, 0.05, 0.04);
  panel.add(lens);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8), m.gold);
  handle.position.set(-0.13, -0.07, 0.04);
  handle.rotation.z = Math.PI / 4;
  panel.add(handle);

  const signTexture = tex.makeSignTexture('展品侦探', 'EXHIBIT DETECTIVE');
  const signHeight = 0.42 * (signTexture.image.height / signTexture.image.width);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, signHeight),
    new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.6, emissive: 0x241512, emissiveIntensity: 0.4 }),
  );
  sign.position.set(0.18, 0.03, 0.04);
  panel.add(sign);

  group.add(panel);
  scene.add(group);

  colliders.push({ x, z, radius: 0.65 });
  interactables.push({
    position: new THREE.Vector3(x, 1.4, z),
    radius: 2.6,
    title: '展品侦探',
    tag: '序厅 · 猜谜',
    desc: '一块线索板：翻开年代、材质、出土地等线索，推理并猜出对应的展品。',
    kind: 'quiz',
  });
}

/* ================================================================== */
/* 展台与展品                                                          */
/* ================================================================== */

/** 展台是同一套几何体，用 InstancedMesh 一次画完所有展台 */
function buildPedestalBases(scene, artifacts, colliders) {
  const radius = PEDESTAL_RADIUS;
  const height = PEDESTAL_HEIGHT;
  const count = artifacts.length;
  const matrix = new THREE.Matrix4();
  const identity = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const tilted = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

  const parts = [
    {
      geometry: new THREE.CylinderGeometry(radius, radius * 1.08, height, 28),
      material: new THREE.MeshStandardMaterial({ color: 0x3c3f4a, roughness: 0.62 }),
      y: height / 2,
      shadow: true,
    },
    {
      geometry: new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, 0.08, 28),
      material: new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.35, metalness: 0.3 }),
      y: height + 0.04,
      shadow: false,
    },
    {
      geometry: new THREE.TorusGeometry(radius * 1.09, 0.016, 8, 36),
      material: new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.9, roughness: 0.3 }),
      y: height + 0.085,
      shadow: false,
      quaternion: tilted,
    },
  ];

  for (const part of parts) {
    const instanced = new THREE.InstancedMesh(part.geometry, part.material, count);
    instanced.castShadow = part.shadow;
    instanced.receiveShadow = true;
    artifacts.forEach((artifact, index) => {
      matrix.compose(
        new THREE.Vector3(artifact.pos[0], part.y, artifact.pos[1]),
        part.quaternion ?? identity,
        unit,
      );
      instanced.setMatrixAt(index, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    scene.add(instanced);
  }

  for (const artifact of artifacts) {
    colliders.push({ x: artifact.pos[0], z: artifact.pos[1], radius: radius + 0.32 });
  }
}

/** 展品本体：悬浮在展台上方并缓慢自转 */
function buildArtifact(artifact) {
  const [x, z] = artifact.pos;
  const baseY = PEDESTAL_HEIGHT + 0.08 + FLOAT_HEIGHT;
  const { object } = createArtifactObject(artifact);
  const holder = new THREE.Group();
  holder.position.set(x, baseY, z);
  holder.add(object);

  return {
    object,
    holder,
    baseY,
    spin: 0.5,
    interactable: {
      position: new THREE.Vector3(x, 1.4, z),
      radius: 2.9,
      title: artifact.name,
      tag: artifact.tag,
      desc: artifact.desc,
      model: object,
      kind: 'artifact',
    },
  };
}

/* ================================================================== */
/* 灯光                                                                */
/* ================================================================== */

function buildLights(scene) {
  const { height, halfX, halfZ } = ROOM;

  scene.add(new THREE.AmbientLight(0x55607a, 0.34));
  scene.add(new THREE.HemisphereLight(0xc6d8f2, 0x39312a, 0.42));

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
  sun.position.set(9, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -halfX - 3;
  sun.shadow.camera.right = halfX + 3;
  sun.shadow.camera.top = halfZ + 3;
  sun.shadow.camera.bottom = -halfZ - 3;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0007;
  scene.add(sun);

  const points = [
    [0, 5.4, -6.5, 0xdff0ff, 26],
    [0, 5.4, 6.5, 0xdff0ff, 26],
    [9.5, 4.5, 6.5, 0xffeecf, 15],
    [9.5, 4.5, -6.5, 0xffeecf, 15],
    [-9.5, 4.5, 6.5, 0xffeecf, 15],
    [-9.5, 4.5, -6.5, 0xffeecf, 15],
    [0, 7.5, 20, 0xffeecf, 22],
    [0, 10.5, -20, 0xdff0ff, 40],
  ];
  for (const [x, y, z, color, intensity] of points) {
    const lamp = new THREE.PointLight(color, intensity, 26, 2);
    lamp.position.set(x, y, z);
    scene.add(lamp);
  }

  const spot = new THREE.SpotLight(0xfff3e0, 110, 20, 0.62, 0.5, 2);
  spot.position.set(0, height - 1.5, -20);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  scene.add(spot);
  spot.target.position.set(0, 1.4, -20);
  scene.add(spot.target);
}

/* ================================================================== */
/* 导览图数据                                                          */
/* ================================================================== */

const LAYOUT = {
  halfX: ROOM.halfX,
  halfZ: ROOM.halfZ,
  zones: ZONES,
  spawn: SPAWN,
  planWalls: WALL_SEGMENTS.map(([x0, z0, x1, z1]) => [x0, z0, x1, z1]),
  planDoors: [
    [CORRIDOR_HALF, 4.8, CORRIDOR_HALF, 8.2],
    [CORRIDOR_HALF, -8.2, CORRIDOR_HALF, -4.8],
    [-CORRIDOR_HALF, 4.8, -CORRIDOR_HALF, 8.2],
    [-CORRIDOR_HALF, -8.2, -CORRIDOR_HALF, -4.8],
    [-CORRIDOR_HALF, Z_LINE, CORRIDOR_HALF, Z_LINE],
    [-CORRIDOR_HALF, -Z_LINE, CORRIDOR_HALF, -Z_LINE],
  ],
  // 编钟曲尺形的两条臂（画在图上）
  bells: [-3.475, 1.02, 3.475, 1.74, -3.485, -1.72, -2.765, 1.38],
};

/* ================================================================== */
/* 对外接口                                                            */
/* ================================================================== */

export function createMuseum(scene) {
  const colliders = [];
  const interactables = [];
  const animated = [];

  buildShell(scene);
  buildPartitions(scene, colliders);
  buildScrolls(scene, interactables);
  buildFortuneStand(scene, colliders, interactables);
  buildDetectiveStand(scene, colliders, interactables);
  buildLights(scene);

  // 编钟厅：曾侯乙编钟
  const bells = buildChimeBells();
  bells.group.position.set(0, 0, SPAWN[1] - 42.5);
  scene.add(bells.group);
  for (const collider of bells.colliders) {
    colliders.push({ ...collider, x: collider.x + bells.group.position.x, z: collider.z + bells.group.position.z });
  }
  interactables.push({
    position: new THREE.Vector3(0, 1.6, -20),
    radius: 4.4,
    title: '曾侯乙编钟',
    tag: '编钟厅 · 镇馆之宝',
    desc: '三层八组、六十五件青铜钟悬挂在曲尺形的钟架上，总重两千五百余公斤。钟体与钟枚上共有三千七百余字铭文，记述了曾、楚、齐等国的乐律。一钟双音，音域跨五个半八度，出土后仍能演奏。',
    model: bells.group,
    kind: 'artifact',
  });

  buildPedestalBases(scene, ARTIFACTS, colliders);
  for (const artifact of ARTIFACTS) {
    const item = buildArtifact(artifact);
    scene.add(item.holder);
    animated.push(item);
  }
  for (const config of PANELS) buildPanel(scene, config, interactables);
  for (const item of animated) interactables.push(item.interactable);

  return {
    colliders,
    interactables,
    spawn: new THREE.Vector3(SPAWN[0], 0, SPAWN[1]),
    update(dt, elapsed) {
      for (const item of animated) {
        item.holder.rotation.y += item.spin * dt;
        item.holder.position.y = item.baseY + Math.sin(elapsed * 1.4 + item.baseY) * 0.05;
        item.holder.rotation.x = Math.sin(elapsed * 0.6) * 0.05;
      }
    },
  };
}

export { materials };
