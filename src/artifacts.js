import * as THREE from 'three';
import {
  makeBronzeTexture,
  makeLacquerTexture,
  makeMirrorTexture,
  makePorcelainTexture,
  makePotteryTexture,
  makeSlipTexture,
} from './textures.js';

/* ================================================================== */
/* 材质（全局共用的单例，减少 draw call 与显存占用）                     */
/* ================================================================== */

let cache = null;

export function materials() {
  if (cache) return cache;
  const bronzeMap = makeBronzeTexture();
  const lacquerMap = makeLacquerTexture();
  cache = {
    bronze: new THREE.MeshStandardMaterial({ map: bronzeMap, color: 0xd6e0cd, metalness: 0.85, roughness: 0.42 }),
    patina: new THREE.MeshStandardMaterial({ map: bronzeMap, color: 0x86a48f, metalness: 0.7, roughness: 0.66 }),
    darkBronze: new THREE.MeshStandardMaterial({ map: bronzeMap, color: 0x7d8a78, metalness: 0.8, roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8ae4e, metalness: 0.95, roughness: 0.24 }),
    lacquer: new THREE.MeshStandardMaterial({ map: lacquerMap, roughness: 0.45, metalness: 0.15 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 0.42, metalness: 0.14 }),
    red: new THREE.MeshStandardMaterial({ color: 0x9c2b24, roughness: 0.5, metalness: 0.1 }),
    jade: new THREE.MeshStandardMaterial({ color: 0xbcd8c6, metalness: 0.05, roughness: 0.2 }),
    porcelain: new THREE.MeshPhysicalMaterial({
      map: makePorcelainTexture(),
      roughness: 0.14,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
    celadon: new THREE.MeshStandardMaterial({ color: 0xa9c9b8, metalness: 0.08, roughness: 0.22 }),
    pottery: new THREE.MeshStandardMaterial({ map: makePotteryTexture(), roughness: 0.85 }),
    clay: new THREE.MeshStandardMaterial({ color: 0xb98a63, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({
      color: 0xd4dbe2,
      metalness: 1,
      roughness: 0.12,
      emissive: 0x1a2a33,
      emissiveIntensity: 0.35,
    }),
    mirrorBack: new THREE.MeshStandardMaterial({ map: makeMirrorTexture(), metalness: 0.72, roughness: 0.48 }),
    mirrorFace: new THREE.MeshStandardMaterial({ color: 0xd2d8d0, metalness: 1, roughness: 0.07 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4b32, roughness: 0.72 }),
    bamboo: new THREE.MeshStandardMaterial({ map: makeSlipTexture(), roughness: 0.68 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6 }),
  };
  return cache;
}

/**
 * 展品清单。pos 是展台在展厅平面上的坐标，需落在对应展厅的范围内：
 *   序厅        x ∈ [-15, 15]  z ∈ [13, 27]
 *   青铜器厅    x ∈ [4, 15]    z ∈ [0, 13]
 *   陶瓷厅      x ∈ [4, 15]    z ∈ [-13, 0]
 *   曾侯乙墓厅  x ∈ [-15, -4]  z ∈ [0, 13]
 *   楚文化厅    x ∈ [-15, -4]  z ∈ [-13, 0]
 *   编钟厅      x ∈ [-15, 15]  z ∈ [-27, -13]
 */
export const ARTIFACTS = [
  /* ---- 序厅 ---- */
  {
    shape: 'jiandu',
    name: '云梦睡虎地秦简',
    tag: '序厅 · 书写历史',
    desc: '1975 年云梦睡虎地十一号秦墓出土。一千一百多枚竹简上写着秦代的法律、巛书与日书，是第一次见到的大批秦代官方文书，也是隶书形成的实物见证。',
    pos: [-7.5, 20],
  },
  {
    shape: 'table',
    name: '楚式漆案与耳杯',
    tag: '序厅 · 漆器',
    desc: '矮足的漆案上摆着两只耳杯。楚人把漆器做得轻而艳：黑漆为地、朱漆为纹，一件漆耳杯只有几十克重，比铜器轻得多，也更适合拿在手里饮酒。',
    pos: [7.5, 20],
  },

  /* ---- 青铜器厅 ---- */
  {
    shape: 'lei',
    name: '兽面纹铜罍',
    tag: '青铜器厅 · 盛酒器',
    desc: '罍是大型盛酒器。小口、广肩、深腹、平底，肩上四个兽首衔着铜环，腹部满饰云雷纹与兽面纹。商周时「尊彝」之属各有定名，罍就是其中体量最大的一种，常与壶、缶成套出土。',
    pos: [12.6, 2.6],
  },
  {
    shape: 'ding',
    name: '铜鼎',
    tag: '青铜器厅 · 烹煮器',
    desc: '三足两耳，鼎腹下可以举火。鼎最早是煮肉的炊具，后来变成最重要的礼器：「列鼎而食」的数目直接对应身份，天子九鼎、诸侯七鼎，以至于「问鼎」就是窥伺天下。',
    pos: [12.6, 6.6],
  },
  {
    shape: 'gui',
    name: '铜簋',
    tag: '青铜器厅 · 盛食器',
    desc: '簋用来盛黍稷。器身鼓腹、下有圈足，两侧一对兽首耳，上面还有个带圈状提手的盖。青铜礼器讲究组合，鼎与簋往往成套出土，用鼎用簋的数量共同标明墓主人的地位。',
    pos: [12.6, 10.6],
  },
  {
    shape: 'mirror',
    name: '蟠螭纹铜镜',
    tag: '青铜器厅 · 照容器',
    desc: '正面磨得光可照人，背面铸出细密的蟠螭纹与几道同心弦纹，正中是一个可以穿绳的钮。铜镜是青铜器里少见的日用器，战国楚墓中出土极多，往往与梳、笁同放在痰盒里。',
    pos: [6.9, 2.6],
  },
  {
    shape: 'hu',
    name: '嵌错纹铜壶',
    tag: '青铜器厅 · 盛酒器',
    desc: '壶用以盛酒，也可盛水。这件壶的腹部用金、银丝嵌错出宴乐、射猎的图像：人物、车马、飞鸟环壶一周，把一场战国时代的宴会绕在了器物上。',
    pos: [6.9, 10.6],
  },

  /* ---- 陶瓷厅 ---- */
  {
    shape: 'meiping',
    name: '元青花四爱图梅瓶',
    tag: '陶瓷厅 · 元青花',
    desc: '小口、丰肩、瘦底，腹部四面开光分别绘王羲之爱兰、陶渊明爱菊、周茂叔爱莲、林和靖爱梅。元青花人物题材存世极少，这一件因为出自明代郢靖王墓而保存完整。',
    pos: [12.6, -2.6],
  },
  {
    shape: 'lotus',
    name: '青瓷莲花尊',
    tag: '陶瓷厅 · 青瓷',
    desc: '器身堆塑多层莲瓣，釉色青中泛绿，积釉处呈现出深色的玻璃感。佛教艺术自南北朝兴起后，莲花成了瓷器上最常见的花纹，这件尊就是那时的典型器形。',
    pos: [12.6, -10.6],
  },
  {
    shape: 'li',
    name: '陶鬲',
    tag: '陶瓷厅 · 炊器',
    desc: '三个肥大的袋形足让受火面积更大，煮水做饭都很快——这是青铜鼎的陶器原型。鬲从新石器时代一直用到商周，是先秦最普通的炊具。',
    pos: [6.9, -2.6],
  },
  {
    shape: 'bowl',
    name: '屈家岭彩陶碗',
    tag: '陶瓷厅 · 彩陶',
    desc: '碗内用黑彩画出一圈潪涡纹。屈家岭文化距今约五千年，其彩陶以薄胎、高圈足和旋转的纹样著名，是长江中游史前陶器的高峰。',
    pos: [6.9, -10.6],
  },

  /* ---- 曾侯乙墓展厅 ---- */
  {
    shape: 'zunpan',
    name: '曾侯乙尊盘',
    tag: '曾侯乙墓展厅 · 酒器',
    desc: '尊与盘合为一器：尊盛酒、盘承水。口沿与盘沿上层层透雕的蟠虺纹由无数细小的铜梗焊接而成，至今难以复制，是先秦青铜铸造技术登峰造极的证据。',
    pos: [-12.6, 2.6],
  },
  {
    shape: 'jianfou',
    name: '青铜鉴缶',
    tag: '曾侯乙墓展厅 · 冰酒器',
    desc: '方鉴之内套一缶，鉴与缶之间留出的空腔可以装冰或热水，缶中盛酒，可冰可温——它被称为「世界上最早的冰箱」。鉴身满饰蟠螭纹，四角各有一条攀附的龙。',
    pos: [-12.6, 6.6],
  },
  {
    shape: 'drumStand',
    name: '铜建鼓座',
    tag: '曾侯乙墓展厅 · 乐器',
    desc: '插放建鼓的铜座，由十六条缠绕的蟠龙构成。龙首昂起、龙尾相接，鼓插于中央的圆孔之中，敲击时整座龙群仿佛都在震动。',
    pos: [-12.6, 10.6],
  },
  {
    shape: 'deer',
    name: '彩绘漆木卧鹿',
    tag: '曾侯乙墓展厅 · 漆木器',
    desc: '一只伏卧的木鹿，鹿角用真鹿角接装，通体髾黑漆，再以朱漆绘出卷云纹。它原本是悬鼓的鼓架，也是楚人眼中沟通天地的灵兽。',
    pos: [-6.9, 10.6],
  },

  /* ---- 楚文化展厅 ---- */
  {
    shape: 'sword',
    name: '越王勾践剑',
    tag: '楚文化展厅 · 兵器',
    desc: '1965 年江陵望山一号楚墓出土。剑身满饰菱形暗格纹，近格处铸鸟篆铭文「越王鸠浅自作用剑」。出土时寒光凛冽、几乎不见锈蚀，被誉为「天下第一剑」。',
    pos: [-12.6, -2.6],
  },
  {
    shape: 'drum',
    name: '虎座鸟架鼓',
    tag: '楚文化展厅 · 乐器',
    desc: '楚国特有的悬鼓：两只昂首的凤鸟踏在卧虎背上，鼓身悬于鸟冠之间。漆器以黑为底、以红为饰，凤与虎的角力正是楚人想象中的天地秩序。',
    pos: [-12.6, -6.6],
  },
  {
    shape: 'ge',
    name: '铜戈与铜钺',
    tag: '楚文化展厅 · 兵器',
    desc: '戈是先秦最通用的长兵器，横缚在柲上，可以勾、可以喙；钺则宽大厚重，由武器演化为刑具与权力的象征，常与王权联系在一起。',
    pos: [-12.6, -10.6],
  },
  {
    shape: 'beast',
    name: '彩绘漆木镇墓兽',
    tag: '楚文化展厅 · 木雕',
    desc: '方形的身躯上顶着一颗兽头，头插鹿角、口吐长舌。镇墓兽只出于楚墓，放在墓道两侧，作用是驱邪镇墓——它的含义至今仍无定论。',
    pos: [-6.9, -2.6],
  },

  /* ---- 编钟厅 ---- */
  {
    shape: 'yongzhong',
    name: '青铜甬钟',
    tag: '编钟厅 · 乐器',
    desc: '编钟中的单件。舞部之上有长柄叫「甬」，甬上有环叫「旋」，悬挂时用绳索系于旋上。钟体是合瓦形而非圆形，敲击正鼓与侧鼓会发出两个不同的音。',
    pos: [11, -20],
  },
  {
    shape: 'chunyu',
    name: '铜錞于',
    tag: '编钟厅 · 乐器',
    desc: '圆筒形的打击乐器，顶上有钮可以悬挂，敲击时声音低沉悠远。錞于常与鼓、钲同出，是军阵中节制动的最早一批「指挥乐器」。',
    pos: [-11, -20],
  },
];

/** 每个部件都投影 */
function mesh(geometry, material, position, rotation) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

const lathe = (points, segments = 44) =>
  new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/** 合瓦形钟体：纵剖面绕轴旋转后再把 z 压扁 */
export function makeBellGeometry(height) {
  const profile = [
    [0.03, 0], [0.34, 0], [0.35, 0.05], [0.29, 0.11], [0.27, 0.3],
    [0.25, 0.55], [0.22, 0.75], [0.2, 0.88], [0.185, 0.94], [0.12, 0.99], [0.03, 1],
  ];
  const geometry = lathe(profile, 22);
  geometry.scale(1, height, 0.62);
  geometry.computeVertexNormals();
  return geometry;
}

/* ================================================================== */
/* 展品造型：全部用基本几何体拼出可辨认的轮廓                            */
/* ================================================================== */

/** 曾侯乙尊盘：铜盘之上立一件喇叭口的尊 */
function shapeZunPan() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.14, 42), m.bronze, [0, 0.32, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.5, 0.03, 10, 46), m.patina, [0, 0.4, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.28, 12), m.patina, [Math.cos(a) * 0.28, 0.14, Math.sin(a) * 0.28]));
  }
  const zun = mesh(
    lathe([[0.14, 0], [0.24, 0.02], [0.27, 0.1], [0.24, 0.22], [0.18, 0.32], [0.2, 0.42], [0.26, 0.54], [0.34, 0.68], [0.42, 0.82], [0.45, 0.88]]),
    m.bronze,
    [0, 0.4, 0],
  );
  zun.material.side = THREE.DoubleSide;
  group.add(zun);
  return group;
}

