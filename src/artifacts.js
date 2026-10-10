import * as THREE from 'three';
import { bumpThumbnailGeneration } from './thumbnails.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  makeBronzeTexture,
  makeLacquerTexture,
  makeMirrorTexture,
  makePorcelainTexture,
  makePotteryTexture,
  makeSlipTexture,
  makeNormalMap,
  makeRoughnessMap,
} from './textures.js';

/**
 * 由颜色贴图的画布派生出法线 / 粗糙度贴图。
 * 重复次数与颜色图保持一致，否则纹理会错位。
 */
function derived(canvas, source, kind, strength = 2) {
  const texture = new THREE.CanvasTexture(
    kind === 'normal' ? makeNormalMap(canvas, strength) : makeRoughnessMap(canvas),
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (source?.repeat) texture.repeat.copy(source.repeat);
  texture.anisotropy = 8;
  return texture;
}

/* ================================================================== */
/* 材质（全局共用的单例，减少 draw call 与显存占用）                     */
/* ================================================================== */

/**
 * 材质按「纹样变体」缓存。
 *
 * 之前所有器物共用一套青铜贴图，摆在一起纹饰完全一样，一眼就看出是同一张图。
 * 现在做 4 种纹样（云雷纹 / 兽面纹 / 蟠螭纹 / 素面带锈），
 * 每件器物按名字散列挑一种，同屏器物就不再雷同，而材质实例仍然只有 4 套。
 */
let activeVariant = 0;
const materialSets = new Map();

const variantOf = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 4;
};

