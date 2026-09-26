import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/* ================================================================== */
/* 可调参数                                                            */
/* ================================================================== */

export const CHARACTER_CONFIG = {
  /** 目标身高（米）——展厅尺度以米为单位 */
  targetHeight: 1.98,

  /**
   * 贴图分辨率上限。内嵌贴图原图是 2048×2048 × 16 张，
   * 全部按原尺寸上传会占掉数百 MB 显存；人物在屏幕上通常只有两三百像素高，
   * 按颜色/法线 1024、金属/粗糙 512 降采样，观感几乎无损。
   */
  textureSize: { color: 1024, normal: 1024, data: 512 },

  /** T 形姿势 → 双臂自然下垂（CPU 一次性重姿态，运行时不花钱）
   *  注意：带骨骼蒙皮的模型会自动跳过——T 形是绑定姿势，改了会和蒙皮打架 */
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

/** 角色模型的 ArrayBuffer 缓存：用于让下载与展厅搭建并行 */
const bufferCache = new Map();

/** 提前开始下载角色模型（在 main.js 里于 createMuseum 之前调用） */
export function preloadCharacter(url) {
  if (!url || bufferCache.has(url)) return;
  bufferCache.set(
    url,
    fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null),
  );
}

async function fetchBuffer(url) {
  const cached = bufferCache.get(url);
  if (cached) {
    const buffer = await cached;
    if (buffer) return buffer;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

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

/**
 * 把内嵌图解成可直接上传的 canvas。
 *
 * 优先用 createImageBitmap 的 resize 选项：解码在 worker 线程完成，
 * 而且直接解到目标尺寸（2048² 的 PNG 只解成 1024²，像素工作量少 4 倍），
 * 比“整张解码再 drawImage 缩小”快很多。
 * 最终还是落在 canvas 上作载体——canvas 源的 flipY 行为确定，
 * 而 ImageBitmap 在不同平台对 UNPACK_FLIP_Y_WEBGL 的支持不一致，直接用会把贴图上下翻转。
 */
async function decodeToCanvas(bytes, ext, maxSize) {
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const blob = new Blob([bytes], { type: mime });

  if (typeof createImageBitmap === 'function') {
    try {
      const probe = await createImageBitmap(blob);
      const limit = Math.max(probe.width, probe.height);
      let bitmap = probe;
      if (limit > maxSize) {
        const scale = maxSize / limit;
        bitmap = await createImageBitmap(blob, {
          resizeWidth: Math.max(1, Math.round(probe.width * scale)),
          resizeHeight: Math.max(1, Math.round(probe.height * scale)),
          resizeQuality: 'high',
        });
        probe.close?.();
      }
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close?.();
      return canvas;
    } catch (error) {
      // 落到下面的 Image 路径
    }
  }

  const image = await blobToImage(bytes, ext);
  if (Math.max(image.width, image.height) <= maxSize) return image;
  const scale = maxSize / Math.max(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function makeTexture(source, srgb) {
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

  // 各材质的贴图并行解码：内嵌图是 2048² 的 PNG，串行解码会成为加载瓶颈
  await Promise.all(
    [...grouped.entries()].map(async ([materialName, items]) => {
      const entries = await Promise.all(
        items.map(async ({ entry, channel }) => {
          const info = CHANNEL_SLOTS[channel];
          const maxSize = config.textureSize[info.size] ?? 1024;
          try {
            const canvas = await decodeToCanvas(entry.bytes, entry.ext, maxSize);
            return [info.slot, await makeTexture(canvas, info.srgb)];
          } catch (error) {
            console.warn(`[character] 贴图 ${channel} 处理失败：${error.message}`);
            return null;
          }
        }),
      );
      const set = {};
      for (const item of entries) {
        if (item) set[item[0]] = item[1];
      }
      if (Object.keys(set).length) {
        byMaterial.set(materialName, set);
        report.materials += 1;
        report.textures += Object.keys(set).length;
      }
    }),
  );

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

/** 默认的动画清单：文件名决定槽位（Mixamo 把所有片段都叫 mixamo.com，只能靠文件名区分） */
export const DEFAULT_ANIMATIONS = [
  { slot: 'idle', url: './animations/anim_idle.fbx' },
  { slot: 'walk', url: './animations/anim_walk.fbx' },
  { slot: 'run', url: './animations/anim_run.fbx' },
  { slot: 'jump', url: './animations/anim_jump.fbx' },
];

/** 统一的 FBX 解析：屏蔽 FBXLoader 关于未知贴图通道 / 未知材质的刷屏警告 */
function parseFBX(buffer) {
  const originalWarn = console.warn;
  const suppressed = [];
  console.warn = (...args) => {
    const first = String(args[0] ?? '');
    if (
      first.includes('FBXLoader') &&
      (first.includes('is not supported in three.js') || first.includes('unknown material type'))
    ) {
      suppressed.push(first);
      return;
    }
    originalWarn.apply(console, args);
  };
  try {
    return new FBXLoader().parse(buffer, '');
  } finally {
    console.warn = originalWarn;
  }
}

/** 释放不再需要的子树（动画文件里往往重复带了一份完整模型） */
function disposeTree(root) {
  root.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) {
        material[key]?.dispose?.();
      }
      material.dispose?.();
    }
  });
}

/** 模型是否自带骨骼 */
export function hasSkeleton(root) {
  let found = false;
  root.traverse((node) => {
    if (node.isBone || node.isSkinnedMesh) found = true;
  });
  return found;
}

/**
 * 从一个 FBX 里抽出可用的动画片段。
 *
 * Mixamo 导出的片段名统一是 "mixamo.com"，而且同一个文件里还带一个空的 "Take 001"，
 * 所以这里取「时长最长的那个」并按调用方给的槽位重命名（idle / walk / run / jump）。
 */
export function pickLongestClip(animations) {
  if (!animations?.length) return null;
  return animations.reduce((best, clip) => (clip.duration > (best?.duration ?? 0) ? clip : best), null);
}

/**
 * 加载外部动画 FBX，只取出动画、丢掉里面重复的模型几何。
 *
 * @param {Array<{slot: string, url: string}>} files
 * @returns {Promise<Array<THREE.AnimationClip>>} 片段已按槽位重命名
 */
export async function loadAnimationClips(files = DEFAULT_ANIMATIONS) {
  const clips = [];
  const report = [];

  for (const { slot, url } of files) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const source = parseFBX(buffer);

      const clip = pickLongestClip(source.animations);
      if (clip) {
        const cloned = clip.clone();
        cloned.name = slot;
        clips.push(cloned);
        report.push(`${slot} ← ${url.split('/').pop()}（${clip.duration.toFixed(2)}s，${clip.tracks.length} 轨道）`);
      } else {
        report.push(`${slot} ← ${url.split('/').pop()}（没有动画片段，已跳过）`);
      }

      // 动画面里那份重复的模型不要留着占显存
      disposeTree(source);
    } catch (error) {
      report.push(`${slot} ← ${url} 加载失败：${error.message}`);
    }
  }

  console.log('[character] 动画片段：\n  ' + report.join('\n  '));
  return clips;
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
  const started = performance.now();
  const config = { ...CHARACTER_CONFIG, ...options, ...(options.textureSize ? {} : {}) };
  if (options.textureSize) config.textureSize = { ...CHARACTER_CONFIG.textureSize, ...options.textureSize };

  const tFetch0 = performance.now();
  const buffer = await fetchBuffer(url);
  const tFetch1 = performance.now();

  // 1) 先抠图（要用原始 buffer）
  const images = extractEmbeddedImages(buffer);
  const tExtract = performance.now();

  // 2) 解析几何与材质（警告屏蔽在 parseFBX 里）
  const object = parseFBX(buffer);
  const tParse = performance.now();
  const suppressed = [];

  // 3) 带骨骼的模型不能做程序化重姿态：T 形姿势就是绑定姿势
  const rigged = hasSkeleton(object);
  const repose = config.reposeArms && !rigged ? reposeArms(object, config) : { skipped: true };
  if (rigged && config.reposeArms) {
    console.log('[character] 检测到骨骼与蒙皮，已自动跳过「手臂下垂」重姿态（T 形姿势是绑定姿势）');
  }

  // 4) 用抠出来的贴图重建 PBR 材质
  const { byMaterial, report } = await buildMaterialTextures(images, config);
  const tTextures = performance.now();
  const upgraded = upgradeMaterials(object, byMaterial);

  // 蒙皮网格的包围体不随骨骼形变更新，容易被错误剔除，关掉视锥剔除
  object.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.frustumCulled = false;
      node.castShadow = true;
    }
  });

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
    rigged,
    armed: !repose.skipped,
    suppressedWarnings: suppressed.length,
  };

  const timing = {
    下载: Math.round(tFetch1 - tFetch0),
    抠图: Math.round(tExtract - tFetch1),
    解析: Math.round(tParse - tExtract),
    贴图解码: Math.round(tTextures - tParse),
    合计: Math.round(tTextures - tFetch0),
  };

  console.log(
    `[character] ${url}（合计 ${timing.合计} ms：下载 ${timing.下载}｜抠图 ${timing.抠图}｜解析 ${timing.解析}｜贴图解码 ${timing.贴图解码}）
` +
      `  顶点 ${stats.vertices}｜网格 ${stats.meshes}｜内嵌贴图 ${stats.images} 张 → 材质 ${stats.textures} 张贴图 / ${stats.materials} 个材质\n` +
      `  身高 ${stats.height} m｜朝向 ${stats.facing}（眼睛 z=${stats.eyeZ}）｜` +
      `${stats.rigged ? `骨骼蒙皮 ✓（自带 ${stats.clips.length} 个片段）` : '无骨骼（静态网格）'}` +
      `${stats.armed ? `｜手臂重姿态已应用（移动 ${repose.moved} 个顶点）` : ''}\n` +
      `  骨骼动画：${stats.clips.length ? stats.clips.join(', ') : '无'}` +
      (suppressed.length ? `\n  （已屏蔽 FBXLoader 的 ${suppressed.length} 条未知通道警告）` : ''),
  );

  return { object, clips, stats, images, timing };
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

