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

## 第二批踩过的坑（每一条都真实吃过亏）

- **`LatheGeometry` 只吃 `Vector2` 数组。** 传 `[r, y]` 数组不报错，但几何全是 NaN：
  网格照样建出来、控制台不报异常、包围盒是 NaN，于是整件展品的 scale/position 变 NaN
  —— **直接从画面消失**。`artifacts.js` 的 `lathe()` 辅助函数专做这个映射，一律用它；
  `museum.js` 里没有这个辅助函数，要自己 `.map(([r, y]) => new THREE.Vector2(r, y))`。
- **验证"东西在不在"必须看包围盒是不是有限值。** 只查「有没有异常」和「网格数量」，
  在 NaN 的情况下**全是绿的** —— 我因此两次向你汇报过假的"验证通过"。
- **命令太长会被工具从中间截断。** 报错长得像 heredoc 语法问题（"delimited by end-of-file"），
  真正原因是整条命令过长。长内容一律用 `write` 工具写文件，不要塞 bash heredoc。
- **`makeNormalMap` / `makeRoughnessMap` 返回的是 canvas，不是 Texture。**
  直接塞进 `material.normalMap` 会在**渲染期**抛 `reading 'elements'`（构建期不报）。
- **`Shape` 的首点必须 `moveTo`。** 首点用 `lineTo` 会从 (0,0) 起笔，挤出后多出一块
  横穿房间的大三角。
- **`InstancedMesh` 的实例矩阵是相对它父级的。** 量世界坐标要再乘它自己的 `matrixWorld`，
  否则两批物体算在两个坐标系里，间隙能算出 25 m 这种荒谬值。
- **过滤条件别按正负号的直觉写。** 编钟厅在 z < 0 一侧，我两次写出 `if (z < -18) return`，
  把要找的东西全过滤掉，然后误报"没建出来"。
- **展品归属只看 `tag`，不看数组下标**（下标曾经让 17/28 件跑错厅）。
- **多行 `-m` 提交信息会被截断**，用多个单行 `-m`。
- **WebAudio 的裸锯齿/方波铺底就是"滋滋"底噪**：低频谐波极多，必须过低通。

## 排查「渲染不对」的清单（本轮反复栽在同一件事上）

- **「黑」至少有四种成因，必须逐条量，不能测完前两条就下结论**：
  ① 材质参数（metalness 接近 1 且没有环境贴图 → 全黑）；
  ② 贴图有没有加载 / 解码（`map` 非空 ≠ `map.image` 有宽度 —— 无头环境里
     GLTFLoader 的 blob 路径会失败，报 `Couldn't load texture blob`）；
  ③ **顶点色**（Blender 常导出一份全黑 `COLOR_0`，GLTFLoader 见到就打开
     `vertexColors`，three.js 把它与贴图**相乘** → 黑 × 贴图 = 纯黑）；
  ④ 法线朝内（背光变暗，不是纯黑）。
- **改完要确认「改到了正确的对象上」。** 曾把 `interactable.model` 换成脱离
  场景的孤儿，于是连续三轮的材质修复全打在看不见的对象上，而每次测出来的
  数据都不变 —— 我却没怀疑过对象本身。**先查父子关系，再改内容。**
- **判据要按被检验的东西写，不能拿一个标准套所有。** 用「最大轴必须是 Y」
  判断器物是否立着：对梅瓶成立，对虎座鸟架鼓（宽 1.6 > 高 1.48 > 薄 0.56）
  就误报「躺倒」，差点把好好的模型转 90°。
- **「没找到」和「不存在」要分清。** 过滤条件写反会返回空数组，然后被当成
  「没建出来」。编钟厅在 z < 0，我两次写成 `if (z < -18) return`。
- **控制台不能过滤。** 为了「看得清爽」用 `/model|材质/` 过滤，恰好把唯一
  指出病因的 `Couldn't load texture blob` 滤掉了，白绕四轮。
- **`git push <remote> main` 推的是「本地 main 分支」。** 当前在 `feat/report`
  之类分支上时会报 `Everything up-to-date` 却什么都没推 —— 用
  `git push <remote> HEAD:main`。
- **`EXTERNAL_MODELS` 的 `flipY` / `mirrorU` 只对「自己抠图」的兜底路径生效。**
  glTF 原生路径由 GLTFLoader 按规范处理（UV 原点在左上、`flipY = false`），
  再按配置覆盖一次反而是错的。
- **多贴图模型要按 glTF 声明的对应关系分配**，不能按遍历顺序盲分 ——
  遍历顺序跟着场景图走，与材质下标顺序不一定一致。
