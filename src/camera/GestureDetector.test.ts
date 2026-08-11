import { describe, expect, it } from 'vitest';
import { classifyDirection, GestureDetector } from './GestureDetector';

/** 以固定帧率生成一段从 (x0,y0) 到 (x1,y1) 的匀速轨迹样本 */
function sweep(
  detector: GestureDetector,
  from: { x: number; y: number },
  to: { x: number; y: number },
  startT: number,
  durationMs = 150,
  fps = 60,
): { t: number; events: ReturnType<GestureDetector['addSample']>[] } {
  const frames = Math.max(2, Math.round((durationMs / 1000) * fps));
  const events: ReturnType<GestureDetector['addSample']>[] = [];
  for (let i = 1; i <= frames; i++) {
    const f = i / frames;
    const t = startT + (durationMs / 1000) * f;
    events.push(
      detector.addSample({
        t,
        x: from.x + (to.x - from.x) * f,
        y: from.y + (to.y - from.y) * f,
        confidence: 0.9,
      }),
    );
  }
  return { t: startT + durationMs / 1000, events };
}

describe('classifyDirection', () => {
  it('以分量大的轴为准', () => {
    expect(classifyDirection(2, 0.5)).toBe('right');
    expect(classifyDirection(-2, 0.5)).toBe('left');
    expect(classifyDirection(0.5, -2)).toBe('up');
    expect(classifyDirection(0.5, 2)).toBe('down');
  });
});

describe('GestureDetector', () => {
  it('快速右挥触发 right 事件', () => {
    const d = new GestureDetector();
    const { events } = sweep(d, { x: 0.3, y: 0.5 }, { x: 0.8, y: 0.5 }, 0);
    const hit = events.find((e) => e !== null);
    expect(hit).toBeTruthy();
    expect(hit!.direction).toBe('right');
    expect(hit!.speed).toBeGreaterThanOrEqual(d.params.swingSpeedThreshold);
  });

  it('快速上挥触发 up 事件', () => {
    const d = new GestureDetector();
    const { events } = sweep(d, { x: 0.5, y: 0.7 }, { x: 0.5, y: 0.2 }, 0);
    expect(events.find((e) => e !== null)?.direction).toBe('up');
  });

  it('缓慢移动不触发', () => {
    const d = new GestureDetector();
    const { events } = sweep(d, { x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 }, 0, 800);
    expect(events.every((e) => e === null)).toBe(true);
  });

  it('cooldown 内不重复触发，cooldown 后可再次触发', () => {
    const d = new GestureDetector({ cooldownMs: 400 });
    sweep(d, { x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 }, 0);
    // 紧接着第二次挥拍（在 cooldown 内）
    const during = sweep(d, { x: 0.7, y: 0.5 }, { x: 0.2, y: 0.5 }, 0.2);
    expect(during.events.every((e) => e === null)).toBe(true);
    // cooldown 结束后第三次挥拍
    const after = sweep(d, { x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 }, 1.0);
    expect(after.events.some((e) => e !== null)).toBe(true);
  });

  it('低置信度样本不触发且重置速度', () => {
    const d = new GestureDetector();
    for (let i = 1; i <= 10; i++) {
      const e = d.addSample({ t: i / 60, x: 0.2 + i * 0.06, y: 0.5, confidence: 0.1 });
      expect(e).toBeNull();
    }
    expect(d.velocity.x).toBe(0);
  });

  it('轨迹缓冲按 bufferSeconds 裁剪', () => {
    const d = new GestureDetector({ bufferSeconds: 0.1 });
    for (let i = 1; i <= 30; i++) {
      d.addSample({ t: i / 60, x: 0.5, y: 0.5, confidence: 0.9 });
    }
    const trail = d.trail;
    expect(trail.length).toBeGreaterThan(0);
    expect(trail[trail.length - 1].t - trail[0].t).toBeLessThanOrEqual(0.1 + 1 / 60);
  });
});
