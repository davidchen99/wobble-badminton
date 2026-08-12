import { describe, expect, it } from 'vitest';
import { MatchState, resolvePoint } from './match';

describe('resolvePoint（简化 rally 得分制）', () => {
  it('球落在界内，对方得分', () => {
    // 落在玩家场地界内 → AI 得分
    expect(resolvePoint({ x: 0, y: 0, z: 4 }, 'ai')).toBe('ai');
    // 落在 AI 场地界内 → 玩家得分
    expect(resolvePoint({ x: 1, y: 0, z: -4 }, 'player')).toBe('player');
  });

  it('球出界，最后击球者的对方得分', () => {
    // AI 把球打出界（落在玩家侧界外）→ 玩家得分
    expect(resolvePoint({ x: 4, y: 0, z: 5 }, 'ai')).toBe('player');
    // 玩家打出界 → AI 得分
    expect(resolvePoint({ x: 0, y: 0, z: -8 }, 'player')).toBe('ai');
  });

  it('无击球者的兜底（发球直接出界）按落点半场判', () => {
    expect(resolvePoint({ x: 9, y: 0, z: -5 }, null)).toBe('player');
  });
});

describe('MatchState', () => {
  it('得分者获得下一球发球权', () => {
    const m = new MatchState();
    expect(m.server).toBe('player');
    m.awardPoint('ai');
    expect(m.scores.ai).toBe(1);
    expect(m.server).toBe('ai');
    m.awardPoint('ai');
    m.awardPoint('player');
    expect(m.scores).toEqual({ player: 1, ai: 2 });
    expect(m.server).toBe('player');
  });

  it('先到 21 分获胜，终局后不再计分', () => {
    const m = new MatchState();
    for (let i = 0; i < 20; i++) m.awardPoint('player');
    expect(m.winner).toBeNull();
    m.awardPoint('player');
    expect(m.winner).toBe('player');
    m.awardPoint('ai'); // 终局后无效
    expect(m.scores.ai).toBe(0);
  });

  it('reset 清空比分与胜负', () => {
    const m = new MatchState();
    for (let i = 0; i < 21; i++) m.awardPoint('ai');
    m.reset();
    expect(m.winner).toBeNull();
    expect(m.scores).toEqual({ player: 0, ai: 0 });
    expect(m.server).toBe('player');
  });
});
