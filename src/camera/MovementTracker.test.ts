import { describe, expect, it } from 'vitest';
import { mapToCourt, MOVE_RANGE, MovementTracker } from './MovementTracker';

describe('MovementTracker', () => {
  it('慢速移动收敛到手部位置', () => {
    const m = new MovementTracker(1.0);
    m.update({ x: 0.5, y: 0.55 }, 0, 1 / 60); // 初始化
    for (let i = 0; i < 120; i++) m.update({ x: 0.9, y: 0.55 }, 0.3, 1 / 60);
    expect(m.pos.x).toBeGreaterThan(0.85);
  });

  it('快速挥动（超过 gate）不更新位置意图', () => {
    const m = new MovementTracker(1.0);
    m.update({ x: 0.5, y: 0.55 }, 0, 1 / 60);
    for (let i = 0; i < 60; i++) m.update({ x: 0.95, y: 0.55 }, 2.5, 1 / 60);
    expect(m.pos.x).toBe(0.5); // 完全没动
  });

  it('丢手保持原位；reset 回到中央', () => {
    const m = new MovementTracker(1.0);
    m.update({ x: 0.8, y: 0.55 }, 0, 1 / 60);
    m.update(null, 0, 1 / 60);
    expect(m.pos.x).toBe(0.8);
    m.reset();
    expect(m.pos.x).toBe(0.5);
  });
});

describe('mapToCourt', () => {
  const home = { x: 0, z: 4.8 };
  it('中央位置映射为 home', () => {
    const t = mapToCourt({ x: 0.5, y: 0.55 }, home);
    expect(t.x).toBeCloseTo(0);
    expect(t.z).toBeCloseTo(4.8);
  });
  it('边界按活动范围换算/钳制', () => {
    const t = mapToCourt({ x: 1, y: 1 }, home);
    expect(t.x).toBeCloseTo(MOVE_RANGE.x);
    // y=1 → (1-0.55)*2*zRange = 1.26，未触钳制
    expect(t.z).toBeCloseTo(4.8 + 1.26);
    // 超出归一化范围的异常输入被钳制
    const t2 = mapToCourt({ x: 0.5, y: -0.5 }, home);
    expect(t2.z).toBeCloseTo(4.8 - MOVE_RANGE.z);
  });
});
