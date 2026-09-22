# 虚拟博物馆 · Virtual Museum

用 three.js 编写的可漫游虚拟博物馆，场景由基本几何体搭建，带基础光照。
同一份代码可以用浏览器运行，也可以用 Electron 运行成桌面窗口。

## 运行方式

### 1. 浏览器（推荐先用这个）

```bash
npm install
npm run web
```

然后打开 http://localhost:7753 。

> 必须通过 `http://localhost:7753` 访问。直接双击 `index.html`（`file://`）会因为
> CORS 无法加载 ES Module，且浏览器不允许在 `file://` 下锁定鼠标指针。
> 端口可在 `server.js` 顶部的 `PORT` 常量中修改。

### 2. Electron 桌面窗口

```bash
npm install
npm start
```

Electron 的二进制需要从 GitHub 下载。若 `npm install` 时被安全策略拦截了
安装脚本（npm 提示 `install-scripts ... blocked`），需手动放行一次：

```bash
npm install-scripts approve electron
node node_modules/electron/install.js
npm start
```

`main.js` 注册了 `museum://` 自定义协议来加载本地文件：`file://` 下 Chromium 会
拒绝加载 ES Module，用自定义协议可以正常解析 `import` 与 `importmap`。

## 操作

| 按键 | 作用 |
| --- | --- |
| `W` `A` `S` `D` / 方向键 | 移动（相对镜头方向） |
| 鼠标 | 转向（点击画面锁定指针） |
| `Shift` | 奔跑 |
| `空格` | 跳跃 |
| `E` | 查看附近展品的介绍 |
| `Esc` | 释放鼠标 / 关闭介绍面板 |

如果指针锁定不可用，按住鼠标左键拖动也可以环视。

## 代码结构

```
main.js            Electron 主进程：创建窗口 + museum:// 协议
server.js          零依赖静态服务器（网页端，端口 7753）
index.html         页面与 HUD 的 DOM、importmap
styles.css         HUD 样式
src/main.js        渲染器、主循环、交互逻辑
src/museum.js      展厅：地面/墙体/立柱/展台/画作、光照、展品数据
src/player.js      人物模型（基本几何体拼装）+ 第三人称移动与碰撞
src/input.js       键鼠输入、指针锁定（失败时退化为拖动）
src/hud.js         提示、展品信息面板、FPS
```

## 可以顺手改的地方

- **展品**：`src/museum.js` 顶部的 `ARTIFACTS` 数组，改 `shape` / `color` / `pos` /
  文案即可增删展品；`shape` 支持 `sphere`、`icosahedron`、`cylinder`、`torusKnot`、
  `cone`、`torus`、`box`。
- **画作**：同文件的 `PAINTINGS`，贴图由 `makePaintingTexture()` 用 canvas 程序化生成。
- **光照**：`buildLights()`，含环境光、半球光、平行光（投影）、天花板点光源与中央聚光灯。
- **展厅尺寸**：`ROOM`，人物活动范围、墙体、碰撞边界都从它推导。
- **手感**：`src/player.js` 顶部的 `WALK_SPEED` / `RUN_SPEED` / `JUMP_SPEED` /
  `GRAVITY` / `sensitivity`。
