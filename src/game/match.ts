import { judgeLanding, type Side, type Vec3 } from '../physics/ShuttlePhysics';

/**
 * 简化 rally 得分制（GAME_DESIGN）：
 * - 球落在某方场地界内 → 对方得分
 * - 球落界外 → 最后击球者的对方得分（即出界者失分）
 * - 触网后落回自己场地 → 按落地规则自然判对方得分
 * 得分者发下一球。
 */
export function resolvePoint(landingPos: Vec3, lastHitter: Side | null): Side {
  const { side, inCourt } = judgeLanding(landingPos);
  const other = (s: Side): Side => (s === 'player' ? 'ai' : 'player');
  if (inCourt) return other(side);
  return lastHitter ? other(lastHitter) : other(side);
}

export class MatchState {
  readonly scores: Record<Side, number> = { player: 0, ai: 0 };
  /** 下一球由谁发（初始玩家发） */
  server: Side = 'player';
  /** 获胜分数线（M8 定稿：简化 21 分制，无 deuce） */
  readonly winScore = 21;
  /** 已分出胜负时的胜方 */
  winner: Side | null = null;

  awardPoint(winner: Side): void {
    if (this.winner) return; // 终局后不再计分
    this.scores[winner] += 1;
    this.server = winner;
    if (this.scores[winner] >= this.winScore) {
      this.winner = winner;
    }
  }

  reset(): void {
    this.scores.player = 0;
    this.scores.ai = 0;
    this.server = 'player';
    this.winner = null;
  }
}
