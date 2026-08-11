/**
 * GestureDetector：纯逻辑挥拍识别，不依赖 DOM/摄像头，可单元测试。
 *
 * 输入是手腕样本流（已做镜像翻转的归一化坐标），维护短时间轨迹缓冲，
 * 用 EMA 平滑速度；平滑速度超过阈值且过了 cooldown 即产生一个 swing event。
 * 设计原则（GAME_DESIGN）：摄像头是"体感意图输入"，重响应速度，不重精度。
 */

export type SwingDirection = 'left' | 'right' | 'up' | 'down';

export interface SwingEvent {
  direction: SwingDirection;
  /** 触发时的平滑速度（归一化单位/秒，x 已按宽高比修正） */
  speed: number;
  /** 触发时刻（与样本同一时钟，秒） */
  time: number;
}

export interface WristSample {
  /** 秒，单调递增时钟 */
  t: number;
  /** 镜像后的归一化坐标：x∈[0,1] 左→右，y∈[0,1] 上→下 */
  x: number;
  y: number;
  /** 追踪置信度 0..1 */
  confidence: number;
}

export interface GestureParams {
  /** 触发挥拍的平滑速度阈值（归一化/秒） */
  swingSpeedThreshold: number;
  /** 两次挥拍的最小间隔（毫秒） */
  cooldownMs: number;
  /** 速度 EMA 平滑系数 0..1，越大越跟手、越小越稳 */
  smoothing: number;
  /** 低于此置信度的样本视为丢手 */
  minConfidence: number;
  /** 轨迹缓冲保留时长（秒），供 debug 绘制/后续分析 */
  bufferSeconds: number;
  /** 横向速度按摄像头宽高比放大，避免横向偏慢 */
  aspect: number;
}

export const DEFAULT_GESTURE_PARAMS: GestureParams = {
  swingSpeedThreshold: 1.6,
  cooldownMs: 350,
  smoothing: 0.45,
  minConfidence: 0.5,
  bufferSeconds: 0.4,
  aspect: 4 / 3,
};

/** 相邻样本间隔超过此值视为追踪中断，不计算速度（秒） */
const MAX_SAMPLE_GAP = 0.12;

export function classifyDirection(vx: number, vy: number): SwingDirection {
  if (Math.abs(vx) >= Math.abs(vy)) {
    return vx >= 0 ? 'right' : 'left';
  }
  return vy >= 0 ? 'down' : 'up';
}

export class GestureDetector {
  readonly params: GestureParams;
  private buffer: WristSample[] = [];
  private prev: WristSample | null = null;
  private velX = 0;
  private velY = 0;
  private lastSwingAt = -Infinity;

  constructor(params: Partial<GestureParams> = {}) {
    this.params = { ...DEFAULT_GESTURE_PARAMS, ...params };
  }

  /**
   * 喂入一个手腕样本；若触发挥拍则返回 SwingEvent，否则返回 null。
   * 低置信度样本等同于丢手。
   */
  addSample(sample: WristSample): SwingEvent | null {
    if (sample.confidence < this.params.minConfidence) {
      this.onLost();
      return null;
    }

    this.buffer.push(sample);
    const cutoff = sample.t - this.params.bufferSeconds;
    while (this.buffer.length > 0 && this.buffer[0].t < cutoff) {
      this.buffer.shift();
    }

    if (this.prev) {
      const dt = sample.t - this.prev.t;
      if (dt > 0 && dt <= MAX_SAMPLE_GAP) {
        const rawVx = ((sample.x - this.prev.x) * this.params.aspect) / dt;
        const rawVy = (sample.y - this.prev.y) / dt;
        const s = this.params.smoothing;
        this.velX = this.velX * (1 - s) + rawVx * s;
        this.velY = this.velY * (1 - s) + rawVy * s;
      } else if (dt > MAX_SAMPLE_GAP) {
        // 追踪中断：速度清零重来，避免把瞬移当成挥拍
        this.velX = 0;
        this.velY = 0;
      }
    }
    this.prev = sample;

    const speed = Math.hypot(this.velX, this.velY);
    const cooldownOver = sample.t - this.lastSwingAt >= this.params.cooldownMs / 1000;
    if (speed >= this.params.swingSpeedThreshold && cooldownOver) {
      this.lastSwingAt = sample.t;
      return {
        direction: classifyDirection(this.velX, this.velY),
        speed,
        time: sample.t,
      };
    }
    return null;
  }

  /** 手部丢失（未检出/置信度过低）时调用，重置速度估计。 */
  onLost(): void {
    this.prev = null;
    this.velX = 0;
    this.velY = 0;
  }

  /** 当前平滑速度（归一化/秒），供 debug 显示。 */
  get velocity(): { x: number; y: number } {
    return { x: this.velX, y: this.velY };
  }

  /** 当前缓冲的手腕轨迹（旧→新），供 debug 绘制。 */
  get trail(): readonly WristSample[] {
    return this.buffer;
  }

  cooldownActive(nowSeconds: number): boolean {
    return nowSeconds - this.lastSwingAt < this.params.cooldownMs / 1000;
  }
}
