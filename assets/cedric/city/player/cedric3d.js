// Cédric as a "hatch volume": every pen line of window.CEDRIC_DESIGN becomes a rod, repeated
// across depth with an elliptical profile. One InstancedMesh, one draw call. The builder takes a
// colour set so the friends can reuse it.
import * as THREE from "../core/three.js";

const nums = d => d.match(/-?\d*\.?\d+/g).map(Number);

// Ink rods write alpha 0 so the post glow never picks them up (it smeared him into a blob).
function inkMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */`varying vec3 vC;
      void main(){ vC=vec3(1.);
        #ifdef USE_INSTANCING_COLOR
          vC=instanceColor;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`varying vec3 vC; void main(){ gl_FragColor=vec4(vC,0.); }`,
  });
}

// Spine of the drawing (prototype units, head tip first): the curve through the middle of the
// hatch band, read off the pen lines' midpoints. The planes are shrunk towards it.
const SPINE = [[758, 205], [680, 200], [600, 196], [520, 200], [440, 216], [370, 250], [310, 300], [266, 358], [250, 430], [246, 490], [256, 535], [285, 580], [335, 615], [420, 640], [520, 655], [548, 662]];
// half-thickness along the spine as a share of the thickest point: thin head tip, full carapace, tail tapering out
const PROFILE = [[0, 0.4], [0.1, 0.85], [0.22, 1], [0.42, 1], [0.62, 0.72], [0.82, 0.45], [1, 0.2]];
const prof = t => { for (let i = 1; i < PROFILE.length; i++) if (t <= PROFILE[i][0]) { const a = PROFILE[i - 1], b = PROFILE[i], u = (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u * u * (3 - 2 * u); } return PROFILE[PROFILE.length - 1][1]; };
function spineSamples() {
  const pts = [], P = SPINE, cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < 8; s++) { const t = s / 8; pts.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); }
  }
  pts.push(P[P.length - 1].slice());
  let len = 0; const ts = [0];
  for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); ts.push(len); }
  return pts.map((p, i) => ({ x: p[0], y: p[1], t: ts[i] / len }));
}

// opts: planes = hatch planes each side of the middle one, width = body width / length at the
// thickest point, rod = pen width, material. (depth / slice of the first version are ignored.)
export function buildCedric(design, colours = {}, length = 1.6, opts = {}) {
  const P = opts.planes == null ? 3 : opts.planes, WIDTH = opts.width || 0.225, ROD = opts.rod || 7.5;
  const ink = new THREE.Color(colours.ink || "#9db8ff"), eye = new THREE.Color(colours.eye || "#ff4d63");
  const body = design.parts.body.map(p => nums(p.d)), ant = design.parts.ant.map(p => ({ l: nums(p.d), o: p.o }));
  const e = design.eye;
  let minX = 1e9, maxX = -1e9;
  for (const l of body) { minX = Math.min(minX, l[0], l[2]); maxX = Math.max(maxX, l[0], l[2]); }
  const k = length / (maxX - minX), cx = (minX + maxX) / 2, cy = 380;
  const X = x => (x - cx) * k, Y = y => -(y - cy) * k;
  const RMAX = WIDTH * length / 2 / k;            // half-thickness, prototype units
  // plane depths: close together at the middle (where the hatching is the clearest), opening towards the outside, last one at 0.9 of the half-thickness
  const ZJ = j => Math.sign(j) * RMAX * 0.9 * (1 - (1 - Math.abs(j) / P) ** 1.6), D = ZJ(1) / 1;
  const sp = spineSamples();

  // nearest spine point to a drawing point -> its distance share along the body
  const near = (x, y) => { let best = 1e18, o = sp[0]; for (const s of sp) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < best) { best = d; o = s; } } return o; };
  // pull a point towards the spine so the plane at depth z is an elliptical section: the drawing's outline scaled by sqrt(1-(z/R)^2)
  const pull = (x, y, z) => {
    const s = near(x, y), R = RMAX * prof(s.t), r = Math.abs(z) / R;
    if (r >= 0.97) return null;
    const f = Math.sqrt(1 - r * r);
    return { x: s.x + (x - s.x) * f, y: s.y + (y - s.y) * f, f };
  };

  const scaleRod = (l, z) => {
    const mx = (l[0] + l[2]) / 2, my = (l[1] + l[3]) / 2, m = pull(mx, my, z);
    if (!m || m.f < 0.3) return null;
    const dx = (l[2] - l[0]) / 2 * m.f, dy = (l[3] - l[1]) / 2 * m.f;
    return [[m.x - dx, m.y - dy], [m.x + dx, m.y + dy]];
  };
  const items = [];            // { a:[x,y], b:[x,y], z, w, col }
  const shade = j => new THREE.Color().copy(ink).multiplyScalar(1 - 0.36 * Math.abs(j) / Math.max(1, P));
  for (let j = -P; j <= P; j++) {
    const z = ZJ(j), col = shade(j), w = (j === 0 ? ROD * 1.25 : ROD) * (1 - 0.38 * Math.abs(j) / Math.max(1, P));
    for (const l of body) {                // the whole pen line is scaled about the spine, so its angle (the hatching) is kept
      const c = scaleRod(l, z);
      if (c) items.push({ a: c[0], b: c[1], z, w, col });
    }
  }
  // eye: a red dash on the outermost plane that still has the eye's position inside the body, each side
  const ex = e.dir[0], ey = e.dir[1], h = (e.len || 18) * 0.65, ec = e.c;
  let eyeJ = 0;
  for (let j = P; j > 0; j--) { const q = pull(ec[0], ec[1], ZJ(j)); if (q && q.f >= 0.55) { eyeJ = j; break; } }
  for (const sd of [-1, 1]) {
    const z = sd * (ZJ(eyeJ) + 0.25 * D), c = scaleRod([ec[0] - ex * h, ec[1] - ey * h, ec[0] + ex * h, ec[1] + ey * h], ZJ(eyeJ));
    if (c) items.push({ a: c[0], b: c[1], z, w: 20, col: eye });
  }

  const total = items.length + ant.length;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), opts.material || inkMaterial(), total);
  mesh.frustumCulled = false;
  const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const axisZ = new THREE.Vector3(0, 0, 1);
  let n = 0;
  const rod = (a, b, w, z, col) => {
    pos.set(X((a[0] + b[0]) / 2), Y((a[1] + b[1]) / 2), z * k);
    q.setFromAxisAngle(axisZ, -Math.atan2(b[1] - a[1], b[0] - a[0]));
    scl.set(Math.hypot(b[0] - a[0], b[1] - a[1]) * k, w * k, w * k);
    mesh.setMatrixAt(n, m4.compose(pos, q, scl));
    mesh.setColorAt(n, col);
    return n++;
  };
  for (const it of items) rod(it.a, it.b, it.w, it.z, it.col);
  // antennae: kept apart so they can swing from their pivot; slightly splayed outward, near the middle plane
  const ants = [], qs = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  // one rod per antenna part (the design has two); each sits slightly off the middle plane and splays outward
  for (const [ai, a] of ant.entries()) { const sd = ai % 2 ? 1 : -1;
    const i = rod([a.l[0], a.l[1]], [a.l[2], a.l[3]], 9, sd * 0.35 * D, ink), px = X(a.o[0]), py = Y(a.o[1]);
    mesh.getMatrixAt(i, m4);
    const sp4 = new THREE.Matrix4().makeRotationFromQuaternion(qs.setFromAxisAngle(yAxis, sd * 0.12));
    const base = new THREE.Matrix4().makeTranslation(px, py, 0).multiply(sp4).multiply(new THREE.Matrix4().makeTranslation(-px, -py, 0)).multiply(m4);
    mesh.setMatrixAt(i, base);
    ants.push({ i, base, px, py });
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  // reusable scratch for the antenna swing
  const eul = new THREE.Euler(), r4 = new THREE.Matrix4(), t1 = new THREE.Matrix4(), t2 = new THREE.Matrix4(), out = new THREE.Matrix4();
  function swing(yaw, drop) {
    eul.set(0, yaw, drop);
    r4.makeRotationFromEuler(eul);
    for (const a of ants) {
      t1.makeTranslation(a.px, a.py, 0); t2.makeTranslation(-a.px, -a.py, 0);
      out.copy(t1).multiply(r4).multiply(t2).multiply(a.base);
      mesh.setMatrixAt(a.i, out);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, swing, length, dispose() { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); } };
}

export function createCedric(g) {
  const group = new THREE.Group(), rig = new THREE.Group();
  let body, shadow, antYaw = 0, antDrop = 0;
  group.rotation.order = "YXZ";
  const api = {
    name: "cedric3d", group,
    init() {
      body = buildCedric(window.CEDRIC_DESIGN, { ink: "#9db8ff", eye: "#ff4d63" }, 1.6);
      group.add(body.mesh);
      g.scene.add(group);
      shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(1.15, 0.7, 1);
      rig.add(shadow);
      g.scene.add(rig);
      g.player.cedric = api;
      api.update(0.016, 0);
    },
    update(dt, t) {
      const st = g.player.state;
      const turn = st.turnRate / 1.7, spd = st.speed / 3.2;
      group.position.set(st.pos.x, st.pos.y + Math.sin(t * 1.7) * 0.07, st.pos.z);
      group.rotation.y = -st.heading;
      group.rotation.x = turn * 0.3;                                  // bank into turns
      group.rotation.z = spd * 0.07 + Math.sin(t * 1.7 + 1) * 0.03;  // nose up a little when swimming
      // antennae lag behind turns and trail at speed
      const a = 1 - Math.exp(-dt * 3);
      antYaw += (turn * 0.5 + Math.sin(t * 1.3) * 0.05 - antYaw) * a;
      antDrop += (-Math.max(spd, 0) * 0.2 + Math.sin(t * 1.1 + 2) * 0.03 - antDrop) * a;
      body.swing(antYaw, antDrop);
      // blob shadow on the ground, fainter and wider when higher
      const gy = g.level.floorY(st.pos.x, st.pos.z), hgt = Math.max(0, group.position.y - gy);
      rig.position.set(st.pos.x, gy + 0.04, st.pos.z);
      rig.rotation.y = -st.heading;
      const s = 1 + hgt * 0.08;
      shadow.scale.set(1.15 * s, 0.7 * s, 1);
      shadow.material.opacity = Math.max(0.12, 0.38 - hgt * 0.1);
    },
    dispose() {
      if (body) body.dispose();
      if (shadow) { shadow.geometry.dispose(); shadow.material.dispose(); }
      g.scene.remove(group); g.scene.remove(rig);
    },
  };
  return api;
}
