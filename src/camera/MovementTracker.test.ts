import { describe, expect, it } from 'vitest';
import { mapToCourt, MOVE_RANGE, MovementTracker } from './MovementTracker';

const SAMPLE = { x: 0.5, y: 0.55, size: 0.2 };

describe('MovementTracker', () => {
  it('慢速移动收敛到手部位置', () => {
    const m = new MovementTracker(1.0);
    m.update(SAMPLE, 0, 1 / 60); // 初始化
    for (let i = 0; i < 120; i++) m.update({ ...SAMPLE, x: 0.9 }, 0.3, 1 / 60);
    expect(m.pos.x).toBeGreaterThan(0.85);
  });

  it('快速挥动（超过 gate）不更新位置意图', () => {
    const m = new MovementTracker(1.0);
    m.update(SAMPLE, 0, 1 / 60);
    for (let i = 0; i < 60; i++) m.update({ ...SAMPLE, x: 0.95 }, 2.5, 1 / 60);
    expect(m.pos.x).toBe(0.5); // 完全没动
  });

  it('丢手保持原位；reset 回到中央并清除校准', () => {
    const m = new MovementTracker(1.0);
    m.update({ ...SAMPLE, x: 0.8 }, 0, 1 / 60);
    m.update(null, 0, 1 / 60);
    expect(m.pos.x).toBe(0.8);
    m.reset();
    expect(m.pos.x).toBe(0.5);
    expect(m.calibrated).toBe(false);
  });

  it('初始稳定期自动校准基准手大小', () => {
    const m = new MovementTracker(1.0);
    expect(m.calibrated).toBe(false);
    for (let i = 0; i < 40; i++) m.update({ ...SAMPLE, size: 0.2 }, 0, 1 / 60);
    expect(m.calibrated).toBe(true);
    // 校准后手变大 → sizeRatio 上升
    for (let i = 0; i < 120; i++) m.update({ ...SAMPLE, size: 0.24 }, 0, 1 / 60);
    expect(m.sizeRatio).toBeGreaterThan(1.1);
  });

  it('握拳时冻结位置与大小采样（握拳手变小，不应误判为后退）', () => {
    const m = new MovementTracker(1.0);
    for (let i = 0; i < 40; i++) m.update({ ...SAMPLE, size: 0.2 }, 0, 1 / 60);
    const ratioBefore = m.sizeRatio;
    for (let i = 0; i < 60; i++) m.update({ x: 0.9, y: 0.55, size: 0.14 }, 0, 1 / 60, true);
    expect(m.sizeRatio).toBe(ratioBefore);
    expect(m.pos.x).toBe(0.5);
  });
});

describe('mapToCourt', () => {
  const home = { x: 0, z: 4.8 };
  it('中央位置 + 基准大小映射为 home', () => {
    const t = mapToCourt({ x: 0.5, y: 0.55 }, home, 1);
    expect(t.x).toBeCloseTo(0);
    expect(t.z).toBeCloseTo(4.8);
  });
  it('手变大 = 前进（z 朝网减小），变小 = 后退，均有上限', () => {
    expect(mapToCourt({ x: 0.5, y: 0.55 }, home, 1.3).z).toBeCloseTo(4.8 - MOVE_RANGE.z);
    expect(mapToCourt({ x: 0.5, y: 0.55 }, home, 0.7).z).toBeCloseTo(4.8 + MOVE_RANGE.z);
  });
  it('横向边界钳制在活动范围内', () => {
    expect(mapToCourt({ x: 1, y: 0.55 }, home, 1).x).toBeCloseTo(MOVE_RANGE.x);
    expect(mapToCourt({ x: 0, y: 0.55 }, home, 1).x).toBeCloseTo(-MOVE_RANGE.x);
  });
});
