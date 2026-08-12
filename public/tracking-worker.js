/* global Vision */
/**
 * 追踪推理 Worker（public/ 静态文件 + 经典 Worker，完全绕开 Vite 模块图）。
 *
 * 背景：Vite dev 会给 Worker 内的动态 import 追加 ?import 并把请求纳入模块图，
 * 触发 "/public 文件禁止从源码 import" 守卫。经典 Worker + importScripts 是
 * MediaPipe 官方支持的经典路径，dev 与 build 行为一致。
 *
 * 注意：手部结果提取约定（镜像翻转 / 掌心 9 号点 / 置信度）与
 * src/camera/HandTracker.ts 中的 TrackedHand 类型保持一致，改动需同步。
 *
 * 消息协议：
 *   主→Worker: { type:'init' } | { type:'frame', bitmap: ImageBitmap, t: number }
 *   Worker→主: { type:'ready', delegate } | { type:'error', message }
 *              | { type:'result', hand, inferMs, t }
 */

/** MediaPipe 手部关键点中的掌心采样点（中指根 MCP） */
const PALM_INDEX = 9;

let landmarker = null;

self.onmessage = async (ev) => {
  const msg = ev.data;

  if (msg.type === 'init') {
    try {
      importScripts('mediapipe-wasm/vision_bundle.js');
      const vision = await Vision.FilesetResolver.forVisionTasks('mediapipe-wasm');
      const makeOptions = (delegate) => ({
        baseOptions: { modelAssetPath: 'models/hand_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      // 优先 GPU delegate，失败回退 CPU
      let delegate = 'GPU';
      try {
        landmarker = await Vision.HandLandmarker.createFromOptions(vision, makeOptions('GPU'));
      } catch {
        delegate = 'CPU';
        landmarker = await Vision.HandLandmarker.createFromOptions(vision, makeOptions('CPU'));
      }
      self.postMessage({ type: 'ready', delegate });
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: '手部追踪组件加载失败：' + (err && err.message ? err.message : String(err)),
      });
    }
    return;
  }

  if (msg.type === 'frame' && landmarker) {
    const t0 = performance.now();
    const result = landmarker.detectForVideo(msg.bitmap, msg.t);
    const inferMs = performance.now() - t0;
    msg.bitmap.close();

    let hand = null;
    if (result.landmarks && result.landmarks.length > 0) {
      const handedness = result.handedness && result.handedness[0] && result.handedness[0][0];
      // 统一镜像翻转：数据空间与玩家自我感知的镜面一致
      const landmarks = result.landmarks[0].map((lm) => ({ x: 1 - lm.x, y: lm.y }));
      hand = {
        palm: landmarks[PALM_INDEX],
        confidence: handedness ? handedness.score : 0.5,
        landmarks,
      };
    }
    // 回传帧捕获时刻 t：主线程计算挥手速度基于捕获时间而非结果到达时间
    self.postMessage({ type: 'result', hand, inferMs, t: msg.t });
  }
};
