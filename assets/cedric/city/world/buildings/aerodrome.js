// L'aérodrome: a glider field south of the street grid, along the coast. Signature: the hangar, a
// 45 m barrel-vault concrete shell that reaches over a porch towards the runway, its flanks buried in
// planted earth berms, a neon sign on its crown. Round it: a control tower (stair core, glazed cab, a
// slow white-green beacon), the runway with markings and edge lights, a winch, a windsock that follows
// a gentle wind, parked gliders, and the seaside promenade carried on south along the shore.
// Everything static goes into two buffers (opaque + glass) so the whole field costs two draw calls.
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { createKit, K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, planter, stairCore } from "../kit/parts.js";
import * as L from "../layout.js";
import { buildGlider } from "../../places/aerodrome/glider.js";
import { windAt } from "../../places/aerodrome/air.js";

const PI = Math.PI;
const ASPH = [0.065, 0.065, 0.085], RWY = [0.088, 0.088, 0.1], APRON = [0.2, 0.19, 0.19], MARK = [0.82, 0.8, 0.72], YELLOW = [0.9, 0.7, 0.18];
const FIELD = [0.125, 0.185, 0.105], OUTSK = [0.05, 0.065, 0.06], GRASS = [0.1, 0.25, 0.13];
const SAND = [0.5, 0.36, 0.26], WET = [0.32, 0.24, 0.2], CONC = [0.42, 0.4, 0.4], POLE = [0.12, 0.12, 0.14];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const DIG = { 1: "bc", 3: "abcdg", 6: "acdefg", 8: "abcdefg" };   // seven-segment digits for the runway numbers

