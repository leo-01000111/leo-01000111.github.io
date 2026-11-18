// The six plants, four growth stages each, as small flat-shaded models (kind 1, plain colours,
// so the weather never tints them green or white). One geometry per species and stage, built on
// first use and shared by every bed. Each model stands at the origin, base at y = 0.
import { Buf } from "../../core/buf.js";
import { seeded } from "../../core/rng.js";

const K = 1;
const G = { dark: [0.10, 0.30, 0.13], mid: [0.17, 0.42, 0.16], bright: [0.27, 0.56, 0.19], grey: [0.36, 0.5, 0.36], stem: [0.2, 0.34, 0.13] };
const RED = [0.82, 0.14, 0.09], YEL = [0.98, 0.74, 0.14], BRN = [0.28, 0.16, 0.07], PUR = [0.5, 0.34, 0.76], WHT = [0.95, 0.92, 0.84];
const PINK = [0.95, 0.38, 0.58], STRAW = [0.88, 0.12, 0.2], CAC = [0.2, 0.5, 0.36];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// double-sided polygon (fan from the first point)
function poly(B, pts, c) {
  const b = B.bucket(0, 0), n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))), m = [-n[0], -n[1], -n[2]];
  for (let i = 1; i < pts.length - 1; i++) { B.tri(b, pts[0], pts[i], pts[i + 1], n, c, K); B.tri(b, pts[0], pts[i], pts[i + 1], m, c, K); }
}
// a leaf: diamond from a base point, along yaw, rising by pitch
function leaf(B, x, y, z, len, wid, yaw, pitch, c) {
  const dx = Math.cos(yaw), dz = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const tip = [x + dx * len * cp, y + len * sp, z + dz * len * cp], mid = [x + dx * len * cp * 0.45, y + len * sp * 0.45 + wid * 0.5, z + dz * len * cp * 0.45];
  poly(B, [[x, y, z], [mid[0] - dz * wid, mid[1], mid[2] + dx * wid], tip, [mid[0] + dz * wid, mid[1], mid[2] - dx * wid]], c);
}
function ring(B, rnd, n, y0, y1, r, len, wid, pitch, cols) {
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    leaf(B, Math.cos(i * 2.4) * r, y0 + (y1 - y0) * t, Math.sin(i * 2.4) * r, len * (1.05 - 0.4 * t) * (0.9 + rnd() * 0.2), wid, i * 2.4 + rnd() * 0.5, pitch + rnd() * 0.3, cols[i % cols.length]);
  }
}
const stem = (B, x, z, h, r0, r1, c = G.stem, sides = 5) => B.frustum(x, z, 0, h, r0, r1, sides, c, K);
// a flat round head tilted towards -z (the door): petals as triangles, centre as a fan
function head(B, cy, R, tilt, nPetal, pc, cc, ox = 0, oz = 0) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const P = (r, a) => { const u = Math.cos(a) * r, v = Math.sin(a) * r; return [ox + u, cy + v * ct, oz - v * st]; };
  for (let i = 0; i < nPetal; i++) {
    const a0 = i / nPetal * 6.2832, a1 = (i + 1) / nPetal * 6.2832;
    poly(B, [P(R * 0.4, a0), P(R, (a0 + a1) / 2), P(R * 0.4, a1)], pc);
  }
  const lift = (p) => [p[0], p[1] + 0.02 * ct, p[2] - 0.02 * st];
  for (let i = 0; i < 8; i++) poly(B, [lift(P(0, 0)), lift(P(R * 0.42, i / 8 * 6.2832)), lift(P(R * 0.42, (i + 1) / 8 * 6.2832))], cc);
}
const berry = (B, x, y, z, r, c) => { B.frustum(x, z, y, y + r, r * 0.15, r, 5, c, K); B.frustum(x, z, y + r, y + r * 2, r, r * 0.2, 5, c, K); };

