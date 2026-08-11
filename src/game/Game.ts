import * as THREE from 'three';
import type { Hud } from '../ui/hud';
import { buildWorld, type World } from './world';

/** 单帧允许的最大步长，避免后台切回后物理/动画跳变。 */
const MAX_DELTA = 1 / 20;

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
    // 固定易读镜头：玩家侧后上方，俯视全场
    this.camera.position.set(0, 6.2, 11.2);
    this.camera.lookAt(0, 0.6, -1.2);

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

  private onResize = (): void => {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
