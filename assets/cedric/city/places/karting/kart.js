// The karts: an original low-poly model (one geometry, tinted per instance), the arcade handling
// shared by the player and the AI, and the AI driver that follows the racing line. No allocation
// per step: everything works on the kart state objects and module scratch values.
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { createKit, K_PLAIN, K_NEON } from "../../world/kit/kit.js";
import * as C from "./circuit.js";

export const PHYS = {
  vmax: 24,          // m/s on asphalt (about 86 km/h)
  acc: 11,           // m/s2 at standstill, tapering towards vmax
  brake: 24, reverseAcc: 9, reverseMax: 7,
  drag: 0.16,
  steer: 2.7,        // rad/s at full lock, low speed
  steerV: 15,        // speed (m/s) at which steering authority has halved
  grip: 9, drift: 5.2, // lateral grip, and how much of it a hard turn gives away (gentle drift)
  bounce: 0.3,
  boostV: 6.5, boostTime: 1.5, boostCooldown: 5.5,
};

const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export { wrap, clamp };

// ---- model: forward is +x, up +y, right +z. Body parts are white so the instance colour paints them.
export function buildKartGeometry(world) {
  const B = new Buf(1e6), K = createKit(B, world);
  K.at(0, 0, 0);
  const W = [1, 1, 1], D = [0.055, 0.055, 0.065], S = [0.2, 0.21, 0.24], CY = [0.25, 0.9, 1.0];
  K.box(-0.95, 0.95, 0.1, 0.2, -0.5, 0.5, D, K_PLAIN, true);                    // floor pan
  K.hexa([[0.45, 0.2, -0.46], [1.06, 0.2, -0.3], [1.06, 0.2, 0.3], [0.45, 0.2, 0.46], [0.45, 0.56, -0.46], [1.06, 0.4, -0.24], [1.06, 0.4, 0.24], [0.45, 0.56, 0.46]], W, K_PLAIN, false, true); // nose
  K.box(1.02, 1.13, 0.13, 0.3, -0.64, 0.64, S, K_PLAIN, true);                     // front bumper
  K.box(1.08, 1.15, 0.2, 0.26, -0.5, -0.36, CY, K_NEON, true); K.box(1.08, 1.15, 0.2, 0.26, 0.36, 0.5, CY, K_NEON, true);
  for (const s of [-1, 1]) {
    const a = s > 0 ? 0.42 : -0.7, b = s > 0 ? 0.7 : -0.42;
    K.hexa([[-0.5, 0.2, a], [0.6, 0.2, a], [0.6, 0.2, b], [-0.5, 0.2, b], [-0.5, 0.5, a + 0.04 * s], [0.5, 0.46, a + 0.04 * s], [0.5, 0.46, b - 0.04 * s], [-0.5, 0.5, b - 0.04 * s]], W, K_PLAIN, false, true); // side pods
  }
  K.box(-0.88, -0.42, 0.2, 0.64, -0.3, 0.3, D, K_PLAIN, false);                    // engine
  K.box(-1.12, -1.0, 0.14, 0.34, -0.64, 0.64, S, K_PLAIN, true);                   // rear bumper
  for (const s of [-0.42, 0.42]) K.box(-0.98, -0.9, 0.2, 0.86, s - 0.03, s + 0.03, S, K_PLAIN, false); // wing struts
  K.box(-1.14, -0.8, 0.84, 0.9, -0.58, 0.58, W, K_PLAIN, true);                    // rear wing
  K.box(-0.54, 0.12, 0.2, 0.3, -0.3, 0.3, D, K_PLAIN, true);                       // seat pan
  K.box(-0.56, -0.42, 0.3, 0.78, -0.3, 0.3, D, K_PLAIN, true);                     // seat back
  K.tube([0.3, 0.34, 0], [0.12, 0.7, 0], 0.025, 4, S, K_PLAIN);                    // steering column
  K.tube([0.12, 0.7, -0.17], [0.12, 0.7, 0.17], 0.03, 4, D, K_PLAIN);              // wheel
  for (const [x, r, w] of [[0.74, 0.19, 0.17], [-0.8, 0.23, 0.27]]) for (const s of [-1, 1]) {
    const z0 = s * (0.5), z1 = s * (0.5 + w);
    K.tube([x, r, z0], [x, r, z1], r, 8, [0.035, 0.035, 0.04], K_PLAIN);           // tyre
    K.tube([x, r, s * (0.5 + w + 0.005)], [x, r, s * (0.5 + w + 0.012)], r * 0.55, 6, CY, K_NEON); // lit hub
  }
  K.box(-0.82, 0.82, 0.045, 0.1, -0.42, 0.42, CY, K_NEON, true);                   // underglow
  const geo = B.geometry();
  geo.userData.tris = B.tris;
  return geo;
}

