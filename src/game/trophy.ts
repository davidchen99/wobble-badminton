import * as THREE from 'three';

/**
 * 程序化低模奖杯（M9 荣誉体系：首次获胜的领奖时刻）。
 * 金杯 + 双耳 + 底座，扁平着色，保持低模呆萌画风（ART_DIRECTION）。
 * 整体高约 0.8m，由 world 负责悬浮旋转动画。
 */
export function buildTrophy(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: 0xffc93c, flatShading: true });
  const darkGold = new THREE.MeshLambertMaterial({ color: 0xb8860b, flatShading: true });

  // 两层底座
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), darkGold);
  base.position.y = 0.06;
  g.add(base);
  const baseTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), gold);
  baseTop.position.y = 0.17;
  g.add(baseTop);

  // 杯柱
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 10), gold);
  stem.position.y = 0.33;
  g.add(stem);

  // 杯身（下收口的杯形）
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.13, 0.34, 12), gold);
  cup.position.y = 0.61;
  g.add(cup);

  // 杯口唇边
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 16), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.78;
  g.add(rim);

  // 双耳（半环，开口朝杯身）
  const handleGeo = new THREE.TorusGeometry(0.11, 0.028, 8, 12, Math.PI);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(handleGeo, gold);
    handle.position.set(s * 0.3, 0.62, 0);
    handle.rotation.z = (s * Math.PI) / 2;
    g.add(handle);
  }

  return g;
}
