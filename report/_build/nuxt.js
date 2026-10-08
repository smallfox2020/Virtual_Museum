// 用 node 解析维普检索页里的 __NUXT__ 载荷
const fs = require('fs');
const path = process.argv[2];
const html = fs.readFileSync(path, 'utf8');
const i = html.indexOf('window.__NUXT__=');
if (i < 0) { console.error('no nuxt'); process.exit(1); }
let j = html.indexOf('(', i);
// 找到与之匹配的右括号
let depth = 0, end = -1;
for (let k = j; k < html.length; k++) {
  const c = html[k];
  if (c === '(') depth++;
  else if (c === ')') { depth--; if (depth === 0) { end = k + 1; break; } }
}
const expr = html.slice(j, end);
let data;
try {
  data = eval(expr);   // 只在本机、只解析维普自己的载荷
} catch (e) {
  console.error('eval fail', e.message);
  process.exit(2);
}
const out = process.argv[3] || 'nuxt.json';
fs.writeFileSync(out, JSON.stringify(data, null, 1), 'utf8');
console.log('written', out, 'keys=', Object.keys(data).join(','));
