// Cédric's glider, drawn from the kit: 17 m span, tapered wings with a little dihedral and tip fins,
// a long slim fuselage with a bubble canopy, a T-tail, one belly wheel. Model frame: +x forward,
// +y up, +z right wing, origin at the wing root on the fuselage axis. Parked ones go into the static
// buffers; the flying one is its own group (body, glass, air brakes, and Cédric in the cockpit).
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { createKit, K_PLAIN, K_GLASS } from "../../world/kit/kit.js";
import { buildCedric } from "../../player/cedric3d.js";

const HULL = [0.82, 0.8, 0.76], ORANGE = [0.93, 0.4, 0.14], DARK = [0.09, 0.09, 0.11], STEEL = [0.18, 0.19, 0.22], TEAL = [0.1, 0.42, 0.5];
export const GLIDER = { span: 17, wheelY: -0.56, cockpit: [0.55, 0.5, 0], hinge: [-0.1, 0.45] };

// Writes the airframe into K (opaque) and G (glass). y0 lifts the whole model (wheel on the ground: -wheelY).
export function buildGlider(K, G, y0 = 0) {
  const P = (x, y, z) => [x, y + y0, z];
  const tube = (a, b, r, r2, c) => K.tube(P(...a), P(...b), r, 8, c, K_PLAIN, r2);
  const bx = (x0, x1, ya, yb, z0, z1, c) => K.box(x0, x1, ya + y0, yb + y0, Math.min(z0, z1), Math.max(z0, z1), c, K_PLAIN, false);
  // fuselage: nose cone (orange), cockpit, tapering boom
  tube([2.35, 0, 0], [1.75, 0.02, 0], 0.07, 0.27, ORANGE);
  tube([1.75, 0.02, 0], [0.85, 0.04, 0], 0.27, 0.42, HULL);
  tube([0.85, 0.04, 0], [-0.45, 0.05, 0], 0.42, 0.4, HULL);
  tube([-0.45, 0.05, 0], [-1.8, 0.2, 0], 0.4, 0.24, HULL);
  tube([-1.8, 0.2, 0], [-3.4, 0.32, 0], 0.24, 0.15, HULL);
  tube([-3.4, 0.32, 0], [-5.6, 0.48, 0], 0.15, 0.085, HULL);
  tube([-2.55, 0.26, 0], [-2.95, 0.29, 0], 0.2, 0.185, TEAL);       // a stripe round the boom
  K.tube(P(2.3, 0, 0), P(2.85, 0, 0), 0.014, 4, STEEL, K_PLAIN);     // pitot
  // belly wheel and tail skid
  K.tube(P(0.35, -0.4, -0.07), P(0.35, -0.4, 0.07), 0.16, 8, DARK, K_PLAIN);
  bx(0.3, 0.4, -0.25, 0.1, -0.04, 0.04, STEEL);
  bx(-5.38, -5.28, 0.18, 0.5, -0.02, 0.02, STEEL);
  // wings: root, mid, tip stations (z, dihedral y, leading edge x, trailing edge x, top thickness)
  const st = [[0.3, 0.14, 0.55, -0.75, 0.17], [4.2, 0.34, 0.45, -0.55, 0.11], [8.5, 0.64, 0.15, -0.35, 0.045]];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const a = st[i], b = st[i + 1], ca = a[2] - a[3], cb = b[2] - b[3];
      const c = i === 1 ? ORANGE : HULL;
      K.hexa([P(a[2], a[1], a[0] * s), P(a[3], a[1], a[0] * s), P(b[3], b[1], b[0] * s), P(b[2], b[1], b[0] * s),
              P(a[2] - 0.12 * ca, a[1] + a[4], a[0] * s), P(a[3], a[1] + a[4] * 0.55, a[0] * s), P(b[3], b[1] + b[4] * 0.55, b[0] * s), P(b[2] - 0.12 * cb, b[1] + b[4], b[0] * s)], c, K_PLAIN, true, true);
    }
    bx(-0.3, 0.12, 0.64, 1.14, 8.42 * s, 8.5 * s, ORANGE);                                          // tip fin
    // aileron line: a dark strip on the outer trailing edge
    K.hexa([P(-0.58, 0.404, 4.3 * s), P(-0.55, 0.404, 4.3 * s), P(-0.35, 0.667, 8.4 * s), P(-0.38, 0.667, 8.4 * s),
            P(-0.58, 0.41, 4.3 * s), P(-0.55, 0.41, 4.3 * s), P(-0.35, 0.673, 8.4 * s), P(-0.38, 0.673, 8.4 * s)], DARK, K_PLAIN, false, true);
    // tailplane
    K.hexa([P(-5.0, 1.93, 0), P(-5.75, 1.93, 0), P(-5.75, 1.93, 1.65 * s), P(-5.45, 1.93, 1.65 * s),
            P(-5.0, 2.01, 0), P(-5.75, 1.99, 0), P(-5.75, 1.97, 1.65 * s), P(-5.45, 1.97, 1.65 * s)], HULL, K_PLAIN, true, true);
  }
  // fin
  K.hexa([P(-4.55, 0.42, -0.05), P(-5.7, 0.45, -0.05), P(-5.7, 0.45, 0.05), P(-4.55, 0.42, 0.05),
          P(-5.1, 1.95, -0.025), P(-5.78, 1.95, -0.025), P(-5.78, 1.95, 0.025), P(-5.1, 1.95, 0.025)], ORANGE, K_PLAIN, false, true);
  // cockpit: glare shield, canopy rails, the glass bubble
  bx(1.0, 1.45, 0.3, 0.42, -0.2, 0.2, DARK);
  for (const z of [-0.27, 0.27]) bx(-0.95, 1.3, 0.28, 0.33, z - 0.025, z + 0.025, STEEL);
  bx(1.24, 1.32, 0.28, 0.4, -0.27, 0.27, STEEL);
  G.hexa([P(1.3, 0.3, -0.27), P(1.3, 0.3, 0.27), P(-0.95, 0.3, 0.27), P(-0.95, 0.3, -0.27),
          P(0.72, 0.98, -0.2), P(0.72, 0.98, 0.2), P(-0.55, 0.98, 0.2), P(-0.55, 0.98, -0.2)], [0.55, 0.7, 0.8], K_GLASS, false, true);
}

