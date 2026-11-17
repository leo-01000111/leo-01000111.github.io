// Les Terrasses: a residential ziggurat split by a canyon. Two stepped halves fall towards the
// sea and outwards, every terrace planted and dripping vines; two sky bridges cross the cleft.
// Signature: the twin stepped mountain with the bridged canyon, read from anywhere in the city.
import { K_PLAIN, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, bands, planter, roofGarden, bridge, vinesOver, FL } from "../kit/parts.js";

export default function terrasses(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const r = X.rnd, hw = p.d / 2, hd = p.w / 2, gap = 2.6, tiers = 9;
  const col = C.light, tops = [];
  for (const s of [-1, 1]) {
    // each half: x from the cleft (s * gap) to the outer edge (s * hw)
    let inner = s * gap, outer = s * hw, front = -hd, back = hd - 1, y = 0;
    for (let t = 0; t < tiers; t++) {
      const x0 = Math.min(inner, outer), x1 = Math.max(inner, outer);
      const yt = bands(K, x0, x1, front, back, y, y + FL - 0.4, { sides: s < 0 ? "lrf" : "lrf", piers: 2.9, cap: 0, c: col, rec: 0.7 });
      const cap = yt + 0.4;
      K.box(x0 - 0.2, x1 + 0.2, yt, cap, front - 0.2, back, tint(col, 1.04), K_RAW, true);
      const nOuter = outer - s * 1.15, nFront = front + 2.3;
      if (t < tiers - 1) {
        // front terrace planter and the outer one
        planter(K, x0, x1, front - 0.2, front + 1.0, cap, { h: 0.55, t: 0.16, c: col, vines: "f", len: FL * 1.1, dens: 0.6 });
        const ox0 = s < 0 ? x0 - 0.2 : nOuter + 0.05, ox1 = s < 0 ? nOuter - 0.05 : x1 + 0.2;
        if (ox1 - ox0 > 0.6) planter(K, ox0, ox1, nFront, back, cap, { h: 0.55, t: 0.14, c: col, vines: s < 0 ? "l" : "r", len: FL, dens: 0.45 });
        for (let i = 0; i < 2; i++) if (r() < 0.55) K.tree(x0 + 0.8 + r() * (x1 - x0 - 1.6), cap, front + 1.6 + r() * 0.3, 0.42 + r() * 0.2, r() < 0.5 ? "plane" : "pine");
        // lamps on the terrace edges
        for (let x = x0 + 2; x < x1 - 1; x += 4.5) K.box(x - 0.05, x + 0.05, cap, cap + 0.35, front + 1.25, front + 1.35, C.warmLight, K_LAMP, true);
      }
      tops.push(cap);
      outer = nOuter; front = nFront; y = cap;
    }
    const x0 = Math.min(inner, outer), x1 = Math.max(inner, outer);
    roofGarden(K, x0, x1, front, back, y, { c: col, sp: "pine" });
    // back: tall plain face with a vertical stair slot
    const sx = s * (gap + 3.2);
    K.box(sx - 0.9, sx + 0.9, 0, y + 2.2, back, back + 1.0, tint(col, 0.93), K_RAW);
    for (let yy = 1.5; yy < y; yy += FL) K.box(sx - 0.25, sx + 0.25, yy, yy + 1.6, back + 1.0, back + 1.04, C.warmLight, K_LAMP, true);
    K.rect(Math.min(s * gap, s * hw), Math.max(s * gap, s * hw), -hd, back + 1, y + 1);
  }
  // the canyon: paved, a long planter, two bridges and a gate beam at the street
  const t4 = tops[3], t8 = tops[7];
  bridge(K, -gap, gap, -hd + 3 * 2.3 + 2, -hd + 3 * 2.3 + 5, t4 - 0.5, FL);
  bridge(K, -gap, gap, -hd + 7 * 2.3 + 1, -hd + 7 * 2.3 + 4, t8 - 0.5, FL);
  vinesOver(K, -gap, gap, -hd + 3 * 2.3 + 2, -hd + 3 * 2.3 + 5, t4 - 0.5, "f", 3, 0.7);
  vinesOver(K, -gap, gap, -hd + 7 * 2.3 + 1, -hd + 7 * 2.3 + 4, t8 - 0.5, "f", 4, 0.7);
  planter(K, -1.0, 1.0, -hd + 4, hd - 6, 0.15, { h: 0.5, c: col });
  K.rect(-1.0, 1.0, -hd + 4, hd - 6, 0.7);
  for (let z = -hd + 6; z < hd - 7; z += 7) K.tree(0, 0.53, z, 0.75, "cypress");
  K.box(-gap - 0.2, gap + 0.2, 6.4, 7.3, -hd - 0.2, -hd + 0.8, col, K_RAW, true);
  K.box(-gap, gap, 6.32, 6.4, -hd + 0.1, -hd + 0.6, C.warmLight, K_LAMP, true);
  void K_PLAIN; void K_GLASS;
}