/** 青铜鉴缶：方鉴里套一只缶 */
function shapeJianFou() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(0.62, 0.42, 0.62), m.bronze, [0, 0.27, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.7, 0.05, 0.7), m.patina, [0, 0.5, 0]));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20), m.patina, [Math.cos(a) * 0.32, 0.32, Math.sin(a) * 0.32], [0, -a, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), m.patina, [Math.cos(a) * 0.24, 0.035, Math.sin(a) * 0.24]));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.34, 30), m.patina, [0, 0.62, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 30), m.bronze, [0, 0.8, 0]));
  return group;
}

/** 彩绘漆木卧鹿 */
function shapeDeer() {
  const m = materials();
  const group = new THREE.Group();
  const body = m.black;
  group.add(mesh(new THREE.CapsuleGeometry(0.15, 0.3, 6, 16), body, [0, 0.2, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 14), body, [0.24, 0.36, 0], [0, 0, -0.6]));
  group.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 14), m.red, [0.35, 0.5, 0], [0, 0, -1.1]));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      group.add(
        mesh(
          new THREE.CylinderGeometry(0.012, 0.016, 0.34, 6),
          m.wood,
          [0.3 + i * 0.03, 0.68, side * 0.05],
          [side * (0.3 + i * 0.2), 0, 0.5 - i * 0.35],
        ),
      );
    }
  }
  group.add(mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), m.red, [-0.06, 0.2, 0], [0, Math.PI / 2, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.66, 0.06, 0.34), body, [0, 0.03, 0]));
  return group;
}

