import * as THREE from 'three';

/** 场地常量（米，简化羽毛球单打场地） */
export const COURT = {
  /** 场地总宽（x 方向，单打边线） */
  width: 5.18,
  /** 场地总长（z 方向） */
  length: 13.4,
  /** 网高 */
  netHeight: 1.55,
  /** 网宽度方向的横跨长度（略超出边线） */
  netSpan: 6.2,
  /** 发球线距网距离 */
  serviceLineFromNet: 1.98,
} as const;

export const HALF_LENGTH = COURT.length / 2;
export const HALF_WIDTH = COURT.width / 2;

function line(x: number, z: number, w: number, d: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.012, d),
    new THREE.MeshLambertMaterial({ color: 0xf5f5f0 }),
  );
  mesh.position.set(x, 0.006, z);
  return mesh;
}

/** 用 CanvasTexture 画一张网眼贴图（比重力学的网格几何便宜得多） */
function makeNetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(240, 240, 235, 0.85)';
  ctx.lineWidth = 1;
  const cell = 8;
  for (let x = 0; x <= c.width; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, c.height);
    ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(c.width, y + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

/** 低模球场：地面、单打边线/底线/发球线/中线、球网与网柱 */
export function buildCourt(): THREE.Group {
  const court = new THREE.Group();

  // 外围地面（玩具世界，干净大色块）
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 20),
    new THREE.MeshLambertMaterial({ color: 0x39683d }),
  );
  floor.rotation.x = -Math.PI / 2;
  court.add(floor);

  // 场内地面
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.length),
    new THREE.MeshLambertMaterial({ color: 0x4e8f52 }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.002;
  court.add(inner);

  // 边界线
  const LW = 0.04; // 线宽
  court.add(line(-HALF_WIDTH, 0, LW, COURT.length));
  court.add(line(HALF_WIDTH, 0, LW, COURT.length));
  court.add(line(0, -HALF_LENGTH, COURT.width, LW));
  court.add(line(0, HALF_LENGTH, COURT.width, LW));
  // 发球线与中线
  court.add(line(0, -COURT.serviceLineFromNet, COURT.width, LW));
  court.add(line(0, COURT.serviceLineFromNet, COURT.width, LW));
  court.add(line(0, -HALF_LENGTH / 2, LW, HALF_LENGTH - COURT.serviceLineFromNet));
  court.add(line(0, HALF_LENGTH / 2, LW, HALF_LENGTH - COURT.serviceLineFromNet));

  // 网柱
  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, COURT.netHeight, 8);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x37474f });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set((COURT.netSpan / 2) * side, COURT.netHeight / 2, 0);
    court.add(post);
  }

  // 网面
  const netDepth = 0.76;
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.netSpan, netDepth),
    new THREE.MeshLambertMaterial({
      map: makeNetTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  net.position.set(0, COURT.netHeight - netDepth / 2, 0);
  court.add(net);

  // 网顶白带
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(COURT.netSpan, 0.05, 0.03),
    new THREE.MeshLambertMaterial({ color: 0xfafafa }),
  );
  tape.position.set(0, COURT.netHeight, 0);
  court.add(tape);

  return court;
}
