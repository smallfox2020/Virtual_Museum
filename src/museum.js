import * as THREE from 'three';
import { ARTIFACTS, createArtifactObject, buildChimeBells, materials, applyExternalModel } from './artifacts.js';
import { createStructures } from './structures.js';
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
  halfX: 24,
  halfZ: 40,
  height: 14,
  thickness: 0.6,
};

const WALL_T = 0.35;
const DOOR_HALF = 2.6;
const DOOR_TOP = 4.2;

const CORRIDOR_HALF = 6;
const Z_LINE = 18;

const PEDESTAL_HEIGHT = 1.05;
const PEDESTAL_RADIUS = 0.62;
const FLOAT_HEIGHT = 0.45;

/** 各展厅平面：[x0, x1, z0, z1] */
const ZONES = [
  { id: 'entrance', name: '序厅', sub: '导览 · 前言', rect: [-24, 24, 18, 40], height: 8.5, fill: '#efe9da' },
  { id: 'corridor', name: '长廊', sub: '书画立轴', rect: [-6, 6, -18, 18], height: 7, fill: '#e6dfd0' },
  { id: 'bronze', name: '青铜器厅', sub: '罍 · 鼎 · 簋 · 镜 · 壶', rect: [6, 24, 0, 18], height: 6, fill: '#dcd6c6' },
  { id: 'ceramic', name: '陶瓷厅', sub: '青花 · 青瓷 · 彩陶', rect: [6, 24, -18, 0], height: 6, fill: '#dcd6c6' },
  { id: 'zenghouyi', name: '曾侯乙墓展厅', sub: '尊盘 · 鉴缶 · 建鼓座', rect: [-24, -6, 0, 18], height: 6, fill: '#dcd6c6' },
  { id: 'chu', name: '楚文化展厅', sub: '剑 · 鼓 · 镇墓兽', rect: [-24, -6, -18, 0], height: 6, fill: '#dcd6c6' },
  { id: 'bells', name: '编钟厅', sub: '曾侯乙编钟', rect: [-24, 24, -40, -18], height: 14, fill: '#e9e2d3' },
];

const zone = (id) => ZONES.find((item) => item.id === id);

/** 观众出生点（序厅中轴） */
const SPAWN = [0, 33];

/** 隔墙中心线，供几何与导览图共用（门洞开在长廊两侧 z = ±9.5） */
const WALL_SEGMENTS = [
  // 长廊西墙
  [-CORRIDOR_HALF, -Z_LINE, -CORRIDOR_HALF, -12.1],
  [-CORRIDOR_HALF, -6.9, -CORRIDOR_HALF, 6.9],
  [-CORRIDOR_HALF, 12.1, -CORRIDOR_HALF, Z_LINE],
  // 长廊东墙
  [CORRIDOR_HALF, -Z_LINE, CORRIDOR_HALF, -12.1],
  [CORRIDOR_HALF, -6.9, CORRIDOR_HALF, 6.9],
  [CORRIDOR_HALF, 12.1, CORRIDOR_HALF, Z_LINE],
  // 侧厅与序厅之间
  [-24, Z_LINE, -CORRIDOR_HALF, Z_LINE],
  [CORRIDOR_HALF, Z_LINE, 24, Z_LINE],
  // 侧厅与编钟厅之间
  [-24, -Z_LINE, -CORRIDOR_HALF, -Z_LINE],
  [CORRIDOR_HALF, -Z_LINE, 24, -Z_LINE],
  // 同侧两个展厅之间
  [-24, 0, -CORRIDOR_HALF, 0],
  [CORRIDOR_HALF, 0, 24, 0],
];

/** 门洞（画在导览图上） */
const DOOR_SIGNS = [
  { x: CORRIDOR_HALF, z: 9.5, name: '青铜器厅', sub: 'BRONZE HALL' },
  { x: CORRIDOR_HALF, z: -9.5, name: '陶瓷厅', sub: 'CERAMICS' },
  { x: -CORRIDOR_HALF, z: 9.5, name: '曾侯乙墓展厅', sub: 'ZENGHOUYI TOMB' },
  { x: -CORRIDOR_HALF, z: -9.5, name: '楚文化展厅', sub: 'CHU CULTURE' },
];

/* ------------------------------------------------------------------ */
/* 书画立轴（长廊两侧墙）                                               */
/* ------------------------------------------------------------------ */

/**
 * 长廊两侧共 16 幅，每幅的标题、说明、纹理种子都不同。
 * 原来只有 4 条数据循环用：纹理靠 index 当种子其实不重复，
 * 但标题和介绍每 4 幅就回到开头，看起来就是同一批画挂了两遍。
 */
const SCROLLS = [
  { kind: 'shanshui', title: '楚山烟雨图', tag: '立轴 · 纸本水墨', desc: '烟云横锁，远峰只用淡墨一抹。楚地多水，画家把「空」留给了江面，也留给了看画的人。' },
  { kind: 'zhuzi', title: '墨竹图轴', tag: '立轴 · 纸本墨笔', desc: '竹竿用中锋写出，节节分明；竹叶以「个」字、「介」字叠排，一笔下去便有风。' },
  { kind: 'huaniao', title: '梅花山雀图', tag: '立轴 · 纸本设色', desc: '梅枝自左下斜出，花朵用没骨法点染，一只山雀收翅立于枝头，整幅画的重心就落在它的爪上。' },
  { kind: 'shufa', title: '隶书对联', tag: '对联 · 纸本墨书', desc: '隶书横画「蚕头燕尾」，一字之中有一笔主笔舒展，其余笔画收敛，整幅便稳如磐石。' },
  { kind: 'shanshui', title: '汉水秋汛图', tag: '立轴 · 绢本设色', desc: '江面用细笔勾出水纹，一层层推远。近岸两株杂树压住左下角，画面才不飘。' },
  { kind: 'shufa', title: '篆书「江汉」二字', tag: '立轴 · 纸本墨书', desc: '小篆结体修长，笔画粗细几乎一致，转折处用圆转。两个字撑满整幅，留白比字本身更难。' },
  { kind: 'huaniao', title: '荷塘双鹤图', tag: '立轴 · 纸本设色', desc: '荷叶用大笔铺开，鹤身只用三笔勾出颈、背、足。工写相间，一只回头、一只引颈。' },
  { kind: 'shanshui', title: '云梦泽图卷', tag: '立轴 · 纸本水墨', desc: '云梦泽在楚地文献里反复出现。画家用积墨表现水汽，近处芦苇一笔到底，远处只剩淡淡的影。' },
  { kind: 'shufa', title: '行书七言联', tag: '对联 · 纸本墨书', desc: '行书行笔快，牵丝映带之间能看见手腕的动作。上下联末字一笔拉长，气就收住了。' },
  { kind: 'zhuzi', title: '风竹图轴', tag: '立轴 · 纸本墨笔', desc: '整幅竹竿都向一边倒，是风的方向。竹叶用侧锋扫出，叶尖带出一点枯笔，最见风力。' },
  { kind: 'huaniao', title: '残荷翠鸟图', tag: '立轴 · 纸本设色', desc: '荷叶已经破了，叶脉却更硬。翠鸟停在枯茎上，蓝绿的一小块是全幅唯一的亮色。' },
  { kind: 'shanshui', title: '巫山十二峰', tag: '立轴 · 绢本设色', desc: '十二峰排成一列，靠浓淡拉开前后。中部留出一线天，观者的眼睛顺着它往上走。' },
  { kind: 'shufa', title: '章草尺牍', tag: '尺牍 · 纸本墨书', desc: '章草还带着隶书的波磔，字与字之间并不相连。写在信笺上，行距比字距更宽。' },
  { kind: 'zhuzi', title: '新竹图轴', tag: '立轴 · 纸本墨笔', desc: '画的是刚解箨的嫩竹，竹叶短而密，竿上还带着白粉。淡墨画竿、浓墨点叶，层次就出来了。' },
  { kind: 'shanshui', title: '岘山怀古图', tag: '立轴 · 纸本水墨', desc: '山石用披麻皴，一道一道叠上去。山脚下画了一个极小的人，尺度就全靠他立住了。' },
  { kind: 'shufa', title: '草书歌乐诗残句', tag: '立轴 · 纸本墨书', desc: '残句只剩十字，笔势却一路到底。写到一半蘸墨，后半篇由浓转枯，反而更有节奏。' },
];

