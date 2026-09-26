#!/usr/bin/env node
/**
 * 零依赖打包：把已经安装在 node_modules 里的 Electron 运行时和应用文件
 * 组装成一个免安装的绿色版目录（含可执行 exe）。
 *
 *   npm run pack:win            →  release/HubeiMuseum/HubeiMuseum.exe
 *   node scripts/package.js --zip →  再压一个可以直接发给别人的 zip
 *
 * 不联网、不需要 electron-builder / NSIS。想要「安装向导 + 开始菜单快捷方式」
 * 的单文件安装包，再用 electron-builder（见 README 的「打包成 exe」一节）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIST_NAME = 'HubeiMuseum';
const APP_NAME = 'HubeiMuseum.exe';
const OUT = path.join(ROOT, 'release', DIST_NAME);
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist');

/** 要打进包里的应用文件（相对项目根目录） */
const APP_FILES = ['main.js', 'index.html', 'styles.css', 'package.json', 'src', 'data', 'assets', 'animations'];
/** three.js 只需要运行时用到的那几个子目录 */
const THREE_PARTS = ['build', 'examples/jsm', 'package.json', 'LICENSE'];

const rimraf = (target) => fs.rmSync(target, { recursive: true, force: true });

function copyTree(from, to, filter) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      if (filter && !filter(entry, path.join(from, entry))) continue;
      copyTree(path.join(from, entry), path.join(to, entry), filter);
    }
    return;
  }
  fs.copyFileSync(from, to);
}

function main() {
  if (!fs.existsSync(ELECTRON_DIST)) {
    console.error(
      '找不到 Electron 运行时：' + ELECTRON_DIST + '\n' +
        '先执行 `npm install`（若安装脚本被拦截，见 README 里的说明）。',
    );
    process.exit(1);
  }

  console.log('清理旧的打包结果 …');
  rimraf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  console.log('复制 Electron 运行时 …');
  copyTree(ELECTRON_DIST, OUT);

  console.log('复制应用文件 …');
  const appDir = path.join(OUT, 'resources', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  for (const item of APP_FILES) {
    const from = path.join(ROOT, item);
    if (!fs.existsSync(from)) continue;
    copyTree(from, path.join(appDir, item));
  }

  console.log('复制 three.js …');
  for (const part of THREE_PARTS) {
    const from = path.join(ROOT, 'node_modules', 'three', part);
    if (!fs.existsSync(from)) continue;
    copyTree(from, path.join(appDir, 'node_modules', 'three', part));
  }

  // Electron 的默认可执行文件名换成应用名
  const exeFrom = path.join(OUT, 'electron.exe');
  const exeTo = path.join(OUT, APP_NAME);
  if (fs.existsSync(exeFrom)) fs.renameSync(exeFrom, exeTo);

  // 顺手写一份说明
  fs.writeFileSync(
    path.join(OUT, '使用说明.txt'),
    [
      '湖北省博物馆 · 虚拟展厅（免安装版）',
      '',
      '双击 ' + APP_NAME + ' 即可启动。',
      '',
      '· 移动：W A S D / 方向键      奔跑：Shift      跳跃：空格',
      '· 转向：点击画面锁定鼠标后移动鼠标（纵轴已反转）',
      '· 查看展品：走近后按 E        观察器物：在介绍面板里按 O',
      '· 观察时：拖动旋转、滚轮缩放、Esc 返回介绍、再按 E 回到场景',
      '· 右上角：音符按钮开关背景音乐，设置按钮里调节音量',
      '',
      '整个目录可以整体拷贝到任意位置或 U 盘，不需要安装。',
      '想调整内容，改 resources\\app 里的文件即可。',
    ].join('\r\n'),
    'utf8',
  );

  const size = (dir) => {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      total += entry.isDirectory() ? size(full) : fs.statSync(full).size;
    }
    return total;
  };

  console.log('\n打包完成 ✓');
  console.log('  目录：' + path.relative(ROOT, OUT));
  console.log('  启动：' + path.relative(ROOT, exeTo));
  console.log('  体积：' + (size(OUT) / 1024 / 1024).toFixed(1) + ' MB');
}

main();
