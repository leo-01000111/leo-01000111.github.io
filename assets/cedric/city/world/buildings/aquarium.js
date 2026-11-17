// The aquarium lot: fenced, gravel, a first bay of bare concrete frame with rebar stubs, a site
// cabin and a few pipe sections. The "Bientôt" sign is drawn by props on the sea-side fence.
import { K_PLAIN, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint } from "../kit/parts.js";

export default function aquarium(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const hw = p.d / 2, hd = p.w / 2, r = X.rnd, fence = [0.3, 0.3, 0.33];
  K.box(-hw, hw, 0.15, 0.24, -hd, hd, [0.22, 0.2, 0.19], K_PLAIN, false);
  // fence: posts, two rails, a gate gap on the front
  const post = (x, z) => K.box(x - 0.07, x + 0.07, 0.15, 2.1, z - 0.07, z + 0.07, fence, K_PLAIN);
  for (let z = -hd; z <= hd + 0.01; z += 2.6) { post(-hw, z); post(hw, z); }
  for (let x = -hw; x <= hw + 0.01; x += 2.6) { if (Math.abs(x) > 2.2) post(x, -hd); post(x, hd); }
  for (const y of [0.8, 1.95]) {
    K.box(-hw, hw, y, y + 0.05, hd - 0.03, hd + 0.03, fence, K_PLAIN, true);
    K.box(-hw, -2.2, y, y + 0.05, -hd - 0.03, -hd + 0.03, fence, K_PLAIN, true);
    K.box(2.2, hw, y, y + 0.05, -hd - 0.03, -hd + 0.03, fence, K_PLAIN, true);
    for (const x of [-hw, hw]) K.box(x - 0.03, x + 0.03, y, y + 0.05, -hd, hd, fence, K_PLAIN, true);
  }
  K.box(-2.2, 2.2, 1.0, 1.05, -hd - 0.03, -hd + 0.03, [0.8, 0.5, 0.2], K_PLAIN, true);   // gate bar
  K.rect(-hw, hw, hd - 0.15, hd + 0.15, 2.2); K.rect(-hw, -2.2, -hd - 0.15, -hd + 0.15, 2.2); K.rect(2.2, hw, -hd - 0.15, -hd + 0.15, 2.2);
  K.rect(-hw - 0.15, -hw + 0.15, -hd, hd, 2.2); K.rect(hw - 0.15, hw + 0.15, -hd, hd, 2.2);
  K.rect(-2.2, 2.2, -hd - 0.1, -hd + 0.1, 1.1);
  // first bay of the future building: columns, one slab, rebar
  const fz0 = 2, fz1 = hd - 3;
  for (let x = -hw + 2; x <= hw - 2 + 0.01; x += (2 * hw - 4) / 2) for (let z = fz0; z <= fz1 + 0.01; z += (fz1 - fz0) / 3) {
    K.box(x - 0.35, x + 0.35, 0.15, 6.4, z - 0.35, z + 0.35, C.light, K_RAW);
    for (const [dx, dz] of [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]]) K.box(x + dx - 0.02, x + dx + 0.02, 6.4, 7.3, z + dz - 0.02, z + dz + 0.02, C.rust, K_PLAIN);
    K.circle(x, z, 0.5, 6.4);
  }
  K.box(-hw + 1.4, hw - 1.4, 3.2, 3.6, fz0 - 0.6, fz1 + 0.6, C.light, K_RAW, true);
  // site cabin and pipe sections
  K.box(-hw + 0.8, -hw + 3.2, 0.2, 2.7, -hd + 3, -hd + 9, tint(C.rust, 0.9), K_PLAIN);
  for (let z = -hd + 3.3; z < -hd + 9; z += 0.4) K.box(-hw + 3.2, -hw + 3.26, 0.3, 2.6, z, z + 0.15, tint(C.rust, 0.75), K_PLAIN);
  K.box(-hw + 3.26, -hw + 3.3, 1.2, 2.0, -hd + 5.5, -hd + 6.6, C.warmLight, K_LAMP, true);
  K.rect(-hw + 0.8, -hw + 3.3, -hd + 3, -hd + 9, 2.7);
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 1.7, z = -hd + 5;
    K.tube([x, 0.85, z - 1.2], [x, 0.85, z + 1.2], 0.7, 10, tint(C.conc, 0.95), K_RAW);
    K.circle(x, z, 0.9, 1.6);
  }
  for (let i = 0; i < 4; i++) K.cyl(-3 + r() * 6, -hd + 9 + r() * 4, 0.15, 0.5 + r() * 0.4, 1.4 + r(), 0.2, 7, [0.33, 0.3, 0.28], K_PLAIN);
}
