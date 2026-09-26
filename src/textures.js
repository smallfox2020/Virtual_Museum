/**
 * 程序化贴图：全部用 canvas 现画，不依赖任何图片素材。
 * 被 artifacts.js（展品）与 museum.js（建筑）共用。
 */

import * as THREE from 'three';

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

export function canvasTexture(canvas, { repeat, srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.anisotropy = 8;
  return texture;
}

/** 逐字测量的中文折行 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (line && ctx.measureText(line + char).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** 竖排文字（书画题款用） */
function verticalText(ctx, text, x, y, size, color, gap = 1.14) {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px "KaiTi", "STKaiti", "Songti SC", "SimSun", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let cursor = y;
  for (const char of text) {
    ctx.fillText(char, x, cursor);
    cursor += size * gap;
  }
}

/** 红色印章 */
function seal(ctx, x, y, size, text = '藏') {
  ctx.fillStyle = '#b32a24';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#f6ece0';
  ctx.font = `600 ${size * 0.62}px "KaiTi", "STKaiti", "Songti SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2 + 1);
}


/* ------------------------------------------------------------------ */
/* 由灰度推导法线贴图与粗糙度贴图                                      */
/*                                                                     */
/* 这是「让平面材质看起来有细节」性价比最高的手段：从颜色图的明暗       */
/* 反推高度场，再用 Sobel 差分求法线，平墙平地上就能出现勾缝、颗粒、     */
/* 笔触的立体感。采样按模运算环绕，保证平铺无缝。                       */
/* ------------------------------------------------------------------ */

/** @param {HTMLCanvasElement} source 颜色贴图 @param {number} strength 起伏强度 */
export function makeNormalMap(source, strength = 2.2) {
  const w = source.width;
  const h = source.height;
  const src = source.getContext('2d').getImageData(0, 0, w, h).data;
  const { canvas, ctx } = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);

  const heightAt = (x, y) => {
    const i = (((y % h) + h) % h) * w + (((x % w) + w) % w);
    const p = i * 4;
    // 感知亮度当高度场
    return (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255;
  };

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * strength;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * strength;
      // 图像 y 向下，法线的 y 取正号即 OpenGL 约定（three.js 用这套）
      const nx = -dx;
      const ny = dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * w + x) * 4;
      out.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** 粗糙度贴图：暗的地方光滑（抛光石材）、亮的地方粗糙（勾缝、灰浆） */
export function makeRoughnessMap(source, min = 0.18, max = 0.95) {
  const w = source.width;
  const h = source.height;
  const src = source.getContext('2d').getImageData(0, 0, w, h).data;
  const { canvas, ctx } = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);
  for (let i = 0; i < src.length; i += 4) {
    const lum = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
    const value = (1 - lum) * (max - min) + min;
    const v = Math.round(value * 255);
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* 建筑表面                                                            */
/* ------------------------------------------------------------------ */

/** 石材地面：一张贴图铺 4 × 4 块大板，带勾缝、云纹与斑晶 */
export function makeStoneFloorCanvas() {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size);
  const cell = size / 4;

  ctx.fillStyle = '#b3aca0';
  ctx.fillRect(0, 0, size, size);

  // 每块石板略有色差
  for (let gy = 0; gy < 4; gy += 1) {
    for (let gx = 0; gx < 4; gx += 1) {
      const tint = 0.94 + ((gx * 7 + gy * 13) % 5) * 0.022;
      ctx.fillStyle = `rgba(${Math.round(196 * tint)}, ${Math.round(188 * tint)}, ${Math.round(174 * tint)}, 1)`;
      ctx.fillRect(gx * cell + 2, gy * cell + 2, cell - 4, cell - 4);
    }
  }

  // 云纹：几条半透明的曲线，模拟大理石纹路
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i += 1) {
    const y0 = Math.random() * size;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(120,112,100,0.14)';
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y0 + Math.sin(x / 90 + i) * 14 + Math.cos(x / 37 + i * 2) * 6);
    }
    ctx.stroke();
  }

  // 斑晶：深浅两种小颗粒
  for (let i = 0; i < 5200; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.6 + Math.random() * 1.8;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(96,90,80,0.34)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 勾缝：先画深色底，再压一道浅色高光，法线贴图会把它变成凹槽
  ctx.strokeStyle = '#6d675c';
  ctx.lineWidth = 7;
  for (let i = 0; i <= 4; i += 1) {
    const p = i * cell;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.34)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    const p = i * cell + 4;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  return canvas;
}

/** 青铜器纹样变体：0 云雷纹 / 1 兽面纹 / 2 蟠螭纹 / 3 素面带锈 */
/**
 * 柱身贴图：竖向凹槽（fluting）+ 颗粒 / 木纹。
 *
 * 柱子最怕「一根光溜溜的圆柱」，低模也救不回来。
 * 沿圆周方向排一组凹槽，用「暗—亮—暗」的横向渐变把棱和槽画出来，
 * 再叠颗粒或木纹，远看就有石柱、木柱的质感。
 * 贴图本身是中性色，色相交给材质的 color 决定，一张图能复用到多种柱子。
 */
export function makeColumnCanvas(kind = 'stone') {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  const flutes = kind === 'wood' ? 0 : 8;
  ctx.fillStyle = kind === 'wood' ? '#b9a58c' : kind === 'lattice' ? '#8d8577' : '#cfc8ba';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < flutes; i += 1) {
    const w = size / flutes;
    const g = ctx.createLinearGradient(i * w, 0, i * w + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.34)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.30)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(i * w, 0, w, size);
  }

  if (kind === 'wood') {
    for (let i = 0; i < 90; i += 1) {
      const x = Math.random() * size;
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 0.6 + Math.random() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (Math.random() - 0.5) * 12, size / 3, x + (Math.random() - 0.5) * 12, (size * 2) / 3, x + (Math.random() - 0.5) * 8, size);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 2400; i += 1) {
    const a = Math.random() * 0.13;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4);
  }
  return canvas;
}

export function makeBronzeCanvas(variant = 0) {
  const w = 1024;
  const h = 1024;
  const { canvas, ctx } = makeCanvas(w, h);

  const bases = ['#82957c', '#7d8b84', '#8a8f78', '#8b9285'];
  ctx.fillStyle = bases[variant % bases.length];
  ctx.fillRect(0, 0, w, h);

  if (variant === 0) {
    // 云雷纹：回字形螺旋，两种尺寸交错
    ctx.strokeStyle = 'rgba(38, 52, 42, 0.5)';
    for (let gy = 0; gy < 8; gy += 1) {
      for (let gx = 0; gx < 8; gx += 1) {
        const cx = gx * 128 + 64;
        const cy = gy * 128 + 64;
        const dir = (gx + gy) % 2 === 0 ? 1 : -1;
        ctx.lineWidth = 7;
        for (let i = 0; i < 5; i += 1) {
          const r = 48 - i * 9;
          ctx.beginPath();
          ctx.moveTo(cx + dir * r, cy - r);
          ctx.lineTo(cx + dir * r, cy + r);
          ctx.lineTo(cx - dir * r, cy + r);
          ctx.lineTo(cx - dir * r, cy - r + 10);
          ctx.stroke();
        }
      }
    }
  } else if (variant === 1) {
    // 兽面纹：中央对称的双眼 + 角 + 云雷地
    ctx.strokeStyle = 'rgba(34, 46, 38, 0.55)';
    ctx.lineWidth = 5;
    for (let gy = 0; gy < 16; gy += 1) {
      for (let gx = 0; gx < 16; gx += 1) {
        const cx = gx * 64 + 32;
        const cy = gy * 64 + 32;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 1.5);
        ctx.stroke();
      }
    }
    for (let face = 0; face < 4; face += 1) {
      const ox = (face % 2) * 512 + 256;
      const oy = Math.floor(face / 2) * 512 + 256;
      ctx.strokeStyle = 'rgba(26, 36, 30, 0.85)';
      ctx.lineWidth = 11;
      // 双目
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(ox + side * 62, oy - 10, 34, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ox + side * 62, oy - 10, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 鼻梁与角
      ctx.beginPath();
      ctx.moveTo(ox, oy - 54);
      ctx.lineTo(ox, oy + 62);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(ox + side * 20, oy - 56);
        ctx.quadraticCurveTo(ox + side * 98, oy - 96, ox + side * 120, oy - 20);
        ctx.stroke();
      }
    }
  } else if (variant === 2) {
    // 蟠螭纹：密集的缠绕曲线
    ctx.strokeStyle = 'rgba(30, 44, 36, 0.5)';
    for (let i = 0; i < 240; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 14 + Math.random() * 40;
      ctx.lineWidth = 3 + Math.random() * 4;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.random() * Math.PI, Math.random() * Math.PI + 2);
      ctx.stroke();
    }
  }
  // variant 3 是素面：只保留下面的锈色

  // 锈色斑驳：各变体都有，但深浅不同
  const rust = variant === 3 ? 0.28 : 0.16;
  for (let i = 0; i < 320; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 6 + Math.random() * 54;
    const tone = Math.random();
    ctx.fillStyle = tone < 0.4
      ? `rgba(74, 132, 104, ${rust})`
      : tone < 0.75
        ? `rgba(176, 146, 84, ${rust * 0.8})`
        : `rgba(52, 44, 38, ${rust * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 高光磨损
  for (let i = 0; i < 160; i += 1) {
    ctx.fillStyle = `rgba(226, 220, 190, ${0.05 + Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 26, 4 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/**
 * 墙面变体：**底色完全相同，只有表面细节不同**。
 *
 * 之前 4 个变体连颜色一起换（米白/暖砂/浅灰/深黑），同一个大厅里出现黑白灰混搭，
 * 看起来像贴错图。现在统一用米白抹灰底，只让「抹刀痕 / 砂粒 / 对缝 / 竖纹」这些
 * 细节产生差别，观感上是同一面墙的不同做法。
 */
export function makeWallCanvas(variant = 0) {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#ddd6c9';
  ctx.fillRect(0, 0, size, size);

  if (variant === 2) {
    // 石材对缝：两行两列大板，缝很浅
    ctx.strokeStyle = 'rgba(150,144,132,0.42)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 2; i += 1) {
      const p2 = (i * size) / 2;
      ctx.beginPath(); ctx.moveTo(p2, 0); ctx.lineTo(p2, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p2); ctx.lineTo(size, p2); ctx.stroke();
    }
    for (let i = 0; i < 22; i += 1) {
      ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(146,140,128,0.09)';
      ctx.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 26) ctx.lineTo(x, y + Math.sin(x / 50 + i) * 5);
      ctx.stroke();
    }
  } else if (variant === 3) {
    // 竖向细纹：浅槽，不改色调
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(120,112,100,0.075)';
      ctx.fillRect(x, 0, 6, size);
    }
  } else {
    // 抹刀痕（variant 1 更密）
    const rounds = variant === 1 ? 22 : 14;
    for (let i = 0; i < rounds; i += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.05})`;
      ctx.lineWidth = 24;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.quadraticCurveTo(size / 2, y + (Math.random() - 0.5) * 120, size + 20, y + (Math.random() - 0.5) * 60);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i += 1) {
      ctx.strokeStyle = `rgba(150,142,128,${0.04 + Math.random() * 0.05})`;
      ctx.lineWidth = 18;
      const x = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 100, size / 2, x + (Math.random() - 0.5) * 60, size + 20);
      ctx.stroke();
    }
  }

  // 细颗粒：密度随变体变化，颜色不改
  const grain = variant === 1 ? 0.24 : 0.2;
  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() < 0.5
      ? `rgba(255,255,255,${grain})`
      : `rgba(150,142,128,${grain * 0.7})`;
    ctx.fillRect(x, y, 1.3, 1.3);
  }

  // 剥落墙皮：只在抹灰面上出现
  if (variant === 0 || variant === 1) {
    for (let i = 0; i < 26; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 2 + Math.random() * 9;
      ctx.fillStyle = 'rgba(200,192,178,0.42)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.7), Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(x - 1, y - 1, r * 0.7, r * 0.45, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

/** 深色石材墙裙 */
export function makeSkirtingCanvas() {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 40; i += 1) {
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(12,14,18,0.18)';
    ctx.lineWidth = 1 + Math.random() * 3;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 24) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 7);
    ctx.stroke();
  }
  for (let i = 0; i < 3600; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  // 顶部一道亮边（被磨光的位置）
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, size, 5);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* 建筑贴图                                                            */
/* ------------------------------------------------------------------ */

/** 石材地面贴图（一张铺 4 × 4 块板，法线与粗糙度由颜色图推导） */
export function makeFloorTexture(repeatX, repeatY) {
  const canvas = makeStoneFloorCanvas();
  const texture = canvasTexture(canvas, { repeat: [repeatX, repeatY] });
  texture.anisotropy = 8;
  return texture;
}

/** 藻井吊顶 */
export function makeCeilingTexture(repeatX, repeatY) {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#23262f';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#3b3f4c';
  ctx.lineWidth = 8;
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
  ctx.strokeStyle = 'rgba(156, 43, 36, 0.85)';
  ctx.lineWidth = 6;
  ctx.strokeRect(size * 0.22, size * 0.22, size * 0.56, size * 0.56);
  ctx.fillStyle = 'rgba(199, 154, 44, 0.5)';
  ctx.fillRect(size * 0.44, size * 0.44, size * 0.12, size * 0.12);
  return canvasTexture(canvas, { repeat: [repeatX, repeatY] });
}

/** 黑漆朱绘云纹 */
export function makeLacquerTexture() {
  const w = 512;
  const h = 512;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#1a1412';
  ctx.fillRect(0, 0, w, h);
  const cloud = (cx, cy, radius, color, lineWidth) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius - i * (radius * 0.26), Math.PI * 0.15, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx + radius * 1.1, cy + radius * 0.2, radius * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const cx = col * (w / 4) + w / 8;
      const cy = row * (h / 4) + h / 8;
      cloud(cx, cy, 44, 'rgba(156, 43, 36, 0.95)', 6);
      cloud(cx + 18, cy - 12, 26, 'rgba(199, 154, 44, 0.55)', 3);
    }
  }
  ctx.strokeStyle = 'rgba(156, 43, 36, 0.9)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  return canvasTexture(canvas);
}

