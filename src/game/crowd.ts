import * as THREE from 'three';
import type { TrackId } from './levels';

/**
 * 递进式观众系统（M13 初版 / M13.5 分边阵营 + 看台长凳）：
 * 观众数量本身就是"不用 UI 的进度条"。
 * 新手轨：L1 两边各 2 人 → L2 各 2 排×4（起配长凳）→ L3 满场（各 3 排×6 台阶看台）+ 两侧横幅；
 * 专业轨：L1/L2 保持满场；L3 魔王战彩蛋 = 三面环绕体育场（对面三层看台）+ 多横幅。
 *
 * 阵营（M13.5）：左侧观众 = 玩家粉丝，右侧 = 对手粉丝，谁得分哪边跳；
 * 魔王战对面看台为中立观众，两边得分都欢呼。
 *
 * 性能：观众 = 身体/头两个 InstancedMesh，长凳一个 InstancedMesh（共 3 次 draw call），
 * 横幅 ≤3 块平面；配色偏暗、动作幅度小，不抢球戏。
 */

/** 实例容量上限（魔王战三面环绕也不超过） */
const MAX = 220;
/** 长凳容量上限 */
const MAX_BENCH = 40;

/** 偏暗的衣服配色（不抢球戏） */
const BODY_COLORS = [0x5c6bc0, 0x8d6e63, 0x78909c, 0x7e57c2, 0x4db6ac, 0x9e9d24, 0x6d4c41, 0x546e7a];
/** 肤色 */
const HEAD_COLORS = [0xffccbc, 0xe8b39a, 0xc98d6b, 0xa06a42];

/** 粉丝阵营：谁得分哪边跳；neutral = 魔王战对面看台，两边都跳 */
type Fan = 'player' | 'ai' | 'neutral';

interface Seat {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
  fan: Fan;
}

interface Bench {
  x: number;
  z: number;
  /** 台面高度（观众站台面高度 = 台高） */
  h: number;
  /** 沿 x / z 方向的长度 */
  w: number;
  d: number;
}

/** 一块横幅：红底白字 CanvasTexture 平面 */
function buildBanner(text: string, width = 3.4): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c62828';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#ffeb3b';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  return mesh;
}

export class Crowd {
  readonly group = new THREE.Group();

  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private benches: THREE.InstancedMesh;
  private seats: Seat[] = [];
  private banners: THREE.Mesh[] = [];
  private dummy = new THREE.Object3D();

  /** 分边欢呼状态（M13.5）：计时 >0 时该侧观众集体跳 */
  private cheerState: Record<'player' | 'ai', { t: number; amp: number }> = {
    player: { t: 0, amp: 0 },
    ai: { t: 0, amp: 0 },
  };

