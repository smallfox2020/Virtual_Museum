# 湖北省博物馆 · 虚拟展厅

基于 three.js 编写的可漫游虚拟博物馆：**一条中央长廊串起两侧四个展厅，南端序厅、北端通高的编钟厅**，
中庭式布局与楚式陈设参照湖北省博物馆的展陈意象。同一份代码可以用浏览器运行，也可以用 Electron 运行成桌面窗口。

> 这是对湖北省博物馆空间布局与楚式陈设的**意象化再现**，不是测绘级别的复原：
> 真实的曾侯乙编钟为三层八组六十五件、钟架作曲尺形；馆内展厅数量与动线也比这里复杂得多。
> 书画立轴与部分展板为示意性陈列，文案是科普性描述，具体藏品信息以博物馆公布为准。

## 平面布局

```
                  北端：编钟厅（通高 12 m · 琉璃天窗）
        ┌────────────────────────────────────────────┐
        │            曾 侯 乙 编 钟                    │   z: -27 ~ -13
        └───────────────────────┬────────────────────┘
   ┌──────────────┐      ┌──────┴──────┐      ┌──────────────┐
   │ 曾侯乙墓展厅  │      │   长   廊    │      │   青铜器厅    │
   │ 尊盘 · 鉴缶   │      │  书画立轴 ×12 │      │ 罍·鼎·簋·镜·壶 │  z: 0 ~ 13
   ├──────────────┤      │  天窗光带     │      ├──────────────┤
   │  楚文化展厅   │      │              │      │    陶瓷厅     │  z: -13 ~ 0
   │ 剑·鼓·镇墓兽  │      │              │      │ 青花·青瓷·彩陶 │
   └──────────────┘      └──────┬───────┘      └──────────────┘
        ┌───────────────────────┴────────────────────┐
        │              序厅 · 导览图 · 前言              │   z: 13 ~ 27
        └────────────────────────────────────────────┘
```

- **中央长廊**贯穿南北（8 m 宽、26 m 长），顶部是一条 2 m 宽的天窗光带；
  两侧墙上挂 12 幅书画立轴，四个门洞分别通向四个展厅。
- **四个展厅**互不相通，都要经过长廊进出——这是博物馆最常见的单向动线。
- **编钟厅**通高 12 m，顶部方形天窗，正中是曲尺形三层钟架（长臂 6.6 × 短臂 3.1 × 高 3.3，悬挂 52 件合瓦形钟）。
- **楚风配色**：漆器红黑、青铜锈绿、金饰、孔雀蓝琉璃。

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
协议处理用 `fs` 直接读文件（不是 `net.fetch`），所以打进 `app.asar` 之后也能正常工作。



## 操作

| 按键 | 作用 |
| --- | --- |
| `W` `A` `S` `D` / 方向键 | 移动（相对镜头方向） |
| 鼠标 | 转向（点击画面锁定指针，**纵轴已做反转**） |
| `Shift` | 奔跑 |
| `空格` | 跳跃 |
| `V` | **切换第一人称 / 第三人称**。第一人称会收起自身模型（低头看不到身体），但地上的**影子仍然保留**；两种视角共用同一套 `yaw`/`pitch`，切回来视线不会跳 |
| `E` | 查看附近展品 / 展板 / 书画的介绍；**面板打开时再按 `E` 直接回到场景**（不需要再点一次画面） |
| `O` | **观察模式**：只显示这一件器物，背景虚化；拖动鼠标旋转、滚轮缩放 |
| `Esc` | 观察模式 → 回到介绍面板；介绍面板 → 回到场景；否则释放鼠标 |

`V` 在介绍面板或观察模式（`O`）下不生效，避免打断模态交互。切换后俯仰角会按当前视角
重新夹一次：第三人称限制在 `-0.4 ~ 1.15`（再低镜头就钻到地板下了），第一人称放宽到
`-1.15 ~ 1.3` 以便抬头看澡井。相关常量在 `src/player.js` 顶部的 `PITCH_LIMITS`、
`FIRST_PERSON_EYE_HEIGHT`。

第一人称隐藏模型用的是 `Player.setModelHidden()`，关的是材质的 `colorWrite` / `depthWrite`
而**不是** `mesh.visible`。因为 three 的阴影 pass 第一行就是 `if (object.visible === false) return`，
用 `visible` 会把自己的影子一起弄没；而阴影渲染用的是 `getDepthMaterial()` 生成的内部
深度材质，跟物体的 `colorWrite` 无关，所以人消失了、影子还在。
`depthWrite` 也必须关：否则“看不见”的身体会继续写深度，低头时地面上会抠出一块黑洞。

右上角两个按钮：

- **音符图标**：播放 / 停止背景音乐。白色表示停止，点击后变红表示正在播放。
- **设置图标**：展开设置面板，里面有音量滑条（0–100）。

