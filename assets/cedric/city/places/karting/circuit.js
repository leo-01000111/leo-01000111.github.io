// The karting circuit as pure data: a closed centripetal Catmull-Rom spline through control
// points (x, z, y), resampled every ~2 m. Headings, curvature, banking and a spatial grid are
// precomputed so karts, the ground and the meshes all ask the same questions. No THREE here.
// Heading convention as everywhere: direction = (cos a, sin a) in X/Z. "Right" of travel is
// (-sin a, cos a); positive lateral offsets are on the right.

export const HW = 5;            // half width of the asphalt (the track is 10 m wide)
export const KERB = 1.1;        // kerb strip outside the asphalt
export const WALL = 4.4;        // the barrier line sits about this far outside the asphalt edge
export const LIMIT = HW + 3.55; // karts are held this far from the centre line (tyre walls start there)
const DS = 2;

const arc = (cx, cz, r, a0, a1, n, y0, y1) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, y0 + (y1 - y0) * i / n]);
  }
  return out;
};

// Start / finish line on the first point: the straight runs north along x = 206 through the
// north-east blocks, leaves the city, climbs the hills, turns at the crest and comes back down
// the east side to a double right-hander in the south-east corner of the circuit blocks.
const CP = [
  [206, -80, 0.2], [206, -104, 0.2], [206, -124, 0.7],
  // climb: a left-right chicane on the hillside
  [200, -156, 2.5], [190, -188, 5.5], [194, -218, 9.5], [216, -244, 13.5], [250, -258, 18], [286, -262, 22], [322, -262, 24.5], [346, -262, 26],
  // the crest hairpin (right, 180 degrees), back west with the city and the sea in front
  ...arc(366, -244, 18, -90, 90, 4, 26, 25.5),
  [338, -222, 24], [312, -213, 22],
  // left-hander, then the long descent south along the east edge, over the bridge
  ...arc(290, -192, 18, -90, -180, 2, 19.5, 16.5),
  [272, -165, 13], [270, -135, 9.8], [270, -105, 6.5], [270, -75, 3.4], [270, -56, 2],
  // double right-hander back into the city, onto the straight
  ...arc(254, -40, 16, 0, 90, 2, 1.2, 0.2),
  ...arc(222, -40, 16, 90, 180, 2, 0.2, 0.2),
  [206, -52, 0.2], [206, -66, 0.2],
];
const pts = [];
for (const p of CP) { const q = pts[pts.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.5) pts.push(p); }
if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1.5) pts.pop();

// ---- spline -------------------------------------------------------------------------------------
function cr(P0, P1, P2, P3, t, o) {
  const d = (A, B) => Math.pow(Math.hypot(B[0] - A[0], B[1] - A[1]), 0.5) || 1e-3;
  const t0 = 0, t1 = t0 + d(P0, P1), t2 = t1 + d(P1, P2), t3 = t2 + d(P2, P3), u = t1 + (t2 - t1) * t;
  for (let k = 0; k < 3; k++) {
    const A1 = (t1 - u) / (t1 - t0) * P0[k] + (u - t0) / (t1 - t0) * P1[k];
    const A2 = (t2 - u) / (t2 - t1) * P1[k] + (u - t1) / (t2 - t1) * P2[k];
    const A3 = (t3 - u) / (t3 - t2) * P2[k] + (u - t2) / (t3 - t2) * P3[k];
    const B1 = (t2 - u) / (t2 - t0) * A1 + (u - t0) / (t2 - t0) * A2;
    const B2 = (t3 - u) / (t3 - t1) * A2 + (u - t1) / (t3 - t1) * A3;
    o[k] = (t2 - u) / (t2 - t1) * B1 + (u - t1) / (t2 - t1) * B2;
  }
}