  constructor() {
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.34, 3, 8);
    const headGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.bodies = new THREE.InstancedMesh(bodyGeo, mat.clone(), MAX);
    this.heads = new THREE.InstancedMesh(headGeo, mat.clone(), MAX);
    this.benches = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x6d4c41, flatShading: true }),
      MAX_BENCH,
    );
    this.bodies.count = 0;
    this.heads.count = 0;
    this.benches.count = 0;
    this.group.add(this.bodies, this.heads, this.benches);
  }

  /** 按难度轨 + 关卡布置观众、长凳与横幅 */
  setLevel(track: TrackId, levelIndex: number): void {
    const seats: Seat[] = [];
    const benches: Bench[] = [];
    /**
     * 两侧看台：rows 排 × perRow 人/边，逐排垫高；第 2 排起配长凳/台阶台。
     * 左（x<0）= 玩家粉丝，右 = 对手粉丝。
     */
    const sideSection = (rows: number, perRow: number) => {
      for (const side of [-1, 1]) {
        const fan: Fan = side < 0 ? 'player' : 'ai';
        for (let r = 0; r < rows; r++) {
          const rowY = r * 0.3;
          // 第 2 排（r>=1）起脚下有长凳；多排时叠成台阶看台
          if (r >= 1) {
            benches.push({
              x: side * (3.6 + r * 0.75),
              z: 0,
              h: rowY,
              w: 0.85,
              d: 6.6,
            });
          }
          for (let c = 0; c < perRow; c++) {
            const zSpan = perRow === 1 ? 0 : 5.6;
            seats.push({
              x: side * (3.6 + r * 0.75 + rand(0.12)),
              y: rowY,
              z: perRow === 1 ? rand(2) : -zSpan / 2 + (zSpan / (perRow - 1)) * c + rand(0.2),
              scale: 0.85 + Math.random() * 0.3,
              phase: Math.random() * Math.PI * 2,
              fan,
            });
          }
        }
      }
    };
    /** 魔王彩蛋：对面三层阶梯看台（中立观众） */
    const farStands = (tiers: number, perTier: number) => {
      for (let t = 0; t < tiers; t++) {
        const tierY = 0.4 + t * 0.6;
        benches.push({ x: 0, z: -(8.0 + t * 0.85), h: tierY, w: 10.2, d: 0.95 });
        for (let c = 0; c < perTier; c++) {
          seats.push({
            x: -4.6 + (9.2 / (perTier - 1)) * c + rand(0.15),
            y: tierY,
            z: -(8.0 + t * 0.85) + rand(0.1),
            scale: 0.85 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2,
            fan: 'neutral',
          });
        }
      }
    };

    let bannerTexts: string[] = [];
    if (track === 'rookie' && levelIndex === 0) {
      sideSection(1, 2); // 稀稀拉拉：两边各 2 人
    } else if (track === 'rookie' && levelIndex === 1) {
      sideSection(2, 4);
    } else if (track === 'rookie' && levelIndex === 2) {
      sideSection(3, 6);
      bannerTexts = ['加油！', '加油！'];
    } else if (track === 'pro' && levelIndex < 2) {
      sideSection(3, 6); // 专业轨保持满场
      bannerTexts = ['加油！', '加油！'];
    } else {
      // 魔王战：三面环绕体育场
      sideSection(4, 8);
      farStands(3, 9);
      bannerTexts = ['加油！', '加油！', '决战魔王！'];
    }

    this.seats = seats;
    this.bodies.count = seats.length;
    this.heads.count = seats.length;
    for (let i = 0; i < seats.length; i++) {
      this.bodies.setColorAt(i, new THREE.Color(pick(BODY_COLORS)));
      this.heads.setColorAt(i, new THREE.Color(pick(HEAD_COLORS)));
    }
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;

    // 长凳/台阶台：静态实例，一次写入
    this.benches.count = Math.min(benches.length, MAX_BENCH);
    for (let i = 0; i < this.benches.count; i++) {
      const b = benches[i];
      this.dummy.position.set(b.x, b.h / 2, b.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(b.w, b.h, b.d);
      this.dummy.updateMatrix();
      this.benches.setMatrixAt(i, this.dummy.matrix);
    }
    this.benches.instanceMatrix.needsUpdate = true;

    // 横幅：两侧高处各一块，魔王战在对面看台顶再加一块
    for (const b of this.banners) this.group.remove(b);
    this.banners = [];
    bannerTexts.forEach((text, i) => {
      const banner = buildBanner(text);
      if (i === 0) {
        banner.position.set(-5.4, 2.1, 0);
        banner.rotation.y = 0.4;
      } else if (i === 1) {
        banner.position.set(5.4, 2.1, 0);
        banner.rotation.y = -0.4;
      } else {
        banner.position.set(0, 3.1, -9.9);
      }
      this.banners.push(banner);
      this.group.add(banner);
    });

    this.writeMatrices(0);
  }

  /**
   * 得分/扣杀时欢呼跳跃（M13.5 分边）：side=player 左侧跳、ai 右侧跳、all 全场。
   * strength 0~1（玩家得分更嗨）。
   */
  cheer(strength = 1, side: 'player' | 'ai' | 'all' = 'all'): void {
    const amp = 0.12 + 0.22 * Math.min(1, Math.max(0, strength));
    if (side === 'player' || side === 'all') this.cheerState.player = { t: 1.3, amp };
    if (side === 'ai' || side === 'all') this.cheerState.ai = { t: 1.3, amp };
  }

  update(dt: number, time: number): void {
    if (this.seats.length === 0) return;
    this.cheerState.player.t = Math.max(0, this.cheerState.player.t - dt);
    this.cheerState.ai.t = Math.max(0, this.cheerState.ai.t - dt);
    this.writeMatrices(time);
  }

  /** 重算所有实例矩阵：平时微晃，欢呼时按各自相位乱跳（中立看台跟任意一边） */
  private writeMatrices(time: number): void {
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      const cheer =
        s.fan === 'neutral'
          ? this.cheerState.player.t >= this.cheerState.ai.t
            ? this.cheerState.player
            : this.cheerState.ai
          : this.cheerState[s.fan];
      const fade = cheer.t > 0 ? Math.min(1, cheer.t / 0.5) : 0;
      let y = s.y + Math.sin(time * 1.6 + s.phase) * 0.02;
      let tilt = Math.sin(time * 1.3 + s.phase) * 0.04;
      if (fade > 0) {
        y += Math.abs(Math.sin(time * 7 + s.phase * 3)) * cheer.amp * fade;
        tilt += Math.sin(time * 7 + s.phase * 3) * 0.1 * fade;
      }
      this.dummy.position.set(s.x, y + 0.5 * s.scale, s.z);
      this.dummy.rotation.set(0, 0, tilt);
      this.dummy.scale.setScalar(s.scale);
      this.dummy.updateMatrix();
      this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(s.x, y + 1.02 * s.scale, s.z);
      this.dummy.updateMatrix();
      this.heads.setMatrixAt(i, this.dummy.matrix);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(r: number): number {
  return (Math.random() * 2 - 1) * r;
}
