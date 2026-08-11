import type { SwingDirection } from '../camera/GestureDetector';

export type TutorialStep = 'showHand' | 'swingLeft' | 'swingRight' | 'ready' | 'done';

/** 举手持续识别所需时间（秒） */
const HAND_HOLD_SECONDS = 0.5;
/** 完成后的开球倒计时（秒） */
const READY_COUNTDOWN = 2.5;

/**
 * 新手引导状态机（GAME_DESIGN：4 步，每步实时识别反馈，完成才开赛）。
 * 纯逻辑，不碰 DOM，可单元测试。
 *
 *  1. showHand   举手/握拳/握拍让摄像头看到（骨架点亮）
 *  2. swingLeft  向左挥一次
 *  3. swingRight 向右挥一次
 *  4. ready      站位提示 + 倒计时，随后自动开球
 */
export class Tutorial {
  step: TutorialStep = 'showHand';
  /** 步骤刚切换时的提示回调（HUD 显示用） */
  onStepChange: ((step: TutorialStep) => void) | null = null;

  private handHeld = 0;
  private readyTimer = READY_COUNTDOWN;

  get done(): boolean {
    return this.step === 'done';
  }

  /** 每帧调用；handPresent 为当前是否追踪到手 */
  update(dt: number, handPresent: boolean): void {
    switch (this.step) {
      case 'showHand':
        this.handHeld = handPresent ? this.handHeld + dt : 0;
        if (this.handHeld >= HAND_HOLD_SECONDS) this.goto('swingLeft');
        break;
      case 'ready':
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) this.goto('done');
        break;
      default:
        break;
    }
  }

  /** 检测到挥拍时调用 */
  onSwing(direction: SwingDirection): void {
    if (this.step === 'swingLeft' && direction === 'left') this.goto('swingRight');
    else if (this.step === 'swingRight' && direction === 'right') this.goto('ready');
  }

  skip(): void {
    this.goto('done');
  }

  /** 当前步骤的引导文案 */
  get prompt(): string {
    switch (this.step) {
      case 'showHand':
        return '新手引导 第 1/4 步\n\n举起你的手（可握拳或握拍）\n让摄像头看到你 —— 右下角出现骨架即识别成功';
      case 'swingLeft':
        return '第 2/4 步 ✓ 已识别到你的手\n\n向左挥一次 ←\n像挥拍一样，动作快一点';
      case 'swingRight':
        return '第 3/4 步 ✓ 左挥成功\n\n向右挥一次 →';
      case 'ready':
        return '第 4/4 步 ✓ 右挥成功\n\n后退半步，让上半身进入画面\n身体左右移动 = 角色跑位 · 球来了就挥拍！马上开球…';
      case 'done':
        return '';
    }
  }

  private goto(step: TutorialStep): void {
    this.step = step;
    this.onStepChange?.(step);
  }
}