/**
 * 估算动画片段自身的「地面速度」（米/秒）。
 *
 * 原理：一个循环内一只脚沿前进方向的前后行程 ≈ 步长，而一个循环走两步。
 * 有了这个速度，就能用「实际移动速度 ÷ 自然速度」当播放倍速，脚步不会打滑。
 *
 * 两个容易搞错的点：
 *   ① 脚的位置要换算到世界单位（模型已被归一化缩放过）；
 *   ② 要投影到「角色自己的前进轴」而不是世界 Z——否则角色转头后测量就不准。
 */
export function measureClipSpeed(clip, rig) {
  const samples = 32;
  let foot = null;
  let hips = null;
  rig.traverse((node) => {
    if (!foot && /leftfoot|left_foot|foot_l|leftankle/i.test(node.name)) foot = node;
    if (!hips && /hips|pelvis/i.test(node.name)) hips = node;
  });
  if (!foot || !hips || !clip.duration) return null;

  const mixer = new THREE.AnimationMixer(rig);
  const action = mixer.clipAction(clip);
  action.play();

  const footPos = new THREE.Vector3();
  const hipsPos = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  let minUp = Infinity;
  let maxUp = -Infinity;

  for (let i = 0; i <= samples; i += 1) {
    mixer.setTime((clip.duration * i) / samples);
    rig.updateMatrixWorld(true);
    foot.getWorldPosition(footPos);
    hips.getWorldPosition(hipsPos);

    // 模型局部 +Z 是面朝方向（已由 detectFacing 验证）
    rig.getWorldQuaternion(quaternion);
    forward.set(0, 0, 1).applyQuaternion(quaternion);
    delta.copy(footPos).sub(hipsPos);

    const along = delta.dot(forward);
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
    minUp = Math.min(minUp, delta.y);
    maxUp = Math.max(maxUp, delta.y);
  }

  action.stop();
  mixer.setTime(0);

  const step = maxAlong - minAlong;
  return {
    step: +step.toFixed(3),
    lift: +(maxUp - minUp).toFixed(3),
    speed: +((step * 2) / clip.duration).toFixed(3),
  };
}

