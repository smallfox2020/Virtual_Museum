const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, protocol, shell } = require('electron');

const ROOT = __dirname;

// 窗口 / 任务栏图标（打包后 assets 也在 app 目录里）
const ICON = path.join(ROOT, 'assets', 'icon.ico');

// 渲染进程通过自定义协议加载本地文件：
// file:// 下 Chromium 会拒绝加载 ES Module（CORS），自定义协议可以正常加载 import / importmap。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'museum',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

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
  '.woff2': 'font/woff2',
};

function resolveLocalFile(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const decoded = decodeURIComponent(url.pathname);
  const target = path.join(ROOT, decoded);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0e1118',
    icon: fs.existsSync(ICON) ? ICON : undefined,
    title: '湖北省博物馆 · 虚拟展厅',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  // 页面里的外链一律交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL('museum://app/index.html');

  // 打包后想直接看渲染进程日志时：--devtools
  if (process.argv.includes('--devtools')) win.webContents.openDevTools({ mode: 'detach' });

  return win;
}

app.whenReady().then(() => {
  // 用 fs 直接读文件：这样打包进 app.asar 之后也能正常返回内容
  // （Chromium 的网络栈看不懂 asar 路径，不能用 net.fetch(file://...)）
  protocol.handle('museum', async (request) => {
    const filePath = resolveLocalFile(request.url);
    if (!filePath) return new Response('Forbidden', { status: 403 });

    try {
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
