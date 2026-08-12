import { inHitWindow, ShuttlePhysics, type Side, type Vec3 } from '../physics/ShuttlePhysics';
import { MatchState, resolvePoint } from './match';
import type { Shuttle } from './shuttle';

/** 回合结束到重新发球的间隔（秒） */
const SERVE_DELAY = 1.4;
/** 击球落点围绕对方站位的随机散布半径（米）——M8 正板直打，收窄 */
const TARGET_SPREAD = 0.8;
/** 扣球补刀窗口：击中后多少秒内允许连握加成（秒） */
const SMASH_WINDOW = 0.6;
/** 扣球基础飞行时间（秒）：比普通回球（默认 1.8）快得多、更平 */
const SMASH_FLIGHT_TIME = 0.7;

type RallyPhase = 'waitingServe' | 'flying' | 'pointEnd' | 'matchEnd';

export interface RallyHomes {
  player: Vec3;
  ai: Vec3;
}

/**
 * RallyManager：把 ShuttlePhysics、辅助击球窗口、比分串成回合闭环。
 * 发球 → 飞行 → （挥拍且球在窗口 → 回击）→ 落地/出界 → 判分 → 重新发球。
 */
export class RallyManager {
  readonly physics = new ShuttlePhysics();
  readonly match = new MatchState();
  /** 全局球速：回球/发球的基础飞行时间（秒），越大越慢越高（M8 定稿开局慢球） */
  flightTime = 1.8;
  /** 判分回调（HUD 提示 / M6 计分板） */
  onPoint: ((scorer: Side, scores: Record<Side, number>) => void) | null = null;
  /** 球的物理接触事件回调（音效用）：触网 / 落地 */
  onContact: ((kind: 'net' | 'ground') => void) | null = null;
  /** 一方到达获胜分数线（6/21，见 MatchState.winScore）、比赛结束时回调 */
  onMatchEnd: ((winner: Side, scores: Record<Side, number>) => void) | null = null;

  private shuttle: Shuttle;
  private homes: RallyHomes;
  private phase: RallyPhase = 'waitingServe';
  private timer = 0;
  private pendingScorer: Side | null = null;
  private time = 0;
  /** 玩家最近一次成功击中的时刻（连握扣球窗口判定） */
  private lastPlayerHitAt = -Infinity;

  constructor(shuttle: Shuttle, homes: RallyHomes) {
    this.shuttle = shuttle;
    this.homes = homes;
    this.holdAtServer();
  }

  get scores(): Record<Side, number> {
    return this.match.scores;
  }

  /** 更新某方的站位参考点（AI 移动时逐帧同步，影响击球窗口与落点选择） */
  updateHome(side: Side, pos: Vec3): void {
    this.homes[side] = { ...pos };
  }

  /** 重开一局：清零比分，回到待发球状态 */
  reset(): void {
    this.match.reset();
    this.pendingScorer = null;
    this.holdAtServer();
    this.phase = 'waitingServe';
    this.timer = SERVE_DELAY;
  }

  /** 一方挥拍（触球瞬间调用）：球在辅助窗口内则回击到对方场地 */
  tryHit(hitter: Side): boolean {
    if (this.phase !== 'flying' || !this.physics.active) return false;
    if (this.physics.lastHitter === hitter) return false;
    const home = this.homes[hitter];
    if (!inHitWindow(this.physics.pos, this.physics.vel, hitter, home)) return false;

    const opponentHome = this.homes[hitter === 'player' ? 'ai' : 'player'];
    // 落点：对方站位附近散布，钳制在单打界内（z 用绝对值避免符号被 clamp 吃掉）
    const zMag = clamp(Math.abs(opponentHome.z) + randSpread(TARGET_SPREAD), 2.4, 6.2);
    const target: Vec3 = {
      x: clamp(opponentHome.x + randSpread(TARGET_SPREAD), -2.2, 2.2),
      y: 0,
      z: hitter === 'player' ? -zMag : zMag,
    };
    const { vel } = this.physics.solveFlight(this.physics.pos, target, this.flightTime);
    this.physics.launch(vel, this.physics.pos, hitter);
    if (hitter === 'player') this.lastPlayerHitAt = this.time;
    return true;
  }

