import { CameraManager } from './camera/CameraManager';
import { FistDetector } from './camera/FistDetector';
import { GestureDetector, type SwingEvent } from './camera/GestureDetector';
import type { TrackedHand } from './camera/HandTracker';
import { mapToCourt, MOVE_RANGE, MovementTracker } from './camera/MovementTracker';
import { WorkerTracker } from './camera/WorkerTracker';
import { AIController } from './ai/AIController';
import { SoundManager } from './audio/SoundManager';
import { Game } from './game/Game';
import { RallyManager } from './game/rally';
import { Tutorial } from './game/tutorial';
import { AI_HOME, PLAYER_HOME } from './game/world';
import { PlayerController } from './player/PlayerController';
import { DebugPanel } from './ui/DebugPanel';
import { HelpPanel } from './ui/HelpPanel';
import { Hud } from './ui/hud';
import { startSketch, type SketchKind } from './ui/sketches';

/** 推理间隔下限（毫秒）：追踪不必每渲染帧执行，与渲染解耦（TECH_SPEC） */
const DETECT_INTERVAL_MS = 33;
const URL_PARAMS = new URLSearchParams(location.search);
/** 调试面板默认隐藏，按 ` 呼出；?debug=1 默认展开（生产模式） */
const DEBUG_DEFAULT_OPEN = URL_PARAMS.get('debug') === '1';
/** 新手引导默认开启，?tutorial=0 跳过（老玩家/调试） */
const TUTORIAL_ENABLED = URL_PARAMS.get('tutorial') !== '0';

type Flow = 'menu' | 'tutorial' | 'playing' | 'paused' | 'matchEnd';

