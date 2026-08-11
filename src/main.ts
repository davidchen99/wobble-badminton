import { CameraManager } from './camera/CameraManager';
import { GestureDetector, type SwingEvent } from './camera/GestureDetector';
import type { TrackedHand } from './camera/HandTracker';
import { WorkerTracker } from './camera/WorkerTracker';
import { AIController } from './ai/AIController';
import { SoundManager } from './audio/SoundManager';
import { Game } from './game/Game';
import { RallyManager } from './game/rally';
import { Tutorial } from './game/tutorial';
import { AI_HOME, PLAYER_HOME } from './game/world';
import { PlayerController } from './player/PlayerController';
import { DebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/hud';

/** 推理间隔下限（毫秒）：追踪不必每渲染帧执行，与渲染解耦（TECH_SPEC） */
const DETECT_INTERVAL_MS = 33;
const URL_PARAMS = new URLSearchParams(location.search);
/** 挥拍速度阈值滑杆等调试功能通过 ?debug=0 可关（生产模式） */
const DEBUG_ENABLED = URL_PARAMS.get('debug') !== '0';
/** 新手引导默认开启，?tutorial=0 跳过（老玩家/调试） */
const TUTORIAL_ENABLED = URL_PARAMS.get('tutorial') !== '0';

type Flow = 'menu' | 'tutorial' | 'playing' | 'paused';

async function bootstrap(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('找不到 #app 容器');

  const hud = new Hud();
  const game = new Game(app, hud);
  game.start();

  const gesture = new GestureDetector();
  const debug = DEBUG_ENABLED ? new DebugPanel(gesture) : null;
  const sound = new SoundManager();
  const playerController = new PlayerController(game.world.player);
  const rally = new RallyManager(game.world.shuttle, {
    player: { x: PLAYER_HOME.x, y: PLAYER_HOME.y, z: PLAYER_HOME.z },
    ai: { x: AI_HOME.x, y: AI_HOME.y, z: AI_HOME.z },
  });
  const aiController = new AIController(game.world.ai, rally);
  debug?.addSliders([
    {
      label: 'AI反应 (ms)', min: 0, max: 600, step: 20,
      get: () => aiController.params.reactionMs,
      set: (v) => { aiController.params.reactionMs = v; },
    },
    {
      label: 'AI失误率', min: 0, max: 0.5, step: 0.01,
      get: () => aiController.params.missRate,
      set: (v) => { aiController.params.missRate = v; },
    },
    {
      label: '球速(秒/趟)', min: 1.0, max: 2.5, step: 0.1,
      get: () => rally.flightTime,
      set: (v) => { rally.flightTime = v; },
    },
  ]);

  let flow: Flow = 'menu';
  const tutorial = new Tutorial();

  // ---- 击球反馈：声音 + 镜头冲击 + 球闪 ----
  let shuttleFlash = 0;
  const onHit = (speed: number): void => {
    sound.hit(speed);
    game.addShake(Math.min(0.18, 0.06 + speed * 0.02));
    shuttleFlash = 1;
  };
  playerController.onStrike = (_dir, speed) => {
    if (flow !== 'playing') return;
    if (rally.tryHit('player')) onHit(speed);
    else sound.whiff();
  };
  aiController.onResolve = (hit) => {
    if (hit && flow === 'playing') sound.hit(1.6);
  };
  rally.onPoint = (scorer, scores) => {
    hud.setScore(scores.player, scores.ai);
    sound.point(scorer);
  };

  // ---- 开始 / 暂停 / 重开 ----
  const startGame = (): void => {
    sound.ensure(); // AudioContext 必须在用户手势里创建
    flow = 'playing';
    hud.clearMessage();
  };
  window.addEventListener('keydown', (e) => {
    sound.ensure(); // 任何首次按键都尝试解锁音频（引导自动开球路径）
    if (e.code === 'Space') {
      e.preventDefault();
      if (flow === 'menu') startGame();
      else if (flow === 'tutorial') {
        tutorial.skip(); // onStepChange('done') 会触发 startGame
      } else if (flow === 'playing') {
        flow = 'paused';
        hud.showMessage('已暂停\n空格 继续 · R 重开');
      } else {
        flow = 'playing';
        hud.clearMessage();
      }
    } else if (e.code === 'KeyR' && flow !== 'menu' && flow !== 'tutorial') {
      rally.reset();
      hud.setScore(0, 0);
      flow = 'playing';
      hud.clearMessage();
    }
  });
  window.addEventListener('pointerdown', () => {
    sound.ensure();
    if (flow === 'menu') startGame();
    else if (flow === 'tutorial') tutorial.skip();
  });

  // ---- 摄像头与追踪 ----
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
  let tracker: WorkerTracker;
  try {
    tracker = await WorkerTracker.create();
  } catch (err) {
    hud.showError(err instanceof Error ? err.message : String(err));
    return;
  }
  console.info(`[tracking] delegate = ${tracker.delegate}`);

  tutorial.onStepChange = (step) => {
    if (step === 'done') startGame();
    else hud.showMessage(`${tutorial.prompt}\n\n（空格 跳过引导）`);
  };
  if (TUTORIAL_ENABLED) {
    flow = 'tutorial';
    hud.showMessage(`${tutorial.prompt}\n\n（空格 跳过引导）`);
  } else {
    hud.showMessage('准备就绪！\n空格 / 点击 开始\n挥动手臂 = 挥拍击球 · R 重开');
  }

  let lastDetectAt = 0;
  let detectIntervalMs = DETECT_INTERVAL_MS; // 自适应：推理耗时越长投递越稀疏
  let inferEma = 0;
  let trackFrames = 0;
  let trackAccum = 0;
  let trackingFps = 0;
  let lastHand: TrackedHand | null = null;
  let lastSwing: SwingEvent | null = null;
  let statsAccum = 0;

  tracker.onResult = (hand, inferMs, t) => {
    lastHand = hand;
    trackFrames++;
    inferEma = inferEma === 0 ? inferMs : inferEma * 0.7 + inferMs * 0.3;
    // 渲染优先：推理耗时的 1.5 倍作为投递间隔（33ms~250ms）
    detectIntervalMs = Math.min(250, Math.max(DETECT_INTERVAL_MS, inferEma * 1.5));
    if (hand) {
      const swing = gesture.addSample({
        t: t / 1000, // 用帧捕获时刻计算速度，抵消推理延迟
        x: hand.palm.x,
        y: hand.palm.y,
        confidence: hand.confidence,
      });
      if (swing) {
        lastSwing = swing;
        debug?.flashSwing();
        if (flow === 'playing' || flow === 'tutorial') playerController.swing(swing);
        if (flow === 'tutorial') tutorial.onSwing(swing.direction);
      }
    } else {
      gesture.onLost();
    }
  };

  game.onFrame = (dt) => {
    const now = performance.now();

    // 投递推理帧：频率自适应，Worker 忙时自动丢帧，渲染永不被推理阻塞
    if (camera.ready && now - lastDetectAt >= detectIntervalMs) {
      lastDetectAt = now;
      tracker.submit(camera.video, now);
    }

    if (flow === 'playing') {
      playerController.update(dt);
      aiController.update(dt);
      rally.update(dt);
    } else if (flow === 'tutorial') {
      // 引导中角色也响应挥拍（纯演示，不碰球），并实时反馈识别状态
      playerController.update(dt);
      tutorial.update(dt, lastHand !== null);
    }

    // 击球闪光衰减
    if (shuttleFlash > 0) {
      shuttleFlash = Math.max(0, shuttleFlash - dt * 6);
      game.world.shuttle.group.scale.setScalar(1 + shuttleFlash * 0.6);
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
          delegate: tracker.delegate,
          inferMs: inferEma,
          detectIntervalMs: detectIntervalMs,
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
