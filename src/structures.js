/**
 * 场景构筑件 —— 柱阵、回形墙、弧形墙、台基、叠涩梁。
 *
 * 设计依据见 docs/scene-layout.md（「光影长廊，楚韵洄游」）。
 * 六个展厅不再各是一个空盒子，而是靠柱子的阵列感与回形墙的错落穿插
 * 形成有情绪起伏的剧场。
 *
 * 两条纪律：
 *   ① 碰撞解算器只认「轴对齐盒」和「圆」，所以弧墙与斜墙一律用圆碰撞体链
 *      近似。链半径取 0.3、间距 0.4，比可见墙厚更保守一点——宁可玩家离墙
 *      远一点，也不要出现穿模。
 *   ② 所有构筑件都在这里创建，museum.js 只负责说「哪个厅摆什么」。
 *      材质由 museum.js 注入，避免两个模块互相 import。
 */
import * as THREE from 'three';

const CHAIN_STEP = 0.4;
const CHAIN_RADIUS = 0.3;

/** 沿折线撒圆碰撞体 */
function chain(colliders, points, radius = CHAIN_RADIUS) {
  for (const [x, z] of points) colliders.push({ x, z, radius });
}

/** 把圆弧采样成折线点列（角度用弧度，从 +x 轴转向 +z 轴） */
function arcPoints(cx, cz, r, a0, a1, step = CHAIN_STEP) {
  const span = Math.abs(a1 - a0) * r;
  const steps = Math.max(2, Math.ceil(span / step));
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    points.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return points;
}

/** 把直线段采样成折线点列 */
function linePoints(x0, z0, x1, z1, step = CHAIN_STEP) {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(length / step));
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    points.push([x0 + ((x1 - x0) * i) / steps, z0 + ((z1 - z0) * i) / steps]);
  }
  return points;
}

