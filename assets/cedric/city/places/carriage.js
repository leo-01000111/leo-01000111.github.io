// A short piece of carriage interior for the "window" shot of the train ride: floor, ceiling, a
// wall with one wide window on the left, a table and a bench. It is placed in the world at the
// ride's anchor (high over the sea, looking east at the city), so the city slides past the window.
// Local frame: +x forward, +z to the right, y up, origin at floor level in the middle. The window
// is on the left (z < 0). Own material with the dithered window off.
import * as THREE from "../core/three.js";
import { Buf } from "../core/buf.js";
import { createKit, K_PLAIN, K_NEON, K_LAMP } from "../world/kit/kit.js";
import { createWorldMaterial } from "../env/shade.js";

const BODY = [0.2, 0.3, 0.33], CONC = [0.5, 0.48, 0.45], DARK = [0.06, 0.07, 0.09], FABRIC = [0.13, 0.3, 0.32], WOOD = [0.36, 0.24, 0.16];

export function createCarriage(g, teal) {
  const dummy = { collide: null, anchors: [], glows: [], signs: {}, props: [] };
  const B = new Buf(1e4), K = createKit(B, dummy);
  K.at(0, 0, 0);
  const W0 = 1.5, WT = 0.2, X0 = 3.6;
  K.box(-X0, X0, -0.3, 0, -W0 - WT, W0 + WT, DARK, K_PLAIN, true);                // floor
  K.box(-X0, X0, 2.7, 3.0, -W0 - WT, W0 + WT, CONC, K_PLAIN, true);               // ceiling
  K.box(-2.9, 2.9, 2.66, 2.7, -0.25, 0.25, [1.0, 0.72, 0.42], K_LAMP, true);       // ceiling light
  // window wall (left): sill, header, two piers around a 4.4 x 1.3 m window
  K.box(-X0, X0, 0, 0.95, -W0 - WT, -W0, BODY, K_PLAIN, true);
  K.box(-X0, X0, 2.25, 2.7, -W0 - WT, -W0, BODY, K_PLAIN, true);
  for (const s of [-1, 1]) K.box(s > 0 ? 2.2 : -X0, s > 0 ? X0 : -2.2, 0.95, 2.25, -W0 - WT, -W0, BODY, K_PLAIN, true);
  K.box(-2.2, 2.2, 0.92, 0.98, -W0 - 0.05, -W0 + 0.12, CONC, K_PLAIN, true);       // sill ledge
  K.box(-2.2, 2.2, 2.25, 2.3, -W0 + 0.0, -W0 + 0.05, teal, K_NEON, true);          // teal line under the header
  // opposite wall and the two ends, lit panels
  K.box(-X0, X0, 0, 2.7, W0, W0 + WT, BODY, K_PLAIN, true);
  K.box(-3.0, 3.0, 1.2, 2.0, W0 - 0.02, W0, [1.0, 0.7, 0.4], K_LAMP, true);
  for (const s of [-1, 1]) K.box(s > 0 ? X0 - WT : -X0, s > 0 ? X0 : -X0 + WT, 0, 2.7, -W0 - WT, W0 + WT, BODY, K_PLAIN, true);
  // table under the window, bench along the far wall
  K.box(-1.4, 1.4, 0.72, 0.78, -W0 + 0.15, -W0 + 0.85, WOOD, K_PLAIN, true);
  for (const x of [-1.3, 1.3]) K.box(x - 0.04, x + 0.04, 0, 0.72, -W0 + 0.7, -W0 + 0.78, [0.14, 0.15, 0.17], K_PLAIN, false);
  K.box(-2.4, 2.4, 0, 0.5, 0.55, 1.35, FABRIC, K_PLAIN, false);
  K.box(-2.4, 2.4, 0.5, 1.25, 1.3, 1.42, FABRIC, K_PLAIN, true);
  const mat = createWorldMaterial(Object.assign({}, g.env.shade.uniforms, { uCut: { value: 0 } }));
  const geo = B.geometry();
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.name = "carriage";
  group.add(mesh);
  group.rotation.order = "YXZ";
  group.visible = false;
  g.scene.add(group);
  return {
    group, tris: B.tris,
    // local point -> world, into `out`
    toWorld(out, x, y, z) { out.set(x, y, z); group.localToWorld(out); return out; },
    show(on) { group.visible = !!on; },
    dispose() { g.scene.remove(group); geo.dispose(); mat.dispose(); },
  };
}
