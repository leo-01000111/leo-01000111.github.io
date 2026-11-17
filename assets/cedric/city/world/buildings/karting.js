// Karting. The circuit starts in the top-right block of the city (the track itself is built by
// places/karting/venue.js). West of the start straight: the pit building, garages below, a glazed
// floor behind brise-soleil fins above, a cantilevered timing box over the line and a round
// stair core behind. East of the straight: a stepped grandstand under a thin roof, facing the
// low sun. A timing pylon marks the place from afar; cyan neon throughout.
import { K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, parapet, planter, fins, stairCore } from "../kit/parts.js";

export default function karting(K, p, X) {
  const L = X.L, T = L.track, cyan = X.neon.karting, mag = [1.0, 0.25, 0.65];

  // ---- pit building (front looks east onto the straight) --------------------------------------------------
  {
    const pit = T.pit, pcx = (pit.x0 + pit.x1) / 2, pcz = (pit.z0 + pit.z1) / 2;
    K.at(pcx, pcz, "e", X.rnd);
    const hw = (pit.z1 - pit.z0) / 2, hd = (pit.x1 - pit.x0) / 2, y0 = 0.15, F = 3.5, H = 7.2;
    // plinth and garage floor
    K.box(-hw - 0.4, hw + 0.4, y0, y0 + 0.12, -hd - 2.4, hd + 0.4, C.dark, K_RAW, false);
    // ground floor: six garage bays between concrete piers, dark glass set back 1.4 m
    K.box(-hw, hw, y0, F, hd - 0.6, hd, C.conc, K_RAW);
    K.box(-hw, hw, y0 + 0.12, F, -hd + 1.4, hd - 0.6, C.glass, K_GLASS, false);
    const bays = 6, bw = (2 * hw) / bays;
    for (let i = 0; i <= bays; i++) K.box(-hw + i * bw - 0.28, -hw + i * bw + 0.28, y0, F, -hd, -hd + 1.4, C.conc, K_RAW);
    for (let i = 0; i < bays; i++) {
      if (i === 3) continue;
      // each bay: a lit lintel line, a roll-up door half open (dark slats), a small painted number
      const bx = -hw + (i + 0.5) * bw;
      K.box(bx - bw / 2 + 0.5, bx + bw / 2 - 0.5, F - 0.3, F - 0.22, -hd + 1.3, -hd + 1.36, i % 2 ? cyan : tint(cyan, 0.7), K_NEON, true);
      K.box(bx - bw / 2 + 0.5, bx + bw / 2 - 0.5, F - 1.2, F - 0.32, -hd + 1.2, -hd + 1.34, tint(C.black, 1.4), K_PLAIN, true);
    }
    // the entrance (bay 3): a recessed glass door framed in neon, a few steps
    K.box(-hw + 3 * bw + 0.3, -hw + 4 * bw - 0.3, y0 + 0.12, F - 0.2, -hd + 0.5, -hd + 1.45, tint(C.glass, 1.2), K_GLASS, false);
    K.box(-hw + 3 * bw + 0.3, -hw + 4 * bw - 0.3, F - 0.22, F - 0.1, -hd + 0.4, -hd + 1.5, cyan, K_NEON, true);
    K.glow(-hw + 3.5 * bw, 2.4, -hd + 0.8, [0.4, 0.9, 1.0], 2.2);
    // slab over the lane, thin and long, neon on its edge
    K.box(-hw - 0.6, hw + 0.6, F, F + 0.5, -hd - 2.2, hd, C.conc, K_RAW, true);
    K.box(-hw - 0.6, hw + 0.6, F - 0.06, F, -hd - 2.2, -hd - 2.12, cyan, K_NEON, true);
    // first floor: continuous glazing behind a row of tilted fins
    K.box(-hw, hw, F + 0.5, H, hd - 0.5, hd, C.conc, K_RAW, false);
    K.box(-hw + 0.3, hw - 0.3, F + 0.5, H, -hd + 1.4, hd - 0.5, C.glass, K_GLASS, false);
    fins(K, -hw + 0.6, hw - 0.6, -hd + 1.4, F + 0.5, H, 22, 1.5, 0.14, t => (t - 0.5) * 0.9);
    K.box(-hw - 0.3, hw + 0.3, H, H + 0.4, -hd - 0.4, hd + 0.2, C.conc, K_RAW, true);
    // roof terrace: parapet, planters, a pergola over the back
    parapet(K, -hw - 0.3, hw + 0.3, -hd - 0.4, hd + 0.2, H + 0.4, 0.9, 0.22, C.conc, "");
    planter(K, hw - 7, hw - 1, -hd + 1.2, -hd + 3.4, H + 0.4, { h: 0.6, vines: "f", len: 4 });
    K.tree(hw - 4, H + 0.4 + 0.5, -hd + 2.3, 0.5, "plane");
    for (const x of [-hw + 2, -hw + 11]) for (const z of [hd - 3.4, hd - 0.8]) K.box(x - 0.1, x + 0.1, H + 0.4, H + 3.0, z - 0.1, z + 0.1, C.steel, K_PLAIN);
    for (let x = -hw + 2; x <= -hw + 11.01; x += 0.9) K.box(x - 0.05, x + 0.05, H + 3.0, H + 3.14, hd - 3.7, hd - 0.5, C.wood, K_PLAIN);
    // timing box over the line: a glazed cube that overhangs the lane
    const tx0 = -7.5, tx1 = -2.5;
    K.box(tx0, tx1, H + 0.4, H + 1.0, -hd - 3.2, hd - 0.2, C.conc, K_RAW, true);
    K.box(tx0 + 0.25, tx1 - 0.25, H + 1.0, H + 3.6, -hd - 3.0, hd - 0.6, C.glass, K_GLASS, false);
    K.box(tx0 - 0.3, tx1 + 0.3, H + 3.6, H + 4.0, -hd - 3.5, hd, C.conc, K_RAW, true);
    K.box(tx0 - 0.3, tx1 + 0.3, H + 3.54, H + 3.6, -hd - 3.5, -hd - 3.42, cyan, K_NEON, true);
    K.box(tx0 + 0.5, tx1 - 0.5, H + 0.34, H + 0.4, -hd - 3.2, -hd - 3.1, cyan, K_NEON, true);
    K.glow(0.5 * (tx0 + tx1), H + 2.2, -hd - 1.0, [0.5, 0.95, 1.0], 2.4);
    K.sign("karting", 0.5 * (tx0 + tx1), H + 5.1, -hd - 3.52, 0, -1, 5.6);
    // round stair core at the rear, with a bridge to the roof
    stairCore(K, hw - 3.2, hd + 0.9, 1.5, y0, H + 0.4);
    K.box(hw - 3.2 - 0.6, hw - 3.2 + 0.6, H - 0.2, H + 0.1, hd - 0.2, hd + 0.9, C.conc, K_RAW, true);
    // colliders: the building (the slab and the box are overhead and stay open)
    K.rect(-hw - 0.4, hw + 0.4, -hd - 0.2, hd + 0.4, H + 4);
    K.circle(hw - 3.2, hd + 0.9, 1.8, H + 1);
  }

  // ---- grandstand (front looks west onto the straight) -------------------------------------------------------
  {
    const st = T.stand, scx = (st.x0 + st.x1) / 2, scz = (st.z0 + st.z1) / 2;
    K.at(scx, scz, "w", X.rnd);
    const hw = (st.z1 - st.z0) / 2, hd = (st.x1 - st.x0) / 2, y0 = 0.15, rows = 7, rh = 0.62, rd = 1.0, zf = -hd + 0.6;
    const seatC = [cyan, [0.1, 0.15, 0.22], mag, [0.1, 0.15, 0.22]];
    for (let r = 0; r < rows; r++) {
      const z = zf + r * rd, y = y0 + (r + 1) * rh;
      K.box(-hw, hw, y0, y, z, z + rd + 0.01, tint(C.conc, 1 - r * 0.02), K_RAW, false);
      // seats in blocks of four metres, colours cycling
      for (let s = 0, x = -hw + 0.4; x < hw - 3.6; s++, x += 4.2) K.box(x, x + 3.8, y, y + 0.14, z + 0.25, z + 0.7, tint(seatC[(s + r) % 4], 0.8), K_PLAIN, true);
    }
    const top = y0 + rows * rh, back = zf + rows * rd;
    // back wall, side stairs, front balustrade
    K.box(-hw, hw, y0, top + 4.2, back, back + 0.5, C.conc, K_RAW);
    for (const sx of [-1, 1]) {
      for (let r = 0; r < rows; r++) K.box(sx > 0 ? hw : -hw - 2.6, sx > 0 ? hw + 2.6 : -hw, y0, y0 + (r + 1) * rh * 0.999, zf + r * rd, zf + (r + 1) * rd, tint(C.light, 0.95), K_RAW, false);
    }
    K.box(-hw, hw, y0, y0 + 1.0, zf - 0.5, zf, C.conc, K_RAW, false);
    K.box(-hw, hw, y0 + 0.92, y0 + 1.0, zf - 0.5, zf - 0.44, cyan, K_NEON, true);
    // roof on slender columns, its lip lit
    const ry = top + 3.7;
    K.box(-hw - 0.6, hw + 0.6, ry, ry + 0.3, zf + 2.4, back + 1.2, C.conc, K_RAW, true);
    K.box(-hw - 0.6, hw + 0.6, ry - 0.07, ry, zf + 2.4, zf + 2.5, cyan, K_NEON, true);
    for (let x = -hw + 1; x <= hw - 0.9; x += 7.5) K.cyl(x, back - 0.3, y0, ry, 0.16, 0.14, 6, C.steel, K_PLAIN);
    K.rect(-hw - 0.1, hw + 2.7, zf - 0.6, back + 1.2, ry);
    K.glow(-hw + 4, ry - 0.3, zf + 3.6, [0.6, 0.95, 1.0], 2.4); K.glow(hw - 4, ry - 0.3, zf + 3.6, [0.6, 0.95, 1.0], 2.4);
    K.glow(0, ry - 0.3, zf + 3.6, [0.6, 0.95, 1.0], 2.4);
  }

  // ---- timing pylon at the south-west corner, lawn trees ---------------------------------------------------------------
  K.at(0, 0, 0, X.rnd);
  {
    const px = 187.5, pz = -57.5;
    K.box(px - 0.7, px + 0.7, 0.15, 15, pz - 0.45, pz + 0.45, C.conc, K_RAW);
    K.box(px - 1.2, px + 1.2, 11, 13.6, pz - 0.6, pz + 0.6, C.black, K_RAW, true);
    K.box(px - 1.25, px + 1.25, 12.0, 12.25, pz - 0.65, pz + 0.65, cyan, K_NEON, true);
    K.box(px - 1.25, px + 1.25, 12.9, 13.0, pz - 0.65, pz + 0.65, tint(cyan, 0.7), K_NEON, true);
    K.box(px - 0.12, px + 0.12, 15, 17.5, pz - 0.12, pz + 0.12, C.steel, K_PLAIN);
    K.box(px - 0.15, px + 0.15, 17.5, 17.75, pz - 0.15, pz + 0.15, [1, 0.25, 0.2], K_NEON);
    K.rect(px - 0.8, px + 0.8, pz - 0.5, pz + 0.5, 15);
  }
  K.tree(192.5, 0.16, -56.5, 0.8, "plane"); K.tree(184.4, 0.16, -53.8, 0.7, "cypress");
  for (const x of [186, 196, 206, 216, 225]) K.tree(x, 0.16, -10 + (x % 3), 0.75, x % 2 ? "plane" : "cypress");
  for (const x of [186, 226]) K.tree(x, 0.16, -88 + (x > 200 ? 2 : 0), 0.8, "cypress");
  void K_LAMP; void planter;
}
