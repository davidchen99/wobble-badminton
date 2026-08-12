/**
 * 动作简图小动画：Canvas 程序化绘制的极简示意图（ART_DIRECTION：不用素材）。
 * 用于帮助层与新手引导，让玩家一眼看懂要做什么动作。
 *
 * startSketch 启动一个自循环小动画，返回停止函数；zoom 可整体放大画面
 * （引导层用大画布 + zoom=2，帮助层用小画布默认 1）。
 * M11：引导层（大画布）的握拳/连握简图升级为左右对照——
 * 左侧手部动作，右侧简笔小人同步演示游戏内结果（握一下=挥拍、握两下=跳扣）。
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

/**
 * 画一个简笔小人（M11 引导对照：演示手部动作在游戏里的结果）。
 * armAngle 为持拍臂角度（弧度，0=水平向前，负=上举）；jumpY 为跳起高度。
 */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  armAngle: number,
  jumpY: number,
): void {
  ctx.save();
  ctx.translate(x, groundY - jumpY);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // 头
  ctx.beginPath();
  ctx.arc(0, -34, 7, 0, Math.PI * 2);
  ctx.stroke();
  // 躯干
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(0, -12);
  ctx.stroke();
  // 腿
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-6, 0);
  ctx.moveTo(0, -12);
  ctx.lineTo(6, 0);
  ctx.stroke();
  // 持拍臂 + 拍面小圆
  const hx = Math.cos(armAngle) * 13;
  const hy = Math.sin(armAngle) * 13;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(hx, -24 + hy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx + Math.cos(armAngle) * 6, -24 + hy + Math.sin(armAngle) * 6, 5, 0, Math.PI * 2);
  ctx.stroke();
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
  /** 大画布（引导层）启用左右对照小人；小画布（帮助层）保持单手居中 */
  const duo = w >= 200;

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
      const hx = duo ? cx - 42 : cx;
      drawHand(ctx, hx, cy, gripPhase(t, 1.4), 1.2);
      if (duo) {
        // 右侧小人同步演示：握拳瞬间 = 挥拍击打
        const p = (t % 1.4) / 1.4;
        let arm: number;
        if (p < 0.4) arm = -0.4 - p * 2; // 后摆蓄力
        else if (p < 0.6) arm = -1.2 + ((p - 0.4) / 0.2) * 2.4; // 快速挥出
        else arm = 1.2 - ((p - 0.6) / 0.4) * 1.6; // 收势回位
        drawPerson(ctx, cx + 45, cy + 66, arm, 0);
      }
      break;
    }
    case 'doubleFist': {
      const hx = duo ? cx - 42 : cx;
      drawHand(ctx, hx, cy, gripPhase(t, 0.7), 1.2);
      ctx.fillStyle = ACCENT;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('×2', hx + 34, cy - 18);
      if (duo) {
        // 右侧小人同步演示：连握 = 跳起扣杀（节奏更快）+ 球斜向下飞出
        const p = (t % 0.9) / 0.9;
        const jumpY = 4 * 16 * p * (1 - p);
        const arm = p < 0.35 ? -2.2 + p * 1.2 : -1.8 + ((p - 0.35) / 0.65) * 3.4; // 举起→猛扣
        drawPerson(ctx, cx + 45, cy + 66, arm, jumpY);
        if (p > 0.45) {
          const f = (p - 0.45) / 0.55;
          ctx.fillStyle = ACCENT;
          ctx.beginPath();
          ctx.arc(cx + 57 + f * 52, cy + 14 + f * 46, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'move': {
      const dx = Math.sin(t * 1.6) * 22;
      drawHand(ctx, cx + dx, cy, 1, 1.1);
      // 左右箭头（固定偏移，兼容引导层 zoom 放大不飞出画布）
      ctx.fillStyle = ACCENT;
      for (const s of [-1, 1]) {
        const ax = cx + s * 46;
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

/** 在指定 canvas 上循环播放简图动画（zoom 整体放大，引导层用 2），返回停止函数 */
export function startSketch(canvas: HTMLCanvasElement, kind: SketchKind, zoom = 1): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  let raf = 0;
  const t0 = performance.now();
  const draw = (): void => {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    render(ctx, kind, (performance.now() - t0) / 1000, canvas.width, canvas.height);
    ctx.restore();
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}
