# TASKS

> AI：完成后将 `[ ]` 改为 `[x]`，并在下方 Notes 记录重要决定。不要跳过 Gate。

## M0 工程
- [x] 初始化 Vite + TypeScript
- [x] 安装并配置 Three.js
- [x] 创建基础 game loop / resize
- [x] 创建基础 HUD 和错误提示区
- [x] 配置 typecheck/build 命令

## M1 摄像头
- [x] CameraManager：授权/错误处理
- [x] 集成 MediaPipe Hand Landmarker
- [x] 显示 tracking debug
- [x] GestureDetector：轨迹缓冲与平滑
- [x] 输出 swing direction / speed / cooldown
- [x] 添加灵敏度调参 UI

## M2 场景
- [x] Low-poly 球场/网
- [x] 程序化呆萌玩家角色
- [x] 程序化 AI 角色
- [x] 羽毛球可视对象
- [x] 固定易读镜头与简单灯光

## M3 控制
- [x] swing event 驱动挥拍
- [x] 正/反手基础动作
- [x] spring/damping 身体惯性
- [x] 防止重复触发

## M4 球
- [x] ShuttlePhysics
- [x] 辅助击球时空窗口
- [x] 过网/落地/出界
- [x] 发球/重置
- [x] 单元测试纯逻辑

## M5 AI
- [x] 预计落点
- [x] AI 移动
- [x] AI 挥拍与回球
- [x] 可调反应延迟/失误率
- [x] 连续 rally

## M6 游戏化
- [x] 比分
- [x] 开始/暂停/重开
- [x] 基础击球音效
- [x] 轻微击球反馈
- [x] Debug FPS/tracking stats

## M7 体验修复（首轮实测后插入，Gate 重测前完成）
- [x] 性能：确认并显示 GPU/CPU delegate；推理降分辨率；推理频率自适应（慢则降频保渲染）；预览绘制与推理解耦（Worker 化）
- [x] 节奏：AI 回球/发球改高慢球（飞行 1.6~2 秒）；全局球速/难度参数
- [x] 挥拍手感：掌心（9 号关键点）采样、降低速度阈值、缩短触球延迟
- [x] 新手引导：4 步（举手识别 → 左挥 → 右挥 → 实战开球），每步实时识别反馈
- [x] 大画幅追踪预览（可切换大小）+ 站位/持拍指引
- [x] 身体移动控制角色（手慢动=移动找球，快动=挥拍；纵向=前后微调）
- [x] 音效升级：分层击球声、随挥速变调、轻混响、AI 击球/触网/落地声
- [x] Debug 面板默认隐藏，快捷键呼出

## M8 操控重做与 21 分制（二轮定稿 2026-08-12，Gate 重测前完成）
- [ ] 握拳检测：手指弯曲度 + 迟滞防抖；握拳即击打（正板直打，单一标准挥拍动作）
- [ ] 连握扣球：0.35s 内第二握 → 空中的球补成扣杀（更快更平 + 闪光）
- [ ] 手大小 = 前后移动（关键点跨度，引导第 1 步校准基准）
- [ ] 键盘+持物模式：WASD 移动 + 快挥击打；M 键切换；屏幕角落常显当前模式
- [ ] 空手模式下快挥不触发击打
- [ ] 21 分简化制：先到 21 获胜、胜负结算画面（赢家乱跳/输家坐地）、R 开新局
- [ ] 开局慢球默认 1.8 秒/趟
- [ ] Help 帮助系统：左上角 ? 图标 + H/F1，含操作说明 + 重进引导入口
- [ ] 动作简图小动画（Canvas 程序化，帮助层与引导共用）
- [ ] 新手引导改握拳版：举手校准 → 握拳击打 → 连握扣球 → 站位移动开球

## MVP Gate（必须真实设备验证）
- 首轮实测（2026-08-11）未通过项：主线程同步推理导致卡顿冻结；球速过快无法回击；无新手引导不知如何击打；预览画幅太小。→ M7 已修复
- M7 修复经用户验证（2026-08-12）：游戏可运行、新手引导正常、骨架能识别手。→ 按二轮定稿执行 M8 后重测
- [ ] ThinkPad 上完成首次实测
- [ ] 记录平均/最低 FPS
- [ ] 记录挥拍体感延迟
- [ ] 记录误触发与漏识别问题
- [ ] 连续 rally 体验可接受
- [ ] 用户确认核心体验值得继续