/** 铜建鼓座：蟠龙盘绕的底座 */
function shapeDrumStand() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.16, 34), m.bronze, [0, 0.08, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 26), m.bronze, [0, 0.3, 0]));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    group.add(
      mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 10), m.patina, [Math.cos(a) * 0.26, 0.3, Math.sin(a) * 0.26], [-Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5]),
    );
    group.add(
      mesh(new THREE.ConeGeometry(0.06, 0.14, 10), m.bronze, [Math.cos(a) * 0.42, 0.52, Math.sin(a) * 0.42], [-Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9]),
    );
  }
  return group;
}

/** 虎座鸟架鼓 */
function shapeDrum() {
  const m = materials();
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.44, 0.12, 0.2), m.black, [side * 0.34, 0.06, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.14), m.red, [side * 0.56, 0.12, 0]));
    for (const leg of [-0.14, 0.14]) {
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.16), m.black, [side * 0.34 + leg, 0.03, 0]));
    }
    group.add(mesh(new THREE.ConeGeometry(0.13, 0.46, 20), m.red, [side * 0.34, 0.36, 0]));
    group.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 14), m.black, [side * 0.34, 0.72, 0], [0, 0, side * 0.25]));
    group.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 14), m.gold, [side * 0.4, 0.9, 0], [0, 0, side * 1.4]));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 30), m.red, [0, 0.62, 0], [0, 0, Math.PI / 2]));
  for (const end of [-0.17, 0.17]) {
    group.add(mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 30), m.gold, [end, 0.62, 0], [0, Math.PI / 2, 0]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.86, 0.05, 0.05), m.black, [0, 0.98, 0]));
  return group;
}

