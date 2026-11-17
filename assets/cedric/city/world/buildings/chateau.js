// Château d'eau: a ribbed concrete silo wrapped by a helical ramp (three turns), crowned
// by a flared tank with a glazed lookout band and a garden on top. Vines drip from the ramp.
// Signature: the spiral ramp and the mushroom tank.
import { K_PLAIN, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, planter, parapet } from "../kit/parts.js";

export default function chateau(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const r = X.rnd, R = 6, col = C.conc, H = 38, PI = Math.PI;
  K.cyl(0, 0, 0, H, R, R, 24, col, K_RAW);
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; K.obox(Math.cos(a) * (R + 0.12), Math.sin(a) * (R + 0.12), 0.22, 0.18, a, 0.15, H, tint(col, 1.06), K_RAW); }
  // helix ramp: starts at the front (-z side), climbs counter-clockwise
  const turns = 3, a0 = -PI / 2, a1 = a0 + turns * PI * 2, segs = 84, r0 = R + 0.35, r1 = R + 2.6, y0 = 0.15, y1 = H - 1.2;
  K.arcSlab(0, 0, r0, r1, a0, a1, y0, y1, 0.4, segs, C.light, K_RAW);
  K.arcSlab(0, 0, r1 - 0.22, r1, a0, a1, y0 + 0.4, y1 + 0.4, 1.0, segs, col, K_RAW);
  for (let i = 0; i < segs; i += 2) {
    const t = i / segs, a = a0 + (a1 - a0) * t, y = y0 + (y1 - y0) * t + 1.4;
    if (r() < 0.45 && y > 3) K.vine(Math.cos(a) * (r1 + 0.06), y, Math.sin(a) * (r1 + 0.06), Math.cos(a), Math.sin(a), 1 + r() * 1.2, 2 + r() * 3.5);
    if (i % 6 === 0) K.box(Math.cos(a) * (r1 - 0.4) - 0.06, Math.cos(a) * (r1 - 0.4) + 0.06, y - 1.0, y - 0.6, Math.sin(a) * (r1 - 0.4) - 0.06, Math.sin(a) * (r1 - 0.4) + 0.06, C.warmLight, K_LAMP);
  }
  // ramp columns down to the ground on the first turn
  for (let i = 4; i < 24; i += 5) { const a = a0 + (a1 - a0) * i / segs, y = y0 + (y1 - y0) * i / segs; K.cyl(Math.cos(a) * (r1 - 0.4), Math.sin(a) * (r1 - 0.4), 0.15, y, 0.18, 0.18, 6, col, K_RAW); }
  // tank: flared cone, drum with a lookout band, garden roof
  K.cyl(0, 0, H, H + 5, R, 9.6, 24, tint(col, 1.04), K_RAW, 0, true);
  K.cyl(0, 0, H + 5, H + 5.9, 9.6, 9.6, 24, col, K_RAW);
  K.cyl(0, 0, H + 5.9, H + 8.1, 9.2, 9.2, 24, C.glass, K_GLASS);
  K.cyl(0, 0, H + 8.1, H + 9.0, 9.7, 9.7, 24, col, K_RAW);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; K.obox(Math.cos(a) * 9.4, Math.sin(a) * 9.4, 0.2, 0.25, a, H + 5.9, H + 8.1, col, K_RAW); }
  const top = H + 9;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * PI * 2, b = (i + 1) / 24 * PI * 2;
    K.arcSlab(0, 0, 9.4, 9.7, a, b, top, top, 0.9, 1, col, K_RAW);
  }
  planter(K, -3, 3, -3, 3, top, { h: 0.7, c: col });
  K.tree(0, top + 0.58, 0, 1.1, "pine");
  K.bed(-8, 8, -6.5, 6.5, top, 0.35);
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; K.vine(Math.cos(a) * 9.8, top + 0.9, Math.sin(a) * 9.8, Math.cos(a), Math.sin(a), 1.5, 3 + r() * 3); }
  // entrance portal at the foot of the ramp, forecourt planting
  K.box(-1.8, 1.8, 0, 3.4, -R - 0.4, -R + 0.6, tint(col, 0.9), K_RAW);
  K.box(-1.2, 1.2, 0.15, 2.8, -R - 0.45, -R - 0.38, C.glass, K_GLASS, false);
  for (const s of [-1, 1]) {
    planter(K, s * 11 - 3, s * 11 + 3, -6, 6, 0.15, { h: 0.55, c: col });
    K.tree(s * 11, 0.58, -3, 0.9, "plane"); K.tree(s * 11, 0.58, 3, 0.85, "pine");
    K.rect(s * 11 - 3, s * 11 + 3, -6, 6, 0.7);
  }
  K.circle(0, 0, r1 + 0.1, top + 1);
  void parapet;
}