export function materials() {
  const variant = activeVariant;
  if (materialSets.has(variant)) return materialSets.get(variant);

  const bronzeMap = makeBronzeTexture(variant);
  const lacquerMap = makeLacquerTexture();
  const set = {
    bronze: new THREE.MeshStandardMaterial({
      map: bronzeMap,
      normalMap: derived(bronzeMap.image, bronzeMap, 'normal', 2.6),
      roughnessMap: derived(bronzeMap.image, bronzeMap, 'rough'),
      color: 0xd6e0cd,
      metalness: 0.85,
      roughness: 1,
    }),
    patina: new THREE.MeshStandardMaterial({
      map: bronzeMap,
      normalMap: derived(bronzeMap.image, bronzeMap, 'normal', 2.6),
      roughnessMap: derived(bronzeMap.image, bronzeMap, 'rough'),
      color: 0x86a48f,
      metalness: 0.7,
      roughness: 1,
    }),
    darkBronze: new THREE.MeshStandardMaterial({
      map: bronzeMap,
      normalMap: derived(bronzeMap.image, bronzeMap, 'normal', 2.6),
      color: 0x7d8a78,
      metalness: 0.8,
      roughness: 0.55,
    }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8ae4e, metalness: 0.95, roughness: 0.24 }),
    lacquer: new THREE.MeshStandardMaterial({
      map: lacquerMap,
      normalMap: derived(lacquerMap.image, lacquerMap, 'normal', 1.8),
      roughness: 0.42,
      metalness: 0.18,
    }),
    black: new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 0.42, metalness: 0.14 }),
    red: new THREE.MeshStandardMaterial({ color: 0x9c2b24, roughness: 0.5, metalness: 0.1 }),
    jade: new THREE.MeshStandardMaterial({ color: 0xbcd8c6, metalness: 0.05, roughness: 0.2 }),
    porcelain: (() => {
      const map = makePorcelainTexture();
      return new THREE.MeshPhysicalMaterial({
        map,
        normalMap: derived(map.image, map, 'normal', 1.1),
        roughness: 0.14,
        metalness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
    })(),
    celadon: new THREE.MeshStandardMaterial({ color: 0xa9c9b8, metalness: 0.08, roughness: 0.22 }),
    pottery: (() => {
      const map = makePotteryTexture();
      return new THREE.MeshStandardMaterial({
        map,
        normalMap: derived(map.image, map, 'normal', 1.6),
        roughnessMap: derived(map.image, map, 'rough'),
        roughness: 1,
        metalness: 0.02,
      });
    })(),
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
  materialSets.set(variant, set);
  return set;
}

export const ARTIFACTS = [
  /* ---------------- 序厅（2 件） ---------------- */
  {
    shape: 'jiandu',
    name: '云梦睡虎地秦简',
    tag: '序厅 · 书写历史',
    desc: '1975 年云梦睡虎地十一号秦墓出土。一千一百多枚竹简上写着秦代的法律、巛书与日书，是第一次见到的大批秦代官方文书，也是隶书形成的实物见证。',
    pos: [-4.6, 39.0],
  },
  {
    shape: 'table',
    name: '楚式漆案与耳杯',
    tag: '序厅 · 漆器',
    desc: '矮足的漆案上摆着两只耳杯。楚人把漆器做得轻而艳：黑漆为地、朱漆为纹，一件漆耳杯只有几十克重，比铜器轻得多，也更适合拿在手里饮酒。',
    pos: [4.6, 39.0],
  },
  /* ---------------- 青铜器厅（8 件） ---------------- */
  {
    shape: 'lei',
    name: '兽面纹铜罍',
    tag: '青铜器厅 · 盛酒器',
    desc: '罍是大型盛酒器。小口、广肩、深腹、平底，肩上四个兽首衔着铜环，腹部满饰云雷纹与兽面纹。商周时「尊彝」之属各有定名，罍就是其中体量最大的一种，常与壶、缶成套出土。',
    pos: [18.8, 2.9000000000000004],
  },
  {
    shape: 'ding',
    name: '铜鼎',
    tag: '青铜器厅 · 烹煮器',
    desc: '三足两耳，鼎腹下可以举火。鼎最早是煮肉的炊具，后来变成最重要的礼器：「列鼎而食」的数目直接对应身份，天子九鼎、诸侯七鼎，以至于「问鼎」就是窥伺天下。',
    pos: [18.8, 7.3],
  },
  {
    shape: 'gui',
    name: '铜簋',
    tag: '青铜器厅 · 盛食器',
    desc: '簋用来盛黍稷。器身鼓腹、下有圈足，两侧一对兽首耳，上面还有个带圈状提手的盖。青铜礼器讲究组合，鼎与簋往往成套出土，用鼎用簋的数量共同标明墓主人的地位。',
    pos: [18.8, 11.7],
  },
  {
    shape: 'mirror',
    name: '蟠螭纹铜镜',
    tag: '青铜器厅 · 照容器',
    desc: '正面磨得光可照人，背面铸出细密的蟠螭纹与几道同心弦纹，正中是一个可以穿绳的钮。铜镜是青铜器里少见的日用器，战国楚墓中出土极多，往往与梳、笁同放在痰盒里。',
    pos: [18.8, 16.1],
  },
  {
    shape: 'hu',
    name: '嵌错纹铜壶',
    tag: '青铜器厅 · 盛酒器',
    desc: '壶用以盛酒，也可盛水。这件壶的腹部用金、银丝嵌错出宴乐、射猎的图像：人物、车马、飞鸟环壶一周，把一场战国时代的宴会绕在了器物上。',
    pos: [11.4, 2.9000000000000004],
  },
  {
    shape: 'jue',
    name: '铜爵',
    tag: '青铜器厅 · 饮酒器',
    desc: '爵是最早的青铜礼器之一：前有长流、后有尖尾，一侧一鋬，下承三足。因可直接架火加热，它既是酒器也是温酒器。',
    pos: [11.4, 7.3],
  },
  {
    shape: 'you',
    name: '铜卣',
    tag: '青铜器厅 · 盛酒器',
    desc: '卣用来盛祭祀用的香酒：器身椭圆、上有盖、口上跨一道提梁。商代的卣多铸成鸟兽形，这件是较常见的圆体卣。',
    pos: [11.4, 11.7],
  },
  {
    shape: 'pan',
    name: '铜盘',
    tag: '青铜器厅 · 盥洗器',
    desc: '盘与匜配套：匜倒水、盘接水，是先秦贵族餐前「沃盥」之礼的器具。盘腹浅而口大，双耳便于搬抬。',
    pos: [11.4, 16.1],
  },
  /* ---------------- 陶瓷厅（5 件） ---------------- */
  {
    shape: 'meiping',
    name: '元青花四爱图梅瓶',
    tag: '陶瓷厅 · 元青花',
    desc: '小口、丰肩、瘦底，腹部四面开光分别绘王羲之爱兰、陶渊明爱菊、周茂叔爱莲、林和靖爱梅。元青花人物题材存世极少，这一件因为出自明代郢靖王墓而保存完整。',
    pos: [18.8, -16.1],
  },
  {
    shape: 'lotus',
    name: '青瓷莲花尊',
    tag: '陶瓷厅 · 青瓷',
    desc: '器身堆塑多层莲瓣，釉色青中泛绿，积釉处呈现出深色的玻璃感。佛教艺术自南北朝兴起后，莲花成了瓷器上最常见的花纹，这件尊就是那时的典型器形。',
    pos: [18.8, -9.5],
  },
  {
    shape: 'li',
    name: '陶鬲',
    tag: '陶瓷厅 · 炊器',
    desc: '三个肥大的袋形足让受火面积更大，煮水做饭都很快——这是青铜鼎的陶器原型。鬲从新石器时代一直用到商周，是先秦最普通的炊具。',
    pos: [18.8, -2.9000000000000004],
  },
  {
    shape: 'bowl',
    name: '屈家岭彩陶碗',
    tag: '陶瓷厅 · 彩陶',
    desc: '碗内用黑彩画出一圈潪涡纹。屈家岭文化距今约五千年，其彩陶以薄胎、高圈足和旋转的纹样著名，是长江中游史前陶器的高峰。',
    pos: [11.4, -16.1],
  },
  {
    shape: 'figure',
    name: '彩绘陶俑',
    tag: '陶瓷厅 · 明器',
    desc: '以陶塑人形随葬，替代了更早的人殉。陶俑的衣饰与姿态，往往比文字更能说明当时的生活细节。',
    pos: [11.4, -2.9000000000000004],
  },
  /* ---------------- 曾侯乙墓厅（5 件） ---------------- */
  {
    shape: 'zunpan',
    name: '曾侯乙尊盘',
    tag: '曾侯乙墓展厅 · 酒器',
    desc: '尊与盘合为一器：尊盛酒、盘承水。口沿与盘沿上层层透雕的蟠虺纹由无数细小的铜梗焊接而成，至今难以复制，是先秦青铜铸造技术登峰造极的证据。',
    pos: [-18.8, 2.9000000000000004],
  },
  {
    shape: 'jianfou',
    name: '青铜鉴缶',
    tag: '曾侯乙墓展厅 · 冰酒器',
    desc: '方鉴之内套一缶，鉴与缶之间留出的空腔可以装冰或热水，缶中盛酒，可冰可温——它被称为「世界上最早的冰箱」。鉴身满饰蟠螭纹，四角各有一条攀附的龙。',
    pos: [-18.8, 9.5],
  },
  {
    shape: 'drumStand',
    name: '铜建鼓座',
    tag: '曾侯乙墓展厅 · 乐器',
    desc: '插放建鼓的铜座，由十六条缠绕的蟠龙构成。龙首昂起、龙尾相接，鼓插于中央的圆孔之中，敲击时整座龙群仿佛都在震动。',
    pos: [-18.8, 16.1],
  },
  {
    shape: 'deer',
    name: '彩绘漆木卧鹿',
    tag: '曾侯乙墓展厅 · 漆木器',
    desc: '一只伏卧的木鹿，鹿角用真鹿角接装，通体髾黑漆，再以朱漆绘出卷云纹。它原本是悬鼓的鼓架，也是楚人眼中沟通天地的灵兽。',
    pos: [-11.4, 2.9000000000000004],
  },
  {
    shape: 'zunVessel',
    name: '铜尊',
    tag: '曾侯乙墓展厅 · 盛酒器',
    desc: '尊是盛酒的重器：喇叭口、鼓腹、圈足，四道扉棱把器身分成四面。曾侯乙墓的尊盘正是「尊」与「盘」合为一器。',
    pos: [-11.4, 16.1],
  },
  /* ---------------- 楚文化厅（5 件） ---------------- */
  {
    shape: 'sword',
    name: '越王勾践剑',
    tag: '楚文化展厅 · 兵器',
    desc: '1965 年江陵望山一号楚墓出土。剑身满饰菱形暗格纹，近格处铸鸟篆铭文「越王鸠浅自作用剑」。出土时寒光凛冽、几乎不见锈蚀，被誉为「天下第一剑」。',
    pos: [-18.8, -16.1],
  },
  {
    shape: 'drum',
    name: '虎座鸟架鼓',
    tag: '楚文化展厅 · 乐器',
    desc: '楚国特有的悬鼓：两只昂首的凤鸟踏在卧虎背上，鼓身悬于鸟冠之间。漆器以黑为底、以红为饰，凤与虎的角力正是楚人想象中的天地秩序。',
    pos: [-18.8, -9.5],
  },
  {
    shape: 'ge',
    name: '铜戈与铜钺',
    tag: '楚文化展厅 · 兵器',
    desc: '戈是先秦最通用的长兵器，横缚在柲上，可以勾、可以喙；钺则宽大厚重，由武器演化为刑具与权力的象征，常与王权联系在一起。',
    pos: [-18.8, -2.9000000000000004],
  },
  {
    shape: 'beast',
    name: '彩绘漆木镇墓兽',
    tag: '楚文化展厅 · 木雕',
    desc: '方形的身躯上顶着一颗兽头，头插鹿角、口吐长舌。镇墓兽只出于楚墓，放在墓道两侧，作用是驱邪镇墓——它的含义至今仍无定论。',
    pos: [-11.4, -16.1],
  },
  {
    shape: 'jadeSet',
    name: '玉璧与玉琮',
    tag: '楚文化展厅 · 玉器',
    desc: '璧是天、琮是地：圆璧祭天、方琮礼地。两种玉器构成了先秦宇宙观的物质形态，也是等级最高的随葬品。',
    pos: [-11.4, -2.9000000000000004],
  },
  /* ---------------- 编钟厅（3 件） ---------------- */
  {
    shape: 'yongzhong',
    name: '青铜甬钟',
    tag: '编钟厅 · 乐器',
    desc: '编钟中的单件。舞部之上有长柄叫「甬」，甬上有环叫「旋」，悬挂时用绳索系于旋上。钟体是合瓦形而非圆形，敲击正鼓与侧鼓会发出两个不同的音。',
    pos: [-19, -25],
  },
  {
    shape: 'chunyu',
    name: '铜錞于',
    tag: '编钟厅 · 乐器',
    desc: '圆筒形的打击乐器，顶上有钮可以悬挂，敲击时声音低沉悠远。錞于常与鼓、钲同出，是军阵中节制动的最早一批「指挥乐器」。',
    pos: [19, -25],
  },
  {
    shape: 'qing',
    name: '编磬',
    tag: '编钟厅 · 乐器',
    desc: '「金石之乐」里的石，指的就是磬。石片按音高大小成组悬挂，与编钟相和，是先秦宫廷乐队的两大支柱。',
    pos: [0, -37],
  },

];


/* ================================================================== */
/* 展品故事                                                            */
/* 抽签抽到某件展品后，以打字机效果展开这些故事，文字参考相关史籍、     */
/* 考古报告与博物馆说明，供玩家在卷轴文本框里翻阅。                     */
/* ================================================================== */

export const STORIES = {
  '云梦睡虎地秦简': `1975 年冬，湖北云梦睡虎地的一处农田里，考古队员挖开了十一号秦墓。棺内没有金银，只在墓主「喜」的胸腹之间叠放着一千一百五十五枚竹简。喜是秦代安陆县的一名基层法官，他把一生经办的法律随手抄在竹简上：《秦律十八种》《法律答问》《封诊式》，还有一部一直记到秦始皇三十年的《编年记》。

《史记》说秦法严苛，「繁如秋荼」，可这些竹简上的条文却细致到田租、徭役、盗牛与审案的每一步程序。隶书的笔锋在墨迹里清晰可辨——这是中国第一次见到如此成批的秦代官方文书，秦律的真容也由此从汉人的追述里走了出来。`,

  '楚式漆案与耳杯': `《楚辞·招魂》里写楚人的宴席：「瑶浆蜜勺，实羽觞些。」羽觞就是两侧带耳、形如雀鸟展翅的耳杯，楚人用它行曲水流觞之饮。漆案矮足，杯盏就摆在伸手可及的低处，主客席地而坐，与中原的列鼎而食是两种姿态。

楚地的漆器用黑漆打底、朱漆描纹。一件耳杯不过几十克，拿在手里轻若无物，比青铜酒器省得多，也温柔得多。漆树、竹木与朱砂都出在南方，楚人于是把礼器从庙堂搬回了日常生活。`,

  '兽面纹铜罍': `《诗经·周南·卷耳》唱：「我姑酌彼金罍，维以不永怀。」金罍就是青铜罍，商周时为盛酒的大器。罍小口广肩、深腹平底，肩上四面兽首衔环，便于穿绳挪移；《周礼》所记的「六尊」，罍是其中体量最大的一种。

宴飨之上，罍与壶、缶成套陈放，用斗从罍中挹酒注入杯盏。兽面纹与云雷纹在地子上层层回旋，商人以为那是对自然力的摹写，周人则把它读成「礼」的秩序。`,

  '铜鼎': `《左传·宣公三年》记下过一个著名的场面：楚庄王陈兵洛水之滨，向周王派来的使者王孙满打听九鼎的轻重。王孙满答得不卑不亢——「周德虽衰，天命未改，鼎之轻重，未可问也。」「问鼎」从此成了觊觎天下的代名词。

鼎最初只是煮肉的炊具：三足架火，两耳穿杠。可到了商周，它的数目有了规矩——天子九鼎、诸侯七鼎、大夫五鼎。「列鼎而食」吃的不再是肉，而是身份。`,

  '铜簋': `《周礼·地官·舍人》载：「祭祀共簠簋，实之陈之。」簋用来盛黍稷稻粱，与盛肉的鼎配成一套。考古学家在诸侯墓中数出「九鼎八簋」，便能断定墓主人的等级。

这件簋鼓腹圈足，两侧一对兽耳，盖上还有圈状捉手。器内常铸铭文，记的是周王册命、赏赐车马与田地的经过。青铜器上的字，往往比器物本身更贵重——它们是传家的凭证。`,

  '蟠螭纹铜镜': `《诗经·邶风·柏舟》说：「我心匪鉴，不可以茹。」鉴就是镜子。青铜镜正面磨得光可照人，背面铸出蟠螭、弦纹与穿绳的钮，是先秦极罕见的生活用器。

战国楚墓出土的铜镜数量最多。楚人爱美，镜子往往盛在漆奁里，与梳、篦、脂粉放在一处。《楚辞·大招》写美人「曾颊倚耳，曲眉规只」，铜镜照见的正是这份讲究。`,

  '嵌错纹铜壶': `壶在《周礼》里是盛酒之器，也可以汲水。这件壶的贵重之处不在铜，而在腹壁上那些用金、银丝嵌错的图像：宴饮、射猎、采桑、飞鸟，人物车马绕壶一周，战国人的生活就这样被铸在了青铜上。

《诗经》有「约軧错衡」，说的就是这种错金银的工艺。工匠先在器表刻出凹槽，再把金丝银线嵌入捶实，最后磨平抛光。以青铜为纸、以金银为墨，后人称这类器物为「青铜上的画卷」。`,

  '元青花四爱图梅瓶': `四爱，是王羲之爱兰、陶渊明爱菊、周敦颐爱莲、林和靖爱梅。梅瓶腹部四面开光，一幅一位古人，画的是君子之志。元青花人物故事题材存世极少，这一件出自明代郢靖王墓，得以完整流传至今。

青花之蓝来自钴料。元人用舶来的「苏麻离青」，发色浓艳，积料处带铁锈斑，文献里说它从西域而来。高岭土与钴蓝在窑火中相遇，才有了中国瓷器上那抹永不褪色的蓝。`,

  '青瓷莲花尊': `佛教东传之后，莲花成了器物上最常开的花。《法华经》以莲华喻清净，南北朝的工匠便把莲瓣层层堆塑在瓷尊之身：宝装莲瓣、忍冬卷草，釉色青中泛绿，积釉处亮如玻璃。

这件尊上承南方的青瓷传统，下启隋唐的佛教造像装饰。一器之上，异域的信仰与本土的窑火合成了一朵不会凋谢的莲。`,

  '陶鬲': `《说文解字》说：「鬲，鼎属也，实五觳。」鬲有三个肥大的袋形足，中空与腹相通，架火时受热面积更大，煮水作饭都比平底器来得快。

从新石器时代到商周，鬲是使用最广的炊具，《考工记》里还专门设有「陶瓬」之职来管陶器烧造。青铜鼎的造型正是从陶鬲脱胎而来——先有灶间的日常，才有庙堂上的礼器。`,

  '屈家岭彩陶碗': `屈家岭文化距今约五千年，得名于湖北京山屈家岭。这里的先民把陶土淘洗得细净，拉出薄薄的胎，再以黑彩在碗内画出旋转的漩涡。

那时长江中游与黄河流域的彩陶遥相呼应：仰韶画鱼纹，大汶口画八角，屈家岭画旋纹。一条大江把史前的审美连成网络，这只碗就是网络上的一个结。`,

  '曾侯乙尊盘': `1978 年，随州擂鼓墩的驻军在扩建营房时炸出了一座战国大墓，墓主是曾国国君乙。曾侯乙尊盘的出土，让冶金史家过了很久才敢相信自己的眼睛：口沿与盘沿上层层透雕的蟠虺纹，竟是由无数细小的铜梗分别铸出、再焊接成形的。

这种失蜡法铸造的透空附饰，至今难以原样复制。同墓出土的编钟铭文记录着完整的乐律，而尊盘则把先秦工匠的手艺推到了极限——一个负责声，一个负责形。`,

  '青铜鉴缶': `《周礼·天官·凌人》记：「春始治鉴，凡外内饔之膳羞鉴焉。」鉴是盛水的大器。曾侯乙的这件鉴里还套着一只缶，鉴与缶之间的空腔可以填冰，也可以注热水，缶中盛酒，冬温而夏冰。

它被称为世界上最早的冰箱。方鉴四角攀附着探首的龙，龙身与器表的蟠螭纹连成一片。实用与礼制、巧思与威严，都装在这只方形的青铜匣子里。`,

  '铜建鼓座': `建鼓是先秦军旅与祭祀中的重器，《周礼》有「鼓人」之职掌教六鼓。这支鼓座由十六条缠绕的蟠龙纠结而成，龙首相向昂起，中央留出圆孔，鼓柱自孔中穿过。

曾侯乙墓出土的乐器有编钟、编磬、鼓、瑟、笙、箫，宛如一支埋在地下的乐队。鼓座上的群龙在震动中仿佛一同苏醒——古人给声音也造了身体。`,

  '彩绘漆木卧鹿': `鹿在楚人的想象里是通灵的兽。《山海经》与《楚辞》中，鹿或为神人坐骑，或为祥瑞之兆。这只木鹿伏卧回首，鹿角用真鹿角接装，通体髹黑漆，又以朱漆绘出卷云纹。

它原本是悬鼓的鼓架：鼓挂在鹿背上，击之则鹿身随之轻响。楚墓中常见这样的漆木鼓架，虎、鸟、鹿都是主角，天地人神的关系被安排在一件乐器上。`,

  '越王勾践剑': `《越绝书》记欧冶子铸剑，「采五山之铁精，六合之金英」；《吴越春秋》则写干将莫邪夫妇投身炉中。吴越之剑名重天下，1965 年，江陵望山一号楚墓里出土的这一柄，让文献有了实物。

剑身满饰菱形暗格纹，近格处铸鸟篆铭文八字——「越王鸠浅自作用剑」。鸠浅即勾践。剑出土时寒光凛冽、几乎不见锈蚀，检测发现其表面有一层含硫的防锈层。楚墓中为何陪葬越王剑？或与楚越联姻有关，或与战争缴获有关，至今引人猜想。`,

  '虎座鸟架鼓': `楚人尚凤。虎座鸟架鼓以两只昂首长鸣的凤鸟踏在卧虎之背，鼓身悬于双鸟的冠颈之间，通体黑漆为地、朱漆为纹。凤在上、虎在下，正是楚人心中天地尊卑的秩序。

这类鼓只出于楚墓，是楚国特有的乐器，也是楚文化的标志性器物。楚人相信凤能引魂升天，鼓声则是沟通人神的语言；一曲之始，先要请神到场。`,

  '铜戈与铜钺': `《尚书·牧誓》记周武王伐纣，临阵下令：「称尔戈，比尔干，立尔矛。」戈是先秦最通用的长兵器：横缚在柲上，可以勾啄，也可以推挡，是车战时代的主角。《考工记》甚至细到规定戈柲的长短。

钺由斧发展而来，宽大厚重。《史记》说「汤自把钺以伐昆吾」，钺于是从武器变成了王权的象征——持钺者，掌征伐。`,

  '彩绘漆木镇墓兽': `镇墓兽只出于楚墓，通常成对放在墓道两侧。它方形身躯上顶着一颗兽头，头插鹿角，口吐长舌，通体黑漆朱绘，面目介于人、兽与神之间。

《楚辞·招魂》写墓地「蝮蛇蓁蓁，封狐千里」，楚人因此要在墓中设下镇守之物。这尊兽究竟代表什么，是山神、土伯，还是引魂的巫觋？两千多年来众说纷纭，没有定论——它至今仍是一道留给后人的谜。`,

  '青铜甬钟': `《考工记》说：「钟县谓之旋，旋虫谓之干。」甬钟顶部有长柄称「甬」，甬上有环称「旋」，悬挂时绳索系于旋上。钟体作合瓦形而非圆形，敲击正鼓与侧鼓会得到两个不同的音。

曾侯乙编钟共六十五件，钟体与钟枚上铸有三千七百余字铭文，记下曾、楚、齐、晋等国的乐律名称。一钟双音、音域跨五个半八度，一套钟就是一部先秦乐理教科书。`,

  '铜錞于': `《周礼·地官·鼓人》载：「以金錞和鼓。」錞于是圆筒形的打击乐器，顶上有钮可系绳悬挂，以木槌敲击，声低沉而悠远。

《国语》记吴王夫差「鸣钟鼓、丁宁、錞于」，可见它常与鼓、钲同用于军阵，用来节制进退。当战鼓催阵、錞于应和，整支军队的脚步便落在同一个节拍上。`,
};

/** 取某件展品的故事，缺省时退回简介 */
export function artifactStory(artifact) {
  return STORIES[artifact?.name] ?? artifact?.desc ?? '';
}

/** 每个部件都投影 */
function mesh(geometry, material, position, rotation) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

const lathe = (points, segments = 64) =>
  new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/** 合瓦形钟体：纵剖面绕轴旋转后再把 z 压扁 */
export function makeBellGeometry(height, width = 1) {
  const profile = [
    [0.03, 0], [0.34, 0], [0.35, 0.05], [0.29, 0.11], [0.27, 0.3],
    [0.25, 0.55], [0.22, 0.75], [0.2, 0.88], [0.185, 0.94], [0.12, 0.99], [0.03, 1],
  ];
  const geometry = lathe(profile, 24);
  geometry.scale(width, height, 0.62 * width);
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
  group.add(mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.14, 56), m.bronze, [0, 0.32, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.5, 0.03, 14, 64), m.patina, [0, 0.4, 0], [Math.PI / 2, 0, 0]));
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
  group.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.34, 40), m.patina, [0, 0.62, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 40), m.bronze, [0, 0.8, 0]));
  return group;
}

