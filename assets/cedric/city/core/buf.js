// Static geometry builder: writes flat-shaded primitives into per-chunk buffers, then
// turns each chunk into one Mesh. Attributes: position, normal, color, kind.
// kind: 0 building wall (windows), 1 plain, 2 foliage, 3 emissive / neon.
import * as THREE from "./three.js";

const _a = [0, 0, 0], _b = [0, 0, 0];

export class Buf {
  constructor(chunk = 96) { this.chunk = chunk; this.map = new Map(); this.tris = 0; }

  bucket(cx, cz) {
    const key = Math.floor(cx / this.chunk) + "," + Math.floor(cz / this.chunk);
    let b = this.map.get(key);
    if (!b) this.map.set(key, (b = { p: [], n: [], c: [], k: [] }));
    return b;
  }

  vert(b, p, n, c, k) {
    b.p.push(p[0], p[1], p[2]); b.n.push(n[0], n[1], n[2]); b.c.push(c[0], c[1], c[2]); b.k.push(k);
  }

  // Triangle wound so that its front faces the normal n.
  tri(b, p0, p1, p2, n, c, k) {
    for (let i = 0; i < 3; i++) { _a[i] = p1[i] - p0[i]; _b[i] = p2[i] - p0[i]; }
    const cx = _a[1] * _b[2] - _a[2] * _b[1], cy = _a[2] * _b[0] - _a[0] * _b[2], cz = _a[0] * _b[1] - _a[1] * _b[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) { this.vert(b, p0, n, c, k); this.vert(b, p1, n, c, k); this.vert(b, p2, n, c, k); }
    else { this.vert(b, p0, n, c, k); this.vert(b, p2, n, c, k); this.vert(b, p1, n, c, k); }
    this.tris++;
  }

  quad(b, p0, p1, p2, p3, n, c, k) { this.tri(b, p0, p1, p2, n, c, k); this.tri(b, p0, p2, p3, n, c, k); }

  // Quad with its normal taken from the corners (p0..p3 counter-clockwise seen from the front).
  quadP(p0, p1, p2, p3, c, k) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const b = this.bucket((p0[0] + p2[0]) / 2, (p0[2] + p2[2]) / 2);
    this.quad(b, p0, p1, p2, p3, [nx, ny, nz], c, k);
  }

  // Horizontal rectangle facing up.
  flat(x0, x1, z0, z1, y, c, k = 1) {
    const b = this.bucket((x0 + x1) / 2, (z0 + z1) / 2);
    this.quad(b, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], c, k);
  }

  // Axis-aligned box, no bottom face unless asked for.
  box(x0, x1, y0, y1, z0, z1, c, k = 1, bottom = false) {
    const b = this.bucket((x0 + x1) / 2, (z0 + z1) / 2);
    this.quad(b, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c, k);
    this.quad(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c, k);
    this.quad(b, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], c, k);
    this.quad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c, k);
    this.quad(b, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c, k);
    if (bottom) this.quad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c, k);
  }

  // Box rotated by rot (radians, about Y) around its centre.
  boxR(cx, cz, hw, hd, rot, y0, y1, c, k = 1) {
    if (!rot) return this.box(cx - hw, cx + hw, y0, y1, cz - hd, cz + hd, c, k);
    const co = Math.cos(rot), si = Math.sin(rot), b = this.bucket(cx, cz);
    const P = (lx, lz, y) => [cx + lx * co - lz * si, y, cz + lx * si + lz * co];
    const A = [P(-hw, -hd, y0), P(hw, -hd, y0), P(hw, hd, y0), P(-hw, hd, y0)];
    const B = [P(-hw, -hd, y1), P(hw, -hd, y1), P(hw, hd, y1), P(-hw, hd, y1)];
    const N = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, n = N[i];
      this.quad(b, A[i], A[j], B[j], B[i], [n[0] * co - n[2] * si, 0, n[0] * si + n[2] * co], c, k);
    }
    this.quad(b, B[0], B[1], B[2], B[3], [0, 1, 0], c, k);
  }

  // Prism / cone / truncated cone, r0 at the bottom, r1 at the top (0 = point).
  frustum(cx, cz, y0, y1, r0, r1, sides, c, k = 1, phase = 0) {
    const b = this.bucket(cx, cz), dy = y1 - y0;
    for (let i = 0; i < sides; i++) {
      const a0 = phase + i / sides * Math.PI * 2, a1 = phase + (i + 1) / sides * Math.PI * 2, am = (a0 + a1) / 2;
      const n = [Math.cos(am) * dy, r0 - r1, Math.sin(am) * dy], l = Math.hypot(n[0], n[1], n[2]) || 1;
      n[0] /= l; n[1] /= l; n[2] /= l;
      const p0 = [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0], p1 = [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0];
      const p3 = [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1], p2 = [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1];
      if (r1 < 1e-4) this.tri(b, p0, p1, [cx, y1, cz], n, c, k); else this.quad(b, p0, p1, p2, p3, n, c, k);
      if (r1 > 1e-4) this.tri(b, [cx, y1, cz], p3, p2, [0, 1, 0], c, k);
    }
  }

  // All chunks in one BufferGeometry (models for InstancedMesh).
  geometry() {
    const p = [], n = [], c = [], k = [];
    for (const b of this.map.values()) { p.push(...b.p); n.push(...b.n); c.push(...b.c); k.push(...b.k); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute("kind", new THREE.Float32BufferAttribute(k, 1));
    g.computeBoundingSphere();
    return g;
  }

  // One Mesh per chunk, in a Group.
  build(material, name) {
    const group = new THREE.Group();
    group.name = name || "buf";
    for (const b of this.map.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
      g.setAttribute("kind", new THREE.Float32BufferAttribute(b.k, 1));
      g.computeBoundingSphere();
      group.add(new THREE.Mesh(g, material));
    }
    return group;
  }
}

// "#rrggbb" to [r, g, b] in 0..1.
export function hex(s) {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
