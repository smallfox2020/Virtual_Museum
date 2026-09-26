import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/* ================================================================== */
/* 可调参数                                                            */
/* ================================================================== */

export const CHARACTER_CONFIG = {
  /** 目标身高（米）——展厅尺度以米为单位，人物按 1.78 m 归一化 */
  targetHeight: 1.78,

  /**
   * 贴图分辨率上限。内嵌贴图原图是 2048×2048 × 16 张，
   * 全部按原尺寸上传会占掉数百 MB 显存；人物在屏幕上通常只有两三百像素高，
   * 按颜色/法线 1024、金属/粗糙 512 降采样，观感几乎无损。
   */
  textureSize: { color: 1024, normal: 1024, data: 512 },

  /** T 形姿势 → 双臂自然下垂（CPU 一次性重姿态，运行时不花钱） */
  reposeArms: true,
  armDropRadians: 1.43, // ≈ 82°
  shoulderRatio: 0.14, // 肩关节 x / 身高
  shoulderBlendRatio: 0.09, // 过渡带宽度 / 身高
  armBandRatio: 0.745, // 手臂所在高度 / 身高（自动测量，这里是兜底值）

  /** 模型本身面朝 +Z 时为 0；若角色倒着走，改成 Math.PI */
  facingOffset: 0,

  /** 骨骼动画片段的名字匹配规则（不区分大小写，支持中英文） */
  clipPatterns: {
    idle: ['idle', 'stand', 'breath', '待机', '站立', '空闲'],
    walk: ['walk', '行走', '走路'],
    run: ['run', 'jog', 'sprint', '奔跑', '跑步'],
    jump: ['jump', 'leap', '跳跃', '起跳'],
  },
};

/** Maya / Max 导出的通道名 → three.js 材质槽位 */
const CHANNEL_SLOTS = {
  basecolor: { slot: 'map', srgb: true, size: 'color' },
  diffuse: { slot: 'map', srgb: true, size: 'color' },
  albedo: { slot: 'map', srgb: true, size: 'color' },
  emissive: { slot: 'emissiveMap', srgb: true, size: 'color' },
  normal: { slot: 'normalMap', srgb: false, size: 'normal' },
  normalcamera: { slot: 'normalMap', srgb: false, size: 'normal' },
  bump: { slot: 'normalMap', srgb: false, size: 'normal' },
  metallic: { slot: 'metalnessMap', srgb: false, size: 'data' },
  metalness: { slot: 'metalnessMap', srgb: false, size: 'data' },
  roughness: { slot: 'roughnessMap', srgb: false, size: 'data' },
  specularroughness: { slot: 'roughnessMap', srgb: false, size: 'data' },
  glossiness: { slot: 'roughnessMap', srgb: false, size: 'data' },
  ao: { slot: 'aoMap', srgb: false, size: 'data' },
  ambientocclusion: { slot: 'aoMap', srgb: false, size: 'data' },
  opacity: { slot: 'alphaMap', srgb: false, size: 'data' },
};

const IMAGE_SIGNATURES = [
  { name: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], end: 'IEND' },
  { name: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], end: '\u00ff\u00d9' },
];

/* ================================================================== */
/* 一、从 FBX 二进制里抠出内嵌图片                                      */
/* ================================================================== */

/**
 * FBX 把内嵌媒体以「原始文件字节」的形式放在 Video 节点的 Content 字段里，
 * 图片本身没有加壳，所以直接按文件签名扫描就能定位；
 * 文件名则出现在紧邻其前的 RelativeFilename 字段，用于判断它是哪个材质的哪个通道。
 *
 * @returns {Map<string, {bytes: Uint8Array, width?: number, height?: number, ext: string}>}
 */