/** 彩绘漆木卧鹿 */
function shapeDeer() {
  const m = materials();
  const group = new THREE.Group();
  const body = m.black;
  group.add(mesh(new THREE.CapsuleGeometry(0.15, 0.3, 6, 16), body, [0, 0.2, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 14), body, [0.24, 0.36, 0], [0, 0, -0.6]));
  // 头：颅骨 + 吻部 + 鼻头 + 双耳 + 双眼。原来只是一个圆锥，完全看不出是鹿。
  const skull = mesh(new THREE.SphereGeometry(0.072, 20, 16), m.red);
  skull.scale.set(1.15, 1, 0.85);
  skull.position.set(0.34, 0.475, 0);
  group.add(skull);

  const muzzle = mesh(new THREE.CylinderGeometry(0.034, 0.056, 0.14, 16), body);
  muzzle.rotation.z = Math.PI / 2 - 0.4;
  muzzle.position.set(0.435, 0.442, 0);
  group.add(muzzle);

  const nose = mesh(new THREE.SphereGeometry(0.03, 14, 12), body);
  nose.scale.set(1, 0.8, 1);
  nose.position.set(0.492, 0.418, 0);
  group.add(nose);

  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.03, 0.09, 12), body);
    ear.position.set(0.302, 0.545, side * 0.052);
    ear.rotation.set(side * 0.55, 0, 0.42);
    group.add(ear);

    const eye = mesh(new THREE.SphereGeometry(0.015, 12, 10), m.gold);
    eye.position.set(0.385, 0.492, side * 0.052);
    group.add(eye);
  }
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

/**
 * 铜建鼓座：十六条蟠龙盘绕。
 *
 * 之前是 8 个圆柱 + 8 个圆锥从底座上杵出来，看着就是一堆浮空的锥子。
 * 现在每条龙用 TubeGeometry 沿一条空间螺旋曲线生成——龙身真的绕着底座盘上去，
 * 末端接龙首（吻部 + 双目 + 双角 + 下颚），起端收成尾尖。
 * 既保留了低多边形的轮廓感，又有能看出「龙」的细节。
 */
