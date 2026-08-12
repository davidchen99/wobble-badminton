/**
 * 双难度轨三关配置（M11 四轮定稿；数值经设计评审修正，专业入门强度 ≥ 新手王冠）。
 * 新手轨：黑帽新手 → 橙帽好手 → 王冠 Boss（首次玩家可通关）。
 * 专业轨：紫影 → 紫电 → 魔王（同一角色紫色递进 + 荧光，全面加强），通关新手王冠解锁。
 */
export type TrackId = 'rookie' | 'pro';

export interface LevelConfig {
  /** 关卡显示名 */
  name: string;
  /** 对手帽子类型（玩家不戴帽子） */
  hat: 'cap' | 'crown';
  hatColor: number;
  /** 对手身体配色（缺省为默认蓝） */
  bodyColor?: number;
  /** 荧光强度（emissive 色，专业轨递进加强；0=不发光） */
  glow?: number;
  /** 球基础飞行时间（秒/趟）：越大越慢越高 */
  flightTime: number;
  /** AI 失误率：本次来球直接不接的概率 */
  missRate: number;
  /** AI 反应延迟（毫秒） */
  reactionMs: number;
  /** AI 回球落点散布半径（米）：小=球找人保送 rally，大=人找球逼跑位 */
  returnSpread: number;
  /** AI 扣杀概率（0=不会扣杀） */
  smashRate: number;
  /** AI 扣杀飞行时间（秒）：越小越快越致命 */
  smashFlight: number;
}

export interface TrackConfig {
  /** 轨道显示名（HUD/切换按钮用） */
  name: string;
  levels: readonly LevelConfig[];
}

export const TRACKS: Record<TrackId, TrackConfig> = {
  rookie: {
    name: '新手',
    levels: [
      {
        name: '黑帽新手',
        hat: 'cap',
        hatColor: 0x37474f,
        flightTime: 1.9,
        missRate: 0.25,
        reactionMs: 280,
        returnSpread: 0.8,
        smashRate: 0,
        smashFlight: 0.95,
      },
      {
        name: '橙帽好手',
        hat: 'cap',
        hatColor: 0xfb8c00,
        flightTime: 1.6,
        missRate: 0.15,
        reactionMs: 230,
        returnSpread: 1.4,
        smashRate: 0,
        smashFlight: 0.95,
      },
      {
        name: '王冠 Boss',
        hat: 'crown',
        hatColor: 0xffd54f,
        flightTime: 1.3,
        missRate: 0.08,
        reactionMs: 180,
        returnSpread: 1.8,
        smashRate: 0.2,
        smashFlight: 0.95,
      },
    ],
  },
  pro: {
    name: '专业',
    levels: [
      {
        name: '紫影',
        hat: 'cap',
        hatColor: 0x6a1b9a,
        bodyColor: 0x7e57c2,
        glow: 0x2a1a4a,
        flightTime: 1.25,
        missRate: 0.08,
        reactionMs: 170,
        returnSpread: 1.6,
        smashRate: 0.25,
        smashFlight: 0.9,
      },
      {
        name: '紫电',
        hat: 'cap',
        hatColor: 0x8e24aa,
        bodyColor: 0x8e24aa,
        glow: 0x4a0e5c,
        flightTime: 1.1,
        missRate: 0.05,
        reactionMs: 150,
        returnSpread: 1.8,
        smashRate: 0.3,
        smashFlight: 0.8,
      },
      {
        name: '魔王',
        hat: 'crown',
        hatColor: 0x7c4dff,
        bodyColor: 0x4a148c,
        glow: 0x7c4dff,
        flightTime: 0.95,
        missRate: 0.03,
        reactionMs: 120,
        returnSpread: 2.0,
        smashRate: 0.45,
        smashFlight: 0.7,
      },
    ],
  },
};
