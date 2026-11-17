// Le Port: a small harbour at the north end of the promenade. A concrete quay that reaches into the
// sea, a floating pontoon with moored boats, a breakwater that curves out and round with a red
// light at its tip, a green light on the quay head, a concrete slipway under a vaulted boat shed
// and the harbour master's cabin with its teal PORT sign. Signature: the cabin's cantilevered
// glass volume over open pilotis, a planted roof and a mast above the sunset side of the quay.
// Everything static goes into one buffer of its own (one draw call); the floating, flying and
// waving parts live in places/port/life.js.
import { Buf } from "../../core/buf.js";
import { createKit, K_PLAIN, K_RAW, K_LAMP, K_GLASS, K_NEON } from "../kit/kit.js";
import { C, tint, bands, planter, roofGarden, vinesOver, stairs } from "../kit/parts.js";
import { createLife } from "../../places/port/life.js";
import { arcPoint } from "../../places/port/boat.js";
import { restingGull } from "../../places/port/models.js";

const PI = Math.PI, ORG = -0.001; // every frame origin is slightly negative, so the whole harbour lands in one buffer chunk
const HARBOUR = { conc: [0.5, 0.48, 0.46], dark: [0.1, 0.12, 0.12], stain: [0.1, 0.17, 0.16], wood: [0.38, 0.27, 0.19], rubble: [0.34, 0.32, 0.31], rust: [0.46, 0.22, 0.11] };