function shapeDrumStand() {
  const m = materials();
  const group = new THREE.Group();

  // 底座与承鼓的圆筒
  group.add(mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.18, 48), m.bronze, [0, 0.09, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.62, 0.045, 12, 56), m.patina, [0, 0.19, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.52, 32), m.darkBronze, [0, 0.45, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.2, 0.032, 10, 32), m.gold, [0, 0.72, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), m.patina, [0, 0.12, 0]));

  const DRAGONS = 16;
  for (let i = 0; i < DRAGONS; i += 1) {
    const a0 = (i / DRAGONS) * Math.PI * 2;
    const dir = i % 2 === 0 ? 1 : -1;       // 相邻两条反向盘绕，互相缠绕
    const climb = 0.5 + (i % 4) * 0.06;     // 各条龙高度略有差别，避免整齐得像齿轮

    // 螺旋曲线：半径逐渐收小、高度逐渐升高
    const points = [];
    for (let k = 0; k <= 7; k += 1) {
      const u = k / 7;
      const angle = a0 + dir * u * Math.PI * 1.25;
      const radius = 0.5 - u * 0.14 + Math.sin(u * Math.PI) * 0.08;
      const y = 0.16 + u * climb;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.042, 8, false), m.patina);
    body.castShadow = true;
    group.add(body);

    // 尾尖：把龙身起点收成尖
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.16, 8), m.patina);
    tail.position.copy(curve.getPointAt(0));
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(0).negate());
    group.add(tail);

    // 龙首：位于曲线末端，朝向切线方向
    const end = curve.getPointAt(1);
    const tangent = curve.getTangentAt(1).normalize();
    const head = new THREE.Group();
    head.position.copy(end);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const skull = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.19, 10), m.bronze);
    skull.rotation.x = Math.PI / 2;
    skull.position.z = 0.06;
    skull.castShadow = true;
    head.add(skull);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.13), m.darkBronze);
    jaw.position.set(0, -0.045, 0.1);
    head.add(jaw);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), m.gold);
      eye.position.set(side * 0.042, 0.026, 0.075);
      head.add(eye);

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.1, 8), m.bronze);
      horn.position.set(side * 0.038, 0.075, 0.01);
      horn.rotation.set(-0.5, 0, side * 0.35);
      head.add(horn);

      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.11, 6), m.gold);
      whisker.position.set(side * 0.03, -0.01, 0.16);
      whisker.rotation.set(1.1, 0, side * 0.2);
      head.add(whisker);
    }
    group.add(head);
  }
  return group;
}

/**
 * 虎座鸟架鼓（照湖北省博物馆藏实物照片重做）：
 * 长条漆木底板 → 两只「背向」蹲伏的虎（头朝外昂起）→ 虎背上各立一只凤鸟，
 * 长颈向中间上举、长喙相对 → 鼓面朝前，用绳吊在两只凤鸟颈前。
 * 整体左右镜像对称，黑漆为底、红漆为彩。
 */
function shapeDrum() {
  const m = materials();
  const group = new THREE.Group();

  // —— 底板：薄长条；前沿一道红漆带，下面挂两只铜环
  group.add(mesh(new THREE.BoxGeometry(1.62, 0.06, 0.36), m.black, [0, 0.03, 0]));
  group.add(mesh(new THREE.BoxGeometry(1.64, 0.018, 0.05), m.red, [0, 0.062, 0.16]));
  for (const x of [-0.5, 0.5]) {
    group.add(mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), m.gold, [x, 0.02, 0.19], [Math.PI / 2, 0, 0]));
  }

  for (const side of [-1, 1]) {
    const bx = side * 0.43;

    // —— 蹲伏的虎：身躯低长、头朝外昂起、尾在里侧上卷
    group.add(mesh(new THREE.BoxGeometry(0.62, 0.19, 0.25), m.black, [bx, 0.2, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.27), m.red, [bx, 0.3, 0]));      // 背脊红漆
    group.add(mesh(new THREE.BoxGeometry(0.08, 0.17, 0.1), m.black, [bx + side * 0.23, 0.1, 0.08]));
    group.add(mesh(new THREE.BoxGeometry(0.08, 0.17, 0.1), m.black, [bx + side * 0.23, 0.1, -0.08]));
    group.add(mesh(new THREE.BoxGeometry(0.17, 0.11, 0.12), m.black, [bx - side * 0.22, 0.09, 0.07]));
    group.add(mesh(new THREE.BoxGeometry(0.17, 0.11, 0.12), m.black, [bx - side * 0.22, 0.09, -0.07]));
    // 虎头朝外：吻、立耳、双目、斑纹
    group.add(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.17), m.black, [bx + side * 0.34, 0.36, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.11, 0.075, 0.12), m.black, [bx + side * 0.46, 0.34, 0]));
    for (const dz of [-0.06, 0.06]) {
      group.add(mesh(new THREE.ConeGeometry(0.032, 0.075, 6), m.red, [bx + side * 0.32, 0.46, dz]));
      group.add(mesh(new THREE.SphereGeometry(0.021, 10, 8), m.gold, [bx + side * 0.42, 0.4, dz]));
    }
    for (const dx of [-0.11, 0.04]) {
      group.add(mesh(new THREE.BoxGeometry(0.03, 0.19, 0.26), m.red, [bx + dx, 0.2, 0]));
    }
    // 卷尾：自里侧向上卷成 S。
    // 原来卷到 x=±0.08、y=0.50 —— 那里离鼓轴只有 0.231，而鼓半径 0.36，
    // 整条尾巴插在鼓肚子里（实测间隙 -0.129）。改成只卷到 0.16、高度压在
    // 鼓底 0.46 以下，并收小一圈。
    group.add(mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.16, 8), m.black, [bx - side * 0.28, 0.3, 0], [0, 0, side * 0.5]));
    group.add(mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 16, Math.PI * 1.4), m.red, [bx - side * 0.27, 0.38, 0], [0, 0, side * -0.5]));

    // —— 凤鸟：双腿立在虎背，长颈贴着鼓两侧竖直上行，头在鼓的上方向内转。
    // 鸟的中轴比虎外移 0.05（bxB）：颈半径 0.076、鼓半径 0.36，
    // 若鸟心仍在 0.43 则颈内侧面只到 0.354 —— 必然探进鼓里（实测 -0.026）。
    const bxB = side * 0.48;
    for (const dz of [-0.07, 0.07]) {
      group.add(mesh(new THREE.CylinderGeometry(0.016, 0.021, 0.2, 8), m.red, [bxB, 0.42, dz]));
      group.add(mesh(new THREE.ConeGeometry(0.03, 0.06, 6), m.gold, [bxB + side * 0.04, 0.33, dz], [0, 0, side * -1.5]));
    }
    const torso = mesh(new THREE.SphereGeometry(0.15, 18, 12), m.black, [bxB, 0.58, 0]);
    torso.scale.set(0.82, 1.05, 0.85);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.21, 0.1, 0.2), m.red, [bxB, 0.62, 0]));       // 胸腹红漆
    for (const dz of [-1, 1]) {
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.25, 0.05), m.black, [bxB + side * 0.07, 0.56, dz * 0.12], [0, 0, side * 0.32]));
    }
    // 长颈：两段几乎竖直上举。
    // 原来写成「越往中间越向内」，第二段内收到 x=±0.27 —— 而鼓半径 0.36，
    // 这一段必然插进鼓身里。实物是颈贴着鼓两侧上去、只有头转到鼓上方。
    group.add(mesh(new THREE.CylinderGeometry(0.05, 0.076, 0.42, 12), m.black, [bxB, 0.86, 0], [0, 0, side * 0.04]));
    group.add(mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.36, 12), m.black, [bxB - side * 0.02, 1.18, 0], [0, 0, side * 0.1]));
    // 鸟首：升到鼓的上方才向内；喙朝内上，两只喙尖之间留出 0.3 的空档
    group.add(mesh(new THREE.SphereGeometry(0.075, 14, 10), m.black, [bxB - side * 0.08, 1.36, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.026, 0.16, 8), m.gold, [bxB - side * 0.2, 1.4, 0], [0, 0, side * 1.1]));
    group.add(mesh(new THREE.BoxGeometry(0.06, 0.055, 0.04), m.red, [bxB - side * 0.08, 1.45, 0], [0, 0, side * 0.2]));
    for (const dz of [-0.05, 0.05]) {
      group.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), m.gold, [bxB - side * 0.04, 1.38, dz]));
    }
  }

  // —— 鼓：鼓面朝前（轴向 z），吊在两只凤鸟颈前
  // 鼓半径 0.36、鼓心降到 0.82：上缘 1.18 低于鸟首底面 1.285，净空 0.1
  group.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 36), m.wood, [0, 0.82, 0], [Math.PI / 2, 0, 0]));
  for (const z of [-0.15, 0.15]) {
    group.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.035, 36), m.black, [0, 0.82, z + Math.sign(z) * 0.017], [Math.PI / 2, 0, 0]));
    group.add(mesh(new THREE.TorusGeometry(0.36, 0.02, 8, 40), m.red, [0, 0.82, z]));
  }
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    for (const z of [-0.18, 0.18]) {
      group.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), m.gold, [Math.cos(a) * 0.32, 0.82 + Math.sin(a) * 0.32, z]));
    }
  }
  // 吊绳与鸟爪
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), m.wood, [side * 0.3, 1.16, 0], [0, 0, side * 0.85]));
    // 鸟爪：爪子抓在鼓边，所以几何上要贴着鼓（半径 0.36）而不能探进去。
    // 原来放在 x=±0.37，AABB 内侧角到 0.272，比鼓边进 0.088 —— 实测相交 -0.026。
    group.add(mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.17, 6), m.gold, [side * 0.43, 0.85, 0], [0, 0, side * 0.5]));
  }
  return group;
}

