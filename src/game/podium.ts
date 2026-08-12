import * as THREE from 'three';

/**
 * 领奖台（M10-2 冠军结算）：1/2/3 名次台，金/银/铜配色 + 前挂名次牌。
 * 低模扁平着色，保持呆萌画风（ART_DIRECTION）。
 * 本地原点在中央（#1 台）地面中心，x- 为 #2、x+ 为 #3。
 */
export function buildPodium(): THREE.Group {
  const g = new THREE.Group();
  // [x 偏移, 台高, 颜色, 名次]
  const blocks: [number, number, number, number][] = [
    [0, 0.6, 0xffd54f, 1],
    [-0.9, 0.4, 0xcfd8dc, 2],
    [0.9, 0.25, 0xbc8a5f, 3],
  ];
  for (const [x, h, color, rank] of blocks) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, h, 0.8),
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
    );
    block.position.set(x, h / 2, 0);
    g.add(block);
    const plate = makeRankPlate(rank);
    plate.position.set(x, h / 2, 0.41);
    g.add(plate);
  }
  return g;
}

/** 名次牌：Canvas 数字贴图的小白牌（无光照材质保证可读） */
function makeRankPlate(rank: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(14, 8, 100, 48);
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 38px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), 64, 34);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.25),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
}