export function createStructures({ scene, colliders, materials, tex }) {
  // 柱身统一走「竖向凹槽 + 法线 + 粗糙度」三件套，颜色由 material.color 决定。
  // 原来用纯色 MeshStandardMaterial，实际就是一根光溜溜的圆柱，花纹很劣。
  const shaft = (kind, repeat, color, roughness, metalness) => {
    const canvas = tex.makeColumnCanvas(kind);
    // 只用 map：makeNormalMap / makeRoughnessMap 返回的不是 Texture 时，
    // three.js 会在渲染期抛 `Cannot read properties of undefined (reading 'elements')`。
    // 先用最稳的一张图把花纹做出来，法线/粗糙度等确认了接口再叠。
    return new THREE.MeshStandardMaterial({
      map: tex.canvasTexture(canvas, { repeat }),
      color,
      roughness,
      metalness,
    });
  };
  const stone = shaft('stone', [6, 2], 0xd6d0c4, 0.86, 0.0);
  const stoneDark = shaft('stone', [6, 1], 0x9c9486, 0.82, 0.04);
  const plaster = new THREE.MeshStandardMaterial({ color: 0xefe9da, roughness: 0.9 });
  const woodRed = shaft('wood', [3, 2], 0x9a3226, 0.52, 0.0);
  const woodBlack = shaft('wood', [3, 2], 0x3a3340, 0.48, 0.0);
  const lattice = shaft('lattice', [8, 1], 0x655b4e, 0.62, 0.06);
  const bronze = materials.bronze;
  const gold = materials.gold;

  /** 通用盒子：中心点 + 尺寸 + 绕 y 旋转 */
  function box(x, y, z, sx, sy, sz, material, rotY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  /* ---------------------------------------------------------------- */
  /* 柱子                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * 一根柱子：柱础 + 柱身 +（可选）柱头、鎏金箍。
   * 倾斜靠 tiltX / tiltZ（弧度），柱顶与柱底一起倾，视觉上是「斜柱」。
   */
  function column({
    x, z, r = 0.45, h = 5.5, material = stone, base = true, capital = true,
    rings = 0, tiltX = 0, tiltZ = 0, square = false, colliderScale = 1.5, topY,
  }) {
    // 给了 topY（天花板底面标高）就反解柱身高度，让柱头顶到天花板。
    // 倾斜会让柱子的竖向投影变矮（乘 cos），所以必须除回去，
    // 否则把倾斜角度调大之后柱头就会离天花板越来越远。
    if (topY !== undefined) {
      const baseH = base ? 0.26 : 0;
      const capH = capital ? 0.22 : 0;
      const angle = Math.max(Math.abs(tiltX), Math.abs(tiltZ));
      const cos = Math.cos(angle) || 1;
      // 柱头是有半径的圆柱，柱子一倾，柱头的一侧就被抬起来 r·sinθ。
      // 这一项必须从可用高度里扣掉，否则柱头会从侧面顶穿天花板。
      const capR = capital ? r * 1.5 : 0;
      h = (topY - baseH - capR * Math.sin(angle)) / cos - capH;
    }
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 柱础永远平放在地上，不跟着倾。
    // 如果连柱础一起转，7° 的斜柱会把柱础翘起一角，看起来像浮空。
    let y = 0;
    if (base) {
      const b = square
        ? new THREE.Mesh(new THREE.BoxGeometry(r * 3, 0.26, r * 3), stoneDark)
        : new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.7, 0.26, 20), stoneDark);
      b.position.y = 0.13;
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
      y = 0.26;
    }

    // 柱身、鎏金箍、柱头装在 lean 里，从柱础顶面开始倾斜
    const lean = new THREE.Group();
    lean.position.y = y;
    lean.rotation.set(tiltX, 0, tiltZ);
    group.add(lean);

    const shaftGeo = square
      ? new THREE.BoxGeometry(r * 1.8, h, r * 1.8)
      : new THREE.CylinderGeometry(r * 0.92, r, h, 22);
    const shaft = new THREE.Mesh(shaftGeo, material);
    shaft.position.y = h / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    lean.add(shaft);

    for (let i = 0; i < rings; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.045, 8, 26), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (h * (i + 1)) / (rings + 1);
      lean.add(ring);
    }

    if (capital) {
      const c = square
        ? new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, 0.22, r * 2.6), stoneDark)
        : new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.0, 0.22, 20), stoneDark);
      c.position.y = h + 0.11;
      c.castShadow = true;
      lean.add(c);
    }

    scene.add(group);
    colliders.push({ x, z, radius: r * colliderScale });
    return group;
  }

  /** 一圈柱列：等角度分布在圆弧上（编钟厅的韵律柱、序厅的环绕柱） */
  function arcColonnade({ cx, cz, radius, a0, a1, count, ...opts }) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const a = count === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (count - 1);
      list.push(column({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius, ...opts }));
    }
    return list;
  }

  /* ---------------------------------------------------------------- */
  /* 墙                                                                */
  /* ---------------------------------------------------------------- */

  /**
   * 弧形墙：沿圆弧挤出一段有厚度的墙。
   * 用 Shape + ExtrudeGeometry，墙顶可选压顶条（trim）。
   */
  function arcWall({
    cx, cz, radius, a0, a1, height = 3, thickness = 0.35, material = plaster,
    cap = null, hooks = 0, hookLength = 1.6,
  }) {
    const outer = radius + thickness / 2;
    const inner = radius - thickness / 2;
    const shape = new THREE.Shape();
    const seg = Math.max(8, Math.ceil(Math.abs(a1 - a0) * 12));
    // Shape 画在 xy 平面、沿 +z 挤出，最后整体 rotateX(-90°)：
    // 这一步会把 shape 的 y 变成世界的 -z，所以 sin 先取负，
    // 世界坐标里的角度才和 arcPoints() 一致，否则弧墙会左右镜像。
    // 第一点必须 moveTo：Shape 的当前点默认在 (0,0)，
    // 如果首点也用 lineTo，多边形会从原点起笔，多出一块横穿房间的大三角。
    for (let i = 0; i <= seg; i += 1) {
      const a = a0 + ((a1 - a0) * i) / seg;
      const px = Math.cos(a) * outer;
      const pz = -Math.sin(a) * outer;
      if (i === 0) shape.moveTo(px, pz); else shape.lineTo(px, pz);
    }
    for (let i = seg; i >= 0; i -= 1) {
      const a = a0 + ((a1 - a0) * i) / seg;
      shape.lineTo(Math.cos(a) * inner, -Math.sin(a) * inner);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);          // Shape 在 xy 平面挤到 z，转到 xz 平面
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, 0, cz);   // 挤出方向就是高度方向，位置不要再抬高 height
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // 压顶条：沿墙顶走一圈细长盒
    if (cap) {
      const capGeo = new THREE.ExtrudeGeometry(
        (() => {
          const s = new THREE.Shape();
          const o = outer + 0.04;
          const n = inner - 0.04;
          for (let i = 0; i <= seg; i += 1) {
            const a = a0 + ((a1 - a0) * i) / seg;
            if (i === 0) s.moveTo(Math.cos(a) * o, -Math.sin(a) * o);
            else s.lineTo(Math.cos(a) * o, -Math.sin(a) * o);
          }
          for (let i = seg; i >= 0; i -= 1) {
            const a = a0 + ((a1 - a0) * i) / seg;
            s.lineTo(Math.cos(a) * n, -Math.sin(a) * n);
          }
          return s;
        })(),
        { depth: 0.09, bevelEnabled: false },
      );
      capGeo.rotateX(-Math.PI / 2);
      const capMesh = new THREE.Mesh(capGeo, cap);
      capMesh.position.set(cx, height, cz);   // 压在墙顶：height ~ height + 0.09
      scene.add(capMesh);
    }

    // 端头的垂直短肢：把弧墙做成「回」字的钩子
    // 端头沿半径方向伸出短肢，把弧墙收成「回」字的钩子。
    // hooks = 1 向外伸，hooks = 2 向内伸。
    if (hooks > 0) {
      for (const a of [a0, a1]) {
        const ex = cx + Math.cos(a) * radius;
        const ez = cz + Math.sin(a) * radius;
        lineWall({
          x0: ex,
          z0: ez,
          x1: ex + Math.cos(a) * (hooks === 2 ? -1 : 1) * hookLength,
          z1: ez + Math.sin(a) * (hooks === 2 ? -1 : 1) * hookLength,
          height,
          thickness,
          material,
        });
      }
    }

    chain(colliders, arcPoints(cx, cz, radius, a0, a1));
    return mesh;
  }

  /** 直墙：可任意角度，网格用旋转盒，碰撞用圆链 */
  function lineWall({ x0, z0, x1, z1, height = 3, thickness = 0.35, material = plaster, cap = null }) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const angle = Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), material);
    mesh.position.set(cx, height / 2, cz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (cap) box(cx, height + 0.045, cz, length + 0.06, 0.09, thickness + 0.06, cap, -angle);
    chain(colliders, linePoints(x0, z0, x1, z1));
    return mesh;
  }

  /**
   * 回形墙：方形环墙，四角留缺口，人可以绕行或从缺口穿进去。
   * gap 是每个角的缺口宽度。
   */
  function ringWall({ cx, cz, size, thickness = 0.35, height = 2.8, material = plaster, cap = null, gap = 1.2 }) {
    const half = size / 2;
    const leg = Math.max(0.5, half - gap / 2);
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const segments = [
      // 东西向两段（沿 x）
      { x0: cx - leg, z0: cz - half, x1: cx + leg, z1: cz - half },
      { x0: cx - leg, z0: cz + half, x1: cx + leg, z1: cz + half },
      // 南北向两段（沿 z）
      { x0: cx - half, z0: cz - leg, x1: cx - half, z1: cz + leg },
      { x0: cx + half, z0: cz - leg, x1: cx + half, z1: cz + leg },
    ];
    for (const s of segments) lineWall({ ...s, height, thickness, material, cap });
    return { corners: corners.map(([sx, sz]) => [cx + sx * half, cz + sz * half]) };
  }

  /** 独立方柱（青铜器厅的方形柱阵） */
  function pier({ x, z, size = 0.7, height = 3.6, material = stoneDark }) {
    box(x, height / 2, z, size, height, size, material);
    box(x, height + 0.09, z, size + 0.14, 0.18, size + 0.14, material);
    colliders.push({ x, z, radius: size * 0.85 });
  }

  /** 台基：抬高一步的地面，中间不做碰撞（走上去就行） */
  function dais({ x, z, sizeX, sizeZ, height = 0.35, material = stone }) {
    const mesh = box(x, height / 2, z, sizeX, height, sizeZ, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  /** 叠涩梁：长廊顶部的光影节奏（不做碰撞，人在下面走） */
  function beams({ axis = 'z', from, to, at, count, width = 11.4, thickness = 0.5, drop = 0.7, material = stoneDark }) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const p = from + (to - from) * t;
      if (axis === 'z') {
        box(at, 6.6 - drop / 2, p, width, drop, thickness, material);
      } else {
        box(p, 6.6 - drop / 2, at, thickness, drop, width, material);
      }
    }
  }

  return { column, arcColonnade, arcWall, lineWall, ringWall, pier, dais, beams, box, stone, stoneDark, plaster, woodRed, woodBlack, lattice, bronze, gold };
}