/** 序厅漏斗墙上的 8 件书法（两弧墙各 4 件，与长廊立轴不重复） */
const FUNNEL_CALLIGRAPHY = [
  { title: '楚国简牍选字', tag: '书法 · 简牍墨书', desc: '从包山、郭店出土的楚简上选下的十八个字。笔道一笔一顿，看不出后来楷书那种提按。' },
  { title: '隶书「楚辞」节录', tag: '书法 · 纸本墨书', desc: '选《离骚》起首数句。隶书把篆书的圆转硬拗成方折，这一下就是书体史上最大的一步。' },
  { title: '篆书「凤鸟」二字', tag: '书法 · 纸本墨书', desc: '楚人尚凤。两个字把鸟的尾羽拉得极长，写到收笔处几乎不分笔画与纹样。' },
  { title: '楷书曾侯乙编钟铭摹写', tag: '书法 · 纸本墨书', desc: '临摹钟体上的乐律铭文。原字铸在钟上，笔画略肥；写到纸上反而要收一点才立得住。' },
  { title: '行书「一钟双音」', tag: '书法 · 纸本墨书', desc: '四个字一气写完，中间「钟」字最后一竖拉长，把整幅的重心从左边移到了中间。' },
  { title: '魏碑集字联', tag: '对联 · 纸本墨书', desc: '从北朝造像记里集出的字。方笔切入、棱角分明，与楚简的圆转是两种完全相反的写法。' },
  { title: '草书涂鸦稿', tag: '书法 · 纸本墨书', desc: '一幅没写完的草稿，涂改都留着。看草书有时看的就是涂改处——那一下最放松。' },
  { title: '楷书「江流有声」', tag: '书法 · 纸本墨书', desc: '八个字分两行。楷书看着容易，其实每一横的倾斜角度都要统一，差一点整篇就歪。' },
];

/** 长廊两侧各 8 幅，避开 z = ±9.5 的两个门洞（门洞占 6.9 ~ 12.1） */
// 必须避开两个门洞（z 的 -12.1~-6.9 与 6.9~12.1），否则画会挂在门洞里悬空
const SCROLL_SLOTS = [-16.5, -14, -4.5, -1.5, 1.5, 4.5, 14, 16.5];

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
    offset: -16,
    title: '前言',
    subtitle: 'PREFACE',
    body: '荆楚大地，长江中游。这里出土过改写中国音乐史的编钟，也出土过见证春秋霸业的青铜剑。展厅沿一条中央长廊展开：南端是序厅，北端是通高的编钟厅，两侧分别是曾侯乙墓、楚文化、青铜器与陶瓷四个展厅。',
  },
  {
    wall: 'south',
    offset: 16,
    title: '参观路线',
    subtitle: 'ROUTE',
    body: '由序厅向北进入长廊，长廊两侧是书画立轴与四个展厅的门洞；走到长廊尽头便进入编钟厅，曾侯乙编钟正悬在厅的正中。走近任意展品或展板按 E 查看介绍，在介绍界面按 O 可以单独观察这件器物。',
  },
  {
    wall: 'east',
    offset: 9,
    title: '青铜礼乐',
    subtitle: 'RITUAL BRONZE',
    body: '青铜器是先秦的「礼器」：鼎盛肉、簋盛黍稷、罍与壶盛酒。它们的数量与组合规定了使用者的身份，「钟鸣鼎食」说的正是这套制度。',
  },
  {
    wall: 'east',
    offset: 14.5,
    title: '铜罍与铜镜',
    subtitle: 'LEI AND MIRROR',
    body: '罍是大型盛酒器，小口广肩，肩上有衔环；铜镜的正面打磨光洁可以照容，背面则铸出蟠螭纹与弦纹，是青铜器中少见的「生活用器」。',
  },
  {
    wall: 'east',
    offset: -9,
    title: '土与火的艺术',
    subtitle: 'CLAY AND FIRE',
    body: '从屈家岭的彩陶到元代的青花，湖北的陶瓷史横跨五千年。高岭土与钴蓝在窑火中相遇，才有了梅瓶上那一抹永不褪色的蓝。',
  },
  {
    wall: 'east',
    offset: -14.5,
    title: '元青花',
    subtitle: 'BLUE AND WHITE',
    body: '元青花以进口的苏麻离青为料，发色浓艳并带有铁锈斑。人物故事题材存世极少，腹部四面开光的「四爱图」梅瓶是其中最完整的一件。',
  },
  {
    wall: 'west',
    offset: 9,
    title: '曾侯乙墓',
    subtitle: 'ZENGHOUYI TOMB',
    body: '1978 年发掘于随州擂鼓墩。墓主是战国早期曾国的国君乙，随葬品一万五千余件，其中青铜器总重约十吨，被称为「二十世纪最重要的考古发现之一」。',
  },
  {
    wall: 'west',
    offset: 14.5,
    title: '一钟双音',
    subtitle: 'TWO TONES',
    body: '曾侯乙编钟的每一件钟都能敲出两个乐音：正鼓音与侧鼓音。合瓦形的钟体让两音互不干扰，钟体上的铭文则记录了两千四百年前的乐律体系。',
  },
  {
    wall: 'west',
    offset: -9,
    title: '楚文化',
    subtitle: 'CHU CULTURE',
    body: '楚人尚赤、尚巫、尚凤。漆器以黑漆为地、朱漆为纹，青铜器走向细密繁复的失蜡工艺。楚文化的精神，一半是奇诡的想象，一半是精密的技艺。',
  },
  {
    wall: 'west',
    offset: -14.5,
    title: '越王勾践剑',
    subtitle: 'THE SWORD',
    body: '1965 年江陵望山一号楚墓出土。剑身满饰菱形暗格纹，近格处铸鸟篆铭文「越王鸠浅自作用剑」。出土时寒光凛冽、几乎不见锈蚀，被誉为「天下第一剑」。',
  },
  {
    wall: 'north',
    offset: -16,
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
    offset: 16,
    title: '乐悬制度',
    subtitle: 'MUSIC RITUAL',
    body: '「王宫悬，诸侯轩悬」。钟磬的悬挂方式本身就是等级：曾侯乙以诸侯之礼下葬，曲尺形的三面钟架正合「轩悬」之制。',
  },  {
    wall: 'east',
    offset: 4,
    title: '青铜器的组合',
    subtitle: 'RITUAL SETS',
    body: '鼎与簋成套、盘与匜配套、罍与壶并列。青铜礼器从来不是单件欣赏的对象，而是一整套制度的外化：用鼎用簋的数量，直接对应墓主人的身份。',
  },
  {
    wall: 'east',
    offset: -4,
    title: '陶与瓷之间',
    subtitle: 'FROM CLAY TO PORCELAIN',
    body: '陶器烧成温度约 1000 ℃，瓷器要到 1300 ℃ 以上，差别在原料与釉。从硬陶到原始青瓷，中间隔着一千多年对窑温的控制。',
  },
  {
    wall: 'west',
    offset: 4,
    title: '楚式漆器',
    subtitle: 'CHU LACQUER',
    body: '漆器的胎是木或夹纻，髹漆数十道，再以朱漆描绘云凤纹。它比铜器轻、比陶器韧，能做出极自由的曲线。',
  },
  {
    wall: 'west',
    offset: -4,
    title: '楚人的宇宙观',
    subtitle: 'CHU COSMOLOGY',
    body: '璧圆象天、琮方象地；凤鸟引魂升天、镇墓兽守御地下。楚墓的随葬品组合，本身就是一套关于天地人的想象。',
  },
  {
    wall: 'north',
    offset: 12.5,
    title: '编磬与金石之乐',
    subtitle: 'STONE CHIMES',
    body: '磬用石灰岩打磨而成，音高取决于石片的长度与厚度。钟与磬合奏即「金石之乐」，是先秦礼乐的最高形式。',
  },
  {
    wall: 'north',
    offset: -12.5,
    title: '钟架上的铭文',
    subtitle: 'INSCRIPTIONS',
    body: '曾侯乙编钟共刻有三千七百余字铭文，记下曾、楚、齐、晋等国的律名对照。它同时是一部乐律学著作。',
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

/** 墙裙高度（模块级：外层墙与隔墙共用） */
const SKIRT_H = 1.2;

/** 建筑表面材质做成单例：外层墙与隔墙共用同一份贴图，省显存也保证观感一致 */
let shellMaterials = null;
function getShellMaterials() {
  if (shellMaterials) return shellMaterials;
  const skirtCanvas = tex.makeSkirtingCanvas();
  // 四种墙面做法：米白抹灰 / 暖砂壁 / 浅灰石材对缝 / 深色展墙
  const wallVariants = [0, 1, 2, 3].map((v) => new THREE.MeshStandardMaterial({
    ...surfaceSet(tex.makeWallCanvas(v), { normalStrength: 1.3, roughnessRange: [0.72, 0.98] }),
    roughness: 1,
    metalness: 0.02,
  }));
  shellMaterials = {
    walls: wallVariants,
    wall: wallVariants[0],
    skirt: new THREE.MeshStandardMaterial({
      ...surfaceSet(skirtCanvas, { repeat: [3, 0.6], normalStrength: 1.1, roughnessRange: [0.24, 0.8] }),
      roughness: 1,
      metalness: 0.12,
    }),
    trim: new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc79a2c, roughness: 0.35, metalness: 0.85 }),
  };
  return shellMaterials;
}
/** 窗户玻璃与窗框 */
let windowMaterials = null;
function getWindowMaterials() {
  if (windowMaterials) return windowMaterials;
  windowMaterials = {
    // 自发光玻璃：读起来就是“外面有日光”，又不用额外加灯
    glassMaterial: new THREE.MeshStandardMaterial({
      color: 0xdff0ff,
      emissive: 0xcfe8ff,
      emissiveIntensity: 1.15,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    }),
    frameMaterial: new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5, metalness: 0.35 }),
  };
  return windowMaterials;
}

