/**
 * 动画重定向（animation retargeting）
 *
 * 目标：把 A 骨架上的动画搬到 B 骨架上，即使两套骨骼
 *   ① 名字不同（Mixamo / Maya / Biped 各有各的命名），
 *   ② 绑定姿势不同（T-pose ↔ A-pose，或朝向不同），
 *   ③ 骨骼长度与比例不同。
 *
 * 核心不变式：**相对静止姿势的旋转增量保持不变**
 *
 *     qs(t) · qs(0)⁻¹  ==  qt(t) · qt(0)⁻¹
 *
 * 所以算法是：
 *   1. 分别记录源/目标骨架的静止（绑定）世界四元数；
 *   2. 让源骨架播放原始动画，逐帧采样；
 *   3. 每帧对每根骨头算出世界空间增量 delta = qs(t)·qs(0)⁻¹，
 *      套到目标骨头的静止姿势上得到目标世界四元数 qd = delta·qd(0)；
 *   4. 换算成局部四元数并写成新的 AnimationClip。
 *
 * 局限（必须在文档里讲清楚）：只搬旋转，不搬骨骼长度，
 * 因此四肢比例差得多的两套骨架，末端位置不会完全重合——需要 IK 才能解决。
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* 骨骼名归一化与匹配                                                  */
/* ------------------------------------------------------------------ */

/** 常见前缀/命名空间噪音 */
const NAME_NOISE = [
  /^.*[|:]/, // Maya 命名空间：Armature|Hips
  /^mixamorig[:_]?/i,
  /^bip\d*[_:]?/i,
  /^(bone|jnt|joint|def|ctrl|rig)[_:]?/i,
];

export function normalizeBoneName(name) {
  let n = String(name || '').toLowerCase();
  for (const pattern of NAME_NOISE) n = n.replace(pattern, '');
  return n.replace(/[\s_\-.]/g, '');
}

/** 语义别名：把「同义词」归到同一个规范名 */
const SEMANTIC_GROUPS = [
  ['hips', 'hip', 'pelvis', 'root', 'bip01', '髋', '骨盆', '腰'],
  ['spine', 'spine1', 'spine01', 'abdomen', 'chest', 'torso', '脊椎', '胸'],
  ['neck', '脖子', '颈'],
  ['head', '头'],
  ['shoulder', 'clavicle', 'shoulders', '肩'],
  ['upperarm', 'arm', 'upperarmtwist', 'humerus', 'upper', '大臂', '上臂'],
  ['forearm', 'lowerarm', 'elbow', '小臂', '前臂'],
  ['hand', 'wrist', '手'],
  ['thigh', 'upperleg', 'leg', 'femur', '大腿', '腿'],
  ['shin', 'lowerleg', 'calf', 'knee', 'tibia', '小腿'],
  ['foot', 'ankle', '脚'],
  ['toe', 'toebase', 'ball', '脚趾'],
];

const SEMANTIC_INDEX = new Map();
SEMANTIC_GROUPS.forEach((group) => group.forEach((alias) => SEMANTIC_INDEX.set(alias, group[0])));
const SEMANTIC_ALIASES_BY_LENGTH = [...SEMANTIC_INDEX.keys()].sort((a, b) => b.length - a.length);

const SIDE_TOKENS = new Set(['l', 'r', 'lf', 'rt', 'lt', 'left', 'right']);
const NOISE_TOKENS = new Set(['bone', 'jnt', 'joint', 'def', 'ctrl', 'rig', 'bn', 'skeleton', 'armature']);