export function extractEmbeddedImages(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const found = new Map();

  // 1) 先把所有文件名出现的位置扫出来（FBX 里字符串是明文）
  const text = latin1(bytes);
  const fileRe = /([A-Za-z0-9_\-]+\.(?:png|jpg|jpeg|tga|bmp|tif|tiff))/gi;
  const names = [];
  let match;
  while ((match = fileRe.exec(text)) !== null) {
    names.push({ name: match[1], at: match.index });
  }
  if (!names.length) return found;

  // 2) 再按图片签名切出每一张图
  for (const signature of IMAGE_SIGNATURES) {
    let cursor = 0;
    while (cursor < bytes.length) {
      const start = indexOfBytes(bytes, signature.bytes, cursor);
      if (start === -1) break;

      let end = -1;
      if (signature.name === 'png') {
        const iend = indexOfBytes(bytes, ascii('IEND'), start + 8);
        if (iend === -1) break;
        end = iend + 8; // IEND(4) + CRC(4)
      } else {
        const eoi = indexOfBytes(bytes, ascii('\u00ff\u00d9'), start + 3);
        if (eoi === -1) break;
        end = eoi + 2;
      }
      if (end <= start) break;

      // 3) 往前找最近的一次文件名，就是这张图的归属
      let owner = null;
      for (let i = names.length - 1; i >= 0; i -= 1) {
        if (names[i].at < start) {
          owner = names[i].name;
          break;
        }
      }
      if (owner) {
        const key = owner.toLowerCase();
        if (!found.has(key)) {
          const entry = { bytes: bytes.slice(start, end), ext: signature.name };
          if (signature.name === 'png' && end - start > 24) {
            const view = new DataView(arrayBuffer, start, 24);
            entry.width = view.getUint32(16);
            entry.height = view.getUint32(20);
          }
          found.set(key, entry);
        }
      }
      cursor = end;
    }
  }
  return found;
}

function latin1(bytes) {
  let out = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return out;
}

function ascii(text) {
  return Uint8Array.from([...text].map((c) => c.charCodeAt(0)));
}

function indexOfBytes(haystack, needle, from = 0) {
  const first = needle[0];
  for (let i = from; i <= haystack.length - needle.length; i += 1) {
    if (haystack[i] !== first) continue;
    let ok = true;
    for (let j = 1; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/* ================================================================== */
/* 二、文件名 → 材质 + 通道                                            */
/* ================================================================== */

/** Zhenxiliang_Skin_BaseColor.png → { material: 'skin', channel: 'basecolor' } */
export function parseImageName(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const parts = stem.split(/[_\-.\s]+/).filter(Boolean);
  const channel = (parts[parts.length - 1] || '').toLowerCase();
  const material = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : '';
  return { material, channel, known: Boolean(CHANNEL_SLOTS[channel]) };
}

/** 把扫到的图片按材质名归组 */
function groupImagesByName(images) {
  const groups = new Map();
  for (const [fileName, entry] of images) {
    const { material, channel, known } = parseImageName(fileName);
    if (!known) continue;
    if (!groups.has(material)) groups.set(material, []);
    groups.get(material).push({ fileName, entry, channel });
  }
  return groups;
}

/* ================================================================== */
/* 三、重建 PBR 材质                                                    */
/* ================================================================== */

function blobToImage(bytes, ext) {
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('内嵌贴图解码失败'));
    };
    image.src = url;
  });
}