/** 越王勾践剑：菱形剑身起脊 + 兽面剑格 + 缠缑剑茎 + 同心圆剑首 */
function shapeSword() {
  const m = materials();
  const group = new THREE.Group();
  const FLAT = 0.34;   // 剑身的压扁系数：菱形截面压扁后两条侧棱就是刃口，上下两个尖即脊线

  // 剑身：四棱锥台压扁。仪式用剑，剑身取 0.95 m，接近人肩到指尖的长度，
  // 比原来 0.62 m 的“短匕”尺度更能读出长兵的气势。
  const blade = mesh(new THREE.CylinderGeometry(0.014, 0.046, 0.95, 4), m.steel, [0, 0.61, 0]);
  blade.scale.z = FLAT;
  group.add(blade);
  // 剑尖：继续收成一点，和剑身同截面，不会出现接缝
  const tip = mesh(new THREE.CylinderGeometry(0.0015, 0.014, 0.17, 4), m.steel, [0, 1.17, 0]);
  tip.scale.z = FLAT;
  group.add(tip);

  // 铭文：近格处一道深色嵌线，暗示「越王鸠浅自作用剑」那一行鸟虫书
  group.add(mesh(new THREE.BoxGeometry(0.054, 0.088, 0.028), m.black, [0, 0.2, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.004, 0.084, 0.006), m.gold, [side * 0.018, 0.2, 0.014]));
  }

  // 剑格：两端外撇，做成兽面，正中嵌一块绿松石
  group.add(mesh(new THREE.BoxGeometry(0.21, 0.055, 0.058), m.bronze, [0, 0.105, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.05, 10), m.bronze, [side * 0.088, 0.105, 0], [0, 0, side * 0.5]));
    group.add(mesh(new THREE.SphereGeometry(0.011, 10, 8), m.gold, [side * 0.046, 0.105, 0.028]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.05, 0.032, 0.066), m.celadon, [0, 0.105, 0]));

  // 剑茎：圆柱 + 三道缠缑
  group.add(mesh(new THREE.CylinderGeometry(0.023, 0.026, 0.17, 16), m.black, [0, 0.0, 0]));
  for (const y of [-0.06, -0.008, 0.044]) {
    group.add(mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 18), m.gold, [0, y, 0], [Math.PI / 2, 0, 0]));
  }

  // 剑首：圆盘 + 三道同心圆（实物上有十一圈，这里取三圈就足以读到）
  group.add(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 28), m.bronze, [0, -0.1, 0]));
  for (let i = 0; i < 3; i += 1) {
    group.add(mesh(
      new THREE.TorusGeometry(0.018 + i * 0.011, 0.0035, 6, 22), m.gold,
      [0, -0.089, 0], [Math.PI / 2, 0, 0],
    ));
  }
  return group;
}

/** 彩绘漆木镇墓兽：鹿角、凸目、吐舌、前肢抱蛇 */
function shapeBeast() {
  const m = materials();
  const group = new THREE.Group();

  // 方座：下红上黑，楚漆器最常见的两层台
  group.add(mesh(new THREE.BoxGeometry(0.42, 0.07, 0.36), m.red, [0, 0.035, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.46, 0.028, 0.4), m.black, [0, 0.084, 0]));

  // 身躯：六棱柱，比方盒子更像整木雕出来的
  const body = mesh(new THREE.CylinderGeometry(0.14, 0.185, 0.44, 6), m.black, [0, 0.32, 0]);
  body.rotation.y = Math.PI / 6;
  group.add(body);
  group.add(mesh(new THREE.BoxGeometry(0.3, 0.085, 0.29), m.red, [0, 0.42, 0.008]));   // 胸前朱带
  group.add(mesh(new THREE.BoxGeometry(0.27, 0.05, 0.26), m.red, [0, 0.24, 0.008]));   // 腹下朱带

  // 前肢：向前屈出，爪间抱一条蛇
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.085, 0.3, 0.1), m.red, [side * 0.135, 0.3, 0.11], [0.42, 0, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.1, 0.075, 0.15), m.black, [side * 0.135, 0.15, 0.25]));
  }
  const snake = mesh(new THREE.TorusGeometry(0.1, 0.016, 6, 20), m.red, [0, 0.145, 0.29], [Math.PI / 2, 0, 0]);
  snake.scale.set(1, 1, 0.6);
  group.add(snake);

  // 头：方颅 + 凸目 + 吐舌 + 撩牙
  group.add(mesh(new THREE.BoxGeometry(0.26, 0.22, 0.24), m.black, [0, 0.6, 0.03]));
  group.add(mesh(new THREE.BoxGeometry(0.28, 0.045, 0.26), m.red, [0, 0.7, 0.03]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), m.gold, [side * 0.1, 0.63, 0.15]));
    group.add(mesh(new THREE.ConeGeometry(0.022, 0.07, 8), m.wood, [side * 0.07, 0.52, 0.15], [Math.PI, 0, 0]));
  }
  group.add(mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2), m.red, [0, 0.52, 0.19], [0.5, 0, 0]));

  // 鹿角：每侧一主枝 + 三支分叉——镇墓兽最认得出的就是这对角
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.34, 7), m.wood, [side * 0.09, 0.86, 0.0], [0.1, 0, side * 0.34]));
    for (let i = 0; i < 3; i += 1) {
      group.add(mesh(
        new THREE.CylinderGeometry(0.008, 0.013, 0.18, 6), m.wood,
        [side * (0.15 + i * 0.06), 0.93 + i * 0.075, -0.02 + i * 0.03],
        [0.2, 0, side * (0.75 + i * 0.25)],
      ));
    }
  }
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
  group.add(mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 40), m.patina, [0, 0.98, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 40), m.patina, [0, 1.03, 0]));
  // 四耳衔环
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 22), m.darkBronze, [Math.cos(a) * 0.32, 0.66, Math.sin(a) * 0.32], [0, -a, 0]));
  }
  return group;
}

/**
 * 铜鼎：三只兽蹄足 + 双立耳 + 三面扉棱。
 * 原来足的上下半径只差 1cm，看着又细又直，像随时会断；现在做出蹄形：
 * 根部粗、中间收、末端外撇成蹄，并加一块裹足的兽面。
 */
function shapeDing() {
  const m = materials();
  const group = new THREE.Group();

  const body = mesh(lathe([[0.001, 0], [0.2, 0], [0.32, 0.15], [0.36, 0.32], [0.34, 0.44], [0.3, 0.48]]), m.bronze);
  body.material.side = THREE.DoubleSide;
  group.add(body);

  // 口沿与腹部纹带
  group.add(mesh(new THREE.TorusGeometry(0.31, 0.03, 12, 44), m.darkBronze, [0, 0.48, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.35, 0.022, 10, 44), m.patina, [0, 0.2, 0], [Math.PI / 2, 0, 0]));

  // 三只兽蹄足
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(a) * 0.24;
    const cz = Math.sin(a) * 0.24;
    const leg = new THREE.Group();
    leg.position.set(cx, 0, cz);
    leg.rotation.y = -a;

    leg.add(mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.2, 16), m.bronze, [0, -0.06, 0]));
    leg.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.16, 16), m.bronze, [0, -0.22, 0]));
    // 兽面裹足
    leg.add(mesh(new THREE.ConeGeometry(0.085, 0.13, 12), m.darkBronze, [0, -0.05, 0.01], [0.25, 0, 0]));
    // 蹄
    leg.add(mesh(new THREE.CylinderGeometry(0.062, 0.08, 0.09, 18), m.bronze, [0, -0.34, 0]));
    leg.add(mesh(new THREE.SphereGeometry(0.062, 18, 14), m.patina, [0, -0.39, 0]));
    group.add(leg);

    // 三面扉棱
    const flange = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), m.darkBronze, [Math.cos(a) * 0.35, 0.24, Math.sin(a) * 0.35], [0, -a, 0]);
    group.add(flange);
  }

  // 双立耳：拱形，两端与口沿咬合
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.075, 0.024, 12, 28, Math.PI), m.bronze, [side * 0.2, 0.48, 0], [0, Math.PI / 2, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), m.bronze, [side * 0.225, 0.44, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), m.bronze, [side * 0.175, 0.44, 0]));
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
  group.add(mesh(new THREE.TorusGeometry(0.31, 0.025, 8, 44), m.darkBronze, [0, 0.4, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(lathe([[0.001, 0], [0.29, 0], [0.24, 0.16], [0.12, 0.24]]), m.darkBronze, [0, 0.4, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 20), m.bronze, [0, 0.68, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 40), m.patina, [0, -0.04, 0]));
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
  group.add(mesh(new THREE.SphereGeometry(0.035, 20, 14), m.gold, [0, 1.02, 0]));
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
  group.add(mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 40), m.patina, [0, 0.9, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.24, 0.016, 8, 44), m.gold, [0, 0.34, 0], [Math.PI / 2, 0, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), m.darkBronze, [side * 0.24, 0.62, 0], [0, Math.PI / 2, 0]));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 40), m.patina, [0, 0.02, 0]));
  return group;
}

/** 铜戈与铜钺：戈分援、胡、内、穿；钺有厚刃与銎 */
function shapeGe() {
  const m = materials();
  const group = new THREE.Group();

  // —— 戈：横置。援起脊、前锋收尖，胡下垂，内在后段，柲穿銎而过
  const geY = 0.66;
  const yuan = mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.5, 4), m.bronze, [-0.02, geY, 0], [0, 0, Math.PI / 2]);
  yuan.scale.z = 0.3;
  group.add(yuan);
  const front = mesh(new THREE.CylinderGeometry(0.001, 0.012, 0.14, 4), m.bronze, [0.3, geY, 0], [0, 0, Math.PI / 2]);
  front.scale.z = 0.3;
  group.add(front);
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.17, 0.016), m.bronze, [0.17, geY - 0.1, 0]));   // 胡
  group.add(mesh(new THREE.BoxGeometry(0.2, 0.075, 0.016), m.bronze, [-0.36, geY, 0]));       // 内
  group.add(mesh(new THREE.BoxGeometry(0.05, 0.02, 0.028), m.black, [-0.4, geY, 0]));          // 穿
  group.add(mesh(new THREE.CylinderGeometry(0.027, 0.03, 1.05, 12), m.wood, [-0.06, 0.47, 0.03]));

  // —— 钺：扁平宽刃 + 刃口加厚，中穿銎，柲自上而下穿过
  const yueY = 0.34;
  group.add(mesh(new THREE.BoxGeometry(0.46, 0.28, 0.022), m.patina, [0, yueY, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.3, 0.055, 0.028), m.patina, [0, yueY + 0.15, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.046, 0.052, 0.16, 12), m.patina, [0, yueY, 0]));
  for (const y of [yueY - 0.05, yueY + 0.05]) {
    group.add(mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), m.gold, [0, y, 0], [Math.PI / 2, 0, 0]));
  }
  group.add(mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.62, 12), m.wood, [0, yueY - 0.12, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.92, 0.06, 0.32), m.black, [0, 0.03, 0]));
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

