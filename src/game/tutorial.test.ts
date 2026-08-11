import { describe, expect, it } from 'vitest';
import { Tutorial } from './tutorial';

describe('Tutorial 新手引导', () => {
  it('完整走完 4 步后结束', () => {
    const t = new Tutorial();
    expect(t.step).toBe('showHand');

    // 举手 0.5 秒
    for (let i = 0; i < 40; i++) t.update(1 / 60, true);
    expect(t.step).toBe('swingLeft');

    t.onSwing('left');
    expect(t.step).toBe('swingRight');
    t.onSwing('right');
    expect(t.step).toBe('ready');

    for (let i = 0; i < 60 * 3; i++) t.update(1 / 60, true);
    expect(t.done).toBe(true);
  });

  it('举手中断会重新计时', () => {
    const t = new Tutorial();
    for (let i = 0; i < 20; i++) t.update(1 / 60, true); // ~0.33s
    t.update(1 / 60, false); // 丢失 → 清零
    for (let i = 0; i < 20; i++) t.update(1 / 60, true); // 又 0.33s，不够
    expect(t.step).toBe('showHand');
    for (let i = 0; i < 15; i++) t.update(1 / 60, true); // 补够 0.5s+
    expect(t.step).toBe('swingLeft');
  });

  it('方向不对不推进，也不回退', () => {
    const t = new Tutorial();
    for (let i = 0; i < 40; i++) t.update(1 / 60, true);
    t.onSwing('right'); // 要求 left，给 right
    expect(t.step).toBe('swingLeft');
    t.onSwing('up');
    expect(t.step).toBe('swingLeft');
    t.onSwing('left');
    expect(t.step).toBe('swingRight');
    t.onSwing('left'); // 已过了 left 步骤
    expect(t.step).toBe('swingRight');
  });

  it('skip 直接结束', () => {
    const t = new Tutorial();
    t.skip();
    expect(t.done).toBe(true);
  });

  it('步骤切换触发 onStepChange 回调', () => {
    const t = new Tutorial();
    const seen: string[] = [];
    t.onStepChange = (s) => seen.push(s);
    for (let i = 0; i < 40; i++) t.update(1 / 60, true);
    t.onSwing('left');
    t.onSwing('right');
    for (let i = 0; i < 60 * 3; i++) t.update(1 / 60, true);
    expect(seen).toEqual(['swingLeft', 'swingRight', 'ready', 'done']);
  });
});
