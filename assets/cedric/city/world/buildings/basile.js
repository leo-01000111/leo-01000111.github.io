// Chez Basile: a five-storey seafront block whose whole roof is a bar terrace facing the sunset.
// An external glass elevator on the street side carries guests up; the place door is at its
// foot. Signature: the lit roof terrace (pergola, parasols, string lights, glass balustrade)
// above a planted facade of deep sea-facing balconies.
// The cabin is its own mesh; the handle goes to g.world.places.basile.elevator (ride: later phase).
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { createKit, K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, bands, parapet, planter, roofGarden, vinesOver } from "../kit/parts.js";

export const ROOF_Y = 16.4;

export default function basile(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const G = X.glass; G.at(p.x, p.z, "w");
  const hw = p.d / 2, hd = p.w / 2, amber = X.neon.basile, warm = C.warm;
  const f0 = -hd + 2.8, b1 = 2.5;           // facade line behind the elevator, back of the block
  const ex0 = -1.35, ex1 = 1.35;             // elevator shaft across x, from -hd to f0

  // ground floor: glazed lobby / café, deep recess under the first floor
  K.box(-hw, hw, 0, 0.15, f0, b1, C.dark, K_RAW, false);
  K.box(-hw + 0.9, hw - 0.9, 0.15, 3.2, f0 + 1.2, b1 - 0.5, C.glass, K_GLASS, false);
  for (const x of [-hw + 0.35, -hw / 2, hw / 2, hw - 0.35]) K.box(x - 0.35, x + 0.35, 0.15, 3.2, f0, f0 + 0.7, warm, K_RAW);
  for (let x = -hw + 1.6; x < hw - 1; x += 2.2) if (Math.abs(x) > 2) K.box(x - 0.2, x + 0.2, 3.12, 3.2, f0 + 0.3, f0 + 0.6, C.warmLight, K_LAMP, true);
  // four storeys, glazing on every side; deep balconies with planters on the sea side
  const top = bands(K, -hw, hw, f0, b1, 3.2, 16.0, { sides: "lrfb", piers: 2.6, c: warm, cap: 0.4 });
  for (let y = 3.2; y < 15.9; y += 3.2) {
    K.box(-hw - 0.2, hw + 0.2, y, y + 0.32, f0 - 1.8, f0, tint(warm, 1.05), K_RAW, true);
    for (const s of [[-hw - 0.2, ex0 - 0.2], [ex1 + 0.2, hw + 0.2]]) {
      planter(K, s[0], s[1], f0 - 1.8, f0 - 1.25, y + 0.32, { h: 0.55, t: 0.12, c: warm, vines: "f", len: 2.4, dens: 0.55 });
      G.box(s[0] + 0.1, s[1] - 0.1, y + 0.87, y + 1.25, f0 - 1.76, f0 - 1.7, [0.7, 0.85, 0.9], K_GLASS);
    }
    for (const x of [-hw - 0.2, hw]) K.box(x, x + 0.2, y + 0.32, y + 3.2, f0 - 1.8, f0 - 1.5, warm, K_RAW, false);
  }
  vinesOver(K, -hw, hw, f0, b1, top, "l", 7, 0.5);
  vinesOver(K, -hw, hw, f0, b1, top, "r", 7, 0.5);

  // ---- the roof bar ----
  const y = top;                        // walkable floor height (16.4)
  const rx0 = -hw + 0.3, rx1 = hw - 0.3, rz0 = f0 + 0.3, rz1 = b1 - 0.3;
  K.box(-hw + 0.25, hw - 0.25, y, y + 0.05, f0 + 0.25, b1 - 0.25, tint(C.wood, 0.95), K_PLAIN, false);  // deck
  for (let z = f0 + 0.5; z < b1; z += 0.9) K.box(-hw + 0.25, hw - 0.25, y + 0.05, y + 0.06, z, z + 0.04, tint(C.wood, 0.7), K_PLAIN, false);
  // parapet + glass balustrade all round, with a gap where the elevator opens
  parapet(K, -hw, hw, f0, b1, y, 0.45, 0.25, warm, "f");
  K.box(-hw, ex0 - 0.2, y, y + 0.45, f0, f0 + 0.25, warm, K_RAW, false);
  K.box(ex1 + 0.2, hw, y, y + 0.45, f0, f0 + 0.25, warm, K_RAW, false);
  const gl = [0.65, 0.8, 0.9];
  G.box(-hw + 0.08, ex0 - 0.2, y + 0.45, y + 1.15, f0 + 0.1, f0 + 0.14, gl, K_GLASS);
  G.box(ex1 + 0.2, hw - 0.08, y + 0.45, y + 1.15, f0 + 0.1, f0 + 0.14, gl, K_GLASS);
  G.box(-hw + 0.08, hw - 0.08, y + 0.45, y + 1.15, b1 - 0.14, b1 - 0.1, gl, K_GLASS);
  G.box(-hw + 0.1, -hw + 0.14, y + 0.45, y + 1.15, f0 + 0.1, b1 - 0.1, gl, K_GLASS);
  G.box(hw - 0.14, hw - 0.1, y + 0.45, y + 1.15, f0 + 0.1, b1 - 0.1, gl, K_GLASS);
  for (const [a, b] of [[-hw, ex0 - 0.2], [ex1 + 0.2, hw]]) K.box(a, b, y + 1.15, y + 1.21, f0 + 0.06, f0 + 0.2, C.steel, K_PLAIN, true);
  K.box(-hw, hw, y + 1.15, y + 1.21, b1 - 0.2, b1 - 0.06, C.steel, K_PLAIN, true);
  for (const x of [-hw + 0.06, hw - 0.2]) K.box(x, x + 0.14, y + 1.15, y + 1.21, f0, b1, C.steel, K_PLAIN, true);
  K.box(-hw - 0.05, hw + 0.05, y - 0.12, y - 0.04, f0 - 0.05, f0 + 0.05, amber, K_NEON, true);   // amber line under the roof edge

  // central island (walk loop of 2.2-3 m all round): bar counter under a pergola, parasols at the corners
  const ix0 = -5.6, ix1 = 5.6, iz0 = rz0 + 3.0, iz1 = rz1 - 2.6;
  const bz = (iz0 + iz1) / 2;
  K.box(-2.6, 2.6, y, y + 1.1, bz - 0.5, bz + 0.5, tint(C.wood, 1.1), K_PLAIN, false);           // counter
  K.box(-2.75, 2.75, y + 1.1, y + 1.17, bz - 0.62, bz + 0.62, C.cream, K_PLAIN, true);
  K.box(-2.4, 2.4, y + 0.85, y + 0.95, bz - 0.64, bz - 0.6, amber, K_NEON, true);
  K.box(-2.4, 2.4, y, y + 2.2, bz + 1.3, bz + 1.6, C.dark, K_RAW, false);                         // back shelf
  K.box(-2.2, 2.2, y + 1.5, y + 1.56, bz + 1.0, bz + 1.3, C.warmLight, K_LAMP, true);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.cyl(s * (i - 1) * 1.4, bz - s * 1.15, y, y + 0.75, 0.2, 0.2, 8, C.steel, K_PLAIN); // stools
  // pergola over the counter
  const px0 = -4, px1 = 4, pz0 = bz - 2.6, pz1 = bz + 2.6, ph = y + 3.0;
  for (const x of [px0, px1]) for (const z of [pz0, pz1]) K.box(x - 0.1, x + 0.1, y, ph, z - 0.1, z + 0.1, C.steel, K_PLAIN);
  for (const z of [pz0, pz1]) K.box(px0 - 0.3, px1 + 0.3, ph, ph + 0.18, z - 0.08, z + 0.08, C.steel, K_PLAIN, true);
  for (let x = px0; x <= px1 + 0.01; x += 0.66) K.box(x - 0.04, x + 0.04, ph + 0.18, ph + 0.28, pz0 - 0.4, pz1 + 0.4, C.wood, K_PLAIN, true);
  // parasols + tables at the four island corners
  const furn = [];
  for (const [x, z] of [[ix0 + 1.2, iz0 + 1.2], [ix1 - 1.2, iz0 + 1.2], [ix0 + 1.2, iz1 - 1.2], [ix1 - 1.2, iz1 - 1.2]]) {
    K.cyl(x, z, y, y + 0.74, 0.55, 0.55, 10, C.cream, K_PLAIN);
    K.cyl(x, z, y + 0.74, y + 2.5, 0.04, 0.04, 5, C.steel, K_PLAIN);
    K.cyl(x, z, y + 2.05, y + 2.65, 1.5, 0.05, 8, [0.62, 0.28, 0.18], K_PLAIN, 0.2, true);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; K.cyl(x + Math.cos(a) * 0.95, z + Math.sin(a) * 0.95, y, y + 0.45, 0.2, 0.2, 6, C.wood, K_PLAIN); }
    furn.push([x, z, 1.25]);
  }
  // low planters with small trees on the island edges, facing the two views
  planter(K, -1.8, 1.8, iz0, iz0 + 0.8, y, { h: 0.5, c: warm });
  planter(K, -1.8, 1.8, iz1 - 0.8, iz1, y, { h: 0.5, c: warm });
  K.tree(ix0 + 0.6, y, bz, 0.5, "palm"); K.tree(ix1 - 0.6, y, bz, 0.5, "palm");
  planter(K, ix0, ix0 + 1.1, bz - 0.6, bz + 0.6, y, { h: 0.5, c: warm });
  planter(K, ix1 - 1.1, ix1, bz - 0.6, bz + 0.6, y, { h: 0.5, c: warm });
  // string-light masts at the roof corners (lights are drawn by props)
  const masts = [];
  for (const [x, z] of [[rx0 + 0.15, rz0 + 0.15], [rx1 - 0.15, rz0 + 0.15], [rx1 - 0.15, rz1 - 0.15], [rx0 + 0.15, rz1 - 0.15]]) {
    K.box(x - 0.06, x + 0.06, y, y + 3.6, z - 0.06, z + 0.06, C.steel, K_PLAIN);
    masts.push(K.W(x, y + 3.55, z));
  }
  const pg = [K.W(px0, ph, pz0), K.W(px1, ph, pz0), K.W(px1, ph, pz1), K.W(px0, ph, pz1)];
  X.world.strings.push({ pts: [masts[0], pg[0]], sag: 0.5 }, { pts: [masts[1], pg[1]], sag: 0.5 }, { pts: [masts[2], pg[2]], sag: 0.5 }, { pts: [masts[3], pg[3]], sag: 0.5 },
    { pts: [masts[0], masts[1]], sag: 0.8 }, { pts: [masts[2], masts[3]], sag: 0.8 }, { pts: [masts[1], masts[2]], sag: 1.1 }, { pts: [masts[3], masts[0]], sag: 1.1 });

  // ---- elevator shaft (static frame + glass); the cabin is separate ----
  const ez0 = -hd + 0.1, ez1 = f0, sTop = y + 3.6;
  for (const x of [ex0, ex1]) for (const z of [ez0, ez1 - 0.15]) K.box(x - 0.1, x + 0.1, 0.15, sTop, z, z + 0.15, C.steel, K_PLAIN);
  for (let yy = 3.2; yy < sTop; yy += 3.2) K.box(ex0 - 0.1, ex1 + 0.1, yy, yy + 0.12, ez0, ez0 + 0.15, C.steel, K_PLAIN, true);
  K.box(ex0 - 0.25, ex1 + 0.25, sTop, sTop + 0.7, ez0 - 0.15, ez1, C.dark, K_RAW, true);           // machine head
  K.box(ex0 - 0.25, ex1 + 0.25, sTop + 0.15, sTop + 0.25, ez0 - 0.17, ez0 - 0.14, amber, K_NEON, true);
  K.box(ex0 - 0.05, ex0 + 0.05, 0.4, sTop - 0.3, ez0 - 0.06, ez0 - 0.0, amber, K_NEON, true);       // amber neon up the shaft
  G.box(ex0 + 0.1, ex1 - 0.1, 0.15, sTop, ez0 + 0.02, ez0 + 0.06, [0.6, 0.75, 0.85], K_GLASS);
  G.box(ex0 - 0.04, ex0, 0.15, sTop, ez0, ez1, [0.6, 0.75, 0.85], K_GLASS);
  G.box(ex1, ex1 + 0.04, 0.15, sTop, ez0, ez1, [0.6, 0.75, 0.85], K_GLASS);
  K.box(ex0 - 0.6, ex1 + 0.6, 2.9, 3.05, -hd - 1.3, ez0, warm, K_RAW, true);                         // door canopy
  K.box(ex0 - 0.5, ex1 + 0.5, 2.84, 2.9, -hd - 1.2, -hd - 1.0, C.warmLight, K_LAMP, true);
  K.sign("basile", 5.0, 14.4, f0 - 1.95, 0, -1, 6.5);

  // garden behind the block
  for (let i = 0; i < 4; i++) K.tree(-hw + 2 + X.rnd() * (2 * hw - 4), 0.15, b1 + 3 + i * 3.6, 0.8 + X.rnd() * 0.3, i % 2 ? "plane" : "pine");
  K.bed(-hw + 0.5, hw - 0.5, b1 + 1.5, hd - 0.8, 0.15, 0.35);

  K.rect(-hw - 0.2, hw + 0.2, f0 - 1.8, b1, sTop + 0.7);
  K.rect(ex0 - 0.15, ex1 + 0.15, -hd, f0 - 1.8, sTop + 0.7);

  // the cabin: own mesh, local origin at the centre of its floor
  const cb = new Buf(1e4), CK = createKit(cb, X.world), cg = new Buf(1e4), CG = createKit(cg, X.world);
  CK.at(0, 0, "w"); CG.at(0, 0, "w");
  const cw = 1.1, cd = 1.05;
  CK.box(-cw, cw, 0, 0.15, -cd, cd, C.steel, K_PLAIN, true);
  CK.box(-cw, cw, 2.45, 2.6, -cd, cd, C.steel, K_PLAIN, true);
  for (const x of [-cw, cw - 0.08]) for (const z of [-cd, cd - 0.08]) CK.box(x, x + 0.08, 0.15, 2.45, z, z + 0.08, C.steel, K_PLAIN);
  CK.box(-cw + 0.1, cw - 0.1, 2.38, 2.45, -cd + 0.1, cd - 0.1, C.warmLight, K_LAMP, true);
  CK.box(-cw + 0.1, cw - 0.1, 1.0, 1.05, -cd + 0.02, -cd + 0.08, C.steel, K_PLAIN, true);
  for (const [a, b, c, d] of [[-cw, cw, -cd, -cd + 0.04], [-cw, -cw + 0.04, -cd, cd], [cw - 0.04, cw, -cd, cd]]) CG.box(a, b, 0.15, 2.45, c, d, [0.8, 0.6, 0.4], K_GLASS);
  const cabin = new THREE.Group();
  cabin.name = "basile-cabin";
  const m1 = new THREE.Mesh(cb.geometry(), X.g.env.shade.world), m2 = new THREE.Mesh(cg.geometry(), X.g.env.shade.glass);
  cabin.add(m1, m2);
  const sc = K.W(0, 0, (ez0 + ez1) / 2);
  cabin.position.set(sc[0], 0.15, sc[2]);
  X.add(cabin, [m1, m2]);
  X.stats(cb.tris + cg.tris);

  const door = K.W(0, 0, -hd - 1.6), exit = K.W(0, y, f0 + 1.4), c0 = K.W(rx0, y, rz0), c1 = K.W(rx1, y, rz1);
  const toWorldRect = (x0, x1, z0, z1) => { const a = K.W(x0, 0, z0), b = K.W(x1, 0, z1); return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[2], b[2])]; };
  const places = X.g.world.places = X.g.world.places || {};
  places.basile = Object.assign(places.basile || {}, {
    elevator: { cabin, yBottom: 0.15, yTop: y, doorPos: [door[0], door[2]], roofPos: [exit[0], y, exit[2]], roofHeading: K.heading(0, 1), shaft: [sc[0], sc[2]] },
    roof: {
      y, // walkable floor height
      bounds: [Math.min(c0[0], c1[0]), Math.max(c0[0], c1[0]), Math.min(c0[2], c1[2]), Math.max(c0[2], c1[2])], // [x0, x1, z0, z1] inside the parapet
      parapet: { h: 1.15, t: 0.25 },
      shaft: { rect: toWorldRect(ex0 - 0.15, ex1 + 0.15, -hd, f0 - 1.8), bottom: sTop, top: sTop + 0.7 }, // machine head: the only thing the roof camera boom collides with
      obstacles: [toWorldRect(-2.8, 2.8, bz - 0.7, bz + 1.7), toWorldRect(-4.1, 4.1, pz0 - 0.1, pz0 + 0.1), toWorldRect(-4.1, 4.1, pz1 - 0.1, pz1 + 0.1),
        toWorldRect(-1.8, 1.8, iz0, iz0 + 0.8), toWorldRect(-1.8, 1.8, iz1 - 0.8, iz1), toWorldRect(ix0, ix0 + 1.1, bz - 0.6, bz + 0.6), toWorldRect(ix1 - 1.1, ix1, bz - 0.6, bz + 0.6),
        ...furn.map(([x, z, r]) => { const w = K.W(x, 0, z); return [w[0] - r, w[0] + r, w[2] - r, w[2] + r]; })],
      views: { sunset: K.heading(0, -1), skyline: K.heading(0, 1) },
    },
  });
}
