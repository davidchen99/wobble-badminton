import { describe, expect, it } from 'vitest';
import { WobbleCharacter } from '../game/character';
import { PlayerController } from './PlayerController';
import type { SwingEvent } from '../camera/GestureDetector';

function makeSwing(direction: SwingEvent['direction'], speed = 2): SwingEvent {
  return { direction, speed, time: 0 };
}

function step(controller: PlayerController, seconds: number, fps = 120): void {
  const dt = 1 / fps;
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) controller.update(dt);
}

describe('PlayerController', () => {
  it('挥拍动画在触球点触发一次 onStrike', () => {
    const c = new PlayerController(new WobbleCharacter({ color: 0 }));
    let strikes = 0;
    let dir: string | null = null;
    c.onStrike = (d) => {
      strikes++;
      dir = d;
    };
    c.swing(makeSwing('right'));
    step(c, 0.5);
    expect(strikes).toBe(1);
    expect(dir).toBe('right');
    expect(c.swinging).toBe(false);
  });

  it('动画前段的新挥拍被忽略（防重复触发），后段可重新触发', () => {
    const c = new PlayerController(new WobbleCharacter({ color: 0 }));
    let strikes = 0;
    c.onStrike = () => strikes++;
    c.swing(makeSwing('right'));
    step(c, 0.05); // 进度 ~13%，处于保护期
    c.swing(makeSwing('left'));
    step(c, 0.5);
    expect(strikes).toBe(1); // 只触发了第一次

    c.swing(makeSwing('left'));
    step(c, 0.5);
    expect(strikes).toBe(2);
  });

  it('挥拍结束后手臂回到待机位、身体弹簧收敛', () => {
    const character = new WobbleCharacter({ color: 0 });
    const c = new PlayerController(character);
    c.swing(makeSwing('up', 3));
    step(c, 2); // 动画 + 弹簧收敛时间
    expect(Math.abs(character.armR.rotation.z + 0.35)).toBeLessThan(0.01);
    expect(Math.abs(character.squashG.rotation.z)).toBeLessThan(0.01);
    expect(Math.abs(character.squashG.scale.y - 1)).toBeLessThan(0.01);
  });

  it('跳起扣杀：身体明显跳起后落地复位，全程不触发 onStrike', () => {
    const character = new WobbleCharacter({ color: 0 });
    const c = new PlayerController(character);
    let strikes = 0;
    c.onStrike = () => strikes++;
    c.jumpSmash();
    step(c, 0.27); // 接近跳跃中点（动画 0.55s）
    expect(character.squashG.position.y).toBeGreaterThan(0.3);
    step(c, 0.6); // 走完动画
    expect(character.squashG.position.y).toBe(0);
    expect(strikes).toBe(0); // 纯演出，击球判定已由 rally.smash 完成
  });
});