/** 玉璧与玉琮：璧立木座、双面谷纹；琮分三节带纹、中穿孔 */
function shapeJadeSet() {
  const m = materials();
  const group = new THREE.Group();

  // 玉璧：一面一圈谷纹，内外缘起圆棱；立起来看得见正面
  const bi = new THREE.Group();
  const disc = mesh(lathe([[0.11, 0], [0.3, 0], [0.3, 0.04], [0.11, 0.04], [0.11, 0]]), m.jade);
  disc.material.side = THREE.DoubleSide;
  bi.add(disc);
  for (const y of [0.005, 0.035]) {
    bi.add(mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 36), m.jade, [0, y, 0], [Math.PI / 2, 0, 0]));
    bi.add(mesh(new THREE.TorusGeometry(0.255, 0.012, 6, 40), m.jade, [0, y, 0], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2;
      bi.add(mesh(new THREE.SphereGeometry(0.013, 8, 6), m.jade, [Math.cos(a) * 0.196, y, Math.sin(a) * 0.196]));
    }
  }
  bi.position.set(-0.19, 0.58, 0);
  bi.rotation.z = Math.PI / 2;   // 立起来
  group.add(bi);
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.42), m.black, [-0.19, 0.27, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.36, 0.05, 0.46), m.black, [-0.19, 0.03, 0]));

  // 玉琮：方筒分三节，每节四角凸出节饰，中穿孔
  const cx = 0.24;
  for (let i = 0; i < 3; i += 1) {
    const y = 0.12 + i * 0.15;
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2;
      group.add(mesh(new THREE.BoxGeometry(0.3, 0.13, 0.06), m.jade, [cx + Math.cos(a) * 0.135, y, Math.sin(a) * 0.135], [0, -a, 0]));
    }
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      group.add(mesh(new THREE.BoxGeometry(0.07, 0.13, 0.07), m.jade, [cx + Math.cos(a) * 0.19, y, Math.sin(a) * 0.19], [0, -a, 0]));
    }
  }
  group.add(mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), m.jade, [cx, 0.56, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), m.jade, [cx, 0.035, 0]));
  group.add(mesh(new THREE.CircleGeometry(0.1, 24), m.black, [cx, 0.588, 0], [-Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.92, 0.05, 0.5), m.black, [0.06, 0.008, 0]));
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
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.03, 44), m.celadon, [0, 0.015, 0]));
  return group;
}

/** 青瓷莲花尊 */
/** 青瓷莲花尊：口沿外撇、腹饰三层仰莲、颈饰小莲、下承喇叭形圈足、上有宝珠盖 */
function shapeLotusZun() {
  const m = materials();
  const group = new THREE.Group();

  // 器身：一次旋成。口沿外撇、束颈、鼓腹、下收为喇叭形高圈足
  const body = mesh(
    lathe([
      [0.01, 0], [0.16, 0], [0.19, 0.04], [0.17, 0.09], [0.13, 0.14],
      [0.16, 0.22], [0.22, 0.32], [0.26, 0.42], [0.25, 0.52], [0.2, 0.62],
      [0.15, 0.7], [0.16, 0.76], [0.2, 0.82], [0.19, 0.85],
    ]),
    m.celadon,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);

  /**
   * 一圈莲瓣。每片用一个只绕 y 转的 holder 定位，瓣自己只绕 z 倾——
   * 不用手写欧拉角三元组。原来那句 [-sin(a)*0.5, -a, cos(a)*0.5]
   * 把绕轴与倾斜搞在一起，每片瓣的倒向都不一样，远看是乱的。
   * scale.x 压扁：瓣的法向朝外（径向薄、切向宽），压扁的必须是 x 不是 z。
   */
  const tier = (y, radius, count, w, h, tilt) => {
    for (let i = 0; i < count; i += 1) {
      const holder = new THREE.Group();
      holder.rotation.y = -(i / count) * Math.PI * 2;
      const petal = mesh(new THREE.ConeGeometry(w, h, 6), m.celadon, [radius, y, 0], [0, 0, -tilt]);
      petal.scale.x = 0.42;
      holder.add(petal);
      group.add(holder);
    }
  };
  // 腹：三层仰莲，自下而上逐层收小，瓣尖一律朝上外
  tier(0.3, 0.27, 14, 0.1, 0.2, 0.52);
  tier(0.44, 0.29, 14, 0.1, 0.2, 0.46);
  tier(0.57, 0.25, 12, 0.09, 0.17, 0.4);
  // 颈：一圈小莲瓣
  tier(0.72, 0.18, 10, 0.06, 0.11, 0.3);
  // 圈足：一圈倒莲，向外张得更开
  tier(0.1, 0.19, 12, 0.07, 0.1, 0.7);

  // 弦纹：层与层交界处一道凸棱，把莲瓣分开读
  for (const [y, r] of [[0.4, 0.25], [0.53, 0.25], [0.65, 0.185]]) {
    group.add(mesh(new THREE.TorusGeometry(r, 0.008, 6, 32), m.celadon, [0, y, 0], [Math.PI / 2, 0, 0]));
  }
  // 口沿：外撇的一圈厚唇
  group.add(mesh(new THREE.TorusGeometry(0.195, 0.018, 8, 32), m.celadon, [0, 0.85, 0], [Math.PI / 2, 0, 0]));

  // 盖：覆钵 + 宝珠钮
  group.add(mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.celadon, [0, 0.87, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 24), m.celadon, [0, 0.94, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), m.celadon, [0, 1.02, 0]));
  return group;
}

/** 陶鬲：三袋足 */
function shapeLi() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(lathe([[0.001, 0], [0.18, 0.02], [0.28, 0.24], [0.3, 0.4], [0.26, 0.5]]), m.pottery);
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 40), m.clay, [0, 0.5, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    group.add(mesh(new THREE.SphereGeometry(0.13, 24, 18), m.pottery, [Math.cos(a) * 0.16, 0.12, Math.sin(a) * 0.16]));
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
/** 彩绘陶俑：束发、交领长袍、拱手而立 */
function shapeFigure() {
  const m = materials();
  const group = new THREE.Group();

  // 方座
  group.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 16), m.clay, [0, 0.03, 0]));

  // 长袍：下摆外撇、腰收、肩窄，一次旋成
  const robe = mesh(
    lathe([
      [0.01, 0], [0.15, 0], [0.16, 0.04], [0.14, 0.14], [0.115, 0.3],
      [0.1, 0.42], [0.085, 0.5], [0.06, 0.56], [0.03, 0.58],
    ]),
    m.clay,
  );
  robe.material.side = THREE.DoubleSide;
  group.add(robe);

  // 彩绘：下摆一道朱色宽边、腰上一道黑带、胸前一道斜的交领
  group.add(mesh(new THREE.TorusGeometry(0.152, 0.012, 6, 24), m.red, [0, 0.06, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 22), m.black, [0, 0.4, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.075, 0.022, 0.13), m.red, [0, 0.46, 0.03], [0, 0, 0.45]));

  // 双臂：自肩垂下，袖口略宽，双手拱于胸前
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.28, 10), m.clay, [side * 0.095, 0.4, 0], [0, 0, side * 0.16]));
    group.add(mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.06, 10), m.clay, [side * 0.07, 0.27, 0.05], [0.5, 0, side * 0.3]));
  }
  group.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), m.clay, [0, 0.3, 0.075]));

  // 头：椭球 + 双耳 + 双睛 + 发鬏
  const head = mesh(new THREE.SphereGeometry(0.072, 20, 16), m.clay, [0, 0.65, 0]);
  head.scale.set(1, 1.15, 0.95);
  group.add(head);
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), m.clay, [side * 0.068, 0.65, 0]));
    group.add(mesh(new THREE.SphereGeometry(0.011, 8, 6), m.black, [side * 0.028, 0.67, 0.058]));
  }
  group.add(mesh(new THREE.SphereGeometry(0.045, 14, 10), m.black, [0, 0.72, -0.01]));
  group.add(mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 20), m.red, [0, 0.71, 0], [Math.PI / 2, 0, 0]));
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
/** 楚式漆案与耳杯：翘头漆案（板状足、红黑漆绘）+ 双耳椭圆杯 */
function shapeTable() {
  const m = materials();
  const group = new THREE.Group();
  const topY = 0.36;

  // —— 漆案：案面四周起沿、两端上翘，下承两块开壸门的板状足
  group.add(mesh(new THREE.BoxGeometry(0.92, 0.045, 0.46), m.lacquer, [0, topY, 0]));
  // 四沿一道红漆细边 —— 楚漆器的红黑对比是它的招牌
  for (const dz of [-0.225, 0.225]) {
    group.add(mesh(new THREE.BoxGeometry(0.92, 0.05, 0.03), m.red, [0, topY + 0.045, dz]));
  }
  for (const dx of [-0.455, 0.455]) {
    group.add(mesh(new THREE.BoxGeometry(0.03, 0.05, 0.46), m.red, [dx, topY + 0.045, 0]));
  }
  // 翘头：两端各一块上翘的短板
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.BoxGeometry(0.13, 0.035, 0.44), m.black, [side * 0.5, topY + 0.08, 0], [0, 0, side * -0.42]));
  }
  // 案面漆绘：三道细红带，暗示云纹
  for (let i = 0; i < 3; i += 1) {
    group.add(mesh(new THREE.BoxGeometry(0.5 - i * 0.1, 0.006, 0.012), m.red, [0, topY + 0.027, -0.09 + i * 0.09]));
  }
  // 板状足：两块竖板；壸门缺口用中间留空、两侧加小垛来暗示
  for (const dx of [-0.32, 0.32]) {
    // 足高 0.37、中心 0.185：顶面 0.37 咬进案面底面 0.3375，
    // 原来只有 0.3 高，案面和足之间空着 3.7 cm，看起来就是案面浮在足上
    group.add(mesh(new THREE.BoxGeometry(0.055, 0.37, 0.44), m.black, [dx, 0.185, 0]));
    for (const dz of [-0.15, 0.15]) {
      group.add(mesh(new THREE.BoxGeometry(0.06, 0.13, 0.1), m.red, [dx, 0.065, dz]));
    }
  }

  // —— 耳杯：椭圆杯身，外黑内红，两侧新月形耳，下承椭圆假圈足
  for (const [x, z, spin] of [[-0.2, -0.02, 0], [0.22, 0.08, 0.32]]) {
    const holder = new THREE.Group();
    holder.position.set(x, topY + 0.023, z);
    holder.rotation.y = spin;

    const body = mesh(
      lathe([[0.03, 0], [0.1, 0.005], [0.115, 0.03], [0.126, 0.06], [0.13, 0.075]], 22),
      m.black,
    );
    body.scale.set(1.45, 1, 1);
    holder.add(body);

    // 内膛一块红漆椭圆面：外黑内红
    const inner = mesh(new THREE.CircleGeometry(0.12, 22), m.red, [0, 0.073, 0], [-Math.PI / 2, 0, 0]);
    inner.scale.set(1.45, 1, 1);
    holder.add(inner);

    // 双耳：压扁的环段，摊平后就是新月形的耳
    for (const side of [-1, 1]) {
      const ear = mesh(
        new THREE.TorusGeometry(0.075, 0.022, 8, 18, Math.PI * 0.8),
        m.red,
        [side * 0.18, 0.05, 0],
        [Math.PI / 2, 0, side > 0 ? 0 : Math.PI],
      );
      ear.scale.set(1.2, 1, 0.5);
      holder.add(ear);
    }

    const foot = mesh(new THREE.CylinderGeometry(0.06, 0.072, 0.02, 18), m.black, [0, -0.008, 0]);
    foot.scale.set(1.45, 1, 1);
    holder.add(foot);
    group.add(holder);
  }
  return group;
}


