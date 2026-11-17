// Le Port: the small models. An electric launch (the one Cédric sails), a sailing dinghy, a channel
// buoy, the bell buoy and a gull. Flat-shaded triangles through the kit; every model looks along +x
// with its waterline at y = 0. Instanced by life.js.
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { createKit, K_PLAIN, K_LAMP, K_GLASS } from "../../world/kit/kit.js";

const SINK = { collide: null, anchors: [], glows: [], signs: {}, props: [] };

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function newell(p) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z);
  return l < 1e-7 ? null : [x / l, y / l, z / l];
}
// Closed convex solid with a colour per face: normals point away from the centroid.
function solid(K, faces) {
  let cx = 0, cy = 0, cz = 0, m = 0;
  for (const f of faces) for (const q of f.p) { cx += q[0]; cy += q[1]; cz += q[2]; m++; }
  cx /= m; cy /= m; cz /= m;
  for (const f of faces) {
    const n = newell(f.p);
    if (!n) continue;
    let fx = 0, fy = 0, fz = 0;
    for (const q of f.p) { fx += q[0]; fy += q[1]; fz += q[2]; }
    fx = fx / f.p.length - cx; fy = fy / f.p.length - cy; fz = fz / f.p.length - cz;
    if (n[0] * fx + n[1] * fy + n[2] * fz < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    K.face(f.p, f.c, f.k == null ? K_PLAIN : f.k, n);
  }
}
// Hull lofted through stations { x, b (half beam), k (keel y), s (deck y) }.
function hull(K, st, col) {
  const ring = s => [[s.x, s.s, -s.b], [s.x, s.k * 0.3, -s.b * 0.82], [s.x, s.k, 0], [s.x, s.k * 0.3, s.b * 0.82], [s.x, s.s, s.b]];
  const cols = [col.top, col.bottom, col.bottom, col.top, col.deck];
  for (let i = 0; i < st.length - 1; i++) {
    const A = ring(st[i]), B = ring(st[i + 1]), faces = [];
    for (let j = 0; j < 5; j++) { const j2 = (j + 1) % 5; faces.push({ p: [A[j], A[j2], B[j2], B[j]], c: cols[j] }); }
    if (i === 0) faces.push({ p: A, c: col.top });
    if (i === st.length - 2) faces.push({ p: B, c: col.top });
    solid(K, faces);
  }
  // toe rail
  for (let i = 0; i < st.length - 1; i++) for (const sd of [-1, 1]) {
    const a = st[i], b = st[i + 1];
    K.tube([a.x, a.s + 0.05, sd * a.b * 0.985], [b.x, b.s + 0.05, sd * b.b * 0.985], 0.04, 4, col.rail, K_PLAIN);
  }
}
const make = fn => {
  const B = new Buf(1e6), K = createKit(B, SINK);
  K.at(0, 0, 0);
  fn(K);
  const geo = B.geometry();
  geo.userData.tris = B.tris;
  return geo;
};

// Electric launch, 5.6 m. Open cockpit aft, low cabin forward, helm on the starboard side.
export const LAUNCH = {
  deckY: 0.48, helm: -0.4, // where Cédric floats: x, height of the deck below him
  lights: [[1.3, 1.02, -0.62, [1, 0.1, 0.1]], [1.3, 1.02, 0.62, [0.1, 1, 0.3]], [-2.78, 1.2, 0, [1, 0.92, 0.75]]], // port, starboard, stern
  bow: 2.8, stern: -2.8, beam: 2.0,
};
export function launchGeo() {
  return make(K => {
    const col = { top: [0.80, 0.77, 0.69], bottom: [0.09, 0.15, 0.17], deck: [0.47, 0.33, 0.2], rail: [0.55, 0.38, 0.22] };
    hull(K, [
      { x: -2.8, b: 0.95, k: -0.40, s: 0.42 }, { x: -2.0, b: 1.0, k: -0.46, s: 0.44 }, { x: -0.8, b: 1.0, k: -0.5, s: 0.46 },
      { x: 0.6, b: 0.95, k: -0.48, s: 0.5 }, { x: 1.6, b: 0.74, k: -0.4, s: 0.56 }, { x: 2.3, b: 0.42, k: -0.3, s: 0.64 }, { x: 2.8, b: 0.04, k: -0.12, s: 0.72 },
    ], col);
    const teal = [0.13, 0.42, 0.45], cream = col.top, dark = [0.1, 0.1, 0.12], wood = col.deck;
    K.box(-2.7, -0.25, 0.43, 0.47, -0.8, 0.8, [0.36, 0.25, 0.15], K_PLAIN, false);          // cockpit sole, darker boards
    for (let z = -0.7; z < 0.75; z += 0.28) K.box(-2.7, -0.25, 0.465, 0.475, z, z + 0.04, [0.2, 0.14, 0.1], K_PLAIN, false);
    // cabin: raked front
    solid(K, [
      { p: [[0, 0.46, -0.7], [1.35, 0.46, -0.62], [1.35, 0.46, 0.62], [0, 0.46, 0.7]], c: cream },
      { p: [[0, 1.3, -0.66], [1.0, 1.3, -0.56], [1.0, 1.3, 0.56], [0, 1.3, 0.66]], c: [0.9, 0.87, 0.8] },
      { p: [[0, 0.46, -0.7], [1.35, 0.46, -0.62], [1.0, 1.3, -0.56], [0, 1.3, -0.66]], c: cream },
      { p: [[0, 0.46, 0.7], [1.35, 0.46, 0.62], [1.0, 1.3, 0.56], [0, 1.3, 0.66]], c: cream },
      { p: [[1.35, 0.46, -0.62], [1.35, 0.46, 0.62], [1.0, 1.3, 0.56], [1.0, 1.3, -0.56]], c: cream },
      { p: [[0, 0.46, -0.7], [0, 0.46, 0.7], [0, 1.3, 0.66], [0, 1.3, -0.66]], c: cream },
    ]);
    K.face([[1.31, 0.74, -0.5], [1.31, 0.74, 0.5], [1.07, 1.2, 0.5], [1.07, 1.2, -0.5]], dark, K_GLASS, [0.92, 0.38, 0]); // windscreen
    for (const sd of [-1, 1]) K.face([[0.15, 0.78, sd * 0.705], [1.0, 0.78, sd * 0.635], [0.9, 1.15, sd * 0.585], [0.15, 1.15, sd * 0.675]], dark, K_GLASS, [0, 0, sd]);
    K.box(-0.1, 1.15, 1.3, 1.38, -0.78, 0.78, teal, K_PLAIN, true);                           // roof, teal edge
    // helm console on the starboard side, with a low screen
    K.box(-0.95, -0.45, 0.46, 1.0, 0.3, 0.78, [0.22, 0.24, 0.26], K_PLAIN, false);
    K.box(-0.98, -0.42, 1.0, 1.04, 0.28, 0.8, dark, K_PLAIN, true);
    K.face([[-0.5, 1.02, 0.4], [-0.5, 1.02, 0.7], [-0.62, 1.4, 0.7], [-0.62, 1.4, 0.4]], dark, K_GLASS, [0.95, 0.3, 0]);
    K.box(-0.8, -0.74, 1.04, 1.12, 0.46, 0.52, [0.7, 0.7, 0.72], K_PLAIN, false);           // wheel post
    // stern bench, motor pod, antenna
    K.box(-2.55, -1.95, 0.46, 0.78, -0.72, 0.72, wood, K_PLAIN, false);
    K.box(-2.62, -2.5, 0.78, 1.1, -0.72, 0.72, wood, K_PLAIN, false);
    K.box(-3.05, -2.78, -0.15, 0.55, -0.22, 0.22, [0.2, 0.22, 0.24], K_PLAIN, false);
    K.box(-3.07, -3.0, 0.2, 0.5, -0.18, 0.18, teal, K_PLAIN, false);
    K.tube([-2.7, 0.8, 0.5], [-2.78, 1.9, 0.5], 0.025, 4, [0.15, 0.15, 0.17]);
    K.box(-2.82, -2.74, 1.14, 1.26, -0.05, 0.05, [1, 0.9, 0.7], K_LAMP, true);             // stern lamp
    K.tube([-2.74, 0.45, 0], [-2.78, 1.14, 0], 0.025, 4, [0.15, 0.15, 0.17]);
    for (const [x, y, z, c] of LAUNCH.lights) if (z) K.box(x - 0.05, x + 0.05, y - 0.05, y + 0.05, z - 0.05, z + 0.05, c, K_LAMP, true);
    K.box(2.45, 2.7, 0.66, 0.78, -0.02, 0.02, [0.2, 0.2, 0.22], K_PLAIN, false);          // bow fitting
  });
}

// Sailing dinghy, 3.4 m, orange sail. Origin at the waterline amidships.
export const DINGHY = { lights: [], bow: 1.7, stern: -1.7, beam: 1.3 };
export function dinghyGeo() {
  return make(K => {
    const col = { top: [0.82, 0.8, 0.74], bottom: [0.12, 0.2, 0.22], deck: [0.45, 0.32, 0.2], rail: [0.55, 0.38, 0.22] };
    hull(K, [
      { x: -1.65, b: 0.58, k: -0.2, s: 0.24 }, { x: -0.8, b: 0.68, k: -0.24, s: 0.26 }, { x: 0.4, b: 0.6, k: -0.22, s: 0.3 },
      { x: 1.2, b: 0.34, k: -0.15, s: 0.38 }, { x: 1.7, b: 0.03, k: -0.07, s: 0.46 },
    ], col);
    for (const x of [-0.7, 0.3]) K.box(x - 0.1, x + 0.1, 0.26, 0.31, -0.62, 0.62, col.deck, K_PLAIN, false);     // thwarts
    K.box(-0.1, 0.1, 0.28, 0.72, -0.05, 0.05, [0.3, 0.2, 0.12], K_PLAIN, false);                               // centreboard case
    K.box(-1.78, -1.62, -0.35, 0.5, -0.04, 0.04, [0.3, 0.2, 0.12], K_PLAIN, false);                             // rudder
    K.tube([0.35, 0.3, 0], [0.35, 4.3, 0], 0.045, 5, [0.75, 0.74, 0.72]);                                       // mast
    K.tube([0.35, 0.95, 0], [-1.5, 0.82, 0], 0.035, 4, [0.7, 0.68, 0.66]);                                      // boom
    const sail = [0.82, 0.38, 0.17], jib = [0.88, 0.8, 0.66];
    const P = [[0.37, 4.1, 0], [0.37, 1.0, 0], [-1.4, 0.9, 0]];
    K.face(P, sail, K_PLAIN, [0, 0, 1]); K.face(P, sail, K_PLAIN, [0, 0, -1]);
    const J = [[0.33, 3.5, 0], [0.33, 0.55, 0], [1.55, 0.5, 0]];
    K.face(J, jib, K_PLAIN, [0, 0, 1]); K.face(J, jib, K_PLAIN, [0, 0, -1]);
    K.tube([0.33, 3.5, 0], [1.68, 0.46, 0], 0.012, 3, [0.7, 0.7, 0.7]);
  });
}

// Channel / swimming-zone buoy, 1 m. White, tinted per instance.
export function buoyGeo() {
  return make(K => {
    K.cyl(0, 0, -0.3, 0.32, 0.36, 0.34, 8, [0.9, 0.9, 0.9], K_PLAIN, 0, false);
    K.cyl(0, 0, 0.1, 0.2, 0.355, 0.35, 8, [0.45, 0.45, 0.45], K_PLAIN, 0, false);
    K.cyl(0, 0, 0.32, 0.72, 0.28, 0.07, 8, [0.95, 0.95, 0.95], K_PLAIN, 0.2);
    K.cyl(0, 0, 0.72, 0.9, 0.09, 0.09, 6, [1, 0.95, 0.85], K_LAMP, 0, true);
  });
}
export const BUOY_LIGHT_Y = 0.84;

// Bell buoy, 3 m: round float, open frame, a bell in it, a lantern on top.
export function bellGeo() {
  return make(K => {
    const rust = [0.62, 0.26, 0.1], steel = [0.2, 0.21, 0.23];
    K.cyl(0, 0, -0.55, 0.3, 0.95, 0.85, 10, rust, K_PLAIN, 0, false);
    K.cyl(0, 0, 0.3, 0.42, 0.9, 0.9, 10, [0.85, 0.82, 0.74], K_PLAIN, 0, true);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      K.tube([Math.cos(a) * 0.62, 0.42, Math.sin(a) * 0.62], [Math.cos(a) * 0.14, 2.45, Math.sin(a) * 0.14], 0.04, 4, steel);
    }
    K.cyl(0, 0, 1.0, 1.6, 0.34, 0.08, 8, [0.78, 0.6, 0.22], K_PLAIN, 0, true);                // bell
    K.cyl(0, 0, 2.4, 2.56, 0.22, 0.22, 8, steel, K_PLAIN, 0, true);
    K.cyl(0, 0, 2.56, 2.86, 0.14, 0.14, 8, [1, 0.95, 0.85], K_LAMP, 0, true);
    K.cyl(0, 0, 2.86, 3.0, 0.17, 0.0, 8, steel, K_PLAIN, 0, true);
  });
}
export const BELL_LIGHT_Y = 2.7;

