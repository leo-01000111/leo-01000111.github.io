// Flora layer. Four tree species (stone pine, plane, cypress, palm), shrubs, hedges, grass tufts
// and flowers as InstancedMesh; vines merged per chunk. Leaf colour follows the season through
// the shared foliage uniform (the red channel < 0.3 stays evergreen); plane trees drop their
// crowns in winter and show bare branches; flowers only in spring and summer. Snow and wetness
// come from the shared shader. Anchors come from the buildings and props layers.
import * as THREE from "../core/three.js";
import { Buf } from "../core/buf.js";
import { seeded } from "../core/rng.js";
import { createKit, K_LEAF, K_PLAIN } from "./kit/kit.js";
import * as L from "./layout.js";

const BARK = [0.2, 0.14, 0.11], PALMB = [0.34, 0.27, 0.2];

function model(fn) {
  const B = new Buf(1e5), K = createKit(B, { collide: null, anchors: [], glows: [], signs: {}, props: [] });
  K.at(0, 0, 0, seeded(5));
  fn(K);
  return B.geometry();
}
const leaf = (r) => [r, 1, 1];

const MODELS = {
  pine: K => {
    K.tube([0, 0, 0], [0.5, 4.3, 0.15], 0.2, 6, BARK, K_PLAIN, 0.14);
    K.tube([0.35, 3.0, 0.1], [-0.9, 4.4, -0.4], 0.09, 5, BARK, K_PLAIN);
    K.cyl(0.5, 0.15, 3.9, 4.75, 2.7, 2.2, 9, leaf(0.16), K_LEAF, 0, true);
    K.cyl(0.6, 0.2, 4.75, 5.25, 2.2, 1.0, 9, leaf(0.22), K_LEAF, 0.3);
    K.cyl(-0.9, -0.4, 4.2, 4.8, 1.4, 1.0, 7, leaf(0.12), K_LEAF, 0, true);
    K.cyl(-0.9, -0.4, 4.8, 5.05, 1.0, 0.3, 7, leaf(0.2), K_LEAF);
  },
  planeTrunk: K => {
    K.tube([0, 0, 0], [0, 3.0, 0], 0.22, 6, BARK, K_PLAIN, 0.17);
    for (const [x, y, z] of [[1.4, 5.4, 0.3], [-1.2, 5.6, 0.6], [0.2, 6.2, -1.3], [-0.3, 5.9, 1.4], [0.1, 6.6, 0.1]]) {
      K.tube([0, 2.9, 0], [x, y, z], 0.1, 4, BARK, K_PLAIN, 0.05);
      K.tube([x, y, z], [x * 1.35, y + 0.8, z * 1.35 + 0.2], 0.05, 3, BARK, K_PLAIN, 0.02);
    }
  },
  planeCrown: K => {
    K.cyl(0, 0, 3.2, 5.3, 1.9, 2.4, 8, leaf(1), K_LEAF, 0, true);
    K.cyl(0, 0, 5.3, 7.2, 2.4, 0.9, 8, leaf(1), K_LEAF, 0.4);
    K.cyl(1.2, 0.5, 4.2, 6.0, 1.3, 0.6, 7, leaf(1), K_LEAF, 0.2, true);
    K.cyl(-1.1, -0.8, 4.5, 6.4, 1.4, 0.5, 7, leaf(1), K_LEAF, 0.9, true);
  },
  cypress: K => {
    K.tube([0, 0, 0], [0, 0.7, 0], 0.13, 5, BARK, K_PLAIN);
    K.cyl(0, 0, 0.5, 2.6, 0.55, 0.95, 7, leaf(0.1), K_LEAF, 0, true);
    K.cyl(0, 0, 2.6, 7.4, 0.95, 0.0, 7, leaf(0.18), K_LEAF, 0.3);
  },
  palm: K => {
    let p = [0, 0, 0];
    for (let i = 1; i <= 5; i++) { const q = [Math.sin(i * 0.35) * 0.55, i * 1.25, 0.1 * i]; K.tube(p, q, 0.2 - i * 0.015, 6, PALMB, K_PLAIN); p = q; }
    const top = p;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.2, c = Math.cos(a), s = Math.sin(a), n = [-s * 0.32, c * 0.32];
      const m = [top[0] + c * 1.5, top[1] + 0.45, top[2] + s * 1.5], e = [top[0] + c * 3.0, top[1] - 0.8, top[2] + s * 3.0];
      for (const [A, Bp, w0, w1] of [[top, m, 0.12, 1], [m, e, 1, 0.1]]) {
        K.hexa([[A[0] - n[0] * w0, A[1], A[2] - n[1] * w0], [A[0] + n[0] * w0, A[1], A[2] + n[1] * w0], [Bp[0] + n[0] * w1, Bp[1], Bp[2] + n[1] * w1], [Bp[0] - n[0] * w1, Bp[1], Bp[2] - n[1] * w1],
          [A[0] - n[0] * w0, A[1] + 0.06, A[2] - n[1] * w0], [A[0] + n[0] * w0, A[1] + 0.06, A[2] + n[1] * w0], [Bp[0] + n[0] * w1, Bp[1] + 0.06, Bp[2] + n[1] * w1], [Bp[0] - n[0] * w1, Bp[1] + 0.06, Bp[2] - n[1] * w1]], leaf(0.15 + (i % 3) * 0.04), K_LEAF);
      }
    }
    K.cyl(top[0], top[2], top[1] - 0.3, top[1] + 0.3, 0.35, 0.2, 6, leaf(0.2), K_LEAF, 0, true);
  },
  shrub: K => { K.cyl(0, 0, 0, 0.45, 0.5, 0.68, 7, leaf(1), K_LEAF); K.cyl(0, 0, 0.45, 0.85, 0.68, 0.22, 7, leaf(1), K_LEAF, 0.3); },
  hedge: K => { K.box(-0.5, 0.5, 0, 0.85, -0.5, 0.5, leaf(1), K_LEAF, false); K.box(-0.42, 0.42, 0.85, 1.0, -0.42, 0.42, leaf(1), K_LEAF, true); },
  tuft: K => { // two crossed blades, each face drawn both ways
    for (let i = 0; i < 2; i++) {
      const c = Math.cos(i * 1.57 + 0.3) * 0.2, s = Math.sin(i * 1.57 + 0.3) * 0.2, n = [-s / 0.2, 0, c / 0.2];
      const q = [[-c * 0.25, 0, -s * 0.25], [c * 0.25, 0, s * 0.25], [c * 1.2, 0.42, s * 1.2], [-c * 1.2, 0.42, -s * 1.2]];   // fans out
      K.face(q, leaf(1), K_LEAF, n); K.face(q, leaf(1), K_LEAF, [-n[0], 0, -n[2]]);
    }
  },
  flower: K => { K.cyl(0, 0, 0.22, 0.36, 0.11, 0.06, 5, [1, 1, 1], K_PLAIN, 0, true); K.box(-0.01, 0.01, 0, 0.22, -0.01, 0.01, [0.2, 0.45, 0.2], K_PLAIN, false); },
};
const SPECIES = ["pine", "plane", "cypress", "palm"];

