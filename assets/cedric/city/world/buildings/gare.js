// Gare de Cédric-sur-Mer: a terminus at the south-east end of the city, east of the Château d'eau.
// Signature: a great flat roof on mushroom columns over an open, planted concourse, and behind it a
// row of five thin concrete barrel vaults over the platforms (seen end-on from the street they read
// as a row of arches). Three tracks (voies 1-3) run east into a tunnel portal at the map edge.
// The hall has no doors: pylons, columns, the ticket pavilion and the track-end piers are colliders.
// The board, the voie plates and the name plate are canvas meshes made by places/station.js;
// this recipe only says where they hang (g.world.places.gare.mounts).
import { K_PLAIN, K_NEON, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, planter, roofGarden, vinesOver, pilotis } from "../kit/parts.js";

export default function gare(K, p, X) {
  const S = X.L.station, G = X.glass, W = X.world, teal = X.neon.gare, h = S.hall, FY = S.floorY;
  const OX = 188, OZ = 76;
  K.at(OX, OZ, 0, X.rnd); G.at(OX, OZ, 0);
  const r = X.rnd;

  // world-coordinate wrappers over the kit's local frame
  const box = (x0, x1, y0, y1, z0, z1, c, k, b) => K.box(x0 - OX, x1 - OX, y0, y1, z0 - OZ, z1 - OZ, c, k, b);
  const gbox = (x0, x1, y0, y1, z0, z1, c) => G.box(x0 - OX, x1 - OX, y0, y1, z0 - OZ, z1 - OZ, c);
  const cyl = (x, z, y0, y1, r0, r1, n, c, k) => K.cyl(x - OX, z - OZ, y0, y1, r0, r1, n, c, k);
  const rect = (x0, x1, z0, z1, hh) => K.rect(x0 - OX, x1 - OX, z0 - OZ, z1 - OZ, hh);
  const circle = (x, z, rr, hh) => K.circle(x - OX, z - OZ, rr, hh);
  const tree = (x, y, z, s, sp) => K.tree(x - OX, y, z - OZ, s, sp);
  const glow = (x, y, z, col, size) => K.glow(x - OX, y, z - OZ, col, size);
  const plant = (x0, x1, z0, z1, y, o) => planter(K, x0 - OX, x1 - OX, z0 - OZ, z1 - OZ, y, o);
  const tube = (a, b, rr, n, c, k) => K.tube([a[0] - OX, a[1], a[2] - OZ], [b[0] - OX, b[1], b[2] - OZ], rr, n, c, k);
  const WARM = [1, 0.66, 0.36], AMBER = [1.0, 0.62, 0.3], TEALG = [0.2, 0.9, 0.8];

  // ---- floors ----
  box(h.x0, h.x1, 0.15, FY, h.z0, h.z1, C.light, K_RAW, false);
  for (const pf of S.platforms) box(S.platX.x0, S.platX.x1, 0.15, FY, pf.z0, pf.z1, tint(C.light, 0.96), K_RAW, false);
  const stripC = [0.85, 0.6, 0.16];
  for (const pf of S.platforms) for (const v of S.voies) {
    if (Math.abs(pf.z1 - (v.z - S.bed)) < 0.05) box(S.platX.x0, S.platX.x1, FY, FY + 0.012, pf.z1 - 0.5, pf.z1, stripC, K_PLAIN, false);
    if (Math.abs(pf.z0 - (v.z + S.bed)) < 0.05) box(S.platX.x0, S.platX.x1, FY, FY + 0.012, pf.z0, pf.z0 + 0.5, stripC, K_PLAIN, false);
  }
  // a darker paving line across the concourse, from the entrance to the platforms
  for (const z of [62.5, 76, 89.5]) box(h.x0, h.x1, FY, FY + 0.01, z - 0.12, z + 0.12, tint(C.dark, 1.1), K_PLAIN, false);

  // ---- tracks: ballast, sleepers, rails, buffer stops ----
  const tx1 = S.track.x1 + 15;
  for (const v of S.voies) {
    const z = v.z, x0 = S.track.x0;
    box(x0, tx1, 0.15, 0.25, z - S.bed, z + S.bed, [0.13, 0.12, 0.12], K_PLAIN, false);
    for (let x = x0 + 1.0; x < tx1 - 0.5; x += 0.95) box(x - 0.14, x + 0.14, 0.25, 0.31, z - 1.1, z + 1.1, [0.1, 0.085, 0.07], K_PLAIN, false);
    for (const s of [-0.72, 0.72]) box(x0 + 0.5, tx1, 0.31, 0.43, z + s - 0.06, z + s + 0.06, [0.27, 0.28, 0.3], K_PLAIN, false);
    box(x0 + 0.05, x0 + 0.95, 0.25, 1.25, z - 1.2, z + 1.2, C.dark, K_RAW);
    box(x0 + 0.95, x0 + 1.0, 0.8, 1.05, z - 0.6, z + 0.6, C.warmLight, K_LAMP, true);
  }

  // ---- the hall: roof, fascia, lamps ----
  const RY0 = 11.2, RY1 = 12.2;
  box(148.5, 189, RY0, RY1, 55.5, 95.5, C.conc, K_RAW, true);
  box(148.5, 189, 10.2, RY0, 55.5, 56.3, tint(C.conc, 1.05), K_RAW, true);      // north fascia (the signs hang here)
  box(148.5, 149.3, 10.2, RY0, 56.3, 95.5, tint(C.conc, 1.05), K_RAW, true);     // west
  box(148.5, 189, 10.2, RY0, 94.7, 95.5, tint(C.conc, 1.05), K_RAW, true);       // south
  box(148.5, 189, 10.0, 10.12, 55.45, 55.5, teal, K_NEON, true);                 // teal line under the front edge
  for (const x of [156, 168, 180]) box(x - 0.14, x + 0.14, RY0 - 0.06, RY0, 60, 92, C.warmLight, K_LAMP, true);
  roofGarden(K, 148.5 - OX, 189 - OX, 55.5 - OZ, 95.5 - OZ, RY1, { c: C.conc, len: 6, vines: false });   // no vines on the front: the signs hang there
  // lantern over the middle of the concourse
  box(160, 184, RY1, RY1 + 0.45, 66, 86, C.conc, K_RAW, true);
  gbox(160.3, 183.7, RY1 + 0.45, RY1 + 2.6, 66.3, 85.7, [0.45, 0.62, 0.7]);
  box(159.6, 184.4, RY1 + 2.6, RY1 + 3.1, 65.6, 86.4, C.conc, K_RAW, true);
  box(161, 183, RY1 + 2.5, RY1 + 2.58, 67, 85, C.warmLight, K_LAMP, true);
  // columns (mushroom heads), pylons on the street sides, pylons-with-plates on the track side
  const cols = [];
  for (const x of [156, 168, 180]) for (const z of [62, 76, 90]) cols.push([x, z]);
  pilotis(K, cols.map(c => [c[0] - OX, c[1] - OZ]), FY, RY0, 0.62, "mush", C.light);
  for (const [x, z] of cols) circle(x, z, 0.75, 99);
  for (const x of [152, 165, 178, 186.2]) for (const z of [59.1, 93.4]) { box(x - 0.8, x + 0.8, FY, RY0, z - 0.6, z + 0.6, tint(C.conc, 0.97), K_RAW, false); rect(x - 0.8, x + 0.8, z - 0.6, z + 0.6, 99); }
  for (const v of S.voies) {                                                     // the end wall behind each buffer stop
    box(185.8, 187.2, FY, RY0, v.z - S.bed, v.z + S.bed, tint(C.conc, 0.95), K_RAW, false);
    rect(185.8, 187.2, v.z - S.bed, v.z + S.bed, 99);
    box(185.72, 185.8, 6.0, 8.4, v.z - 1.7, v.z + 1.7, [0.03, 0.04, 0.06], K_PLAIN, true);          // plate backing
    box(185.72, 185.8, 5.8, 5.88, v.z - 1.7, v.z + 1.7, teal, K_NEON, true);
  }
  // clock tower at the north-west corner, clocks to the north and to the east
  box(149, 152.2, FY, 22.6, 56.6, 59.8, tint(C.light, 1.02), K_RAW, false);
  box(148.7, 152.5, 22.6, 23.2, 56.3, 60.1, C.conc, K_RAW, true);
  rect(149, 152.2, 56.6, 59.8, 99);
  const cx = 150.6, cz = 58.2, cy = 19, cr = 1.35;
  const dial = (n, a) => { // n: unit normal [x,z]; a: hour hand angle
    const o = [cx + n[0] * 1.62, cy, cz + n[1] * 1.62];
    const at = (d, ry) => [o[0] + n[0] * d + (-n[1]) * ry[0], cy + ry[1], o[2] + n[1] * d + n[0] * ry[0]];
    tube(at(-0.12, [0, 0]), at(0.18, [0, 0]), cr + 0.14, 24, C.steel, K_PLAIN);
    tube(at(-0.12, [0, 0]), at(0.2, [0, 0]), cr + 0.06, 24, C.warmLight, K_LAMP);
    tube(at(0.1, [0, 0]), at(0.24, [0, 0]), cr - 0.08, 24, C.cream, K_PLAIN);
    const hand = (deg, len, w, d) => { const t = deg * Math.PI / 180; tube(at(d, [0, 0]), at(d, [Math.sin(t) * len, Math.cos(t) * len]), w, 5, C.steel, K_PLAIN); };
    hand(a, 0.8, 0.07, 0.3); hand(a * 12 % 360, 1.15, 0.045, 0.32);
  };
  dial([0, -1], 213); dial([1, 0], 213);
  // both faces read the same time
  K.sign("gare", 169 - OX, 11.2, 55.42 - OZ, 0, -1, 12);

  // ---- ticket pavilion (guichet) ----
  box(151.5, 158, FY, 3.8, 64, 74, tint(C.warm, 1.0), K_RAW, false);
  box(151.2, 158.6, 3.8, 4.15, 63.7, 74.3, C.conc, K_RAW, true);
  for (const z of [65.6, 69, 72.4]) {
    gbox(158, 158.05, FY + 1.4, 3.3, z - 1.2, z + 1.2, [0.5, 0.65, 0.7]);
    box(158, 158.12, FY + 1.4, 3.3, z - 1.35, z - 1.2, C.steel, K_PLAIN, false);
    box(158, 158.12, FY + 1.4, 3.3, z + 1.2, z + 1.35, C.steel, K_PLAIN, false);
    box(158, 158.12, FY + 1.3, FY + 1.4, z - 1.35, z + 1.35, C.steel, K_PLAIN, false);
    box(158.05, 158.2, FY + 0.5, FY + 1.35, z - 1.25, z + 1.25, [0.03, 0.04, 0.06], K_PLAIN, true);
    box(158.2, 158.7, FY + 1.1, FY + 1.18, z - 1.35, z + 1.35, tint(C.wood, 1.15), K_PLAIN, true);   // counter ledge
  }
  box(157.55, 158.2, 3.72, 3.8, 64.2, 73.8, C.warmLight, K_LAMP, true);
  box(158.3, 158.6, 4.4, 5.4, 66.8, 71.2, [0.03, 0.04, 0.06], K_PLAIN, true);
  rect(151.5, 158.7, 64, 74.2, 4.2);
  glow(158.6, 3.0, 69, AMBER, 3.4);
  // a bench and a planter by the counter
  plant(152, 157.6, 60.4, 62.6, FY, { h: 0.5, c: C.conc });

  // ---- departures board over the concourse ----
  const bx = S.board.x, bz = S.board.z;
  for (const z of [bz - 5.2, bz + 5.2]) { box(bx - 0.5, bx + 0.5, FY, 8.4, z - 0.5, z + 0.5, C.conc, K_RAW, false); rect(bx - 0.5, bx + 0.5, z - 0.5, z + 0.5, 99); }
  box(bx - 0.8, bx + 0.8, 7.4, 8.5, bz - 5.8, bz + 5.8, C.conc, K_RAW, true);
  box(bx - 0.4, bx + 0.4, 3.9, 7.4, bz - 4.8, bz + 4.8, [0.025, 0.03, 0.045], K_PLAIN, true);
  box(bx - 0.46, bx + 0.46, 3.86, 3.94, bz - 4.9, bz + 4.9, teal, K_NEON, true);
  box(bx - 0.46, bx + 0.46, 7.4, 7.48, bz - 4.9, bz + 4.9, AMBER, K_NEON, true);
  glow(bx - 1.2, 5.7, bz, AMBER, 7); glow(bx + 1.2, 5.7, bz, AMBER, 7);
  glow(bx - 1.2, 5.7, bz - 3, AMBER, 5); glow(bx - 1.2, 5.7, bz + 3, AMBER, 5);

  // ---- planted concourse: big planters, benches ----
  const bench = (x, z, alongX) => {
    const a = alongX ? 1.1 : 0.32, b = alongX ? 0.32 : 1.1;
    box(x - a, x + a, FY, FY + 0.42, z - b, z + b, C.light, K_RAW, false);
    box(x - a - 0.05, x + a + 0.05, FY + 0.42, FY + 0.5, z - b - 0.05, z + b + 0.05, C.wood, K_PLAIN, true);
    rect(x - a - 0.05, x + a + 0.05, z - b - 0.05, z + b + 0.05, 0.6);
  };
  const bigPlanter = (x0, x1, z0, z1, trees) => {
    plant(x0, x1, z0, z1, FY, { h: 0.6, c: C.conc, vines: "f", len: 0.8, dens: 0.4 });
    rect(x0, x1, z0, z1, 0.7);
    trees.forEach(([x, z, s, sp]) => tree(x, FY + 0.5, z, s, sp));
  };
  bigPlanter(152.5, 158, 82, 90.5, [[154, 85, 0.95, "palm"], [156.5, 88.4, 0.8, "plane"]]);
  bigPlanter(174.5, 182.5, 84.5, 90, [[177, 87, 0.9, "plane"], [180, 87.4, 0.85, "palm"]]);
  bigPlanter(160, 166, 60.6, 63, [[163, 61.8, 0.7, "pine"]]);
  bench(163, 84, true); bench(170, 87.6, true); bench(165, 67, false);
  // forecourt along the front: low planters between the pylons, vines over the edge
  for (const [a, b] of [[153.3, 164.3], [166.3, 177.3], [179.3, 185.4]]) {
    plant(a, b, 56.7, 57.9, 0.15, { h: 0.55, c: C.conc, vines: "f", len: 1.3, dens: 0.5 });
    rect(a, b, 56.7, 57.9, 0.7);
    const n = Math.max(1, Math.floor((b - a) / 5));
    for (let i = 0; i < n; i++) tree(a + (b - a) * (i + 0.5) / n, 0.65, 57.3, 0.55 + r() * 0.25, i % 2 ? "plane" : "palm");
  }

  // ---- platform vaults: five thin barrel shells on beams along z, columns on the platforms ----
  const VY = 7.4, RISE = 2.2, bays = 5, vx0 = 189, bw = 8, vz0 = 58.5, vz1 = 94;
  const vault = (xa, xb, z0, z1, t, n) => {
    const w = xb - xa, R = (w * w / 4 + RISE * RISE) / (2 * RISE), a = Math.asin(w / 2 / R), xc = (xa + xb) / 2, yc = VY + RISE - R;
    const pt = (rr, th, z) => [xc + rr * Math.sin(th) - OX, yc + rr * Math.cos(th), z - OZ];
    for (let i = 0; i < n; i++) {
      const t0 = -a + 2 * a * i / n, t1 = -a + 2 * a * (i + 1) / n;
      K.hexa([pt(R - t, t0, z0), pt(R - t, t1, z0), pt(R, t1, z0), pt(R, t0, z0), pt(R - t, t0, z1), pt(R - t, t1, z1), pt(R, t1, z1), pt(R, t0, z1)], tint(C.conc, 1.03), K_RAW, true, true);
    }
  };
  for (let i = 0; i < bays; i++) {
    const xa = vx0 + i * bw, xb = xa + bw;
    vault(xa, xb, vz0, vz1, 0.32, 8);
    vault(xa, xb, vz0, vz0 + 0.55, 0.8, 8); vault(xa, xb, vz1 - 0.55, vz1, 0.8, 8);   // stiff rims at both ends
  }
  const zlines = [60.8, 70.5, 81.5, 91.4];
  for (let i = 0; i <= bays; i++) {
    const x = vx0 + i * bw;
    box(x - 0.4, x + 0.4, VY - 0.95, VY + 0.05, vz0, vz1, C.conc, K_RAW, true);
    for (const z of zlines) { cyl(x, z, FY, VY - 0.95, 0.38, 0.38, 10, C.light, K_RAW); circle(x, z, 0.5, 99); }
    if (i % 2 === 0) for (const z of zlines) { glow(x, VY - 1.1, z, AMBER, 3.1); }
    box(x - 0.1, x + 0.1, VY - 1.05, VY - 0.95, vz0 + 1, vz1 - 1, C.warmLight, K_LAMP, true);
  }
  box(vx0, vx0 + bays * bw, 6.1, 6.25, 58.3, 58.5, teal, K_NEON, true);          // teal end lines under the rims
  box(vx0, vx0 + bays * bw, 6.1, 6.25, 94, 94.2, [1.0, 0.6, 0.25], K_NEON, true);
  // low planted walls close the platform ends and the sides; the track-side edges stay open
  const pe = S.platX;
  plant(pe.x0 + 1.6, pe.x1 - 0.5, 58.5, 59.3, FY, { h: 0.55, t: 0.2, c: C.conc, vines: "f", len: 2.5, dens: 0.5 });
  plant(pe.x0 + 1.6, pe.x1 - 0.5, 93.2, 94, FY, { h: 0.55, t: 0.2, c: C.conc, vines: "b", len: 2.5, dens: 0.5 });
  rect(pe.x0 + 1.6, pe.x1 - 0.5, 58.5, 59.3, 0.7); rect(pe.x0 + 1.6, pe.x1 - 0.5, 93.2, 94, 0.7);
  for (const pf of S.platforms) {
    box(pe.x1 - 0.55, pe.x1, FY, FY + 0.5, pf.z0, pf.z1, C.conc, K_RAW, false);
    rect(pe.x1 - 0.55, pe.x1 + 0.6, pf.z0, pf.z1, 0.6);
  }

  // ---- tunnel portal at the map edge, three bores ----
  const px0 = S.portalX, px1 = px0 + 3.5;
  const piers = [[57, 62.4], [67.6, 73.4], [78.6, 84.4], [89.6, 95.5]];
  for (const [a, b] of piers) box(px0, px1, 0.15, 10.5, a, b, tint(C.conc, 0.96), K_RAW, false);
  box(px0, px1, 6.2, 10.5, 57, 95.5, tint(C.conc, 0.98), K_RAW, true);
  box(px0 - 0.3, px1 + 0.3, 10.5, 11.1, 56.7, 95.8, C.conc, K_RAW, true);
  box(px0 - 0.08, px0, 9.5, 9.64, 57, 95.5, teal, K_NEON, true);
  for (const v of S.voies) {
    box(px0 - 0.08, px0, 6.55, 6.95, v.z - 1.1, v.z + 1.1, C.warmLight, K_LAMP, true);
    glow(px0 - 0.5, 6.8, v.z, TEALG, 3.4);
    const t = v.z, ex = px1, ex2 = 259;
    box(ex, ex2, 6.2, 7.5, t - 3.0, t + 3.0, C.dark, K_RAW, true);
    box(ex, ex2, 0.15, 6.2, t - 3.0, t - 2.65, C.dark, K_RAW, false);
    box(ex, ex2, 0.15, 6.2, t + 2.65, t + 3.0, C.dark, K_RAW, false);
    box(249, 250.5, 0.15, 6.2, t - 2.7, t + 2.7, [0.02, 0.02, 0.03], K_PLAIN, false);
  }
  for (let z = 58.5; z < 95; z += 2.2 + r() * 2.2) K.vine(px0 - 0.06 - OX, 10.5, z - OZ, -1, 0, 0.9 + r() * 1.3, 2.4 + r() * 3.4);
  rect(px0, px1, 57, 95.5, 99);
  // the track beds: Cedric stays on the platforms
  for (const v of S.voies) rect(S.track.x0 + 0.1, px1, v.z - S.bed, v.z + S.bed, 99);

  // ---- floor of the station: raised 35 cm above the street ----
  W.floorAt = (x, z) => {
    if (x < h.x0 || x > S.platX.x1 || z < h.z0 || z > h.z1) return null;
    if (x <= h.x1) return FY;
    for (const pf of S.platforms) if (z >= pf.z0 && z <= pf.z1) return FY;
    return null;
  };

  // ---- where the canvas signs hang (places/station.js reads these) ----
  const PI = Math.PI;
  const places = W.places = W.places || {};
  places.gare = {
    mounts: {
      boards: [{ x: bx - 0.42, y: 5.65, z: bz, facing: PI, w: 9.2 }, { x: bx + 0.42, y: 5.65, z: bz, facing: 0, w: 9.2 }],
      voies: S.voies.map(v => ({ n: v.n, x: 185.68, y: 7.2, z: v.z, facing: PI, w: 3.2 })),
      name: { x: 169, y: 9.35, z: 55.9, facing: -PI / 2, w: 11 },
      till: { x: 158.78, y: 4.9, z: 69, facing: 0, w: 4.2 },
    },
  };
  vinesOver(K, 148.5 - OX, 189 - OX, 55.5 - OZ, 95.5 - OZ, 10.2, "b", 3.2, 0.5);  // foliage over the back fascia
  vinesOver(K, 148.5 - OX, 189 - OX, 55.5 - OZ, 95.5 - OZ, 10.2, "l", 3.2, 0.5);
}
