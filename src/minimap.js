/**
 * 右下角小地图：**局部放大 + 跟随玩家**的平面图。
 *
 * 与旧版的区别：
 *   · 不再把整馆塞进一个小方框（那样区域名只有 7 px，根本看不清），
 *     而是只显示玩家周围约 30 × 18 m 的范围，比例放大约 10 px/米；
 *   · 整馆平面图只在创建时烘焙一次（12 px/米），每帧只是从底图上裁一块贴上来，
 *     所以跟随与放大几乎不花性能；
 *   · 顶部有区域名栏（大字号），可以直接看清「我现在在哪个厅」；
 *   · 展品画成点位，底部有比例尺与指北针。
 */
export function createMinimap({ layout, exhibits = [] }) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const { halfX, halfZ, zones = [], planWalls = [], planDoors = [] } = layout;

  /* ---------------- 尺寸与比例 ---------------- */
  const CSS_W = 300;
  const HEADER_H = 32;
  const MAP_H = 180;
  const FOOT_H = 24;
  const CSS_H = HEADER_H + MAP_H + FOOT_H;

  const VIEW_W = 30;                 // 视窗宽（米）
  const PPM = CSS_W / VIEW_W;        // 视窗比例：10 px/米
  const VIEW_H = MAP_H / PPM;        // 视窗高（米）≈ 18
  const PLAN_PPM = 12;               // 底图烘焙比例

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(CSS_W * dpr);
  canvas.height = Math.round(CSS_H * dpr);
  canvas.style.width = `${CSS_W}px`;
  canvas.style.height = `${CSS_H}px`;

  /* ---------------- 烘焙整馆底图（只做一次） ---------------- */
  const plan = document.createElement('canvas');
  plan.width = Math.round(halfX * 2 * PLAN_PPM);
  plan.height = Math.round(halfZ * 2 * PLAN_PPM);
  const pctx = plan.getContext('2d');
  const px = (x) => (x + halfX) * PLAN_PPM;
  const py = (z) => (z + halfZ) * PLAN_PPM;

  pctx.fillStyle = '#2b2f3a';
  pctx.fillRect(0, 0, plan.width, plan.height);

  // 5 米网格，用来传达尺度
  pctx.strokeStyle = 'rgba(255,255,255,0.05)';
  pctx.lineWidth = 1;
  for (let x = -halfX; x <= halfX; x += 5) {
    pctx.beginPath();
    pctx.moveTo(px(x), 0);
    pctx.lineTo(px(x), plan.height);
    pctx.stroke();
  }
  for (let z = -halfZ; z <= halfZ; z += 5) {
    pctx.beginPath();
    pctx.moveTo(0, py(z));
    pctx.lineTo(plan.width, py(z));
    pctx.stroke();
  }

  // 展厅底色
  for (const zone of zones) {
    const [x0, x1, z0, z1] = zone.rect;
    pctx.fillStyle = zone.fill ?? '#d9d2c4';
    pctx.fillRect(px(x0), py(z0), (x1 - x0) * PLAN_PPM, (z1 - z0) * PLAN_PPM);
  }

  // 廊道高亮：让人一眼看出动线
  pctx.fillStyle = 'rgba(199, 154, 44, 0.10)';
  const corridor = zones.find((z) => z.id === 'corridor');
  if (corridor) {
    const [x0, x1, z0, z1] = corridor.rect;
    pctx.fillRect(px(x0), py(z0), (x1 - x0) * PLAN_PPM, (z1 - z0) * PLAN_PPM);
  }

  // 隔墙（粗一点，像建筑制图）
  pctx.strokeStyle = '#4a4038';
  pctx.lineWidth = 0.35 * PLAN_PPM;
  pctx.lineCap = 'round';
  for (const [x0, z0, x1, z1] of planWalls) {
    pctx.beginPath();
    pctx.moveTo(px(x0), py(z0));
    pctx.lineTo(px(x1), py(z1));
    pctx.stroke();
  }

  // 门洞
  pctx.strokeStyle = '#c79a2c';
  pctx.lineWidth = 0.5 * PLAN_PPM;
  for (const [x0, z0, x1, z1] of planDoors) {
    pctx.beginPath();
    pctx.moveTo(px(x0), py(z0));
    pctx.lineTo(px(x1), py(z1));
    pctx.stroke();
  }

  // 外墙
  pctx.strokeStyle = '#1a1512';
  pctx.lineWidth = 0.5 * PLAN_PPM;
  pctx.strokeRect(0.5, 0.5, plan.width - 1, plan.height - 1);

  /* ---------------- 每帧绘制 ---------------- */
  function zoneAt(x, z) {
    for (const zone of zones) {
      const [x0, x1, z0, z1] = zone.rect;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return zone;
    }
    // 不在任何厅里（比如站在门洞里）就取最近的
    let best = null;
    let bestDistance = Infinity;
    for (const zone of zones) {
      const [x0, x1, z0, z1] = zone.rect;
      const dx = Math.max(x0 - x, 0, x - x1);
      const dz = Math.max(z0 - z, 0, z - z1);
      const d = Math.hypot(dx, dz);
      if (d < bestDistance) {
        bestDistance = d;
        best = zone;
      }
    }
    return best;
  }

  function update(player) {
    if (!visible) return;
    const { x, z } = player.position;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CSS_W, CSS_H);

    // 面板底
    ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
    ctx.fillRect(0, 0, CSS_W, CSS_H);

    /* --- 平面图：从底图裁玩家周围一块 --- */
    const srcW = VIEW_W * PLAN_PPM;
    const srcH = VIEW_H * PLAN_PPM;
    const sx = px(x) - srcW / 2;
    const sy = py(z) - srcH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HEADER_H, CSS_W, MAP_H);
    ctx.clip();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, HEADER_H, CSS_W, MAP_H);
    ctx.drawImage(plan, sx, sy, srcW, srcH, 0, HEADER_H, CSS_W, MAP_H);

    // 世界坐标 → 地图坐标
    const toMapX = (wx) => (wx - x) * PPM + CSS_W / 2;
    const toMapY = (wz) => (wz - z) * PPM + HEADER_H + MAP_H / 2;

    // 展厅名：只画落在视窗里的，字号加大到能读清
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const zone of zones) {
      const [x0, x1, z0, z1] = zone.rect;
      const cx = toMapX((x0 + x1) / 2);
      const cy = toMapY((z0 + z1) / 2);
      if (cx < -80 || cx > CSS_W + 80 || cy < HEADER_H - 40 || cy > HEADER_H + MAP_H + 40) continue;
      const current = zoneAt(x, z) === zone;
      ctx.font = current ? 'bold 15px "Microsoft YaHei", sans-serif' : '12px "Microsoft YaHei", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(12, 14, 20, 0.85)';
      ctx.strokeText(zone.name, cx, cy);
      ctx.fillStyle = current ? '#f4e2b0' : 'rgba(72, 62, 50, 0.9)';
      ctx.fillText(zone.name, cx, cy);
    }

    // 展品点位
    ctx.fillStyle = '#c79a2c';
    for (const item of exhibits) {
      const mx = toMapX(item.position.x);
      const my = toMapY(item.position.z);
      if (mx < -6 || mx > CSS_W + 6 || my < HEADER_H - 6 || my > HEADER_H + MAP_H + 6) continue;
      ctx.beginPath();
      ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家：位置固定在视窗中心
    const centerX = CSS_W / 2;
    const centerY = HEADER_H + MAP_H / 2;
    const dx = -Math.sin(player.yaw);
    const dy = -Math.cos(player.yaw);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = 'rgba(226, 69, 60, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 46, -0.5, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e2453c';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-6, 7);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    /* --- 顶部：当前区域名 --- */
    const current = zoneAt(x, z);
    ctx.fillStyle = 'rgba(24, 18, 16, 0.95)';
    ctx.fillRect(0, 0, CSS_W, HEADER_H);
    ctx.fillStyle = '#c79a2c';
    ctx.fillRect(0, HEADER_H - 2, CSS_W, 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e2453c';
    ctx.beginPath();
    ctx.arc(16, HEADER_H / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f2ece0';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.fillText(current ? current.name : '展厅', 28, HEADER_H / 2 + 0.5);

    if (current?.sub) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(174, 163, 146, 0.9)';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(current.sub, CSS_W - 12, HEADER_H / 2 + 0.5);
    }

    /* --- 底部：比例尺 + 指北针 --- */
    const y = HEADER_H + MAP_H + FOOT_H / 2;
    ctx.strokeStyle = 'rgba(226, 216, 196, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(14 + 10 * PPM, y);
    ctx.moveTo(14, y - 4);
    ctx.lineTo(14, y + 4);
    ctx.moveTo(14 + 10 * PPM, y - 4);
    ctx.lineTo(14 + 10 * PPM, y + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(174, 163, 146, 0.95)';
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('10 m', 14 + 10 * PPM + 8, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(226, 216, 196, 0.85)';
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.fillText('N ↑', CSS_W - 12, y);
  }

  /* ---------------- 可见性 ---------------- */
  let visible = false;
  function setVisible(value) {
    visible = Boolean(value);
    canvas.classList.toggle('hidden', !visible);
    if (visible) update(lastPlayer);
  }

  let lastPlayer = { position: { x: 0, z: 0 }, yaw: 0 };
  const originalUpdate = update;
  const wrapped = (player) => {
    lastPlayer = player;
    originalUpdate(player);
  };

  return { setVisible, isVisible: () => visible, update: wrapped };
}
