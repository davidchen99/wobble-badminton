import { COURT, HALF_LENGTH, HALF_WIDTH } from '../game/court';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Side = 'player' | 'ai';
export type ShuttleEvent = 'ground' | 'net';

/** 固定物理步长（TECH_SPEC：固定或稳定 timestep） */
const FIXED_DT = 1 / 120;

/**
 * ShuttlePhysics：简化羽毛球飞行模型（GAME_DESIGN：快速出拍、明显减速、弧线清楚）。
 *
 * 模型：重力 + 线性阻力，用每步精确指数积分，因此与 computeHitVelocity 的
 * 闭式解严格一致——击球时选定落点反解初速度，模拟必然落到该点（MVP 统一可靠回球）。
 * 纯逻辑，无 THREE 依赖，可单元测试。
 */
export class ShuttlePhysics {
  pos: Vec3 = { x: 0, y: 1.4, z: 4 };
  vel: Vec3 = { x: 0, y: 0, z: 0 };
  /** 重力加速度（m/s²） */
  gravity = 9.8;
  /** 线性阻力系数（1/s），羽毛球"明显减速"的来源 */
  dragK = 0.9;
  /** 是否处于回合飞行中（待发球/死球时为 false） */
  active = false;
  lastHitter: Side | null = null;
  /** 触网后标记，避免重复触发 net 事件 */
  private netted = false;

  private accum = 0;

  /** 以给定初速度发射 */
  launch(vel: Vec3, from: Vec3, hitter: Side): void {
    this.pos = { ...from };
    this.vel = { ...vel };
    this.lastHitter = hitter;
    this.netted = false;
    this.active = true;
    this.accum = 0;
  }

  /** 停在某位置（待发球/回合结束） */
  hold(at: Vec3): void {
    this.pos = { ...at };
    this.vel = { x: 0, y: 0, z: 0 };
    this.active = false;
    this.netted = false;
  }

  /**
   * 推进物理；返回本帧发生的事件（'ground' 落地 / 'net' 触网）。
   * 落地后自动进入非激活状态。
   */
  step(dt: number): ShuttleEvent[] {
    const events: ShuttleEvent[] = [];
    if (!this.active) return events;

    this.accum = Math.min(this.accum + dt, 0.25); // 防后台切回后追帧爆炸
    while (this.accum >= FIXED_DT && this.active) {
      this.accum -= FIXED_DT;
      this.subStep(FIXED_DT, events);
    }
    return events;
  }

  private subStep(dt: number, events: ShuttleEvent[]): void {
    const k = this.dragK;
    const g = this.gravity;
    const e = Math.exp(-k * dt);
    const a = (1 - e) / k;
    const prevZ = this.pos.z;

    this.pos.x += this.vel.x * a;
    this.vel.x *= e;
    this.pos.z += this.vel.z * a;
    this.vel.z *= e;
    this.pos.y += (this.vel.y + g / k) * a - (g * dt) / k;
    this.vel.y = (this.vel.y + g / k) * e - g / k;

    // 过网检测：z 跨越 0 且高度低于网高 → 触网，球近乎垂直下落
    if (!this.netted && prevZ * this.pos.z < 0 && this.pos.y < COURT.netHeight) {
      this.netted = true;
      // 把球放回触网一侧，保证落点判定与视觉一致（落在触网方场地）
      this.pos.z = Math.sign(prevZ) * 0.02;
      this.vel.x *= 0.2;
      this.vel.z = 0;
      events.push('net');
    }

    // 落地
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.active = false;
      events.push('ground');
    }
  }

  /**
   * 闭式反解：以线性阻力模型，求从 from 出发、T 秒后命中 to 的初速度。
   * 与 subStep 的积分公式严格一致，模拟落点即 to。
   */
  computeHitVelocity(from: Vec3, to: Vec3, T: number): Vec3 {
    const k = this.dragK;
    const g = this.gravity;
    const e = 1 - Math.exp(-k * T);
    return {
      x: ((to.x - from.x) * k) / e,
      z: ((to.z - from.z) * k) / e,
      y: ((to.y - from.y + (g * T) / k) * k) / e - g / k,
    };
  }

  /**
   * 求一条能过网的可靠弹道：逐步加长飞行时间（抛物线更高）直到过网。
   * baseT 为基础飞行时间（秒）——全局球速/难度参数：越大球越慢越高，新手越从容。
   */
  solveFlight(from: Vec3, to: Vec3, baseT = 1.6): { vel: Vec3; flightTime: number } {
    let vel = this.computeHitVelocity(from, to, baseT);
    let T = baseT;
    for (const extra of [0, 0.25, 0.5, 0.8, 1.2]) {
      T = baseT + extra;
      vel = this.computeHitVelocity(from, to, T);
      if (this.clearsNet(from, vel)) return { vel, flightTime: T };
    }
    return { vel, flightTime: T };
  }

  /** 前向模拟检查弹道过网时是否高于网高（含安全余量） */
  private clearsNet(from: Vec3, vel: Vec3): boolean {
    // 同侧飞行不涉及过网
    if (from.z * (from.z + vel.z * 0.001) >= 0 && from.z * vel.z >= 0) return true;
    let p = { ...from };
    let v = { ...vel };
    const k = this.dragK;
    const g = this.gravity;
    const dt = 1 / 120;
    for (let i = 0; i < 600; i++) {
      const prevZ = p.z;
      const e = Math.exp(-k * dt);
      const a = (1 - e) / k;
      p.x += v.x * a;
      v.x *= e;
      p.z += v.z * a;
      v.z *= e;
      p.y += (v.y + g / k) * a - (g * dt) / k;
      v.y = (v.y + g / k) * e - g / k;
      if (prevZ * p.z < 0) return p.y >= COURT.netHeight + 0.12;
      if (p.y <= 0) return true;
    }
    return true;
  }
}