/* ---------------- 第二批器物造型 ---------------- */

/** 铜爵：有流有尾、三足一鋬 */
/** 铜爵：三足外撅、有根有蹄，口沿立双柱，一侧出流、一侧出尾 */
function shapeJue() {
  const m = materials();
  const group = new THREE.Group();

  // 器身：口沿外撅、腹微鼓
  const body = mesh(lathe([[0.02, 0], [0.13, 0.02], [0.16, 0.12], [0.15, 0.26], [0.17, 0.34]]), m.bronze);
  body.material.side = THREE.DoubleSide;
  group.add(body);

  // 流（长槽）与尾：一长一短
  group.add(mesh(new THREE.BoxGeometry(0.26, 0.05, 0.1), m.bronze, [0.17, 0.34, 0], [0, 0, 0.22]));
  group.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 4), m.bronze, [-0.16, 0.35, 0], [0, 0, Math.PI / 2 + 0.3]));

  // 口沿立双柱：爵的标志是两根，原来只立了一根
  for (const z of [-0.045, 0.045]) {
    group.add(mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.09, 10), m.bronze, [0.12, 0.4, z]));
    group.add(mesh(new THREE.SphereGeometry(0.026, 12, 10), m.gold, [0.12, 0.46, z]));
  }

  // 三足：根粗、足身是刀形三棱柱（有平面也有棱），末端外撅成蹄。
  // 原来是一根 2.2~3.0 cm 的细圆锥直接支在地上，所以又细又像浮着。
  for (let i = 0; i < 3; i += 1) {
    const holder = new THREE.Group();
    holder.rotation.y = -(i / 3) * Math.PI * 2 - 0.4;
    holder.add(
      mesh(new THREE.CylinderGeometry(0.072, 0.056, 0.13, 14), m.darkBronze, [0.09, -0.04, 0]),   // 足根裹住器底
      mesh(new THREE.CylinderGeometry(0.056, 0.043, 0.22, 3), m.darkBronze, [0.15, -0.19, 0], [0, 0, 0.22]), // 足身
      mesh(new THREE.CylinderGeometry(0.043, 0.06, 0.07, 12), m.bronze, [0.175, -0.315, 0], [0, 0, 0.22]),   // 蹄
      mesh(new THREE.CylinderGeometry(0.06, 0.052, 0.03, 12), m.bronze, [0.185, -0.36, 0], [0, 0, 0.22]),    // 足端平面
    );
    group.add(holder);
  }

  // 鋬（把手）
  group.add(mesh(new THREE.TorusGeometry(0.055, 0.016, 10, 22, Math.PI), m.bronze, [0.15, 0.2, 0], [0, Math.PI / 2, 0.4]));
  group.add(mesh(new THREE.TorusGeometry(0.11, 0.014, 10, 26), m.gold, [0, 0.34, 0], [Math.PI / 2, 0, 0]));
  return group;
}

/** 铜盘：大口浅腹、圈足、双耳 */
function shapePan() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(lathe([[0.02, 0], [0.34, 0], [0.4, 0.08], [0.44, 0.18], [0.42, 0.2]]), m.bronze);
  body.material.side = THREE.DoubleSide;
  body.position.y = 0.14;
  group.add(body);
  group.add(mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.14, 40), m.darkBronze, [0, 0.07, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.42, 0.022, 12, 48), m.patina, [0, 0.34, 0], [Math.PI / 2, 0, 0]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.07, 0.02, 10, 24), m.patina, [side * 0.43, 0.28, 0], [0, Math.PI / 2, 0]));
  }
  return group;
}

/** 铜卣：椭圆腹 + 盖 + 提梁 */
function shapeYou() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(lathe([[0.02, 0], [0.18, 0], [0.2, 0.04], [0.27, 0.2], [0.26, 0.36], [0.2, 0.46], [0.18, 0.52]]), m.bronze);
  body.material.side = THREE.DoubleSide;
  body.scale.set(1, 1, 0.78);
  group.add(body);
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 36), m.darkBronze, [0, 0.05, 0]));
  const lid = mesh(lathe([[0.02, 0], [0.2, 0], [0.16, 0.1], [0.08, 0.17]]), m.darkBronze);
  lid.position.y = 0.52;
  lid.scale.set(1, 1, 0.78);
  group.add(lid);
  group.add(mesh(new THREE.SphereGeometry(0.045, 18, 14), m.gold, [0, 0.72, 0]));
  const handle = mesh(new THREE.TorusGeometry(0.22, 0.022, 12, 40, Math.PI), m.patina, [0, 0.5, 0]);
  handle.rotation.z = Math.PI;
  handle.scale.set(1, 1, 0.6);
  group.add(handle);
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.TorusGeometry(0.04, 0.013, 8, 18), m.gold, [side * 0.2, 0.5, 0]));
  }
  return group;
}

/** 铜尊：喇叭口 + 鼓腹 + 四道扉棱 */
function shapeZunVessel() {
  const m = materials();
  const group = new THREE.Group();
  const body = mesh(
    lathe([[0.02, 0], [0.19, 0], [0.22, 0.06], [0.26, 0.22], [0.31, 0.42], [0.33, 0.56], [0.3, 0.72], [0.34, 0.88], [0.42, 1.0], [0.45, 1.05]]),
    m.bronze,
  );
  body.material.side = THREE.DoubleSide;
  group.add(body);
  group.add(mesh(new THREE.TorusGeometry(0.44, 0.022, 12, 48), m.patina, [0, 1.05, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), m.darkBronze, [Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3], [0, -a, 0]));
  }
  return group;
}

/** 编磬：三片石磬挂在木架上 */
function shapeQing() {
  const m = materials();
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9aa39b, roughness: 0.55, metalness: 0.05 });
  for (let i = 0; i < 3; i += 1) {
    const length = 0.42 - i * 0.06;
    group.add(mesh(new THREE.BoxGeometry(length, 0.1, 0.03), stone, [i * 0.42 - 0.42, 0.86 - i * 0.02, 0], [0, 0, -0.28]));
    group.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), m.gold, [i * 0.42 - 0.26, 0.98 - i * 0.02, 0]));
  }
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.12, 12), m.lacquer, [side * 0.62, 0.56, 0]));
  }
  group.add(mesh(new THREE.BoxGeometry(1.42, 0.08, 0.1), m.lacquer, [0, 1.12, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), m.black, [0, 0.03, 0]));
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
  jue: shapeJue,
  pan: shapePan,
  you: shapeYou,
  zunVessel: shapeZunVessel,
  qing: shapeQing,
};

/** 生成展品对象，并把包围盒调成「水平居中、底面贴 y = 0」 */
/* ------------------------------------------------------------------ */
/* 外部模型替换                                                        */
/* ------------------------------------------------------------------ */

/**
 * 用外部 FBX 顶替程序化形体的展品。
 *
 * 加载是异步的，所以**先按程序化形体把位置摆好，加载完再原地换掉**：
 * 缩放与对中都以「占位形体的高度」为准，于是展台标高、检视面板里的
 * model 引用、点击高亮全都不用改。
 *
 * rotateX/Y/Z 用来修正坐标系：Maya 导出的 FBX 一般是 Y 轴向上，
 * 若模型躺倒就把 rotateX 传 -Math.PI / 2。
 */
const EXTERNAL_MODELS = {
  // 虎座鸟架鼓：程序化的 shapeDrum 只作为尺寸与位置的占位，加载完被真模型原地替换
  drum: {
    url: './models/huzuoniaojiagu.glb',
    rotateX: 0, rotateY: 0, rotateZ: 0,
  },
  meiping: {
    url: './models/yuan_qinghua_siai_meiping.glb',
    rotateX: 0, rotateY: 0, rotateZ: 0,
    // 贴图方向校正 —— glb 的 UV 习惯与 three.js 不一致时就改这两项，不用改代码：
    //   flipY  : 贴图上下翻转（V 方向）
    //   mirrorU: 贴图左右镜像（U 方向）
    flipY: false,
    mirrorU: false,
  },
};

