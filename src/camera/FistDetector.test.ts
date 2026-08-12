import { describe, expect, it } from 'vitest';
import { curlRatio, FistDetector } from './FistDetector';

/** 构造 21 个关键点：四指的 指尖到手腕距离 / 指根到手腕距离 = ratio */
function makeHand(ratio: number): { x: number; y: number }[] {
  const pts = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  pts[0] = { x: 0.5, y: 0.8 }; // 手腕
  const mcps = [5, 9, 13, 17];
  const tips = [8, 12, 16, 20];
  mcps.forEach((mcp, i) => {
    pts[mcp] = { x: 0.5, y: 0.6 }; // 指根距手腕 0.2
    pts[tips[i]] = { x: 0.5, y: 0.8 - 0.2 * ratio }; // 指尖距手腕 0.2*ratio
  });
  return pts;
}

describe('curlRatio', () => {
  it('张开手的比值显著大于握拳', () => {
    expect(curlRatio(makeHand(2.0))).toBeCloseTo(2.0);
    expect(curlRatio(makeHand(1.1))).toBeCloseTo(1.1);
  });
});

describe('FistDetector', () => {
  it('张开→握拳触发一次击打事件', () => {
    const d = new FistDetector();
    expect(d.update(makeHand(2.0), 0)).toBeNull();
    const ev = d.update(makeHand(1.1), 0.1);
    expect(ev).not.toBeNull();
    expect(ev!.double).toBe(false);
  });

  it('持续握拳不重复触发，松开后可再次触发', () => {
    const d = new FistDetector();
    d.update(makeHand(1.1), 0.1);
    expect(d.update(makeHand(1.1), 0.2)).toBeNull(); // 持续握着
    d.update(makeHand(2.0), 0.3); // 松开
    const ev = d.update(makeHand(1.1), 0.5);
    expect(ev).not.toBeNull();
  });

  it('迟滞区间：比值在 enter/exit 之间不改变状态', () => {
    const d = new FistDetector({ enterRatio: 1.35, exitRatio: 1.6 });
    d.update(makeHand(1.1), 0); // 握拳
    expect(d.isFist).toBe(true);
    d.update(makeHand(1.45), 0.1); // 迟滞区间内仍算握着
    expect(d.isFist).toBe(true);
    d.update(makeHand(1.7), 0.2); // 超过 exit 才算松开
    expect(d.isFist).toBe(false);
  });

  it('连握窗口内第二次握拳标记为 double（扣球）', () => {
    const d = new FistDetector({ minIntervalMs: 100, doubleGripMs: 350 });
    d.update(makeHand(1.1), 0); // 第一握
    d.update(makeHand(2.0), 0.1); // 松开
    const ev = d.update(makeHand(1.1), 0.25); // 0.25s 第二握 < 350ms
    expect(ev).not.toBeNull();
    expect(ev!.double).toBe(true);
  });

  it('超过连握窗口的第二握不算 double', () => {
    const d = new FistDetector({ minIntervalMs: 100, doubleGripMs: 350 });
    d.update(makeHand(1.1), 0);
    d.update(makeHand(2.0), 0.1);
    const ev = d.update(makeHand(1.1), 0.6);
    expect(ev!.double).toBe(false);
  });

  it('丢手解除握拳状态且不触发事件', () => {
    const d = new FistDetector();
    d.update(makeHand(1.1), 0);
    expect(d.isFist).toBe(true);
    expect(d.update(null, 0.1)).toBeNull();
    expect(d.isFist).toBe(false);
  });
});
