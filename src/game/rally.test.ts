import { describe, expect, it } from 'vitest';
import { RallyManager } from './rally';
import { Shuttle } from './shuttle';
import type { Vec3 } from '../physics/ShuttlePhysics';

const HOMES: { player: Vec3; ai: Vec3 } = {
  player: { x: 0, y: 0, z: 4.8 },
  ai: { x: 0, y: 0, z: -4.8 },
};

function makeRally(): RallyManager {
  return new RallyManager(new Shuttle(), HOMES);
}

describe('RallyManager.smash 连握扣球', () => {
  it('玩家击中后可补扣（M13 起无时限）：球速明显加快、只补一次', () => {
    const rally = makeRally();
    rally.update(1 / 60); // 触发首次发球进入 flying

    // 构造一球从 AI 侧飞向玩家窗口
    const from: Vec3 = { x: 0, y: 1.3, z: -4.2 };
    const { vel } = rally.physics.solveFlight(from, { x: 0, y: 0, z: 4.6 }, 1.2);
    rally.physics.launch(vel, from, 'ai');
    // 步进到球进入玩家击球窗口
    let hit = false;
    for (let i = 0; i < 300 && !hit; i++) {
      rally.update(1 / 60);
      hit = rally.tryHit('player');
    }
    expect(hit).toBe(true);
    expect(rally.physics.vel.z).toBeLessThan(0); // 球飞向 AI

    const speedBefore = Math.hypot(rally.physics.vel.x, rally.physics.vel.z);
    expect(rally.smash()).toBe(true);
    const speedAfter = Math.hypot(rally.physics.vel.x, rally.physics.vel.z);
    expect(speedAfter).toBeGreaterThan(speedBefore * 1.3);
    expect(rally.physics.lastHitter).toBe('player');

    // 一板只能补一次
    expect(rally.smash()).toBe(false);
  });

  it('trySmashHit：窗口内扣杀回球压向对方后场（M10 王冠 Boss）', () => {
    const rally = makeRally();
    rally.update(1 / 60);

    // 构造一球从玩家侧飞向 AI 窗口
    const from: Vec3 = { x: 0, y: 1.3, z: 4.2 };
    const { vel } = rally.physics.solveFlight(from, { x: 0, y: 0, z: -4.6 }, 1.2);
    rally.physics.launch(vel, from, 'player');
    let hit = false;
    for (let i = 0; i < 300 && !hit; i++) {
      rally.update(1 / 60);
      hit = rally.trySmashHit('ai');
    }
    expect(hit).toBe(true);
    expect(rally.physics.vel.z).toBeGreaterThan(0); // 球飞向玩家
    expect(rally.physics.lastHitter).toBe('ai');

    // 同一板不能重复扣（lastHitter 已是 ai）
    expect(rally.trySmashHit('ai')).toBe(false);
  });

  it('球飞向玩家时不能补扣', () => {
    const rally = makeRally();
    // AI 发球场景：直接构造一球飞向玩家
    rally.update(1 / 60);
    const { vel } = rally.physics.solveFlight(
      { x: 0, y: 1.3, z: -4.2 },
      { x: 0, y: 0, z: 5 },
      1.2,
    );
    rally.physics.launch(vel, { x: 0, y: 1.3, z: -4.2 }, 'ai');
    expect(rally.smash()).toBe(false);
  });
});
