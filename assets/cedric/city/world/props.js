// Props layer: street lamps with a warm glow and a light pool on the ground, benches (and THE
// bench), bollards, promenade railings, plaza planters, festoons along the promenade and on
// Chez Basile's roof, and the place signs (canvas text, fogged, glowing with the neon amount).
// Repeated things are InstancedMesh; glows are one Points draw, pools one instanced draw.
import * as THREE from "../core/three.js";
import { Buf } from "../core/buf.js";
import { seeded } from "../core/rng.js";
import { createSignMaterial } from "../env/shade.js";
import { createKit, K_PLAIN, K_RAW, K_LAMP } from "./kit/kit.js";
import { C, tint, planter } from "./kit/parts.js";
import * as L from "./layout.js";

const POLE = [0.12, 0.12, 0.14], WARM = [1.0, 0.66, 0.36];

function model(fn) {
  const B = new Buf(1e5), K = createKit(B, { collide: null, anchors: [], glows: [], signs: {}, props: [] });
  K.at(0, 0, 0);
  fn(K);
  return B.geometry();
}
// Models look along +x (arm, seat).
const MODELS = {
  lamp: K => {
    K.box(-0.2, 0.2, 0, 0.5, -0.2, 0.2, C.conc, K_RAW, false);
    K.box(-0.07, 0.07, 0.5, 4.7, -0.07, 0.07, POLE, K_PLAIN, false);
    K.box(-0.07, 1.25, 4.6, 4.7, -0.05, 0.05, POLE, K_PLAIN, true);
    K.box(0.75, 1.35, 4.42, 4.6, -0.2, 0.2, POLE, K_PLAIN, true);
    K.box(0.8, 1.3, 4.39, 4.42, -0.16, 0.16, WARM, K_LAMP, true);
  },
  bench: K => {
    for (const z of [-0.85, 0.85]) K.box(-0.28, 0.28, 0, 0.42, z - 0.12, z + 0.12, C.light, K_RAW, false);
    for (let x = -0.26; x < 0.25; x += 0.105) K.box(x, x + 0.085, 0.42, 0.48, -1.0, 1.0, C.wood, K_PLAIN, true);
    K.box(-0.33, -0.27, 0.5, 0.9, -1.0, 1.0, C.wood, K_PLAIN, true);
    for (const z of [-0.85, 0.85]) K.box(-0.34, -0.26, 0.42, 0.9, z - 0.04, z + 0.04, C.steel, K_PLAIN, true);
  },
  bollard: K => { K.cyl(0, 0, 0, 0.78, 0.15, 0.13, 8, C.light, K_RAW, 0, false); K.cyl(0, 0, 0.6, 0.66, 0.145, 0.14, 8, WARM, K_LAMP); },
  post: K => { K.box(-0.035, 0.035, 0, 1.05, -0.035, 0.035, C.steel, K_PLAIN, false); },
};

