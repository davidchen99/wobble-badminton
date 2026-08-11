import { CameraManager } from './camera/CameraManager';
import { GestureDetector, type SwingEvent } from './camera/GestureDetector';
import { HandTracker, type TrackedHand } from './camera/HandTracker';
import { Game } from './game/Game';
import { PlayerController } from './player/PlayerController';
import { DebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/hud';

/** 推理间隔下限（毫秒）：追踪不必每渲染帧执行，与渲染解耦（TECH_SPEC） */
const DETECT_INTERVAL_MS = 33;
/** 挥拍速度阈值滑杆等调试功能通过 ?debug=0 可关（生产模式） */
const DEBUG_ENABLED = new URLSearchParams(location.search).get('debug') !== '0';

async function bootstrap(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('找不到 #app 容器');

  const hud = new Hud();
  const game = new Game(app, hud);
  game.start();

  const gesture = new GestureDetector();
  const debug = DEBUG_ENABLED ? new DebugPanel(gesture) : null;
  const playerController = new PlayerController(game.world.player);

  const camera = new CameraManager();
  hud.showMessage('正在请求摄像头权限…\n请在浏览器弹窗中点击"允许"。');
  try {
    await camera.start();
  } catch (err) {
    hud.showError(err instanceof Error ? err.message : String(err));
    return;
  }

  const preview = document.getElementById('cam-preview');
  preview?.prepend(camera.video);

  hud.showMessage('摄像头已就绪，正在加载手部追踪模型…');
  let tracker: HandTracker;
  try {
    tracker = await HandTracker.create();
  } catch (err) {
    hud.showError(err instanceof Error ? err.message : String(err));
    return;
  }
  hud.clearMessage();

  let lastDetectAt = 0;
  let trackFrames = 0;
  let trackAccum = 0;
  let trackingFps = 0;
  let lastHand: TrackedHand | null = null;
  let lastSwing: SwingEvent | null = null;
  let statsAccum = 0;

  game.onFrame = (dt) => {
    const now = performance.now();
    playerController.update(dt);

    // 追踪推理：限频执行，用最近结果驱动显示
    if (camera.ready && now - lastDetectAt >= DETECT_INTERVAL_MS) {
      lastDetectAt = now;
      const hand = tracker.detect(camera.video, now);
      lastHand = hand;
      trackFrames++;
      if (hand) {
        const swing = gesture.addSample({
          t: now / 1000,
          x: hand.wrist.x,
          y: hand.wrist.y,
          confidence: hand.confidence,
        });
        if (swing) {
          lastSwing = swing;
          debug?.flashSwing();
          playerController.swing(swing);
        }
      } else {
        gesture.onLost();
      }
    }

    trackAccum += dt;
    if (trackAccum >= 0.5) {
      trackingFps = trackFrames / trackAccum;
      trackFrames = 0;
      trackAccum = 0;
    }

    if (debug) {
      debug.drawOverlay(lastHand);
      statsAccum += dt;
      if (statsAccum >= 0.2) {
        statsAccum = 0;
        debug.updateStats({
          renderFps: game.currentFps,
          trackingFps,
          confidence: lastHand?.confidence ?? null,
          velocity: gesture.velocity,
          cooldownActive: gesture.cooldownActive(now / 1000),
          lastSwing,
        });
      }
    }
  };
}

bootstrap().catch((err) => {
  console.error(err);
});