/** 在 holder 里把占位形体换成外部模型；没有对应配置就什么都不做 */
/**
 * 从 .glb 的 BIN 块里直接切出内嵌图片，做成 THREE.Texture。
 *
 * GLTFLoader 会把内嵌图片包成 blob URL 交给浏览器解码，这条路径在某些环境
 * 会失败（实测无头 Chromium 报 "Couldn't load texture blob:..."），失败后
 * material.map 为空，器物就变成一道平色。这个兜底不依赖那条路径：
 * 自己解析 glb 的 JSON 块与 BIN 块，按 images[].bufferView 切片。
 */
async function texturesFromGlb(url, config = {}) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) return null; // 'glTF'
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)));
    else if (type === 0x004e4942) bin = new Uint8Array(buffer, start, length);
    offset = start + length;
  }
  if (!json || !bin || !json.images || !json.images.length) return [];
  const out = [];
  for (const image of json.images) {
    if (image.bufferView === undefined) continue;
    if (image.mimeType && !/image\/(png|jpe?g|webp)/.test(image.mimeType)) continue;
    const part = json.bufferViews[image.bufferView];
    const from = part.byteOffset ?? 0;
    const bytes = bin.slice(from, from + part.byteLength);
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: image.mimeType || 'image/png' }));
    const texture = await new THREE.TextureLoader().loadAsync(objectUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    // 方向校正取自 EXTERNAL_MODELS 的配置：TextureLoader 默认 flipY = true，
    // 而 FBX 系（左下原点）的 UV 正好对应这个默认值；若导出过程翻过 V 就传 false。
    texture.flipY = config.flipY ?? false;
    if (config.mirrorU) {
      // U 范围是 [-0.5, 0.5]（对称），取负后正好以 0 为中心镜像，配合 Repeat 即可
      texture.repeat.x = -1;
      texture.offset.x = 0;
    }
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    URL.revokeObjectURL(objectUrl);
    console.info('[model] 兜底抠出 glb 内嵌图片 ' + part.byteLength + ' 字节');
    out.push(texture);
  }
  return out;
}

export async function applyExternalModel(shapeId, holder) {
  const config = EXTERNAL_MODELS[shapeId];
  if (!config) return;
  const target = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3()).y;
  try {
    // glb 是 three.js 的原生格式：贴图内嵌、UV 与包裹方式都已经烘进文件里，
    // 不再需要「手工抠 PNG / 重建材质 / 改 wrap」那三层运行时补丁。
    const gltf = await new GLTFLoader().loadAsync(config.url);
    const model = gltf.scene ?? (gltf.scenes && gltf.scenes[0]);
    if (!model) throw new Error('glb 里没有场景');

    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mm of mats) {
        if (!mm) continue;
        mm.side = THREE.DoubleSide;   // 薄壁器物露底面时兜底
        if (!mm.map) continue;
        if (mm.map.colorSpace !== THREE.SRGBColorSpace) mm.map.colorSpace = THREE.SRGBColorSpace;
        // 注意：这里**不要**套用 config.flipY —— glTF 的 UV 原点在左上，
        // GLTFLoader 已经设过 flipY = false，再按配置改一次反而是错的。
        // flipY / mirrorU 只对下面那条「自己抠图」的兜底路径有意义。
        mm.map.needsUpdate = true;
        // 这个 glb 里没有 samplers 段，GLTFLoader 就没给 wrap 赋值，
        // 于是走 three.js 的默认 ClampToEdge；而模型 UV 是 [-0.5, 0.5]
        // （Maya 习惯把 UV 居中在 0），负的一半会被全部压到左边缘 ——
        // 表现就是「一半正常、另一半被严重拉伸」。
        mm.map.wrapS = THREE.RepeatWrapping;
        mm.map.wrapT = THREE.RepeatWrapping;
        mm.map.needsUpdate = true;
      }
    });

    // 兜底：只要有网格没拿到贴图，就从 glb 的 BIN 里自己抠一张
    let missingMap = false;
    model.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mm of mats) if (mm && !mm.map) missingMap = true;
    });
    if (missingMap) {
      const fallbacks = await texturesFromGlb(config.url, config);
      if (fallbacks.length) {
        // 一只模型可能有好几张贴图（虎座鸟架鼓就有 4 张）。原来只抠第一张、
        // 又把它发给所有材质，结果是「所有部件一个花纹」。
        // glTF 里材质与贴图的顺序一致，所以按顺序发给「缺图」的材质即可。
        let cursor = 0;
        model.traverse((child) => {
          if (!child.isMesh) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mm of mats) {
            if (!mm || mm.map) continue;
            mm.map = fallbacks[Math.min(cursor, fallbacks.length - 1)];
            cursor += 1;
            mm.color = new THREE.Color(0xffffff);
            mm.needsUpdate = true;
          }
        });
        console.info('[model] 兜底共补上 ' + cursor + ' 个材质，用了 ' + fallbacks.length + ' 张贴图');
      }
    }

    model.rotation.set(config.rotateX, config.rotateY, config.rotateZ);
    model.updateMatrixWorld(true);

    // 归一化：按占位形体的高度等比缩放，底面对齐 y = 0、水平居中。
    // 这样展台标高、浮动动画、检视面板的引用都不用动。
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = size.y > 1e-6 && target > 1e-6 ? target / size.y : 1;
    model.scale.setScalar(k);
    model.position.set(-center.x * k, -box.min.y * k, -center.z * k);

    for (const child of [...holder.children]) holder.remove(child);
    holder.add(model);
    // 缩略图按展品名缓存，此刻必须失效：抽签的图、猜谜的剪影、检视面板的小图会重截
    bumpThumbnailGeneration();
    console.info('[model] 已换成 glb 外部模型 ' + config.url);
  } catch (error) {
    console.warn('[model] 加载失败 ' + config.url, error);
  }
}

export function createArtifactObject(artifact) {
  // 按展品名挑纹样变体，让同一展厅里的器物纹饰各不相同
  activeVariant = artifact.variant ?? variantOf(artifact.name ?? '');
  const builder = SHAPE_BUILDERS[artifact.shape];
  const object = builder ? builder(artifact) : new THREE.Group();
  activeVariant = 0;

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

  const LONG = 9.5;
  const SHORT = 4.4;
  const BEAM = 0.28;
  const BEAM_DEPTH = 0.3;
  const POST_TOP = 5.4;
  /** 钟体横向放大系数：第一层为基准，其余层按比例递减（见 tiers.width） */

  // 层高不只是美观问题：上一层钟的「钟口」必须高于下一层横梁的顶面，
  // 否则钟会从上往下插进木头（原来二层钟插进一层梁、三层钟插进二层梁）。
  // 可用高度 = (上一层梁底 y−0.14) − (下一层梁顶 y+0.14)。
  const tiers = [
    // 最底下一层原来只有 8 枚，臂的两端和中段都显得空。
    // 排距压到 0.90、钟宽收到 1.10（实际钟宽 0.77）后可以排 10 枚；
    // 中间那两枚会浅浅咬进漆木立柱 —— skipPost: false，按用户明确接受的「一点小穿模」处理。
    { y: 2.5, height: 1.28, spacing: 0.9, yong: 0.3, width: 1.1, skipPost: false },
    { y: 3.95, height: 0.84, spacing: 0.78, yong: 0.26, width: 0.95 }, // 钟宽 0.665，间隙 0.115
    { y: 5.0, height: 0.53, spacing: 0.5, yong: 0.15, width: 0.62 },   // 钟宽 0.434，间隙 0.066
  ];
  const arms = [
    { axis: 'x', length: LONG, center: [LONG / 2, 0] },
    { axis: 'z', length: SHORT, center: [0, -SHORT / 2] },
  ];

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);

  for (const tier of tiers) {
    const geometry = makeBellGeometry(tier.height, tier.width);
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
      // 立柱里有一根就在臂的中点（posts 里的 [LONG/2, 0] 与 [0, -SHORT/2]），
      // 而钟是沿臂均布铺满的，于是中间那几枚直接套在柱子上。
      // 把落在「柱半径 + 半个钟宽」以内的档位整档跳过，再重新居中。
      // skipPost: false 的层不避让立柱（最底层为了挂满，允许浅咬）
      const clearance = 0.19 + (0.7 * tier.width) / 2 + 0.03;
      const offsets = [];
      for (let i = 0; i < count; i += 1) {
        const offset = (-(count - 1) / 2 + i) * tier.spacing;
        if (tier.skipPost === false || Math.abs(offset) >= clearance) offsets.push(offset);
      }
      const mid = offsets.length ? (offsets[0] + offsets[offsets.length - 1]) / 2 : 0;
      for (let i = 0; i < offsets.length; i += 1) offsets[i] -= mid;

      const bells = new THREE.InstancedMesh(geometry, m.bronze, offsets.length);
      bells.castShadow = true;
      // 每根臂都要重置四元数！原来只在 z 臂上 setFromAxisAngle，
      // 而 quaternion 声明在两层循环之外 —— 第一层的 z 臂转过 90° 以后，
      // 后面两层 x 臂的钟也跟着转了 90°，所以「上面两层钟的朝向不对」。
      quaternion.identity();
      if (arm.axis === 'z') quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

      for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i];
        const bottom = -BEAM / 2 - tier.height - stemLength;
        const position =
          arm.axis === 'x' ? new THREE.Vector3(offset, bottom, 0) : new THREE.Vector3(0, bottom, offset);
        matrix.compose(position, quaternion, unit);
        bells.setMatrixAt(i, matrix);

        if (stemLength > 0) {
          holder.add(
            mesh(
              new THREE.CylinderGeometry(0.063, 0.077, stemLength, 10),
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
    inner.add(mesh(new THREE.CylinderGeometry(0.14, 0.17, POST_TOP, 14), m.lacquer, [x, POST_TOP / 2, z]));
    for (const y of [POST_TOP * 0.32, POST_TOP * 0.76]) {
      inner.add(mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 14), m.gold, [x, y, z]));
    }
    inner.add(mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 16), m.bronze, [x, 0.11, z]));
    inner.add(mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.16, 14), m.bronze, [x, POST_TOP + 0.03, z]));
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
