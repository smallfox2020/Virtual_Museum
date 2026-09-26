/**
 * 人物模型检查工具：加载页面后报告
 *   · 角色模型是否换上、贴图有没有挂上（每张图的尺寸与颜色空间）
 *   · 归一化后的身高、朝向、世界包围盒（用来确认手臂下垂是否生效）
 *   · 当前动效状态（骨骼动画 / 程序化律动）与渲染统计
 *
 *   node thesis/check_character.mjs
 *
 * 需要本地服务器在 http://localhost:7753（npm run web）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const port = 9430;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`,
  '--user-data-dir=C:/Users/A/AppData/Local/Temp/cdpchar', '--no-first-run', '--hide-scrollbars', '--mute-audio',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 60; i += 1) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const logs = [];
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(m.params.args.map((a) => (typeof a.value === 'string' ? a.value : a.description ?? a.type)).join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('[log:error] ' + m.params.entry.text);
};
await new Promise((r) => { ws.onopen = r; });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:7753/' });
await sleep(32000);

const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return 'EXCEPTION: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0];
  return r.result.value;
};

console.log('=== 控制台（character 相关）===');
console.log(logs.filter((l) => l.includes('character') || l.includes('player') || l.startsWith('EXCEPTION') || l.startsWith('[log:error]')).join('\n') || '(无)');

console.log('\n=== 外部角色加载状态 ===');
console.log(await ev(`(() => {
  const p = window.museumApp?.player;
  if (!p) return 'player 未就绪';
  const ex = p.character.external;
  if (!ex) return '尚未换上外部模型（仍在用程序化人物）';
  const THREE = window.__THREE__;
  const box = new (p.character.model.constructor === Object ? Object : Object)();
  // 用模型自身的几何算包围盒
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  const v = { x: 0, y: 0, z: 0 };
  ex.object.updateMatrixWorld(true);
  ex.object.traverse((n) => {
    if (!n.isMesh) return;
    const pos = n.geometry.attributes.position;
    const m = n.matrixWorld;
    for (let i = 0; i < pos.count; i += 11) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const wx = m.elements[0]*x + m.elements[4]*y + m.elements[8]*z + m.elements[12];
      const wy = m.elements[1]*x + m.elements[5]*y + m.elements[9]*z + m.elements[13];
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    }
  });
  return JSON.stringify({
    stats: ex.stats,
    hasClips: ex.hasClips,
    世界包围盒: { 高: +(maxY - minY).toFixed(3), 宽: +(maxX - minX).toFixed(3), 底: +minY.toFixed(3) },
    模型数: p.character.meshes.length,
  }, null, 1);
})()`));

console.log('\n=== 材质贴图挂载情况 ===');
console.log(await ev(`(() => {
  const p = window.museumApp.player;
  const seen = new Map();
  for (const mesh of p.character.meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if (m && !seen.has(m.uuid)) seen.set(m.uuid, m);
  }
  const rows = [];
  for (const m of seen.values()) {
    rows.push({
      材质: m.name,
      类型: m.type,
      map: m.map ? m.map.image.width + 'x' + m.map.image.height + '/' + m.map.colorSpace : '-',
      normalMap: m.normalMap ? m.normalMap.image.width + 'x' + m.normalMap.image.height : '-',
      metalnessMap: m.metalnessMap ? m.metalnessMap.image.width + 'x' + m.metalnessMap.image.height : '-',
      roughnessMap: m.roughnessMap ? m.roughnessMap.image.width + 'x' + m.roughnessMap.image.height : '-',
      金属度: m.metalness, 粗糙度: m.roughness,
    });
  }
  return JSON.stringify(rows, null, 1);
})()`));

console.log('\n=== 渲染统计 / 动画 ===');
console.log(await ev(`(() => {
  const p = window.museumApp.player;
  const info = window.museumApp.renderer.info;
  return JSON.stringify({
    状态机: p.character.external.hasClips ? 'AnimationMixer（骨骼动画）' : '程序化整体律动（无骨骼）',
    walkPhase: +p.walkPhase.toFixed(2),
    tilt位置: p.tilt.position.toArray().map((v) => +v.toFixed(3)),
    tilt旋转: [p.tilt.rotation.x, p.tilt.rotation.z].map((v) => +v.toFixed(3)),
    渲染: { 程序: info.programs.length, 纹理: info.memory.textures, 几何: info.memory.geometries },
  }, null, 1);
})()`));

// 截图看人物是否正常出图
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('C:/Users/A/AppData/Local/Temp/char.png', Buffer.from(shot.data, 'base64'));
const analysis = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
  const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  // 画面正中偏下就是人物
  const d = x.getImageData(c.width * 0.42, c.height * 0.35, c.width * 0.16, c.height * 0.45).data;
  let s = [0,0,0], n = 0, skin = 0;
  for (let i = 0; i < d.length; i += 4) {
    s[0]+=d[i]; s[1]+=d[i+1]; s[2]+=d[i+2]; n++;
    if (d[i] > 90 && d[i] > d[i+2] + 12) skin++;
  }
  return JSON.stringify({ 人物区域均值: s.map(v=>Math.round(v/n)), 肤色像素占比: +(skin/n*100).toFixed(1) + '%' });
})()` });
console.log('\n=== 人物出图检查 ===');
console.log(analysis.result.value);

ws.close(); chrome.kill(); process.exit(0);
