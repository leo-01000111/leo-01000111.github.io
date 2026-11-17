// Hôtel de Ville. Signature: a 14 m oculus punched through a free-standing screen wall, with
// the town clock hanging in it. A monumental stair climbs from the plaza to a planted podium;
// behind the screen two inverted-stepped wings frame a courtyard tree and a sky bridge.
import { K_PLAIN, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, bands, parapet, planter, stairs, roofGarden, bridge, vinesOver } from "../kit/parts.js";

export default function mairie(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const hw = p.d / 2, hd = p.w / 2, top = 4.65, conc = C.light, cd = tint(C.conc, 0.95);

  // monumental stair from the plaza to the podium, cheek planters stepping up beside it
  stairs(K, -6, 6, -21.5, -10.5, 0.15, top, 15, tint(C.light, 1.05));
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -8.4 : 6, xb = s < 0 ? -6 : 8.4;
    for (let i = 0; i < 5; i++) {
      const za = -21.5 + i * 2.2, zb = za + 2.2, y = 0.15 + (i + 1) * 0.86;
      K.box(xa, xb, 0.15, y - 0.55, za, zb, cd, K_RAW, false);
      planter(K, xa, xb, za, zb, y - 0.55, { h: 0.55, vines: s < 0 ? "l" : "r", len: 1.4, dens: 0.6 });
    }
  }
  // podium with a glazed colonnade either side of the stair
  K.box(-hw, hw, 0, top, -8, hd, cd, K_RAW, false);
  K.box(-8.4, 8.4, 0, top, -10.5, -8, cd, K_RAW, false);
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -hw : 8.4, xb = s < 0 ? -8.4 : hw;
    K.box(xa, xb, 3.75, top, -10.5, -8, conc, K_RAW, true);                 // lintel / canopy
    K.box(xa + 0.3, xb - 0.3, 0.15, 3.75, -8.35, -8, C.glass, K_GLASS, false);
    for (let x = xa + 0.45; x <= xb - 0.2; x += 2.85) K.box(x - 0.3, x + 0.3, 0.15, 3.75, -10.2, -9.6, conc, K_RAW);
    for (let x = xa + 1.9; x < xb - 1; x += 2.85) K.box(x - 0.25, x + 0.25, 3.68, 3.75, -9.4, -9.1, C.warmLight, K_LAMP, true);
    planter(K, xa, xb, -10.5, -9.3, top, { h: 0.6, vines: "f", len: 3.2, dens: 0.7 });
  }

  // screen wall with the oculus
  const hy = 15.5, R = 7;
  K.holeWall(-15, 15, top, 25, -7.5, -5.5, 0, hy, R, 44, conc, K_RAW);
  K.box(-15.3, 15.3, 25, 25.5, -7.8, -5.2, conc, K_RAW, true);
  // the clock hangs from the top of the oculus
  const cz = -6.5, cy = 16.4, cr = 2.75;
  K.tube([0, hy + R + 0.1, cz], [0, cy + cr, cz], 0.09, 6, C.steel, K_PLAIN);
  K.tube([0, cy, cz - 0.5], [0, cy, cz + 0.5], cr, 28, C.cream, K_PLAIN);
  K.tube([0, cy, cz - 0.38], [0, cy, cz + 0.38], cr + 0.17, 28, C.steel, K_PLAIN);
  K.tube([0, cy, cz - 0.18], [0, cy, cz + 0.18], cr + 0.24, 28, C.warmLight, K_LAMP);
  const hand = (deg, r, w, z) => { const a = deg * Math.PI / 180; K.tube([0, cy, z], [-Math.sin(a) * r, cy + Math.cos(a) * r, z], w, 5, C.steel, K_PLAIN); };
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r0 = i % 3 ? 2.2 : 1.95;
    K.tube([-Math.sin(a) * r0, cy + Math.cos(a) * r0, cz - 0.53], [-Math.sin(a) * 2.5, cy + Math.cos(a) * 2.5, cz - 0.53], 0.07, 4, C.steel, K_PLAIN);
  }
  hand(207.5, 1.45, 0.11, cz - 0.58); hand(330, 2.2, 0.075, cz - 0.64);   // ten to seven, sunset hour
  K.tube([0, cy, cz - 0.7], [0, cy, cz - 0.52], 0.16, 8, C.steel, K_PLAIN);
  K.sign("mairie", 0, 23.75, -7.62, 0, -1, 9.5);

  // wings behind the screen: inverted steps, every tier wider than the one below
  for (const s of [-1, 1]) {
    const inner = 7 * s, o = { sides: "lrb", piers: 2.4, cap: 0, c: conc };
    const span = (e) => s < 0 ? [-e, -7] : [7, e];
    let [a, b] = span(14); bands(K, a, b, -5.5, 16, top, 12.8, o);
    [a, b] = span(15); bands(K, a, b, -5.5, 18, 12.8, 19.2, o);
    [a, b] = span(16); const y = bands(K, a, b, -5.5, 19.5, 19.2, 22.4, Object.assign({}, o, { cap: 0.5 }));
    roofGarden(K, a, b, -5.5, 19.5, y, { c: conc, len: 6 });
    void inner;
  }
  // rear block, courtyard and its tree, sky bridge across the top
  const ry = bands(K, -7, 7, 12, 18, top, 11.2, { sides: "fb", piers: 2.3, c: conc });
  roofGarden(K, -7, 7, 12, 18, ry, { c: conc, pergola: false });
  bridge(K, -7, 7, 5.5, 8.5, 19.2, 3.2);
  K.tree(0, top, 2.5, 1.5, "plane");
  K.bed(-6.3, 6.3, -4.8, 10.8, top, 0.45);
  planter(K, -5.5, -3, 8, 11, top, { h: 0.5 });
  planter(K, 3, 5.5, 8, 11, top, { h: 0.5 });
  vinesOver(K, -7, 7, 5.5, 8.5, 19.2, "f", 4, 0.6);

  // notice board on the plaza (phase 4 reads board.json)
  const bx = -10.5, bz = -23.2;
  for (const x of [bx - 1.4, bx + 1.4]) K.box(x - 0.1, x + 0.1, 0.15, 2.6, bz - 0.1, bz + 0.1, C.steel, K_PLAIN);
  K.box(bx - 1.5, bx + 1.5, 0.95, 2.4, bz - 0.05, bz + 0.05, tint(C.wood, 0.8), K_PLAIN, true);
  K.box(bx - 1.3, bx + 1.3, 1.05, 2.3, bz - 0.08, bz - 0.05, C.cream, K_PLAIN, true);
  K.box(bx - 1.7, bx + 1.7, 2.6, 2.75, bz - 0.4, bz + 0.3, C.conc, K_RAW, true);
  K.box(bx - 1.2, bx + 1.2, 2.5, 2.58, bz - 0.32, bz - 0.22, C.warmLight, K_LAMP, true);
  K.rect(bx - 1.7, bx + 1.7, bz - 0.3, bz + 0.3, 2.8);
  // places/boardprop.js pins one paper per post on the cream face (o: centre line, u: along, n: towards the plaza)
  const bo = K.W(bx, 0, bz), bu = K.W(bx + 1, 0, bz), bn = K.W(bx, 0, bz - 1);
  const places = X.g.world.places = X.g.world.places || {};
  places.mairie = { board: { o: bo, u: [bu[0] - bo[0], 0, bu[2] - bo[2]], n: [bn[0] - bo[0], 0, bn[2] - bo[2]] } };

  K.rect(-8.4, 8.4, -21.5, -10.5, top + 0.5);
  K.rect(-hw, hw, -10.5, hd, 25.5);
}
