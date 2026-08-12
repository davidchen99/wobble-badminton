/**
 * 基础 HUD：FPS 显示 + 中央消息/错误提示区。
 * 摄像头权限失败等错误必须走到这里，不能只写 console（见 TECH_SPEC）。
 */
export class Hud {
  private fpsEl: HTMLElement;
  private messageEl: HTMLElement;
  private progressEl: HTMLElement;

  constructor() {
    this.fpsEl = mustGet('hud-fps');
    this.messageEl = mustGet('hud-message');
    this.progressEl = mustGet('hud-progress');
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

  /** 当前关卡常显（M11：难度轨 + 第几关 + 对手名） */
  setLevel(trackName: string, index: number, name: string): void {
    mustGet('hud-level').textContent = `${trackName} · 第 ${index} 关 · ${name}`;
  }

  /**
   * 关卡进度条（M13，计分板下方极简一排）：
   * 每轨 3 格；当前关白色高亮、已通关金色点亮；专业轨未解锁显示黑色格 + 锁。
   */
  setProgress(s: {
    track: 'rookie' | 'pro';
    levelIndex: number;
    rookieCleared: number;
    proCleared: number;
    proUnlocked: boolean;
  }): void {
    const dots = (group: 'rookie' | 'pro', cleared: number, locked: boolean): string => {
      let html = '';
      for (let i = 0; i < 3; i++) {
        const cls = ['pg-dot'];
        if (locked) cls.push('locked');
        else if (i < cleared) cls.push('cleared');
        if (group === s.track && i === s.levelIndex) cls.push('current');
        html += `<span class="${cls.join(' ')}"></span>`;
      }
      return html;
    };
    this.progressEl.innerHTML =
      `<span class="pg-group">${dots('rookie', s.rookieCleared, false)}</span>` +
      '<span class="pg-sep"></span>' +
      `<span class="pg-group">${s.proUnlocked ? '' : '<span class="pg-lock">🔒</span>'}` +
      `${dots('pro', s.proCleared, !s.proUnlocked)}</span>`;
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
