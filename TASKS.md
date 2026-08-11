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
- [ ] 比分
- [ ] 开始/暂停/重开
- [ ] 基础击球音效
- [ ] 轻微击球反馈
- [ ] Debug FPS/tracking stats

## MVP Gate（必须真实设备验证）
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