/** @param {number} variant 0~3，不同的墙面做法 */
const getWallMaterial = (variant = 0) => getShellMaterials().walls[variant % 4];
const getSkirtMaterial = () => getShellMaterials().skirt;
const getTrimMaterial = () => getShellMaterials().trim;

/**
 * 按世界尺寸缩放 BoxGeometry 的 UV。
 *
 * BoxGeometry 每个面的 UV 都是 0~1，直接贴图会被拉伸成不同密度；
 * 按面的实际世界尺寸乘一遍，整馆的贴图密度就一致了（不会出现大门边上的砖特别大）。
 */
function scaleBoxUV(geometry, size, tile = 2) {
  const [width, height, depth] = size;
  const uv = geometry.attributes.uv;
  // 面顺序：+x, -x, +y, -y, +z, -z，每面 4 个顶点
  const faces = [
    [depth, height], [depth, height],
    [width, depth], [width, depth],
    [width, height], [width, height],
  ];
  for (let f = 0; f < 6; f += 1) {
    const [su, sv] = faces[f];
    for (let i = f * 4; i < f * 4 + 4; i += 1) {
      uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
    }
  }
  uv.needsUpdate = true;
}

/** 由一张颜色画布派生出 map / normalMap / roughnessMap 三件套 */
function surfaceSet(canvas, { repeat, normalStrength = 2, roughnessRange, srgb = true } = {}) {
  return {
    map: tex.canvasTexture(canvas, { repeat, srgb }),
    normalMap: tex.canvasTexture(tex.makeNormalMap(canvas, normalStrength), { repeat, srgb: false }),
    roughnessMap: tex.canvasTexture(tex.makeRoughnessMap(canvas, ...(roughnessRange || [])), { repeat, srgb: false }),
  };
}

