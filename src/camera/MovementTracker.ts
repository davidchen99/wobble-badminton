/**
 * MovementTracker：把"手部慢速位移"解释为角色移动意图（GAME_DESIGN 意图分离）。
 * 速度超过 gate（挥拍阈值的某一比例）时冻结位置意图——那是挥拍，不是移动。
 * 输出为低通平滑后的归一化手部位置，由调用方映射到场地坐标。
 * 纯逻辑，可单元测试。
 */
export class MovementTracker {
  /** 低通后的手部位置（归一化坐标，0.5/0.55 约为画面中央） */
  pos = { x: 0.5, y: 0.55 };
  /** 位置意图冻结门限：手部速度超过它视为挥拍，不更新位置 */
  gate: number;
  /** 低通时间常数（秒）：越小越跟手，越大越稳 */
  tau: number;

  private initialized = false;

  constructor(gate: number, tau = 0.18) {
    this.gate = gate;
    this.tau = tau;
  }

  /**
   * @param sample 当前掌心位置；null 表示丢手（保持原位）
   * @param speed  当前手部平滑速度（归一化/秒）
   * @param dt     帧间隔（秒）
   */
  update(sample: { x: number; y: number } | null, speed: number, dt: number): void {
    if (!sample) return;
    if (!this.initialized) {
      this.pos = { ...sample };
      this.initialized = true;
      return;
    }
    if (speed > this.gate) return; // 挥拍中，冻结位置意图
    const k = 1 - Math.exp(-dt / this.tau);
    this.pos.x += (sample.x - this.pos.x) * k;
    this.pos.y += (sample.y - this.pos.y) * k;
  }

  /** 回到中央（开局/重开时调用） */
  reset(): void {
    this.pos = { x: 0.5, y: 0.55 };
    this.initialized = false;
  }
}

/** 场地活动范围（相对玩家主场位） */
export const MOVE_RANGE = {
  /** 横向最大偏移（米），约为半场内 comfortable 跨步范围 */
  x: 2.2,
  /** 纵向最大偏移（米），手举高=前移靠近网，手放低=后退 */
  z: 1.4,
  /** 角色移动最大速度（米/秒） */
  speed: 5,
} as const;

/** 把归一化手部位置映射为场地目标坐标（以 home 为中心） */
export function mapToCourt(
  pos: { x: number; y: number },
  home: { x: number; z: number },
): { x: number; z: number } {
  const x = home.x + clamp((pos.x - 0.5) * 2 * MOVE_RANGE.x, -MOVE_RANGE.x, MOVE_RANGE.x);
  const z = home.z + clamp((pos.y - 0.55) * 2 * MOVE_RANGE.z, -MOVE_RANGE.z, MOVE_RANGE.z);
  return { x, z };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
