import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export interface TrackedHand {
  /** 手腕坐标（已镜像翻转的归一化坐标） */
  wrist: { x: number; y: number };
  /** 手部追踪置信度 0..1 */
  confidence: number;
  /** 21 个关键点（已镜像翻转），供 debug 绘制 */
  landmarks: { x: number; y: number }[];
}

export interface HandTrackerOptions {
  /** 惯用手过滤；'any' 表示追踪任意一只手（MVP 默认，numHands=1） */
  dominantHand: 'any' | 'left' | 'right';
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

const DEFAULT_OPTIONS: HandTrackerOptions = {
  dominantHand: 'any',
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

/** MediaPipe 手部关键点中手腕的下标 */
const WRIST_INDEX = 0;

/**
 * HandTracker：封装 MediaPipe Hand Landmarker。
 * 模型与 wasm 走本地 public/ 路径，离线可用。
 *
 * 坐标约定：getUserMedia 原始画面是"照片视角"（用户的右手在画面左侧）。
 * 这里统一做 x 镜像翻转，使数据空间与玩家自我感知的镜面一致；
 * debug 预览容器用 CSS scaleX(-1) 镜像显示，叠加绘制保持对齐。
 */
export class HandTracker {
  private landmarker: HandLandmarker;
  private options: HandTrackerOptions;
  /** 实际生效的推理 delegate（GPU 优先，失败回退 CPU），用于性能诊断 */
  readonly delegate: 'GPU' | 'CPU';

  private constructor(landmarker: HandLandmarker, options: HandTrackerOptions, delegate: 'GPU' | 'CPU') {
    this.landmarker = landmarker;
    this.options = options;
    this.delegate = delegate;
  }

  static async create(options: Partial<HandTrackerOptions> = {}): Promise<HandTracker> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
    } catch (err) {
      throw new Error(`手部追踪组件加载失败：${err instanceof Error ? err.message : String(err)}`);
    }

    const baseOptions = {
      modelAssetPath: '/models/hand_landmarker.task',
    };
    const makeOptions = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { ...baseOptions, delegate },
      runningMode: 'VIDEO' as const,
      numHands: 1,
      minHandDetectionConfidence: opts.minDetectionConfidence,
      minHandPresenceConfidence: opts.minTrackingConfidence,
      minTrackingConfidence: opts.minTrackingConfidence,
    });

    // 优先 GPU delegate，失败回退 CPU（TECH_SPEC：MediaPipe 初始化失败要给出可理解错误）
    try {
      const landmarker = await HandLandmarker.createFromOptions(vision, makeOptions('GPU'));
      return new HandTracker(landmarker, opts, 'GPU');
    } catch {
      try {
        const landmarker = await HandLandmarker.createFromOptions(vision, makeOptions('CPU'));
        return new HandTracker(landmarker, opts, 'CPU');
      } catch (err) {
        throw new Error(
          `手部追踪模型初始化失败：${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * 对一帧输入做一次推理（同步阻塞数毫秒；在主线程以外调用可避免卡渲染）。
   * @param input 视频元素或 ImageBitmap（Worker 内使用时为后者）
   * @param nowMs 单调递增时间戳（performance.now()）
   */
  detect(input: HTMLVideoElement | ImageBitmap, nowMs: number): TrackedHand | null {
    if (
      typeof HTMLVideoElement !== 'undefined' &&
      input instanceof HTMLVideoElement &&
      (input.readyState < 2 || input.videoWidth === 0)
    ) {
      return null;
    }

    const result = this.landmarker.detectForVideo(input, nowMs);
    if (!result.landmarks || result.landmarks.length === 0) return null;

    const handedness = result.handedness?.[0]?.[0];
    if (this.options.dominantHand !== 'any' && handedness) {
      // MediaPipe 的 handedness 假设输入是镜像画面；原始摄像头帧未镜像，需交换左右
      const label = handedness.categoryName === 'Left' ? 'right' : 'left';
      if (label !== this.options.dominantHand) return null;
    }

    const landmarks = result.landmarks[0].map((lm) => ({ x: 1 - lm.x, y: lm.y }));
    return {
      wrist: landmarks[WRIST_INDEX],
      confidence: handedness?.score ?? 0.5,
      landmarks,
    };
  }

  dispose(): void {
    this.landmarker.close();
  }
}

/** MediaPipe 手部骨架连线（供 debug 绘制） */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
