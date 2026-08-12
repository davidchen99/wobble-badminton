/**
 * MovementTracker：把"手部慢速位移"解释为角色移动意图（GAME_DESIGN 意图分离）。
 *
 * - 左右：掌心 x 的低通位置 → 横向跑位
 * - 前后：手在画面中的大小（0→9 号关键点跨度）相对基准的比例 → 前后移动
 *   （越近越大 = 前进，越远越小 = 后退；基准在初始稳定期自动校准）
 * - 速度超过 gate（挥拍阈值比例）或握拳时冻结意图——那是击打动作，不是移动
 * 纯逻辑，可单元测试。
 */
export class MovementTracker {
  /** 低通后的手部位置（归一化坐标，0.5/0.55 约为画面中央） */
  pos = { x: 0.5, y: 0.55 };
  /** 低通后的手大小比例（当前/基准；1 = 基准距离） */
  sizeRatio = 1;
  /** 位置意图冻结门限：手部速度超过它视为击打/挥动，不更新位置 */
  gate: number;
  /** 低通时间常数（秒）：越小越跟手，越大越稳 */
  tau: number;

  private initialized = false;
  private calibSum = 0;
  private calibCount = 0;
  /** 基准手大小；0 = 未校准 */
  private baseline = 0;

  constructor(gate: number, tau = 0.18) {
    this.gate = gate;
    this.tau = tau;
  }

  /** 是否已完成基准手大小校准 */
  get calibrated(): boolean {
    return this.baseline > 0;
  }

  /**
   * @param sample 掌心位置 + 手大小；null 表示丢手（保持原位）
   * @param speed  当前手部平滑速度（归一化/秒）
   * @param dt     帧间隔（秒）
   * @param isFist 当前是否握拳（握拳时手变小，冻结大小采样避免误判为后退）
   */
  update(
    sample: { x: number; y: number; size: number } | null,
    speed: number,
    dt: number,
    isFist = false,
  ): void {
    if (!sample) return;

    // 基准校准：最初 0.6 秒稳定（慢速）手部采样的平均大小
    if (!this.calibrated && speed < this.gate && !isFist) {
      this.calibSum += sample.size;
      this.calibCount++;
      if (this.calibCount >= 36) {
        this.baseline = this.calibSum / this.calibCount;
      }
    }

    if (!this.initialized) {
      this.pos = { x: sample.x, y: sample.y };
      this.initialized = true;
      return;
    }
    if (speed > this.gate || isFist) return; // 击打动作中，冻结位置意图

    const k = 1 - Math.exp(-dt / this.tau);
    this.pos.x += (sample.x - this.pos.x) * k;
    this.pos.y += (sample.y - this.pos.y) * k;
    if (this.calibrated) {
      // 大小变化比位置更钝一些，避免前后抽动
      const kSize = 1 - Math.exp(-dt / (this.tau * 2));
      this.sizeRatio += (sample.size / this.baseline - this.sizeRatio) * kSize;
    }
  }

  /** 回到中央并重新校准（开局/重开/切换模式时调用） */
  reset(): void {
    this.pos = { x: 0.5, y: 0.55 };
    this.sizeRatio = 1;
    this.initialized = false;
    this.baseline = 0;
    this.calibSum = 0;
    this.calibCount = 0;
  }
}

/** 场地活动范围（相对玩家主场位） */
export const MOVE_RANGE = {
  /** 横向最大偏移（米） */
  x: 2.2,
  /** 纵向最大偏移（米）：手变大 = 前进（靠近网），变小 = 后退 */
  z: 1.4,
  /** 角色移动最大速度（米/秒） */
  speed: 5,
} as const;

/** 手大小比例 → 前后的灵敏度：比例偏离 1 多少映射满量程 */
const SIZE_SENSITIVITY = 7;

/** 把归一化手部状态映射为场地目标坐标（以 home 为中心） */
export function mapToCourt(
  pos: { x: number; y: number },
  home: { x: number; z: number },
  sizeRatio = 1,
): { x: number; z: number } {
  const x = home.x + clamp((pos.x - 0.5) * 2 * MOVE_RANGE.x, -MOVE_RANGE.x, MOVE_RANGE.x);
  // 手变大（靠近摄像头）= 前进 = 朝网方向（玩家 z>0 时 -z，AI 侧相反）
  const zOffset = clamp((sizeRatio - 1) * SIZE_SENSITIVITY, -1, 1) * MOVE_RANGE.z;
  const z = home.z - zOffset * Math.sign(home.z || 1);
  return { x, z };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