function buildShell(scene) {
  const { halfX, halfZ, height, thickness } = ROOM;
  const FLOOR_TILE = 1.2;   // 地砖边长（米）
  const WALL_TILE = 2.2;    // 墙面贴图覆盖的世界尺寸

  // ---------- 地面：石材 + 法线 + 粗糙度 ----------
  const floorCanvas = tex.makeStoneFloorCanvas();
  const floorRepeat = [(halfX * 2) / FLOOR_TILE / 4, (halfZ * 2) / FLOOR_TILE / 4];
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(halfX * 2, halfZ * 2),
    new THREE.MeshStandardMaterial({
      ...surfaceSet(floorCanvas, { repeat: floorRepeat, normalStrength: 2.6, roughnessRange: [0.12, 0.9] }),
      color: 0xffffff,
      roughness: 1,
      metalness: 0.08,
      envMapIntensity: 0.32,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- 外墙：灰浆墙皮 + 窗洞 ----------
  // 注意：四面墙不能都是“全长”，否则四个角会互相穿插。
  // 这里 x 向两面留全长，z 向两面减去角上的厚度，墙角就干净了。
  const { glassMaterial, frameMaterial: winFrame } = getWindowMaterials();
  const WIN = { width: 3.6, sill: 2.6, head: 5.8 };
  // 窗位刻意避开墙上的展板（序厅/编钟厅的展板在 x = 0、±16 附近）
  // 可用的空档是 |x| ∈ [2, 14.7] 与 [17.3, 24]，所以取 ±8.35 与 ±20.6
  const WINDOW_CENTERS = [-20.6, -8.35, 8.35, 20.6];

  const buildWallSegment = ({ axis, at, half, inner, variant = 0, centers = null }) => {
    const span = half * 2;
    const thickness2 = ROOM.thickness;

    const put = (w, h, offset, y) => {
      const size = axis === 'x' ? [w, h, thickness2] : [thickness2, h, w];
      const geometry = new THREE.BoxGeometry(...size);
      scaleBoxUV(geometry, size, WALL_TILE);
      const box = new THREE.Mesh(geometry, getWallMaterial(variant));
      box.position.set(axis === 'x' ? offset : at, y, axis === 'x' ? at : offset);
      box.receiveShadow = true;
      scene.add(box);
    };

    // 不开窗：整面实墙
    if (!centers || !centers.length) {
      put(span, ROOM.height, 0, ROOM.height / 2);
      return;
    }

    // 窗下墙与窗上墙：通长
    put(span, WIN.sill, 0, WIN.sill / 2);
    put(span, ROOM.height - WIN.head, 0, (ROOM.height + WIN.head) / 2);

    // 墙垛：窗户之间以及与墙端之间
    const sorted = [...centers].sort((a, b) => a - b);
    const piers = [];
    let cursor = -half;
    for (const center of sorted) {
      const left = center - WIN.width / 2;
      if (left - cursor > 0.05) piers.push([cursor, left]);
      cursor = center + WIN.width / 2;
    }
    if (half - cursor > 0.05) piers.push([cursor, half]);
    for (const [a2, b2] of piers) put(b2 - a2, WIN.head - WIN.sill, (a2 + b2) / 2, (WIN.head + WIN.sill) / 2);

    // 玻璃与窗框
    const glassPlane = at + inner * (thickness2 / 2 + 0.03);
    for (const center of sorted) {
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(WIN.width * 0.92, WIN.head - WIN.sill - 0.22),
        glassMaterial,
      );
      glass.position.set(axis === 'x' ? center : glassPlane, (WIN.head + WIN.sill) / 2, axis === 'x' ? glassPlane : center);
      glass.rotation.y = axis === 'x' ? (inner > 0 ? 0 : Math.PI) : (inner > 0 ? Math.PI / 2 : -Math.PI / 2);
      scene.add(glass);

      const t = 0.09;
      const H = WIN.head - WIN.sill;
      const bars = [
        [WIN.width, t, 0, H / 2 - t / 2],
        [WIN.width, t, 0, -H / 2 + t / 2],
        [t, H, -WIN.width / 2 + t / 2, 0],
        [t, H, WIN.width / 2 - t / 2, 0],
        [t * 0.7, H, 0, 0],
      ];
      for (const [bw, bh, box2, boy] of bars) {
        const geo = axis === 'x'
          ? new THREE.BoxGeometry(bw, bh, thickness2 * 0.5)
          : new THREE.BoxGeometry(thickness2 * 0.5, bh, bw);
        const bar = new THREE.Mesh(geo, winFrame);
        bar.position.set(
          axis === 'x' ? center + box2 : glassPlane,
          (WIN.head + WIN.sill) / 2 + boy,
          axis === 'x' ? glassPlane : center + box2,
        );
        scene.add(bar);
      }
    }
  };

  // 南北两面（序厅、编钟厅）带窗；东西两面是四个侧厅，用实墙
  buildWallSegment({ axis: 'x', at: -halfZ - ROOM.thickness / 2, half: halfX + ROOM.thickness, inner: 1, variant: 0, centers: WINDOW_CENTERS });
  buildWallSegment({ axis: 'x', at: halfZ + ROOM.thickness / 2, half: halfX + ROOM.thickness, inner: -1, variant: 1, centers: WINDOW_CENTERS });
  buildWallSegment({ axis: 'z', at: -halfX - ROOM.thickness / 2, half: halfZ, inner: 1, variant: 0, centers: null });
  buildWallSegment({ axis: 'z', at: halfX + ROOM.thickness / 2, half: halfZ, inner: -1, variant: 1, centers: null });

  // ---------- 墙裙 + 腰线：深色石材基座，顶部一道鎏金压边 ----------
  const skirtMaterial = getSkirtMaterial();
  const trimMaterial = getShellMaterials().gold;
  const SKIRT_T = 0.16;
  // 南北两条留全长，东西两条缩短一个墙裙厚度，四角不再互相穿插
  // 注意：外表面要比墙面**内退 6mm**。原来贴着墙面（间距 0）两个面深度相同，
  // 显卡在远处分不清谁在前，就会一闪一闪（z-fighting）。
  // 墙裙与墙面的关系要留两道余量，否则底面/侧面会与地面和墙面共面闪烁：
  //   · 外表面比墙面内退 12mm（原来 6mm 在远处深度精度不够）
  //   · 底面上抬 4mm，不和地面在同一平面
  const INSET = 0.012;
  const LIFT = 0.004;
  const CY = SKIRT_H / 2 + LIFT;
  const skirts = [
    { size: [halfX * 2, SKIRT_H, SKIRT_T], pos: [0, CY, -halfZ + SKIRT_T / 2 + INSET] },
    { size: [halfX * 2, SKIRT_H, SKIRT_T], pos: [0, CY, halfZ - SKIRT_T / 2 - INSET] },
    { size: [SKIRT_T, SKIRT_H, halfZ * 2 - SKIRT_T * 2], pos: [-halfX + SKIRT_T / 2 + INSET, CY, 0] },
    { size: [SKIRT_T, SKIRT_H, halfZ * 2 - SKIRT_T * 2], pos: [halfX - SKIRT_T / 2 - INSET, CY, 0] },
  ];
  for (const { size, pos } of skirts) {
    const geometry = new THREE.BoxGeometry(...size);
    scaleBoxUV(geometry, size, 1.6);
    const skirt = new THREE.Mesh(geometry, skirtMaterial);
    skirt.position.set(...pos);
    skirt.receiveShadow = true;
    scene.add(skirt);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] + 0.02, 0.09, size[2] + 0.02),
      trimMaterial,
    );
    trim.position.set(pos[0], SKIRT_H + LIFT + 0.04, pos[2]);
    scene.add(trim);
  }

  // ---------- 长廊地面嵌线 ----------
  const inlay = new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.6 });
  for (const x of [-CORRIDOR_HALF, CORRIDOR_HALF]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, Z_LINE * 2), inlay);
    line.position.set(x, 0.022, 0);
    scene.add(line);
  }

  buildCeilings(scene);
}

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
  slab([-CORRIDOR_HALF, -2, -Z_LINE, Z_LINE], ch);
  slab([2, CORRIDOR_HALF, -Z_LINE, Z_LINE], ch);
  const stripGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(4, Z_LINE * 2),
    new THREE.MeshBasicMaterial({ map: tex.makeSkylightTexture(), side: THREE.DoubleSide }),
  );
  stripGlass.rotation.x = Math.PI / 2;
  stripGlass.position.set(0, ch + 0.7, 0);
  scene.add(stripGlass);
  for (const x of [-2, 2]) {
    const well = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.1, Z_LINE * 2),
      new THREE.MeshStandardMaterial({ color: 0xcfc7b8, roughness: 0.85 }),
    );
    well.position.set(x, ch + 0.35, 0);
    scene.add(well);
  }

  // 编钟厅：方形天窗
  const bh = zone('bells').height;
  const sky = { x0: -7, x1: 7, z0: -34.5, z1: -23.5 };
  slab([-24, 24, -40, sky.z0], bh);
  slab([-24, 24, sky.z1, -18], bh);
  slab([-24, sky.x0, sky.z0, sky.z1], bh);
  slab([sky.x1, 24, sky.z0, sky.z1], bh);
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
    { size: [0.5, 0.1, Z_LINE * 1.7], pos: [-5.2, ch - 0.06, 0] },
    { size: [0.5, 0.1, Z_LINE * 1.7], pos: [5.2, ch - 0.06, 0] },
    { size: [0.5, 0.1, 14], pos: [20.5, 5.85, 9] },
    { size: [0.5, 0.1, 14], pos: [20.5, 5.85, -9] },
    { size: [0.5, 0.1, 14], pos: [-20.5, 5.85, 9] },
    { size: [0.5, 0.1, 14], pos: [-20.5, 5.85, -9] },
    { size: [0.5, 0.1, 18], pos: [11, 5.85, 9] },
    { size: [0.5, 0.1, 18], pos: [11, 5.85, -9] },
    { size: [0.5, 0.1, 18], pos: [-11, 5.85, 9] },
    { size: [0.5, 0.1, 18], pos: [-11, 5.85, -9] },
    { size: [22, 0.14, 0.5], pos: [0, 8.35, 22] },
    { size: [22, 0.14, 0.5], pos: [0, 8.35, 33] },
  ];
  for (const { size, pos } of strips) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(...size), stripMaterial);
    strip.position.set(...pos);
    scene.add(strip);
  }
}