  /**
   * 连握扣球：玩家刚击中且球还在飞向 AI 时，第二握把球"补"成扣杀——
   * 更快更平，落点压向对方后场。返回是否补刀成功。
   */
  smash(): boolean {
    if (this.phase !== 'flying' || !this.physics.active) return false;
    if (this.physics.lastHitter !== 'player') return false;
    if (this.time - this.lastPlayerHitAt > SMASH_WINDOW) return false;
    if (this.physics.vel.z >= 0) return false; // 只补正在飞向 AI 的球

    const aiHome = this.homes.ai;
    const target: Vec3 = {
      x: clamp(aiHome.x + randSpread(1.2), -2.2, 2.2),
      y: 0,
      z: -(5.4 + Math.random() * 0.7), // 压后场
    };
    // solveFlight 保证过网；0.7s 起逐步加长直到过网为止
    const { vel } = this.physics.solveFlight(this.physics.pos, target, SMASH_FLIGHT_TIME);
    this.physics.launch(vel, this.physics.pos, 'player');
    this.lastPlayerHitAt = -Infinity; // 一板只能补一次
    return true;
  }

  update(dt: number): void {
    this.time += dt;
    switch (this.phase) {
      case 'waitingServe':
        this.timer -= dt;
        if (this.timer <= 0) this.serve();
        break;

      case 'flying': {
        const events = this.physics.step(dt);
        for (const ev of events) {
          if (ev === 'net') {
            // 触网者失分（球还会继续下落，落地时结算）
            this.pendingScorer = this.physics.lastHitter === 'player' ? 'ai' : 'player';
            this.onContact?.('net');
          } else if (ev === 'ground') {
            this.onContact?.('ground');
            this.finishPoint();
          }
        }
        break;
      }

      case 'pointEnd':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.holdAtServer();
          this.phase = 'waitingServe';
          this.timer = SERVE_DELAY * 0.5;
        }
        break;

      case 'matchEnd':
        // 终局：球停在落地处，等待 R 重开（reset 会切回 waitingServe）
        break;
    }

    // 同步可视对象
    const p = this.physics.pos;
    this.shuttle.setPosition(p.x, p.y, p.z);
    if (this.physics.active) {
      this.shuttle.faceVelocity(this.physics.vel);
    }
  }

  private serve(): void {
    const server = this.match.server;
    const from: Vec3 = {
      x: this.homes[server].x,
      y: 1.4,
      z: this.homes[server].z + (server === 'player' ? -0.6 : 0.6),
    };
    const receiver: Side = server === 'player' ? 'ai' : 'player';
    const targetHome = this.homes[receiver];
    const target: Vec3 = {
      x: targetHome.x + randSpread(0.8),
      y: 0,
      z: targetHome.z + randSpread(1.0),
    };
    const { vel } = this.physics.solveFlight(from, target, this.flightTime);
    this.physics.launch(vel, from, server);
    this.phase = 'flying';
    this.pendingScorer = null;
  }

  private finishPoint(): void {
    const scorer = this.pendingScorer ?? resolvePoint(this.physics.pos, this.physics.lastHitter);
    this.pendingScorer = null;
    this.match.awardPoint(scorer);
    this.onPoint?.(scorer, { ...this.match.scores });
    if (this.match.winner) {
      this.phase = 'matchEnd';
      this.onMatchEnd?.(this.match.winner, { ...this.match.scores });
      return;
    }
    this.phase = 'pointEnd';
    this.timer = SERVE_DELAY;
  }

  /** 球停在发球方手边，等待发球计时 */
  private holdAtServer(): void {
    const server = this.match.server;
    this.physics.hold({
      x: this.homes[server].x + (server === 'player' ? 0.4 : -0.4),
      y: 1.3,
      z: this.homes[server].z + (server === 'player' ? -0.6 : 0.6),
    });
  }
}

function randSpread(r: number): number {
  return (Math.random() * 2 - 1) * r;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
