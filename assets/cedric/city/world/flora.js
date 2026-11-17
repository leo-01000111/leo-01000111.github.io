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
  const cullables = [];   // instanced meshes culled by hand each frame
  const M = {}, R = {};  // M: model name -> instances [{x,y,z,s,a,r}], R: meshes the season toggles
  const want = (name, x, y, z, s, a, r = 1, sy) => { (M[name] = M[name] || []).push({ x, y, z, s, a, r, sy }); };

  function applySeason() {
    const s = g.env.weather.state.season;
    if (s === season) return;
    season = s;
    if (R.planeCrown) R.planeCrown.visible = s !== "winter";
    // the season keeps the first lim instances; the per-frame culling below compacts the visible ones out of them
    if (R.tuft) R.tuft.userData.lim = Math.floor(R.tuft.userData.n * (s === "winter" ? 0 : 1));   // grass stays under the snow
    if (R.flower) R.flower.userData.lim = Math.floor(R.flower.userData.n * (s === "spring" ? 1 : s === "summer" ? 0.6 : s === "autumn" ? 0.12 : 0));
  }

  // ---- per-frame CPU culling of the instances (the meshes span the whole town, so three.js never culls them) ----
  // Each instance keeps its full matrix/colour in a side array plus a world bounding sphere. Every frame the camera
  // moved, the instances whose sphere is outside the view frustum (or past the fog-out distance) are skipped and the
  // visible ones are packed to the front of the GPU buffers, in their original order; mesh.count says how many.
  function prepCull(mesh, geo) {
    mesh.frustumCulled = false;   // culled here, instance by instance
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere, c = bs.center, n = mesh.userData.n;
    const fullM = new Float32Array(mesh.instanceMatrix.array), fullC = new Float32Array(mesh.instanceColor.array);
    const ctr = new Float32Array(n * 3), rad = new Float32Array(n), ids = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const m = i * 16;
      ctr[i * 3] = fullM[m] * c.x + fullM[m + 4] * c.y + fullM[m + 8] * c.z + fullM[m + 12];
      ctr[i * 3 + 1] = fullM[m + 1] * c.x + fullM[m + 5] * c.y + fullM[m + 9] * c.z + fullM[m + 13];
      ctr[i * 3 + 2] = fullM[m + 2] * c.x + fullM[m + 6] * c.y + fullM[m + 10] * c.z + fullM[m + 14];
      const sx = Math.hypot(fullM[m], fullM[m + 1], fullM[m + 2]), sy = Math.hypot(fullM[m + 4], fullM[m + 5], fullM[m + 6]), sz = Math.hypot(fullM[m + 8], fullM[m + 9], fullM[m + 10]);
      rad[i] = bs.radius * Math.max(sx, sy, sz) + 0.6;   // + the shader's wind sway (<= 0.03 per metre of height) and a margin
      ids[i] = i;
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.cull = { fullM, fullC, ctr, rad, ids, n, shown: n };
    cullables.push(mesh);
  }
  const cPm = new THREE.Matrix4(), cMi = new THREE.Matrix4(), cFr = new THREE.Frustum(), cKey = new Float64Array(36);
  let cDirty = true;
  function cull() {
    const cam = g.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements, p = cam.projectionMatrix.elements;
    let same = !cDirty;
    for (let i = 0; i < 16 && same; i++) if (cKey[i] !== e[i] || cKey[16 + i] !== p[i]) same = false;
    const den = g.env.shade.uniforms.uFogDen.value, ft = R.tuft ? R.tuft.userData.lim : 0, ff = R.flower ? R.flower.userData.lim : 0;
    const vis = R.planeCrown ? (R.planeCrown.visible ? 1 : 0) : 0;
    if (same && cKey[32] === den && cKey[33] === ft && cKey[34] === ff && cKey[35] === vis) return;
    for (let i = 0; i < 16; i++) { cKey[i] = e[i]; cKey[16 + i] = p[i]; }
    cKey[32] = den; cKey[33] = ft; cKey[34] = ff; cKey[35] = vis; cDirty = false;
    cMi.copy(cam.matrixWorld).invert();
    cFr.setFromProjectionMatrix(cPm.multiplyMatrices(cam.projectionMatrix, cMi));
    const pl = cFr.planes, cx = e[12], cy = e[13], cz = e[14];
    // fully fogged (exp(-12) of the colour left) = invisible; never past the far plane. Generous on purpose.
    const dmax = Math.min(cam.far + 50, den > 1e-6 ? 12 / den : Infinity);
    for (const mesh of cullables) {
      const d = mesh.userData.cull;
      if (!mesh.visible) continue;
      const lim = Math.min(d.n, mesh.userData.lim);
      const am = mesh.instanceMatrix.array, ac = mesh.instanceColor.array, { fullM, fullC, ctr, rad, ids } = d;
      let k = 0, lo = d.n, hi = -1;
      for (let i = 0; i < lim; i++) {
        const x = ctr[i * 3], y = ctr[i * 3 + 1], z = ctr[i * 3 + 2], r = rad[i];
        let ok = true;
        for (let j = 0; j < 6; j++) { const n = pl[j].normal; if (n.x * x + n.y * y + n.z * z + pl[j].constant < -r) { ok = false; break; } }
        if (ok) { const dx = x - cx, dy = y - cy, dz = z - cz, rr = dmax + r; if (dx * dx + dy * dy + dz * dz > rr * rr) ok = false; }
        if (!ok) continue;
        if (ids[k] !== i) {
          ids[k] = i;
          am.set(fullM.subarray(i * 16, i * 16 + 16), k * 16);
          ac[k * 3] = fullC[i * 3]; ac[k * 3 + 1] = fullC[i * 3 + 1]; ac[k * 3 + 2] = fullC[i * 3 + 2];
          if (k < lo) lo = k; if (k > hi) hi = k;
        }
        k++;
      }
      if (hi >= 0) {
        mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(lo * 16, (hi - lo + 1) * 16); mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(lo * 3, (hi - lo + 1) * 3); mesh.instanceColor.needsUpdate = true;
      }
      mesh.count = k; d.shown = k;
    }
  }

  return {
    name: "flora",
    init() {
      const rnd = seeded(31337), W = g.world;
      const anchors = W.anchors || [];
      const doors = L.places.map(p => p.door);
      const nearDoor = (x, z, d) => doors.some(o => Math.hypot(o[0] - x, o[1] - z) < d);
      // road surfaces (street rectangles minus pedestrian gaps, the seafront apron, the tram lane, the aerodrome road), with a margin
      const ROADS = [{ x0: L.promenade.x1, x1: L.streets[0].at - L.streets[0].w / 2, z0: -112, z1: 112 }, { x0: L.promenade.x1, x1: 104, z0: L.aerodrome.road.z0, z1: L.aerodrome.road.z1 }];
      for (const s of L.streets) {
        const spans = [[s.from, s.to]];
        for (const gp of s.gaps || []) for (let i = spans.length - 1; i >= 0; i--) { const [a, b] = spans[i]; if (gp[1] > a && gp[0] < b) { spans.splice(i, 1); if (gp[0] > a) spans.push([a, gp[0]]); if (gp[1] < b) spans.push([gp[1], b]); } }
        for (const [a, b] of spans) ROADS.push(s.axis === "z" ? { x0: s.at - s.w / 2, x1: s.at + s.w / 2, z0: a, z1: b } : { x0: a, x1: b, z0: s.at - s.w / 2, z1: s.at + s.w / 2 });
      }
      { const t = L.lanes.tram, hw = t.width / 2; ROADS.push({ x0: t.path[0][0] - hw, x1: t.path[0][0] + hw, z0: t.path[0][1], z1: t.path[1][1] }); }
      const onRoad = (x, z, m = 0.6) => ROADS.some(r => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);
      g.world.treeRoads = ROADS; let removed = 0;
      const tree = (x, y, z, s, sp, solid) => {
        sp = sp || SPECIES[Math.floor(rnd() * 4)];
        const a = rnd() * Math.PI * 2;
        if (y < 0.3 && onRoad(x, z)) { removed++; return; }
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
        mesh.userData.lim = list.length;
        prepCull(mesh, geo);
        g.scene.add(mesh); meshes.push(mesh);
        tris += geo.attributes.position.count / 3 * list.length;
        if (name === "planeCrown") R.planeCrown = mesh;
        if (name === "flower") R.flower = mesh;
        if (name === "tuft") R.tuft = mesh;
      }
      g.stats.tris += tris;
      g.stats.floraTris = tris;
      g.stats.treesRemovedFromRoads = removed;
      g.stats.trees = (M.pine || []).length + (M.planeTrunk || []).length + (M.cypress || []).length + (M.palm || []).length;
      applySeason();
    },
    update() { applySeason(); },
    late() { cull(); },
    dispose() {
      for (const m of meshes) { g.scene.remove(m); m.geometry.dispose(); m.dispose(); }
      for (const gr of groups) { g.scene.remove(gr); gr.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      meshes.length = 0; groups.length = 0; cullables.length = 0;
    },
  };
}