/**
 * 标定跳跃片段：量出「离地起止时刻」，用来把动画的落地瞬间和物理落地对齐。
 *
 * 判别方法：看脚的高度曲线。脚回到站姿高度的那个时刻就是 contactTime；
 * 如果片段一开始脚就已经悬在空中（比如 Mixamo 的 Landing 动画），
 * 那它是「下落→落地」片段而不是完整的跳跃，代码需要区别对待。
 */
export function measureJumpClip(clip, rig) {
  if (!clip || !clip.duration) return null;
  let foot = null;
  rig.traverse((node) => {
    if (!foot && /leftfoot|left_foot|foot_l|leftankle/i.test(node.name)) foot = node;
  });
  if (!foot) return null;

  const samples = 60;
  const mixer = new THREE.AnimationMixer(rig);
  const action = mixer.clipAction(clip);
  action.play();

  const heights = [];
  const position = new THREE.Vector3();
  for (let i = 0; i <= samples; i += 1) {
    mixer.update(clip.duration / samples);
    rig.updateMatrixWorld(true);
    heights.push(foot.getWorldPosition(position).y);
  }
  action.stop();
  mixer.setTime(0);

  const ground = Math.min(...heights);
  const peak = Math.max(...heights);
  const lift = peak - ground;
  if (lift < 0.05) return null; // 脚基本没离地，不是跳跃片段

  const threshold = ground + lift * 0.25;
  const toTime = (index) => +((clip.duration * index) / samples).toFixed(3);
  const airborneStartIndex = heights.findIndex((y) => y > threshold);
  let contactIndex = samples;
  for (let i = 1; i <= samples; i += 1) {
    if (heights[i - 1] > threshold && heights[i] <= threshold) {
      contactIndex = i;
      break;
    }
  }

  return {
    duration: +clip.duration.toFixed(3),
    ground: +ground.toFixed(3),
    peak: +peak.toFixed(3),
    lift: +lift.toFixed(3),
    airborneStart: toTime(Math.max(airborneStartIndex, 0)),
    contactTime: toTime(contactIndex),
    startsAirborne: airborneStartIndex <= 1,
  };
}

/** 对一批片段做速度标定，返回每个槽位的自然速度（m/s）与详情 */
export function calibrateClipSpeeds(clips, rig) {
  const speeds = {};
  const details = {};
  for (const clip of clips) {
    if (!clip || clip.duration < 0.1) continue;
    try {
      const measured = measureClipSpeed(clip, rig);
      if (measured && measured.speed > 0.05) {
        speeds[clip.name] = measured.speed;
        details[clip.name] = measured;
      }
    } catch (error) {
      // 标定失败不影响播放，调用方会回退到默认倍速
    }
  }
  return { speeds, details };
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
