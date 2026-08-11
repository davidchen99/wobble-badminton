# MVP / VERTICAL SLICE PLAN

## Milestone 0 — 工程可运行
建立 Vite + TS；Three.js 空场景；基础 HUD；build/typecheck 通过。

## Milestone 1 — 摄像头追踪
授权摄像头；MediaPipe 初始化；显示手关键点/状态；计算手腕轨迹、速度；Debug 调参。

## Milestone 2 — 可玩的静态球场
球场、网、两个低模角色、球、固定镜头；720p 流畅。

## Milestone 3 — 挥拍驱动角色
GestureDetector 产生 swing event；角色立即挥拍；有 cooldown；视觉上有轻惯性。

## Milestone 4 — 击球闭环
球进入辅助击球区 + swing → 击球；球过网/落地/出界；重新发球。

## Milestone 5 — AI Rally
AI 预测落点、移动、回球；玩家可连续对打。

## Milestone 6 — 游戏化
比分、HUD、开始/暂停/重开；基础声音；轻反馈。

## Milestone 7 — 体验修复与新手引导（首轮实测后插入）
卡顿治理（推理 delegate/降分辨率/自适应降频/绘制解耦）；高慢球节奏 + 球速参数；掌心采样与挥拍灵敏度；4 步新手引导；大画幅预览与站位指引；身体移动控制；音效升级；Debug 默认隐藏。

## Gate — 是否继续完整游戏
在目标 ThinkPad 实测：延迟、误触发、漏识别、FPS、连续 rally 是否好玩。未通过则只调核心，不做关卡扩张。
首轮实测（2026-08-11）未通过：卡顿、球快、无引导、画幅小 → 见 TASKS.md M7，完成后重测。
