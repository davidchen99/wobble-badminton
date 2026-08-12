import type { SketchKind } from '../ui/sketches';

export type TutorialStep = 'showHand' | 'grip' | 'doubleGrip' | 'ready' | 'done';

/** 举手持续识别所需时间（秒） */
const HAND_HOLD_SECONDS = 0.5;
/** 完成后的开球倒计时（秒） */
const READY_COUNTDOWN = 2.5;

/**
 * 新手引导状态机（M8 握拳版，GAME_DESIGN：4 步，每步实时识别反馈 + 简图动画）。
 * 纯逻辑，不碰 DOM，可单元测试。
 *
 *  1. showHand    举手让摄像头看到（骨架点亮；期间完成手大小基准校准）
 *  2. grip        握拳一次 = 击打
 *  3. doubleGrip  连握两次 = 扣球
 *  4. ready       站位/移动提示 + 倒计时，随后自动开球
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
        if (this.handHeld >= HAND_HOLD_SECONDS) this.goto('grip');
        break;
      case 'ready':
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) this.goto('done');
        break;
      default:
        break;
    }
  }

  /** 检测到握拳时调用（isDouble 表示在连握窗口内） */
  onGrip(isDouble: boolean): void {
    if (this.step === 'grip') this.goto('doubleGrip');
    else if (this.step === 'doubleGrip' && isDouble) this.goto('ready');
  }

  skip(): void {
    this.goto('done');
  }

  /** 从帮助层重新进入引导 */
  reset(): void {
    this.handHeld = 0;
    this.readyTimer = READY_COUNTDOWN;
    this.goto('showHand');
  }

  /** 当前步骤配的动作简图 */
  get sketch(): SketchKind | null {
    switch (this.step) {
      case 'showHand':
        return 'showHand';
      case 'grip':
        return 'fist';
      case 'doubleGrip':
        return 'doubleFist';
      case 'ready':
        return 'move';
      case 'done':
        return null;
    }
  }

  /** 当前步骤的引导文案 */
  get prompt(): string {
    switch (this.step) {
      case 'showHand':
        return '新手引导 第 1/4 步\n\n举起你的手，让摄像头看到你\n右下角出现骨架即识别成功';
      case 'grip':
        return '第 2/4 步 ✓ 已识别到你的手\n\n握拳一次 = 击打\n张开手 → 快速握紧，试一下';
      case 'doubleGrip':
        return '第 3/4 步 ✓ 握拳击打成功\n\n连握两次 = 扣球\n握紧→松开→再握紧，动作快一点';
      case 'ready':
        return '第 4/4 步 ✓ 扣球成功\n\n手左右移 = 跑位 · 手往前伸/收回 = 前后移动\n马上开球…';
      case 'done':
        return '';
    }
  }

  private goto(step: TutorialStep): void {
    this.step = step;
    this.onStepChange?.(step);
  }
}
