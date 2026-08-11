import { describe, expect, it } from 'vitest';
import { WobbleCharacter } from '../game/character';
import { RallyManager } from '../game/rally';
import { Shuttle } from '../game/shuttle';
import { predictLanding, ShuttlePhysics, type Vec3 } from '../physics/ShuttlePhysics';
import { AIController } from './AIController';

const PLAYER_HOME: Vec3 = { x: 0, y: 0, z: 4.8 };
const AI_HOME: Vec3 = { x: 0, y: 0, z: -4.8 };

describe('predictLanding', () => {
  it('预测落点与实际模拟落点一致', () => {
    const p = new ShuttlePhysics();
    const from: Vec3 = { x: 0.3, y: 1.4, z: 4.2 };
    const { vel } = p.solveFlight(from, { x: -0.8, y: 0, z: -5.2 });
    const predicted = predictLanding(from, vel, p.dragK, p.gravity);

    p.launch(vel, from, 'player');
    while (p.active) p.step(1 / 60);
    expect(Math.hypot(predicted.pos.x - p.pos.x, predicted.pos.z - p.pos.z)).toBeLessThan(0.15);
  });
});

describe('AIController', () => {
  it('AI 能移动到落点并回球（连续 rally 的基础）', () => {
    const aiChar = new WobbleCharacter({ color: 0 });
    aiChar.group.position.set(AI_HOME.x, 0, AI_HOME.z);
    const rally = new RallyManager(new Shuttle(), { player: PLAYER_HOME, ai: AI_HOME });
    const ai = new AIController(aiChar, rally, { missRate: 0, reactionMs: 0 });

    // 模拟 8 秒：发球（玩家）→ AI 应回球
    let aiHit = false;
    const dt = 1 / 60;
    for (let i = 0; i < 8 * 60 && !aiHit; i++) {
      rally.update(dt);
      ai.update(dt);
      if (rally.physics.lastHitter === 'ai') aiHit = true;
    }
    expect(aiHit).toBe(true);
    // AI 回球后球应朝玩家侧运动
    expect(rally.physics.vel.z).toBeGreaterThan(0);
  });

  it('失误率 100% 时 AI 不回球', () => {
    const aiChar = new WobbleCharacter({ color: 0 });
    aiChar.group.position.set(AI_HOME.x, 0, AI_HOME.z);
    const rally = new RallyManager(new Shuttle(), { player: PLAYER_HOME, ai: AI_HOME });
    const ai = new AIController(aiChar, rally, { missRate: 1, reactionMs: 0 });

    const dt = 1 / 60;
    for (let i = 0; i < 6 * 60; i++) {
      rally.update(dt);
      ai.update(dt);
    }
    expect(rally.physics.lastHitter).not.toBe('ai');
    // 球反复落在 AI 半场界内 → 玩家持续得分（6 秒足够打完至少一分）
    expect(rally.scores.player).toBeGreaterThanOrEqual(1);
    expect(rally.scores.ai).toBe(0);
  });
});
