import { startSketch, type SketchKind } from './sketches';

interface HelpSection {
  title: string;
  sketch: SketchKind | null;
  lines: string[];
}

const SECTIONS: HelpSection[] = [
  {
    title: '模式一 · 空手（默认）',
    sketch: 'fist',
    lines: ['握拳 = 击打', '连握两次 = 扣球', '手左右移 = 跑位', '手往前伸/收回 = 前后移动'],
  },
  {
    title: '模式二 · 键盘+持物（M 切换）',
    sketch: 'wave',
    lines: ['W A S D = 前后左右移动', '手持遥控器/拍子快速挥动 = 击打'],
  },
  {
    title: '通用',
    sketch: null,
    lines: ['空格 暂停/继续', 'R 重新开局', 'M 切换操控模式', 'H 或 F1 打开/关闭本帮助'],
  },
];

/**
 * 帮助层：左上角 ? 按钮 / H / F1 呼出。
 * 含两种模式操作说明、动作简图小动画、重进新手引导入口。
 */
export class HelpPanel {
  private overlay: HTMLElement;
  private stopSketches: (() => void)[] = [];

  constructor(onRestartTutorial: () => void) {
    this.overlay = mustGet('help-overlay');

    const sections = mustGet('help-sections');
    for (const sec of SECTIONS) {
      const card = document.createElement('div');
      card.className = 'help-card-section';
      const title = document.createElement('h3');
      title.textContent = sec.title;
      card.appendChild(title);
      if (sec.sketch) {
        const canvas = document.createElement('canvas');
        canvas.width = 110;
        canvas.height = 110;
        canvas.className = 'help-sketch';
        canvas.dataset.sketch = sec.sketch;
        card.appendChild(canvas);
      }
      const ul = document.createElement('ul');
      for (const line of sec.lines) {
        const li = document.createElement('li');
        li.textContent = line;
        ul.appendChild(li);
      }
      card.appendChild(ul);
      sections.appendChild(card);
    }

    mustGet('help-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    mustGet('help-close').addEventListener('click', () => this.hide());
    mustGet('help-tutorial').addEventListener('click', () => {
      this.hide();
      onRestartTutorial();
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  show(): void {
    this.overlay.hidden = false;
    // 打开时启动简图动画，关闭时停止（省性能）
    this.stopSketches = Array.from(
      this.overlay.querySelectorAll<HTMLCanvasElement>('canvas.help-sketch'),
    ).map((c) => startSketch(c, c.dataset.sketch as SketchKind));
  }

  hide(): void {
    this.overlay.hidden = true;
    this.stopSketches.forEach((stop) => stop());
    this.stopSketches = [];
  }

  toggle(): void {
    if (this.isOpen) this.hide();
    else this.show();
  }
}

function mustGet<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`帮助层缺少 #${id} 元素`);
  return el as T;
}
