// The train: three low cars and two wedge noses, concrete grey and slate teal, a green roof
// strip, a lit window band and lit doorways. Symmetric, so it never has to turn round: the same
// train arrives heading west and leaves heading east. Doors are instanced leaves that slide.
// One body mesh + one instanced mesh; nothing here depends on world position, so it can move.
import * as THREE from "../core/three.js";
import { Buf } from "../core/buf.js";
import { createKit, K_PLAIN, K_NEON, K_LAMP, K_LEAF } from "../world/kit/kit.js";
import { createWorldMaterial } from "../env/shade.js";

const BODY = [0.2, 0.3, 0.33], SKIRT = [0.07, 0.08, 0.1], ROOF = [0.52, 0.5, 0.47], DOOR = [0.09, 0.15, 0.18];
const POLY = [[-1.25, 0.42], [1.25, 0.42], [1.45, 0.7], [1.45, 2.75], [1.1, 3.55], [-1.1, 3.55], [-1.45, 2.75], [-1.45, 0.7]];
const CARS = [-11, 0, 11], CAR_L = 10.4, NOSE_L = 3.2;
export const DOOR_DX = [-2.9, 2.9];                       // door centres, relative to a car centre
export const DOORS = CARS.flatMap(c => DOOR_DX.map(d => c + d));   // local x of the six doors (per side)
export const HALF_LEN = CARS[2] + CAR_L / 2 + 0.2 + 0.0;   // 16.4
export const FLOOR_Y = 0.62;                              // the cars' floor, 12 cm over the platform