// A gull in flight: body and two wings (the wings flap in the vertex shader, see life.js). Looks along +x.
export function gullGeo() {
  const P = [], N = [], C = [], W = [];
  const body = [0.93, 0.93, 0.9], tip = [0.18, 0.18, 0.2], wing = [0.96, 0.96, 0.95];
  const tri = (a, b, c, col, wv) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = cross(u, v), l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let i = 0; i < 3; i++) { const q = [a, b, c][i]; P.push(q[0], q[1], q[2]); N.push(n[0] / l, n[1] / l, n[2] / l); const cc = Array.isArray(col[0]) ? col[i] : col; C.push(cc[0], cc[1], cc[2]); W.push(wv[i]); }
  };
  tri([0.3, 0, 0], [-0.2, 0.04, -0.05], [-0.2, 0.04, 0.05], body, [0, 0, 0]);
  tri([0.3, 0, 0], [-0.2, 0.04, 0.05], [-0.2, -0.05, 0], body, [0, 0, 0]);
  tri([0.3, 0, 0], [-0.2, -0.05, 0], [-0.2, 0.04, -0.05], body, [0, 0, 0]);
  tri([-0.2, 0.04, -0.05], [-0.2, 0.04, 0.05], [-0.34, 0.01, 0], body, [0, 0, 0]);
  for (const sd of [-1, 1]) {
    const a = [0.14, 0.02, sd * 0.05], b = [-0.12, 0.02, sd * 0.05], c = [-0.08, 0.02, sd * 0.62], d = [0.1, 0.02, sd * 0.55];
    tri(a, b, c, [wing, wing, tip], [0, 0, 1]); tri(a, c, d, [wing, tip, tip], [0, 1, 1]);
    tri(a, c, b, [wing, tip, wing], [0, 1, 0]); tri(a, d, c, [wing, tip, tip], [0, 1, 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute("wing", new THREE.Float32BufferAttribute(W, 1));
  g.userData.tris = P.length / 9;
  return g;
}

// A gull at rest, built into a static kit (the rock). Looks along local +x, then rotated by `heading`.
export function restingGull(K, x, y, z, heading = 0) {
  const c = Math.cos(heading), s = Math.sin(heading), W = (lx, ly, lz) => [x + lx * c - lz * s, y + ly, z + lx * s + lz * c];
  const white = [0.92, 0.92, 0.9], grey = [0.55, 0.58, 0.62];
  const box = (x0, x1, y0, y1, z0, z1, col) => K.hexa([W(x0, y0, z0), W(x1, y0, z0), W(x1, y0, z1), W(x0, y0, z1), W(x0, y1, z0), W(x1, y1, z0), W(x1, y1, z1), W(x0, y1, z1)].map(p => [p[0] - K.ox, p[1], p[2] - K.oz]), col, K_PLAIN, false, true);
  box(-0.16, 0.14, 0.09, 0.22, -0.075, 0.075, white);                // body
  box(-0.27, -0.14, 0.12, 0.2, -0.05, 0.05, grey);                    // tail
  box(0.12, 0.2, 0.2, 0.3, -0.04, 0.04, white);                       // head
  box(0.2, 0.26, 0.23, 0.26, -0.015, 0.015, [0.95, 0.65, 0.15]);      // beak
  box(-0.12, 0.08, 0.17, 0.21, -0.085, 0.085, grey);                  // folded wings
  box(-0.02, 0.0, 0.0, 0.1, -0.03, -0.02, [0.9, 0.55, 0.3]);          // legs
  box(-0.02, 0.0, 0.0, 0.1, 0.02, 0.03, [0.9, 0.55, 0.3]);
}