/** 孔雀蓝琉璃天窗 */
export function makeSkylightTexture() {
  const w = 512;
  const h = 512;
  const { canvas, ctx } = makeCanvas(w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#f6fcff');
  gradient.addColorStop(0.35, '#c3e9f6');
  gradient.addColorStop(0.7, '#3f9cbb');
  gradient.addColorStop(1, '#1d6f88');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 6;
  for (let i = 1; i < 6; i += 1) {
    const p = (i * w) / 6;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(w, p);
    ctx.stroke();
  }
  return canvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* 器物贴图                                                            */
/* ------------------------------------------------------------------ */

/** 青铜器贴图：variant 决定纹样，repeat 调低避免一眼看出平铺 */
export function makeBronzeTexture(variant = 0) {
  const texture = canvasTexture(makeBronzeCanvas(variant), { repeat: [2, 1] });
  texture.anisotropy = 8;
  return texture;
}

/** 铜镜背面：蟠螭纹 + 同心弦纹 */
export function makeMirrorTexture() {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.fillStyle = '#5f6f5c';
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(c, c);
  ctx.strokeStyle = 'rgba(30, 42, 34, 0.75)';
  for (const radius of [232, 214, 150, 132, 74, 60]) {
    ctx.lineWidth = radius > 200 ? 9 : 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 四组蟠螭
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.rotate((i / 4) * Math.PI * 2);
    ctx.strokeStyle = 'rgba(28, 40, 32, 0.8)';
    ctx.lineWidth = 6;
    for (let k = 0; k < 5; k += 1) {
      ctx.beginPath();
      ctx.arc(100, 0, 26 - k * 5, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(150 + k * 12, 20 + k * 9, 20, 9, k * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(150, 170, 140, 0.16)';
  for (let i = 0; i < 200; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 3 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas);
}

/** 元青花：白地钴蓝缠枝 + 四面开光 */
export function makePorcelainTexture() {
  const w = 1024;
  const h = 768;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#f4f6f2';
  ctx.fillRect(0, 0, w, h);
  const blue = '#2b4fa0';
  const pale = 'rgba(43, 79, 160, 0.42)';

  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, w, 14);
  ctx.fillRect(0, h - 18, w, 18);
  ctx.strokeStyle = pale;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.lineTo(w, 40);
  ctx.stroke();

  const scroll = (y, scale) => {
    ctx.strokeStyle = blue;
    ctx.lineWidth = 5;
    for (let i = 0; i < 16; i += 1) {
      const x = (i * w) / 16 + 32;
      ctx.beginPath();
      ctx.arc(x, y, 22 * scale, 0.2 * Math.PI, 1.5 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 34 * scale, y + 4, 10 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + 62 * scale, y - 6, 16 * scale, 8 * scale, 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  scroll(74, 1);
  scroll(h - 74, 1);

  for (let i = 0; i < 4; i += 1) {
    const cx = (i + 0.5) * (w / 4);
    const cy = h * 0.5;
    ctx.strokeStyle = blue;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 4 / 2 - 34, 190, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = pale;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 4 / 2 - 48, 176, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = blue;
    ctx.beginPath();
    ctx.arc(cx + 34, cy + 46, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx + 22, cy + 62, 24, 54);
    ctx.strokeStyle = blue;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy + 96);
    ctx.lineTo(cx - 20, cy + 76);
    ctx.lineTo(cx + 30, cy + 96);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 62, cy + 80);
    ctx.lineTo(cx - 54, cy - 40);
    ctx.stroke();
    for (let k = 0; k < 5; k += 1) {
      ctx.beginPath();
      ctx.arc(cx - 54 + (k - 2) * 26, cy - 52 - Math.abs(k - 2) * 12, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return canvasTexture(canvas);
}

/** 彩陶：旋纹与网格纹 */
export function makePotteryTexture() {
  const w = 512;
  const h = 512;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#c2795a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(58, 32, 24, 0.8)';
  ctx.lineWidth = 7;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = 60 + i * 96 + Math.sin(x / 40 + i) * 16;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (let i = 0; i < 60; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 14, y + 14);
    ctx.moveTo(x + 14, y);
    ctx.lineTo(x, y + 14);
    ctx.stroke();
  }
  return canvasTexture(canvas, { repeat: [2, 1] });
}

/** 竹简：一根简上的墨书 */
export function makeSlipTexture() {
  const w = 128;
  const h = 1024;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#b98f52';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120, 86, 42, 0.35)';
  for (let i = 0; i < 40; i += 1) ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 5);
  ctx.fillStyle = 'rgba(30, 24, 18, 0.88)';
  ctx.font = '600 62px "KaiTi", "STKaiti", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyphs = '道可道非常名無名天地之始有名萬物之母';
  for (let i = 0; i < 13; i += 1) {
    ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], w / 2, 60 + i * 74);
  }
  return canvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* 书画立轴                                                            */
/* ------------------------------------------------------------------ */

const SCROLL_KINDS = {
  shanshui: { title: '楚山烟雨', color: '#3a3a3a' },
  zhuzi: { title: '墨竹', color: '#2f3a2f' },
  shufa: { title: '行书', color: '#26262a' },
  huaniao: { title: '花鸟', color: '#4a3a34' },
};

/** 书画立轴：kind ∈ shanshui / zhuzi / shufa / huaniao */
export function makeScrollTexture(kind, seed = 0) {
  const w = 800;
  const h = 1500;
  const { canvas, ctx } = makeCanvas(w, h);

  // 绫裱 + 画心
  ctx.fillStyle = '#d9cdb0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c8b894';
  ctx.fillRect(0, 0, w, 46);
  ctx.fillRect(0, h - 46, w, 46);
  ctx.fillStyle = '#f3efe2';
  ctx.fillRect(70, 90, w - 140, h - 180);
  ctx.strokeStyle = 'rgba(90, 74, 48, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 90, w - 140, h - 180);

  ctx.save();
  ctx.beginPath();
  ctx.rect(70, 90, w - 140, h - 180);
  ctx.clip();

  const cx = w / 2;
  if (kind === 'shanshui') {
    // 远山、云雾、孤舟
    const hill = (baseY, height, alpha, offset) => {
      ctx.fillStyle = `rgba(58, 66, 74, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(70, baseY);
      for (let x = 70; x <= w - 70; x += 20) {
        const y = baseY - Math.sin((x + offset) / 150) * height * 0.5 - Math.sin((x + offset) / 47) * height * 0.18;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w - 70, baseY);
      ctx.closePath();
      ctx.fill();
    };
    hill(760, 260, 0.22, 0);
    hill(880, 320, 0.32, 260);
    hill(1010, 240, 0.45, 520);
    ctx.fillStyle = 'rgba(240, 244, 248, 0.5)';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.ellipse(140 + i * 130 + seed * 20, 860 + (i % 2) * 60, 150, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(246, 242, 230, 0.95)';
    ctx.beginPath();
    ctx.arc(w - 210, 250, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e3236';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 90, 1120);
    ctx.lineTo(cx + 90, 1120);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 40, 1105, 16, Math.PI, 0);
    ctx.stroke();
  } else if (kind === 'zhuzi') {
    for (let s = 0; s < 3; s += 1) {
      const x = cx - 130 + s * 130 + (s % 2) * 18;
      ctx.strokeStyle = 'rgba(38, 48, 36, 0.92)';
      ctx.lineWidth = 22 - s * 4;
      ctx.beginPath();
      ctx.moveTo(x, 1330);
      ctx.quadraticCurveTo(x + 14, 900, x - 10, 200);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let n = 0; n < 6; n += 1) {
        const y = 1250 - n * 175;
        ctx.beginPath();
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x + 16, y - 6);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(44, 56, 40, 0.9)';
      for (let l = 0; l < 11; l += 1) {
        const y = 1280 - l * 100;
        const dir = l % 2 === 0 ? 1 : -1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(dir * 0.6 - 0.35);
        ctx.beginPath();
        ctx.ellipse(dir * 42, 0, 46, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  } else if (kind === 'shufa') {
    // 这里原来是写死的一首四句诗，完全没用 seed ——
    // 于是八件书法挂的是同一张字（像素级完全相同）。
    // 现在按 seed 从诗库里挑一首，并连带变列数、墨色、字号、落款位置。
    const poems = [
      ['楚水清若空', '遥将碧海通', '山随平野尽', '江入大荒流'],
      ['江流天地外', '山色有无中', '郡邑浮前浦', '波澜动远空'],
      ['一钟双音在', '千年古乐存', '曾侯随水去', '编磬有余声'],
      ['凤鸟鸣高冈', '鹿角立其旁', '楚人好巫祀', '漆画满棺床'],
      ['汉水东南流', '云梦泽中舟', '渔歌相答处', '芦荻满汀洲'],
      ['越王勾践剑', '埋土两千秋', '出鞘寒光在', '犹能断吴钩'],
      ['简牍藏楚字', '墨迹八百年', '一撇还如昨', '观者不知言'],
      ['苍璧礼天穹', '黄琮分地脉', '玉琮与玉璧', '礼器见王风'],
    ];
    const poem = poems[seed % poems.length];
    const columns = 3 + (seed % 2);
    const ink = ['#22222a', '#1a1f26', '#2b2118'][seed % 3];
    const size = 70 + (seed % 4) * 8;
    const startX = 180 + (seed % 3) * 24;
    const startY = 210 + (seed % 2) * 46;
    poem.slice(0, columns).forEach((line, i) => {
      verticalText(ctx, line, startX + i * 132, startY, size, ink);
    });
    // 落款与朱印：位置随 seed 变，进一步拉开各幅的差别
    ctx.fillStyle = 'rgba(150, 32, 28, 0.88)';
    ctx.fillRect(1020 - (seed % 4) * 34, 1090 + (seed % 3) * 42, 54, 54);
    ctx.fillStyle = 'rgba(60, 60, 66, 0.75)';
    ctx.fillRect(1030 - (seed % 4) * 34, 1010 + (seed % 3) * 42, 34, 70);
  } else {
    // 花鸟：梅枝与雀
    ctx.strokeStyle = 'rgba(72, 52, 40, 0.9)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(120, 1300);
    ctx.quadraticCurveTo(330, 1000, 300, 560);
    ctx.quadraticCurveTo(290, 400, 430, 250);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(310, 720);
    ctx.quadraticCurveTo(520, 640, 660, 520);
    ctx.stroke();
    for (let i = 0; i < 46; i += 1) {
      const t = i / 46;
      const x = 300 + Math.sin(i * 1.7 + seed) * 210 * t + t * 260;
      const y = 1250 - t * 1050 + Math.cos(i * 2.3) * 60;
      ctx.fillStyle = i % 5 === 0 ? 'rgba(178, 46, 52, 0.9)' : 'rgba(238, 232, 224, 0.95)';
      ctx.beginPath();
      ctx.arc(x, y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 84, 70, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(58, 52, 48, 0.95)';
    ctx.beginPath();
    ctx.ellipse(560, 430, 46, 30, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(608, 402, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(628, 402);
    ctx.lineTo(662, 414);
    ctx.lineTo(626, 420);
    ctx.closePath();
    ctx.fillStyle = '#c9a03c';
    ctx.fill();
  }

  // 题款与印章
  const info = SCROLL_KINDS[kind] ?? SCROLL_KINDS.shanshui;
  verticalText(ctx, info.title, w - 150, 190, 44, '#2a2a2e');
  seal(ctx, w - 178, 430, 46, '楚');
  ctx.restore();

  // 轴杆
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(0, 0, w, 26);
  ctx.fillRect(0, h - 26, w, 26);
  return canvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* 展板、匾额、导览图                                                  */
/* ------------------------------------------------------------------ */

/** 展板：米色底 + 楚红题头 + 正文 */
export function makePanelTexture(config) {
  if (config.plan) return makePlanTexture(config.layout);

  const w = 1040;
  const h = 720;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9c2b24';
  ctx.fillRect(0, 0, w, h * 0.17);
  ctx.fillStyle = '#e8c96a';
  ctx.fillRect(0, h * 0.17, w, 6);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8ecd4';
  ctx.font = '600 66px "Songti SC", "Noto Serif SC", "SimSun", serif';
  ctx.fillText(config.title, 56, h * 0.088);

  ctx.fillStyle = 'rgba(248, 236, 212, 0.72)';
  ctx.font = '400 26px "Segoe UI", system-ui, sans-serif';
  const titleWidth = ctx.measureText(config.title).width;
  ctx.fillText(config.subtitle ?? '', 56 + Math.max(titleWidth, 220) + 28, h * 0.098);

  ctx.fillStyle = '#3b3a36';
  ctx.font = '400 33px "Songti SC", "Noto Serif SC", "SimSun", serif';
  const lines = wrapText(ctx, config.body ?? '', w - 112);
  let y = h * 0.17 + 74;
  for (const line of lines) {
    if (y > h - 56) break;
    ctx.fillText(line, 56, y);
    y += 33 * 1.62;
  }

  ctx.strokeStyle = '#c9bfa8';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  return canvasTexture(canvas);
}

/** 序厅导览图：直接按布局数据画出平面 */
export function makePlanTexture(layout) {
  const w = 1320;
  const h = 900;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9c2b24';
  ctx.fillRect(0, 0, w, 96);
  ctx.fillStyle = '#e8c96a';
  ctx.fillRect(0, 96, w, 5);
  ctx.fillStyle = '#f8ecd4';
  ctx.font = '600 52px "Songti SC", "Noto Serif SC", "SimSun", serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('展厅平面示意', 40, 50);

  const pad = 42;
  const top = 132;
  const bottom = 96;
  const scale = Math.min(
    (w - pad * 2) / (layout.halfX * 2 + 1),
    (h - top - bottom) / (layout.halfZ * 2 + 1),
  );
  const cx = w / 2;
  const cz = top + (h - top - bottom) / 2;
  const mx = (x) => cx + x * scale;
  const mz = (z) => cz + z * scale;

  // 展厅
  for (const zone of layout.zones) {
    const [x0, x1, z0, z1] = zone.rect;
    ctx.fillStyle = zone.fill;
    ctx.fillRect(mx(x0), mz(z0), (x1 - x0) * scale, (z1 - z0) * scale);
  }

  // 外墙
  ctx.strokeStyle = '#2f2a24';
  ctx.lineWidth = 10;
  ctx.strokeRect(mx(-layout.halfX), mz(-layout.halfZ), layout.halfX * 2 * scale, layout.halfZ * 2 * scale);

  // 隔墙
  ctx.strokeStyle = '#8a7f6c';
  ctx.lineWidth = 7;
  for (const wall of layout.planWalls) {
    ctx.beginPath();
    ctx.moveTo(mx(wall[0]), mz(wall[1]));
    ctx.lineTo(mx(wall[2]), mz(wall[3]));
    ctx.stroke();
  }

  // 门洞
  ctx.strokeStyle = '#c98b2a';
  ctx.lineWidth = 13;
  for (const door of layout.planDoors) {
    ctx.beginPath();
    ctx.moveTo(mx(door[0]), mz(door[1]));
    ctx.lineTo(mx(door[2]), mz(door[3]));
    ctx.stroke();
  }

  // 编钟（曲尺形）
  ctx.fillStyle = '#8a5a2b';
  const bell = layout.bells;
  ctx.fillRect(mx(bell[0]), mz(bell[1]), (bell[2] - bell[0]) * scale, (bell[3] - bell[1]) * scale);
  ctx.fillRect(mx(bell[4]), mz(bell[5]), (bell[6] - bell[4]) * scale, (bell[7] - bell[5]) * scale);

  // 展厅名
  ctx.textAlign = 'center';
  for (const zone of layout.zones) {
    const [x0, x1, z0, z1] = zone.rect;
    const zc = (z0 + z1) / 2;
    const vertical = z1 - z0 > (x1 - x0) * 1.4;
    ctx.fillStyle = '#3b3a36';
    ctx.font = `600 ${Math.max(19, Math.min(30, (x1 - x0) * scale / 6.2))}px "Songti SC", "Noto Serif SC", serif`;
    if (vertical) {
      const text = zone.name;
      let y = mz(zc) - ((text.length - 1) * 34) / 2;
      for (const char of text) {
        ctx.fillText(char, mx((x0 + x1) / 2), y);
        y += 34;
      }
    } else {
      ctx.fillText(zone.name, mx((x0 + x1) / 2), zone.id === 'bells' ? mz(zc) + 44 : mz(zc));
      if (zone.sub) {
        ctx.fillStyle = '#8b8272';
        ctx.font = '400 20px "Segoe UI", "Songti SC", sans-serif';
        ctx.fillText(zone.sub, mx((x0 + x1) / 2), mz(zc) + 78);
        ctx.fillStyle = '#3b3a36';
      }
    }
  }

  // 观众位置
  ctx.fillStyle = '#c98b2a';
  ctx.beginPath();
  ctx.arc(mx(0), mz(layout.spawn[1]), 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = '400 22px "Segoe UI", "Songti SC", sans-serif';
  ctx.fillStyle = '#6a6252';
  ctx.fillText('● 观众位置      ▬ 出入口      ▬ 隔墙      ● 镇馆之宝', 40, h - 42);
  return canvasTexture(canvas);
}

/** 匾额：黑漆描金 */
export function makeSignTexture(name, sub) {
  const w = 1024;
  const h = sub ? 256 : 192;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = '#241512';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c79a2c';
  ctx.lineWidth = 6;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.strokeStyle = 'rgba(156, 43, 36, 0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8c96a';
  const size = sub ? 108 : 116;
  ctx.font = `600 ${size}px "KaiTi", "STKaiti", "Songti SC", "SimSun", serif`;
  const spacing = size * 0.16;
  const widths = [...name].map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width + spacing, -spacing);
  let x = (w - total) / 2;
  const baseY = sub ? h * 0.42 : h * 0.5;
  for (let i = 0; i < name.length; i += 1) {
    ctx.fillText(name[i], x + widths[i] / 2, baseY);
    x += widths[i] + spacing;
  }
  if (sub) {
    ctx.fillStyle = 'rgba(199, 154, 44, 0.8)';
    ctx.font = '400 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(sub, w / 2, h * 0.78);
  }
  return canvasTexture(canvas);
}
