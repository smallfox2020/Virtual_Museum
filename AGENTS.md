# 湖北省博物馆虚拟展厅 —— 项目上下文

> 这个文件是给 AI 助手看的项目记忆，每次会话自动加载。
> 新会话开工前先读完它，不要再去重新问用户这些已经确定的事。

## 这是什么

本科数字媒体艺术设计的毕业设计：three.js + Electron 的**湖北省博物馆虚拟展厅**。
第一人称/第三人称漫游，含序厅、编钟厅、青铜器厅、陶瓷厅、曾侯乙墓厅、楚文化厅六个区域。
中文注释、中文 UI。用户是设计专业学生，不是程序员——**解释要直白，不要堆术语**。

## 命令

```bash
npm run web        # 本地服务器，端口 7753（改代码后刷新即可，无构建步骤）
npm start          # Electron 运行
npm run pack:win   # 打包（scripts/package.js）
npm run dist       # electron-builder 打 exe

node --check <file>   # 每次改完 JS 必须做（把 .js 复制成 .mjs 再 check 也行）
```

**没有构建步骤、没有打包器、没有测试框架。** 改 `src/*.js` 直接刷新浏览器。

## 架构

浏览器直接跑 ES module，`index.html` → `src/main.js` 是唯一入口。

| 模块 | 职责 |
| --- | --- |
| `src/main.js` | 入口：场景/相机/渲染循环/UI 绑定/各模块装配 |
| `src/museum.js` | **建筑**（外墙、隔墙、门洞、吊顶、地面、墙裙）、`PANELS` 展板数据、`createMuseum()`、陈设（长凳/花器/沙盘） |
| `src/artifacts.js` | **展品几何**：`ARTIFACTS` 数组、`STORIES`、`materials()`、各 `shapeXxx()` 生成函数 |
| `src/textures.js` | 程序化贴图（Canvas 生成，无外部图片）：石材、灰浆、青铜、漆器、`makeNormalMap()`、`makeRoughnessMap()`、`surfaceSet()` |
| `src/player.js` | 移动、碰撞、跳跃、相机跟随、第一人称（V 键） |
| `src/character.js` | FBX 人物模型 + 内嵌贴图抠取 + Mixamo 动画 |
| `src/retarget.js` | 骨骼重定向（当前 Mixamo 路线用不到，保留备用） |
| `src/input.js` `hud.js` `inspector.js` `audio.js` | 输入、HUD、检视面板、音效 |
| `src/minimap.js` `roomtitle.js` `thumbnails.js` | 小地图、进房提示、缩略图 |
| `src/fortune.js` `reader.js` `quiz/*` | 抽签、朗读器、猜谜小游戏 |

## 用户并行维护的模块 —— 碰之前先想清楚

这些是用户自己写的功能，**改进别的东西时不能弄坏它们**：
`fortune.js`、`reader.js`、`minimap.js`、`roomtitle.js`、`thumbnails.js`、
`quiz/{match,quiz,state}.js`、`data/puzzles.json`。
`src/main.js` 里已经 import 并装配好了，不要删这些 import。

## 关键数值（改之前先查这里）

```js
// 建筑（src/museum.js）
ROOM      = { halfX: 24, halfZ: 40, height: 14, thickness: 0.6 }   // 48 × 80 m
WALL_T    = 0.35      // 隔墙厚
DOOR_HALF = 2.6       // 门洞半宽
DOOR_TOP  = 4.2       // 门洞高
CORRIDOR_HALF = 6     // 长廊半宽（墙面在 x = ±6）
Z_LINE    = 18        // 序厅/编钟厅与四条展廊的分界
SKIRT_H   = 1.2       SKIRT_T = 0.16    // 墙裙（只在没有门洞的外墙上）
INSET     = 0.012     // 墙裙外表面相对墙面的内退量（防共面闪烁）

// 玩家（src/player.js）
CHARACTER_HEIGHT = 1.98    WALK_SPEED = 1.9   RUN_SPEED = 3.9
JUMP_SPEED = 6.6           GRAVITY = 22       CAMERA_DISTANCE = 3.4
EYE_HEIGHT = 身高 × 0.84   FIRST_PERSON_EYE_HEIGHT = 身高 × 0.93

// 人物（src/character.js）
CHARACTER_CONFIG.targetHeight = 1.98
textureSize = { color: 1024, normal: 1024, data: 512 }
// 走/跑速度靠 measureClipSpeed() 自动标定，运行时 timeScale = 目标速度 / 自然速度
```

门洞位置：四条展廊进出口在 `z = ±9.5`（占 `6.9~12.1` 与 `-12.1~-6.9`）；
编钟厅出口在 `x ∈ [-2.8, 2.8]`。
**门洞轴线和展厅中央必须保持空着**——这是用户明确要求，展品要贴墙。

## 设计决策（为什么这么做，别推翻重来）

1. **展品贴图按名字散列 4 套材质变体** —— 同屏器物不雷同，但材质实例只有 4 套（性能）。
   墙也是 4 个变体，但**同一米白底**，只有抹刀痕/砂粒/石材对缝的细节差别（用户要求"墙不要变颜色"）。
2. **隔墙不做墙裙** —— 门洞开在隔墙上，墙裙端头必然和白色墙面/门框咬在一起闪，
   用户授权"实在不行就把相交部分删掉"，所以只在没有门的外墙保留墙脚。
