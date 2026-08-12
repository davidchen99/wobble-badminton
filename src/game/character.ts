import * as THREE from 'three';

export interface CharacterOptions {
  /** 身体主色 */
  color: number;
  /** 脸部朝向：模型本地前方为 +z */
  facing?: number;
}

/**
 * 程序化呆萌低模角色：圆头、短粗躯干、圆润四肢、夸张球拍。
 * 不用骨骼动画，用层级 Transform + spring/damping 做"软"感（TECH_SPEC）。
 *
 * 结构（group 原点在脚底中心，本地前方 +z）：
 *   group
 *   └─ squashG（整体 squash/lean，惯性表现层）
 *      ├─ bodyG（呼吸浮动）
 *      │   ├─ body / head(+eyes) / armL
 *      │   └─ armR ─ racket
 */
export class WobbleCharacter {
  readonly group = new THREE.Group();
  /** squash/lean 表现层（PlayerController 驱动），与 idle 呼吸层分离 */
  readonly squashG = new THREE.Group();
  private bodyG = new THREE.Group();
  private headG = new THREE.Group();
  private armL = new THREE.Group();
  /** 持拍手（右臂），M3 挥拍动画旋转它 */
  readonly armR = new THREE.Group();

  private idlePhase = Math.random() * Math.PI * 2;
  private mood: 'idle' | 'celebrate' | 'defeat' = 'idle';
  /** 待机姿态基准值（setMood 复位用） */
  private static readonly REST = { armLz: 0.35, armRz: -0.35 };

  /** 结算情绪：celebrate 乱跳庆祝 / defeat 坐地发呆 / idle 恢复待机 */
  setMood(mood: 'idle' | 'celebrate' | 'defeat'): void {
    this.mood = mood;
    if (mood === 'idle') {
      this.squashG.scale.set(1, 1, 1);
      this.squashG.rotation.set(0, 0, 0);
      this.squashG.position.set(0, 0, 0); // 跳起扣杀（M9）的演出位移也一并复位
      this.headG.rotation.set(0, 0, 0);
      this.armL.rotation.set(0, 0, WobbleCharacter.REST.armLz);
      this.armR.rotation.set(-0.2, 0, WobbleCharacter.REST.armRz);
      this.bodyG.position.y = 0;
    }
  }

  constructor(options: CharacterOptions) {
    const color = options.color;
    const skin = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: 0x263238 });

    // 腿（两截短柱）
    const legGeo = new THREE.CapsuleGeometry(0.075, 0.12, 3, 8);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, skin);
      leg.position.set(0.11 * side, 0.13, 0);
      this.bodyG.add(leg);
    }

    // 身体（矮胖胶囊）
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.3, 4, 10), skin);
    body.position.y = 0.52;
    this.bodyG.add(body);

    // 头（大圆头，呆萌比例）
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
    this.headG.add(head);
    // 极简眼睛
    const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, dark);
      eye.position.set(0.09 * side, 0.04, 0.24);
      this.headG.add(eye);
    }
    this.headG.position.y = 1.06;
    this.bodyG.add(this.headG);

    // 左臂（自然下垂微张）
    const armGeo = new THREE.CapsuleGeometry(0.065, 0.24, 3, 8);
    const armLMesh = new THREE.Mesh(armGeo, skin);
    armLMesh.position.y = -0.16;
    this.armL.add(armLMesh);
    this.armL.position.set(-0.32, 0.72, 0);
    this.armL.rotation.z = 0.35;
    this.bodyG.add(this.armL);

    // 右臂 + 夸张球拍
    const armRMesh = new THREE.Mesh(armGeo, skin);
    armRMesh.position.y = -0.16;
    this.armR.add(armRMesh);
    const racket = buildRacket();
    racket.position.y = -0.34;
    this.armR.add(racket);
    this.armR.position.set(0.32, 0.72, 0);
    this.armR.rotation.z = -0.35;
    this.bodyG.add(this.armR);

    this.squashG.add(this.bodyG);
    this.group.add(this.squashG);
    this.group.rotation.y = options.facing ?? 0;
  }

  /** 待机/庆祝/失败动作（喜剧感但不能抢输入响应，幅度小） */
  updateIdle(time: number): void {
    const t = time + this.idlePhase;
    if (this.mood === 'celebrate') {
      // 胜利乱跳 + 双臂举起
      this.bodyG.position.y = Math.abs(Math.sin(t * 6)) * 0.32;
      this.bodyG.rotation.z = Math.sin(t * 3) * 0.08;
      this.armR.rotation.set(-2.5, 0, -0.4);
      this.armL.rotation.set(-2.5, 0, 0.4);
      this.headG.rotation.z = Math.sin(t * 6) * 0.08;
      return;
    }
    if (this.mood === 'defeat') {
      // 失败坐地发呆：下沉压扁 + 头低垂 + 双臂垂落
      this.bodyG.position.y = -0.18;
      this.squashG.scale.y = 0.78;
      this.headG.rotation.x = 0.35;
      this.armR.rotation.set(0.15, 0, -0.15);
      this.armL.rotation.set(0.15, 0, 0.15);
      this.bodyG.rotation.z = Math.sin(t * 0.9) * 0.02;
      return;
    }
    this.bodyG.position.y = Math.sin(t * 2.1) * 0.02;
    this.bodyG.rotation.z = Math.sin(t * 1.3) * 0.03;
    this.headG.rotation.z = Math.sin(t * 1.3 + 0.6) * 0.05;
  }
}

/** 夸张比例的玩具球拍：拍面大、拍柄粗 */
function buildRacket(): THREE.Group {
  const racket = new THREE.Group();
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63, flatShading: true });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xef5350, flatShading: true });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 8), handleMat);
  handle.position.y = -0.15;
  racket.add(handle);

  // 椭圆拍面
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 12), headMat);
  head.scale.set(1, 1, 1.25);
  head.rotation.x = Math.PI / 2;
  head.position.y = -0.42;
  racket.add(head);

  return racket;
}