export function createTrain(g) {
  const dummy = { collide: null, anchors: [], glows: [], signs: {}, props: [] };
  const B = new Buf(1e4), K = createKit(B, dummy);
  K.at(0, 0, 0, () => 0.5);
  const sections = (xa, xb, sa, sb, c) => {          // body between two rings (the nose shrinks)
    const ring = (x, sz, sy) => POLY.map(([z, y]) => [x, 0.42 + (y - 0.42) * sy, z * sz]);
    const A = ring(xa, sa[0], sa[1]), Bq = ring(xb, sb[0], sb[1]), f = [A, Bq];
    for (let i = 0; i < POLY.length; i++) { const j = (i + 1) % POLY.length; f.push([A[i], A[j], Bq[j], Bq[i]]); }
    K.solid(f, c, K_PLAIN);
  };
  CARS.forEach((c, i) => {
    const x0 = i === 0 ? c - CAR_L / 2 + NOSE_L : c - CAR_L / 2, x1 = i === 2 ? c + CAR_L / 2 - NOSE_L : c + CAR_L / 2;
    sections(x0, x1, [1, 1], [1, 1], BODY);
    if (i === 0) sections(x0, x0 - NOSE_L - 0.2, [1, 1], [0.6, 0.78], BODY);
    if (i === 2) sections(x1, x1 + NOSE_L + 0.2, [1, 1], [0.6, 0.78], BODY);
    // skirt, bogies, roof pod with a green strip
    K.box(x0, x1, 0.3, 0.62, -1.15, 1.15, SKIRT, K_PLAIN, true);
    for (const bx of [-3.7, 3.7]) K.box(c + bx - 1.1, c + bx + 1.1, 0.3, 0.8, -1.05, 1.05, SKIRT, K_PLAIN, true);
    const pod = i === 0 ? [c - 1, c + 4.2] : i === 2 ? [c - 4.2, c + 1] : [c - 4.2, c + 4.2];
    K.box(pod[0], pod[1], 3.55, 3.85, -0.8, 0.8, ROOF, K_PLAIN, true);
    K.box(pod[0] + 0.2, pod[1] - 0.2, 3.85, 3.97, -0.62, 0.62, [0.62, 0, 0], K_LEAF, true);
    // lit windows, lit doorways, an amber livery line
    const wins = i === 0 ? [[0, 3], [4.9, 1.1]] : i === 2 ? [[-4.9, 1.1], [0, 3]] : [[-4.9, 1.1], [0, 3], [4.9, 1.1]];
    for (const s of [-1, 1]) {
      for (const [dx, w] of wins) K.box(c + dx - w / 2, c + dx + w / 2, 1.55, 2.45, s > 0 ? 1.43 : -1.49, s > 0 ? 1.49 : -1.43, [1.0, 0.7, 0.4], K_LAMP, true);
      for (const dd of DOOR_DX) K.box(c + dd - 0.72, c + dd + 0.72, 0.7, 2.62, s > 0 ? 1.44 : -1.48, s > 0 ? 1.48 : -1.44, [1.0, 0.8, 0.52], K_LAMP, true);
      K.box(x0 + (i === 0 ? 0.2 : 0), x1 - (i === 2 ? 0.2 : 0), 0.98, 1.1, s > 0 ? 1.44 : -1.47, s > 0 ? 1.47 : -1.44, [0.95, 0.55, 0.2], K_PLAIN, true);
    }
  });
  for (const x of [CARS[0] + CAR_L / 2 + 0.3, CARS[1] + CAR_L / 2 + 0.3]) K.box(x - 0.3, x + 0.3, 0.6, 3.3, -1.2, 1.2, SKIRT, K_PLAIN, true); // bellows between cars
  for (const s of [-1, 1]) {                                               // cyan visors and warm headlights on both noses
    const x = s * (CARS[2] + CAR_L / 2 + 0.2 - 0.0);
    K.box(s > 0 ? x - 0.03 : x - 0.04, s > 0 ? x + 0.04 : x + 0.03, 1.9, 2.55, -0.68, 0.68, [0.2, 0.95, 1.0], K_NEON, true);
    for (const z of [-0.6, 0.6]) K.box(s > 0 ? x - 0.03 : x - 0.04, s > 0 ? x + 0.04 : x + 0.03, 0.78, 0.98, z - 0.14, z + 0.14, [1.0, 0.85, 0.6], K_LAMP, true);
  }

  const mat = createWorldMaterial(Object.assign({}, g.env.shade.uniforms, { uCut: { value: 0 } })); // never dither the train away
  const group = new THREE.Group();
  group.name = "train";
  const body = new THREE.Mesh(B.geometry(), mat);
  body.frustumCulled = false;
  // door leaves
  const LB = new Buf(1e3), LK = createKit(LB, dummy);
  LK.at(0, 0, 0);
  LK.box(-0.35, 0.35, 0.62, 2.62, -0.04, 0.04, DOOR, K_PLAIN, true);
  LK.box(-0.3, 0.3, 1.5, 2.3, 0.04, 0.045, [0.9, 0.62, 0.35], K_LAMP, true);
  LK.box(-0.3, 0.3, 1.5, 2.3, -0.045, -0.04, [0.9, 0.62, 0.35], K_LAMP, true);
  const leaves = new THREE.InstancedMesh(LB.geometry(), mat, DOORS.length * 4);
  leaves.frustumCulled = false;
  group.add(body, leaves);
  group.visible = false;
  g.scene.add(group);
  const tris = B.tris + LB.tris * DOORS.length * 4;

  const m4 = new THREE.Matrix4(), open = [0, 0];       // open[0] = north (-z) side, open[1] = south (+z)
  function paint(side) {
    const s = side < 0 ? 0 : 1, o = open[s], z = side * 1.5;
    for (let d = 0; d < DOORS.length; d++) for (let l = 0; l < 2; l++) {
      const x = DOORS[d] + (l ? 1 : -1) * (0.35 + 0.78 * o);
      leaves.setMatrixAt((s * DOORS.length + d) * 2 + l, m4.makeTranslation(x, 0, z));
    }
    leaves.instanceMatrix.needsUpdate = true;
  }
  paint(-1); paint(1);

  const api = {
    group, tris, halfLen: HALF_LEN, doors: DOORS,
    x: 0, z: 0,
    setPose(x, z) { api.x = x; api.z = z; group.position.set(x, 0, z); },
    setDoors(side, v) { const s = side < 0 ? 0 : 1; if (Math.abs(open[s] - v) < 1e-4) return; open[s] = v; paint(side); },
    get doorsOpen() { return Math.max(open[0], open[1]); },
    show(on) { group.visible = !!on; },
    dispose() {
      g.scene.remove(group);
      body.geometry.dispose(); leaves.geometry.dispose(); leaves.dispose(); mat.dispose();
    },
  };
  return api;
}
