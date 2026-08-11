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
- [ ] Low-poly 球场/网
- [ ] 程序化呆萌玩家角色
- [ ] 程序化 AI 角色
- [ ] 羽毛球可视对象
- [ ] 固定易读镜头与简单灯光

## M3 控制
- [ ] swing event 驱动挥拍
- [ ] 正/反手基础动作
- [ ] spring/damping 身体惯性
- [ ] 防止重复触发

## M4 球
- [ ] ShuttlePhysics
- [ ] 辅助击球时空窗口
- [ ] 过网/落地/出界
- [ ] 发球/重置
- [ ] 单元测试纯逻辑

## M5 AI
- [ ] 预计落点
- [ ] AI 移动
- [ ] AI 挥拍与回球
- [ ] 可调反应延迟/失误率
- [ ] 连续 rally

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
