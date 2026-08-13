/**
 * 摄像头预览画中画（M14）：
 * - 点按切换 小窗 ↔ 大窗（触屏默认小窗，桌面默认中窗维持原状）；
 * - 按住可拖动到屏幕任意位置，位置 localStorage 记忆，下次进来还在老地方；
 * - 拖动超过阈值不算点按；点按/拖动都阻止冒泡（避免误触"跳过引导/开球"）。
 * 不做"完全隐藏"：骨架画面是玩家确认识别成功的唯一反馈。
 */

const POS_KEY = 'wobble.pipPos';
/** 位移超过此像素算拖动，否则算点按 */
const DRAG_THRESHOLD = 6;

export function setupPipPreview(el: HTMLElement, isTouch: boolean): void {
  if (isTouch) el.classList.add('small');

  // 恢复上次拖到的位置
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const pos = JSON.parse(raw) as { left: number; top: number };
      applyPos(el, pos.left, pos.top);
    }
  } catch {
    /* 读不到就用默认右下角 */
  }

  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;
  let active = false;
  let moved = false;

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // 不触发主流程的 pointerdown（跳过引导/开球）
    startX = e.clientX;
    startY = e.clientY;
    const r = el.getBoundingClientRect();
    baseLeft = r.left;
    baseTop = r.top;
    active = true;
    moved = false;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
    if (moved) applyPos(el, baseLeft + dx, baseTop + dy);
  });

  el.addEventListener('pointerup', (e) => {
    if (!active) return;
    active = false;
    el.releasePointerCapture(e.pointerId);
    if (moved) {
      const r = el.getBoundingClientRect();
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
      } catch {
        /* 记不上就算了 */
      }
      return;
    }
    // 点按：大窗 ↔（触屏小窗 / 桌面中窗）
    if (el.classList.contains('large')) {
      el.classList.remove('large');
      if (isTouch) el.classList.add('small');
    } else {
      el.classList.add('large');
      el.classList.remove('small');
    }
    clampIntoView(el); // 换尺寸后可能探出屏幕，拉回
  });

  el.addEventListener('pointercancel', () => {
    active = false;
  });
}

/** 按左上角定位（清掉默认的 right/bottom 锚点），并夹进可视区 */
function applyPos(el: HTMLElement, left: number, top: number): void {
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  clampIntoView(el);
}

function clampIntoView(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(r.left, 0), Math.max(0, window.innerWidth - r.width));
  const top = Math.min(Math.max(r.top, 0), Math.max(0, window.innerHeight - r.height));
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