/** 越王勾践剑 */
function shapeSword() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(0.075, 0.72, 0.02), m.steel, [0, 0.44, 0]));
  group.add(mesh(new THREE.ConeGeometry(0.045, 0.16, 4), m.steel, [0, 0.88, 0], [0, Math.PI / 4, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), m.gold, [0, 0.08, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.06), m.celadon, [0, 0.08, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 16), m.black, [0, -0.02, 0]));
  for (const y of [-0.06, 0.02]) {
    group.add(mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 18), m.gold, [0, y, 0], [Math.PI / 2, 0, 0]));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.022, 26), m.gold, [0, -0.12, 0]));
  return group;
}

/** 彩绘漆木镇墓兽 */
function shapeBeast() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(0.34, 0.5, 0.28), m.black, [0, 0.25, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.36, 0.06, 0.3), m.red, [0, 0.52, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.26, 0.2, 0.22), m.black, [0, 0.62, 0.02]));
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), m.red, [0, 0.6, 0.14]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), m.gold, [side * 0.08, 0.68, 0.1]));
    for (let i = 0; i < 3; i += 1) {
      group.add(
        mesh(new THREE.CylinderGeometry(0.011, 0.015, 0.3, 6), m.wood, [side * 0.1, 0.86 + i * 0.02, 0], [side * 0.25, 0, side * (0.4 - i * 0.4)]),
      );
    }
  }
  group.add(mesh(new THREE.BoxGeometry(0.36, 0.06, 0.3), m.red, [0, 0.03, 0]));
  return group;
}

