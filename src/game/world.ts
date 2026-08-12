import * as THREE from 'three';
import { WobbleCharacter } from './character';
import { buildCourt } from './court';
import { Shuttle } from './shuttle';
import { buildTrophy } from './trophy';

/** 玩家初始站位（场地 z>0 为玩家侧，z<0 为 AI 侧） */
export const PLAYER_HOME = new THREE.Vector3(0, 0, 4.8);
export const AI_HOME = new THREE.Vector3(0, 0, -4.8);

export interface World {
  player: WobbleCharacter;
  ai: WobbleCharacter;
  shuttle: Shuttle;
  /** 首胜奖杯（M9）：默认隐藏，领奖时刻显示并悬浮旋转 */
  trophy: THREE.Group;
  update(dt: number, time: number): void;
}

/** 组装完整场景：灯光、球场、双方角色、羽毛球、奖杯 */
export function buildWorld(scene: THREE.Scene): World {
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x87b5d6, 25, 45);

  // 简单灯光：半球环境光 + 一盏方向光，无阴影（TECH_SPEC 性能预算）
  scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x3a5f3a, 1.0));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sun.position.set(4, 9, 6);
  scene.add(sun);

  scene.add(buildCourt());

  const player = new WobbleCharacter({ color: 0xff8a65, facing: Math.PI });
  player.group.position.copy(PLAYER_HOME);
  scene.add(player.group);

  const ai = new WobbleCharacter({ color: 0x4fc3f7, facing: 0 });
  ai.group.position.copy(AI_HOME);
  scene.add(ai.group);

  const shuttle = new Shuttle();
  shuttle.setPosition(0.8, 1.5, 3.2);
  scene.add(shuttle.group);

  const trophy = buildTrophy();
  trophy.visible = false;
  scene.add(trophy);

  return {
    player,
    ai,
    shuttle,
    trophy,
    update(_dt, time) {
      player.updateIdle(time);
      ai.updateIdle(time + 1.7);
      if (trophy.visible) {
        // 领奖时刻：奖杯悬浮 + 缓慢旋转
        trophy.rotation.y = time * 1.6;
        trophy.position.y = 0.15 + Math.abs(Math.sin(time * 2.2)) * 0.25;
      }
    },
  };
}
