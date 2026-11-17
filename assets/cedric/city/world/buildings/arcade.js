// Salle d'arcade. Low black volume under a sawtooth roof whose glazed teeth glow magenta, a
// knife-thin canopy with a neon edge wrapping the front and the long north side, and a row of
// round "screens" along it. Signature: the glowing sawtooth seen from the park and the street.
import { K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, planter } from "../kit/parts.js";

export default function arcade(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const hw = p.d / 2, hd = p.w / 2, neon = X.neon.arcade, H = 5.2;
  const blk = C.black, z0 = -hd + 3.5;   // forecourt under the canopy at the front

  K.box(-hw, hw, 0, H, z0, hd, blk, K_RAW);
  K.box(-hw - 0.15, hw + 0.15, H, H + 0.3, z0 - 0.15, hd + 0.15, tint(blk, 1.3), K_RAW, true);
  // sawtooth roof: vertical glazed faces look at the sea
  const teeth = 6, len = (hd - z0) / teeth;
  for (let i = 0; i < teeth; i++) {
    const za = z0 + 0.4 + i * len, zb = za + len - 0.2, yb = H + 0.3, yt = yb + 2.3;
    K.hexa([[-hw + 0.3, yb, za], [hw - 0.3, yb, za], [hw - 0.3, yb, zb], [-hw + 0.3, yb, zb],
            [-hw + 0.3, yt, za], [hw - 0.3, yt, za], [hw - 0.3, yb + 0.02, zb], [-hw + 0.3, yb + 0.02, zb]], tint(blk, 1.15), K_RAW, false, true);
    K.box(-hw + 0.6, hw - 0.6, yb + 0.15, yt - 0.25, za - 0.08, za - 0.02, tint(neon, 0.55), K_NEON, true);
    for (let x = -hw + 1.8; x < hw - 1; x += 1.8) K.box(x - 0.06, x + 0.06, yb + 0.1, yt - 0.15, za - 0.12, za - 0.06, blk, K_PLAIN, true);
  }
  // entrance: recessed glass doors and a glowing reveal
  K.box(-3.2, 3.2, 0.15, 3.3, z0 - 0.25, z0, C.glass, K_GLASS, false);
  K.box(-3.5, 3.5, 3.3, 3.42, z0 - 0.3, z0, tint(neon, 0.9), K_NEON, true);
  // canopy: across the front and along the north (+x local) side, neon on its outer edges
  const cy = 3.7, ce = hw + 2.2;
  K.box(-hw - 0.6, ce, cy, cy + 0.2, -hd, z0, C.dark, K_RAW, true);
  K.box(hw, ce, cy, cy + 0.2, z0, hd + 0.5, C.dark, K_RAW, true);
  K.box(-hw - 0.6, ce, cy - 0.08, cy, -hd, -hd + 0.1, neon, K_NEON, true);
  K.box(ce - 0.1, ce, cy - 0.08, cy, -hd, hd + 0.5, neon, K_NEON, true);
  for (let z = -hd + 0.4; z < hd; z += 6.5) { K.cyl(ce - 0.35, z, 0.15, cy, 0.09, 0.09, 6, C.steel, K_PLAIN); K.circle(ce - 0.35, z, 0.25, cy); }
  K.cyl(-hw, -hd + 0.4, 0.15, cy, 0.09, 0.09, 6, C.steel, K_PLAIN); K.circle(-hw, -hd + 0.4, 0.25, cy);
  // round screens along the north side, alternating magenta / cyan
  const cyan = [0.25, 0.9, 1.0];
  let i = 0;
  for (let z = z0 + 3; z < hd - 2; z += 3.4, i++) {
    K.tube([hw - 0.02, 2.0, z], [hw + 0.12, 2.0, z], 0.95, 18, tint(blk, 1.6), K_RAW);
    K.tube([hw + 0.1, 2.0, z], [hw + 0.16, 2.0, z], 0.75, 18, i % 2 ? cyan : neon, K_NEON);
  }
  // rooftop plant and a couple of planters by the doors
  K.box(-2, 1, H + 0.3, H + 1.5, hd - 6, hd - 3, C.steel, K_PLAIN, false);
  planter(K, -hw + 0.2, -hw + 1.4, -hd + 0.5, -hd + 3, 0.15, { h: 0.7 });
  planter(K, hw - 1.4, hw - 0.2, -hd + 0.5, -hd + 2.2, 0.15, { h: 0.7 });
  K.box(-hw + 0.5, hw - 0.5, cy - 0.04, cy, -hd + 1.2, -hd + 1.4, C.warmLight, K_LAMP, true);

  K.sign("arcade", 0, 4.5, z0 - 0.08, 0, -1, 7.5);
  K.rect(-hw, hw, z0, hd, H + 2.6);
  K.rect(-hw + 0.2, -hw + 1.4, -hd + 0.5, -hd + 3, 0.9);
  K.rect(hw - 1.4, hw - 0.2, -hd + 0.5, -hd + 2.2, 0.9);
}