/** 铜罍：小口、广肩、深腹 */
function shapeLei() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(
    lathe([[0.001, 0], [0.2, 0], [0.21, 0.04], [0.24, 0.2], [0.32, 0.42], [0.35, 0.56], [0.31, 0.72], [0.24, 0.84], [0.18, 0.92], [0.2, 0.98]]),
    m.bronze,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 30), m.patina, [0, 0.98, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 30), m.patina, [0, 1.03, 0]));
  // 四耳衔环
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 22), m.darkBronze, [Math.cos(a) * 0.32, 0.66, Math.sin(a) * 0.32], [0, -a, 0]));
  }
  return group;
}

/** 铜鼎：三足双耳 */
function shapeDing() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(
    lathe([[0.001, 0], [0.18, 0], [0.3, 0.16], [0.34, 0.32], [0.33, 0.42], [0.3, 0.46]]),
    m.bronze,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.3, 0.028, 8, 34), m.darkBronze, [0, 0.46, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    group.add(
      mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.34, 12), m.bronze, [Math.cos(a) * 0.22, -0.17, Math.sin(a) * 0.22], [Math.cos(a) * 0.16, 0, -Math.sin(a) * 0.16]),
    );
  }
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 24), m.bronze, [side * 0.22, 0.56, 0], [0, Math.PI / 2, 0], [0, 0, 0]));
  }
  return group;
}

/** 铜簋：圈足、双耳、带盖 */
function shapeGui() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(lathe([[0.001, 0], [0.2, 0], [0.22, 0.05], [0.3, 0.3], [0.31, 0.4]]), m.bronze);
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.31, 0.025, 8, 34), m.darkBronze, [0, 0.4, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(lathe([[0.001, 0], [0.29, 0], [0.24, 0.16], [0.12, 0.24]]), m.darkBronze, [0, 0.4, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 20), m.bronze, [0, 0.68, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 30), m.patina, [0, -0.04, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 24), m.patina, [side * 0.3, 0.22, 0], [0, Math.PI / 2, 0]));
  }
  return group;
}

/** 嵌错纹铜壶 */
function shapeHu() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(
    lathe([[0.001, 0], [0.16, 0], [0.18, 0.04], [0.26, 0.28], [0.28, 0.46], [0.24, 0.66], [0.15, 0.82], [0.13, 0.9]]),
    m.bronze,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 26), m.gold, [0, 0.9, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(lathe([[0.001, 0], [0.14, 0], [0.09, 0.09]]), m.darkBronze, [0, 0.9, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.035, 14, 10), m.gold, [0, 1.02, 0]));
  for (let i = 0; i < 2; i += 1) {
    const a = i * Math.PI;
    group.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), m.gold, [Math.cos(a) * 0.24, 0.62, Math.sin(a) * 0.24], [0, -a, 0]));
  }
  group.add(mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 40), m.gold, [0, 0.5, 0], [Math.PI / 2, 0, 0]));
  return group;
}

/** 蟠螭纹铜镜（立起来展示背面） */
function shapeMirror() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.26), m.wood, [0, 0.03, 0]));
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.03, 48),
    [m.darkBronze, m.mirrorFace, m.mirrorBack],
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0.46, 0);
  disc.castShadow = true;
  group.add(disc);
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 18), m.bronze, [0, 0.46, 0.04], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 22), m.gold, [0, 0.46, 0.07]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 10), m.wood, [side * 0.2, 0.24, -0.08], [0.25, 0, 0]));
  }
  return group;
}

/** 青铜甬钟（配木架） */
function shapeYongZhong() {
  const m = materials();
  const group = new THREE.Group();
  const h = 0.86;
  const bell = mesh(makeBellGeometry(h), m.bronze, [0, 0.42, 0]);
  bell.material.side = THREE.DoubleSide;
  group.add(bell);
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, h * 0.32, 10), m.bronze, [0, h + 0.42 + (h * 0.32) / 2 - h * 0.06, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 20), m.gold, [0, h * 1.12, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.6, 0.1, 0.36), m.wood, [0, 0.05, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 12), m.wood, [side * 0.26, 0.75, 0]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.72, 0.09, 0.12), m.wood, [0, 1.5, 0]));
  return group;
}

