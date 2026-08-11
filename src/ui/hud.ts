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