const BUILD = {
  basilic(B, s, rnd) {
    const n = [2, 6, 12, 15][s], h = [0.1, 0.28, 0.5, 0.58][s], L = [0.13, 0.22, 0.3, 0.33][s];
    stem(B, 0, 0, h, 0.02, 0.012);
    ring(B, rnd, n, h * 0.35, h, 0.02, L, L * 0.45, 0.5, [G.bright, G.mid, G.bright]);
    if (s === 3) for (let i = 0; i < 3; i++) { const a = i * 2.1; B.frustum(Math.cos(a) * 0.08, Math.sin(a) * 0.08, h, h + 0.17, 0.02, 0.012, 4, WHT, K); }
  },
  fraisier(B, s, rnd) {
    const n = [3, 6, 9, 10][s], L = [0.15, 0.27, 0.36, 0.4][s];
    ring(B, rnd, n, 0.03, 0.12, 0.02, L, L * 0.5, 0.35, [G.mid, G.bright, G.dark]);
    if (s >= 2) for (let i = 0; i < 3; i++) { const a = i * 2.2 + 0.4; head(B, 0.2, 0.05, 1.45, 5, WHT, YEL, Math.cos(a) * 0.16, Math.sin(a) * 0.16); }
    if (s === 3) for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; berry(B, Math.cos(a) * 0.27, 0.0, Math.sin(a) * 0.27, 0.06, STRAW); }
  },
  tomate(B, s, rnd) {
    const h = [0.14, 0.5, 1.0, 1.2][s], n = [2, 6, 12, 14][s], L = [0.14, 0.3, 0.42, 0.46][s];
    stem(B, 0, 0, h, 0.03, 0.018);
    ring(B, rnd, n, h * 0.3, h, 0.03, L, L * 0.4, 0.4, [G.mid, G.dark, G.bright]);
    if (s === 3) for (let i = 0; i < 6; i++) { const a = i * 1.05; berry(B, Math.cos(a) * 0.24, 0.45 + (i % 3) * 0.2, Math.sin(a) * 0.24, 0.085, RED); }
  },
  tournesol(B, s, rnd) {
    const h = [0.16, 0.7, 1.5, 1.7][s], n = [2, 4, 8, 8][s], L = [0.15, 0.34, 0.5, 0.52][s];
    stem(B, 0, 0, h, 0.04, 0.03);
    ring(B, rnd, n, h * 0.15, h * 0.7, 0.04, L, L * 0.45, 0.35, [G.mid, G.dark]);
    if (s === 2) B.frustum(0, 0, h, h + 0.17, 0.13, 0.0, 6, G.mid, K);
    if (s === 3) { B.frustum(0, 0, h - 0.02, h + 0.02, 0.06, 0.06, 4, G.mid, K); head(B, h + 0.18, 0.52, 0.9, 12, YEL, BRN); }
  },
  lavande(B, s, rnd) {
    ring(B, rnd, [2, 7, 10, 12][s], 0.02, 0.1, 0.04, [0.12, 0.26, 0.3, 0.32][s], 0.025, 0.7, [G.grey, G.mid]);
    const n = [0, 2, 5, 8][s];
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, r = 0.05 + (i % 3) * 0.035, h = (s === 3 ? 0.62 : 0.5) + (i % 3) * 0.06;
      B.frustum(Math.cos(a) * r, Math.sin(a) * r, 0.05, h, 0.012, 0.009, 3, G.grey, K);
      B.frustum(Math.cos(a) * r, Math.sin(a) * r, h, h + (s === 3 ? 0.2 : 0.1), 0.03, 0.012, 4, s === 3 ? PUR : G.mid, K);
    }
  },
  cactus(B, s) {
    const h = [0.12, 0.3, 0.5, 0.55][s], r = [0.09, 0.14, 0.17, 0.17][s];
    B.frustum(0, 0, 0, h, r, r * 0.82, 6, CAC, K); B.frustum(0, 0, h, h + r * 0.55, r * 0.82, 0.0, 6, CAC, K);
    if (s >= 2) {
      B.box(r * 0.5, r + 0.1, 0.2, 0.3, -0.04, 0.04, CAC, K); B.frustum(r + 0.1, 0, 0.2, 0.38, 0.045, 0.035, 5, CAC, K);
      if (s === 3) B.box(-r - 0.08, -r * 0.5, 0.28, 0.35, -0.035, 0.035, CAC, K), B.frustum(-r - 0.08, 0, 0.28, 0.44, 0.04, 0.03, 5, CAC, K);
    }
    if (s === 3) B.frustum(0, 0, h + r * 0.25, h + r * 0.25 + 0.09, 0.0, 0.1, 6, PINK, K), B.frustum(0, 0, h + r * 0.25 + 0.09, h + r * 0.25 + 0.1, 0.1, 0.0, 6, YEL, K);
  },
};

const cache = new Map();
export function plantGeometry(sp, stage) {
  const key = sp + stage;
  let geo = cache.get(key);
  if (!geo) {
    const B = new Buf(1e5);
    BUILD[sp](B, stage, seeded(7 + stage * 31 + sp.length * 101));
    geo = B.geometry(); geo.userData.tris = B.tris;
    cache.set(key, geo);
  }
  return geo;
}
export function disposePlants() { for (const g of cache.values()) g.dispose(); cache.clear(); }
