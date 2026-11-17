// Médiathèque. A long glass hall behind a wall of tall concrete fins that turn, one after the
// other, like the pages of a book being leafed; a reading room cantilevers out over the
// forecourt with one big window to the sunset. Signature: the turning fin wall.
import { K_PLAIN, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, bands, fins, planter, roofGarden, stairs, parapet } from "../kit/parts.js";

export default function mediatheque(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const hw = p.d / 2, hd = p.w / 2, col = C.light, fz = -hd + 4.2, H = 13.2;
  // glass hall with slab edges
  K.box(-hw + 0.3, hw - 0.3, 0.15, H, fz + 0.5, hd - 3, C.glass, K_GLASS, false);
  for (const y of [0.15, 4.4, 8.8]) K.box(-hw + 0.1, hw - 0.1, y, y + 0.4, fz - 0.1, hd - 3, col, K_RAW, y > 0.2);
  K.box(-hw, hw, H, H + 0.8, fz - 0.4, hd - 3, col, K_RAW, true);
  // the turning fins
  fins(K, -hw, hw, fz, 0.15, H, 30, 1.9, 0.26, f => -(0.05 + f * f * 1.0), col);
  // closed back with high slot windows
  bands(K, -hw, hw, hd - 3, hd, 0, H + 0.8, { sides: "b", sill: 2.3, rec: 0.3, cap: 0, c: tint(col, 0.94) });
  for (const s of [-1, 1]) K.box(s < 0 ? -hw - 0.4 : hw, s < 0 ? -hw : hw + 0.4, 0, H + 0.8, fz - 0.4, hd, tint(col, 0.97), K_RAW);
  // cantilevered reading room over the forecourt
  const rx0 = -hw + 1.5, rx1 = -1.5, rz0 = -hd - 1.8, rz1 = 3;
  const ry = bands(K, rx0, rx1, rz0, rz1, H + 0.8, H + 0.8 + 4.8, { sides: "f", rec: 0.9, sill: 0.6, cap: 0.5, c: col });
  K.box(rx0, rx1, H + 0.75, H + 0.8, rz0 + 0.5, fz - 2.2, C.warmLight, K_LAMP, true);
  roofGarden(K, rx0, rx1, rz0, rz1, ry, { c: col, pergola: false, len: 4 });
  roofGarden(K, rx1 + 0.4, hw, fz - 0.4, hd, H + 0.8, { c: col, len: 5 });
  // forecourt: wide steps, benches of concrete, planters
  stairs(K, -6, 6, -hd + 0.4, -hd + 3.0, 0.15, 0.75, 4, col);
  K.box(-hw, -6, 0.15, 0.75, -hd + 0.4, fz, col, K_RAW);
  K.box(6, hw, 0.15, 0.75, -hd + 0.4, fz, col, K_RAW);
  planter(K, -hw + 1, -8, -hd + 0.8, -hd + 2.6, 0.75, { h: 0.5, vines: "f", len: 0.8 });
  planter(K, 8, hw - 1, -hd + 0.8, -hd + 2.6, 0.75, { h: 0.5, vines: "f", len: 0.8 });
  K.tree(-12, 1.15, -hd + 1.7, 0.8, "plane"); K.tree(12, 1.15, -hd + 1.7, 0.8, "plane");
  K.rect(-hw - 0.4, hw + 0.4, fz - 2, hd, ry + 1);
  K.rect(-hw, hw, -hd + 0.4, fz - 2, 0.75);
  void K_PLAIN;
}
