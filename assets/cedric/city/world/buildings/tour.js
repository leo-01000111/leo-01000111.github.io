// Tour Jardin: a tower lifted on four splayed legs, deep planted balconies, and a two-storey
// sky garden cut clean through its upper third, trees standing in the void. A planted crown
// and a mast with a red light on top. Signature: the hollow sky garden glowing at night.
import { K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, bands, planter, roofGarden, vinesOver, FL } from "../kit/parts.js";

export default function tour(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const r = X.rnd, hw = 7, hd = 6.4, col = C.conc, legH = 9.6;
  // legs: tapered, leaning out a little, on a planted forecourt
  for (const [x, z] of [[-5.4, -4.6], [5.4, -4.6], [-5.4, 4.6], [5.4, 4.6]]) {
    K.tube([x * 0.82, 0.15, z * 0.8], [x, legH, z], 0.75, 8, col, K_RAW, 1.05);
    K.circle(x * 0.82, z * 0.8, 0.9, legH);
  }
  K.box(-1.8, 1.8, 0.15, legH, -1.8, 1.8, C.glass, K_GLASS, false);                   // glass lift core
  K.box(-2.0, 2.0, 0.15, 0.25, -2.0, 2.0, C.dark, K_RAW, false);
  K.rect(-1.8, 1.8, -1.8, 1.8, legH);
  K.box(-hw - 0.4, hw + 0.4, legH, legH + 1.2, -hd - 0.4, hd + 0.4, tint(col, 1.05), K_RAW, true);  // transfer slab
  K.box(-hw + 1, hw - 1, legH - 0.06, legH, -hd + 1, hd - 1, C.warmLight, K_LAMP, true);             // soffit light

  // shaft with deep balconies on front and back
  const shaft = (y0, y1) => {
    const top = bands(K, -hw, hw, -hd, hd, y0, y1, { sides: "lrfb", rec: 1.5, piers: 3.5, cap: 0, c: col });
    for (let y = Math.ceil((y0 - 0.45) / FL) * FL; y + 1.9 <= y1; y += FL) for (const z of [-hd, hd]) {
      if (r() < 0.45) { const x = -hw + 1 + r() * (2 * hw - 3); planter(K, x, x + 1.6, z < 0 ? z + 0.1 : z - 1.0, z < 0 ? z + 1.0 : z - 0.1, y + 1.05, { h: 0.45, t: 0.1, c: col }); }
    }
    return top;
  };
  shaft(legH + 1.2, 35.2);
  // sky garden: open floor, corner columns only, trees inside
  const g0 = 35.2, g1 = 42.4;
  K.box(-hw - 0.3, hw + 0.3, g0, g0 + 0.6, -hd - 0.3, hd + 0.3, col, K_RAW, true);
  for (const x of [-hw + 0.5, hw - 0.5]) for (const z of [-hd + 0.5, hd - 0.5]) K.box(x - 0.5, x + 0.5, g0 + 0.6, g1, z - 0.5, z + 0.5, col, K_RAW);
  K.box(-1.6, 1.6, g0 + 0.6, g1, -1.6, 1.6, col, K_RAW);
  K.box(-1.62, 1.62, g0 + 2, g0 + 2.1, -1.62, 1.62, C.warmLight, K_LAMP, true);
  K.bed(-hw + 1.2, hw - 1.2, -hd + 1.2, hd - 1.2, g0 + 0.6, 0.6);
  for (const [x, z] of [[-4.2, -3.6], [4, -3.8], [-4, 3.8], [4.3, 3.4]]) K.tree(x, g0 + 0.6, z, 0.95 + r() * 0.2, r() < 0.5 ? "plane" : "pine");
  for (const s of "fblr") vinesOver(K, -hw - 0.3, hw + 0.3, -hd - 0.3, hd + 0.3, g0 + 0.6, s, 4, 0.4);
  K.box(-hw - 0.3, hw + 0.3, g1, g1 + 0.6, -hd - 0.3, hd + 0.3, col, K_RAW, true);
  K.box(-hw + 0.8, hw - 0.8, g1 - 0.06, g1, -hd + 0.8, hd - 0.8, C.warmLight, K_LAMP, true);
  const top = shaft(g1 + 0.6, 57.6);
  // crown: a cantilevered roof garden wider than the shaft, and a mast
  K.box(-hw - 1.6, hw + 1.6, top, top + 0.8, -hd - 1.6, hd + 1.6, tint(col, 1.05), K_RAW, true);
  roofGarden(K, -hw - 1.6, hw + 1.6, -hd - 1.6, hd + 1.6, top + 0.8, { c: col, len: 7, sp: "pine" });
  K.box(-0.15, 0.15, top + 0.8, top + 9, -0.15, 0.15, C.steel, K_PLAIN);
  K.box(-0.2, 0.2, top + 9, top + 9.35, -0.2, 0.2, [1, 0.22, 0.18], K_NEON);
  // forecourt either side of the tower
  for (const s of [-1, 1]) {
    planter(K, s * 9, s * 15, -4, 4, 0.15, { h: 0.55, c: col });
    K.tree(s * 12, 0.58, 0, 1.0, "plane");
    K.tree(s * 16.5, 0.15, -4.5, 0.9, "cypress"); K.tree(s * 16.5, 0.15, 4.5, 0.9, "cypress");
    K.rect(Math.min(s * 9, s * 15), Math.max(s * 9, s * 15), -4, 4, 0.7);
  }
  void FL;
}
