/**
 * 零依赖的静态文件服务器，用于在浏览器里运行本项目。
 *   npm run web   →  http://localhost:7753
 *
 * 浏览器需要通过 http:// 访问才能使用指针锁定（Pointer Lock）；
 * 直接用 file:// 打开会因为 CORS 无法加载 ES Module。
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 7753;
const HOST = '127.0.0.1';
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function resolvePath(requestUrl) {
  const { pathname } = new URL(requestUrl, `http://${HOST}:${PORT}`);
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? '/index.html' : decoded;
  const target = path.join(ROOT, relative);

  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`虚拟博物馆已启动： http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请先关闭占用它的程序。`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