export default function port(_K, p, X) {
  const L = X.L, PT = L.port, W = X.world, rnd = X.rnd;
  const B = new Buf(1e6), K = createKit(B, W);
  K.at(ORG, ORG, 0, rnd);
  const q = PT.quay, y = q.y, S = PT.slip, P = PT.pontoon, BW = PT.breakwater;
  const conc = C.conc, light = C.light, dark = C.dark, steel = C.steel, wood = C.wood;
  const glow = (x, yy, z, col, size, pool) => W.glows.push({ x, y: yy, z, col, size, pool: !!pool });
  const jit = (v, a) => v + (rnd() - 0.5) * a;

  // ---- quay slab, with the slipway cut out of its west face ----
  const slab = tint(conc, 0.93);
  K.box(q.x0, q.x1, -0.9, y, q.z0, S.z0, slab, K_RAW, false);
  K.box(q.x0, q.x1, -0.9, y, S.z1, q.z1, slab, K_RAW, false);
  K.box(S.xTop, q.x1, -0.9, y, S.z0, S.z1, slab, K_RAW, false);
  const bands2 = [[q.z0, S.z0], [S.z1, q.z1]];
  for (const [a, b] of bands2) {
    K.box(q.x0 - 0.04, q.x0, -0.45, -0.1, a, b, HARBOUR.stain, K_PLAIN, false);          // waterline stain
    K.box(q.x0 - 0.01, q.x0 + 0.01, -0.1, 0.0, a, b, [0.2, 0.3, 0.2], K_PLAIN, false);   // weed line
    K.box(q.x0 + 0.15, q.x0 + 0.4, y, y + 0.008, a, b, [0.78, 0.62, 0.2], K_PLAIN, false); // painted edge
  }
  // kerb along the west edge, interrupted at the gangway and the slipway
  const gz = P.gang;
  for (const [a, b] of [[q.z0, S.z0], [S.z1, gz[2]], [gz[3], q.z1]]) K.box(q.x0, q.x0 + 0.28, y, y + 0.14, a, b, tint(light, 0.95), K_RAW, false);
  // expansion joints
  for (let z = q.z0 + 6; z < q.z1 - 1; z += 6) {
    if (z > S.z0 - 0.2 && z < S.z1 + 0.2) { K.box(S.xTop, q.x1, y, y + 0.006, z - 0.03, z + 0.03, tint(conc, 0.6), K_PLAIN, false); continue; }
    K.box(q.x0, q.x1, y, y + 0.006, z - 0.03, z + 0.03, tint(conc, 0.6), K_PLAIN, false);
  }
  // fenders: black rubber hanging on the quay wall
  for (let z = q.z0 + 5; z < q.z1 - 3; z += 6) {
    if (z > S.z0 - 1 && z < S.z1 + 1) continue;
    K.cyl(q.x0 - 0.12, z, -0.38, 0.06, 0.11, 0.11, 6, [0.05, 0.05, 0.06], K_PLAIN, 0, false);
  }
  // mooring bollards
  const bollard = (x, z, yy = y) => { K.cyl(x, z, yy, yy + 0.5, 0.17, 0.14, 8, HARBOUR.rust, K_PLAIN, 0, false); K.cyl(x, z, yy + 0.5, yy + 0.58, 0.21, 0.21, 8, tint(HARBOUR.rust, 0.7), K_PLAIN); K.circle(x, z, 0.24, 0.6); };
  for (const z of [-176, -170, -163, -156, -152, -138, -114, -111]) bollard(q.x0 + 0.75, z);
  for (const z of [-151, -141.5, -136.5]) K.box(q.x0 + 0.4, q.x0 + 0.5, y, y + 0.03, z - 0.5, z + 0.5, [0.7, 0.55, 0.15], K_PLAIN, false);

  // ---- slipway: a concrete ramp down into the water, two steel rails ----
  const ramp = (off) => [[S.xTop, y - 0.5 + off, S.z0], [S.xEnd, S.yEnd - 0.5 + off, S.z0], [S.xEnd, S.yEnd - 0.5 + off, S.z1], [S.xTop, y - 0.5 + off, S.z1]];
  const bot = ramp(0), top = ramp(0.5);
  K.hexa([...bot, ...top], tint(light, 0.88), K_RAW, true, true);
  const surf = x => y + (S.yEnd - y) * (S.xTop - x) / (S.xTop - S.xEnd);
  for (const z of [(S.z0 + S.z1) / 2 - 2.2, (S.z0 + S.z1) / 2 + 2.2]) K.tube([S.xTop + 0.2, surf(S.xTop) + 0.07, z], [S.xEnd + 2.5, surf(S.xEnd + 2.5) + 0.07, z], 0.045, 4, steel, K_PLAIN);

  // ---- boat shed: portal frames, a planted roof, open to the west on the slipway ----
  {
    const sh = PT.shed, cx = (sh.x0 + sh.x1) / 2, cz = (sh.z0 + sh.z1) / 2;
    K.at(cx, cz, "w", rnd);                           // local -z = west, x along the quay
    const hw = (sh.z1 - sh.z0) / 2, hd = (sh.x1 - sh.x0) / 2, h = 5.6;
    K.box(-hw, hw, y, y + 0.03, -hd, hd, [0.14, 0.14, 0.15], K_PLAIN, false);       // dark floor inside
    K.box(-hw, -hw + 0.55, y, y + h, -hd, hd, conc, K_RAW);                          // side walls
    K.box(hw - 0.55, hw, y, y + h, -hd, hd, conc, K_RAW);
    K.box(-hw, hw, y, y + h, hd - 0.55, hd, conc, K_RAW);                            // back wall
    for (let z = -hd + 3; z < hd - 1; z += 4.5) {                                    // portal frames (they show on the sides)
      K.box(-hw - 0.18, -hw + 0.1, y, y + h + 0.5, z - 0.3, z + 0.3, light, K_RAW); K.box(hw - 0.1, hw + 0.18, y, y + h + 0.5, z - 0.3, z + 0.3, light, K_RAW);
      if (z + 2.25 < hd - 1.5) { // slit windows between the frames
        K.box(-hw - 0.03, -hw + 0.02, y + 3.7, y + 4.3, z + 2.25 - 1.5, z + 2.25 + 1.5, [0.04, 0.05, 0.07], K_GLASS, false);
        K.box(hw - 0.02, hw + 0.03, y + 3.7, y + 4.3, z + 2.25 - 1.5, z + 2.25 + 1.5, [0.04, 0.05, 0.07], K_GLASS, false);
      }
    }
    K.box(-hw - 0.1, -hw + 0.8, y, y + h + 0.5, -hd - 0.3, -hd + 0.5, light, K_RAW);   // the portal at the open end
    K.box(hw - 0.8, hw + 0.1, y, y + h + 0.5, -hd - 0.3, -hd + 0.5, light, K_RAW);
    K.box(-hw - 0.1, hw + 0.1, y + h - 0.5, y + h + 0.5, -hd - 0.3, -hd + 0.5, light, K_RAW);
    K.box(-hw - 0.4, hw + 0.4, y + h + 0.5, y + h + 0.95, -hd - 2.2, hd + 0.4, tint(conc, 1.03), K_RAW, true);   // roof slab, cantilevered at the front
    K.box(-hw - 0.4, hw + 0.4, y + h + 0.95, y + h + 1.4, -hd - 2.2, -hd - 1.9, tint(conc, 0.9), K_RAW, false);  // fascia lip
    for (const sd of [-1, 1]) K.box(sd * (hw + 0.4) - (sd > 0 ? 0.25 : 0), sd * (hw + 0.4) + (sd > 0 ? 0 : 0.25), y + h + 0.95, y + h + 1.4, -hd - 2.2, hd + 0.4, tint(conc, 0.9), K_RAW, false);
    K.box(-hw + 0.5, hw - 0.5, y + h + 0.95, y + h + 1.1, -hd - 1.9, hd, [0.17, 0.13, 0.09], K_PLAIN, false);   // soil
    K.bed(-hw + 0.5, hw - 0.5, -hd - 1.5, hd - 0.4, y + h + 1.1, 0.8);
    K.tree(-hw + 1.6, y + h + 1.1, hd - 3, 0.5, "palm"); K.tree(hw - 1.6, y + h + 1.1, hd - 5, 0.45, "pine");
    vinesOver(K, -hw, hw, -hd - 2.2, hd, y + h + 1.4, "f", 3.4, 0.7); vinesOver(K, -hw, hw, -hd, hd, y + h + 0.95, "l", 4.5, 0.55); vinesOver(K, -hw, hw, -hd, hd, y + h + 0.95, "r", 4.5, 0.55);
    // inside: a hull on trestles, light strips, crates
    K.hexa([[-1.1, y + 0.9, -hd + 1.8], [1.1, y + 0.9, -hd + 1.8], [0.9, y + 0.9, hd - 2.2], [-0.9, y + 0.9, hd - 2.2], [-0.5, y + 1.7, -hd + 3.5], [0.5, y + 1.7, -hd + 3.5], [0.4, y + 1.6, hd - 3.4], [-0.4, y + 1.6, hd - 3.4]], [0.5, 0.18, 0.12], K_PLAIN, true, true);
    for (const z of [-hd + 3, hd - 4]) { K.box(-1.4, 1.4, y, y + 0.9, z - 0.15, z + 0.15, wood, K_PLAIN, false); }
    K.box(-hw + 0.6, hw - 0.6, y + h - 0.25, y + h - 0.18, -hd + 1.2, -hd + 1.4, C.warmLight, K_LAMP, true);
    K.box(-hw + 0.6, hw - 0.6, y + h - 0.25, y + h - 0.18, 0, 0.2, C.warmLight, K_LAMP, true);
    for (const [gx, gzz] of [[0, -hd + 2], [0, 0], [0, hd - 3]]) { const w = K.W(gx, y + h - 0.5, gzz); glow(w[0], w[1], w[2], [1, 0.62, 0.3], 4.2, false); }
    for (let i = 0; i < 5; i++) K.obox(-hw + 1.5 + (i % 2) * 0.1, hd - 1.4 - i * 0.9, 0.4, 0.4, rnd() * 0.5, y, y + 0.7 + (i % 3) * 0.05, tint(wood, 0.9 + i * 0.05), K_PLAIN);
    K.rect(-hw - 0.4, hw + 0.4, -hd - 0.3, hd + 0.4, 6.5);
    K.at(ORG, ORG, 0, rnd);
  }

  // ---- crates, nets and a drying rack beside the shed ----
  const crate = (x, z, a, lvl, c = HARBOUR.wood) => K.obox(x, z, 0.42, 0.32, a, y + lvl * 0.5, y + lvl * 0.5 + 0.5, tint(c, 0.85 + rnd() * 0.3), K_PLAIN, lvl > 0);
  for (const [x, z, a] of [[-27.5, -137.2, 0.1], [-26.4, -137.4, -0.05], [-27.0, -137.3, 0.2]]) { crate(x, z, a, 0); }
  crate(-27.0, -137.3, 0.15, 1); crate(-26.0, -137.4, 0.05, 1); crate(-27.2, -137.3, 0.1, 2, [0.5, 0.36, 0.2]);
  K.rect(-28.4, -25.4, -138, -136.6, 1.6);
  for (const [x, z] of [[-29, -138.5], [-29.2, -139.6]]) crate(x, z, rnd(), 0, [0.2, 0.34, 0.4]);
  for (let i = 0; i < 3; i++) K.tube([-24.2, y + 0.35, -141 + i * 0.8], [-24.2, y + 0.35, -140.4 + i * 0.8], 0.34, 7, [0.1, 0.32, 0.36], K_PLAIN);   // rolled net
  K.rect(-25, -23.4, -142, -139.2, 0.9);
  { // net rack on the quay edge south of the slipway: two posts, a pole, a hanging net, orange floats
    const rx = -31.4, rz0 = -119, rz1 = -114;
    for (const z of [rz0, rz1]) K.box(rx - 0.08, rx + 0.08, y, y + 2.6, z - 0.08, z + 0.08, wood, K_PLAIN);
    K.box(rx - 0.05, rx + 0.05, y + 2.45, y + 2.55, rz0, rz1, tint(wood, 0.8), K_PLAIN, true);
    for (let i = 0; i < 12; i++) { const z = rz0 + 0.2 + i * (rz1 - rz0 - 0.4) / 11; K.box(rx - 0.012, rx + 0.012, y + 0.7, y + 2.45, z - 0.012, z + 0.012, [0.09, 0.22, 0.26], K_PLAIN, false); }
    for (let j = 0; j < 6; j++) K.box(rx - 0.012, rx + 0.012, y + 0.7 + j * 0.29, y + 0.72 + j * 0.29, rz0 + 0.2, rz1 - 0.2, [0.09, 0.22, 0.26], K_PLAIN, false);
    for (let i = 0; i < 6; i++) K.box(rx - 0.05, rx + 0.05, y + 0.62, y + 0.72, rz0 + 0.3 + i * 0.85, rz0 + 0.42 + i * 0.85, [1, 0.45, 0.15], K_PLAIN, true);
    K.rect(rx - 0.3, rx + 0.3, rz0 - 0.2, rz1 + 0.2, 2.7);
  }

  // ---- lamps: warm, on the quay ----
  const lamp = (x, z, a) => {
    const lx = Math.cos(a), lz = Math.sin(a);
    K.box(x - 0.2, x + 0.2, y, y + 0.5, z - 0.2, z + 0.2, tint(conc, 1.05), K_RAW, false);
    K.box(x - 0.07, x + 0.07, y + 0.5, y + 4.7, z - 0.07, z + 0.07, [0.12, 0.12, 0.14], K_PLAIN, false);
    K.tube([x, y + 4.6, z], [x + lx * 1.1, y + 4.6, z + lz * 1.1], 0.05, 4, [0.12, 0.12, 0.14], K_PLAIN);
    K.box(x + lx * 1.1 - 0.3, x + lx * 1.1 + 0.3, y + 4.38, y + 4.58, z + lz * 1.1 - 0.2, z + lz * 1.1 + 0.2, [0.12, 0.12, 0.14], K_PLAIN, true);
    K.box(x + lx * 1.05 - 0.25, x + lx * 1.05 + 0.25, y + 4.35, y + 4.38, z + lz * 1.05 - 0.16, z + lz * 1.05 + 0.16, [1, 0.66, 0.36], K_LAMP, true);
    glow(x + lx * 1.05, y + 4.3, z + lz * 1.05, [1, 0.68, 0.38], 2.6, true);
    K.circle(x, z, 0.24, 4.7);
  };
  for (const [x, z, a] of [[-31.6, -172, PI], [-31.6, -160, PI], [-31.6, -150, PI], [-31.6, -138, PI], [-31.6, -111, PI], [-14.5, -168, PI], [-14.5, -138, PI], [2.5, -172, -PI / 2], [2.5, -128, PI], [2.5, -114, PI]]) lamp(x, z, a);

  // ---- pontoon: floating spine and fingers, a gangway, piles with warm lamps ----
  {
    const [x0, x1, z0, z1] = P.spine, py = P.y, plank = tint(wood, 1.05), line = tint(wood, 0.65);
    K.box(x0, x1, -0.45, py, z0, z1, plank, K_PLAIN, false);
    K.box(x0 + 0.15, x1 - 0.15, -0.7, -0.4, z0 + 0.2, z1 - 0.2, HARBOUR.dark, K_PLAIN, false);
    for (let z = z0 + 1; z < z1; z += 1.1) K.box(x0, x1, py, py + 0.005, z, z + 0.04, line, K_PLAIN, false);
    for (const fz of P.fingers) {
      const fx0 = x0 - P.fingerLen, fw = P.fingerW / 2;
      K.box(fx0, x0, -0.45, py, fz - fw, fz + fw, plank, K_PLAIN, false);
      for (let x = fx0 + 0.5; x < x0; x += 1.1) K.box(x, x + 0.04, py, py + 0.005, fz - fw, fz + fw, line, K_PLAIN, false);
      K.cyl(fx0, fz + fw + 0.2, -1.2, 1.15, 0.15, 0.13, 8, [0.2, 0.15, 0.11], K_PLAIN, 0, true);   // pile at the finger end
    }
    // gangway: a ramp from the quay edge down to the spine, rails on both sides
    const a = gz, ya = y, yb = py;
    K.hexa([[a[1], ya - 0.12, a[2]], [a[0], yb - 0.12, a[2]], [a[0], yb - 0.12, a[3]], [a[1], ya - 0.12, a[3]], [a[1], ya, a[2]], [a[0], yb, a[2]], [a[0], yb, a[3]], [a[1], ya, a[3]]], tint(steel, 1.5), K_PLAIN, true, true);
    for (const z of [a[2] + 0.06, a[3] - 0.06]) { K.tube([a[1], ya + 0.95, z], [a[0], yb + 0.95, z], 0.035, 4, steel, K_PLAIN); for (const t of [0.1, 0.5, 0.9]) { const x = a[1] + (a[0] - a[1]) * t, yy = ya + (yb - ya) * t; K.box(x - 0.03, x + 0.03, yy, yy + 0.95, z - 0.03, z + 0.03, steel, K_PLAIN, false); } }
    // piles along the spine's east side, the first four carry a warm lamp
    for (const z of [-171.5, -161.5, -151.5, -138]) {
      K.cyl(x1 + 0.15, z, -1.2, 1.5, 0.17, 0.15, 8, [0.2, 0.15, 0.11], K_PLAIN, 0, true);
      K.box(x1 + 0.02, x1 + 0.28, 1.5, 1.62, z - 0.14, z + 0.14, [0.12, 0.12, 0.14], K_PLAIN, true);
      K.box(x1 + 0.04, x1 + 0.26, 1.62, 1.82, z - 0.12, z + 0.12, [1, 0.66, 0.36], K_LAMP, true);
      glow(x1 + 0.15, 1.78, z, [1, 0.66, 0.36], 2.2, false);
    }
    // cleats at the berth, a dock box and a coiled line
    for (const z of [PT.berth.z - 1.8, PT.berth.z + 1.8]) K.box(x0 + 0.1, x0 + 0.45, py, py + 0.12, z - 0.12, z + 0.12, [0.6, 0.6, 0.62], K_PLAIN, true);
    K.box(x1 - 1.2, x1 - 0.2, py, py + 0.55, -139.3, -137.3, tint(wood, 0.8), K_PLAIN, true);
    K.cyl(x0 + 0.8, -146, py, py + 0.12, 0.3, 0.3, 8, [0.8, 0.7, 0.5], K_PLAIN, 0, false);
  }

  // ---- breakwater: straight walkable leg, then the curve, rubble armour, a light at the tip ----
  {
    const zc = BW.z, hw = BW.w / 2, top = BW.y, conc2 = tint(conc, 0.97);
    K.box(BW.xEnd, BW.xRoot - 6, -0.9, top, zc - hw, zc + hw, conc2, K_RAW, false);
    K.hexa([[BW.xRoot, -0.9, zc - hw], [BW.xRoot - 6, -0.9, zc - hw], [BW.xRoot - 6, -0.9, zc + hw], [BW.xRoot, -0.9, zc + hw], [BW.xRoot, y, zc - hw], [BW.xRoot - 6, top, zc - hw], [BW.xRoot - 6, top, zc + hw], [BW.xRoot, y, zc + hw]], conc2, K_RAW, true, true);
    K.box(BW.xEnd, BW.xRoot - 6, top, 1.55, zc - hw - 0.1, zc - hw + 0.5, tint(conc, 0.9), K_RAW, false);       // wave wall on the sea side
    K.box(BW.xEnd, BW.xRoot - 6, top, top + 0.2, zc + hw - 0.25, zc + hw, tint(light, 0.95), K_RAW, false);       // low kerb on the harbour side
    const A = BW.arc, n = 11, step = A.sweep / n, len = 2 * A.r * Math.sin(step * PI / 360);
    for (let i = 0; i < n; i++) {
      const m = arcPoint((i + 0.5) * step), rot = Math.atan2(m.tz, m.tx);
      K.obox(m.x, m.z, len / 2 + 0.15, hw, rot, -0.9, top, conc2, K_RAW, false);
      const nx = -m.tz, nz = m.tx;          // tangent turned a quarter; `out` picks the side away from the arc's centre
      const out = ((m.x - A.cx) * nx + (m.z - A.cz) * nz) > 0 ? 1 : -1;
      K.obox(m.x + nx * out * (hw - 0.2), m.z + nz * out * (hw - 0.2), len / 2 + 0.15, 0.3, rot, top, 1.5, tint(conc, 0.9), K_RAW, false);
    }
    // rubble: tilted boulders on the sea side of the leg and the curve, a few on the inner side
    const boulder = (x, z, s, y0) => {
      const P8 = [], r = s, a = rnd() * 3, c = Math.cos(a), si = Math.sin(a);
      for (const yy of [y0, y0 + s * 1.1]) for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const j = 0.22, lx = (u + (rnd() - 0.5) * j) * r * (yy === y0 ? 1 : 0.8), lz = (v + (rnd() - 0.5) * j) * r * (yy === y0 ? 1 : 0.8); P8.push([x + lx * c - lz * si, yy + (rnd() - 0.5) * 0.2, z + lx * si + lz * c]); }
      K.hexa(P8, tint(HARBOUR.rubble, 0.75 + rnd() * 0.45), K_RAW, false, true);
    };
    for (let x = BW.xEnd + 1; x < BW.xRoot - 7; x += 1.5) { boulder(x, jit(zc - hw - 1.1, 0.5), 0.55 + rnd() * 0.3, -0.5 + rnd() * 0.2); if (rnd() < 0.8) boulder(jit(x, 0.6), zc - hw - 2.3, 0.5 + rnd() * 0.3, -0.7); if (rnd() < 0.4) boulder(x, zc + hw + 0.9, 0.4 + rnd() * 0.2, -0.45); }
    for (let i = 0; i < n * 2; i++) {
      const ph = (i + 0.5) * step / 2, m = arcPoint(ph), nx = -m.tz, nz = m.tx, out = ((m.x - A.cx) * nx + (m.z - A.cz) * nz) > 0 ? 1 : -1;
      boulder(m.x + nx * out * (hw + 0.9), m.z + nz * out * (hw + 0.9), 0.55 + rnd() * 0.3, -0.45);
      boulder(m.x + nx * out * (hw + 2.1), m.z + nz * out * (hw + 2.1), 0.5 + rnd() * 0.3, -0.7);
      if (i % 2) boulder(m.x - nx * out * (hw + 0.8), m.z - nz * out * (hw + 0.8), 0.4 + rnd() * 0.2, -0.45);
    }
    // the red light at the tip
    const t = arcPoint(A.sweep);
    K.cyl(t.x, t.z, top, top + 3.4, 0.55, 0.4, 8, tint(conc, 1.1), K_RAW, 0, false);
    K.cyl(t.x, t.z, top + 3.4, top + 3.55, 0.5, 0.5, 8, steel, K_PLAIN, 0, true);
    K.cyl(t.x, t.z, top + 3.55, top + 4.35, 0.3, 0.3, 8, [1, 0.12, 0.08], K_LAMP, 0, true);
    K.cyl(t.x, t.z, top + 4.35, top + 4.75, 0.4, 0.05, 8, steel, K_PLAIN, 0, true);
    // a green stub at the end of the walkable leg, a pair of bollards that close the way
    for (const z of [zc - 0.9, zc + 0.9]) bollard(BW.xEnd + 0.4, z, top);
    K.circle(BW.xEnd + 0.4, zc, 1.3, 1.0);
  }
  { // the green light on the quay head
    const hx = q.x0 + 0.5, hz = q.z1 - 0.5;
    K.cyl(hx, hz, y, y + 3.4, 0.32, 0.24, 8, tint(conc, 1.1), K_RAW, 0, false);
    K.cyl(hx, hz, y + 3.4, y + 3.55, 0.4, 0.4, 8, steel, K_PLAIN, 0, true);
    K.cyl(hx, hz, y + 3.55, y + 4.45, 0.26, 0.26, 8, [0.15, 1, 0.3], K_LAMP, 0, true);
    K.cyl(hx, hz, y + 4.45, y + 4.85, 0.34, 0.05, 8, steel, K_PLAIN, 0, true);
    K.circle(hx, hz, 0.45, 5);
  }

  // ---- harbour master's cabin: glazed volume over open pilotis, a planted roof, a mast, the PORT sign ----
  {
    const c = PT.cabin;
    K.at(c.x, c.z, "w", rnd);                  // local x along the quay, -z towards the sea
    const hx = c.d / 2, hz = c.w / 2;
    const warm = C.warm, y1 = y + 3.0, y2 = y1 + 3.4;
    K.box(-hx - 0.5, hx + 0.5, y, y + 0.12, -hz - 2.6, hz + 0.5, tint(conc, 1.08), K_RAW, false);     // plinth, wider than the building
    for (const [x, z] of [[-hx + 0.4, -hz - 0.6], [hx - 0.4, -hz - 0.6], [-hx + 0.4, hz - 0.5], [hx - 0.4, hz - 0.5], [0, -hz - 0.6]]) K.cyl(x, z, y + 0.12, y1, 0.34, 0.34, 10, conc, K_RAW);
    K.box(-hx * 0.2, hx, y + 0.12, y1, 0.3, hz, conc, K_RAW);                                         // stair and service core
    K.box(-hx + 0.6, -hx * 0.2 - 0.3, y + 0.12, y1 - 0.2, 0.35, hz - 0.5, [0.05, 0.07, 0.1], K_GLASS, false);   // lobby glass
    for (let x = -hx + 0.6; x < -hx * 0.2; x += 1.1) K.box(x, x + 0.5, y1 - 0.5, y1 - 0.44, -hz - 0.4, -hz - 0.3, C.warmLight, K_LAMP, true);
    // the cantilevered glass volume
    const top = bands(K, -hx, hx, -hz - 1.6, hz, y1, y2, { sides: "lrf", piers: 2.4, c: warm, rec: 0.5 });
    K.box(-hx - 0.1, hx + 0.1, y1 - 0.05, y1 + 0.35, -hz - 1.7, hz + 0.1, tint(warm, 0.9), K_RAW, true);
    K.box(-hx, hx, top - 0.06, top + 0.02, -hz - 1.62, -hz - 1.55, X.neon.port || [0.28, 0.9, 0.82], K_NEON, true);
    roofGarden(K, -hx, hx, -hz - 1.6, hz, top, { c: warm, pergola: true });
    // mast with a yard and two lamps
    K.tube([hx - 1.1, top, hz - 1.2], [hx - 1.1, top + 7.2, hz - 1.2], 0.07, 5, C.steel);
    K.tube([hx - 1.1 - 1.0, top + 5.6, hz - 1.2], [hx - 1.1 + 1.0, top + 5.6, hz - 1.2], 0.04, 4, C.steel);
    K.box(hx - 1.17, hx - 1.03, top + 7.1, top + 7.35, hz - 1.27, hz - 1.13, [1, 0.92, 0.7], K_LAMP, true);
    K.box(hx - 2.2, hx - 2.1, top + 5.5, top + 5.6, hz - 1.27, hz - 1.13, [1, 0.15, 0.1], K_LAMP, true);
    K.box(hx - 0.1, hx, top + 5.5, top + 5.6, hz - 1.27, hz - 1.13, [0.15, 1, 0.3], K_LAMP, true);
    const m = K.W(hx - 1.1, top + 7.25, hz - 1.2); glow(m[0], m[1], m[2], [1, 0.9, 0.7], 3, false);
    // the sign, high on the sea side of the roof, on a steel frame
    for (const sx of [-3.2, 3.2]) K.box(sx - 0.07, sx + 0.07, top, top + 2.55, -hz - 1.45, -hz - 1.3, steel, K_PLAIN);
    K.box(-3.45, 3.45, top + 1.45, top + 2.55, -hz - 1.42, -hz - 1.34, [0.05, 0.06, 0.09], K_PLAIN, true);
    K.sign("port", 0, top + 2.0, -hz - 1.55, 0, -1, 6.4);
    // external stair up the north side, a lamp at its foot
    stairs(K, hx + 0.35, hx + 1.55, -hz, hz + 0.6, y, y1, 14);
    K.box(hx + 0.35, hx + 1.55, y1 - 0.1, y1, hz + 0.6, hz + 1.8, tint(conc, 1.05), K_RAW, true);
    // planters with trees round the front, a bench
    planter(K, -hx - 0.2, -hx + 3.2, -hz - 4.6, -hz - 3.6, y, { h: 0.6, vines: "f", len: 1.2, dens: 0.5 }); K.tree(-hx + 1.4, y + 0.5, -hz - 4.1, 0.8, "plane");
    planter(K, hx - 3.2, hx + 0.2, -hz - 4.6, -hz - 3.6, y, { h: 0.6, vines: "f", len: 1.2, dens: 0.5 }); K.tree(hx - 1.4, y + 0.5, -hz - 4.1, 0.8, "plane");
    K.rect(-hx - 0.4, hx + 1.7, -hz - 0.9, hz + 0.9, 8);
    K.rect(-hx - 0.2, -hx + 3.2, -hz - 4.6, -hz - 3.6, 1.2); K.rect(hx - 3.2, hx + 0.2, -hz - 4.6, -hz - 3.6, 1.2);
    glow(...K.W(0, y1 - 0.4, -hz - 1.7), [1, 0.62, 0.3], 4.5, false);
    K.at(ORG, ORG, 0, rnd);
  }

  // ---- planting along the inland edge ----
  for (let z = q.z0 + 7; z < q.z1 - 4; z += 10) {
    if (Math.abs(z - PT.cabin.z) < 6) continue;
    planter(K, 9, 13, z - 0.8, z + 0.8, y, { h: 0.6, vines: z % 2 ? "l" : null, len: 1.4, dens: 0.4 });
    K.tree(11, y + 0.5, z, 0.9 + rnd() * 0.4, rnd() < 0.5 ? "plane" : "pine");
    K.rect(9, 13, z - 0.8, z + 0.8, 1.2);
  }
  K.bed(-3, 8, q.z0 + 2, q.z0 + 5, y, 0.5);

  // ---- the rock, far out in the sunset's path, with resting gulls ----
  {
    const R = PT.rock, base = -0.9;
    const stone = (cx, cz, r, h, tilt) => {
      const P8 = [];
      for (const yy of [base, h]) for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + tilt + (rnd() - 0.5) * 0.5, rr = r * (yy === base ? 1 : 0.55) * (0.85 + rnd() * 0.3); P8.push([cx + Math.cos(a) * rr, yy + (yy === base ? 0 : (rnd() - 0.5) * 0.35), cz + Math.sin(a) * rr]); }
      K.hexa(P8, tint([0.2, 0.18, 0.18], 0.8 + rnd() * 0.5), K_RAW, false, true);
    };
    stone(R.x, R.z, R.r, 1.1, 0.2); stone(R.x - 1.2, R.z + 0.8, R.r * 0.7, 1.9, 0.9); stone(R.x + 1.3, R.z - 0.9, R.r * 0.6, 1.5, 1.4); stone(R.x + 0.2, R.z + 0.2, R.r * 0.45, 2.5, 0.5); stone(R.x - 2.4, R.z - 1.6, R.r * 0.45, 0.8, 2.1);
    for (const [dx, dz] of [[0.1, 0.1], [-1.2, 0.9], [1.3, -0.8]]) K.box(R.x + dx - 0.35, R.x + dx + 0.35, 2.0 + (dx === 0.1 ? 0.45 : -0.55), 2.03 + (dx === 0.1 ? 0.45 : -0.55), R.z + dz - 0.3, R.z + dz + 0.3, [0.85, 0.85, 0.82], K_PLAIN, false);   // guano
    restingGull(K, R.x + 0.1, 2.93, R.z + 0.1, 0.6); restingGull(K, R.x + 0.45, 2.93, R.z - 0.1, 2.2); restingGull(K, R.x - 1.2, 1.38, R.z + 0.9, 3.4);
    restingGull(K, R.x + 1.3, 1.9, R.z - 0.8, 1.1); restingGull(K, R.x - 0.4, 2.93, R.z + 0.4, 5.2);
  }

  // ---- build ----
  const group = B.build(X.g.env.shade.world, "port");
  X.add(group, group.children);
  X.stats(B.tris);
  const life = createLife(X.g, X);
  W.port = life;
  X.onUpdate((dt, t) => life.update(dt, t));
}