export function createFlora(g) {
  const meshes = [], groups = [];
  let season = null;
  const coll = g.world.collide;
  const M = {}, R = {};  // M: model name -> instances [{x,y,z,s,a,r}], R: meshes the season toggles
  const want = (name, x, y, z, s, a, r = 1, sy) => { (M[name] = M[name] || []).push({ x, y, z, s, a, r, sy }); };

  function applySeason() {
    const s = g.env.weather.state.season;
    if (s === season) return;
    season = s;
    if (R.planeCrown) R.planeCrown.visible = s !== "winter";
    if (R.tuft) R.tuft.count = Math.floor(R.tuft.userData.n * (s === "winter" ? 0 : 1));   // grass stays under the snow
    if (R.flower) R.flower.count = Math.floor(R.flower.userData.n * (s === "spring" ? 1 : s === "summer" ? 0.6 : s === "autumn" ? 0.12 : 0));
  }

  return {
    name: "flora",
    init() {
      const rnd = seeded(31337), W = g.world;
      const anchors = W.anchors || [];
      const doors = L.places.map(p => p.door);
      const nearDoor = (x, z, d) => doors.some(o => Math.hypot(o[0] - x, o[1] - z) < d);
      const tree = (x, y, z, s, sp, solid) => {
        sp = sp || SPECIES[Math.floor(rnd() * 4)];
        const a = rnd() * Math.PI * 2;
        if (sp === "plane") { want("planeTrunk", x, y, z, s, a); want("planeCrown", x, y, z, s, a, 0.3 + rnd() * 0.7); }
        else want(sp, x, y, z, s * (0.9 + rnd() * 0.2), a);
        if (solid) coll.addCircle(x, z, 0.35 * s + 0.1, 3);
      };

      // promenade edge: stone pines and palms; street trees on the sidewalks
      let k = 0;
      for (let z = -96; z <= 96; z += 12) if (Math.abs(z) > 8 && Math.abs(z - L.bench.z) > 4) tree(-0.6, 0, z + (rnd() - 0.5) * 2, 0.85 + rnd() * 0.3, k++ % 2 ? "palm" : "pine", true);
      for (const b of L.blocks) {
        if (b.type === "park") {
          for (let i = 0; i < 30; i++) {
            const x = b.x0 + 4 + rnd() * (b.x1 - b.x0 - 8), z = b.z0 + 4 + rnd() * (b.z1 - b.z0 - 8);
            if (Math.abs(x - (b.x0 + b.x1) / 2) < 2.5 || Math.abs(z - (b.z0 + b.z1) / 2) < 2.5) continue;
            tree(x, 0.22, z, 0.8 + rnd() * 0.7, null, true);
          }
          const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
          for (const s of [-1, 1]) { want("hedge", cx + s * 2.0, 0.22, (b.z0 + cz) / 2 + 1, 1, 0, 0.12, [0.7, 0.9, (cz - b.z0) - 6]); want("hedge", cx + s * 2.0, 0.22, (cz + b.z1) / 2 - 1, 1, 0, 0.12, [0.7, 0.9, (b.z1 - cz) - 6]); }
          for (let i = 0; i < 900; i++) want("tuft", b.x0 + 2 + rnd() * (b.x1 - b.x0 - 4), 0.22, b.z0 + 2 + rnd() * (b.z1 - b.z0 - 4), 0.6 + rnd() * 0.5, rnd() * 6, 0.05 + rnd() * 0.2);
          for (let i = 0; i < 260; i++) { const x = b.x0 + 2 + rnd() * (b.x1 - b.x0 - 4), z = b.z0 + 2 + rnd() * (b.z1 - b.z0 - 4); if (Math.abs(x - cx) > 2 && Math.abs(z - cz) > 2) want("flower", x, 0.22, z, 0.8 + rnd() * 0.6, rnd() * 6, i); }
        } else if (b.type === "plain") {
          for (const [x0, z0, x1, z1] of [[b.x0, b.z0, b.x1, b.z0], [b.x0, b.z1, b.x1, b.z1], [b.x0, b.z0, b.x0, b.z1], [b.x1, b.z0, b.x1, b.z1]]) {
            const len = Math.hypot(x1 - x0, z1 - z0), nx = x0 === x1 ? (x0 === b.x0 ? 1 : -1) : 0, nz = z0 === z1 ? (z0 === b.z0 ? 1 : -1) : 0;
            for (let t = 9; t < len - 6; t += 13) {
              const x = x0 + (x1 - x0) * t / len + nx * 1.1, z = z0 + (z1 - z0) * t / len + nz * 1.1;
              if (nearDoor(x, z, 7) || rnd() < 0.3) continue;
              tree(x, 0.15, z, 0.62 + rnd() * 0.15, rnd() < 0.8 ? "plane" : "cypress", true);
            }
          }
        }
      }
      // beach grass along the promenade wall
      for (let z = -104; z < 104; z += 1.3) if (Math.abs(z) > 4) for (let i = 0; i < 1; i++) { const x = -16.4 - rnd() * 2.2; want("tuft", x, L.beachY(x, z) - 0.02, z + rnd() * 0.9, 0.7 + rnd() * 0.8, rnd() * 6, 0.25); }

      // anchors from buildings and props
      const vb = new Buf(96);
      const VK = createKit(vb, W);
      VK.at(0, 0, 0);
      for (const an of anchors) {
        if (an.t === "tree") tree(an.x, an.y, an.z, an.s, an.sp, an.y < 0.3);
        else if (an.t === "bed") {
          const area = an.hw * an.hd * 4, co = Math.cos(an.rot), si = Math.sin(an.rot);
          const at = (u, v) => [an.x + u * co - v * si, an.z + u * si + v * co];
          const nS = Math.round(area * 0.22 * an.d), nT = Math.round(area * 0.6 * an.d), nF = Math.round(area * 0.5 * an.d);
          for (let i = 0; i < nS; i++) { const [x, z] = at((rnd() * 2 - 1) * Math.max(0.05, an.hw - 0.4), (rnd() * 2 - 1) * Math.max(0.05, an.hd - 0.4)); want("shrub", x, an.y, z, 0.55 + rnd() * 0.7, rnd() * 6, rnd() < 0.55 ? 0.08 + rnd() * 0.2 : 0.3 + rnd() * 0.7); }
          for (let i = 0; i < nT; i++) { const [x, z] = at((rnd() * 2 - 1) * an.hw, (rnd() * 2 - 1) * an.hd); want("tuft", x, an.y, z, 0.6 + rnd() * 0.6, rnd() * 6, 0.05 + rnd() * 0.2); }
          for (let i = 0; i < nF; i++) { const [x, z] = at((rnd() * 2 - 1) * an.hw, (rnd() * 2 - 1) * an.hd); want("flower", x, an.y, z, 0.7 + rnd() * 0.5, rnd() * 6, i); }
        } else if (an.t === "vine") {
          // a few ragged strands of leaf clumps, longer in the middle of the curtain
          const r = 0.3 + rnd() * 0.7, col = rnd() < 0.5 ? 0.06 + rnd() * 0.2 : r, tx = -an.nz, tz = an.nx, a = Math.atan2(tz, tx);
          const ns = Math.max(1, Math.round(an.w / 0.6));
          for (let s = 0; s < ns; s++) {
            const u = ns === 1 ? 0 : (s / (ns - 1) - 0.5) * an.w, mid = 1 - Math.abs(u) / (an.w * 0.6 + 0.01);
            const len = an.len * (0.3 + 0.7 * mid) * (0.6 + rnd() * 0.5), n = Math.max(1, Math.round(len / 1.5));
            for (let i = 0; i < n; i++) {
              const y1 = an.y + 0.12 - i * len / n, y0 = y1 - len / n * 1.15, jit = (rnd() - 0.5) * 0.12, d = 0.1 + rnd() * 0.12;
              VK.obox(an.x + tx * (u + jit) + an.nx * d, an.z + tz * (u + jit) + an.nz * d, 0.26 + rnd() * 0.08 - i * 0.02, 0.1, a, Math.max(0.05, y0), y1, [col * (0.85 + rnd() * 0.15), 0, 0], K_LEAF, false);
            }
          }
        }
      }
      const gv = vb.build(g.env.shade.world, "vines");
      g.scene.add(gv); groups.push(gv);
      let tris = vb.tris;

      // instanced meshes, one per model
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
      const FLOWER = [[1, 0.55, 0.72], [1, 0.95, 0.85], [1, 0.82, 0.3], [0.75, 0.55, 1], [1, 0.4, 0.3]];
      for (const name in M) {
        const list = M[name], geo = model(MODELS[name]);
        const mesh = new THREE.InstancedMesh(geo, g.env.shade.world, list.length);
        list.forEach((it, i) => {
          q.setFromAxisAngle(up, it.a);
          if (it.sy) sc.set(it.sy[0], it.sy[1], it.sy[2]); else sc.set(it.s, it.s, it.s);
          mesh.setMatrixAt(i, m4.compose(v.set(it.x, it.y, it.z), q, sc));
          if (name === "flower") col.setRGB(...FLOWER[it.r % FLOWER.length]); else col.setRGB(it.r, 1, 1);
          mesh.setColorAt(i, col);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.name = "flora-" + name;
        mesh.userData.n = list.length;
        g.scene.add(mesh); meshes.push(mesh);
        tris += geo.attributes.position.count / 3 * list.length;
        if (name === "planeCrown") R.planeCrown = mesh;
        if (name === "flower") R.flower = mesh;
        if (name === "tuft") R.tuft = mesh;
      }
      g.stats.tris += tris;
      g.stats.floraTris = tris;
      g.stats.trees = (M.pine || []).length + (M.planeTrunk || []).length + (M.cypress || []).length + (M.palm || []).length;
      applySeason();
    },
    update() { applySeason(); },
    dispose() {
      for (const m of meshes) { g.scene.remove(m); m.geometry.dispose(); m.dispose(); }
      for (const gr of groups) { g.scene.remove(gr); gr.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      meshes.length = 0; groups.length = 0;
    },
  };
}
