import * as THREE from 'three';
import type { Hud } from '../ui/hud';
import { buildWorld, type World } from './world';

/** 单帧允许的最大步长，避免后台切回后物理/动画跳变。 */
const MAX_DELTA = 1 / 20;

/** 镜头远近可调范围（帮助面板滑杆，localStorage: wobble.camZoom）。 */
const CAM_ZOOM_MIN = 0.8;
const CAM_ZOOM_MAX = 1.3;

/** 读取本地记忆的镜头远近（默认 1）。 */
function loadCamZoom(): number {
  try {
    const v = Number(localStorage.getItem('wobble.camZoom'));
    return v >= CAM_ZOOM_MIN && v <= CAM_ZOOM_MAX ? v : 1;
  } catch {
    return 1;
  }
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private hud: Hud;
  readonly world: World;
  private elapsed = 0;

  private fpsAccum = 0;
  private fpsFrames = 0;
  private camZoom = 1;

  constructor(container: HTMLElement, hud: Hud) {
    this.hud = hud;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.world = buildWorld(this.scene);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    // 固定易读镜头：玩家侧后上方，俯视全场（竖屏俯角更大，见 applyFraming）
    this.camZoom = loadCamZoom();
    this.applyFraming(container.clientWidth / container.clientHeight);

    window.addEventListener('resize', this.onResize);
  }

  /** 每帧回调（渲染循环内、render 之前调用），由 main.ts 注入玩法/追踪驱动逻辑。 */
  onFrame: ((dt: number) => void) | null = null;

  /** 当前瞬时渲染 FPS 估计（Debug 面板用） */
  get currentFps(): number {
    return this.fpsFrames > 0 ? this.fpsFrames / Math.max(this.fpsAccum, 1e-6) : 0;
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick);
  }

  private tick = (): void => {
    const dt = Math.min(this.clock.getDelta(), MAX_DELTA);
    this.elapsed += dt;
    this.world.update(dt, this.elapsed);
    this.onFrame?.(dt);
    this.applyCameraShake(dt);
    this.renderer.render(this.scene, this.camera);
    this.trackFps(dt);
  };

  private trackFps(dt: number): void {
    this.fpsAccum += dt;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.5) {
      this.hud.setFps(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  }

  /** 击球瞬间的镜头冲击（轻微，指数衰减） */
  private shake = 0;
  private cameraBase = new THREE.Vector3();

  addShake(magnitude: number): void {
    this.shake = Math.min(0.25, this.shake + magnitude);
  }

  private applyCameraShake(dt: number): void {
    if (this.cameraBase.lengthSq() === 0) this.cameraBase.copy(this.camera.position);
    this.shake *= Math.exp(-9 * dt);
    if (this.shake < 0.001) this.shake = 0;
    this.camera.position.set(
      this.cameraBase.x + (Math.random() - 0.5) * this.shake,
      this.cameraBase.y + (Math.random() - 0.5) * this.shake * 0.6,
      this.cameraBase.z,
    );
  }

  /**
   * 取景（M14-3，iPhone 竖屏实测修正版；M14.5 竖屏俯角加深，近端底线完整入画）：
   * 横屏沿用经典身后视角；竖屏（aspect<1）不拉远（拉远会人物太小、镜头探出地面边缘
   * 露出底色），保持近距离、FOV 略抬、镜头下压——用场地填满高屏，砍掉多余蓝天。
   * ?fov= & ?pitchy= 可在竖屏下调参（真机取景微调用）。
   * camZoom（帮助面板"镜头远近"滑杆，localStorage: wobble.camZoom）以注视点为支点缩放距离。
   */
  private applyFraming(aspect: number): void {
    const portrait = aspect < 1;
    const target = new THREE.Vector3(0, portrait ? -2.4 : 0.6, portrait ? -1.6 : -1.2);
    const pos = new THREE.Vector3(0, 6.2, 11.2);
    this.camera.fov = 50;
    // 真机调参钩子（仅竖屏有效）
    const q = new URLSearchParams(location.search);
    const fov = Number(q.get('fov'));
    const pitchY = Number(q.get('pitchy'));
    if (portrait && fov >= 30 && fov <= 90) {
      this.camera.fov = fov;
    }
    if (portrait && Number.isFinite(pitchY) && q.has('pitchy')) {
      target.y = pitchY;
    }
    // 自定义远近：以注视点为支点缩放相机距离（>1 拉远，<1 拉近）
    pos.sub(target).multiplyScalar(this.camZoom).add(target);
    this.camera.position.copy(pos);
    this.camera.aspect = aspect;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.cameraBase.copy(this.camera.position); // 震屏基准同步，避免旋屏后镜头回弹
  }

  /** 当前镜头远近系数（帮助面板滑杆初值用）。 */
  get cameraZoom(): number {
    return this.camZoom;
  }

  /** 设置镜头远近（CAM_ZOOM_MIN~MAX，默认 1），立即重应用取景并持久化。 */
  setCamZoom(zoom: number): void {
    this.camZoom = Math.min(CAM_ZOOM_MAX, Math.max(CAM_ZOOM_MIN, zoom));
    try {
      localStorage.setItem('wobble.camZoom', String(this.camZoom));
    } catch {
      /* 隐私模式等写不进去时忽略，仅本局生效 */
    }
    this.applyFraming(this.camera.aspect || 1);
  }

  private onResize = (): void => {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.applyFraming(w / h);
    this.renderer.setSize(w, h);
  };
}