export function createProps(g) {
  let signs = [];
  const groups = [], meshes = [];
  let glow, glowGeo, glowMat, pools, poolMat;
  const _sz = new THREE.Vector2();

  function signTexture(text, colour) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 160;
    const x = c.getContext("2d");
    x.font = "500 96px 'IBM Plex Mono', Consolas, monospace";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = colour; x.shadowBlur = 26; x.fillStyle = colour;
    x.fillText(text, 512, 84);
    x.shadowBlur = 0; x.fillStyle = "#fff"; x.globalAlpha = 0.75;
    x.fillText(text, 512, 84);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }
  function addSign(text, colour, x, y, z, facing, w) {
    const tex = signTexture(text, colour), mat = createSignMaterial(g.env.shade.uniforms, tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 1024), mat);
    m.position.set(x, y, z);
    m.rotation.y = Math.PI / 2 - facing; // plane normal +Z -> (cos facing, sin facing)
    g.scene.add(m);
    signs.push(m);
  }

  return {
    name: "props",
    init() {
      const W = g.world, rnd = seeded(4242), coll = W.collide, gy = (x, z) => g.world.groundY(x, z);
      W.glows = W.glows || []; W.strings = W.strings || []; W.anchors = W.anchors || [];
      const B = new Buf(128), K = createKit(B, W);
      K.at(0, 0, 0, rnd);
      const inst = { lamp: [], bench: [], bollard: [], post: [] };
      const doors = L.places.map(p => p.door).concat([[L.aquarium.door[0], L.aquarium.door[1]]]);
      const clear = (x, z, d = 3) => !doors.some(o => Math.hypot(o[0] - x, o[1] - z) < d);
      const inTram = (x) => Math.abs(x - L.lanes.tram.path[0][0]) < L.lanes.tram.width / 2 + 0.6;

      const lamp = (x, z, a) => {
        const y = gy(x, z);
        inst.lamp.push([x, y, z, a]);
        W.glows.push({ x: x + Math.cos(a) * 1.05, y: y + 4.3, z: z + Math.sin(a) * 1.05, col: [1, 0.68, 0.38], size: 2.6, pool: true });
        coll.addCircle(x, z, 0.22, 4.7);
      };
      const bench = (x, z, facing) => { inst.bench.push([x, gy(x, z), z, facing]); const co = Math.abs(Math.cos(facing)) > 0.5; coll.addRect(x, z, co ? 0.35 : 1.0, co ? 1.0 : 0.35, 0, 0.9); };
      const bollard = (x, z) => { inst.bollard.push([x, gy(x, z), z, 0]); coll.addCircle(x, z, 0.16, 0.8); };

      // ---- promenade: lamps facing the walk, railing on the sea side, benches looking at the sea
      const lampsZ = [];
      for (let z = -90; z <= 90; z += 20) { lamp(-3, z, Math.PI); lampsZ.push(z); }
      const P = L.promenade, rx = P.x0 + 0.25, gaps = [[-2.6, 2.6], [-61.5, -58.5], [58.5, 61.5]];
      let segStart = P.z0 + 0.5;
      const segs = [];
      for (const [a, b] of gaps.slice().sort((u, v) => u[0] - v[0])) { segs.push([segStart, a]); segStart = b; }
      segs.push([segStart, P.z1 - 0.5]);
      for (const [a, b] of segs) {
        for (let z = a; z <= b + 0.01; z += 2) inst.post.push([rx, P.y, z, 0]);
        K.box(rx - 0.05, rx + 0.05, P.y + 1.0, P.y + 1.08, a, b, C.steel, K_PLAIN, true);
        K.box(rx - 0.025, rx + 0.025, P.y + 0.55, P.y + 0.59, a, b, C.steel, K_PLAIN, true);
        coll.addRect(rx, (a + b) / 2, 0.1, (b - a) / 2, 0, 1.1);
      }
      for (let z = -84; z <= 84; z += 24) if (Math.abs(z) > 6 && Math.abs(z - L.bench.z) > 6) bench(-13.9, z + 4, Math.PI);
      // festoon between the promenade lamps
      for (let i = 0; i < lampsZ.length - 1; i++) W.strings.push({ pts: [[-3, 4.68, lampsZ[i]], [-3, 4.68, lampsZ[i + 1]]], sag: 1.1, step: 1.1 });

      // THE bench: longer, oak seat on two concrete blocks, a brass plaque, a lamp and planters
      {
        const b = L.bench, K2 = createKit(B, W);
        K2.at(b.x, b.z, b.facing + Math.PI / 2, rnd);   // local -z looks along the facing
        const y = P.y;
        for (const x of [-1.25, 1.25]) K2.box(x - 0.2, x + 0.2, y, y + 0.44, -0.32, 0.32, C.light, K_RAW, false);
        for (let z = -0.3; z < 0.28; z += 0.12) K2.box(-1.55, 1.55, y + 0.44, y + 0.5, z, z + 0.1, tint(C.wood, 1.15), K_PLAIN, true);
        K2.box(-1.55, 1.55, y + 0.55, y + 0.95, 0.36, 0.42, tint(C.wood, 1.15), K_PLAIN, true);
        for (const x of [-1.5, 1.5]) K2.box(x - 0.04, x + 0.04, y + 0.44, y + 0.95, 0.3, 0.42, C.steel, K_PLAIN, true);
        K2.box(-0.18, 0.18, y + 0.62, y + 0.72, 0.34, 0.36, [0.8, 0.6, 0.3], K_PLAIN, true);
        planter(K2, -2.6, -1.8, -0.4, 0.5, y, { h: 0.45 }); planter(K2, 1.8, 2.6, -0.4, 0.5, y, { h: 0.45 });
        coll.addRect(b.x, b.z, 0.45, 2.6, 0, 1.0);
      }

      // ---- pier lamps, Front de mer
      for (let x = -58; x < -18; x += 10) { lamp(x, -2.2, Math.PI / 2); lamp(x + 5, 2.2, -Math.PI / 2); }
      for (let z = -90; z <= 90; z += 30) if (Math.abs(z) > 8) lamp(11.6, z, Math.PI);

      // ---- block sidewalks: lamps on the kerbs, bollards at corners
      for (const b of L.blocks) {
        if (b.type === "track" || b.type === "station") continue;
        const edges = [[b.x0, b.z0, b.x1, b.z0, -Math.PI / 2], [b.x0, b.z1, b.x1, b.z1, Math.PI / 2], [b.x0, b.z0, b.x0, b.z1, Math.PI], [b.x1, b.z0, b.x1, b.z1, 0]];
        for (const [x0, z0, x1, z1, a] of edges) {
          const len = Math.hypot(x1 - x0, z1 - z0), ox = Math.cos(a) * -0.5, oz = Math.sin(a) * -0.5;
          for (let t = 3.5; t < len - 2; t += 22) {
            const x = x0 + (x1 - x0) * t / len + ox, z = z0 + (z1 - z0) * t / len + oz;
            if (!clear(x, z, 4) || inTram(x)) continue;
            lamp(x, z, a);
          }
        }
        for (const [x, z] of [[b.x0 + 0.5, b.z0 + 0.5], [b.x1 - 0.5, b.z0 + 0.5], [b.x0 + 0.5, b.z1 - 0.5], [b.x1 - 0.5, b.z1 - 0.5]]) if (!inTram(x)) { bollard(x, z); bollard(x + (x < (b.x0 + b.x1) / 2 ? 1.2 : -1.2), z); }
      }

      // ---- plaza: big planters with trees in two rows, benches, bollards along Front de mer
      const pz = L.plaza, mz = L.plotById("mairie").z;
      for (const zr of [pz.z0 + 4, pz.z1 - 4]) for (let x = pz.x0 + 6; x < pz.x1 - 4; x += 10) {
        if (inTram(x) || Math.abs(x - 60) < 4) continue;
        planter(K, x - 1.6, x + 1.6, zr - 1.6, zr + 1.6, 0.15, { h: 0.55, d: 0.6 });
        W.anchors.push({ t: "tree", x, y: 0.58, z: zr, s: 0.95, sp: "plane" });
        coll.addRect(x, zr, 1.6, 1.6, 0, 0.7);
        bench(x, zr + (zr < mz ? 2.4 : -2.4), zr < mz ? Math.PI / 2 : -Math.PI / 2);
      }
      for (let z = pz.z0 + 2; z < pz.z1 - 1; z += 3) bollard(pz.x0 + 0.6, z);

      // ---- park: benches and lamps along the cross paths
      const pk = L.park, cx = (pk.x0 + pk.x1) / 2, cz = (pk.z0 + pk.z1) / 2;
      for (let z = pk.z0 + 7; z < pk.z1 - 4; z += 10) if (Math.abs(z - cz) > 4) { bench(cx + 1.9, z, 0); lamp(cx - 1.6, z + 4, 0); }
      for (let x = pk.x0 + 7; x < pk.x1 - 4; x += 10) if (Math.abs(x - cx) > 4) { bench(x, cz + 1.9, Math.PI / 2); }

      // ---- aquarium sign board on the front fence
      const q = L.plotById("aquarium"), qx = q.x - q.w / 2 - 0.25;
      for (const dz of [-2.4, 2.4]) K.box(qx - 0.06, qx + 0.06, 0.15, 3.9, q.z + 3.5 + dz - 0.06, q.z + 3.5 + dz + 0.06, C.steel, K_PLAIN);
      K.box(qx + 0.05, qx + 0.12, 2.3, 3.75, q.z + 3.5 - 2.6, q.z + 3.5 + 2.6, [0.06, 0.07, 0.1], K_PLAIN, true);

      // ---- festoons (promenade + Chez Basile): wires in the Buf, bulbs as glows
      for (const s of W.strings) {
        const [a, b] = s.pts, n = Math.max(4, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / (s.step || 0.75)));
        let prev = a;
        for (let i = 1; i <= n; i++) {
          const t = i / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * s.sag, a[2] + (b[2] - a[2]) * t];
          K.tube(prev, p, 0.012, 3, [0.05, 0.05, 0.05], K_PLAIN);
          if (i < n) { K.box(p[0] - 0.035, p[0] + 0.035, p[1] - 0.09, p[1] - 0.02, p[2] - 0.035, p[2] + 0.035, [1, 0.72, 0.4], K_LAMP, true); W.glows.push({ x: p[0], y: p[1] - 0.07, z: p[2], col: [1, 0.7, 0.4], size: 0.55 }); }
          prev = p;
        }
      }

      const grp = B.build(g.env.shade.world, "props");
      g.scene.add(grp); groups.push(grp);
      let tris = B.tris;

      // ---- instanced props
      const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      for (const name in inst) {
        const list = inst[name];
        if (!list.length) continue;
        const geo = model(MODELS[name]), mesh = new THREE.InstancedMesh(geo, g.env.shade.world, list.length);
        list.forEach(([x, y, z, a], i) => { qq.setFromAxisAngle(up, -a); mesh.setMatrixAt(i, m4.compose(v.set(x, y, z), qq, one)); });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.name = "props-" + name;
        g.scene.add(mesh); meshes.push(mesh);
        tris += geo.attributes.position.count / 3 * list.length;
      }

      // ---- glows (lamps, bulbs, building lights): one Points draw, additive, lit with the windows
      const U = g.env.shade.uniforms, G = W.glows, pos = new Float32Array(G.length * 3), col = new Float32Array(G.length * 3), size = new Float32Array(G.length);
      G.forEach((o, i) => { pos.set([o.x, o.y, o.z], i * 3); col.set(o.col, i * 3); size[i] = o.size; });
      glowGeo = new THREE.BufferGeometry();
      glowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      glowGeo.setAttribute("gcol", new THREE.BufferAttribute(col, 3));
      glowGeo.setAttribute("gsize", new THREE.BufferAttribute(size, 1));
      glowMat = new THREE.ShaderMaterial({
        uniforms: { uLights: U.uLights, uFogDen: U.uFogDen, uScale: { value: 600 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */`attribute vec3 gcol; attribute float gsize; uniform float uScale,uLights,uFogDen; varying vec3 vC;
          void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp(gsize*uScale/max(-mv.z,.5),1.,64.);
            vC=gcol*(.03+.5*uLights)*exp(-(-mv.z)*uFogDen*.6); }`,
        fragmentShader: /* glsl */`varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5)*2.; float a=pow(max(1.-r,0.),2.2); gl_FragColor=vec4(vC*a,1.); }`,
      });
      glow = new THREE.Points(glowGeo, glowMat);
      glow.frustumCulled = false;
      g.scene.add(glow);

      // ---- light pools under the lamps: one instanced, additive quad
      const P2 = G.filter(o => o.pool);
      poolMat = new THREE.ShaderMaterial({
        uniforms: { uLights: U.uLights }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv=uv*2.-1.; gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.); }`,
        fragmentShader: /* glsl */`uniform float uLights; varying vec2 vUv;
          void main(){ float d=length(vUv); float a=pow(max(1.-d,0.),2.)*uLights*.2; gl_FragColor=vec4(vec3(1.,.62,.32)*a,1.); }`,
      });
      const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
      pools = new THREE.InstancedMesh(pg, poolMat, Math.max(1, P2.length));
      P2.forEach((o, i) => { m4.makeScale(9, 1, 9); m4.setPosition(o.x, gy(o.x, o.z) + 0.04, o.z); pools.setMatrixAt(i, m4); });
      pools.count = P2.length;
      pools.instanceMatrix.needsUpdate = true;
      pools.computeBoundingSphere();
      g.scene.add(pools);

      g.stats.tris += tris;
      g.stats.propTris = tris;

      // ---- place signs (French, from text.js); buildings say where each one hangs
      const T = g.text;
      for (const pl of L.places) {
        const s = W.signs[pl.id], plot = L.plotById(pl.plot);
        if (s) addSign(T.places[pl.id].sign, pl.neon, s.x, s.y, s.z, s.facing, s.w || 7);
        else addSign(T.places[pl.id].sign, pl.neon, plot.x + (pl.side === "w" ? -1 : 1) * (plot.w / 2 + 0.2), 6.4, plot.z, pl.facing, 8);
      }
      addSign(T.soon, "#8fe6ff", qx - 0.02, 3.0, q.z + 3.5, L.aquarium.facing, 4.6);
    },
    update() {
      if (!glow) return;
      g.renderer.getDrawingBufferSize(_sz);
      glowMat.uniforms.uScale.value = _sz.y * 0.5 * g.camera.projectionMatrix.elements[5];
      pools.visible = g.env.shade.uniforms.uLights.value > 0.05;
    },
    dispose() {
      for (const gr of groups) { g.scene.remove(gr); gr.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      for (const m of meshes) { g.scene.remove(m); m.geometry.dispose(); m.dispose(); }
      if (glow) { g.scene.remove(glow); glowGeo.dispose(); glowMat.dispose(); }
      if (pools) { g.scene.remove(pools); pools.geometry.dispose(); poolMat.dispose(); pools.dispose(); }
      for (const m of signs) { g.scene.remove(m); m.geometry.dispose(); m.material.uniforms.uMap.value.dispose(); m.material.dispose(); }
      signs = []; groups.length = 0; meshes.length = 0; glow = pools = null;
    },
  };
}