/** 铜錞于：打击乐器 */
function shapeChunYu() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(
    lathe([[0.001, 0], [0.2, 0], [0.22, 0.06], [0.24, 0.3], [0.22, 0.58], [0.17, 0.76], [0.14, 0.86], [0.17, 0.9]]),
    m.bronze,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 30), m.patina, [0, 0.9, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.24, 0.016, 8, 32), m.gold, [0, 0.34, 0], [Math.PI / 2, 0, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), m.darkBronze, [side * 0.24, 0.62, 0], [0, Math.PI / 2, 0]));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 30), m.patina, [0, 0.02, 0]));
  return group;
}

/** 铜戈与铜钺 */
function shapeGe() {
  const m = materials();
  const group = new THREE.Group();
  // 戈
  group.add(mesh(new THREE.BoxGeometry(0.62, 0.11, 0.015), m.bronze, [-0.1, 0.62, 0]));
  group.add(mesh(new THREE.ConeGeometry(0.09, 0.24, 3), m.bronze, [0.32, 0.62, 0], [0, 0, -Math.PI / 2]));
  group.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.015), m.bronze, [-0.44, 0.62, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.94, 12), m.wood, [-0.1, 0.45, 0.03], [0, 0, Math.PI / 2]));
  // 钺
  group.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 4), m.patina, [0, 0.3, 0], [0, 0, Math.PI / 4]));
  group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 12), m.wood, [0, 0.3, 0.03], [0, 0, Math.PI / 2]));
  group.add(mesh(new THREE.BoxGeometry(0.9, 0.07, 0.3), m.black, [0, 0.035, 0]));
  return group;
}

/** 金锭（三枚一摞） */
function shapeIngot() {
  const m = materials();
  const group = new THREE.Group();
  const ingot = (x, y, z, rotation) => {
    const bar = mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.36, 4), m.gold, [x, y, z], [0, rotation, Math.PI / 2]);
    bar.scale.set(1, 1, 0.62);
    group.add(bar);
  };
  ingot(-0.2, 0.11, -0.14, 0);
  ingot(0.2, 0.11, 0.1, 0.3);
  ingot(0, 0.3, -0.02, 0.15);
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.01, 0.14), m.darkBronze, [0, 0.42, -0.02]));
  return group;
}

/** 金镶白玉腰带 */
function shapeJadeBelt() {
  const m = materials();
  const group = new THREE.Group();
  const belt = mesh(new THREE.TorusGeometry(0.3, 0.045, 12, 40), m.gold, [0, 0.36, 0], [Math.PI / 2, 0, 0]);
  belt.scale.set(1, 1, 0.7);
  group.add(belt);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    group.add(mesh(new THREE.BoxGeometry(0.13, 0.03, 0.1), m.jade, [Math.cos(a) * 0.3, 0.36, Math.sin(a) * 0.21], [0, -a, 0]));
  }
  group.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 10, 24), m.jade, [0.32, 0.36, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 24), m.black, [0, 0.15, 0]));
  return group;
}

/** 玉璧与玉琮 */
function shapeJadeSet() {
  const m = materials();
  const group = new THREE.Group();
  // 玉璧
  const bi = mesh(lathe([[0.12, 0], [0.3, 0], [0.3, 0.03], [0.12, 0.03], [0.12, 0]]), m.jade);
  bi.material.side = THREE.DoubleSide;
  bi.position.set(-0.18, 0.62, 0);
  group.add(bi);
  // 玉琮：四块方板围成方筒
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    group.add(mesh(new THREE.BoxGeometry(0.3, 0.42, 0.07), m.jade, [Math.cos(a) * 0.14, 0.21, Math.sin(a) * 0.14], [0, -a, 0]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), m.jade, [0, 0.4, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), m.jade, [0, 0.03, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.6, 0.06, 0.34), m.black, [0, 0.03, 0]));
  return group;
}

/** 元青花四爱图梅瓶 */
function shapeMeiPing() {
  const m = materials();
  const group = new THREE.Group();
  const vase = mesh(
    lathe([[0.01, 0], [0.13, 0], [0.15, 0.03], [0.22, 0.14], [0.3, 0.32], [0.28, 0.46], [0.21, 0.6], [0.13, 0.7], [0.105, 0.78], [0.12, 0.84], [0.1, 0.86]], 48),
    m.porcelain,
  );
  vase.material.side = THREE.DoubleSide;
  group.add(vase);
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.03, 32), m.celadon, [0, 0.015, 0]));
  return group;
}

