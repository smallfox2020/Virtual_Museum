/**
 * 右下角小地图：整馆平面图 + 实时玩家位置与朝向。
 *
 * 平面图数据来自 museum.js 的 LAYOUT（与序厅导览图同源），
 * 底图只在创建时画一次，每帧只叠加玩家圆点与箭头。
 */
export function createMinimap({ layout }) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const { halfX, halfZ, zones = [], planWalls = [], planDoors = [] } = layout;

  const pad = 12;
  const cssWidth = 176;
  const scale = (cssWidth - pad * 2) / (halfX * 2);
  const cssHeight = halfZ * 2 * scale + pad * 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const toX = (x) => pad + (x + halfX) * scale;
  const toY = (z) => pad + (z + halfZ) * scale;

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ---------- 底图（只画一次） ---------- */
  const base = document.createElement('canvas');
  base.width = canvas.width;
  base.height = canvas.height;
  const bctx = base.getContext('2d');
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  bctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
  roundRect(bctx, 0.5, 0.5, cssWidth - 1, cssHeight - 1, 10);
  bctx.fill();

  for (const zone of zones) {
    const [x0, x1, z0, z1] = zone.rect;
    bctx.fillStyle = zone.fill ?? '#d9d2c4';
    bctx.globalAlpha = 0.9;
    bctx.fillRect(toX(x0) + 1, toY(z0) + 1, (x1 - x0) * scale - 2, (z1 - z0) * scale - 2);
    bctx.globalAlpha = 1;
    bctx.fillStyle = 'rgba(52, 45, 38, 0.92)';
    bctx.font = '7px "Noto Sans SC","Microsoft YaHei",sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(zone.name, toX((x0 + x1) / 2), toY((z0 + z1) / 2));
  }

  bctx.strokeStyle = 'rgba(72, 62, 50, 0.95)';
  bctx.lineWidth = 1.6;
  for (const [x0, z0, x1, z1] of planWalls) {
    bctx.beginPath();
    bctx.moveTo(toX(x0), toY(z0));
    bctx.lineTo(toX(x1), toY(z1));
    bctx.stroke();
  }

  bctx.strokeStyle = '#c79a2c';
  bctx.lineWidth = 2;
  for (const [x0, z0, x1, z1] of planDoors) {
    bctx.beginPath();
    bctx.moveTo(toX(x0), toY(z0));
    bctx.lineTo(toX(x1), toY(z1));
    bctx.stroke();
  }

  let visible = false;

  function setVisible(value) {
    visible = Boolean(value);
    canvas.classList.toggle('hidden', !visible);
  }

  function update(player) {
    if (!visible) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.drawImage(base, 0, 0, cssWidth, cssHeight);

    const px = toX(player.position.x);
    const py = toY(player.position.z);
    const dx = -Math.sin(player.yaw);
    const dy = -Math.cos(player.yaw);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(dy, dx));

    // 视野扇形
    ctx.fillStyle = 'rgba(226, 69, 60, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 20, -0.55, 0.55);
    ctx.closePath();
    ctx.fill();

    // 朝向箭头
    ctx.fillStyle = '#e2453c';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, 5);
    ctx.lineTo(-1.5, 0);
    ctx.lineTo(-4, -5);
    ctx.closePath();
    ctx.fill();

    // 位置圆点
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return { setVisible, isVisible: () => visible, update };
}