// ---- state -----------------------------------------------------------------------------------------------
export function makeKart(name) {
  return {
    name, x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, steer: 0, yaw: 0, pitch: 0, roll: 0,
    lat: 0, grass: false, s: 0, prog: 0, lastS: 0, hint: -1, hit: C.makeHit(),
    boostT: 0, cd: 0, lapIdx: 0, lapStart: -1, bestLap: 0, finished: false, finishT: 0,
    bumpT: 0, speed: 0, thr: 0, brk: 0,
    // AI
    skill: 1, off: 0, wob: 0, phase: 0, react: 0, auto: false, lineScale: 1,
  };
}

// Put a kart on the track at arclength s (m), lateral offset l, standing still.
const _p = C.makeHit();
export function placeKart(k, s, l, groundY) {
  C.at(s, _p);
  k.x = _p.x - Math.sin(_p.hd) * l; k.z = _p.z + Math.cos(_p.hd) * l; k.h = _p.hd;
  k.vx = 0; k.vz = 0; k.steer = 0; k.yaw = 0; k.boostT = 0; k.cd = 0; k.grass = false;
  C.project(k.x, k.z, -1, k.hit);
  k.hint = k.hit.i; k.s = k.hit.s; k.lastS = k.hit.s; k.lat = k.hit.lat;
  k.y = C.surfaceY(k.hit.y, k.hit.bank, k.hit.lat) + 0.04;
  k.pitch = 0; k.roll = 0; k.speed = 0;
}

// One physics step. inp: { thr 0..1, brk 0..1, steer -1..1, boost bool }
export function stepKart(k, inp, dt, groundY, speedMul = 1) {
  const P = PHYS;
  if (k.boostT > 0) k.boostT -= dt;
  if (k.cd > 0) k.cd -= dt;
  if (inp.boost && k.cd <= 0 && k.boostT <= 0) { k.boostT = P.boostTime; k.cd = P.boostTime + P.boostCooldown; }
  if (k.bumpT > 0) k.bumpT -= dt;
  k.steer += (inp.steer - k.steer) * (1 - Math.exp(-dt * 9));

  let c = Math.cos(k.h), s = Math.sin(k.h);
  let vf = k.vx * c + k.vz * s;
  const vmax = (P.vmax + (k.boostT > 0 ? P.boostV : 0)) * (k.grass ? 0.62 : 1) * speedMul;
  // steering authority fades with speed and with standing still
  const auth = (1 / (1 + (vf / P.steerV) * (vf / P.steerV))) * Math.min(1, Math.abs(vf) / 4);
  const want = k.steer * P.steer * auth * (vf >= -0.2 ? 1 : -1);
  k.yaw += (want - k.yaw) * (1 - Math.exp(-dt * 10));
  k.h += k.yaw * dt;
  if (k.h > Math.PI) k.h -= Math.PI * 2; else if (k.h < -Math.PI) k.h += Math.PI * 2;
  c = Math.cos(k.h); s = Math.sin(k.h);
  vf = k.vx * c + k.vz * s;
  let vs = -k.vx * s + k.vz * c;                                   // sideways (right is positive)
  const slide = Math.min(1, Math.abs(k.steer) * Math.abs(vf) / P.vmax * 1.35);
  vs *= Math.exp(-(k.grass ? 3.2 : P.grip - P.drift * slide) * dt); // gentle drift when turning hard at speed

  let a = 0;
  if (inp.brk > 0) a = vf > 0.4 ? -P.brake * inp.brk : -P.reverseAcc * inp.brk;
  else if (inp.thr > 0) a = P.acc * Math.max(0, 1 - vf / (vmax * 1.04)) * (k.boostT > 0 ? 1.8 : 1) * inp.thr;
  else a = -Math.sign(vf) * Math.min(Math.abs(vf) / dt, 2.2);        // coasting friction, never reverses the sign
  a -= vf * P.drag;
  if (vf > vmax) a -= (vf - vmax) * 3;
  a -= 9.81 * Math.sin(k.pitch) * 0.5;                              // hills slow and speed up a little
  vf += a * dt;
  if (vf < -P.reverseMax) vf = -P.reverseMax;
  k.vx = c * vf - s * vs; k.vz = s * vf + c * vs;
  k.x += k.vx * dt; k.z += k.vz * dt;
  k.speed = Math.hypot(k.vx, k.vz) * (vf < 0 ? -1 : 1);

  // where are we on the circuit?
  const hit = k.hit;
  if (k.hint < 0 || !C.project(k.x, k.z, k.hint, hit, 18) || hit.d > 60) C.project(k.x, k.z, -1, hit);
  k.hint = hit.i;
  const al = Math.abs(hit.lat);
  k.grass = al > C.HW + C.KERB;
  if (al > C.LIMIT) {                                               // soft wall: push back, bounce a little, lose some speed
    const side = hit.lat > 0 ? 1 : -1, over = al - C.LIMIT;
    const ox = -Math.sin(hit.hd) * side, oz = Math.cos(hit.hd) * side; // outward
    k.x -= ox * over; k.z -= oz * over;
    const vn = k.vx * ox + k.vz * oz;
    if (vn > 0) {
      k.vx -= (1 + P.bounce) * vn * ox; k.vz -= (1 + P.bounce) * vn * oz;
      const keep = 1 - Math.min(0.12, vn * 0.01); k.vx *= keep; k.vz *= keep;
      if (vn > 2.5) k.bumpT = 0.4;
    }
    hit.lat = side * C.LIMIT;
  }
  k.lat = hit.lat;
  // progress along the lap (continuous, so laps and positions are simple sums)
  let d = hit.s - k.lastS;
  if (d > C.LENGTH / 2) d -= C.LENGTH; else if (d < -C.LENGTH / 2) d += C.LENGTH;
  k.prog += d; k.lastS = hit.s; k.s = hit.s;

  // height: asphalt and kerbs follow the banked ribbon, the rest follows the ground
  let target;
  if (al <= C.HW + C.KERB || hit.br > 0.5) target = C.surfaceY(hit.y, hit.bank, clamp(hit.lat, -C.HW - C.KERB, C.HW + C.KERB)) + 0.04;
  else target = groundY(k.x, k.z) + 0.02;
  k.y += (target - k.y) * (1 - Math.exp(-dt * 14));
  // slope seen along the heading, and a little roll: banking plus a lean out of the turn
  const j = (hit.i + 1) % C.N, slope = (C.Y[j] - C.Y[hit.i]) / C.ds * Math.cos(hit.hd - k.h);
  k.pitch += (Math.atan(slope) - k.pitch) * (1 - Math.exp(-dt * 6));
  const rollT = clamp(hit.bank * 1.1 * Math.cos(hit.hd - k.h) + k.yaw * Math.abs(vf) * 0.0042, -0.28, 0.28);
  k.roll += (rollT - k.roll) * (1 - Math.exp(-dt * 7));
}

