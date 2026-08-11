/**
 * 手部追踪的共享类型与常量。
 *
 * 推理本身在 public/tracking-worker.js（经典 Worker，importScripts 加载 MediaPipe）。
 * 该文件中的结果提取约定（镜像翻转 / 掌心 9 号点 / 置信度）与本文件保持一致，改动需同步。
 */

export interface TrackedHand {
  /** 掌心坐标（9 号关键点，已镜像翻转的归一化坐标；挥拍弧线比手腕大，识别更灵敏） */
  palm: { x: number; y: number };
  /** 手部追踪置信度 0..1 */
  confidence: number;
  /** 21 个关键点（已镜像翻转），供 debug 绘制 */
  landmarks: { x: number; y: number }[];
}

/**
 * 坐标约定：getUserMedia 原始画面是"照片视角"（用户的右手在画面左侧）。
 * Worker 内统一做 x 镜像翻转，使数据空间与玩家自我感知的镜面一致；
 * debug 预览容器用 CSS scaleX(-1) 镜像显示，叠加绘制保持对齐。
 */

/** MediaPipe 手部骨架连线（供 debug 绘制） */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
