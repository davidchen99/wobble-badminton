import type { TrackedHand } from './HandTracker';

/** 推理输入的目标宽度（高度按视频实际宽高比缩放），降低推理耗时 */
const INFER_WIDTH = 320;

/**
 * WorkerTracker：主线程侧的追踪引擎封装。
 * 把视频帧缩放成 ImageBitmap 发给 trackingWorker 推理；推理忙时直接丢帧。
 * 调用方根据 onResult 回报的耗时自适应调整投递频率。
 */
export class WorkerTracker {
  /** 实际生效的 delegate（GPU/CPU），ready 后可用 */
  delegate: 'GPU' | 'CPU' | null = null;
  /** 最近一次推理耗时（ms） */
  lastInferMs = 0;
  /** 推理结果回调；hand 为 null 表示该帧未检测到手；t 为帧捕获时刻（ms） */
  onResult: ((hand: TrackedHand | null, inferMs: number, t: number) => void) | null = null;

  private worker: Worker;
  private busy = false;

  private constructor(worker: Worker) {
    this.worker = worker;
  }

  static create(): Promise<WorkerTracker> {
    return new Promise((resolve, reject) => {
      // 经典 Worker + public/ 静态文件：完全绕开 Vite 模块图（dev/build 行为一致）
      // 相对路径：兼容 GitHub Pages 子路径托管（M12）
      const worker = new Worker('tracking-worker.js');
      const instance = new WorkerTracker(worker);
      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.type === 'ready') {
          instance.delegate = msg.delegate;
          resolve(instance);
        } else if (msg.type === 'error') {
          instance.dispose();
          reject(new Error(msg.message));
        } else if (msg.type === 'result') {
          instance.busy = false;
          instance.lastInferMs = msg.inferMs;
          instance.onResult?.(msg.hand ?? null, msg.inferMs, msg.t);
        }
      };
      worker.onerror = () => {
        reject(new Error('追踪 Worker 启动失败。'));
      };
      worker.postMessage({ type: 'init' });
    });
  }

  /** 投递一帧进行推理；上一帧未回时直接跳过（天然降频） */
  submit(video: HTMLVideoElement, nowMs: number): void {
    if (this.busy) return;
    this.busy = true;
    const scale = INFER_WIDTH / Math.max(1, video.videoWidth);
    createImageBitmap(video, {
      resizeWidth: INFER_WIDTH,
      resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)),
      resizeQuality: 'low',
    })
      .then((bitmap) => {
        this.worker.postMessage({ type: 'frame', bitmap, t: nowMs }, [bitmap]);
      })
      .catch(() => {
        this.busy = false;
      });
  }

  dispose(): void {
    this.worker.terminate();
  }
}