async function makeTexture(image, maxSize, srgb) {
  let source = image;
  const limit = Math.max(image.width, image.height);
  if (limit > maxSize) {
    const scale = maxSize / limit;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    source = canvas;
  }
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 用抠出来的图片重建材质。
 * 注意 FBXLoader 不修改 flipY（保持默认 true），这里也保持一致，UV 才对得上。
 */
async function buildMaterialTextures(images, config) {
  const grouped = groupImagesByName(images);
  const byMaterial = new Map();
  const report = { materials: 0, textures: 0 };

  for (const [materialName, items] of grouped) {
    const set = {};
    for (const { entry, channel } of items) {
      const info = CHANNEL_SLOTS[channel];
      const maxSize = config.textureSize[info.size] ?? 1024;
      try {
        const image = await blobToImage(entry.bytes, entry.ext);
        set[info.slot] = await makeTexture(image, maxSize, info.srgb);
        report.textures += 1;
      } catch (error) {
        console.warn(`[character] 贴图 ${channel} 处理失败：${error.message}`);
      }
    }
    if (Object.keys(set).length) {
      byMaterial.set(materialName, set);
      report.materials += 1;
    }
  }
  return { byMaterial, report };
}

/** 把材质换成带 PBR 贴图的 MeshStandardMaterial（保留原来的朝向/透明等状态） */
function upgradeMaterials(root, textureSets) {
  const cache = new Map();
  let replaced = 0;

  root.traverse((node) => {
    if (!node.isMesh) return;

    const upgrade = (old) => {
      const name = (old?.name || '').toLowerCase();
      const key = name || '__default__';
      if (cache.has(key)) return cache.get(key);

      // 材质名可能是 "Skin"，也可能是 "Zhenxiliang_Skin"，两种都试
      const set = textureSets.get(name)
        ?? textureSets.get(name.split(/[_\-.\s]+/).pop())
        ?? textureSets.get('')
        ?? {};

      const material = new THREE.MeshStandardMaterial({
        name: old?.name || 'material',
        color: set.map ? 0xffffff : (old?.color ? old.color.clone() : new THREE.Color(0xcccccc)),
        map: set.map ?? old?.map ?? null,
        normalMap: set.normalMap ?? old?.normalMap ?? null,
        metalnessMap: set.metalnessMap ?? null,
        roughnessMap: set.roughnessMap ?? null,
        emissiveMap: set.emissiveMap ?? null,
        aoMap: set.aoMap ?? null,
        alphaMap: set.alphaMap ?? null,
        // 有贴图时把系数开到 1，让贴图原样生效；没有就取经验值
        metalness: set.metalnessMap ? 1 : 0.05,
        roughness: set.roughnessMap ? 1 : 0.62,
        emissive: set.emissiveMap ? 0xffffff : 0x000000,
        side: old?.side ?? THREE.FrontSide,
        transparent: old?.transparent ?? false,
        opacity: old?.opacity ?? 1,
        alphaTest: old?.alphaTest ?? 0,
        envMapIntensity: 0.7,
      });
      material.userData.sourceName = old?.name || '';
      replaced += 1;
      cache.set(key, material);
      return material;
    };

    if (Array.isArray(node.material)) {
      node.material = node.material.map(upgrade);
    } else if (node.material) {
      node.material = upgrade(node.material);
    }
    node.castShadow = true;
    node.receiveShadow = true;
  });

  return { materials: cache.size, replaced };
}

/* ================================================================== */
/* 四、T 形姿势 → 双臂自然下垂（CPU 一次性重姿态）                       */
/* ================================================================== */

/** 测量手臂所在的高度带（手臂顶点在竖直方向上的分布） */
function measureArmBand(root) {
  const points = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const pos = node.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 7) {
      points.push([pos.getX(i), pos.getY(i)]);
    }
  });
  if (!points.length) return null;

  let maxAbsX = 0;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    maxAbsX = Math.max(maxAbsX, Math.abs(x));
    maxY = Math.max(maxY, y);
  }
  const threshold = maxAbsX * 0.7;
  let sum = 0;
  let count = 0;
  for (const [x, y] of points) {
    if (Math.abs(x) > threshold) {
      sum += y;
      count += 1;
    }
  }
  if (!count) return null;
  return { centerY: sum / count, maxAbsX, maxY, samples: count };
}

/**
 * 没有蒙皮权重，做不了真正的骨骼姿势；但 T 形姿势的手臂顶点集中在同一个高度带里，
 * 可以按「绕肩关节在 XY 平面内旋转」的方式把它们整体放下来。旋转是刚体变换，
 * 手臂不会被压扁，只在肩关节的过渡带上略有拉伸。
 */