async function bootstrap(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('找不到 #app 容器');

  const hud = new Hud();
  const game = new Game(app, hud);
  game.start();

  const gesture = new GestureDetector();
  const fist = new FistDetector();
  const debug = new DebugPanel(gesture);
  if (DEBUG_DEFAULT_OPEN) debug.toggle();
  // 手部慢速位移 = 角色移动意图（gate 取挥拍阈值的 60%）
  const movement = new MovementTracker(gesture.params.swingSpeedThreshold * 0.6);
  const sound = new SoundManager();
  const playerController = new PlayerController(game.world.player);
  const rally = new RallyManager(game.world.shuttle, {
    player: { x: PLAYER_HOME.x, y: PLAYER_HOME.y, z: PLAYER_HOME.z },
    ai: { x: AI_HOME.x, y: AI_HOME.y, z: AI_HOME.z },
  });
  const aiController = new AIController(game.world.ai, rally);
  debug.addSliders([
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
  /** 操控模式：bare=空手（握拳/手位），keyboard=键盘+持物（WASD/快挥） */
  let controlMode: 'bare' | 'keyboard' = 'bare';
  const keysDown = new Set<string>();

  // ---- 新手引导的简图动画管理 ----
  const tutorialSketchEl = document.getElementById('tutorial-sketch') as HTMLCanvasElement;
  let stopSketch: (() => void) | null = null;
  const setSketch = (kind: SketchKind | null): void => {
    stopSketch?.();
    stopSketch = null;
    tutorialSketchEl.hidden = kind === null;
    if (kind) stopSketch = startSketch(tutorialSketchEl, kind);
  };

  // ---- 帮助层（含"重新进入新手引导"入口） ----
  const enterTutorial = (): void => {
    controlMode = 'bare'; // 引导教的是空手模式
    hud.setMode(controlMode);
    tutorial.reset();
    flow = 'tutorial';
    setSketch(tutorial.sketch);
    hud.showMessage(`${tutorial.prompt}\n\n（空格 跳过引导）`);
  };
  const help = new HelpPanel(enterTutorial);

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
  rally.onMatchEnd = (winner, scores) => {
    flow = 'matchEnd';
    const win = winner === 'player';
    hud.showMessage(
      `${win ? '你赢了！' : 'AI 获胜'}  ${scores.player} : ${scores.ai}\n按 R 再来一局 · C 换赛制`,
    );
    game.world.player.setMood(win ? 'celebrate' : 'defeat');
    game.world.ai.setMood(win ? 'defeat' : 'celebrate');
  };
  rally.onContact = (kind) => {
    if (flow !== 'playing') return;
    if (kind === 'net') sound.net();
    else sound.bounce();
  };

  // ---- 赛制选择层（M9：6 分快局默认 / 21 分标准赛右上角入口） ----
  const formatOverlay = document.getElementById('format-overlay') as HTMLElement;
  const formatQuick = document.getElementById('format-quick') as HTMLButtonElement;
  const formatStandard = document.getElementById('format-standard') as HTMLButtonElement;
  /** 当前赛制（获胜分数线）：R 重开保持，终局可按 C 回选择层更换 */
  let format: 6 | 21 = 6;
  const showFormatMenu = (): void => {
    flow = 'menu';
    game.world.player.setMood('idle');
    game.world.ai.setMood('idle');
    hud.clearMessage();
    formatOverlay.hidden = false;
  };

  // ---- 开始 / 暂停 / 重开 ----
  const startGame = (nextFormat: 6 | 21 = format): void => {
    format = nextFormat;
    sound.ensure(); // AudioContext 必须在用户手势里创建
    rally.match.winScore = format;
    rally.reset();
    hud.setScore(0, 0);
    game.world.player.setMood('idle');
    game.world.ai.setMood('idle');
    formatOverlay.hidden = true;
    flow = 'playing';
    hud.clearMessage();
  };
  formatQuick.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame(6);
  });
  formatStandard.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame(21);
  });
  window.addEventListener('keydown', (e) => {
    sound.ensure(); // 任何首次按键都尝试解锁音频（引导自动开球路径）
    keysDown.add(e.code);
    if (e.code === 'Backquote') {
      debug.toggle();
      return;
    }
    if (e.code === 'KeyH' || e.code === 'F1') {
      e.preventDefault();
      help.toggle();
      return;
    }
    if (e.code === 'KeyM') {
      controlMode = controlMode === 'bare' ? 'keyboard' : 'bare';
      hud.setMode(controlMode);
      movement.reset(); // 切回空手模式时重新校准手大小基准
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (flow === 'menu') startGame();
      else if (flow === 'tutorial') {
        tutorial.skip(); // onStepChange('done') 会触发 showFormatMenu
      } else if (flow === 'playing') {
        flow = 'paused';
        hud.showMessage('已暂停\n空格 继续 · R 重开');
      } else if (flow === 'paused') {
        flow = 'playing';
        hud.clearMessage();
      }
      // matchEnd 下空格无效，按 R 开新局
    } else if (e.code === 'KeyR' && flow !== 'menu' && flow !== 'tutorial') {
      startGame(); // 重开保持当前赛制
    } else if (e.code === 'KeyC' && flow === 'matchEnd') {
      showFormatMenu(); // 终局后可换赛制
    }
  });
  window.addEventListener('pointerdown', () => {
    sound.ensure();
    if (flow === 'menu') startGame();
    else if (flow === 'tutorial') tutorial.skip();
  });
  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
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
  // 点击预览切换大画幅；阻止冒泡避免触发"跳过引导/开始"的点击语义
  preview?.addEventListener('click', (e) => {
    e.stopPropagation();
    preview.classList.toggle('large');
  });

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
    if (step === 'done') {
      setSketch(null);
      showFormatMenu(); // 引导完成 → 赛制选择（默认 6 分快局）
    } else {
      setSketch(tutorial.sketch);
      hud.showMessage(`${tutorial.prompt}\n\n（空格 跳过引导）`);
    }
  };
  if (TUTORIAL_ENABLED) {
    enterTutorial();
  } else {
    showFormatMenu();
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
        debug.flashSwing();
        // 持物模式：快速挥动 = 击打；空手模式快挥仅作演示/调试
        if (flow === 'playing' && controlMode === 'keyboard') {
          playerController.swing({ direction: 'right', speed: swing.speed, time: swing.time });
        }
        if (flow === 'tutorial') {
          // 引导中挥动只作角色演示（教学用握拳判定，见下方 grip）
          playerController.swing(swing);
        }
      }

      // 握拳 = 击打（仅空手模式；持物时手一直握着，握拳检测无意义）
      const grip = controlMode === 'bare' ? fist.update(hand.landmarks, t / 1000) : null;
      if (grip && flow === 'tutorial') {
        tutorial.onGrip(grip.double);
      }
      if (grip && flow === 'playing') {
        if (grip.double) {
          // 连握扣球：给刚打出去的球补刀
          if (rally.smash()) {
            sound.hit(3.5);
            game.addShake(0.16);
            shuttleFlash = 1.6;
          }
        } else {
          // 正板直打：单一标准挥拍动作，onStrike 触球点做窗口判定
          playerController.swing({ direction: 'right', speed: 2.2, time: grip.t });
        }
      }
    } else {
      gesture.onLost();
      fist.update(null, t / 1000);
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

      // 身体移动控制角色：两种模式二选一
      const pp0 = game.world.player.group.position;
      if (controlMode === 'keyboard') {
        // WASD：W 前（朝网）S 后 A 左 D 右，限速平滑
        const mx = (keysDown.has('KeyD') ? 1 : 0) - (keysDown.has('KeyA') ? 1 : 0);
        const mz = (keysDown.has('KeyS') ? 1 : 0) - (keysDown.has('KeyW') ? 1 : 0);
        if (mx !== 0 || mz !== 0) {
          const len = Math.hypot(mx, mz);
          pp0.x += (mx / len) * MOVE_RANGE.speed * dt;
          pp0.z += (mz / len) * MOVE_RANGE.speed * dt;
          pp0.x = Math.max(PLAYER_HOME.x - MOVE_RANGE.x, Math.min(PLAYER_HOME.x + MOVE_RANGE.x, pp0.x));
          pp0.z = Math.max(PLAYER_HOME.z - MOVE_RANGE.z, Math.min(PLAYER_HOME.z + MOVE_RANGE.z, pp0.z));
          rally.updateHome('player', { x: pp0.x, y: 0, z: pp0.z });
        }
      } else {
        // 空手模式：慢动手部位移（左右）+ 手大小变化（前后）→ 场地目标
        const speed = Math.hypot(gesture.velocity.x, gesture.velocity.y);
        movement.update(
          lastHand
            ? { x: lastHand.palm.x, y: lastHand.palm.y, size: handSize(lastHand) }
            : null,
          speed,
          dt,
          fist.isFist,
        );
        const target = mapToCourt(
          movement.pos,
          { x: PLAYER_HOME.x, z: PLAYER_HOME.z },
          movement.sizeRatio,
        );
        const dx = target.x - pp0.x;
        const dz = target.z - pp0.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-4) {
          const step = Math.min(dist, MOVE_RANGE.speed * dt);
          pp0.x += (dx / dist) * step;
          pp0.z += (dz / dist) * step;
          // 击球窗口与 AI 落点选择跟随玩家站位
          rally.updateHome('player', { x: pp0.x, y: 0, z: pp0.z });
        }
      }
    } else if (flow === 'tutorial') {
      // 引导中角色响应挥拍演示；同时喂移动模块完成手大小基准校准（不应用输出）
      playerController.update(dt);
      tutorial.update(dt, lastHand !== null);
      const speed = Math.hypot(gesture.velocity.x, gesture.velocity.y);
      movement.update(
        lastHand
          ? { x: lastHand.palm.x, y: lastHand.palm.y, size: handSize(lastHand) }
          : null,
        speed,
        dt,
        fist.isFist,
      );
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

    // 骨架叠加始终绘制（识别反馈是引导的一部分）；数据面板仅展开时更新
    debug.drawOverlay(lastHand);
    if (debug.visible) {
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

/** 手大小代理：手腕(0)到中指根(9)的画面距离，用于前后移动映射 */
function handSize(hand: TrackedHand): number {
  const a = hand.landmarks[0];
  const b = hand.landmarks[9];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