/** 把名字拆成 token：先按驼峰断开，再按分隔符切 */
export function tokenizeBoneName(name) {
  return String(name || '')
    .replace(/^.*[|:]/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.:|]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

/** 左右侧：按 token 判断，不会把 lowerarm 里的 l 当成左侧 */
function sideOf(name) {
  const tokens = tokenizeBoneName(name);
  if (tokens.some((t) => t === 'l' || t === 'lf' || t === 'lt' || t === 'left')) return 'l';
  if (tokens.some((t) => t === 'r' || t === 'rt' || t === 'right')) return 'r';
  const raw = String(name || '');
  if (/左/.test(raw)) return 'l';
  if (/右/.test(raw)) return 'r';
  return '';
}

/**
 * 把骨骼名压成「语义 + 左右」签名，用于跳命名体系匹配。
 * 先试去掉噪音/左右后的整串，再试单个 token，最后按「最长的别名」做包含匹配
 * （顺序很重要：lowerarm 必须先命中 forearm，不能先碰到 arm）。
 */
export function semanticKey(name) {
  const tokens = tokenizeBoneName(name);
  const side = sideOf(name);
  const meaningful = tokens.filter((t) => !SIDE_TOKENS.has(t) && !NOISE_TOKENS.has(t));
  const joined = meaningful.join('');

  let semantic = SEMANTIC_INDEX.get(joined);
  if (!semantic) {
    let best = null;
    for (const token of meaningful) {
      const hit = SEMANTIC_INDEX.get(token);
      if (hit && (!best || token.length > best.length)) best = { hit, length: token.length };
    }
    semantic = best?.hit;
  }
  if (!semantic) {
    for (const alias of SEMANTIC_ALIASES_BY_LENGTH) {
      if (alias.length >= 3 && joined.includes(alias)) {
        semantic = SEMANTIC_INDEX.get(alias);
        break;
      }
    }
  }
  return { semantic: semantic || joined, side, normalized: normalizeBoneName(name), tokens };
}

/** 收集骨架里的全部骨骼（跳过纯空节点） */
export function collectBones(root) {
  const bones = [];
  root.traverse((node) => {
    if (node.isBone) bones.push(node);
  });
  // 有些 FBX 没有标 isBone，退化成「有名字的节点」
  if (!bones.length) {
    root.traverse((node) => {
      if (node.isObject3D && node !== root && node.name) bones.push(node);
    });
  }
  return bones;
}

/**
 * 建立「源骨骼 → 目标骨骼」的映射表。
 * 依次尝试：归一化同名 → 语义签名 → 结构位置（父级已匹配时按子节点顺序）→ 包含匹配。
 *
 * @returns {{map: Map<THREE.Object3D, THREE.Object3D>, report: object}}
 */
export function buildBoneMap(sourceRoot, targetRoot, options = {}) {
  const sourceBones = collectBones(sourceRoot);
  const targetBones = collectBones(targetRoot);
  const manualAliases = options.aliases || {}; // { 源骨骼名: 目标骨骼名 }
  const map = new Map();
  const usedTargets = new Set();
  const byNormalized = new Map();
  const bySemantic = new Map();

  for (const bone of targetBones) {
    const norm = normalizeBoneName(bone.name);
    if (!byNormalized.has(norm)) byNormalized.set(norm, bone);
    const { semantic, side } = semanticKey(bone.name);
    const key = semantic + '|' + side;
    if (!bySemantic.has(key)) bySemantic.set(key, []);
    bySemantic.get(key).push(bone);
  }

  const unresolved = [];
  const take = (sourceBone, targetBone, reason) => {
    if (!targetBone || usedTargets.has(targetBone)) return false;
    map.set(sourceBone, targetBone);
    usedTargets.add(targetBone);
    reasons[reason] = (reasons[reason] || 0) + 1;
    return true;
  };
  const reasons = { 手工别名: 0, 同名: 0, 语义匹配: 0, 结构位置: 0, 包含匹配: 0 };

  // ① 手工别名
  for (const bone of sourceBones) {
    const alias = manualAliases[bone.name];
    if (!alias) continue;
    const target = targetBones.find((b) => b.name === alias) || byNormalized.get(normalizeBoneName(alias));
    take(bone, target, '手工别名');
  }

  // ② 归一化同名
  for (const bone of sourceBones) {
    if (map.has(bone)) continue;
    take(bone, byNormalized.get(normalizeBoneName(bone.name)), '同名');
  }

  // ③ 语义签名（考虑左右）
  for (const bone of sourceBones) {
    if (map.has(bone)) continue;
    const { semantic, side } = semanticKey(bone.name);
    const list = bySemantic.get(semantic + '|' + side) || [];
    take(bone, list.find((b) => !usedTargets.has(b)), '语义匹配');
  }

  // ④ 结构位置：父级已匹配时，按子节点里的序号对应
  const depthOf = (node) => {
    let d = 0;
    let cur = node;
    while (cur.parent) {
      d += 1;
      cur = cur.parent;
    }
    return d;
  };
  const orderedSources = [...sourceBones].sort((a, b) => depthOf(a) - depthOf(b));
  for (const bone of orderedSources) {
    if (map.has(bone) || !bone.parent) continue;
    const mappedParent = map.get(bone.parent);
    if (!mappedParent) continue;
    const siblings = bone.parent.children.filter((c) => collectBones(bone.parent).includes(c) || c.isBone || c.name);
    const index = siblings.indexOf(bone);
    const targetSiblings = mappedParent.children.filter((c) => c.isBone || c.name);
    take(bone, targetSiblings[index], '结构位置');
  }

  // ⑤ 包含匹配兜底
  for (const bone of sourceBones) {
    if (map.has(bone)) continue;
    const norm = normalizeBoneName(bone.name);
    const target = targetBones.find((b) => {
      if (usedTargets.has(b)) return false;
      const t = normalizeBoneName(b.name);
      return t && norm && (t.includes(norm) || norm.includes(t));
    });
    take(bone, target, '包含匹配');
  }

  for (const bone of sourceBones) if (!map.has(bone)) unresolved.push(bone.name);

  return {
    map,
    report: {
      源骨骼数: sourceBones.length,
      目标骨骼数: targetBones.length,
      已匹配: map.size,
      匹配方式: reasons,
      未匹配: unresolved.slice(0, 20),
      未匹配数: unresolved.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 静止姿势与重定向烘焙                                                */
/* ------------------------------------------------------------------ */

/** 记录当前世界四元数 / 位置作为静止姿势 */
export function captureRestPose(root) {
  const quaternions = new Map();
  const positions = new Map();
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    quaternions.set(node, node.getWorldQuaternion(new THREE.Quaternion()));
    positions.set(node, node.getWorldPosition(new THREE.Vector3()));
  });
  return { quaternions, positions };
}

/**
 * 把源片段烘焙成目标骨架上的新片段。
 * @param {THREE.AnimationClip} clip
 * @param {THREE.Object3D} sourceRoot 已经绑定了该片段的骨架
 * @param {THREE.Object3D} targetRoot 要接收动画的骨架
 * @param {Map} boneMap buildBoneMap 的结果
 */
export function retargetClip(clip, sourceRoot, targetRoot, boneMap, options = {}) {
  const fps = options.fps || 30;
  const sourceRest = options.sourceRest || captureRestPose(sourceRoot);
  const targetRest = options.targetRest || captureRestPose(targetRoot);
  const transferRootMotion = options.rootMotion || 'vertical'; // 'full' | 'vertical' | 'none'
  const heightScale = options.heightScale || 1;

  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) times[i] = i / fps;

  const depthOf = (node) => {
    let d = 0;
    let cur = node;
    while (cur.parent) {
      d += 1;
      cur = cur.parent;
    }
    return d;
  };
  const pairs = [...boneMap.entries()].sort((a, b) => depthOf(a[1]) - depthOf(b[1]));

  const rotationValues = new Map(); // targetBone → Float32Array
  for (const [, targetBone] of pairs) {
    rotationValues.set(targetBone, new Float32Array(frames * 4));
  }

  // 髋部（根）位移
  const hipsPair = pairs.find(([sourceBone, targetBone]) =>
    targetBone === targetRoot || /hip|pelvis|root|髋|骨盆/i.test(targetBone.name) || /hip|pelvis|root|髋|骨盆/i.test(sourceBone.name));
  const positionValues = hipsPair ? new Float32Array(frames * 3) : null;

  const qs = new THREE.Quaternion();
  const qs0inv = new THREE.Quaternion();
  const delta = new THREE.Quaternion();
  const qd = new THREE.Quaternion();
  const parentWorld = new THREE.Quaternion();
  const localQ = new THREE.Quaternion();
  const srcHipsRest = hipsPair ? sourceRest.positions.get(hipsPair[0]).clone() : null;
  const tmpPos = new THREE.Vector3();
  const parentMatrixInverse = new THREE.Matrix4();

  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(clip);
  action.play();

  for (let frame = 0; frame < frames; frame += 1) {
    const time = times[frame];
    mixer.setTime(time);
    sourceRoot.updateMatrixWorld(true);

    for (const [sourceBone, targetBone] of pairs) {
      sourceBone.getWorldQuaternion(qs);
      qs0inv.copy(sourceRest.quaternions.get(sourceBone)).invert();
      delta.copy(qs).multiply(qs0inv); // 源的世界空间旋转增量
      qd.copy(delta).multiply(targetRest.quaternions.get(targetBone)); // 套到目标静止姿势上

      if (targetBone.parent) {
        targetBone.parent.getWorldQuaternion(parentWorld);
        localQ.copy(parentWorld).invert().multiply(qd);
      } else {
        localQ.copy(qd);
      }
      targetBone.quaternion.copy(localQ);
      // 立即刷新自己的世界矩阵，后面的子骨骼才能用到正确的父级变换
      targetBone.updateWorldMatrix(false, false);

      const values = rotationValues.get(targetBone);
      const offset = frame * 4;
      values[offset] = localQ.x;
      values[offset + 1] = localQ.y;
      values[offset + 2] = localQ.z;
      values[offset + 3] = localQ.w;
    }

    // 根位移：默认只保留竖直方向（本项目的位移由移动逻辑负责，不能让动画把人物带跑）
    if (hipsPair && positionValues) {
      const [sourceHips, targetHips] = hipsPair;
      sourceHips.getWorldPosition(tmpPos);
      tmpPos.sub(srcHipsRest).multiplyScalar(heightScale);
      if (transferRootMotion === 'vertical') {
        tmpPos.x = 0;
        tmpPos.z = 0;
      } else if (transferRootMotion === 'none') {
        tmpPos.set(0, 0, 0);
      }
      const restPos = targetRest.positions.get(targetHips);
      const desired = restPos.clone().add(tmpPos);
      if (targetHips.parent) {
        parentMatrixInverse.copy(targetHips.parent.matrixWorld).invert();
        desired.applyMatrix4(parentMatrixInverse);
      }
      const offset = frame * 3;
      positionValues[offset] = desired.x;
      positionValues[offset + 1] = desired.y;
      positionValues[offset + 2] = desired.z;
      targetHips.position.copy(desired);
      targetHips.updateWorldMatrix(false, false);
    }
  }

  action.stop();

  // 还原源骨架到静止姿势，避免污染后续
  mixer.setTime(0);

  const tracks = [];
  for (const [targetBone, values] of rotationValues) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${targetBone.name}.quaternion`, times, values));
  }
  if (hipsPair && positionValues) {
    tracks.push(new THREE.VectorKeyframeTrack(`${hipsPair[1].name}.position`, times, positionValues));
  }

  return new THREE.AnimationClip(`${clip.name}_retargeted`, clip.duration, tracks);
}

/* ------------------------------------------------------------------ */
/* 判断能否直接播放                                                    */
/* ------------------------------------------------------------------ */

/**
 * 片段里的轨道名能否在目标骨架上解析到节点。
 * 能解析的比例够高就直接播，否则才走重定向。
 */
export function clipCompatibility(clip, targetRoot) {
  let resolved = 0;
  let total = 0;
  for (const track of clip.tracks) {
    if (!/\.(quaternion|position|scale)$/.test(track.name)) continue;
    total += 1;
    const nodeName = track.name.split('.')[0];
    let found = false;
    targetRoot.traverse((node) => {
      if (!found && node.name === nodeName) found = true;
    });
    if (found) resolved += 1;
  }
  return { resolved, total, ratio: total ? resolved / total : 0 };
}

/** 列出骨骼名，便于排查匹配问题 */
export function listBoneNames(root, limit = 200) {
  return collectBones(root).slice(0, limit).map((bone) => bone.name);
}