/** 落地判定结果 */
export function judgeLanding(pos: Vec3): { side: Side; inCourt: boolean } {
  return {
    side: pos.z >= 0 ? 'player' : 'ai',
    inCourt: Math.abs(pos.x) <= HALF_WIDTH && Math.abs(pos.z) <= HALF_LENGTH,
  };
}

/** 辅助击球时空窗口（GAME_DESIGN：宽容，不要求像素级空间对应） */
export const HIT_WINDOW = {
  /** 击球点半径（米），以角色身前为球心 */
  radius: 2.1,
  /** 击球点离地高度 */
  height: 1.25,
  /** 击球点在角色身前的距离 */
  forward: 0.9,
} as const;

/**
 * 判断球此刻是否处于某方的可击球窗口：
 * 在窗口球体内，且正朝该方场地运动（防止把自己刚打走的球又打回来）。
 */
export function inHitWindow(pos: Vec3, vel: Vec3, hitter: Side, hitterHome: Vec3): boolean {
  const toward = hitter === 'player' ? vel.z > 0 : vel.z < 0;
  if (!toward) return false;
  const dir = hitter === 'player' ? -1 : 1; // 角色面向网的方向
  const dx = pos.x - hitterHome.x;
  const dy = pos.y - HIT_WINDOW.height;
  const dz = pos.z - (hitterHome.z + HIT_WINDOW.forward * dir);
  return dx * dx + dy * dy + dz * dz <= HIT_WINDOW.radius * HIT_WINDOW.radius;
}

/** 闭式预测 t 秒后的位置（与 ShuttlePhysics 积分公式一致） */
export function predictPosition(pos: Vec3, vel: Vec3, t: number, k: number, g: number): Vec3 {
  const e = Math.exp(-k * t);
  const a = (1 - e) / k;
  return {
    x: pos.x + vel.x * a,
    y: pos.y + (vel.y + g / k) * a - (g * t) / k,
    z: pos.z + vel.z * a,
  };
}

/** 前向模拟预测落点与落地时间（AI 移动/挥拍时机用） */
export function predictLanding(
  pos: Vec3,
  vel: Vec3,
  k: number,
  g: number,
): { pos: Vec3; time: number } {
  let p = { ...pos };
  let v = { ...vel };
  const dt = 1 / 60;
  let t = 0;
  for (let i = 0; i < 600; i++) {
    const e = Math.exp(-k * dt);
    const a = (1 - e) / k;
    p = {
      x: p.x + v.x * a,
      y: p.y + (v.y + g / k) * a - (g * dt) / k,
      z: p.z + v.z * a,
    };
    v = { x: v.x * e, y: (v.y + g / k) * e - g / k, z: v.z * e };
    t += dt;
    if (p.y <= 0) return { pos: { x: p.x, y: 0, z: p.z }, time: t };
  }
  return { pos: { x: p.x, y: 0, z: p.z }, time: t };
}
