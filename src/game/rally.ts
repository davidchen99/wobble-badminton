import { inHitWindow, ShuttlePhysics, type Side, type Vec3 } from '../physics/ShuttlePhysics';
import { MatchState, resolvePoint } from './match';
import type { Shuttle } from './shuttle';

/** 回合结束到重新发球的间隔（秒） */
const SERVE_DELAY = 1.4;
/** 击球落点围绕对方站位的随机散布半径（米） */
const TARGET_SPREAD = 1.6;

type RallyPhase = 'waitingServe' | 'flying' | 'pointEnd';

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
  /** 判分回调（HUD 提示 / M6 计分板） */
  onPoint: ((scorer: Side, scores: Record<Side, number>) => void) | null = null;

  private shuttle: Shuttle;
  private homes: RallyHomes;
  private phase: RallyPhase = 'waitingServe';
  private timer = 0;
  private pendingScorer: Side | null = null;

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
    const { vel } = this.physics.solveFlight(this.physics.pos, target);
    this.physics.launch(vel, this.physics.pos, hitter);
    return true;
  }

  update(dt: number): void {
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
          } else if (ev === 'ground') {
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
    const { vel } = this.physics.solveFlight(from, target);
    this.physics.launch(vel, from, server);
    this.phase = 'flying';
    this.pendingScorer = null;
  }

  private finishPoint(): void {
    const scorer = this.pendingScorer ?? resolvePoint(this.physics.pos, this.physics.lastHitter);
    this.pendingScorer = null;
    this.match.awardPoint(scorer);
    this.onPoint?.(scorer, { ...this.match.scores });
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
