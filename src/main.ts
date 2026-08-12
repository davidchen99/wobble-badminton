import { CameraManager } from './camera/CameraManager';
import { FistDetector } from './camera/FistDetector';
import { GestureDetector, type SwingEvent } from './camera/GestureDetector';
import type { TrackedHand } from './camera/HandTracker';
import { mapToCourt, MOVE_RANGE, MovementTracker } from './camera/MovementTracker';
import { WorkerTracker } from './camera/WorkerTracker';
import { AIController } from './ai/AIController';
import { SoundManager } from './audio/SoundManager';
import { Game } from './game/Game';
import { TRACKS, type TrackId } from './game/levels';
import { RallyManager } from './game/rally';
import { Tutorial, type TutorialStep } from './game/tutorial';
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
/** ?demo 截图/演示模式（1=球场，2=领奖台）：不开摄像头不加载模型，直接展示静态场景 */
const DEMO_MODE = URL_PARAMS.has('demo');

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
  /** 关卡进度（M10/M11 双轨）：track=当前难度轨；levelIndex=当前关；nextLevel=下一局要打的关（赢晋级/输重战/通关归零） */
  let track: TrackId = 'rookie';
  let levelIndex = 0;
  let nextLevel = 0;
  /** 专业轨解锁（M11）：通关新手王冠后解锁，localStorage 持久化，解锁一次永久有效 */
  const PRO_KEY = 'wobble.proUnlocked';
  let proUnlocked = false;
  try {
    proUnlocked = localStorage.getItem(PRO_KEY) === '1';
  } catch {
    /* 隐私模式等读不到就当未解锁 */
  }
  const unlockPro = (): void => {
    proUnlocked = true;
    try {
      localStorage.setItem(PRO_KEY, '1');
    } catch {
      /* 写不进就算了，当局内仍然有效 */
    }
  };
  /** 通关新手轨后待播的专业玩家登场动画 */
  let pendingUnlockIntro = false;
  /** 各轨已通过关数（M13 进度条；会话内有效，专业解锁即代表新手轨已全通） */
  let rookieCleared = proUnlocked ? 3 : 0;
  let proCleared = 0;

  // ---- 新手引导层（M9：黑底全屏 + 大号简图动画 + 步骤圆点 + 实时识别反馈） ----
  const tutorialOverlay = document.getElementById('tutorial-overlay') as HTMLElement;
  const tutorialSketchEl = document.getElementById('tutorial-canvas') as HTMLCanvasElement;
  const tutorialPromptEl = document.getElementById('tutorial-prompt') as HTMLElement;
  const tutorialDots = Array.from(document.querySelectorAll('#tutorial-dots span'));
  const TUTORIAL_STEP_INDEX: Record<TutorialStep, number> = {
    showHand: 0,
    grip: 1,
    doubleGrip: 2,
    ready: 3,
    done: 3,
  };
  let stopSketch: (() => void) | null = null;
  const setSketch = (kind: SketchKind | null): void => {
    stopSketch?.();
    stopSketch = null;
    if (kind) stopSketch = startSketch(tutorialSketchEl, kind, 2); // 大号简图
  };
  const showTutorialStep = (): void => {
    hud.clearMessage();
    tutorialOverlay.hidden = false;
    tutorialPromptEl.textContent = tutorial.prompt;
    const idx = TUTORIAL_STEP_INDEX[tutorial.step];
    tutorialDots.forEach((d, i) => d.classList.toggle('active', i <= idx));
    setSketch(tutorial.sketch);
  };
  const hideTutorial = (): void => {
    tutorialOverlay.hidden = true;
    setSketch(null);
  };

  // ---- 帮助层（含"重新进入新手引导"入口） ----
  const enterTutorial = (): void => {
    controlMode = 'bare'; // 引导教的是空手模式
    hud.setMode(controlMode);
    tutorial.reset();
    flow = 'tutorial';
    showTutorialStep();
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
    // M13：观众欢呼（玩家得分全场嗨，AI 得分小骚动）
    const heat = scorer === 'player' ? 1 : 0.35;
    game.world.crowd.cheer(heat);
    sound.cheer(heat);
  };
  /** 本场次是否已拿过首胜奖杯（M9：仅首次获胜有领奖时刻，刷新页面重置） */
  let firstWinDone = false;
  rally.onMatchEnd = (winner, scores) => {
    flow = 'matchEnd';
    const win = winner === 'player';
    const scoreText = `${scores.player} : ${scores.ai}`;
    const isFinalLevel = levelIndex >= TRACKS[track].levels.length - 1;
    if (win && isFinalLevel && track === 'rookie') {
      // 通关新手轨 → 领奖台冠军；首次通关解锁专业轨，R 后播登场动画
      nextLevel = 0;
      rookieCleared = 3;
      const firstUnlock = !proUnlocked;
      unlockPro();
      if (firstUnlock) {
        pendingUnlockIntro = true;
        showChampion(`🏆 新手轨总冠军！  ${scoreText}\n按 R 看看谁来了……`);
      } else {
        showChampion(`🏆 总冠军！  ${scoreText}\n按 R 重新挑战 · C 换赛制`);
      }
    } else if (win && isFinalLevel) {
      // 通关专业轨（打赢魔王）
      nextLevel = 0;
      proCleared = 3;
      showChampion(`👑 连魔王都被你打败了，真正的传奇！  ${scoreText}\n按 R 重新挑战 · C 换赛制`);
    } else if (win) {
      nextLevel = levelIndex + 1;
      // M13 进度条：本关标记为已通关
      if (track === 'rookie') rookieCleared = Math.max(rookieCleared, levelIndex + 1);
      else proCleared = Math.max(proCleared, levelIndex + 1);
      if (!firstWinDone) {
        // 首次获胜：奖杯落在玩家身前，悬浮转动的领奖时刻
        firstWinDone = true;
        const playerPos = game.world.player.group.position;
        const trophy = game.world.trophy;
        trophy.position.set(playerPos.x, 0, playerPos.z - 1.3);
        trophy.visible = true;
        hud.showMessage(
          `首次获胜！🏆 这是你的奖杯！  ${scoreText}\n过关！下一关【${TRACKS[track].levels[nextLevel].name}】按 R 开战 · C 换赛制`,
        );
      } else {
        hud.showMessage(
          `过关！  ${scoreText}\n下一关【${TRACKS[track].levels[nextLevel].name}】按 R 开战 · C 换赛制`,
        );
      }
    } else {
      nextLevel = levelIndex; // 输球重战本关
      hud.showMessage(
        `AI 获胜  ${scoreText}\n按 R 再战【${TRACKS[track].levels[levelIndex].name}】 · C 换赛制`,
      );
    }
    game.world.player.setMood(win ? 'celebrate' : 'defeat');
    game.world.ai.setMood(win ? 'defeat' : 'celebrate');
    hud.setProgress({ track, levelIndex, rookieCleared, proCleared, proUnlocked }); // M13：赢关立刻点亮
  };
  rally.onContact = (kind) => {
    if (flow !== 'playing') return;
    if (kind === 'net') sound.net();
    else sound.bounce();
  };

  // ---- 赛制选择层（M9：6 分快局默认 / 21 分标准赛右上角入口；M11：专业轨解锁后有轨道切换） ----
  const formatOverlay = document.getElementById('format-overlay') as HTMLElement;
  const formatQuick = document.getElementById('format-quick') as HTMLButtonElement;
  const formatStandard = document.getElementById('format-standard') as HTMLButtonElement;
  const formatTrack = document.getElementById('format-track') as HTMLButtonElement;
  const unlockOverlay = document.getElementById('unlock-overlay') as HTMLElement;
  /** 当前赛制（获胜分数线）：R 重开保持，终局可按 C 回选择层更换 */
  let format: 6 | 21 = 6;

  /** 场地复位（M10）：藏起领奖台/NPC/奖杯，角色回站位、朝向复位 */
  const resetArena = (): void => {
    const { player, ai, npc, podium, trophy } = game.world;
    podium.visible = false;
    npc.group.visible = false;
    trophy.visible = false;
    player.group.position.copy(PLAYER_HOME);
    player.group.rotation.y = Math.PI;
    ai.group.position.copy(AI_HOME);
    ai.group.rotation.y = 0;
    rally.updateHome('player', { x: PLAYER_HOME.x, y: 0, z: PLAYER_HOME.z });
    rally.updateHome('ai', { x: AI_HOME.x, y: 0, z: AI_HOME.z });
  };

  /** 总冠军领奖台（M10-2）：1/2/3 名次台，玩家登顶捧杯，黑帽老朋友第三 */
  const showChampion = (message: string): void => {
    const { player, ai, npc, podium, trophy } = game.world;
    npc.setHat('cap', TRACKS.rookie.levels[0].hatColor);
    npc.group.visible = true;
    podium.visible = true;
    // 面向镜头站上台（名次台固定在 z=1.5，见 world.ts）
    player.group.position.set(0, 0.6, 1.5);
    player.group.rotation.y = 0;
    ai.group.position.set(-0.9, 0.4, 1.5);
    ai.group.rotation.y = 0;
    npc.group.position.set(0.9, 0.25, 1.5);
    npc.group.rotation.y = 0;
    npc.setMood('celebrate');
    trophy.position.set(0, 0, 0.2); // 台前悬浮
    trophy.visible = true;
    hud.showMessage(message);
  };

  const refreshTrackButton = (): void => {
    formatTrack.hidden = !proUnlocked;
    formatTrack.textContent = `轨道：${TRACKS[track].name}（点击切换）`;
  };

  const showFormatMenu = (): void => {
    flow = 'menu';
    game.world.player.setMood('idle');
    game.world.ai.setMood('idle');
    resetArena();
    refreshTrackButton();
    hud.clearMessage();
    formatOverlay.hidden = false;
  };

  /** 专业玩家登场小动画（M11）：紫色荧光对手在球场就位 + 呼吸灯标题层 */
  const showUnlockIntro = (): void => {
    flow = 'menu';
    resetArena();
    game.world.player.setMood('idle');
    game.world.ai.setMood('idle');
    applyLevel('pro', 0); // 紫影在球场登场（层后背景可见）
    hud.clearMessage();
    formatOverlay.hidden = true;
    unlockOverlay.hidden = false;
  };
  const hideUnlockIntro = (): void => {
    unlockOverlay.hidden = true;
    showFormatMenu(); // 专业轨入口已就绪
  };

  /** 应用难度轨与关卡：难度参数 + 对手造型（帽子/肤色/荧光）+ HUD 标识 */
  const applyLevel = (t: TrackId, i: number): void => {
    track = t;
    levelIndex = i;
    const lv = TRACKS[t].levels[i];
    rally.flightTime = lv.flightTime;
    rally.targetSpread = lv.returnSpread;
    rally.smashFlightTime = lv.smashFlight;
    aiController.params.missRate = lv.missRate;
    aiController.params.reactionMs = lv.reactionMs;
    aiController.params.smashRate = lv.smashRate;
    game.world.ai.setHat(lv.hat, lv.hatColor);
    game.world.ai.setTint(lv.bodyColor ?? 0x4fc3f7, lv.glow ?? 0);
    game.world.crowd.setLevel(t, i); // M13：观众规模即进度条
    hud.setLevel(TRACKS[t].name, i + 1, lv.name);
    hud.setProgress({ track: t, levelIndex: i, rookieCleared, proCleared, proUnlocked });
  };
  applyLevel('rookie', 0); // 初始新手轨第一关（菜单背景里就能看到黑帽对手）

  // ---- 开始 / 暂停 / 重开 ----
  const startGame = (nextFormat: 6 | 21 = format): void => {
    format = nextFormat;
    sound.ensure(); // AudioContext 必须在用户手势里创建
    applyLevel(track, nextLevel);
    rally.match.winScore = format;
    rally.reset();
    hud.setScore(0, 0);
    game.world.player.setMood('idle');
    game.world.ai.setMood('idle');
    resetArena();
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
  formatTrack.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!proUnlocked) return;
    const next: TrackId = track === 'rookie' ? 'pro' : 'rookie';
    nextLevel = 0;
    applyLevel(next, 0); // 菜单背景同步换对手造型
    refreshTrackButton();
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
      if (flow === 'menu') {
        if (!unlockOverlay.hidden) hideUnlockIntro();
        else startGame();
      } else if (flow === 'tutorial') {
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
      if (flow === 'matchEnd' && pendingUnlockIntro) {
        // 先看专业玩家登场动画，再回赛制选择
        pendingUnlockIntro = false;
        showUnlockIntro();
      } else {
        startGame(); // 重开保持当前赛制与关卡进度（赢球已晋级 / 输球重战）
      }
    } else if (e.code === 'KeyC' && flow === 'matchEnd') {
      pendingUnlockIntro = false; // 跳过登场动画直接去选赛制（专业轨已解锁）
      showFormatMenu();
    }
  });
  window.addEventListener('pointerdown', () => {
    sound.ensure();
    if (flow === 'menu') {
      if (!unlockOverlay.hidden) hideUnlockIntro();
      else startGame();
    } else if (flow === 'tutorial') tutorial.skip();
  });
  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
  });

  // ---- 摄像头与追踪（demo 模式整段跳过） ----
  let camera: CameraManager | null = null;
  let tracker: WorkerTracker | null = null;
  if (DEMO_MODE) {
    hud.clearMessage();
    document.getElementById('cam-preview')?.style.setProperty('display', 'none');
    if (URL_PARAMS.get('demo') === '2') {
      showChampion(''); // 领奖台截图场景
      hud.clearMessage(); // 只要画面，不要文字框
    }
  } else {
    camera = new CameraManager();
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
    try {
      tracker = await WorkerTracker.create();
    } catch (err) {
      hud.showError(err instanceof Error ? err.message : String(err));
      return;
    }
    console.info(`[tracking] delegate = ${tracker.delegate}`);

    tutorial.onStepChange = (step) => {
      if (step === 'done') {
        hideTutorial();
        showFormatMenu(); // 引导完成 → 赛制选择（默认 6 分快局）
      } else {
        showTutorialStep();
      }
    };
    if (TUTORIAL_ENABLED) {
      enterTutorial();
    } else {
      showFormatMenu();
    }

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
          // M13：引导连握步用教学自己的 1.2s 窗口，不再依赖检测器的 double 标记
          tutorial.onGrip(grip.t);
        }
        if (grip && flow === 'playing') {
          if (grip.double) {
            // 连握扣球：给刚打出去的球补刀 + 角色跳起扣杀（M12：不再晃镜头，跳起本身就是反馈）
            if (rally.smash()) {
              playerController.jumpSmash();
              sound.hit(3.5);
              sound.cheer(0.8); // M13：扣杀成功观众欢呼
              game.world.crowd.cheer(0.8);
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

  game.onFrame = (dt) => {
    const now = performance.now();

    // 投递推理帧：频率自适应，Worker 忙时自动丢帧，渲染永不被推理阻塞
    if (camera?.ready && tracker && now - lastDetectAt >= detectIntervalMs) {
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
          delegate: tracker?.delegate ?? null,
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