// The flying glider, one group: body + glass + brakes (+ Cédric). Rotation order YZX = yaw, pitch, roll.
export function createGliderObject(g) {
  const shade = g.env.shade;
  const B = new Buf(1e5), BG = new Buf(1e5);
  const K = createKit(B, g.world), KG = createKit(BG, g.world);
  K.at(0, 0, 0); KG.at(0, 0, 0);
  buildGlider(K, KG, 0);
  const body = new THREE.Mesh(B.geometry(), shade.world), glass = new THREE.Mesh(BG.geometry(), shade.glass);
  // air brakes: two panels hinged at their rear edge; the front edge rises
  const BB = new Buf(1e4), KB = createKit(BB, g.world);
  KB.at(0, 0, 0);
  for (const s of [-1, 1]) KB.box(0, 0.55, 0, 0.035, s > 0 ? 2.2 : -4.4, s > 0 ? 4.4 : -2.2, HULL, K_PLAIN, true);
  const brakes = new THREE.Mesh(BB.geometry(), shade.world);
  brakes.position.set(GLIDER.hinge[0], GLIDER.hinge[1], 0);
  const cedric = buildCedric(window.CEDRIC_DESIGN, { ink: "#9db8ff", eye: "#ff4d63" }, 1.3);
  cedric.mesh.position.set(GLIDER.cockpit[0], GLIDER.cockpit[1], GLIDER.cockpit[2]);
  const group = new THREE.Group();
  group.rotation.order = "YZX";
  group.add(body, glass, brakes, cedric.mesh);
  group.visible = false;
  g.scene.add(group);
  const tris = B.tris + BG.tris + BB.tris;
  return {
    group, cedric, tris: tris + cedric.mesh.count * 12,
    set(x, y, z, psi, phi, pitch, brake) {
      group.position.set(x, y, z);
      group.rotation.set(phi, -psi, pitch);
      brakes.rotation.z = brake * 1.0;
      brakes.visible = brake > 0.04;                                   // closed, they lie flush in the wing
    },
    dispose() {
      g.scene.remove(group);
      body.geometry.dispose(); glass.geometry.dispose(); brakes.geometry.dispose(); cedric.dispose();
    },
  };
}