export default function aerodrome(K0, p, X) {
  const g = X.g, W = X.world, A = L.aerodrome, R = A.runway;
  // one bucket for the whole field: one mesh each for opaque and glass
  const B = new Buf(1e5), BG = new Buf(1e5);
  for (const b of [B, BG]) { const one = { p: [], n: [], c: [], k: [] }; b.map.set("0,0", one); b.bucket = () => one; }
  const K = createKit(B, W), G = createKit(BG, W), rnd = X.rnd;
  K.at(0, 0, 0, rnd); G.at(0, 0, 0);
  const glow = (x, y, z, col, size) => W.glows.push({ x, y, z, col, size });
  const warm = [1, 0.9, 0.62], green = [0.2, 1, 0.45], red = [1, 0.18, 0.1];

  // ---- ground: mown field with stripes, fading into the outskirts; the beach carried on south ----
  const fx0 = -2, fx1 = 110, fz0 = 112.4, fz1 = 402;
  for (let x = fx0, i = 0; x < fx1; x += 8, i++) B.flat(x, Math.min(x + 8, fx1), fz0, fz1, 0, tint(FIELD, i % 2 ? 1.07 : 0.95), 1);
  for (let i = 0; i < 4; i++) {
    const c = mix(FIELD, OUTSK, (i + 1) / 5);
    B.flat(fx1 + i * 10, fx1 + i * 10 + 10, fz0, fz1 + 40, 0, c, 1);
    B.flat(fx0, fx1 + i * 10, fz1 + i * 10, fz1 + i * 10 + 10, 0, c, 1);
  }
  for (let z = 240, zi = 0; z < 432; z += 4, zi++) { // same shape as the beach in terrain.js
    const rows = [[], []];
    [z, z + 4].forEach((zz, r) => {
      const s = L.shoreX(zz);
      for (let j = 0; j <= 9; j++) { const x = (s - 6) + (L.promenade.x0 - (s - 6)) * (j / 9); rows[r].push([x, L.beachY(x, zz), zz]); }
    });
    for (let j = 0; j < 9; j++) {
      const a = rows[0][j], b = rows[0][j + 1], c = rows[1][j + 1], d = rows[1][j];
      const off = (a[0] + c[0]) / 2 - L.shoreX((a[2] + c[2]) / 2), wet = Math.max(0, 1 - Math.max(0, off) / 3);
      B.quadP(a, d, c, b, tint(off < 0 ? tint(WET, 0.8) : mix(SAND, WET, wet), 0.94 + ((zi * 7 + j * 3) % 5) * 0.025), 1);
    }
  }

  // ---- the promenade carried south along the shore: railing on the sea side, lamps, benches ----
  const P = L.promenade, pz1 = A.promenadeEnd, rail = P.x0 + 0.25;
  B.box(P.x0, P.x1, -0.1, P.y, P.z1 - 0.2, pz1, CONC, 1);
  B.flat(P.x0, P.x0 + 0.5, P.z1, pz1, P.y + 0.002, tint(CONC, 0.7));
  B.flat(P.x1 - 0.4, P.x1, P.z1, pz1, P.y + 0.002, tint(CONC, 0.8));
  for (let z = P.z1 + 6; z < pz1; z += 6) B.flat(P.x0, P.x1, z - 0.04, z + 0.04, P.y + 0.002, tint(CONC, 0.7));
  for (let z = P.z1 + 0.5; z <= pz1 + 0.01; z += 2) K.box(rail - 0.035, rail + 0.035, P.y, P.y + 1.05, z - 0.035, z + 0.035, C.steel, K_PLAIN, false);
  K.box(rail - 0.05, rail + 0.05, P.y + 1.0, P.y + 1.08, P.z1 + 0.5, pz1, C.steel, K_PLAIN, true);
  K.box(rail - 0.025, rail + 0.025, P.y + 0.55, P.y + 0.59, P.z1 + 0.5, pz1, C.steel, K_PLAIN, true);
  W.collide.addRect(rail, (P.z1 + pz1) / 2, 0.1, (pz1 - P.z1) / 2, 0, 1.1);
  const lamp = (x, z) => { // pole, arm over the walk, lit head; the props layer draws the pool of light
    K.box(x - 0.2, x + 0.2, P.y, P.y + 0.5, z - 0.2, z + 0.2, C.conc, K_RAW, false);
    K.box(x - 0.07, x + 0.07, P.y + 0.5, P.y + 4.7, z - 0.07, z + 0.07, POLE, K_PLAIN, false);
    K.box(x - 1.25, x, P.y + 4.6, P.y + 4.7, z - 0.05, z + 0.05, POLE, K_PLAIN, true);
    K.box(x - 1.35, x - 0.75, P.y + 4.42, P.y + 4.6, z - 0.2, z + 0.2, POLE, K_PLAIN, true);
    K.box(x - 1.3, x - 0.8, P.y + 4.39, P.y + 4.42, z - 0.16, z + 0.16, [1, 0.66, 0.36], K_LAMP, true);
    W.glows.push({ x: x - 1.05, y: P.y + 4.3, z, col: [1, 0.68, 0.38], size: 2.6, pool: true });
    W.collide.addCircle(x, z, 0.22, 4.7);
  };
  for (let z = P.z1 + 18; z < pz1 - 4; z += 20) lamp(-3, z);
  for (let z = P.z1 + 26; z < pz1 - 10; z += 40) { // benches facing the sea
    for (const dz of [-0.85, 0.85]) K.box(-14.18, -13.62, P.y, P.y + 0.42, z + dz - 0.12, z + dz + 0.12, C.light, K_RAW, false);
    K.box(-14.18, -13.62, P.y + 0.42, P.y + 0.48, z - 1, z + 1, C.wood, K_PLAIN, true);
    K.box(-13.63, -13.57, P.y + 0.5, P.y + 0.9, z - 1, z + 1, C.wood, K_PLAIN, true);
    W.collide.addRect(-13.9, z, 0.35, 1.0, 0, 0.9);
  }

  // ---- service road from the promenade to the hangar yard; a gate of two piers and a lintel ----
  const rz = (A.road.z0 + A.road.z1) / 2;
  B.flat(-2, 84, A.road.z0, A.road.z1, 0.012, ASPH);
  for (let x = 2; x < 80; x += 6) B.flat(x, x + 3, rz - 0.09, rz + 0.09, 0.016, [0.5, 0.45, 0.34]);
  for (const z of [A.road.z0 - 1.4, A.road.z1 + 1.4]) { K.box(2.4, 3.4, 0, 4.2, z - 0.5, z + 0.5, C.light, K_RAW, false); K.rect(2.4, 3.4, z - 0.5, z + 0.5, 4.3); }
  K.box(2.25, 3.55, 4.2, 4.45, A.road.z0 - 1.9, A.road.z1 + 1.9, C.conc, K_RAW, true);
  K.box(2.3, 3.5, 4.12, 4.2, A.road.z0 - 1.4, A.road.z1 + 1.4, [1, 0.5, 0.2], K_NEON, true);

  // ---- runway: asphalt, edge lines, threshold bars, numbers, centre dashes, aiming point ----
  const rx0 = R.x - R.w / 2, rx1 = R.x + R.w / 2, Y = 0.03;
  B.flat(rx0 - 2, rx1 + 2, R.z0 - 6, R.z1 + 6, Y - 0.004, tint(RWY, 1.35));
  B.flat(rx0, rx1, R.z0, R.z1, Y, RWY);
  for (let z = R.z0 + 8; z < R.z1 - 8; z += 24) B.flat(rx0 + 1 + (z % 5) * 0.2, rx1 - 1, z, z + 9 + (z % 7), Y + 0.002, tint(RWY, 0.88));
  for (const x of [rx0 + 0.55, rx1 - 0.55]) B.flat(x - 0.15, x + 0.15, R.z0, R.z1, Y + 0.004, MARK);
  for (let z = R.z0 + 16; z < R.z1 - 16; z += 12) B.flat(R.x - 0.17, R.x + 0.17, z, z + 4.5, Y + 0.004, MARK);
  const digit = (ch, ox, oz, up, right, w, h, t) => {
    for (const s of DIG[ch]) {
      let u0 = 0, u1 = w, v0 = h / 2 - t / 2, v1 = h / 2 + t / 2;
      if (s === "a") { v0 = h - t; v1 = h; } else if (s === "d") { v0 = 0; v1 = t; }
      else if (s === "b") { u0 = w - t; v0 = h / 2; v1 = h; } else if (s === "c") { u0 = w - t; v0 = 0; v1 = h / 2; }
      else if (s === "e") { u1 = t; v0 = 0; v1 = h / 2; } else if (s === "f") { u1 = t; v0 = h / 2; v1 = h; }
      const xa = ox + right * u0, xb = ox + right * u1, za = oz + up * v0, zb = oz + up * v1;
      B.flat(Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb), Y + 0.004, MARK);
    }
  };
  const bars = (zEdge, dir) => {
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const x = R.x + s * (2.3 + i * 0.95), za = zEdge + dir * 0.7, zb = zEdge + dir * 3.7;
      B.flat(x - 0.28, x + 0.28, Math.min(za, zb), Math.max(za, zb), Y + 0.004, MARK);
    }
  };
  bars(R.z0, 1); bars(R.z1, -1);
  // "18" at the north end is read by a pilot looking south, "36" at the south end by one looking north
  digit("1", R.x + 3.6, R.z0 + 5.5, 1, -1, 3, 5.5, 0.6); digit("8", R.x - 0.6, R.z0 + 5.5, 1, -1, 3, 5.5, 0.6);
  digit("3", R.x - 3.6, R.z1 - 5.5, -1, 1, 3, 5.5, 0.6); digit("6", R.x + 0.6, R.z1 - 5.5, -1, 1, 3, 5.5, 0.6);
  for (const dz of [0, -16]) for (const s of [-1, 1]) B.flat(R.x + s * 3.8 - 0.9, R.x + s * 3.8 + 0.9, A.touch.z + dz - 4, A.touch.z + dz + 4, Y + 0.004, MARK);
  // lights: edge posts every 16 m, green at the north end, red at the south end, an approach ladder south
  const post = (x, z, col, size, h = 0.3) => {
    K.box(x - 0.1, x + 0.1, 0, h, z - 0.1, z + 0.1, [0.15, 0.15, 0.17], K_PLAIN, false);
    K.box(x - 0.13, x + 0.13, h, h + 0.12, z - 0.13, z + 0.13, col, K_LAMP, true);
    glow(x, h + 0.2, z, col, size);
  };
  for (let z = R.z0 + 2; z <= R.z1 - 1; z += 16) for (const s of [-1, 1]) post(R.x + s * (R.w / 2 + 0.9), z, warm, 0.85);
  for (let i = 0; i < 8; i++) { const x = R.x - 7 + i * 2; post(x, R.z0 - 0.6, green, 0.9); post(x, R.z1 + 0.6, red, 0.9); }
  for (let z = R.z1 + 8; z < R.z1 + 68; z += 8) post(R.x, z, warm, 1.15, 0.5);
  for (let i = -3; i <= 3; i++) if (i) post(R.x + i * 1.6, R.z1 + 40, warm, 0.9, 0.4);

  // ---- apron in front of the hangar, tie-down yard to the south ----
  B.flat(A.apron.x0, A.apron.x1, A.apron.z0, A.apron.z1, Y, APRON);
  B.flat(A.apron.x0, A.apron.x1 + 44, 236, 274, Y, APRON);
  for (let z = A.apron.z0 + 2; z < A.apron.z1 + 38; z += 6) B.flat(A.apron.x0 + 0.15, A.apron.x0 + 0.4, z, z + 3, Y + 0.004, YELLOW);
  for (let x = 24; x < 70; x += 14) for (const z of [238, 271]) B.flat(x - 0.8, x + 0.8, z, z + 0.2, Y + 0.004, YELLOW);

  // ---- hangar: barrel-vault shell over a porch, glass front set back, berms either side ----
  K.at(p.x, p.z, "w", rnd); G.at(p.x, p.z, "w");
  const HW = p.d / 2, HD = p.w / 2;                 // 22 across, 18 deep
  const a = HW, b = 13, T = 0.55, zA = -27, zB = HD, N = 18;
  const shell = C.light, ribC = C.conc;
  const ring = (ra, rb, i) => { const t = PI * i / N; return [ra * Math.cos(t), rb * Math.sin(t)]; };
  const slab = (ra0, rb0, ra1, rb1, z0, z1, c) => {
    for (let i = 0; i < N; i++) {
      const p0 = ring(ra0, rb0, i), p1 = ring(ra0, rb0, i + 1), q0 = ring(ra1, rb1, i), q1 = ring(ra1, rb1, i + 1);
      K.hexa([[p0[0], p0[1], z0], [p0[0], p0[1], z1], [p1[0], p1[1], z1], [p1[0], p1[1], z0], [q0[0], q0[1], z0], [q0[0], q0[1], z1], [q1[0], q1[1], z1], [q1[0], q1[1], z0]], c, K_RAW, false, true);
    }
  };
  slab(a, b, a + T, b + T, zA, zB, shell);
  const ribZ = [-24, -18, -12, -6, 0, 6, 12, 17];
  for (const z of ribZ) slab(a, b, a + T + 0.9, b + T + 0.9, z - 0.45, z + 0.45, ribC);
  slab(a, b, a + T + 1.6, b + T + 1.6, zA, zA + 1.4, tint(shell, 1.06));       // the deep front rim
  for (let i = 0; i < ribZ.length - 1; i++) K.box(-2.4, 2.4, b + T + 0.02, b + T + 0.13, ribZ[i] + 1.2, ribZ[i + 1] - 1.2, C.warmLight, K_LAMP, true); // glowing slits along the crown
  for (let i = 0; i < N; i++) { // neon line round the front rim
    const p0 = ring(a + T + 1.7, b + T + 1.7, i), p1 = ring(a + T + 1.7, b + T + 1.7, i + 1);
    K.tube([p0[0], p0[1], zA - 0.02], [p1[0], p1[1], zA - 0.02], 0.1, 4, [1, 0.48, 0.2], K_NEON);
  }
  const arc = (KK, zz, ra, rb) => { const q = []; for (let i = 0; i <= N; i++) { const r = ring(ra, rb, i); q.push(KK.W(r[0], r[1] + 0.03, zz)); } return q; };
  K.face(arc(K, zB, a + 0.2, b + 0.2), tint(shell, 0.92), K_RAW, K.Nw(0, 0, 1));         // back wall, outside
  K.face(arc(K, zB - 0.15, a - 0.1, b - 0.1), [0.2, 0.19, 0.2], K_RAW, K.Nw(0, 0, -1));  // and inside
  const zg = -17;                                    // glass front under the porch: one pane, mullions, two transoms, a wide door frame
  G.face(arc(G, zg, a - 0.05, b - 0.05), [0.5, 0.62, 0.72], K_GLASS, G.Nw(0, 0, -1));
  const hAt = x => (b - 0.05) * Math.sqrt(Math.max(0, 1 - (x / (a - 0.05)) ** 2));
  for (let x = -21; x <= 21.01; x += 3) K.box(x - 0.07, x + 0.07, 0.03, Math.max(0.5, hAt(x) - 0.1), zg - 0.07, zg + 0.07, C.steel, K_PLAIN, false);
  for (const y of [4.5, 8.5]) { const hx = (a - 0.05) * Math.sqrt(Math.max(0, 1 - (y / (b - 0.05)) ** 2)) - 0.1; K.box(-hx, hx, y - 0.06, y + 0.06, zg - 0.08, zg + 0.08, C.steel, K_PLAIN, true); }
  for (const x of [-7, 7]) K.box(x - 0.14, x + 0.14, 0.03, 7.6, zg - 0.14, zg + 0.14, C.steel, K_PLAIN, false);
  K.box(-7, 7, 7.5, 7.7, zg - 0.14, zg + 0.14, C.steel, K_PLAIN, true);
  K.box(-HW + 0.6, HW - 0.6, 0, 0.035, zg, zB - 0.2, [0.13, 0.13, 0.15], K_PLAIN, false);            // inside: floor, ceiling lights, a tool wall
  for (const z of ribZ.slice(1)) K.box(-1.2, 1.2, b - 0.16, b - 0.06, z - 1.2, z + 1.2, C.warmLight, K_LAMP, true);
  K.box(-HW + 0.8, -HW + 1.4, 0.035, 5, zB - 1.8, zB - 0.4, [0.25, 0.14, 0.09], K_PLAIN, false);
  // berms either side: sloped grass, a planted terrace on top, a board-formed retaining edge, hanging vines
  const topY = 6.1;
  for (const s of [-1, 1]) {
    const xi = s * (a - 3.2), xt = s * (a + 3.0), xb = s * (a + 17);
    K.hexa([[xi, 0, -29], [xi, 0, 22], [xb, 0, 22], [xb, 0, -29], [xi, topY, -22], [xi, topY, 15], [xt, topY, 15], [xt, topY, -22]], tint(GRASS, 0.9), K_PLAIN, false, true);
    K.box(Math.min(xt, xt + s * 0.5), Math.max(xt, xt + s * 0.5), topY - 1.1, topY + 0.35, -22, 15, C.conc, K_RAW, false);
    K.bed(Math.min(s * (a + 0.8), s * (a + 2.4)), Math.max(s * (a + 0.8), s * (a + 2.4)), -20, 13, topY, 0.8);
    for (let z = -19; z <= 13; z += 5.5) K.tree(s * (a + 1.8), topY, z + (rnd() - 0.5) * 2, 0.75 + rnd() * 0.35, rnd() < 0.55 ? "pine" : "cypress");
    for (let z = -18; z < 14; z += 4 + rnd() * 3) K.vine(xt + s * 0.5, topY + 0.3, z, s, 0, 1 + rnd() * 1.2, 2.2 + rnd() * 1.6);
    K.bed(Math.min(s * (a + 8), s * (a + 14)), Math.max(s * (a + 8), s * (a + 14)), -24, 18, 0.03, 0.5);
    for (let k = 0; k < 4; k++) K.tree(s * (a + 9 + rnd() * 5), 0.05, -22 + rnd() * 40, 0.8 + rnd() * 0.4, "pine");
    K.rect(Math.min(xi, xb), Math.max(xi, xb), -28, 21, topY);
  }
  K.rect(-HW, HW, zg - 0.3, zB, b + T + 1.6);
  const sx = 5.2; // the sign: on two posts above the crown, facing the sea
  for (const x of [-sx, sx]) K.box(x - 0.1, x + 0.1, b + T + 0.1, b + T + 4.4, zA + 1.0, zA + 1.2, C.steel, K_PLAIN, false);
  K.box(-sx - 0.4, sx + 0.4, b + T + 4.3, b + T + 4.42, zA + 0.8, zA + 1.3, C.dark, K_RAW, true);
  K.sign("aerodrome", 0, b + T + 2.55, zA + 0.78, 0, -1, 12);
  // a glider on its dolly inside, two parked on the tie-down yard (nose into the wind, brought round by hand)
  const gl = K.W(0, 0, 3);
  K.at(gl[0], gl[2], PI, rnd); G.at(gl[0], gl[2], PI);
  buildGlider(K, G, 0.035 + 0.56);
  for (const [x, z, h] of [[40, 248, -1.52], [60, 256, -1.68]]) {
    K.at(x, z, h, rnd); G.at(x, z, h);
    buildGlider(K, G, 0.03 + 0.56);
    W.collide.addRect(x, z, 3, 8.5, h, 1.4);
  }

  // ---- control tower: stair core, glazed cab, a slow beacon ----
  const tw = A.tower;
  K.at(tw.x, tw.z, "w", rnd); G.at(tw.x, tw.z, "w");
  K.box(-1.8, 1.8, 0.03, 0.9, -1.8, 1.8, C.conc, K_RAW, false);
  stairCore(K, 0, 0, 1.85, 0.9, 10.6, C.conc);
  K.cyl(0, 0, 11.1, 11.55, 3.7, 3.7, 8, C.light, K_RAW, PI / 8, true);
  K.cyl(0, 0, 10.98, 11.1, 3.74, 3.74, 8, [0.1, 0.42, 0.5], K_NEON, PI / 8, true);
  G.cyl(0, 0, 11.55, 13.7, 3.4, 3.4, 8, [0.55, 0.7, 0.8], K_GLASS, PI / 8, false);
  for (let i = 0; i < 8; i++) { const t = PI / 8 + i * PI / 4; K.box(Math.cos(t) * 3.4 - 0.07, Math.cos(t) * 3.4 + 0.07, 11.55, 13.7, Math.sin(t) * 3.4 - 0.07, Math.sin(t) * 3.4 + 0.07, C.steel, K_PLAIN, false); }
  K.cyl(0, 0, 13.7, 14.2, 4.0, 3.7, 8, C.light, K_RAW, PI / 8, true);
  K.cyl(0, 0, 11.55, 11.62, 3.3, 3.3, 8, C.warmLight, K_LAMP, PI / 8, false);
  K.box(-2.0, 2.0, 11.55, 12.5, -0.6, 0.6, C.dark, K_PLAIN, false);
  K.cyl(0, 0, 14.2, 14.9, 0.55, 0.5, 8, C.steel, K_PLAIN, 0, true);
  K.cyl(0, 0, 14.9, 15.4, 0.45, 0.32, 8, [1, 1, 0.92], K_LAMP);
  K.cyl(0, 0, 15.4, 17.2, 0.05, 0.05, 5, C.steel, K_PLAIN, 0, true);
  planter(K, -3.8, -2.0, -1.6, 1.6, 0.03, { h: 0.6, vines: "l", len: 3 });
  planter(K, 2.0, 3.8, -1.6, 1.6, 0.03, { h: 0.6 });
  K.box(-0.6, 0.6, 0.9, 3.0, -1.9, -1.8, C.dark, K_PLAIN, false);
  K.circle(0, 0, 2.5, 15);
  const beacon = K.W(0, 15.15, 0);
  glow(beacon[0], beacon[1], beacon[2], [0.85, 1, 0.9], 2.2);
  glow(beacon[0], 11.8, beacon[2], [1, 0.62, 0.3], 2.0);

  // ---- winch at the north end: the launch cable runs from here ----
  const wn = A.winch;
  K.at(wn.x, wn.z, 0, rnd);
  K.box(-2.5, 2.5, 0.35, 0.95, -1.25, 1.25, C.steel, K_PLAIN, true);
  K.box(0.2, 2.5, 0.95, 2.7, -1.15, 1.15, [0.1, 0.11, 0.14], K_PLAIN, false);
  K.box(2.45, 2.52, 1.3, 2.5, -1.0, 1.0, [0.45, 0.62, 0.7], K_PLAIN, false);
  K.tube([-1.0, 1.75, -1.1], [-1.0, 1.75, 1.1], 0.85, 10, [0.9, 0.42, 0.12], K_PLAIN);
  K.tube([-1.0, 1.75, -0.4], [-1.0, 1.75, 0.4], 0.95, 10, [0.18, 0.18, 0.2], K_PLAIN);
  for (const x of [-1.6, 1.7]) for (const z of [-1.2, 1.2]) K.tube([x, 0.5, z - 0.12 * Math.sign(z)], [x, 0.5, z + 0.12 * Math.sign(z)], 0.5, 8, [0.06, 0.06, 0.07], K_PLAIN);
  K.box(1.0, 1.4, 2.7, 2.9, -0.2, 0.2, [1, 0.55, 0.1], K_LAMP, true);
  K.rect(-2.6, 2.6, -1.4, 1.4, 3);
  glow(wn.x + 1.2, 2.95, wn.z, [1, 0.6, 0.15], 1.2);

  // ---- windsock mast, and trees that close the east edge of the field and line the shore ----
  const sk = A.sock;
  K.at(sk.x, sk.z, 0, rnd);
  K.cyl(0, 0, 0.03, 0.4, 0.4, 0.3, 8, C.conc, K_RAW, 0, false);
  K.tube([0, 0.3, 0], [0, 7.2, 0], 0.09, 6, [0.82, 0.82, 0.8], K_PLAIN, 0.06);
  K.tube([0, 0.9, 0], [0, 1.5, 0], 0.095, 6, [0.9, 0.35, 0.1], K_PLAIN);
  K.tube([0, 2.5, 0], [0, 3.1, 0], 0.09, 6, [0.9, 0.35, 0.1], K_PLAIN);
  K.circle(0, 0, 0.4, 7.3);
  glow(sk.x, 0.5, sk.z + 0.9, warm, 0.7);
  K.at(0, 0, 0, rnd);
  for (let z = 120; z < 400; z += 7 + rnd() * 6) K.tree(98 + rnd() * 10, 0, z, 0.8 + rnd() * 0.5, rnd() < 0.5 ? "pine" : "cypress");
  for (let z = 118; z < 340; z += 11 + rnd() * 8) K.tree(0.5 + rnd() * 1.8, 0, z, 0.7 + rnd() * 0.4, rnd() < 0.4 ? "palm" : "pine");

  // ---- meshes: the static field (opaque + glass), the windsock, the beacon beam ----
  const grp = new THREE.Group();
  grp.name = "aerodrome";
  const m1 = new THREE.Mesh(B.geometry(), g.env.shade.world), m2 = new THREE.Mesh(BG.geometry(), g.env.shade.glass);
  grp.add(m1, m2);
  X.add(grp, [m1, m2]);
  X.stats(B.tris + BG.tris);

  const SB = new Buf(1e4), SK = createKit(SB, W);
  SK.at(0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const x0 = i * 0.62, r0 = 0.44 - i * 0.045, r1 = 0.44 - (i + 1) * 0.045;
    SK.tube([x0, 0, 0], [x0 + 0.62, 0, 0], r0, 8, i % 2 ? [0.92, 0.9, 0.86] : [0.95, 0.42, 0.12], K_PLAIN, r1);
  }
  SK.tube([-0.06, 0, 0], [0.02, 0, 0], 0.5, 8, C.steel, K_PLAIN, 0.5);
  const sock = new THREE.Mesh(SB.geometry(), g.env.shade.world);
  sock.rotation.order = "YZX";
  sock.position.set(sk.x, 7.2, sk.z);
  X.add(sock, [sock]);
  X.stats(SB.tris);

  const U = g.env.shade.uniforms;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uLights: U.uLights, uFogDen: U.uFogDen, uCam: U.uCam },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`uniform float uLights,uFogDen; uniform vec3 uCam; varying vec2 vUv; varying vec3 vW;
      void main(){ float along=smoothstep(0.,.08,vUv.x)*(1.-smoothstep(.45,1.,vUv.x)); float across=pow(max(1.-abs(vUv.y*2.-1.),0.),3.);
        float I=along*across*(.035+.3*uLights)*exp(-distance(vW,uCam)*uFogDen*.5);
        gl_FragColor=vec4(vec3(.8,1.,.88)*I,1.); }`,
  });
  const bp = [], bu = [], bi = [], BEAM = 90;
  let vi = 0;
  for (const d of [0, PI]) { // two opposite fans, each one flat and one standing, so the beam reads from the ground and from the air
    const cx = Math.cos(d), cz = Math.sin(d);
    for (const flat of [true, false]) {
      for (const [r, w] of [[0.5, 0.2], [BEAM, 1.9]]) for (const s of [0, 1]) {
        const o = (s ? 1 : -1) * w;
        bp.push(cx * r + (flat ? -cz * o : 0), flat ? 0 : o, cz * r + (flat ? cx * o : 0));
        bu.push(r / BEAM, s);
      }
      bi.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2); vi += 4;
    }
  }
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  beamGeo.setAttribute("uv", new THREE.Float32BufferAttribute(bu, 2));
  beamGeo.setIndex(bi);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(beacon[0], beacon[1], beacon[2]);
  X.add(beam, [beam]);
  X.stats(bi.length / 3);

  const wv = { dir: 0, speed: 0 };
  X.onUpdate((dt, t) => {
    windAt(t, wv);
    const wind = Math.min(1, wv.speed / 7.5);
    sock.rotation.set(0, -wv.dir, -(1 - wind) * 1.15 + Math.sin(t * 2.3 + 1) * 0.05 * wind);
    beam.rotation.y = -t * 0.38;
  });
  const pl = W.places = W.places || {};
  pl.aerodrome = Object.assign(pl.aerodrome || {}, { beam, sock });
}
