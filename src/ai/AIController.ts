import {
  inHitWindow,
  predictLanding,
  predictPosition,
  type Side,
  type Vec3,
} from '../physics/ShuttlePhysics';
import type { WobbleCharacter } from '../game/character';
import type { RallyManager } from '../game/rally';
import { PlayerController, STRIKE_LEAD_SECONDS } from '../player/PlayerController';

export interface AIParams {
  /** 球过网进入 AI 半场后，允许挥拍的反应延迟（毫秒） */
  reactionMs: number;
  /** 失误率 0..1：本次来球直接不接 */
  missRate: number;
  /** 横向移动速度（米/秒） */
  moveSpeed: number;
}

export const DEFAULT_AI_PARAMS: AIParams = {
  reactionMs: 180,
  missRate: 0.15,
  moveSpeed: 4.5,
};

/** 挥拍动画从启动到触球点的领先时间（与 PlayerController 关键帧一致） */
const STRIKE_LEAD = STRIKE_LEAD_SECONDS;
/** AI 横向活动范围（不超过边线太多） */
const MOVE_LIMIT_X = 2.3;

/**
 * 规则 AI（GAME_DESIGN：预测落点 → 移动 → 到位 → 延迟 → 挥拍；可靠但偶尔失误）。
 * 挥拍动作复用 PlayerController 的程序化动画与惯性弹簧。
 */
export class AIController {
  readonly params: AIParams;
  /** 挥拍命中/挥空回调（M6 反饋用） */
  onResolve: ((hit: boolean) => void) | null = null;

  private controller: PlayerController;
  private character: WobbleCharacter;
  private rally: RallyManager;
  private homeZ: number;

  /** 当前站位（x 随球移动，z 固定） */
  private pos: Vec3;
  /** 本次来球是否已做"接/不接"决策 */
  private decided = false;
  private willHit = true;
  /** 球进入 AI 半场的时刻（秒，performance 时钟由调用方以 dt 累计） */
  private incomingAt = 0;
  private time = 0;

  constructor(character: WobbleCharacter, rally: RallyManager, params: Partial<AIParams> = {}) {
    this.params = { ...DEFAULT_AI_PARAMS, ...params };
    this.character = character;
    this.rally = rally;
    this.homeZ = character.group.position.z;
    this.pos = { x: character.group.position.x, y: 0, z: this.homeZ };

    this.controller = new PlayerController(character);
    this.controller.onStrike = () => {
      const hit = this.rally.tryHit('ai');
      this.onResolve?.(hit);
    };
  }

  update(dt: number): void {
    this.time += dt;
    this.controller.update(dt);

    const { physics } = this.rally;
    const incoming =
      physics.active && physics.lastHitter === ('player' as Side) && physics.vel.z < 0;

    if (incoming) {
      if (!this.decided) {
        this.decided = true;
        this.incomingAt = this.time;
        this.willHit = Math.random() >= this.params.missRate;
      }

      // 预测落点并横向移动到位
      const landing = predictLanding(physics.pos, physics.vel, physics.dragK, physics.gravity);
      this.moveToward(landing.pos.x, dt);

      // 过了反应延迟后，在合适的提前量挥拍（失误决策则故意不动）
      if (this.willHit && (this.time - this.incomingAt) * 1000 >= this.params.reactionMs) {
        const atStrike = predictPosition(
          physics.pos,
          physics.vel,
          STRIKE_LEAD,
          physics.dragK,
          physics.gravity,
        );
        if (
          !this.controller.swinging &&
          (inHitWindow(physics.pos, physics.vel, 'ai', this.pos) ||
            inHitWindow(atStrike, physics.vel, 'ai', this.pos))
        ) {
          this.controller.swing({
            direction: this.pickDirection(atStrike),
            speed: 2,
            time: this.time,
          });
        }
      }
    } else {
      // 球不朝自己来：回位，重置决策
      this.decided = false;
      this.moveToward(0, dt);
    }

    // 同步角色与击球窗口参考点
    this.character.group.position.x = this.pos.x;
    this.rally.updateHome('ai', this.pos);
  }

  private moveToward(targetX: number, dt: number): void {
    const target = Math.max(-MOVE_LIMIT_X, Math.min(MOVE_LIMIT_X, targetX));
    const dx = target - this.pos.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), this.params.moveSpeed * dt);
    this.pos.x += step;
  }

  /** 根据来球相对方位选个看起来像回事的挥拍方向（纯视觉） */
  private pickDirection(ballPos: Vec3): 'left' | 'right' | 'up' | 'down' {
    if (ballPos.y > 1.9) return 'up';
    if (ballPos.y < 0.7) return 'down';
    return ballPos.x < this.pos.x ? 'left' : 'right';
  }
}
