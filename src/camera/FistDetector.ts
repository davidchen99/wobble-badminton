/**
 * FistDetector：握拳检测（空手模式的击打输入）。
 *
 * 原理：计算四指（食/中/无名/小）"指尖到手腕距离 / 指根到手腕距离"的平均比值。
 * 张开时约 1.8~2.2，握紧时约 1.0~1.3。用迟滞区间（进 < enterRatio，出 > exitRatio）
 * 加最小间隔防抖，进入握拳的瞬间产生一次击打事件；
 * 距上次击打不超过 doubleGripMs 的再次握拳记为"连握"（扣球输入）。
 * 纯逻辑，可单元测试。
 */

/** 四指的 [指根 MCP, 指尖 TIP] 关键点下标 */
const FINGERS: [number, number][] = [
  [5, 8],
  [9, 12],
  [13, 16],
  [17, 20],
];
const WRIST = 0;

export interface FistParams {
  /** 平均比值低于此值判定为握拳 */
  enterRatio: number;
  /** 握拳状态下比值高于此值判定为张开 */
  exitRatio: number;
  /** 两次握拳事件的最小间隔（毫秒） */
  minIntervalMs: number;
  /** 连握窗口（毫秒）：窗口内的第二次握拳 = 扣球 */
  doubleGripMs: number;
}

export const DEFAULT_FIST_PARAMS: FistParams = {
  enterRatio: 1.35,
  exitRatio: 1.6,
  minIntervalMs: 160,
  doubleGripMs: 350,
};

export interface GripEvent {
  /** 事件时刻（秒，与调用方时钟一致） */
  t: number;
  /** 是否为连握（扣球） */
  double: boolean;
  /** 当前平均弯曲比值（调试用） */
  ratio: number;
}

type Point = { x: number; y: number };

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 平均弯曲比值：越小握得越紧 */
export function curlRatio(landmarks: readonly Point[]): number {
  const wrist = landmarks[WRIST];
  let sum = 0;
  for (const [mcp, tip] of FINGERS) {
    const base = dist(landmarks[mcp], wrist);
    sum += base > 1e-6 ? dist(landmarks[tip], wrist) / base : 2;
  }
  return sum / FINGERS.length;
}

export class FistDetector {
  readonly params: FistParams;
  /** 当前是否处于握拳状态（供移动模块冻结手大小采样） */
  isFist = false;
  /** 最近一次弯曲比值（调试用） */
  lastRatio = 2;

  private lastFireAt = -Infinity;

  constructor(params: Partial<FistParams> = {}) {
    this.params = { ...DEFAULT_FIST_PARAMS, ...params };
  }

  /**
   * 每帧喂入手部关键点（21 个，归一化坐标）。
   * @param landmarks null 表示丢手（自动解除握拳状态，不触发事件）
   * @param t 秒
   * @returns 进入握拳瞬间返回事件，否则 null
   */
  update(landmarks: readonly Point[] | null, t: number): GripEvent | null {
    if (!landmarks || landmarks.length < 21) {
      this.isFist = false;
      return null;
    }

    const ratio = curlRatio(landmarks);
    this.lastRatio = ratio;

    if (!this.isFist && ratio < this.params.enterRatio) {
      this.isFist = true;
      if (t - this.lastFireAt < this.params.minIntervalMs / 1000) return null;
      const isDouble = t - this.lastFireAt <= this.params.doubleGripMs / 1000;
      this.lastFireAt = t;
      return { t, double: isDouble, ratio };
    }
    if (this.isFist && ratio > this.params.exitRatio) {
      this.isFist = false;
    }
    return null;
  }
}
