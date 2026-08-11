# TECH SPEC

## 技术栈
- Vite + TypeScript
- Three.js (WebGL)
- MediaPipe Tasks Vision / Hand Landmarker（以当前可用稳定 API 为准）
- Web Audio API
- HTML/CSS HUD

## 架构建议
`src/game`：循环、场景、状态；`src/camera`：摄像头、追踪、GestureDetector；`src/player`：角色和控制；`src/ai`：AI；`src/physics`：球和碰撞；`src/ui`：HUD/Debug；`src/audio`：声音。

不要为了形式强行拆文件；保持模块边界清楚即可。

## 数据流
Camera frame → Hand landmarks → smoothing → wrist velocity/direction → swing event → PlayerController → hit window → ShuttlePhysics。

渲染与摄像头推理尽量解耦；推理不必每个 render frame 执行。允许降低推理频率，并使用最近结果驱动渲染。

## 手势检测
维护最近 N 帧手腕样本：时间、归一化位置。计算平滑速度向量和峰值。参数至少包括：swingSpeedThreshold、cooldownMs、smoothing、dominantHand、confidence threshold。Debug UI 可实时调参。

## 性能预算
目标 1280×720；最低目标 30 FPS，尽量 60 FPS。摄像头约 640×480。默认 Low/Medium 画质；简单材质；限制灯光和阴影；限制 draw calls；粒子池化；避免昂贵后处理和实时反射。

## 角色“软”效果
不要真实软体模拟。用简单骨骼/层级 Transform + spring/damping + squash/lean + 程序化挥拍和恢复，实现摇晃、惯性、失衡。

## 球物理
固定或稳定 timestep。使用位置、速度、重力、阻力和边界/网碰撞。优先可调参数。不要引入完整刚体引擎，除非后续证明确有必要。

## 浏览器与权限
必须处理：HTTPS/localhost 摄像头要求、用户拒绝权限、无摄像头、MediaPipe 初始化失败、页面失焦。错误必须给可理解 UI，而不是只写 console。

## 可观测性
Debug 显示：render FPS、tracking FPS、tracking confidence、wrist velocity、detected swing、cooldown、球状态。生产模式可关闭。

## 测试
纯逻辑（挥拍分类、击球窗口、比分、AI 状态）应可单元测试。摄像头和真实性能依赖人工实测，不伪造测试结论。