/** 隔墙、门楣、匾额 */
function buildPartitions(scene, colliders) {
  const trimMaterial = getTrimMaterial();

  for (const [segmentIndex, [x0, z0, x1, z1]] of WALL_SEGMENTS.entries()) {
    const width = Math.abs(x1 - x0) || WALL_T;
    const depth = Math.abs(z1 - z0) || WALL_T;
    const alongCorridor = Math.abs(x1 - x0) < 0.001;
    const height = alongCorridor ? zone('corridor').height : zone('bronze').height;

    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), getWallMaterial(segmentIndex));
    wall.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    colliders.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfX: width / 2, halfZ: depth / 2 });

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.12, depth + 0.06), trimMaterial);
    cap.position.set((x0 + x1) / 2, height - 0.06, (z0 + z1) / 2);
    scene.add(cap);

    // 隔墙不再做墙裙与腰线。
    // 原因：门洞就开在这些隔墙上，墙裙端头必然与白色墙面、门框咬在一起，
    // 远近不同的深度精度下就会闪。既然观感上只是墙脚一条深色带，
    // 直接去掉最干净——墙裙只保留在没有门洞的外墙上。
  }

  // 长廊两端的大开口：门楣 + 匾额
  for (const [z, name, sub] of [
    [Z_LINE, '序厅', 'PREFACE HALL'],
    [-Z_LINE, '编钟厅', 'CHIME BELL HALL'],
  ]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_HALF * 2 + WALL_T * 2, 1.8, WALL_T), getWallMaterial(2));
    beam.position.set(0, zone('corridor').height - 0.9, z);
    scene.add(beam);
    addSign(scene, name, sub, [0, zone('corridor').height - 1.0, z + (z > 0 ? 0.2 : -0.2)], z > 0 ? Math.PI : 0, 3.6);
  }

  // 四个侧厅门洞的门楣与匾额
  for (const door of DOOR_SIGNS) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, zone('corridor').height - DOOR_TOP, DOOR_HALF * 2),
      getWallMaterial(0),
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
      // 贴到墙面内表面：墙以 CORRIDOR_HALF 为中心线，厚度 WALL_T，再留 7cm 挂件余量
      group.position.set(side * (CORRIDOR_HALF - WALL_T / 2 - 0.07), 2.55, z);
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
  // 放在最靠近长廊的四根石柱（±5.2, 24 与 ±5.2, 30）围出的中间，
  // 与猜谜台面对面：正面朝 -x（转 -90° 后 +z 轴指向 -x）
  const x = 4.1;
  const z = 27;
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
  // 默认朝 +z，转 -90° 后面向 -x，正对西侧的猜谜台
  group.rotation.y = -Math.PI / 2;

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
  // 与抽签台面对面，在四根石柱中间：正面朝 +x
  const x = -4.1;
  const z = 27;
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
  // 默认朝 +z，转 +90° 后面向 +x，正对东侧的抽签台
  group.rotation.y = Math.PI / 2;
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


/* ------------------------------------------------------------------ */
/* 陈设：长凳、花器、序厅沙盘                                           */
/* 这些不参与交互，只用来把大空间填满，避免「走进来什么都没有」。      */
/* ------------------------------------------------------------------ */

/** 楚式漆木长凳 */
function buildBench(scene, colliders, x, z, rotationY = 0) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.46), m.lacquer);
  seat.position.y = 0.46;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);
  // 座面朱漆镶边
  for (const dz of [-0.21, 0.21]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.04, 0.05), m.red);
    edge.position.set(0, 0.5, dz);
    group.add(edge);
  }
  for (const dx of [-0.95, 0.95]) {
    for (const dz of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), m.black);
      leg.position.set(dx, 0.21, dz);
      leg.castShadow = true;
      group.add(leg);
    }
  }
  scene.add(group);
  colliders.push({ x, z, radius: 1.3 });
}

/** 青铜花器（高圈足铜壶，内插绿枝） */
function buildPlanter(scene, colliders, x, z) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // 注：lathe() 是 artifacts.js 的私有辅助函数，这里直接构造 LatheGeometry
  const profile = [[0.02, 0], [0.26, 0], [0.3, 0.06], [0.42, 0.4], [0.44, 0.62], [0.36, 0.82], [0.34, 0.9]];
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 48),
    m.bronze,
  );
  body.material.side = THREE.DoubleSide;
  body.castShadow = true;
  group.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 10, 36), m.patina);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.9;
  group.add(collar);

  // 绿枝：几支细茎 + 球形叶团
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4a6b3c, roughness: 0.85 });
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.9, 6), leaf);
    stem.position.set(Math.cos(a) * 0.12, 1.35, Math.sin(a) * 0.12);
    stem.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
    group.add(stem);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 0), leaf);
    bush.position.set(Math.cos(a) * 0.3, 1.85 + (i % 2) * 0.14, Math.sin(a) * 0.3);
    bush.castShadow = true;
    group.add(bush);
  }
  scene.add(group);
  colliders.push({ x, z, radius: 0.8 });
}

/* ------------------------------------------------------------------ */
/* 序厅：倾斜石柱阵 + 弧形回形墙（漏斗式开场）                           */
/* 设计依据见 docs/scene-layout.md 第 1 节                               */
/* ------------------------------------------------------------------ */

const FRONT_HALL_LEAN_DEG = 4;   // 序厅石柱内倾角度（度）：0 笔直，正值内倾，负值外倾

function buildFrontHall(struct) {
  // 两道凹弧收成漏斗，把视线与动线压向长廊入口（z = 18, x ∈ [-6, 6]）。
  // 弧心在 (±30, 18)、半径 23 m，取 15°~50° 那一段：
  // 东侧从 (7.8, 24) 走到 (15.2, 35.6)，西侧镜像。
  // 注意角度取的是「弧心到墙点」的方向，不是弧心到门的方向，
  // 所以东侧是 165°→130°，与直觉相反。
  const funnels = [
    { cx: 30, a0: THREE.MathUtils.degToRad(165), a1: THREE.MathUtils.degToRad(130) },
    { cx: -30, a0: THREE.MathUtils.degToRad(15), a1: THREE.MathUtils.degToRad(50) },
  ];
  for (const f of funnels) {
    struct.arcWall({
      cx: f.cx,
      cz: 18,
      radius: 23,
      a0: f.a0,
      a1: f.a1,
      height: 4.5,
      thickness: 0.35,
      material: struct.plaster,
      cap: struct.stoneDark,
      hooks: 1,
      hookLength: 1.4,
    });
  }

  // 倾斜石柱阵：三对石柱在漏斗里排出通道感。
  //
  // 【要调倾斜，只改这一个数】FRONT_HALL_LEAN_DEG：
  //     7  = 现在这样，柱顶向中轴内倾（漏斗往里收）
  //     0  = 笔直的石柱
  //    -7  = 向外倾（漏斗往外张开）
  // 符号规律：rotation.z 为正，柱顶倒向 -x。所以东侧（+x）传正数、西侧传负数
  // 就是「内倾」；把 side 的符号取反即变成外倾。
  const lean = THREE.MathUtils.degToRad(FRONT_HALL_LEAN_DEG);
  // 序厅天花板底面标高。留 1 cm 让开，严丝合缝贴着会 z-fighting 闪烁。
  const ceiling = zone('entrance').height - 0.01;
  for (const z of [24, 30, 36]) {
    for (const side of [1, -1]) {
      struct.column({ x: side * 5.2, z, r: 0.45, topY: ceiling, material: struct.stone, tiltZ: side * lean });
    }
  }
}


/* ------------------------------------------------------------------ */
/* 其余六个厅的空间构筑（设计依据见 docs/scene-layout.md）              */
/* ------------------------------------------------------------------ */

/** 曾侯乙墓展厅：青铜巨柱 + 中心回环墙 + 四角放射短肢（地下宫殿的环绕朝圣） */
function buildZenghouyiHall(struct) {
  const ceiling = zone('zenghouyi').height;
  // 两列展品在 x = -18.8 与 -11.4，正中是 -15.1。
  // 回环墙收到 3 × 3 落在正中，四角正好是四根青铜巨柱 —— 墙和柱连成一个完整的回字。
  // 原来墙是 4 × 4 且偏在 -15.5，一侧离展台只有 0.68 m，既挡视线又和柱子断开。
  const cx = -15.1;
  const cz = 9;
  const half = 1.5;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      struct.column({
        x: cx + sx * half, z: cz + sz * half, r: 0.7, topY: ceiling,
        material: struct.bronze, rings: 2,
      });
    }
  }
  struct.ringWall({
    cx, cz, size: 3, height: 2.8,
    material: struct.plaster, cap: struct.stoneDark, gap: 0.6,
  });
}

/** 编钟厅：半圆剧场式的韵律柱（70°~110° 留空，不挡入口中轴） */
function buildBellHall(struct) {
  const ceiling = zone('bells').height;
  // 韵律柱撑开一点：半径 9→11.5、每弧 4 根→3 根、张角 45°→30°。
  // 原来 7 m 弧长上排 4 根，间距只有 2.4 m，14 m 高的柱子在眼前挤成一道墙。
  const colonnade = [
    [24, 54],
    [126, 156],
  ];
  for (const [a0, a1] of colonnade) {
    struct.arcColonnade({
      cx: 0, cz: -29, radius: 11.5, count: 3,
      a0: THREE.MathUtils.degToRad(a0), a1: THREE.MathUtils.degToRad(a1),
      r: 0.55, topY: ceiling, material: struct.stone, rings: 2,
    });
  }
}

