import { HandTracker } from './HandTracker';

/**
 * 追踪推理 Worker：MediaPipe 推理从渲染主线程移到这里执行。
 * 主线程通过 WorkerTracker 投递缩放后的 ImageBitmap，本 Worker 推理后回传结果。
 * 推理再慢也只影响追踪频率，不会冻结画面（首轮实测卡顿的根因修复）。
 *
 * 消息协议：
 *   主→Worker: { type:'init' } | { type:'frame', bitmap: ImageBitmap, t: number }
 *   Worker→主: { type:'ready', delegate } | { type:'error', message } | { type:'result', hand, inferMs }
 */

// tsconfig 只含 DOM lib，手工声明 worker 全局上下文的最小接口
const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let tracker: HandTracker | null = null;

ctx.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as
    | { type: 'init' }
    | { type: 'frame'; bitmap: ImageBitmap; t: number };

  if (msg.type === 'init') {
    try {
      tracker = await HandTracker.create();
      ctx.postMessage({ type: 'ready', delegate: tracker.delegate });
    } catch (err) {
      ctx.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === 'frame' && tracker) {
    const t0 = performance.now();
    const hand = tracker.detect(msg.bitmap, msg.t);
    const inferMs = performance.now() - t0;
    msg.bitmap.close();
    // 回传帧捕获时刻 t：主线程计算挥手速度应基于捕获时间而非结果到达时间
    ctx.postMessage({ type: 'result', hand, inferMs, t: msg.t });
  }
};