/** 青瓷莲花尊 */
function shapeLotusZun() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(
    lathe([[0.01, 0], [0.15, 0], [0.18, 0.05], [0.2, 0.16], [0.26, 0.3], [0.24, 0.44], [0.18, 0.56], [0.14, 0.66], [0.17, 0.74], [0.16, 0.78]]),
    m.celadon,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);
  for (const [y, radius, count, size] of [[0.2, 0.24, 12, 0.13], [0.36, 0.27, 12, 0.14], [0.52, 0.22, 10, 0.12]]) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const petal = mesh(
        new THREE.ConeGeometry(size * 0.5, size * 2, 8, 1, true),
        m.celadon,
        [Math.cos(a) * radius, y, Math.sin(a) * radius],
        [-Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5],
      );
      petal.material.side = THREE.DoubleSide;
      group.add(petal);
    }
  }
  group.add(mesh(new THREE.ConeGeometry(0.16, 0.12, 24), m.celadon, [0, 0.82, 0]));
  return group;
}

/** 陶鬲：三袋足 */
function shapeLi() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(lathe([[0.001, 0], [0.18, 0.02], [0.28, 0.24], [0.3, 0.4], [0.26, 0.5]]), m.pottery);
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 30), m.clay, [0, 0.5, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    group.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), m.pottery, [Math.cos(a) * 0.16, 0.12, Math.sin(a) * 0.16]));
  }
  return group;
}

/** 屈家岭彩陶碗 */
function shapeBowl() {
  const m = materials();
  const group = new THREE.Group();
  const bowl = mesh(lathe([[0.001, 0], [0.1, 0], [0.12, 0.04], [0.34, 0.26], [0.35, 0.3]]), m.pottery);
  bowl.material.side = THREE.DoubleSide;
  group.add(bowl);
  group.add(mesh(new THREE.TorusGeometry(0.34, 0.014, 6, 36), m.clay, [0, 0.3, 0], [Math.PI / 2, 0, 0]));
  return group;
}

/** 彩绘陶俑 */
function shapeFigure() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.52, 20), m.clay, [0, 0.26, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.09, 18, 14), m.clay, [0, 0.62, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), m.clay, [0, 0.42, 0.02]));
  group.add(mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 24), m.red, [0, 0.5, 0], [Math.PI / 2, 0, 0]));
  return group;
}

/** 云梦睡虎地秦简：一卷竹简 */
function shapeJianDu() {
  const m = materials();
  const group = new THREE.Group();
  for (let i = 0; i < 14; i += 1) {
    const x = (i - 6.5) * 0.055;
    group.add(mesh(new THREE.BoxGeometry(0.045, 0.72, 0.012), m.bamboo, [x, 0.36, Math.sin(i * 0.5) * 0.006]));
  }
  for (const y of [0.12, 0.6]) {
    group.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.82, 8), m.wood, [0, y, 0], [0, 0, Math.PI / 2]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.86, 0.03, 0.3), m.black, [0, 0.03, 0.02], [0.22, 0, 0]));
  return group;
}

/** 楚式漆案与耳杯 */
function shapeTable() {
  const m = materials();
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(0.9, 0.05, 0.5), m.lacquer, [0, 0.34, 0]));
  for (const x of [-0.38, 0.38]) {
    for (const z of [-0.18, 0.18]) {
      group.add(mesh(new THREE.BoxGeometry(0.05, 0.32, 0.05), m.black, [x, 0.17, z]));
    }
  }
  for (const [x, z] of [[-0.2, 0], [0.2, 0.06]]) {
    const cup = mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.06, 20, 1, true), m.red, [x, 0.4, z]);
    cup.scale.set(1.5, 1, 1);
    cup.material.side = THREE.DoubleSide;
    group.add(cup);
    group.add(mesh(new THREE.BoxGeometry(0.24, 0.015, 0.09), m.red, [x + 0.16, 0.4, z]));
  }
  return group;
}

/* ================================================================== */
/* 造型注册表                                                          */
/* ================================================================== */

const SHAPE_BUILDERS = {
  zunpan: shapeZunPan,
  jianfou: shapeJianFou,
  deer: shapeDeer,
  drumStand: shapeDrumStand,
  drum: shapeDrum,
  sword: shapeSword,
  beast: shapeBeast,
  lei: shapeLei,
  ding: shapeDing,
  gui: shapeGui,
  hu: shapeHu,
  mirror: shapeMirror,
  yongzhong: shapeYongZhong,
  chunyu: shapeChunYu,
  ge: shapeGe,
  ingot: shapeIngot,
  jadeBelt: shapeJadeBelt,
  jadeSet: shapeJadeSet,
  meiping: shapeMeiPing,
  lotus: shapeLotusZun,
  li: shapeLi,
  bowl: shapeBowl,
  figure: shapeFigure,
  jiandu: shapeJianDu,
  table: shapeTable,
};