export function reposeArms(root, config = CHARACTER_CONFIG) {
  const band = measureArmBand(root);
  if (!band) return { moved: 0, skipped: true };

  const height = band.maxY || 1;
  const shoulderY = band.centerY;
  const shoulderX = height * config.shoulderRatio;
  const blend = height * config.shoulderBlendRatio;
  const angle = config.armDropRadians;
  const verticalWindow = height * 0.26;

  let moved = 0;
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const pos = node.geometry.attributes.position;
    const nor = node.geometry.attributes.normal;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const absX = Math.abs(x);
      if (absX <= shoulderX) continue;

      // 横向权重：从肩关节向外平滑过渡到 1
      let w = Math.min(1, (absX - shoulderX) / blend);
      w = w * w * (3 - 2 * w);

      // 纵向权重：只影响肩部高度附近，避免误伤腰胯
      const dy = Math.abs(y - shoulderY);
      if (dy > verticalWindow) {
        w *= Math.max(0, 1 - (dy - verticalWindow) / (height * 0.18));
      }
      if (w <= 0.001) continue;

      const side = x >= 0 ? 1 : -1;
      const relX = absX - shoulderX;
      const relY = y - shoulderY;
      const radius = Math.hypot(relX, relY);
      const rotated = Math.atan2(relY, relX) - angle * w;

      pos.setX(i, side * (shoulderX + Math.cos(rotated) * radius));
      pos.setY(i, shoulderY + Math.sin(rotated) * radius);

      if (nor) {
        // 法线做同一个旋转（左侧镜像后再还原符号）
        const nAbsX = Math.abs(nor.getX(i));
        const nY = nor.getY(i);
        if (nAbsX > 0.0001 || Math.abs(nY) > 0.0001) {
          const nRadius = Math.hypot(nAbsX, nY);
          const nRotated = Math.atan2(nY, nAbsX) - angle * w;
          const sign = nor.getX(i) >= 0 ? 1 : -1;
          nor.setX(i, sign * Math.cos(nRotated) * nRadius);
          nor.setY(i, Math.sin(nRotated) * nRadius);
        }
      }
      moved += 1;
    }

    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    node.geometry.computeBoundingBox();
    node.geometry.computeBoundingSphere();
  });

  return { moved, skipped: false, shoulderX, shoulderY, height };
}

/* ================================================================== */
/* 五、归一化与朝向探测                                                */
/* ================================================================== */

/**
 * 用「眼睛材质组的质心在 z 的哪一侧」判断模型朝向。
 * 眼睛长在脸的正面，这个判据比看包围盒靠谱得多。
 */
export function detectFacing(root) {
  const candidates = [];
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    const groups = node.geometry.groups || [];
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const pos = node.geometry.attributes.position;
    const index = node.geometry.index;
    for (const group of groups) {
      const material = materials[group.materialIndex];
      if (!material || !/eye|眼/i.test(material.name || '')) continue;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < group.count; i += 3) {
        const vi = index ? index.getX(group.start + i) : group.start + i;
        sum += pos.getZ(vi);
        count += 1;
      }
      if (count) candidates.push(sum / count);
    }
  });
  if (!candidates.length) return { facing: 'unknown', eyeZ: null };
  const eyeZ = candidates.reduce((a, b) => a + b, 0) / candidates.length;
  return { facing: eyeZ >= 0 ? '+Z' : '-Z', eyeZ };
}

/** 缩放到位、水平居中、脚底落在 y = 0 */
function normalize(root, targetHeight) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / (size.y || 1);
  root.scale.multiplyScalar(scale);

  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  const center = scaled.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;

  return { scale, size };
}

/* ================================================================== */
/* 六、对外接口                                                        */
/* ================================================================== */

/**
 * 加载带内嵌贴图的 FBX 角色。
 *
 * 这一版 FBXLoader 只认 DiffuseColor / NormalMap / Maya|TEX_color_map 等老通道名，
 * 遇到 Maya PBR 导出的 Maya|baseColor / Maya|normalCamera / Maya|specularRoughness /
 * Maya|metalness 会直接 skip，结果模型一片灰白。所以这里不依赖它的贴图解析：
 * 自己从二进制里把图片抠出来，按「材质名 + 通道」重建材质。
 */
