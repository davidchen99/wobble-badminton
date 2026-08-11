import { describe, expect, it } from 'vitest';
import { COURT } from '../game/court';
import { inHitWindow, judgeLanding, ShuttlePhysics, type Vec3 } from './ShuttlePhysics';

const PLAYER_HOME: Vec3 = { x: 0, y: 0, z: 4.8 };
const AI_HOME: Vec3 = { x: 0, y: 0, z: -4.8 };

/** 模拟直到球落地或超时，返回累计事件与落地位置 */
function flyUntilGround(p: ShuttlePhysics, maxSeconds = 5) {
  const events: string[] = [];
  let t = 0;
  while (p.active && t < maxSeconds) {
    events.push(...p.step(1 / 60));
    t += 1 / 60;
  }
  return { events, pos: { ...p.pos }, t };
}

describe('ShuttlePhysics', () => {
  it('闭式反解的初速度能精确命中目标落点', () => {
    const p = new ShuttlePhysics();
    const from: Vec3 = { x: 0.5, y: 1.3, z: 3.9 };
    const to: Vec3 = { x: -1.2, y: 0, z: -5.5 };
    const vel = p.computeHitVelocity(from, to, 1.4);
    p.launch(vel, from, 'player');
    const { pos } = flyUntilGround(p);
    expect(Math.hypot(pos.x - to.x, pos.z - to.z)).toBeLessThan(0.05);
  });

  it('solveFlight 的弹道过网时高于网高', () => {
    const p = new ShuttlePhysics();
    const from: Vec3 = { x: 0, y: 1.3, z: 4.2 };
    const to: Vec3 = { x: 0.5, y: 0, z: -5.0 };
    const { vel } = p.solveFlight(from, to);
    p.launch(vel, from, 'player');
    // 逐步模拟，记录过网瞬间高度
    let netY: number | null = null;
    let prevZ = from.z;
    while (p.active) {
      p.step(1 / 120);
      if (prevZ * p.pos.z < 0) netY = p.pos.y;
      prevZ = p.pos.z;
    }
    expect(netY).not.toBeNull();
    expect(netY!).toBeGreaterThanOrEqual(COURT.netHeight + 0.1);
  });

  it('低平球撞网产生 net 事件并减速下落', () => {
    const p = new ShuttlePhysics();
    // 从玩家侧贴网低平抽向 AI 侧，高度不足
    p.launch({ x: 0, y: 0.5, z: -8 }, { x: 0, y: 1.2, z: 1.5 }, 'player');
    const { events, pos } = flyUntilGround(p);
    expect(events).toContain('net');
    expect(events).toContain('ground');
    expect(pos.z).toBeGreaterThan(0); // 触网后落回玩家侧
  });

  it('正常高球不产生 net 事件，落地后停机', () => {
    const p = new ShuttlePhysics();
    const from: Vec3 = { x: 0, y: 1.3, z: 4.2 };
    const { vel } = p.solveFlight(from, { x: 0, y: 0, z: -5 });
    p.launch(vel, from, 'player');
    const { events, pos } = flyUntilGround(p);
    expect(events).not.toContain('net');
    expect(events).toContain('ground');
    expect(pos.y).toBe(0);
    expect(p.active).toBe(false);
  });
});

describe('judgeLanding / inHitWindow', () => {
  it('界内/界外与落地半场判定', () => {
    expect(judgeLanding({ x: 0, y: 0, z: -5 })).toEqual({ side: 'ai', inCourt: true });
    expect(judgeLanding({ x: 3, y: 0, z: -5 })).toEqual({ side: 'ai', inCourt: false });
    expect(judgeLanding({ x: 0, y: 0, z: 8 })).toEqual({ side: 'player', inCourt: false });
  });

  it('击球窗口：要求朝击球方运动且在窗口球体内', () => {
    // 球在玩家身前、朝玩家飞
    expect(inHitWindow({ x: 0, y: 1.3, z: 3.9 }, { x: 0, y: 0, z: 3 }, 'player', PLAYER_HOME)).toBe(true);
    // 同位置但球正在远离（刚被自己打走）
    expect(inHitWindow({ x: 0, y: 1.3, z: 3.9 }, { x: 0, y: 0, z: -3 }, 'player', PLAYER_HOME)).toBe(false);
    // 球离得太远
    expect(inHitWindow({ x: 0, y: 1.3, z: 0.5 }, { x: 0, y: 0, z: 3 }, 'player', PLAYER_HOME)).toBe(false);
    // AI 侧对称
    expect(inHitWindow({ x: 0, y: 1.3, z: -3.9 }, { x: 0, y: 0, z: -3 }, 'ai', AI_HOME)).toBe(true);
  });
});