/** 生成展品对象，并把包围盒调成「水平居中、底面贴 y = 0」 */
export function createArtifactObject(artifact) {
  const builder = SHAPE_BUILDERS[artifact.shape];
  const object = builder ? builder(artifact) : new THREE.Group();

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;

  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return { object, height: box.max.y - box.min.y };
}

/* ================================================================== */
/* 曾侯乙编钟                                                          */
/* ================================================================== */

/**
 * 曲尺形钟架（拐角在原点，长臂 +x、短臂 -z）：
 * 三层横梁由五根漆木立柱支起，钟体用 InstancedMesh 绘制。
 * 返回 { group, colliders }，group 已把曲尺形整体挪到自身中心。
 */
export function buildChimeBells() {
  const m = materials();
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);

  const LONG = 6.6;
  const SHORT = 3.1;
  const BEAM = 0.2;
  const BEAM_DEPTH = 0.22;
  const POST_TOP = 3.35;

  const tiers = [
    { y: 1.7, height: 0.92, spacing: 0.8, yong: 0.3 },
    { y: 2.45, height: 0.6, spacing: 0.45, yong: 0.3 },
    { y: 3.05, height: 0.38, spacing: 0.34, yong: 0 },
  ];
  const arms = [
    { axis: 'x', length: LONG, center: [LONG / 2, 0] },
    { axis: 'z', length: SHORT, center: [0, -SHORT / 2] },
  ];

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);

  for (const tier of tiers) {
    const geometry = makeBellGeometry(tier.height);
    const stemLength = tier.height * tier.yong;

    for (const arm of arms) {
      const holder = new THREE.Group();
      holder.position.set(arm.center[0], tier.y, arm.center[1]);
      inner.add(holder);

      holder.add(
        mesh(
          new THREE.BoxGeometry(
            arm.axis === 'x' ? arm.length : BEAM_DEPTH,
            BEAM,
            arm.axis === 'x' ? BEAM_DEPTH : arm.length,
          ),
          m.lacquer,
        ),
      );

      const count = Math.max(1, Math.floor((arm.length - 0.5) / tier.spacing));
      const start = -(count - 1) / 2;
      const bells = new THREE.InstancedMesh(geometry, m.bronze, count);
      bells.castShadow = true;
      if (arm.axis === 'z') quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

      for (let i = 0; i < count; i += 1) {
        const offset = (start + i) * tier.spacing;
        const bottom = -BEAM / 2 - tier.height - stemLength;
        const position =
          arm.axis === 'x' ? new THREE.Vector3(offset, bottom, 0) : new THREE.Vector3(0, bottom, offset);
        matrix.compose(position, quaternion, unit);
        bells.setMatrixAt(i, matrix);

        if (stemLength > 0) {
          holder.add(
            mesh(
              new THREE.CylinderGeometry(0.045, 0.055, stemLength, 8),
              m.bronze,
              [
                arm.axis === 'x' ? offset : 0,
                -BEAM / 2 - stemLength / 2,
                arm.axis === 'x' ? 0 : offset,
              ],
            ),
          );
        }
      }
      bells.instanceMatrix.needsUpdate = true;
      holder.add(bells);
    }
  }

  const posts = [[0, 0], [LONG / 2, 0], [LONG - 0.45, 0], [0, -SHORT / 2], [0, -(SHORT - 0.45)]];
  for (const [x, z] of posts) {
    inner.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, POST_TOP, 12), m.lacquer, [x, POST_TOP / 2, z]));
    for (const y of [POST_TOP * 0.32, POST_TOP * 0.76]) {
      inner.add(mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 12), m.gold, [x, y, z]));
    }
    inner.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 14), m.bronze, [x, 0.08, z]));
    inner.add(mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 12), m.bronze, [x, POST_TOP + 0.02, z]));
  }

  const box = new THREE.Box3().setFromObject(inner);
  const offsetX = -(box.min.x + box.max.x) / 2;
  const offsetZ = -(box.min.z + box.max.z) / 2;
  inner.position.set(offsetX, 0, offsetZ);

  const armBox = (minX, maxX, minZ, maxZ) => ({
    x: (minX + maxX) / 2 + offsetX,
    z: (minZ + maxZ) / 2 + offsetZ,
    halfX: (maxX - minX) / 2,
    halfZ: (maxZ - minZ) / 2,
  });

  return {
    group,
    colliders: [armBox(-0.35, LONG, -0.36, 0.36), armBox(-0.36, 0.36, -SHORT, 0)],
    footprint: [
      [-3.475, -0.36, 3.475, 0.36],
      [-0.36, -SHORT + 1.38, 0.36, 1.74],
    ],
  };
}
