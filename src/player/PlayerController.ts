import type { SwingDirection, SwingEvent } from '../camera/GestureDetector';
import type { WobbleCharacter } from '../game/character';

/** 一次挥拍动画时长（秒） */
const SWING_DURATION = 0.32;
/** 动画进度中的触球点（M4 在此做击球判定） */
const STRIKE_POINT = 0.34;
/** 挥拍启动到触球的领先时间（秒），AI 挥拍时机也用它 */
export const STRIKE_LEAD_SECONDS = SWING_DURATION * STRIKE_POINT;
/** 动画前段免疫新挥拍，防止一次挥手重复触发（手势层 cooldown 之外的第二道保险） */
const RESTART_GUARD = 0.55;

/** 挥拍关键帧：[动画进度, armRotX, armRotZ]，分段线性插值；触球姿势在 STRIKE_POINT 进度处 */
const SWING_KEYS: Record<SwingDirection, [number, number, number][]> = {
  // 正手：右侧后摆 → 快速横扫到左前上
  right: [
    [0, -0.2, -0.35],
    [0.18, 0.15, -1.5],
    [0.34, -0.9, 0.9],
    [1, -0.2, -0.35],
  ],
  // 反手：体前横收 → 向左外侧甩出
  left: [
    [0, -0.2, -0.35],
    [0.18, -0.6, 0.9],
    [0.34, -0.3, -1.6],
    [1, -0.2, -0.35],
  ],
  // 过顶：举臂后仰 → 向前扣下
  up: [
    [0, -0.2, -0.35],
    [0.18, 1.3, -0.2],
    [0.34, -1.7, -0.1],
    [1, -0.2, -0.35],
  ],
  // 低手位：沉臂后收 → 低掠向前
  down: [
    [0, -0.2, -0.35],
    [0.18, 0.5, -0.9],
    [0.34, -1.1, -0.5],
    [1, -0.2, -0.35],
  ],
};

function sampleKeys(keys: [number, number, number][], p: number): { rx: number; rz: number } {
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, rx0, rz0] = keys[i - 1];
      const [p1, rx1, rz1] = keys[i];
      const f = p1 === p0 ? 0 : (p - p0) / (p1 - p0);
      return { rx: rx0 + (rx1 - rx0) * f, rz: rz0 + (rz1 - rz0) * f };
    }
  }
  const last = keys[keys.length - 1];
  return { rx: last[1], rz: last[2] };
}

/**
 * PlayerController：把 swing event 翻译成角色的程序化挥拍动作。
 * 身体惯性用 spring/damper（lean 侧倾 + squash 压缩），不用骨骼动画。
 */
export class PlayerController {
  /** 动画到达触球点时回调（M4 击球判定挂这里） */
  onStrike: ((dir: SwingDirection, speed: number) => void) | null = null;

  private character: WobbleCharacter;
  private swingPhase: number | null = null;
  private swingDir: SwingDirection = 'right';
  private swingSpeed = 0;
  private strikeFired = false;

  // 身体惯性弹簧（侧倾 + 压缩）
  private lean = 0;
  private leanVel = 0;
  private squash = 0;
  private squashVel = 0;

  constructor(character: WobbleCharacter) {
    this.character = character;
  }

  get swinging(): boolean {
    return this.swingPhase !== null;
  }

  /** 当前是否处于触球瞬间的宽容窗口内（M4 用） */
  get inStrikeWindow(): boolean {
    return this.swingPhase !== null && Math.abs(this.swingPhase - STRIKE_POINT) < 0.1;
  }

  /** 收到手势挥拍事件 */
  swing(event: SwingEvent): void {
    if (this.swingPhase !== null && this.swingPhase < RESTART_GUARD) return;
    this.swingPhase = 0;
    this.swingDir = event.direction;
    this.swingSpeed = event.speed;
    this.strikeFired = false;
  }

  update(dt: number): void {
    if (this.swingPhase !== null) {
      const prev = this.swingPhase;
      this.swingPhase = Math.min(1, this.swingPhase + dt / SWING_DURATION);

      if (!this.strikeFired && prev < STRIKE_POINT && this.swingPhase >= STRIKE_POINT) {
        this.strikeFired = true;
        // 触球瞬间给身体一个惯性冲量
        const impulse = Math.min(2.5, 1.2 + this.swingSpeed * 0.35);
        if (this.swingDir === 'right') this.leanVel -= impulse;
        else if (this.swingDir === 'left') this.leanVel += impulse;
        this.squashVel -= 4;
        this.onStrike?.(this.swingDir, this.swingSpeed);
      }

      const pose = sampleKeys(SWING_KEYS[this.swingDir], this.swingPhase);
      this.character.armR.rotation.set(pose.rx, 0, pose.rz);

      if (this.swingPhase >= 1) this.swingPhase = null;
    }

    // spring/damper 回弹（超调一点产生"软乎乎"的晃动）
    const leanAcc = -90 * this.lean - 11 * this.leanVel;
    this.leanVel += leanAcc * dt;
    this.lean += this.leanVel * dt;
    this.character.squashG.rotation.z = this.lean;

    const squashAcc = -110 * this.squash - 13 * this.squashVel;
    this.squashVel += squashAcc * dt;
    this.squash += this.squashVel * dt;
    this.character.squashG.scale.y = Math.max(0.7, 1 + this.squash);
    // 压缩时横向微膨胀，保持体积感
    const bulge = Math.max(0, -this.squash) * 0.5;
    this.character.squashG.scale.x = 1 + bulge;
    this.character.squashG.scale.z = 1 + bulge;
  }
}
