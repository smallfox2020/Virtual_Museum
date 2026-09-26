import { spawn } from 'node:child_process';

const port = 9440;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`,
  '--user-data-dir=C:/Users/A/AppData/Local/Temp/cdpretarget', '--no-first-run', '--hide-scrollbars', '--mute-audio',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=900,600', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 60; i += 1) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const logs = [];
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => (typeof a.value === 'string' ? a.value : a.description ?? a.type)).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('[log:error] ' + m.params.entry.text);
};
await new Promise((r) => { ws.onopen = r; });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:7753/_retarget_test.html' });
await sleep(12000);

const line = logs.find((l) => l.startsWith('RETARGET_RESULT'));
if (!line) {
  console.log('未拿到结果：');
  console.log(logs.join('\n').slice(0, 2000));
} else {
  const d = JSON.parse(line.slice(16));
  console.log('=== 骨骼名语义解析自检 ===');
  d['语义匹配自检'].forEach((s) => console.log('  ' + s));
  console.log('\n=== 骨架对照 ===');
  console.log('  源  :', d['源骨骼'].join(', '));
  console.log('  目标:', d['目标骨骼'].join(', '));
  console.log('\n=== 匹配报告 ===');
  console.log('  源骨骼数', d['匹配报告']['源骨骼数'], '｜目标骨骼数', d['匹配报告']['目标骨骼数'], '｜已匹配', d['匹配报告']['已匹配']);
  console.log('  匹配方式:', JSON.stringify(d['匹配报告']['匹配方式']));
  console.log('  未匹配数:', d['匹配报告']['未匹配数'], d['匹配报告']['未匹配'].length ? d['匹配报告']['未匹配'] : '');
  console.log('  直接播放兼容度:', d['直接播放兼容度'], '（低于阈值才需要重定向）');
  console.log('\n=== 重定向结果 ===');
  console.log('  耗时', d['重定向耗时'], '｜轨道数', d['生成轨道数']);
  console.log('  轨道:', d['生成轨道名']);
  console.log('\n=== 核心验证：旋转增量不变式 ===');
  console.log('  最大误差:', d['旋转增量最大误差_弧度'], '弧度 =', d['旋转增量最大误差_度'], '度');
  console.log('  最差骨骼:', d['最差骨骼']);
  console.log('  逐帧误差:', JSON.stringify(d['逐帧最大误差']));
  console.log('\n=== 末端位置对照（骨长不同，位置不会重合，属已知局限）===');
  d['末端位置对照'].forEach((r) => console.log('  t=' + r.t, '源', JSON.stringify(r['源末端']), '→ 目标', JSON.stringify(r['目标末端'])));
  console.log('\n=== 对照实验 ===');
  console.log('  不重定向直接播:', d['不重定向直接播']);
  console.log('  不重定向时目标骨骼变动数:', d['不重定向时目标骨骼变动数']);
}
ws.close(); chrome.kill(); process.exit(0);