背景音乐不用任何音频文件，全部由 WebAudio 现场合成：五声音阶的拨弦 + 低频铺底 + 生成式厅堂混响
（见 `src/audio.js`）。

## 代码结构

```
main.js            Electron 主进程：创建窗口 + museum:// 协议（fs 直读，兼容 asar）
server.js          零依赖静态服务器（网页端，端口 7753）
scripts/package.js 零依赖打包脚本：Electron 运行时 + 应用文件 → 免安装绿色版
assets/icon.ico    应用/窗口图标（256/128/64/48/32/16 六种尺寸）
index.html         页面与 HUD 的 DOM、importmap（three / three/addons/）
styles.css         HUD、设置面板、观察层的样式
src/main.js        渲染器、主循环、交互流程（E / O / Esc）、音乐与设置接线
src/museum.js      建筑：平面分区、隔墙、吊顶与天窗、书画、展板、展台、灯光、导览图数据
src/artifacts.js   展品：材质、25 种器物造型、展品清单、曾侯乙编钟
src/textures.js    全部程序化贴图（地面/藻井/漆器/青铜/青花/彩陶/书画/展板/匾额）
src/inspector.js   观察模式：独立透明画布 + 独立光照，拖动旋转、滚轮缩放
src/audio.js       背景音乐合成与音量控制
src/player.js      人物模型 + 第一/第三人称移动与碰撞（圆柱 / 长方体两类障碍）
src/input.js       键鼠输入、指针锁定（失败时退化为拖动）
src/hud.js         提示、展品信息面板、开场遮罩、FPS
```

## 可以顺手改的地方(画大饼)

- **平面分区**：`src/museum.js` 顶部的 `ZONES`（每个展厅的矩形范围、层高、导览图配色）、
  `WALL_SEGMENTS`（隔墙中心线）、`DOOR_SIGNS`（门洞匾额）、`ROOM`（外轮廓）。
  **序厅的导览平面图是从这些数据自动画出来的**（`src/textures.js` 的 `makePlanTexture()`），
  改了布局，图也会跟着变。
- **展品**：`src/artifacts.js` 的 `ARTIFACTS`。`shape` 取 `SHAPE_BUILDERS` 里的键
  （`lei` 罍 / `ding` 鼎 / `gui` 簋 / `hu` 壶 / `mirror` 镜 / `yongzhong` 甬钟 / `chunyu` 錞于 /
  `zunpan` 尊盘 / `jianfou` 鉴缶 / `deer` 卧鹿 / `drumStand` 建鼓座 / `drum` 虎座鸟架鼓 /
  `sword` 勾践剑 / `ge` 戈钺 / `beast` 镇墓兽 / `jiandu` 秦简 / `table` 漆案 / `meiping` 梅瓶 /
  `lotus` 莲花尊 / `li` 鬲 / `bowl` 彩陶碗 / `figure` 陶俑 / `ingot` 金锭 / `jadeBelt` 玉带 /
  `jadeSet` 玉璧玉琮）；`pos` 必须落在对应展厅的范围内。
  新造型就在 `SHAPE_BUILDERS` 里加一个返回 `Object3D` 的函数，
  `createArtifactObject()` 会自动把它水平居中、底面归零。
- **长廊书画**：`src/museum.js` 的 `SCROLLS`（标题、说明）与 `SCROLL_SLOTS`（墙面位置），
  画面由 `src/textures.js` 的 `makeScrollTexture(kind)` 用 canvas 现画，
  `kind` 支持 `shanshui` 山水 / `zhuzi` 墨竹 / `shufa` 书法 / `huaniao` 花鸟。
- **展板**：`PANELS`，`wall` 指定墙面（north/south/east/west），`offset` 是墙上的横向坐标。
- **编钟**：`src/artifacts.js` 的 `buildChimeBells()`。`tiers` 控制三层横梁标高 / 钟体高度 /
  钟距 / 甬长系数，`LONG`、`SHORT` 是曲尺形两条臂的长度；钟体是 Lathe 车出剖面后再把 z 压扁成
  合瓦形，每层一个 `InstancedMesh`。
- **灯光**：`src/museum.js` 的 `buildLights()`（环境光、半球光、天窗方向的平行光（投影）、
  展廊点光源、编钟重点聚光）。想提帧率，先减这里的点光源。
- **音乐**：`src/audio.js` 的 `SCALE`（音阶）与 `schedule()`（节奏与音高随机）。
- **手感**：`src/player.js` 顶部的 `WALK_SPEED` / `RUN_SPEED` / `JUMP_SPEED` / `GRAVITY` /
  `sensitivity`，以及 `applyMouseLook()` 里的纵轴方向。
- **调试**：浏览器控制台里有 `window.museumApp`（`scene` / `museum` / `player` / `inspector` / `audio`）。
