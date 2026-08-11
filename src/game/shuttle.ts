import * as THREE from 'three';

/**
 * 羽毛球可视对象（M4 才挂物理）。
 * 本地 -z 为飞行朝向（球头朝前），用 lookAtVelocity 对齐速度方向。
 */
export class Shuttle {
  readonly group = new THREE.Group();

  constructor() {
    // 球头（软木，半球）
    const cork = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xe53935, flatShading: true }),
    );
    cork.rotation.x = -Math.PI / 2; // 半球开口朝 +z（后方），球头顶点朝 -z
    this.group.add(cork);

    // 羽毛裙（开口圆锥，朝后张开）
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.12, 10, 1, true),
      new THREE.MeshLambertMaterial({
        color: 0xfafafa,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    );
    skirt.rotation.x = Math.PI / 2; // 锥尖朝 +z 后方
    skirt.position.z = 0.075;
    this.group.add(skirt);
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  /** 让球头对齐飞行方向（接受任意 {x,y,z} 结构，避免依赖物理层的类型） */
  faceVelocity(v: { x: number; y: number; z: number }): void {
    if (Math.hypot(v.x, v.y, v.z) < 1e-6) return;
    const p = this.group.position;
    this.group.lookAt(p.x - v.x, p.y - v.y, p.z - v.z);
  }
}
