/**
 * 动作简图小动画：Canvas 程序化绘制的极简示意图（ART_DIRECTION：不用素材）。
 * 用于帮助层与新手引导，让玩家一眼看懂要做什么动作。
 *
 * startSketch 启动一个自循环小动画，返回停止函数。
 */

export type SketchKind = 'showHand' | 'fist' | 'doubleFist' | 'move' | 'wave';

const INK = '#e8eaee';
const ACCENT = '#ffd23f';

/** 画一只简笔手：openness 1=张开 0=握拳 */
function drawHand(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  openness: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // 手掌
  ctx.beginPath();
  ctx.arc(0, 4, 13, 0, Math.PI * 2);
  ctx.stroke();

  if (openness > 0.5) {
    // 张开：四指 + 拇指（线段）
    for (let i = 0; i < 4; i++) {
      const x = -10 + i * 6.5;
      ctx.beginPath();
      ctx.moveTo(x, -6);
      ctx.lineTo(x, -20);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-20, -2);
    ctx.stroke();
  } else {
    // 握拳：一排圆疙瘩 + 拇指扣下
    for (let i = 0; i < 4; i++) {
      const x = -9 + i * 6.2;
      ctx.beginPath();
      ctx.arc(x, -8, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-6, 6);
    ctx.stroke();
  }
  ctx.restore();
}

/** 平滑台阶：holdTime 保持，edgeTime 过渡 */
function gripPhase(t: number, period: number): number {
  const p = (t % period) / period;
  // 前 40% 张开，中间 20% 收拢，后 40% 握紧
  if (p < 0.4) return 1;
  if (p < 0.6) return 1 - (p - 0.4) / 0.2;
  return 0;
}

function render(ctx: CanvasRenderingContext2D, kind: SketchKind, t: number, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;

  switch (kind) {
    case 'showHand': {
      drawHand(ctx, cx, cy, 1, 1.2);
      // 识别波纹
      const r = ((t % 1) * 26) + 18;
      ctx.strokeStyle = `rgba(120, 220, 120, ${1 - (t % 1)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'fist': {
      drawHand(ctx, cx, cy, gripPhase(t, 1.4), 1.2);
      break;
    }
    case 'doubleFist': {
      drawHand(ctx, cx, cy, gripPhase(t, 0.7), 1.2);
      ctx.fillStyle = ACCENT;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('×2', cx + 34, cy - 18);
      break;
    }
    case 'move': {
      const dx = Math.sin(t * 1.6) * 22;
      drawHand(ctx, cx + dx, cy, 1, 1.1);
      // 左右箭头
      ctx.fillStyle = ACCENT;
      for (const s of [-1, 1]) {
        const ax = cx + s * (w / 2 - 16);
        ctx.beginPath();
        ctx.moveTo(ax + s * 8, cy - 8);
        ctx.lineTo(ax - s * 8, cy);
        ctx.lineTo(ax + s * 8, cy + 8);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'wave': {
      // 快速挥动：残影 + 本体
      const dx = Math.sin(t * 5) * 26;
      ctx.globalAlpha = 0.25;
      drawHand(ctx, cx + Math.sin(t * 5 - 0.35) * 26, cy, 1, 1.1);
      ctx.globalAlpha = 0.5;
      drawHand(ctx, cx + Math.sin(t * 5 - 0.18) * 26, cy, 1, 1.1);
      ctx.globalAlpha = 1;
      drawHand(ctx, cx + dx, cy, 1, 1.1);
      break;
    }
  }
}

/** 在指定 canvas 上循环播放简图动画，返回停止函数 */
export function startSketch(canvas: HTMLCanvasElement, kind: SketchKind): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  let raf = 0;
  const t0 = performance.now();
  const draw = (): void => {
    render(ctx, kind, (performance.now() - t0) / 1000, canvas.width, canvas.height);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}
