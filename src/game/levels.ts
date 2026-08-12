/**
 * 三关闯关配置（M10，GAME_DESIGN 难度曲线与心流参数）。
 * 帽子即难度符号：黑帽新手 → 橙帽好手 → 王冠 Boss。
 * 数值为评审定调的初值，按实测微调。
 */
export interface LevelConfig {
  /** 关卡显示名 */
  name: string;
  /** 对手帽子类型（玩家不戴帽子） */
  hat: 'cap' | 'crown';
  hatColor: number;
  /** 球基础飞行时间（秒/趟）：越大越慢越高 */
  flightTime: number;
  /** AI 失误率：本次来球直接不接的概率 */
  missRate: number;
  /** AI 反应延迟（毫秒） */
  reactionMs: number;
  /** AI 回球落点散布半径（米）：L1 小=球找人保送 rally，L3 大=人找球逼跑位 */
  returnSpread: number;
  /** AI 扣杀概率（王冠专属，0=不会扣杀） */
  smashRate: number;
}

export const LEVELS: readonly LevelConfig[] = [
  {
    name: '黑帽新手',
    hat: 'cap',
    hatColor: 0x37474f,
    flightTime: 1.8,
    missRate: 0.2,
    reactionMs: 250,
    returnSpread: 0.8,
    smashRate: 0,
  },
  {
    name: '橙帽好手',
    hat: 'cap',
    hatColor: 0xfb8c00,
    flightTime: 1.4,
    missRate: 0.1,
    reactionMs: 200,
    returnSpread: 1.4,
    smashRate: 0,
  },
  {
    name: '王冠 Boss',
    hat: 'crown',
    hatColor: 0xffd54f,
    flightTime: 1.1,
    missRate: 0.05,
    reactionMs: 150,
    returnSpread: 1.8,
    smashRate: 0.35,
  },
];