/** 青铜器厅：十字回形墙 + 四角方柱（硬朗的珍珠项链式动线） */
function buildBronzeHall(struct) {
  // 缺口从 1.2 收到 0.6：墙段端头正好插进方柱，十字墙与柱子连成一体
  // （原来留 1.2 的缺口，墙端离柱子还有 0.6 m，看起来是断开的）。
  struct.ringWall({
    cx: 15.1, cz: 9.5, size: 4, height: 2.8,
    material: struct.plaster, cap: struct.stoneDark, gap: 0.6,
  });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      struct.pier({ x: 15.1 + sx * 2, z: 9.5 + sz * 2, size: 0.7, height: 3.6 });
    }
  }
  // 十字：从环墙四边中点再向外伸一段，动线绕着它走
  const stubs = [
    [13.1, 9.5, 11.5, 9.5], [17.1, 9.5, 18.7, 9.5],
    [15.1, 7.5, 15.1, 5.9], [15.1, 11.5, 15.1, 13.1],
  ];
  for (const [x0, z0, x1, z1] of stubs) {
    struct.lineWall({ x0, z0, x1, z1, height: 2.8, material: struct.plaster, cap: struct.stoneDark });
  }
}

/** 楚文化展厅：红黑木柱交替（蜿蜒流淌的浪漫梦境） */
function buildChuHall(struct) {
  const topY = zone('chu').height - 0.01;
  // 原来排在 x = -17 / -13 两列，离展品（-18.8 与 -11.4）只有 1.8 m，挡视线。
  // 收成一排落在两列展品的正中 x = -15.1，两侧各留 2.86 m 净距。
  let index = 0;
  for (const z of [-3.5, -7.5, -11.5, -15.5]) {
    struct.column({
      x: -15.1, z, r: 0.22, topY,
      material: index % 2 ? struct.woodBlack : struct.woodRed,
    });
    index += 1;
  }
}

/** 陶瓷厅：细密格栅柱 + 错层矮墙（阶梯递进的沉淀） */
function buildCeramicHall(struct) {
  const topY = zone('ceramic').height - 0.01;
  // 两列展品在 x = 11.4 与 18.8，正中是 15.1 —— 格栅柱与矮墙都收在这里，
  // 两侧各留 1.58 m，不再挡住展品（原来矮墙一直伸到 17.4，离展台只剩 0.78 m）。
  for (const z of [-2, -17]) {
    for (const x of [14.0, 16.2]) {
      struct.column({ x, z, r: 0.22, topY, material: struct.lattice });
    }
  }
  // 三道矮墙高度递进，中间留 1.2 m 过道
  for (const [z, height] of [[-4, 1.1], [-9.5, 1.5], [-15, 1.9]]) {
    struct.lineWall({ x0: 13.6, z0: z, x1: 14.5, z1: z, height, material: struct.plaster, cap: struct.stoneDark });
    struct.lineWall({ x0: 15.7, z0: z, x1: 16.6, z1: z, height, material: struct.plaster, cap: struct.stoneDark });
  }
}

/** 长廊：顶部的叠涩梁，压出光影节奏（避开中轴那条天窗） */
function buildCorridorBeams(struct) {
  for (const at of [-4.4, 4.4]) {
    struct.beams({ axis: 'z', from: -15, to: 15, at, count: 6, width: 2.4, drop: 0.6 });
  }
}

/* ------------------------------------------------------------------ */
/* 序厅：漏斗弧墙上的书法展品                                           */
/* ------------------------------------------------------------------ */

/**
 * 沿两道弧墙的内表面各挂 4 件书法，正面朝弧心（也就是朝厅内）。
 * 弧墙参数必须与 buildFrontHall 保持一致：弧心 (±30, 18)、半径 23、厚 0.35。
 */
function buildFunnelCalligraphy(scene, interactables) {
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.6 });
  const width = 1.15;
  const height = 2.1;
  const r = 23 - 0.35 / 2 - 0.07;   // 内表面再留 7cm 挂件余量
  const arcs = [
    { cx: 30, a0: 165, a1: 130 },
    { cx: -30, a0: 15, a1: 50 },
  ];
  let index = 0;
  for (const arc of arcs) {
    for (let k = 0; k < 4; k += 1) {
      const t = (k + 0.5) / 4;
      const a = THREE.MathUtils.degToRad(arc.a0 + (arc.a1 - arc.a0) * t);
      const data = FUNNEL_CALLIGRAPHY[index];
      const group = new THREE.Group();
      group.position.set(arc.cx + Math.cos(a) * r, 2.5, 18 + Math.sin(a) * r);
      // 平面默认法线是 +z，要让它朝弧心：n = -(cos a, sin a)
      group.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));

      const picture = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
          map: tex.makeScrollTexture('shufa', 40 + index),
          roughness: 0.88,
          emissive: 0x14120e,
          emissiveIntensity: 0.4,
        }),
      );
      group.add(picture);
      for (const y of [height / 2 + 0.06, -height / 2 - 0.06]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, width + 0.22, 12), frameMaterial);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(0, y, 0);
        group.add(rod);
      }
      scene.add(group);

      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
      interactables.push({
        position: group.position.clone().addScaledVector(normal, 1.3).setY(1.6),
        radius: 2.4,
        title: data.title,
        tag: data.tag,
        desc: data.desc,
        model: group,
      });
      index += 1;
    }
  }
}

/** 序厅漏斗弧墙「外表面」的展厅导览故事（弧墙参数同 buildFunnelCalligraphy） */
const FUNNEL_STORIES = [
  { title: '序厅 · 荆楚门户', subtitle: 'PREFACE', body: '序厅是天光最亮的地方。两道上收的弧墙把光线和脚步一起压向长廊入口，站在中间先别急着走——回头看一眼出口，尺度感就出来了。' },
  { title: '长廊 · 光影长廊', subtitle: 'CORRIDOR', body: '长廊两侧挂着十六幅立轴，每走几步就换一幅。四个展厅的门洞都开在这条廊子上，展厅之间互不相通，看展的节奏由这条廊子控制。' },
  { title: '曾侯乙墓展厅 · 地下乐宫', subtitle: 'ZENG HOU YI', body: '一九七八年，随州一个战备工地挖出了这座墓。四根青铜巨柱围成一座回环墙，象的是墓坑本身；尊盘、鉴缶、建鼓座都出在这里。' },
  { title: '青铜器厅 · 礼乐之器', subtitle: 'RITUAL BRONZE', body: '鼎、簋、罍、卣、盘、匜——这些器物从来不是单独用的，而是一整套：用几个鼎、几件簋，直接对应墓主人的身份。' },
  { title: '陶瓷厅 · 土与火', subtitle: 'CERAMICS', body: '从屈家岭的彩陶到元代的青花，中间隔了四千多年。陶器烧到一千度，瓷器要一千三百度以上，差别就在这一道温度上。' },
  { title: '楚文化厅 · 巫风与浪漫', subtitle: 'CHU CULTURE', body: '楚人信巫、好祀、尚赤。漆器用红黑两色，红是朱砂、黑是烟灰；镇墓兽插着鹿角站在墓道里，是楚人对死后世界的一个想象。' },
  { title: '编钟厅 · 一钟双音', subtitle: 'CHIME BELLS', body: '六十五件青铜钟悬在三层钟架上。敲钟的正鼓部和侧鼓部会发两个音，音域跨五个半八度。钟上的铭文有三千七百多字，记的是乐律。' },
  { title: '湖北省博物馆 · 关于本馆', subtitle: 'ABOUT', body: '湖北省博物馆坐落在武昌东湖边，馆藏以楚文化和曾侯乙墓出土文物为大宗。这个虚拟展厅重建了其中六处空间，可以依次走完整条动线。' },
];

