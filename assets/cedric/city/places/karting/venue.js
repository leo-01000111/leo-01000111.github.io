// Karting venue outside the buildings layer: the hills (one ground mesh), the circuit ribbon with
// kerbs, barriers, lamps, start gantry, bridge and lookout (one mesh), tyre walls and rocks
// (one instanced mesh each). Trees go through the flora layer as anchors; lamp glows through
// world.glows. Everything here is built once; nothing allocates per frame.
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { seeded } from "../../core/rng.js";
import { createKit, K_PLAIN, K_NEON, K_RAW, K_LAMP } from "../../world/kit/kit.js";
import * as Hills from "../../world/hills.js";
import * as C from "./circuit.js";

const ASPH = [0.07, 0.07, 0.085], CONC = [0.5, 0.48, 0.46], RED = [0.64, 0.1, 0.12], WHITE = [0.78, 0.76, 0.7], STEEL = [0.16, 0.17, 0.19];
const CYAN = [0.25, 0.9, 1.0];
const tint = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

export function createVenue(g) {
  const W = g.world, meshes = [], geos = [];
  let mat = null, tris = 0;
  const gy = (x, z) => W.groundY(x, z);

  // ---- helpers -----------------------------------------------------------------------------------
  const nrm = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l];
  };
  // quad with an explicit normal (Buf winds the triangles to face it)
  const quadN = (B, p0, p1, p2, p3, n, c, k = K_PLAIN) => { const b = B.bucket(0, 0); B.tri(b, p0, p1, p2, n, c, k); B.tri(b, p0, p2, p3, n, c, k); };
  // quad facing up, or facing the way `up` says
  const quadUp = (B, p0, p1, p2, p3, c, k = K_PLAIN) => {
    let n = nrm(p0, p1, p3); if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    quadN(B, p0, p1, p2, p3, n, c, k);
  };
  const lat = (i, l, dy = 0) => [C.X[i] - Math.sin(C.HD[i]) * l, C.Y[i] - l * C.BANK[i] + dy, C.Z[i] + Math.cos(C.HD[i]) * l];
  const latXZ = (i, l) => [C.X[i] - Math.sin(C.HD[i]) * l, C.Z[i] + Math.cos(C.HD[i]) * l];

  // ---- ground -----------------------------------------------------------------------------------------
  function buildGround() {
    const B = new Buf(1e6), R = Hills.REGION, S = 7, rnd = seeded(4242);
    const nx = Math.ceil((R.x1 - R.x0) / S) + 1, nz = Math.ceil((R.z1 - R.z0) / S) + 1;
    const H = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = Hills.height(R.x0 + i * S, R.z0 + j * S);
    const b = B.bucket(0, 0);
    const colour = (x, z, h, ny) => {
      const slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / Math.max(ny, 0.05), n = 0.86 + rnd() * 0.28;
      const hh = Math.min(1, h / 30);
      // grass (low, cool) -> dry olive -> ochre dust (high); steep ground turns to grey-violet rock
      let r = 0.095 + hh * 0.2, gg = 0.17 + hh * 0.045, bl = 0.115 + hh * -0.01;
      const rock = Math.min(1, Math.max(0, (slope - 0.45) / 0.5));
      r += (0.30 - r) * rock * 0.8; gg += (0.265 - gg) * rock * 0.8; bl += (0.285 - bl) * rock * 0.8;
      return [r * n, gg * n, bl * n];
    };
    const tri = (p0, p1, p2) => {
      let n = nrm(p0, p1, p2); if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
      const cx = (p0[0] + p1[0] + p2[0]) / 3, cz = (p0[2] + p1[2] + p2[2]) / 3, ch = (p0[1] + p1[1] + p2[1]) / 3;
      B.tri(b, p0, p1, p2, n, colour(cx, cz, ch, n[1]), 1);
    };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = H[j * nx + i], bb = H[j * nx + i + 1], c = H[(j + 1) * nx + i + 1], d = H[(j + 1) * nx + i];
      if (Math.max(a, bb, c, d) < 0.03) continue;
      const x0 = R.x0 + i * S, x1 = x0 + S, z0 = R.z0 + j * S, z1 = z0 + S, o = -0.02;
      const A = [x0, a + o, z0], Bp = [x1, bb + o, z0], Cp = [x1, c + o, z1], D = [x0, d + o, z1];
      if (Math.abs(a - c) < Math.abs(bb - d)) { tri(A, Bp, Cp); tri(A, Cp, D); } else { tri(A, Bp, D); tri(Bp, Cp, D); }
    }
    const geo = B.geometry(); geos.push(geo);
    const m = new THREE.Mesh(geo, mat); m.name = "karting-ground"; geo.computeBoundingSphere();
    g.scene.add(m); meshes.push(m); tris += B.tris;
    return H;
  }

  // ---- the circuit mesh ---------------------------------------------------------------------------------------
  function buildTrack() {
    const B = new Buf(1e6), K = createKit(B, W), rnd = seeded(77), N = C.N, HW = C.HW, KB = C.KERB;
    K.at(0, 0, 0, rnd);
    const nStacks = [];
    const bridged = i => C.BR[i] > 0.5;

    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, cv = Math.abs(C.CURV_S[i]), corner = cv > 0.014;
      // asphalt, a little banding so long straights are not one flat colour
      const ac = tint(ASPH, 0.96 + 0.08 * ((i >> 2) % 3) / 2);
      quadUp(B, lat(i, -HW), lat(i, HW), lat(j, HW), lat(j, -HW), ac);
      // edge lines
      for (const s of [-1, 1]) quadUp(B, lat(i, s * (HW - 0.55), 0.012), lat(i, s * (HW - 0.3), 0.012), lat(j, s * (HW - 0.3), 0.012), lat(j, s * (HW - 0.55), 0.012), tint(WHITE, 0.55), K_NEON); // faintly lit lines: they glow at night
      // kerbs and the shoulder wall down to the ground
      for (const s of [-1, 1]) {
        const kc = corner ? (((i >> 1) & 1) ? RED : WHITE) : tint(WHITE, 0.55);
        quadUp(B, lat(i, s * HW, 0.045), lat(i, s * (HW + KB), 0.045), lat(j, s * (HW + KB), 0.045), lat(j, s * HW, 0.045), kc);
        const e0 = lat(i, s * (HW + KB), 0.045), e1 = lat(j, s * (HW + KB), 0.045);
        const deck = bridged(i) || bridged(j);
        const b0 = [e0[0], deck ? e0[1] - 0.9 : Math.min(e0[1] - 0.45, gy(e0[0], e0[2]) - 0.05), e0[2]];
        const b1 = [e1[0], deck ? e1[1] - 0.9 : Math.min(e1[1] - 0.45, gy(e1[0], e1[2]) - 0.05), e1[2]];
        const n = [-Math.sin(C.HD[i]) * s, 0, Math.cos(C.HD[i]) * s];
        quadN(B, e0, e1, b1, b0, n, tint(CONC, deck ? 0.9 : 0.7));
      }
    }
    // chequered start / finish line across the first two samples
    {
      const n = 20, w = (2 * HW) / n;
      for (let r = 0; r < 2; r++) for (let q = 0; q < n; q++) {
        if ((q + r) & 1) continue;
        const l0 = -HW + q * w, l1 = l0 + w, a = r, b = r + 1;
        // points one metre apart along the line: use sample positions i = 0,1,2
        quadUp(B, lat(a, l0, 0.02), lat(a, l1, 0.02), lat(b, l1, 0.02), lat(b, l0, 0.02), [0.92, 0.9, 0.85]);
      }
      // grid boxes behind the line (karts start on them)
      for (const [back, side] of [[7, -1], [7, 1], [14, -1], [14, 1]]) {
        const i = (N - Math.round(back / C.ds) + N) % N, l = side * 2.4;
        const p = lat(i, l, 0.02), hd = C.HD[i];
        K.obox(p[0], p[2], 0.07, 1.4, hd + Math.PI / 2, p[1] - 0.005, p[1] + 0.012, WHITE, K_PLAIN, false);
        K.obox(p[0] + Math.cos(hd) * 0.8, p[2] + Math.sin(hd) * 0.8, 1.0, 0.07, hd + Math.PI / 2, p[1] - 0.005, p[1] + 0.012, WHITE, K_PLAIN, false);
      }
    }

    // ---- barriers, neon, tyre-wall positions, lamps ------------------------------------------------------------------
    const lampAt = [];
    let sinceLamp = 0, sinceTyre = 0;
    const LIN = HW + C.WALL + 0.7, TH = 0.5;
    for (let i = 0; i < N; i += 2) {
      const j = (i + 2) % N, cv = Math.abs(C.CURV_S[i]), corner = cv > 0.014;
      const bridgeSeg = bridged(i) || bridged(j);
      for (const s of [-1, 1]) {
        const pi = latXZ(i, s * LIN), pj = latXZ(j, s * LIN), qi = latXZ(i, s * (LIN + TH)), qj = latXZ(j, s * (LIN + TH));
        const base = (p, idx) => bridgeSeg ? C.Y[idx] - s * (LIN) * C.BANK[idx] - 0.05 : gy(p[0], p[1]);
        const yi = base(pi, i), yj = base(pj, j), h = 0.95;
        const col = tint(CONC, 0.9 + 0.08 * ((i >> 1) % 2));
        const A = [pi[0], yi, pi[1]], A2 = [pi[0], yi + h, pi[1]], Bq = [pj[0], yj, pj[1]], B2 = [pj[0], yj + h, pj[1]];
        const O = [qi[0], yi, qi[1]], O2 = [qi[0], yi + h, qi[1]], P = [qj[0], yj, qj[1]], P2 = [qj[0], yj + h, qj[1]];
        const ni = [Math.sin(C.HD[i]) * s, 0, -Math.cos(C.HD[i]) * s]; // towards the track
        quadN(B, A, Bq, B2, A2, ni, col);                       // inner face
        quadN(B, A2, B2, P2, O2, [0, 1, 0], tint(col, 1.1));     // top
        quadN(B, O, P, P2, O2, [-ni[0], 0, -ni[2]], tint(col, 0.8)); // outer face
        if (corner || bridgeSeg) { // cyan neon strip along the inner face
          const e = 0.02, off = [ni[0] * e, 0, ni[2] * e];
          quadN(B, [A[0] + off[0], yi + h - 0.24, A[2] + off[2]], [Bq[0] + off[0], yj + h - 0.24, Bq[2] + off[2]], [Bq[0] + off[0], yj + h - 0.14, Bq[2] + off[2]], [A[0] + off[0], yi + h - 0.14, A[2] + off[2]], ni, CYAN, K_NEON);
        }
        // tyre walls on the outside of the corner
        if (cv > 0.02 && !bridgeSeg && ((C.CURV_S[i] > 0) === (s < 0))) nStacks.push([latXZ(i, s * (C.LIMIT + 0.62)), C.HD[i], i]);
      }
      sinceLamp += 2 * C.ds;
    }
    // thin out the tyre walls: one stack every ~3 m
    const stacks = [];
    { let last = -1e9; for (const t of nStacks) { const p = t[0]; if (stacks.length && Math.hypot(p[0] - last.x, p[1] - last.z) < 3.6) continue; stacks.push(t); last = { x: p[0], z: p[1] }; } }

    // lamps outside the barrier, every ~42 m, alternating sides; denser on the start straight
    {
      let acc = 0, side = 1;
      for (let i = 0; i < N; i++) {
        acc += C.ds;
        const sStraight = C.Y[i] < 0.5;
        if (acc < (sStraight ? 30 : 46)) continue;
        if (bridged(i)) continue;
        acc = 0; side = -side;
        const hd = C.HD[i], rx = -Math.sin(hd), rz = Math.cos(hd), l = side * (HW + C.WALL + 2.4);
        const px = C.X[i] + rx * l, pz = C.Z[i] + rz * l, y0 = gy(px, pz);
        K.cyl(px, pz, y0, y0 + 6.4, 0.13, 0.1, 5, STEEL, K_PLAIN);
        const hx = px - rx * side * 2.3, hz = pz - rz * side * 2.3;     // arm leans over the track
        K.tube([px, y0 + 6.3, pz], [hx, y0 + 6.6, hz], 0.06, 4, STEEL, K_PLAIN);
        K.box(hx - 0.32, hx + 0.32, y0 + 6.5, y0 + 6.62, hz - 0.2, hz + 0.2, [1, 0.9, 0.7], K_LAMP, true);
        W.glows.push({ x: hx, y: y0 + 6.45, z: hz, col: [0.7, 0.92, 1.0], size: 4.6 });
        lampAt.push([hx, y0 + 6.45, hz]);
      }
    }

    // ---- start gantry --------------------------------------------------------------------------------------------------------
    {
      const hd = C.HD[0], rx = -Math.sin(hd), rz = Math.cos(hd), l = HW + 2.2;
      const y = C.Y[0];
      for (const s of [-1, 1]) {
        const px = C.X[0] + rx * l * s, pz = C.Z[0] + rz * l * s, y0 = Math.min(y, gy(px, pz));
        K.obox(px, pz, 0.45, 0.45, hd, y0 - 0.2, y + 7.0, CONC, K_RAW, false);
      }
      const cx = C.X[0], cz = C.Z[0];
      K.obox(cx, cz, l + 0.45, 0.4, hd + Math.PI / 2 + Math.PI / 2 * 0 + 0, y + 6.2, y + 7.2, tint(CONC, 0.8), K_RAW, true);
      // neon band on the face looking down the straight, dark lamp housings under the beam
      K.obox(cx - Math.cos(hd) * 0.43, cz - Math.sin(hd) * 0.43, l + 0.2, 0.03, hd + Math.PI / 2, y + 6.55, y + 6.75, CYAN, K_NEON, false);
      for (let q = -3; q <= 3; q += 2) {
        const px = cx + rx * q * 1.2, pz = cz + rz * q * 1.2;
        K.obox(px - Math.cos(hd) * 0.46, pz - Math.sin(hd) * 0.46, 0.34, 0.12, hd + Math.PI / 2, y + 5.55, y + 6.2, [0.04, 0.04, 0.05], K_PLAIN, true);
      }
    }

    // ---- bridge: deck slab, piers, parapet lamps ---------------------------------------------------------------------
    {
      const i0 = C.bridge.i0 - 1, i1 = C.bridge.i1 + 1, lo = HW + C.WALL + 0.7;
      if (i0 > 0) {
        for (let i = i0; i < i1; i++) {
          const j = i + 1;
          quadUp(B, lat(i, -lo, -0.07), lat(i, lo, -0.07), lat(j, lo, -0.07), lat(j, -lo, -0.07), tint(CONC, 0.75)); // shoulders of the deck
          quadN(B, lat(i, -lo, -0.07), lat(i, lo, -0.07), lat(j, lo, -0.95), lat(j, -lo, -0.95), [0, -1, 0], tint(CONC, 0.5)); // soffit
        }
        const mid = (i0 + i1) >> 1;
        for (const f of [0.28, 0.72]) {
          const i = Math.round(i0 + (i1 - i0) * f), x = C.X[i], z = C.Z[i], top = C.Y[i] - 0.95, base = Math.max(0, gy(x, z) - 0.6);
          K.obox(x, z, lo - 0.6, 0.9, C.HD[i] + Math.PI / 2, base, top, tint(CONC, 0.85), K_RAW, false);
          K.obox(x, z, lo - 0.55, 0.05, C.HD[i] + Math.PI / 2, top - 0.5, top - 0.35, CYAN, K_NEON, false);
        }
        void mid;
      }
    }

    // ---- lookout pad in the middle of the crest hairpin ------------------------------------------------------------------
    {
      const P = Hills.PAD, y = P.y;
      K.cyl(P.x, P.z, y - 2.5, y, P.r + 0.3, P.r, 14, tint(CONC, 0.8), K_RAW, 0, false);
      K.cyl(P.x, P.z, y - 0.02, y + 0.12, P.r, P.r, 14, tint(CONC, 1.0), K_RAW, 0, false);
      K.cyl(P.x, P.z, y + 0.1, y + 0.16, P.r - 0.9, P.r - 0.9, 14, tint(CONC, 0.7), K_RAW, 0, false);
      // balustrade on the south-west side, which looks over the city and the sea
      for (let a = Math.PI * 0.55; a <= Math.PI * 1.1; a += Math.PI * 0.55 / 7) {
        const x0 = P.x + Math.cos(a) * (P.r - 0.5), z0 = P.z + Math.sin(a) * (P.r - 0.5), x1 = P.x + Math.cos(a + 0.28) * (P.r - 0.5), z1 = P.z + Math.sin(a + 0.28) * (P.r - 0.5);
        K.cyl(x0, z0, y + 0.1, y + 1.1, 0.07, 0.07, 5, STEEL, K_PLAIN);
        K.tube([x0, y + 1.05, z0], [x1, y + 1.05, z1], 0.05, 4, tint(CONC, 1.1), K_PLAIN);
        K.tube([x0, y + 0.55, z0], [x1, y + 0.55, z1], 0.035, 4, CYAN, K_NEON);
      }
      // two benches and a lamp
      for (const da of [-0.35, 0.35]) {
        const a = Math.PI * 0.82 + da, bx = P.x + Math.cos(a) * (P.r - 2.6), bz = P.z + Math.sin(a) * (P.r - 2.6);
        K.obox(bx, bz, 0.9, 0.22, a + Math.PI / 2, y + 0.1, y + 0.5, [0.36, 0.24, 0.16], K_PLAIN, false);
      }
      const lx = P.x + Math.cos(Math.PI * 0.2) * (P.r - 1.5), lz = P.z + Math.sin(Math.PI * 0.2) * (P.r - 1.5);
      K.cyl(lx, lz, y + 0.1, y + 4.2, 0.1, 0.08, 5, STEEL, K_PLAIN);
      K.box(lx - 0.25, lx + 0.25, y + 4.2, y + 4.34, lz - 0.25, lz + 0.25, [1, 0.9, 0.7], K_LAMP, true);
      W.glows.push({ x: lx, y: y + 4.15, z: lz, col: [0.7, 0.92, 1.0], size: 3.0 });
    }

    const geo = B.geometry(); geos.push(geo);
    const m = new THREE.Mesh(geo, mat); m.name = "karting-track"; geo.computeBoundingSphere();
    g.scene.add(m); meshes.push(m); tris += B.tris;
    return { stacks };
  }

  // ---- tyre walls (instanced) and rocks (instanced) -------------------------------------------------------------------------
  function buildStacks(list) {
    const B = new Buf(1e6), K = createKit(B, W);
    K.at(0, 0, 0);
    const blk = [0.035, 0.035, 0.04];
    for (let t = 0; t < 3; t++) K.cyl(0, 0, t * 0.34, t * 0.34 + 0.32, 0.46, 0.42, 6, t === 1 ? [1, 1, 1] : blk, K_PLAIN, 0, t === 0 ? false : true);
    const geo = B.geometry(); geos.push(geo);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    list.forEach((t, i) => {
      const p = t[0];
      q.setFromAxisAngle(up, -t[1]);
      mesh.setMatrixAt(i, m4.compose(v.set(p[0], gy(p[0], p[1]) - 0.02, p[1]), q, s));
      // paint cycles red / white / cyan-white along the wall (the middle tyre is the painted one)
      const k = Math.floor(i / 3) % 3;
      mesh.setColorAt(i, k === 0 ? col.setRGB(1, 0.18, 0.2) : k === 1 ? col.setRGB(1, 1, 1) : col.setRGB(0.3, 0.9, 1));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.name = "karting-tyres";
    g.scene.add(mesh); meshes.push(mesh); tris += geo.attributes.position.count / 3 * list.length;
  }

  function buildRocksAndTrees(H) {
    const rnd = seeded(2027), R = Hills.REGION;
    // rocks: eight triangles each, scattered where the cuttings are steep and along the ridge
    const B = new Buf(1e6), K = createKit(B, W);
    K.at(0, 0, 0);
    const v = [[0.9, 0.1, 0.1], [-0.7, 0.2, 0.6], [-0.2, 0.15, -0.9], [0.1, 0.95, 0.05], [0.25, -0.2, 0.2]];
    const rc = [0.3, 0.27, 0.29];
    K.solid([[v[0], v[1], v[3]], [v[1], v[2], v[3]], [v[2], v[0], v[3]], [v[0], v[2], v[4]], [v[2], v[1], v[4]], [v[1], v[0], v[4]]], rc, K_PLAIN);
    const geo = B.geometry(); geos.push(geo);
    const spots = [];
    for (let n = 0; n < 4000 && spots.length < 90; n++) {
      const x = R.x0 + 20 + rnd() * (R.x1 - R.x0 - 40), z = R.z0 + 20 + rnd() * (R.z1 - R.z0 - 40), h = Hills.height(x, z);
      if (h < 5) continue;
      const hit = C.project(x, z, -1, tmpHit);
      if (hit && hit.d < C.HW + C.WALL + 6) continue;
      const e = 2, sl = Math.hypot(Hills.height(x + e, z) - Hills.height(x - e, z), Hills.height(x, z + e) - Hills.height(x, z - e)) / (2 * e);
      if (sl < 0.4 && rnd() < 0.8) continue;
      spots.push([x, h, z, 0.9 + rnd() * 1.9, rnd() * 6.28]);
    }
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, t[4]); s.set(t[3] * (0.9 + rnd() * 0.5), t[3] * (0.7 + rnd() * 0.6), t[3]);
      mesh.setMatrixAt(i, m4.compose(p.set(t[0], t[1] - 0.25, t[2]), q, s));
      const k = 0.8 + rnd() * 0.4; mesh.setColorAt(i, col.setRGB(k, k * 0.96, k * 1.02));
    });
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.name = "karting-rocks";
    g.scene.add(mesh); meshes.push(mesh); tris += geo.attributes.position.count / 3 * spots.length;

    // trees: flora anchors on gentle ground away from the circuit (pines and cypresses)
    let trees = 0;
    for (let n = 0; n < 6000 && trees < 80; n++) {
      const x = R.x0 + 4 + rnd() * (R.x1 - R.x0 - 8), z = R.z0 + 4 + rnd() * (R.z1 - R.z0 - 8);
      if (Hills.mask(x, z) < 0.5) continue;
      const hit = C.project(x, z, -1, tmpHit);
      if (hit && hit.d < C.HW + C.WALL + 4.5) continue;
      if (Math.hypot(x - Hills.PAD.x, z - Hills.PAD.z) < 20) continue;
      const h = Hills.height(x, z);
      const e = 2.5, sl = Math.hypot(Hills.height(x + e, z) - Hills.height(x - e, z), Hills.height(x, z + e) - Hills.height(x, z - e)) / (2 * e);
      if (sl > 0.75 || h < 1.2) continue;
      // denser lower on the slopes and near the road, thin on the bare ridge
      if (rnd() > Math.max(0.15, 1 - h / 38) * (hit && hit.d < 40 ? 1 : 0.55)) continue;
      W.anchors.push({ t: "tree", x, y: h - 0.05, z, s: 0.9 + rnd() * 1.1, sp: rnd() < 0.3 ? "pine" : "cypress" });
      trees++;
    }
    g.stats.kartTrees = trees;
  }
  const tmpHit = C.makeHit();

  const api = {
    name: "karting-venue",
    init() {
      W.anchors = W.anchors || []; W.glows = W.glows || [];
      mat = W.karting && W.karting.mat; // made by the race system (no dithered window on this one)
      if (!mat) return;
      const H = buildGround();
      const { stacks } = buildTrack();
      buildStacks(stacks);
      buildRocksAndTrees(H);
      g.stats.tris += tris;
      g.stats.kartVenueTris = tris;
      W.karting.venueTris = tris;
    },
    update() {},
    dispose() {
      for (const m of meshes) g.scene.remove(m);
      for (const ge of geos) ge.dispose();
      for (const m of meshes) if (m.isInstancedMesh) m.dispose();
      meshes.length = 0; geos.length = 0;
    },
  };
  return api;
}
