# Wobble Badminton — AI Development Starter Pack

一个面向普通 2021 年办公 ThinkPad 的轻量 3D 摄像头体感羽毛球小游戏项目。

## 核心体验
玩家站在普通摄像头前挥手/挥轻型软拍，屏幕里的呆萌低模角色同步挥拍，与 AI 连续对打。角色软乎乎、略笨拙、有喜剧感；游戏优先低延迟、流畅和击球反馈，而不是写实画质。

## 给 Codex / Kimi 的第一条指令
请先完整阅读根目录 `AGENTS.md`，再阅读 `docs/` 中所有规格文档。不要直接制作完整三关。先按照 `MVP_PLAN.md` 和 `TASKS.md` 完成 Vertical Slice。每完成一个可运行里程碑，运行检查、记录结果、更新 TASKS.md，再继续下一步。

## 文档
- `AGENTS.md` — AI 开发规则与最高原则
- `docs/PRD.md` — 产品需求
- `docs/GAME_DESIGN.md` — 核心玩法
- `docs/TECH_SPEC.md` — 技术架构与性能预算
- `docs/ART_DIRECTION.md` — 美术与动画方向
- `docs/MVP_PLAN.md` — MVP/Vertical Slice 计划
- `TASKS.md` — 可执行开发任务清单
- `PROMPT_START.md` — 可直接复制给 Codex/Kimi 的启动提示词

## 建议技术栈
Vite + TypeScript + Three.js + MediaPipe Tasks Vision + Web Audio API。

> 本包是“开发规格启动包”，故意不预先生成大量未经验证的游戏代码。AI 应按文档从最小可运行闭环开始建立代码，以避免架构过度设计。
