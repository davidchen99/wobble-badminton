import type { GestureDetector, SwingEvent } from '../camera/GestureDetector';
import { HAND_CONNECTIONS, type TrackedHand } from '../camera/HandTracker';

export interface DebugStats {
  renderFps: number;
  trackingFps: number;
  /** 推理 delegate（GPU/CPU）与耗时、投递间隔——卡顿诊断关键指标 */
  delegate: string | null;
  inferMs: number;
  detectIntervalMs: number;
  /** 当前置信度；null 表示未检测到手 */
  confidence: number | null;
  velocity: { x: number; y: number };
  cooldownActive: boolean;
  lastSwing: SwingEvent | null;
}

interface SliderDef {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
}

const GESTURE_SLIDERS: { key: 'swingSpeedThreshold' | 'cooldownMs' | 'smoothing'; label: string; min: number; max: number; step: number }[] = [
  { key: 'swingSpeedThreshold', label: '挥拍速度阈值', min: 0.5, max: 4, step: 0.1 },
  { key: 'cooldownMs', label: '冷却 (ms)', min: 100, max: 800, step: 10 },
  { key: 'smoothing', label: '平滑', min: 0.1, max: 0.9, step: 0.05 },
];

/**
 * Debug 面板：tracking 状态文本 + 灵敏度调参滑杆 + 手部骨架叠加绘制。
 * 生产模式可通过 URL 参数 ?debug=0 隐藏（见 main.ts）。
 */
export class DebugPanel {
  private statsEl: HTMLElement;
  private controlsEl: HTMLElement;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private swingFlashUntil = 0;

  constructor(private gesture: GestureDetector) {
    this.statsEl = mustGet('debug-stats');
    this.controlsEl = mustGet('debug-controls');
    this.overlay = mustGet<HTMLCanvasElement>('cam-overlay');
    const ctx = this.overlay.getContext('2d');
    if (!ctx) throw new Error('无法创建 debug 画布上下文');
    this.ctx = ctx;

    this.addSliders(
      GESTURE_SLIDERS.map((def) => ({
        ...def,
        get: () => this.gesture.params[def.key],
        set: (v) => {
          this.gesture.params[def.key] = v;
        },
      })),
    );
  }

  /** 追加一组调参滑杆（如 AI 反应延迟/失误率） */
  addSliders(defs: SliderDef[]): void {
    for (const def of defs) {
      const row = document.createElement('label');
      row.className = 'debug-slider';

      const name = document.createElement('span');
      name.textContent = def.label;
      const value = document.createElement('span');
      value.className = 'debug-slider-value';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(def.get());

      const render = () => {
        value.textContent = def.get().toFixed(def.step < 0.1 ? 2 : 1);
      };
      input.addEventListener('input', () => {
        def.set(Number(input.value));
        render();
      });
      render();

      row.append(name, input, value);
      this.controlsEl.appendChild(row);
    }
  }

  updateStats(stats: DebugStats): void {
    const v = stats.velocity;
    const lines = [
      `render FPS : ${stats.renderFps.toFixed(0)}`,
      `track FPS  : ${stats.trackingFps.toFixed(0)} (${stats.delegate ?? '--'} ${stats.inferMs.toFixed(0)}ms/帧, 间隔${stats.detectIntervalMs.toFixed(0)}ms)`,
      `confidence : ${stats.confidence === null ? '--' : stats.confidence.toFixed(2)}`,
      `wrist vel  : ${v.x.toFixed(2)}, ${v.y.toFixed(2)} (|v|=${Math.hypot(v.x, v.y).toFixed(2)})`,
      `cooldown   : ${stats.cooldownActive ? 'active' : 'ready'}`,
      `swing      : ${stats.lastSwing ? `${stats.lastSwing.direction} @ ${stats.lastSwing.speed.toFixed(1)}` : '--'}`,
    ];
    this.statsEl.textContent = lines.join('\n');
  }

  flashSwing(): void {
    this.swingFlashUntil = performance.now() + 250;
  }

  /** 在摄像头预览上叠加骨架与手腕轨迹。坐标均为已镜像的归一化坐标。 */
  drawOverlay(hand: TrackedHand | null): void {
    const { width: w, height: h } = this.overlay;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // 手腕轨迹
    const trail = this.gesture.trail;
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach((s, i) => {
        const px = s.x * w;
        const py = s.y * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    if (hand) {
      ctx.strokeStyle = 'rgba(120, 220, 120, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(hand.landmarks[a].x * w, hand.landmarks[a].y * h);
        ctx.lineTo(hand.landmarks[b].x * w, hand.landmarks[b].y * h);
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(120, 220, 120, 0.9)';
      for (const lm of hand.landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // 手腕高亮
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(hand.palm.x * w, hand.palm.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 挥拍闪示
    if (performance.now() < this.swingFlashUntil) {
      ctx.fillStyle = 'rgba(255, 90, 90, 0.25)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText('SWING!', 8, 22);
    }
  }
}

function mustGet<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Debug 面板缺少 #${id} 元素`);
  return el as T;
}