/**
 * 弧墙外表面挂八块展厅导览展板（每弧 4 块）。
 * 外表面朝远离弧心的方向，所以法线是 +(cos a, sin a)，
 * 而内表面那扇立轴的法线是取负的——两面刚好背对背。
 */
function buildFunnelStories(scene, interactables) {
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.62 });
  const width = 1.75;
  const height = 1.15;
  const r = 23 + 0.35 / 2 + 0.07;   // 外表面再留 7cm 挂件余量
  const arcs = [
    { cx: 30, a0: 165, a1: 130 },
    { cx: -30, a0: 15, a1: 50 },
  ];
  let index = 0;
  for (const arc of arcs) {
    for (let k = 0; k < 4; k += 1) {
      const t = (k + 0.5) / 4;
      const a = THREE.MathUtils.degToRad(arc.a0 + (arc.a1 - arc.a0) * t);
      const data = FUNNEL_STORIES[index];
      const group = new THREE.Group();
      group.position.set(arc.cx + Math.cos(a) * r, 2.35, 18 + Math.sin(a) * r);
      group.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));

      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
          map: tex.makePanelTexture({ ...data, layout: LAYOUT }),
          roughness: 0.72,
          emissive: 0x1a1712,
          emissiveIntensity: 0.45,
        }),
      );
      group.add(board);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.06), frameMaterial);
      frame.position.z = -0.04;
      group.add(frame);
      scene.add(group);

      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
      interactables.push({
        position: group.position.clone().addScaledVector(normal, 1.5).setY(1.5),
        radius: 2.4,
        title: data.title,
        tag: '序厅 · 展厅导览',
        desc: data.body,
        model: group,
      });
      index += 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 编钟厅：四角的小编钟架                                               */
/* ------------------------------------------------------------------ */

/** 一具小编钟架：两根立柱 + 横梁 + 四枚扁钟（纯陈设，不做交互） */
function buildBellRack(scene, colliders, x, z, rotationY = 0) {
  const m = materials();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.6 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  for (const dx of [-1.15, 1.15]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.9, 0.24), wood);
    post.position.set(dx, 1.45, 0);
    post.castShadow = true;
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.28, 0.32), wood);
  beam.position.y = 2.98;
  beam.castShadow = true;
  group.add(beam);

  for (let i = 0; i < 4; i += 1) {
    const bx = -0.9 + i * 0.6;
    const h = 0.56 - i * 0.07;
    // 扁钟：上窄下宽，再压扁成钟形
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.34, h * 0.52, h, 16), m.bronze);
    bell.scale.set(1, 1, 0.62);
    bell.position.set(bx, 2.84 - h / 2, 0);
    bell.castShadow = true;
    group.add(bell);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 14), m.gold);
    ring.position.set(bx, 2.88, 0);
    group.add(ring);
  }
  scene.add(group);
  colliders.push({ x, z, radius: 1.5 });
}

/** 编钟厅四角：近门两角立鹿角立鹤像，远门两角摆小编钟架 */
function buildBellHallCorners(scene, colliders) {
  for (const side of [1, -1]) {
    // 近门两角原来只有一具小钟架，比 14 m 高的厅子显得太空，改成立像
    buildBronzeStatue(scene, colliders, side * 20.2, -21.2, side > 0 ? -0.7 : 0.7);
    buildBellRack(scene, colliders, side * 20.4, -37.2, side > 0 ? 0.5 : -0.5);
  }
}

/**
 * 青铜鹿角立鹤：曾侯乙墓出土的镇墓神鸟。鹤身、长颈、双翼，
 * 头上生一对分叉鹿角 —— 鹤与鹿两种瑞兽合在一件器上，辨识度很高。
 */
function buildBronzeStatue(scene, colliders, x, z, rotationY = 0) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const add = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const piece = new THREE.Mesh(geo, mat);
    piece.position.set(px, py, pz);
    piece.rotation.set(rx, ry, rz);
    piece.castShadow = true;
    group.add(piece);
    return piece;
  };

  // 铜座
  add(new THREE.BoxGeometry(1.0, 0.26, 0.78), m.patina, 0, 0.13, 0);
  add(new THREE.BoxGeometry(1.08, 0.06, 0.86), m.darkBronze, 0, 0.29, 0);

  // 双足：旧铜锈色，从底座撑到鹤腹
  for (const dx of [-0.17, 0.17]) {
    add(new THREE.CylinderGeometry(0.045, 0.055, 1.05, 10), m.patina, dx, 0.85, 0);
    add(new THREE.CylinderGeometry(0.08, 0.06, 0.06, 10), m.bronze, dx, 0.34, 0);   // 爪
  }

  // 鹤身：椭球，头尾方向压长
  const body = add(new THREE.SphereGeometry(0.34, 20, 14), m.bronze, 0, 1.58, 0);
  body.scale.set(1, 0.78, 1.3);
  // 双翼：向后下方展开
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.1, 0.34, 0.62), m.patina, side * 0.3, 1.66, -0.16, 0.22, side * 0.28, side * 0.12);
  }
  // 尾羽
  add(new THREE.BoxGeometry(0.34, 0.07, 0.46), m.patina, 0, 1.42, -0.42, -0.3, 0, 0);

  // 长颈：自胸前旋起，两段衔接
  add(new THREE.CylinderGeometry(0.075, 0.11, 0.72, 12), m.bronze, 0, 2.06, 0.16, 0.18, 0, 0);
  add(new THREE.CylinderGeometry(0.06, 0.075, 0.5, 12), m.bronze, 0, 2.62, 0.1, -0.1, 0, 0);

  // 鹤首 + 长喙 + 双睛
  add(new THREE.SphereGeometry(0.13, 16, 12), m.bronze, 0, 2.9, 0.02);
  add(new THREE.ConeGeometry(0.045, 0.3, 8), m.gold, 0, 2.88, 0.2, Math.PI / 2 - 0.12, 0, 0);
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(0.026, 10, 8), m.gold, side * 0.08, 2.94, 0.1);
  }

  // 鹿角：每侧一主枝 + 三分叉，鹤与鹿合体的关键
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 7), m.patina, side * 0.09, 3.16, -0.02, -0.12, 0, side * 0.42);
    for (let i = 0; i < 3; i += 1) {
      add(
        new THREE.CylinderGeometry(0.011, 0.018, 0.24, 6), m.patina,
        side * (0.2 + i * 0.075), 3.3 + i * 0.09, -0.03 + i * 0.04,
        -0.1, 0, side * (0.85 + i * 0.28),
      );
    }
  }

  scene.add(group);
  colliders.push({ x, z, radius: 1.0 });
}

/**
 * 长廊上方悬挂的青铜吊盆（纯陈设，不做碰撞：盆口在 5.5 m，高于人头）。
 * 四根吊链从天花垂下，铜盆口一圈旧铜锈唇，枝叶向外垂落。
 */
function buildHangingPlanter(scene, x, z) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const TOP = zone('corridor').height;   // 天花
  const RIM = 5.5;                       // 盆口标高

  for (const [dx, dz] of [[-0.19, -0.19], [0.19, -0.19], [0.19, 0.19], [-0.19, 0.19]]) {
    const len = TOP - RIM - 0.06;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 6), m.gold);
    chain.position.set(dx, RIM + len / 2, dz);
    group.add(chain);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 22), m.gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = RIM + 0.03;
  group.add(ring);

  const pot = new THREE.Mesh(
    new THREE.LatheGeometry(
      [[0.03, -0.36], [0.16, -0.34], [0.21, -0.25], [0.25, -0.1], [0.27, 0.02]]
        .map(([r, y]) => new THREE.Vector2(r, y)),
      26,
    ),
    m.bronze,
  );
  pot.position.y = RIM - 0.02;
  pot.castShadow = true;
  group.add(pot);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 8, 30), m.patina);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = RIM;
  group.add(lip);
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.04, 26),
    new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 1 }),
  );
  soil.position.y = RIM - 0.05;
  group.add(soil);

  const leaf = new THREE.MeshStandardMaterial({ color: 0x4a6b3c, roughness: 0.85 });
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.5, 6), leaf);
    stem.position.set(Math.cos(a) * 0.2, RIM + 0.1, Math.sin(a) * 0.2);
    stem.rotation.set(Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85);
    group.add(stem);
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11 + (i % 3) * 0.02, 0), leaf);
    tuft.position.set(Math.cos(a) * 0.42, RIM + 0.3, Math.sin(a) * 0.42);
    tuft.castShadow = true;
    group.add(tuft);
  }
  scene.add(group);
}

