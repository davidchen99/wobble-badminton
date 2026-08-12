import * as THREE from 'three';
import type { TrackId } from './levels';

/**
 * 递进式观众系统（M13）：观众数量本身就是"不用 UI 的进度条"。
 * 新手轨：L1 两边各 2 人 → L2 各 2 排×4 → L3 满场（各 3 排×6）+ 两侧横幅；
 * 专业轨：L1/L2 保持满场；L3 魔王战彩蛋 = 三面环绕体育场（对面三层看台）+ 多横幅。
 *
 * 性能：观众 = 身体/头两个 InstancedMesh（2 次 draw call），横幅 ≤3 块平面；
 * 配色偏暗、动作幅度小，不抢球戏。得分/扣杀时集体跳 + 欢呼（SoundManager）。
 */

/** 实例容量上限（魔王战三面环绕也不超过） */
const MAX = 220;

/** 偏暗的衣服配色（不抢球戏） */
const BODY_COLORS = [0x5c6bc0, 0x8d6e63, 0x78909c, 0x7e57c2, 0x4db6ac, 0x9e9d24, 0x6d4c41, 0x546e7a];
/** 肤色 */
const HEAD_COLORS = [0xffccbc, 0xe8b39a, 0xc98d6b, 0xa06a42];

interface Seat {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
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
  private seats: Seat[] = [];
  private banners: THREE.Mesh[] = [];
  private dummy = new THREE.Object3D();

  /** 欢呼计时（秒）：>0 时观众集体跳 */
  private cheerTimer = 0;
  private cheerAmp = 0;

  constructor() {
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.34, 3, 8);
    const headGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.bodies = new THREE.InstancedMesh(bodyGeo, mat.clone(), MAX);
    this.heads = new THREE.InstancedMesh(headGeo, mat.clone(), MAX);
    this.bodies.count = 0;
    this.heads.count = 0;
    this.group.add(this.bodies, this.heads);
  }

  /** 按难度轨 + 关卡布置观众与横幅 */
  setLevel(track: TrackId, levelIndex: number): void {
    const seats: Seat[] = [];
    /** 两侧看台：rows 排 × perRow 人/边，逐排略抬高 */
    const sideSection = (rows: number, perRow: number) => {
      for (const side of [-1, 1]) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < perRow; c++) {
            const zSpan = perRow === 1 ? 0 : 5.6;
            seats.push({
              x: side * (3.6 + r * 0.75 + rand(0.12)),
              y: r * 0.3,
              z: perRow === 1 ? rand(2) : -zSpan / 2 + (zSpan / (perRow - 1)) * c + rand(0.2),
              scale: 0.85 + Math.random() * 0.3,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    };
    /** 魔王彩蛋：对面三层阶梯看台 */
    const farStands = (tiers: number, perTier: number) => {
      for (let t = 0; t < tiers; t++) {
        for (let c = 0; c < perTier; c++) {
          seats.push({
            x: -4.6 + (9.2 / (perTier - 1)) * c + rand(0.15),
            y: 0.4 + t * 0.6,
            z: -(8.0 + t * 0.85) + rand(0.1),
            scale: 0.85 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2,
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

  /** 得分/扣杀时集体欢呼跳跃；strength 0~1（玩家得分更嗨） */
  cheer(strength = 1): void {
    this.cheerTimer = 1.3;
    this.cheerAmp = 0.12 + 0.22 * Math.min(1, Math.max(0, strength));
  }

  update(dt: number, time: number): void {
    if (this.seats.length === 0) return;
    this.cheerTimer = Math.max(0, this.cheerTimer - dt);
    this.writeMatrices(time);
  }

  /** 重算所有实例矩阵：平时微晃，欢呼时按各自相位乱跳 */
  private writeMatrices(time: number): void {
    const cheering = this.cheerTimer > 0;
    const cheerFade = cheering ? Math.min(1, this.cheerTimer / 0.5) : 0;
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      let y = s.y + Math.sin(time * 1.6 + s.phase) * 0.02;
      let tilt = Math.sin(time * 1.3 + s.phase) * 0.04;
      if (cheering) {
        y += Math.abs(Math.sin(time * 7 + s.phase * 3)) * this.cheerAmp * cheerFade;
        tilt += Math.sin(time * 7 + s.phase * 3) * 0.1 * cheerFade;
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