3. **人物 FBX 的内嵌贴图要手动抠** —— FBXLoader 认不出 `Maya|baseColor` 这类命名。
   `character.js` 用 PNG 签名 + IEND 配对紧邻其前的 `RelativeFilename` 从二进制里抠出 PNG。
   动画文件各 7MB 且含完整模型副本，取 `animations` 后必须 `disposeTree` 丢弃几何。
4. **Mixamo 骨骼与动画骨骼名 100% 一致，不需要重定向**；所有 clip 名都是 `mixamo.com`，
   所以**按文件名**决定动画槽位。带骨骼时**跳过 `reposeArms()`**（T-pose 就是绑定姿势）。
5. **分两步加载**：角色解析完立刻换上，动画后台加载（角色早出现 1.4~1.8 秒）。
6. **小地图是局部放大跟随**（30 × 18 m，10 px/米），不是全览图。
7. **阴影相机跟随玩家** `updateShadowFocus(x, z)`（±22m，2048 贴图），`main.js` 每帧调用。

## 踩过的坑（别再犯）

- **改大文件前先备份。** 曾用「锚点 A 到锚点 B」替换，把夹在中间的整个 `ARTIFACTS` 数组删掉了。
  替换文本里的收尾 `];` 也漏补过。改完立刻 `node --check` ＋ 数一下关键数组长度。
- **Windows Python 读不到 MSYS 的 `/tmp`**，临时文件放 `$LOCALAPPDATA/Temp/...`。
- **Python `print('...✓')` 在 GBK 控制台会 `UnicodeEncodeError` 崩掉脚本**，print 只用 ASCII。
- **不要把 `rm 文件` 和「读取该文件」的命令写在同一行** —— 前者失败后者照删，文件会丢。
- `artifacts.js` 里**没有** `material()` 辅助函数，要用 `new THREE.MeshStandardMaterial({...})`。
- `lathe()` 是 `artifacts.js` 的**私有**函数，`museum.js` 里不能用，要自己构造 `LatheGeometry`。
- 单层 `LatheGeometry` 做容器 → 从口部看进去像**实心**。要做外壁 + 内壁 + 口沿圈。
- Node 模板字符串嵌套转义很容易写错 → 优先写临时 HTML 页，或写独立 `.js` 模块再用 CDP 注入 `import('./_xxx.js')`。

## 怎么验证改动（无头 Chrome + CDP）

本地服务器经常被杀，**先 `curl http://localhost:7753/` 确认，没了就 `node server.js &` 重启**。

```
chrome --headless=new --remote-debugging-port=97xx --enable-unsafe-swiftshader
       --use-gl=angle --use-angle=swiftshader --window-size=1200,760
       --disable-background-timer-throttling --disable-renderer-backgrounding
```

要点：
- SwiftShader 是软件渲染（~2.5 FPS，`dt` 上限 0.05）：**墙钟 1 秒只推进约 0.1 秒模拟时间**。
  测动画要用 `mixer.update()` 手动推进，别靠等。
- 加载后**等 40 秒**左右（人物 + 动画 + 贴图都在后台）。
- 截图前必须 `hud.markStarted()` 并隐藏 `#overlay`，否则 40%~85% 的暗色遮罩会导致误判"画面太暗"。
- `window.museumApp` 暴露了：`scene camera renderer museum player input hud inspector
  fortune quiz audio reader thumbnail puzzles minimap roomTitle`。
- `museum.interactables` / `museum.colliders` 是所有自动检查的抓手。

常用检查：交互点数量、碰撞体数量、`renderer.info.memory.textures/geometries`、
**可达性**（每个交互点周围 16 个方向有 ≥3 个方向站得进去）、
**路径连通**（从出生点 `(0, 33)` 走到各厅）、异常监听 `Runtime.exceptionThrown`。

## 当前已知问题（还没解决，别假装解决了）

1. **容器是单层曲面，看着像实心** —— 外壁 + 内壁 + 口沿圈还没做。
2. **贴图平铺仍可见** —— 没有逐件 UV 展开，只是 repeat (2,1) + 多尺度叠加。
3. **展品基本是基本几何体拼装**，不是扫描级精度。
   已精细化的：铜建鼓座（`TubeGeometry` 曲线生成 16 条盘绕龙身，165 个部件）、
   铜鼎（兽蹄足 + 扉棱 + 拱形立耳）、铜爵三足、卧鹿头。
   其余仍粗糙 —— 下一批计划：按器类成批补细节（鼎簋兽面纹带、罍卣兽首衔环、壶铺首、兵器真实轮廓、乐器加弦与架）。
4. **"门附近墙底穿模"** 只做了防御性修正（加大内退余量 + 删掉隔墙墙裙），
   助手没有视觉能力，**无法目视确认**。需要用户刷新后反馈具体位置。

## 与用户协作的方式

- **提交信息用英文**，遵循 conventional commits（`feat(scope): ...` / `fix(scope): ...`），正文可用条目式英文。
- **回答要短。** 用户说过"就回答可以或者不行"。不要写多余工具、不要过度设计。
- 用户会**并行提交自己的功能**，改公共文件时留意冲突。
- 汇报格式：先给结论表格（用户意见 → 处理 → 验证结果），再单独列出"可能仍有问题/我做不到的部分"。
- **做不到就说做不到。** 不要含糊过去，也不要把没验证的东西说成已验证。
- 用户是设计专业，重视观感（比例、细节、不穿模、不闪），对性能数字不敏感。