/** 长廊：两侧各 5 只吊盆，避开两个门洞（ z 的 ±6.9~±12.1 ） */
function buildCorridorPlanters(scene) {
  for (const side of [1, -1]) {
    for (const z of [-14, -8, 0, 8, 14]) {
      buildHangingPlanter(scene, side * 3.2, z);
    }
  }
}

/** 展厅吊牌：双面印厅名，两根吊杆挂到天花 */
function buildHallSign(scene, name, sub, x, z, ceilingY, rotationY = 0) {
  const group = new THREE.Group();
  const w = 2.0;
  const h = 0.72;
  const centerY = 5.0;
  group.position.set(x, centerY, z);
  group.rotation.y = rotationY;

  const texture = tex.makeSignTexture(name, sub);
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, emissive: 0x1a1712, emissiveIntensity: 0.5 }),
    );
    plate.position.z = side * 0.045;
    plate.rotation.y = side > 0 ? 0 : Math.PI;
    group.add(plate);
  }
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.6 }),
  );
  group.add(frame);

  const rodLen = Math.max(0.3, ceilingY - centerY - h / 2);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x3a2c22, metalness: 0.5, roughness: 0.5 });
  for (const dx of [-w / 3, w / 3]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen, 6), rodMat);
    rod.position.set(dx, h / 2 + rodLen / 2, 0);
    group.add(rod);
  }
  scene.add(group);
}

/** 六个展厅各挂一块吊牌，厅名与副题直接取 ZONES */
function buildHallSigns(scene) {
  const spots = [
    ['entrance', 0, 21, 0],
    ['bronze', 8.5, 9.5, Math.PI / 2],
    ['ceramic', 8.5, -9.5, Math.PI / 2],
    ['zenghouyi', -8.5, 9.5, Math.PI / 2],
    ['chu', -8.5, -9.5, Math.PI / 2],
    ['bells', 0, -21, 0],
  ];
  for (const [id, x, z, rotationY] of spots) {
    const info = zone(id);
    buildHallSign(scene, info.name, info.sub, x, z, info.height, rotationY);
  }
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
  // 有外部模型就用它顶掉程序化形体（异步，加载完原地替换）。
  // 注意传的是 object 而不是 holder：interactable.model 指向 object，
  // 检视面板/观赏/抽签/缩略图都拿它去渲染。换 holder 的子节点等于把
  // object 变成脱离场景的孤儿 —— 场景里显示的是新模型，而所有"看"的入口
  // 拿到的还是旧形体（这就是"模型换了但观赏里没变"的原因）。
  applyExternalModel(artifact.shape, object);

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
  const { height } = ROOM;

  scene.add(new THREE.AmbientLight(0x55607a, 0.34));
  scene.add(new THREE.HemisphereLight(0xc6d8f2, 0x39312a, 0.42));

  // 平行光模拟天窗日光。房间有 48 × 80 m，固定的阴影相机精度不够，
  // 所以让光与目标点一起跟着玩家走（方向不变），阴影贴图始终对准玩家周围 ≈ 44 m 的范围。
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
  const sunOffset = new THREE.Vector3(16, 44, 24);
  sun.position.copy(sunOffset);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const focus = 22;
  sun.shadow.camera.left = -focus;
  sun.shadow.camera.right = focus;
  sun.shadow.camera.top = focus;
  sun.shadow.camera.bottom = -focus;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // 每帧把阴影相机挪到玩家附近
  const updateShadowFocus = (x, z) => {
    sun.position.set(x + sunOffset.x, sunOffset.y, z + sunOffset.z);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();
  };

  const points = [
    // 长廊
    [0, 6.2, -11, 0xdff0ff, 70],
    [0, 6.2, 11, 0xdff0ff, 70],
    // 四个侧厅
    [15, 5.2, 9, 0xffeecf, 55],
    [15, 5.2, -9, 0xffeecf, 55],
    [-15, 5.2, 9, 0xffeecf, 55],
    [-15, 5.2, -9, 0xffeecf, 55],
    // 序厅
    [-13, 7.6, 29, 0xffeecf, 70],
    [13, 7.6, 29, 0xffeecf, 70],
    // 编钟厅
    [-14, 11, -29, 0xdff0ff, 110],
    [14, 11, -29, 0xdff0ff, 110],
  ];
  for (const [x, y, z, color, intensity] of points) {
    const lamp = new THREE.PointLight(color, intensity, 42, 2);
    lamp.position.set(x, y, z);
    scene.add(lamp);
  }

  // 编钟的重点照明
  const spot = new THREE.SpotLight(0xfff3e0, 260, 34, 0.6, 0.5, 2);
  spot.position.set(0, height - 2, -29);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  scene.add(spot);
  spot.target.position.set(0, 1.8, -29);
  scene.add(spot.target);

  return { updateShadowFocus };
}

/* ================================================================== */
/* 导览图数据                                                          */
/* ================================================================== */

export const LAYOUT = {
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
  bells: [-4.99, -27.54, 4.99, -26.56, -4.99, -31.45, -4.05, -27.05],
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

  // 空间构筑件：柱子、弧形回形墙、台基、叠涩梁。
  // 设计依据见 docs/scene-layout.md（「光影长廊，楚韵洄游」）。
  const struct = createStructures({ scene, colliders, materials: materials(), tex });
  buildFrontHall(struct);
  buildZenghouyiHall(struct);
  buildBellHall(struct);
  buildBronzeHall(struct);
  buildChuHall(struct);
  buildCeramicHall(struct);
  buildCorridorBeams(struct);
  buildFunnelCalligraphy(scene, interactables);
  buildFunnelStories(scene, interactables);
  buildBellHallCorners(scene, colliders);
  buildCorridorPlanters(scene);
  buildHallSigns(scene);
  buildScrolls(scene, interactables);
  buildFortuneStand(scene, colliders, interactables);

  // 序厅：两侧长凳与花器
  buildBench(scene, colliders, -15, 22, 0);
  buildBench(scene, colliders, 15, 22, 0);
  // 长凳让开序厅的漏斗弧墙（原来在 z = 36，紧贴弧墙端头）
  buildBench(scene, colliders, -15, 31, 0);
  buildBench(scene, colliders, 15, 31, 0);
  // 花器给「展厅平面图」两侧的新展品让位（原来在 ±7.5，和展台只差 2.9 m）
  buildPlanter(scene, colliders, -11.5, 38.6);
  buildPlanter(scene, colliders, 11.5, 38.6);
  // 四条展廊只放展品，不放长凳与花器。
  // 那些陈设既挤压展品，又把展厅中央切碎——陈设只留在序厅与编钟厅。
  // 编钟厅：长凳贴两侧墙，不挡中轴与编钟
  for (const bx of [-17, 17]) buildBench(scene, colliders, bx, -22, 0);
  buildDetectiveStand(scene, colliders, interactables);
  const lighting = buildLights(scene);

  // 编钟厅：曾侯乙编钟
  const bells = buildChimeBells();
  bells.group.position.set(0, 0, -29);
  scene.add(bells.group);
  for (const collider of bells.colliders) {
    colliders.push({ ...collider, x: collider.x + bells.group.position.x, z: collider.z + bells.group.position.z });
  }
  interactables.push({
    position: new THREE.Vector3(0, 2.0, -29),
    radius: 6.2,
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
    updateShadowFocus: lighting.updateShadowFocus,
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