export async function loadCharacter(url, options = {}) {
  const config = { ...CHARACTER_CONFIG, ...options, ...(options.textureSize ? {} : {}) };
  if (options.textureSize) config.textureSize = { ...CHARACTER_CONFIG.textureSize, ...options.textureSize };

  const response = await fetch(url);
  if (!response.ok) throw new Error(`角色模型 ${url} 加载失败：HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();

  // 1) 先抠图（要用原始 buffer）
  const images = extractEmbeddedImages(buffer);

  // 2) 解析几何与材质；期间屏蔽 FBXLoader 关于未知通道的刷屏警告
  const originalWarn = console.warn;
  const suppressed = [];
  console.warn = (...args) => {
    const first = String(args[0] ?? '');
    if (first.includes('FBXLoader') && (first.includes('is not supported in three.js') || first.includes('unknown material type'))) {
      suppressed.push(first.replace('%s', '').trim());
      return;
    }
    originalWarn.apply(console, args);
  };
  let object;
  try {
    object = new FBXLoader().parse(buffer, '');
  } finally {
    console.warn = originalWarn;
  }

  // 3) T 形姿势 → 手臂下垂
  const repose = config.reposeArms ? reposeArms(object, config) : { skipped: true };

  // 4) 用抠出来的贴图重建 PBR 材质
  const { byMaterial, report } = await buildMaterialTextures(images, config);
  const upgraded = upgradeMaterials(object, byMaterial);

  // 5) 朝向探测 + 归一化
  const facing = detectFacing(object);
  const normalized = normalize(object, config.targetHeight);

  const clips = object.animations || [];
  const stats = {
    vertices: countVertices(object),
    meshes: countMeshes(object),
    images: images.size,
    textureSets: report.materials,
    textures: report.textures,
    materials: upgraded.materials,
    height: +(normalized.size.y * normalized.scale).toFixed(3),
    facing: facing.facing,
    eyeZ: facing.eyeZ === null ? null : +facing.eyeZ.toFixed(3),
    clips: clips.map((clip) => clip.name),
    armed: !repose.skipped,
    suppressedWarnings: suppressed.length,
  };

  console.log(
    `[character] ${url}\n` +
      `  顶点 ${stats.vertices}｜网格 ${stats.meshes}｜内嵌贴图 ${stats.images} 张 → 材质 ${stats.textures} 张贴图 / ${stats.materials} 个材质\n` +
      `  身高 ${stats.height} m｜朝向 ${stats.facing}（眼睛 z=${stats.eyeZ}）｜` +
      `${stats.armed ? `手臂下垂已应用（移动 ${repose.moved} 个顶点）` : '手臂未重姿态'}\n` +
      `  骨骼动画：${stats.clips.length ? stats.clips.join(', ') : '无（该模型没有骨骼与动画曲线）'}` +
      (suppressed.length ? `\n  （已屏蔽 FBXLoader 的 ${suppressed.length} 条未知通道警告）` : ''),
  );

  return { object, clips, stats, images };
}

function countMeshes(root) {
  let n = 0;
  root.traverse((node) => {
    if (node.isMesh) n += 1;
  });
  return n;
}

function countVertices(root) {
  let n = 0;
  root.traverse((node) => {
    if (node.isMesh && node.geometry?.attributes?.position) n += node.geometry.attributes.position.count;
  });
  return n;
}

/** 按名字挑动画片段（walk / run / jump / idle） */
export function pickClips(clips, patterns = CHARACTER_CONFIG.clipPatterns) {
  const result = {};
  for (const [slot, keywords] of Object.entries(patterns)) {
    const hit = clips.find((clip) => {
      const name = (clip.name || '').toLowerCase();
      return keywords.some((keyword) => name.includes(keyword.toLowerCase()));
    });
    if (hit) result[slot] = hit;
  }
  return result;
}