// soft kart-to-kart contact: push apart, share a little speed. No damage.
export function bump(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = 1.55;
  if (d >= m || d < 1e-4) return;
  const nx = dx / d, nz = dz / d, push = (m - d) * 0.5;
  a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
  const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rv < 0) { const j = -rv * 0.45; a.vx -= nx * j; a.vz -= nz * j; b.vx += nx * j; b.vz += nz * j; }
}

// ---- AI driver: pure pursuit of the racing line, target speed from the corner ahead ------------------------------
const _t = C.makeHit();
export function aiInput(k, t, rubber, out) {
  const vf = k.vx * Math.cos(k.h) + k.vz * Math.sin(k.h);
  const look = 6.5 + Math.abs(vf) * 0.5;
  C.at(k.s + look, _t);
  const li = _t.i, line = C.LINE[li] * k.lineScale + k.off + Math.sin(t * 0.33 + k.phase) * k.wob;
  const tx = _t.x - Math.sin(_t.hd) * line, tz = _t.z + Math.cos(_t.hd) * line;
  const err = wrap(Math.atan2(tz - k.z, tx - k.x) - k.h);
  out.steer = clamp(err * 1.9, -1, 1);
  const vi = (Math.floor((k.s + Math.max(0, vf) * 0.45) / C.ds) % C.N + C.N) % C.N;
  const vt = C.VT[vi] * k.skill * rubber * (1 - 0.35 * Math.min(1, Math.abs(err)));
  out.boost = false;
  if (vf < vt - 0.3) { out.thr = 1; out.brk = 0; }
  else if (vf > vt + 2.2) { out.thr = 0; out.brk = clamp((vf - vt - 2) * 0.35, 0.2, 0.8); }
  else { out.thr = 0.35; out.brk = 0; }
  // the AI uses its boost on the straights, now and then
  if (k.cd <= 0 && Math.abs(C.CURV_S[li]) < 0.004 && vf > 17 && ((k.phase * 977 + Math.floor(t)) % 7) < 1) out.boost = true;
  return out;
}

// ---- drawing helpers (shared scratch) ------------------------------------------------------------------------------
const _e = new THREE.Euler(0, 0, 0, "YZX"), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
export function kartMatrix(k, out) {
  _e.set(k.roll, -k.h, k.pitch, "YZX");   // x = roll, y = yaw, z = pitch
  _q.setFromEuler(_e);
  return out.compose(_v.set(k.x, k.y, k.z), _q, _s);
}
