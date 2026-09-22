const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, protocol, net } = require('electron');

const ROOT = __dirname;

// 渲染进程通过自定义协议加载本地文件：
// file:// 下 Chromium 会拒绝 ES Module（CORS），自定义协议可以正常加载 import / importmap。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'museum',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function resolveLocalFile(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const target = path.join(ROOT, decodeURIComponent(url.pathname));
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
    title: '虚拟博物馆 · Virtual Museum',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  win.loadURL('museum://app/index.html');
  return win;
}

app.whenReady().then(() => {
  protocol.handle('museum', (request) => {
    const filePath = resolveLocalFile(request.url);
    if (!filePath) return new Response('Forbidden', { status: 403 });
    // net.fetch 会按文件后缀自动带上正确的 Content-Type（ES Module 必需）
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
