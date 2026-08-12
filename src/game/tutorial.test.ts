import { describe, expect, it } from 'vitest';
import { Tutorial } from './tutorial';

describe('Tutorial 新手引导（握拳版）', () => {
  it('完整走完 4 步后结束', () => {
    const t = new Tutorial();
    expect(t.step).toBe('showHand');

    for (let i = 0; i < 40; i++) t.update(1 / 60, true); // 举手 0.5s+
    expect(t.step).toBe('grip');

    t.onGrip(1.0); // 握拳一次
    expect(t.step).toBe('doubleGrip');
    t.onGrip(1.5); // 0.5s 内第二握（1.2s 教学窗口内）
    expect(t.step).toBe('ready');

    for (let i = 0; i < 60 * 3; i++) t.update(1 / 60, true);
    expect(t.done).toBe(true);
  });

  it('举手中断重新计时', () => {
    const t = new Tutorial();
    for (let i = 0; i < 20; i++) t.update(1 / 60, true);
    t.update(1 / 60, false);
    for (let i = 0; i < 20; i++) t.update(1 / 60, true);
    expect(t.step).toBe('showHand');
    for (let i = 0; i < 15; i++) t.update(1 / 60, true);
    expect(t.step).toBe('grip');
  });

  it('连握步：1.2s 内两握通过；太慢则以本次为新的第一握（M13 放宽）', () => {
    const t = new Tutorial();
    for (let i = 0; i < 40; i++) t.update(1 / 60, true);
    t.onGrip(1.0);
    expect(t.step).toBe('doubleGrip');
    t.onGrip(2.5); // 距上次 1.5s > 1.2s：不算连握，但记为新的第一握
    expect(t.step).toBe('doubleGrip');
    t.onGrip(3.0); // 距上次 0.5s < 1.2s：通过
    expect(t.step).toBe('ready');
  });

  it('skip 直接结束；reset 从头开始', () => {
    const t = new Tutorial();
    t.skip();
    expect(t.done).toBe(true);
    t.reset();
    expect(t.step).toBe('showHand');
    expect(t.done).toBe(false);
  });

  it('步骤切换触发 onStepChange，且每步有对应简图', () => {
    const t = new Tutorial();
    const seen: string[] = [];
    t.onStepChange = (s) => seen.push(s);
    expect(t.sketch).toBe('showHand');
    for (let i = 0; i < 40; i++) t.update(1 / 60, true);
    expect(t.sketch).toBe('fist');
    t.onGrip(1.0);
    expect(t.sketch).toBe('doubleFist');
    t.onGrip(1.5);
    expect(t.sketch).toBe('move');
    for (let i = 0; i < 60 * 3; i++) t.update(1 / 60, true);
    expect(t.sketch).toBeNull();
    expect(seen).toEqual(['grip', 'doubleGrip', 'ready', 'done']);
  });
});