const dense = [];
{
  const n = pts.length, o = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const P0 = pts[(i + n - 1) % n], P1 = pts[i], P2 = pts[(i + 1) % n], P3 = pts[(i + 2) % n];
    const steps = Math.max(8, Math.ceil(Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) / 0.5));
    for (let s = 0; s < steps; s++) { cr(P0, P1, P2, P3, s / steps, o); dense.push([o[0], o[1], o[2]]); }
  }
}
const cum = [0];
for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
const total = cum[dense.length];
export const N = Math.round(total / DS), ds = total / N, LENGTH = total;
export const X = new Float32Array(N), Z = new Float32Array(N), Y = new Float32Array(N), HD = new Float32Array(N), CURV = new Float32Array(N), BANK = new Float32Array(N), BR = new Float32Array(N);
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
{
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * ds;
    while (j < dense.length - 1 && cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], u = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    X[i] = a[0] + (b[0] - a[0]) * u; Z[i] = a[1] + (b[1] - a[1]) * u; Y[i] = a[2] + (b[2] - a[2]) * u;
  }
  // smooth the profile so slopes are never kinked
  const tmp = new Float32Array(N);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < N; i++) tmp[i] = (Y[(i + N - 2) % N] + 2 * Y[(i + N - 1) % N] + 3 * Y[i] + 2 * Y[(i + 1) % N] + Y[(i + 2) % N]) / 9;
    Y.set(tmp);
  }
  for (let i = 0; i < N; i++) { const a = (i + N - 1) % N, b = (i + 1) % N; HD[i] = Math.atan2(Z[b] - Z[a], X[b] - X[a]); }
  for (let i = 0; i < N; i++) CURV[i] = wrapA(HD[(i + 1) % N] - HD[(i + N - 1) % N]) / (2 * ds);
  const cs = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -5; k <= 5; k++) s += CURV[(i + k + N) % N]; cs[i] = s / 11; }
  for (let i = 0; i < N; i++) BANK[i] = Math.max(-0.1, Math.min(0.1, cs[i] * 2.6));
}
// smoothed curvature: banking, the racing line and the kerb zones read it
export const CURV_S = new Float32Array(N);
for (let i = 0; i < N; i++) { let s = 0; for (let k = -7; k <= 7; k++) s += CURV[(i + k + N) % N]; CURV_S[i] = s / 15; }

// ---- bridge over the gully on the southbound leg -------------------------------------------------
export const GULLY = { x: 270, z: -125, half: 24 };         // the trench runs east-west across this point
for (let i = 0; i < N; i++) if (Math.abs(Z[i] - GULLY.z) < 21 && Math.abs(X[i] - GULLY.x) < 12 && Y[i] > 3) BR[i] = 1;
{ // soften the ends, so the ground and the deck blend in and out
  const f = new Uint8Array(N); for (let i = 0; i < N; i++) f[i] = BR[i] ? 1 : 0;
  for (let i = 0; i < N; i++) { let a = 0; for (let k = -6; k <= 6; k++) a += f[(i + k + N) % N]; BR[i] = a / 13; }
}
export const bridge = (() => { let a = -1, b = -1; for (let i = 0; i < N; i++) if (BR[i] > 0.5) { if (a < 0) a = i; b = i; } return { i0: a, i1: b }; })();

// ---- spatial grid ------------------------------------------------------------------------------------
const CELL = 20;
const grid = new Map();
for (let i = 0; i < N; i++) {
  const key = Math.floor(X[i] / CELL) + "," + Math.floor(Z[i] / CELL);
  let a = grid.get(key); if (!a) grid.set(key, (a = [])); a.push(i);
}
export const bounds = (() => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
  return { x0, x1, z0, z1 };
})();

const wrapI = i => ((i % N) + N) % N;
// Result record shared by project() and at(): the caller owns one and reuses it.
export function makeHit() { return { i: 0, t: 0, s: 0, x: 0, z: 0, y: 0, hd: 0, lat: 0, d: 0, bank: 0, br: 0 }; }