## Gate 之后才做
- [ ] Good/Great/Perfect
- [ ] Combo
- [ ] 第一关正式美术
- [ ] 第二关
- [ ] 第三关 Boss
- [ ] 更多音效/特效

## Notes
- M0：手写脚手架（非 create-vite），three@0.1xx + vite + TS strict；Game 循环用 setAnimationLoop，delta 钳制 1/20s；typecheck/build 通过。
- M1：模型 hand_landmarker.task 与 tasks-vision wasm 已本地化到 public/（下载需 -4 强制 IPv4，googleapis 的 IPv6 在此网络不通）。数据空间统一做 x 镜像翻转，预览容器 CSS scaleX(-1) 保持叠加对齐。推理限频 33ms，GPU delegate 失败回退 CPU。GestureDetector 为纯逻辑（EMA 平滑速度 + 阈值 + cooldown），7 个单测通过。googleapis /npm 偶发网络失败，重试即可。
- M2：场地按真实单打尺寸（5.18×13.4m，网高 1.55m），z>0 玩家侧。角色为程序化层级 Transform（squashG/bodyG/armR），球拍夸张化挂右臂。网面用 CanvasTexture 网格贴图，无阴影、半球光+单方向光。镜头固定 (0,6.2,11.2) 看 (0,0.6,-1.2)。
- M3：PlayerController 用 0.38s 关键帧挥拍动画（右=正手横扫/左=反手/上=过顶/下=低捞），触球点在进度 0.42 并触发 onStrike（供 M4 击球判定）。lean/squash 两个 spring/damper 提供身体惯性。防重复触发双保险：手势 cooldown + 动画前 55% 保护期。3 个单测通过。
- M4：ShuttlePhysics 用线性阻力 + 每步精确指数积分，与 computeHitVelocity 闭式解严格一致——选定落点反解初速度即"统一可靠回球"。solveFlight 逐步加长飞行时间保证过网。触网时球拉回触网侧 0.02m 再下落，保证判分与视觉一致。RallyManager 串起 发球→飞行→窗口回击→落地/出界判分→重新发球；得分者发球。20 个单测通过。
- M5：AIController 规则 AI：predictLanding 预测落点 → 横向移动（4.5m/s 限幅 ±2.3m）→ 反应延迟（默认 180ms）→ 按 STRIKE_LEAD（0.16s）提前量挥拍，复用 PlayerController 动画。失误率默认 15%（整球不接）。RallyManager.updateHome 让击球窗口/落点跟随 AI 站位。AI 参数进 Debug 滑杆。预测落点与 AI 回球/失误行为有集成测试。
- M6：游戏流状态机 menu/playing/paused（空格或点击开始，空格暂停，R 重开）。SoundManager 全程序化音效（击球噪声爆+音调、挥空气流声、得分双音/低音），AudioContext 在首次用户手势创建。击球反馈：镜头冲击（指数衰减）+ 球体闪光 + squash。顶部常驻计分板。
- 启动器：`启动游戏.bat`（GBK+CRLF 编码，cmd 才能正确解析中文）双击启动 dev 服务器并自动开浏览器，桌面快捷方式+icon.ico 由 make_shortcut.ps1 生成。注意：.bat 改内容后必须保持 GBK 编码，否则 cmd 解析乱码。
- 首轮实测根因记录（2026-08-11）：卡顿根因 = 主线程同步推理（detectForVideo 阻塞渲染循环）；回不了球 = 球飞行时间短（1s 起）+ 挥拍阈值/触球延迟偏高 + 卡顿叠加；采样点将改掌心 9 号点。M7 任务已列入 TASKS。
- M7 教训：Vite dev 会给 module Worker 内的动态 import 追加 ?import 纳入模块图，触发 "/public 禁止从源码 import" 守卫（@vite-ignore 无效）。解法 = public/tracking-worker.js 经典 Worker + importScripts 加载 vision_bundle.js（IIFE 全局 Vision），wasm 胶水走 MediaPipe 官方 importScripts 路径。
- M8 定稿（2026-08-12，用户确认）：双模式操控——空手默认（握拳=击打正板直打；连握两次=扣球，第一握立即击打不等待，第二握 0.35s 内空中补刀；手大小=前后移动，引导校准基准）；键盘+持物（WASD+快挥，M 切换）。21 分简化制先到 21 胜无 deuce。开局慢球 1.8s。Help 系统（左上角 ? + H/F1 + 动作简图小动画 + 重进引导）。三关帽子（黑/橙/王冠）留 V1。回球不做方向控制。
