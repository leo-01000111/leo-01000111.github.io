// Kit context: a local frame (origin + rotation about Y) over a shared Buf, plus colliders and
// anchors for the other layers (flora reads trees / beds / vines, props reads glows / signs).
// Local coordinates: x along the front, y up, z depth. Local -z is the front, so K.at(x, z, side)
// turns a building to face "n" | "e" | "s" | "w". Every solid is convex and oriented by its own
// centroid, so faces always point outwards.
export const K_WIN = 0, K_PLAIN = 1, K_LEAF = 2, K_NEON = 3, K_GLASS = 4, K_RAW = 5, K_LAMP = 6;
const TAU = Math.PI * 2;
const SIDE = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };

function newell(pts) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z);
  return l < 1e-9 ? null : [x / l, y / l, z / l];
}

export function createKit(B, world) {
  const coll = world.collide;
  const K = { B, ox: 0, oz: 0, rot: 0, co: 1, si: 0, bk: null, rnd: Math.random };

  // Place the frame. rot: radians or a side letter (the side the local front looks at).
  K.at = (x, z, rot = 0, rnd) => {
    if (typeof rot === "string") rot = SIDE[rot];
    K.ox = x; K.oz = z; K.rot = rot;
    K.co = Math.cos(rot); K.si = Math.sin(rot);
    if (Math.abs(K.co) < 1e-9) K.co = 0; if (Math.abs(K.si) < 1e-9) K.si = 0;
    K.bk = B.bucket(x, z);
    if (rnd) K.rnd = rnd;
    return K;
  };
  const W = (x, y, z) => [K.ox + x * K.co - z * K.si, y, K.oz + x * K.si + z * K.co];
  const Nw = (x, y, z) => [x * K.co - z * K.si, y, x * K.si + z * K.co];
  K.W = W; K.Nw = Nw;
  K.heading = (lx, lz) => { const n = Nw(lx, 0, lz); return Math.atan2(n[2], n[0]); };

  // ---- faces (world points) ----
  K.face = (pts, c, k, n) => {
    n = n || newell(pts);
    if (!n) return;
    for (let i = 1; i < pts.length - 1; i++) B.tri(K.bk, pts[0], pts[i], pts[i + 1], n, c, k);
  };
  // Convex solid from faces: each face normal is flipped to point away from the centroid.
  K.solid = (faces, c, k) => {
    let cx = 0, cy = 0, cz = 0, m = 0;
    for (const f of faces) for (const p of f) { cx += p[0]; cy += p[1]; cz += p[2]; m++; }
    cx /= m; cy /= m; cz /= m;
    for (const f of faces) {
      const n = newell(f);
      if (!n) continue;
      let fx = 0, fy = 0, fz = 0;
      for (const p of f) { fx += p[0]; fy += p[1]; fz += p[2]; }
      fx = fx / f.length - cx; fy = fy / f.length - cy; fz = fz / f.length - cz;
      if (n[0] * fx + n[1] * fy + n[2] * fz < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
      K.face(f, c, k, n);
    }
  };

  // Hexahedron from 8 local points: 0-3 bottom ring, 4-7 top ring (same order).
  K.hexa = (P, c, k, bottom = true, top = true) => {
    const w = P.map(p => W(p[0], p[1], p[2])), f = [];
    if (bottom) f.push([w[0], w[1], w[2], w[3]]);
    if (top) f.push([w[4], w[5], w[6], w[7]]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; f.push([w[i], w[j], w[j + 4], w[i + 4]]); }
    K.solid(f, c, k);
  };

  // Box in local coordinates. Bottom face only when lifted off the ground.
  K.box = (x0, x1, y0, y1, z0, z1, c, k = K_RAW, bottom) => {
    if (bottom === undefined) bottom = y0 > 0.25;
    K.hexa([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c, k, bottom, true);
  };
  // Box rotated by a (local) around its centre.
  K.obox = (cx, cz, hw, hd, a, y0, y1, c, k = K_RAW, bottom) => {
    if (bottom === undefined) bottom = y0 > 0.25;
    const co = Math.cos(a), si = Math.sin(a), P = [];
    for (const y of [y0, y1]) for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) P.push([cx + u * co - v * si, y, cz + u * si + v * co]);
    K.hexa(P, c, k, bottom, true);
  };
  // Sloped slab: rectangle x0..x1 / z0..z1, bottom rising from ya (at z0) to yb (at z1), thickness t.
  K.ramp = (x0, x1, z0, z1, ya, yb, t, c, k = K_RAW) => {
    K.hexa([[x0, ya, z0], [x1, ya, z0], [x1, yb, z1], [x0, yb, z1], [x0, ya + t, z0], [x1, ya + t, z0], [x1, yb + t, z1], [x0, yb + t, z1]], c, k, true, true);
  };
  // Extruded convex polygon [[x, z], ...].
  K.prism = (pts, y0, y1, c, k = K_RAW, bottom) => {
    if (bottom === undefined) bottom = y0 > 0.25;
    const lo = pts.map(p => W(p[0], y0, p[1])), hi = pts.map(p => W(p[0], y1, p[1])), f = [hi];
    if (bottom) f.push(lo);
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; f.push([lo[i], lo[j], hi[j], hi[i]]); }
    K.solid(f, c, k);
  };
  // Vertical (truncated) cone / prism. r1 = 0 makes a point.
  K.cyl = (x, z, y0, y1, r0, r1, sides, c, k = K_RAW, phase = 0, bottom) => {
    if (bottom === undefined) bottom = y0 > 0.25;
    const lo = [], hi = [];
    for (let i = 0; i < sides; i++) {
      const a = phase + i / sides * TAU;
      lo.push(W(x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0));
      hi.push(W(x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1));
    }
    const f = [];
    if (r1 > 1e-4) f.push(hi);
    if (bottom && r0 > 1e-4) f.push(lo);
    const tip = W(x, y1, z);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      f.push(r1 > 1e-4 ? [lo[i], lo[j], hi[j], hi[i]] : [lo[i], lo[j], tip]);
    }
    K.solid(f, c, k);
  };
  // Cylinder between two local points a, b ([x, y, z]), radius r.
  K.tube = (a, b, r, sides, c, k = K_RAW, r2 = r) => {
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const up = Math.abs(dy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let ux = dy * up[2] - dz * up[1], uy = dz * up[0] - dx * up[2], uz = dx * up[1] - dy * up[0];
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const A = [], Bv = [];
    for (let i = 0; i < sides; i++) {
      const t = i / sides * TAU, cs = Math.cos(t), sn = Math.sin(t);
      A.push(W(a[0] + (ux * cs + vx * sn) * r, a[1] + (uy * cs + vy * sn) * r, a[2] + (uz * cs + vz * sn) * r));
      Bv.push(W(b[0] + (ux * cs + vx * sn) * r2, b[1] + (uy * cs + vy * sn) * r2, b[2] + (uz * cs + vz * sn) * r2));
    }
    const f = [A, Bv];
    for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; f.push([A[i], A[j], Bv[j], Bv[i]]); }
    K.solid(f, c, k);
  };
  // Curved slab (ring sector) whose bottom climbs from yb0 to yb1: ramps, helices, curved walls.
  K.arcSlab = (cx, cz, r0, r1, a0, a1, yb0, yb1, h, segs, c, k = K_RAW) => {
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + (a1 - a0) * i / segs, t1 = a0 + (a1 - a0) * (i + 1) / segs;
      const y0 = yb0 + (yb1 - yb0) * i / segs, y1 = yb0 + (yb1 - yb0) * (i + 1) / segs;
      const p = (r, t, y) => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r];
      K.hexa([p(r0, t0, y0), p(r1, t0, y0), p(r1, t1, y1), p(r0, t1, y1), p(r0, t0, y0 + h), p(r1, t0, y0 + h), p(r1, t1, y1 + h), p(r0, t1, y1 + h)], c, k, y0 > 0.25 || y1 > 0.25, true);
    }
  };
  // Wall slab in the local x/y plane (thickness z0..z1) with a round hole centred at (hx, hy).
  K.holeWall = (x0, x1, y0, y1, z0, z1, hx, hy, r, n, c, k = K_RAW) => {
    const ang = [];
    for (let i = 0; i < n; i++) ang.push(i / n * TAU);
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { let a = Math.atan2(cy - hy, cx - hx); if (a < 0) a += TAU; ang.push(a); }
    ang.sort((a, b) => a - b);
    const A = ang.filter((a, i) => i === 0 || a - ang[i - 1] > 1e-4);
    const circ = A.map(a => [hx + Math.cos(a) * r, hy + Math.sin(a) * r]);
    const rect = A.map(a => {
      const cs = Math.cos(a), sn = Math.sin(a);
      let t = 1e9;
      if (cs > 1e-9) t = Math.min(t, (x1 - hx) / cs); if (cs < -1e-9) t = Math.min(t, (x0 - hx) / cs);
      if (sn > 1e-9) t = Math.min(t, (y1 - hy) / sn); if (sn < -1e-9) t = Math.min(t, (y0 - hy) / sn);
      return [hx + cs * t, hy + sn * t];
    });
    const nF = Nw(0, 0, -1), nB = Nw(0, 0, 1);
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      for (const [z, nn] of [[z0, nF], [z1, nB]]) {
        const q = [W(circ[i][0], circ[i][1], z), W(circ[j][0], circ[j][1], z), W(rect[j][0], rect[j][1], z), W(rect[i][0], rect[i][1], z)];
        if (Math.hypot(rect[i][0] - rect[j][0], rect[i][1] - rect[j][1]) < 1e-6) K.face([q[0], q[1], q[2]], c, k, nn); else K.face(q, c, k, nn);
      }
      const am = (A[i] + (j ? A[j] : A[j] + TAU)) / 2;
      K.face([W(circ[i][0], circ[i][1], z0), W(circ[j][0], circ[j][1], z0), W(circ[j][0], circ[j][1], z1), W(circ[i][0], circ[i][1], z1)], c, k, Nw(-Math.cos(am), -Math.sin(am), 0));
    }
    K.face([W(x0, y0, z0), W(x0, y1, z0), W(x0, y1, z1), W(x0, y0, z1)], c, k, Nw(-1, 0, 0));
    K.face([W(x1, y0, z0), W(x1, y1, z0), W(x1, y1, z1), W(x1, y0, z1)], c, k, Nw(1, 0, 0));
    K.face([W(x0, y1, z0), W(x1, y1, z0), W(x1, y1, z1), W(x0, y1, z1)], c, k, [0, 1, 0]);
    if (y0 > 0.25) K.face([W(x0, y0, z0), W(x1, y0, z0), W(x1, y0, z1), W(x0, y0, z1)], c, k, [0, -1, 0]);
  };

  // ---- colliders (local) ----
  K.rect = (x0, x1, z0, z1, h = 99) => {
    const c = W((x0 + x1) / 2, 0, (z0 + z1) / 2);
    coll.addRect(c[0], c[2], (x1 - x0) / 2, (z1 - z0) / 2, K.rot, h);
  };
  K.circle = (x, z, r, h = 99) => { const c = W(x, 0, z); coll.addCircle(c[0], c[2], r, h); };

  // ---- anchors for other layers (stored in world coordinates) ----
  K.tree = (x, y, z, s = 1, sp) => { const p = W(x, y, z); world.anchors.push({ t: "tree", x: p[0], y, z: p[2], s, sp }); };
  K.bed = (x0, x1, z0, z1, y, d = 1) => {
    const c = W((x0 + x1) / 2, y, (z0 + z1) / 2);
    world.anchors.push({ t: "bed", x: c[0], y, z: c[2], hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, rot: K.rot, d });
  };
  // Vine hanging from (x, y, z) down a face whose outward normal is (nx, nz), w wide, len long.
  K.vine = (x, y, z, nx, nz, w, len) => {
    const p = W(x, y, z), n = Nw(nx, 0, nz);
    world.anchors.push({ t: "vine", x: p[0], y, z: p[2], nx: n[0], nz: n[2], w, len });
  };
  K.glow = (x, y, z, col, size = 1) => { const p = W(x, y, z); world.glows.push({ x: p[0], y, z: p[2], col, size }); };
  K.sign = (id, x, y, z, lx = 0, lz = -1, w) => { const p = W(x, y, z); world.signs[id] = { x: p[0], y, z: p[2], facing: K.heading(lx, lz), w }; };
  K.prop = (t, x, z, y = 0, lx = 0, lz = -1, extra) => {
    const p = W(x, y, z);
    world.props.push(Object.assign({ t, x: p[0], y, z: p[2], facing: K.heading(lx, lz) }, extra));
  };
  return K;
}
