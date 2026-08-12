/**
 * 基础 HUD：FPS 显示 + 中央消息/错误提示区。
 * 摄像头权限失败等错误必须走到这里，不能只写 console（见 TECH_SPEC）。
 */
export class Hud {
  private fpsEl: HTMLElement;
  private messageEl: HTMLElement;

  constructor() {
    this.fpsEl = mustGet('hud-fps');
    this.messageEl = mustGet('hud-message');
  }

  setFps(fps: number): void {
    this.fpsEl.textContent = `FPS: ${fps.toFixed(0)}`;
  }

  /** 顶部计分板 */
  setScore(player: number, ai: number): void {
    mustGet('hud-score').textContent = `${player} : ${ai}`;
  }

  /** 当前操控模式常显 */
  setMode(mode: 'bare' | 'keyboard'): void {
    mustGet('hud-mode').textContent = mode === 'bare' ? '模式：空手' : '模式：键盘+持物';
  }

  /** 当前关卡常显（M10：第几关 + 对手名） */
  setLevel(index: number, name: string): void {
    mustGet('hud-level').textContent = `第 ${index} 关 · ${name}`;
  }

  /** 一般提示（如"等待摄像头授权…"）。 */
  showMessage(text: string): void {
    this.messageEl.textContent = text;
    this.messageEl.classList.remove('error');
    this.messageEl.hidden = false;
  }

  /** 错误提示（红色背景，需用户处理）。 */
  showError(text: string): void {
    this.messageEl.textContent = text;
    this.messageEl.classList.add('error');
    this.messageEl.hidden = false;
  }

  clearMessage(): void {
    this.messageEl.hidden = true;
  }
}

function mustGet(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`HUD 缺少 #${id} 元素`);
  return el;
}