function refine(i, x, z, o) {
  const j = (i + 1) % N, dx = X[j] - X[i], dz = Z[j] - Z[i], l2 = dx * dx + dz * dz || 1;
  let t = ((x - X[i]) * dx + (z - Z[i]) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = X[i] + dx * t, pz = Z[i] + dz * t;
  let dh = HD[j] - HD[i]; if (dh > Math.PI) dh -= Math.PI * 2; else if (dh < -Math.PI) dh += Math.PI * 2;
  const hd = HD[i] + dh * t, c = Math.cos(hd), s = Math.sin(hd);
  o.i = i; o.t = t; o.s = (i + t) * ds; o.x = px; o.z = pz; o.hd = hd;
  o.y = Y[i] + (Y[j] - Y[i]) * t; o.bank = BANK[i] + (BANK[j] - BANK[i]) * t;
  o.lat = (x - px) * -s + (z - pz) * c; o.d = Math.hypot(x - px, z - pz); o.br = BR[i];
  return o;
}

const _a = makeHit();
// Nearest point of the loop to (x, z). hint >= 0 searches only a window of samples around it.
export function project(x, z, hint, o, win = 14) {
  let best = 1e18, bi = -1;
  if (hint >= 0) {
    for (let k = -win; k <= win; k++) { const i = wrapI(hint + k), d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < best) { best = d; bi = i; } }
  } else {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const arr = grid.get((cx + a) + "," + (cz + b));
      if (!arr) continue;
      for (let m = 0; m < arr.length; m++) { const i = arr[m], d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < best) { best = d; bi = i; } }
    }
    if (bi < 0) return null;
  }
  // the foot of the perpendicular lies on the segment before or after the nearest sample
  refine(bi, x, z, o);
  refine(wrapI(bi - 1), x, z, _a);
  if (_a.d < o.d) { const keep = o; for (const k in _a) keep[k] = _a[k]; }
  return o;
}

// Sample at arclength s (wraps). Fills i, t, s, x, z, y, hd, bank, br.
export function at(s, o) {
  const f = ((s / ds) % N + N) % N, i = Math.floor(f), t = f - i, j = (i + 1) % N;
  o.i = i; o.t = t; o.s = f * ds;
  o.x = X[i] + (X[j] - X[i]) * t; o.z = Z[i] + (Z[j] - Z[i]) * t; o.y = Y[i] + (Y[j] - Y[i]) * t;
  let dh = HD[j] - HD[i]; if (dh > Math.PI) dh -= Math.PI * 2; else if (dh < -Math.PI) dh += Math.PI * 2;
  o.hd = HD[i] + dh * t; o.bank = BANK[i] + (BANK[j] - BANK[i]) * t; o.br = BR[i];
  return o;
}

// Surface height at lateral offset `lat` from the centre line (banked, linear).
export const surfaceY = (y, bank, lat) => y - lat * bank;

// ---- racing line for the AI: lateral offset and target speed per sample --------------------------------
export const LINE = new Float32Array(N), VT = new Float32Array(N);
{
  for (let i = 0; i < N; i++) LINE[i] = Math.max(-3.2, Math.min(3.2, CURV_S[i] * 160));
  const t = new Float32Array(N);
  for (let p = 0; p < 6; p++) { for (let i = 0; i < N; i++) t[i] = (LINE[(i + N - 1) % N] + 2 * LINE[i] + LINE[(i + 1) % N]) / 4; LINE.set(t); }
  const VMAX = 25, ALAT = 12.5;
  for (let i = 0; i < N; i++) VT[i] = Math.min(VMAX, Math.sqrt(ALAT / Math.max(Math.abs(CURV_S[i]) * 0.82, 1e-4)));
  for (let k = N * 2; k >= 0; k--) { // braking: slow down before the corner
    const i = k % N, j = (i + 1) % N;
    VT[i] = Math.min(VT[i], Math.sqrt(VT[j] * VT[j] + 2 * 9 * ds));
  }
}

// Outline for the maps: one point about every `step` metres.
export function outline(step = 8) {
  const out = [], k = Math.max(1, Math.round(step / ds));
  for (let i = 0; i < N; i += k) out.push([X[i], Z[i]]);
  return out;
}
