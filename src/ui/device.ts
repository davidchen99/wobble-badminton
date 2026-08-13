/**
 * 触屏设备判定（M14）：粗指针（触屏）优先，ontouchstart 兜底。
 * 用于：预览默认小窗、锁定空手模式、隐藏键盘提示、结算大按钮等移动端适配。
 */
export const IS_TOUCH: boolean =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches === true || 'ontouchstart' in window);
