// La Serre: a glass barrel-vaulted greenhouse held inside a monumental concrete table frame,
// palms rising into the vault. The glazed arch gable faces the plaza. Signature: the glowing
// glass vault in its concrete cage.
import { K_PLAIN, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, planter, stairs, vinesOver } from "../kit/parts.js";

export default function serre(K, p, X) {
  K.at(p.x, p.z, "s", X.rnd);
  const G = X.glass; G.at(p.x, p.z, "s");
  const hw = p.w / 2, hd = p.d / 2, col = C.conc, fx = hw - 0.8, ft = 14.5;
  const gx = 8.4, gz0 = -hd + 2.2, gz1 = hd - 2.2, wy = 6.2, R = gx, vy = wy;
  const tintG = [1.0, 0.72, 0.42];

  // plinth and floor
  K.box(-fx, fx, 0, 0.7, -hd + 1, hd - 1, col, K_RAW, false);
  stairs(K, -5, 5, -hd - 0.2, -hd + 1, 0.15, 0.7, 3, C.light);
  K.box(-gx, gx, 0.7, 0.75, gz0, gz1, [0.25, 0.2, 0.16], K_PLAIN, false);
  // glass walls and the vault (transparent material), steel ribs
  for (const x of [-gx, gx]) G.box(x - 0.02, x + 0.02, 0.75, wy, gz0, gz1, tintG, K_GLASS);
  const N = 12, arc = i => { const a = Math.PI * i / N; return [Math.cos(a) * R, vy + Math.sin(a) * R]; };
  for (let i = 0; i < N; i++) {
    const [x0, y0] = arc(i), [x1, y1] = arc(i + 1);
    G.face([G.W(x0, y0, gz0), G.W(x1, y1, gz0), G.W(x1, y1, gz1), G.W(x0, y0, gz1)], tintG, K_GLASS);
    for (const z of [gz0, gz1]) G.face([G.W(0, vy, z), G.W(x0, y0, z), G.W(x1, y1, z)], tintG, K_GLASS);
  }
  for (const z of [gz0, gz1]) G.box(-gx, gx, 0.75, wy, z - 0.02, z + 0.02, tintG, K_GLASS);
  for (let z = gz0; z <= gz1 + 0.01; z += (gz1 - gz0) / 8) {
    for (let i = 0; i < N; i++) K.tube([arc(i)[0], arc(i)[1], z], [arc(i + 1)[0], arc(i + 1)[1], z], 0.07, 4, C.steel, K_PLAIN);
    for (const x of [-gx, gx]) K.box(x - 0.08, x + 0.08, 0.75, wy, z - 0.08, z + 0.08, C.steel, K_PLAIN);
  }
  for (let i = 1; i < N; i += 2) K.tube([arc(i)[0], arc(i)[1], gz0], [arc(i)[0], arc(i)[1], gz1], 0.06, 4, C.steel, K_PLAIN);
  // gable door
  K.box(-1.6, 1.6, 0.7, 3.4, gz0 - 0.3, gz0, C.steel, K_PLAIN, false);
  K.box(-1.3, 1.3, 0.7, 3.1, gz0 - 0.34, gz0 - 0.3, tintG, K_LAMP, false);
  K.sign("serre", 0, 4.1, gz0 - 0.42, 0, -1, 5); // --- serre ---

  // concrete table frame: columns, deep beams, open roof grid over the vault
  const zs = []; for (let i = 0; i <= 6; i++) zs.push(-hd + 1 + (2 * hd - 2) * i / 6);
  for (const z of zs) for (const x of [-fx, fx]) K.box(x - 0.55, x + 0.55, 0.7, ft, z - 0.55, z + 0.55, col, K_RAW);
  for (const z of zs) K.box(-fx - 0.55, fx + 0.55, ft, ft + 1.3, z - 0.4, z + 0.4, col, K_RAW, true);
  for (const x of [-fx, fx]) {
    K.box(x - 0.55, x + 0.55, ft, ft + 1.3, -hd + 1, hd - 1, col, K_RAW, true);
    K.box(x - 0.5, x + 0.5, 7.2, 8.0, -hd + 1, hd - 1, col, K_RAW, true);
    vinesOver(K, x - 0.5, x + 0.5, -hd + 1, hd - 1, 8.0, x < 0 ? "l" : "r", 5, 0.5);
    vinesOver(K, x - 0.55, x + 0.55, -hd + 1, hd - 1, ft + 1.3, x < 0 ? "l" : "r", 7, 0.4);
  }
  for (const x of [-fx / 2, 0, fx / 2]) K.box(x - 0.3, x + 0.3, ft + 0.5, ft + 1.3, -hd + 1, hd - 1, col, K_RAW, true);
  for (const z of zs) for (const x of [-fx, fx]) K.box(x - 0.6, x + 0.6, 0.62, 0.7, z - 0.65, z - 0.58, C.warmLight, K_LAMP, true);
  // planters on the frame's top beams
  for (const x of [-fx, fx]) planter(K, x - 0.5, x + 0.5, -hd + 2, hd - 2, ft + 1.3, { h: 0.4, t: 0.1, c: col });

  // inside: palms and beds; warm floor lights
  K.bed(-gx + 0.6, gx - 0.6, gz0 + 0.8, gz1 - 0.8, 0.75, 1.0);
  const r = X.rnd;
  for (let z = gz0 + 3; z < gz1 - 1; z += 4.2) {
    K.tree(-3.5 + r() * 1.5, 0.75, z, 1.3 + r() * 0.5, "palm");
    K.tree(3 - r() * 1.5, 0.75, z + 2, 1.1 + r() * 0.5, r() < 0.7 ? "palm" : "plane");
  }
  for (let z = gz0 + 2; z < gz1; z += 5) K.box(-0.4, 0.4, 0.75, 0.82, z, z + 0.8, C.warmLight, K_LAMP, true);
  K.rect(-fx - 0.6, fx + 0.6, -hd + 0.4, hd - 0.4, ft + 1.3);
  void tint;
}
