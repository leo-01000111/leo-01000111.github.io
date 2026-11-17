// Flight model of the club glider (about 17 m span, 34:1, min sink 0.65 m/s). A point mass with
// energy exchange, not a rigid body:
//   - the pilot trims an airspeed target (W faster / nose down, S slower / nose up). The speed follows it with
//     a limited acceleration (about 3 m/s^2, a steep dive or a zoom), and the speed change pays for height:
//     dh/dt = -V dV/dt / g.
//   - sink rate from a two-term polar, sink = k1 n^2 / V + k2 V^3 (induced + profile drag), n the load
//     factor 1/cos(bank), plus the air brakes and a stall term. k1, k2 fit 0.68 m/s at 80 km/h and
//     1.65 m/s at 150 km/h, giving best L/D of 35 near 100 km/h.
//   - A / D set a bank angle target; the turn is coordinated: heading rate = g tan(bank) / V.
//   - stall: below 1.03 Vs (Vs = 17.5 sqrt(n)) the sink grows and the speed target jumps up: a gentle nose drop.
//   - never a crash: an invisible cushion adds climb rate when the look-ahead sees ground, sea or a roof
//     closer than its margin; the world edge turns the aircraft back with a bank.
import { BOUNDS, CEILING } from "./air.js";

const G = 9.81;
export const K1 = 10.41, K2 = 1.931e-5, VS = 17.5, VNE = 58, BRAKE_K = 0.0042;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export const sinkAt = (V, n, brake) => K1 * n * n / V + K2 * V * V * V + brake * BRAKE_K * V * V;
export const stallSpeed = n => VS * Math.sqrt(n);

export function createState() {
  return {
    x: 0, y: 100, z: 0, psi: -Math.PI / 2, phi: 0, V: 28, Vt: 28, vz: -0.9, vzF: -0.9,
    brake: 0, stall: 0, cushion: 0, pitch: 0, gamma: 0, sink: 0, w: 0, n: 1, bounds: 0,
  };
}

const KS = [0.6, 1.4, 2.6, 4.2, 6.5];

// inp: { pitch -1..1 (+ = W = nose down), roll -1..1 (+ = D = right), brake 0|1 }
// env: { lift(x, y, z) -> m/s, surf(x, z) -> surface height (m), margin: safe height above it set by surf() }
export function step(s, inp, env, dt) {
  // -- bank --
  const bm = BOUNDS;
  let phiT = clamp(inp.roll, -1, 1) * 0.87 * (1 - 0.6 * s.stall);
  const ex = Math.max(s.x - (bm.x1 - 70), (bm.x0 + 70) - s.x, s.z - (bm.z1 - 70), (bm.z0 + 70) - s.z);
  s.bounds = clamp(ex / 70, 0, 1);
  if (s.bounds > 0) { // the world edge: bank towards the middle
    const cx = (bm.x0 + bm.x1) / 2, cz = (bm.z0 + bm.z1) / 2;
    const d = wrap(Math.atan2(cz - s.z, cx - s.x) - s.psi), k = s.bounds * s.bounds * (3 - 2 * s.bounds);
    phiT += (Math.sign(d || 1) * Math.min(0.7, 0.35 + Math.abs(d) * 0.4) - phiT) * k;
  }
  const dphi = clamp((phiT - s.phi) * (1 - Math.exp(-dt / 0.5)), -1.4 * dt, 1.4 * dt);
  s.phi += dphi;
  const n = 1 / Math.max(Math.cos(s.phi), 0.5);
  s.n = n;
  const Vs = stallSpeed(n);

  // -- speed trim and speed --
  s.Vt += inp.pitch * 7 * dt;
  s.Vt += (27 - s.Vt) * (1 - Math.exp(-dt / 40));
  s.Vt = clamp(s.Vt, Math.max(1.15 * Vs, 19), 52);
  if (s.stall > 0.01) s.Vt = Math.max(s.Vt, 1.4 * Vs);
  const a = clamp((s.Vt - s.V) / 1.2, -3, 3.4);
  s.V = Math.max(10, s.V + a * dt);
  s.brake += ((inp.brake ? 1 : 0) - s.brake) * (1 - Math.exp(-dt / 0.6));
  s.stall = clamp((1.03 * Vs - s.V) / (0.08 * Vs), 0, 1);

  // -- vertical speed: polar sink, air, energy exchange, cushion --
  let sink = sinkAt(s.V, n, s.brake) + s.stall * 4.5;
  if (s.y > CEILING) sink += Math.min(5, (s.y - CEILING) * 0.05);
  const w = env.lift(s.x, s.y, s.z);
  s.sink = sink; s.w = w;
  const vzBase = clamp(-sink + w - s.V * a / G, -0.85 * s.V, 0.6 * s.V);
  // cushion: look ahead along the track and under both wing tips for the safe height of what is there,
  // plus the height a pull-out needs at the current descent rate
  const co = Math.cos(s.psi), si = Math.sin(s.psi), stop = vzBase < 0 ? vzBase * vzBase / 10 : 0;
  let need = 0;
  for (let i = 0; i < KS.length; i++) {
    const k = KS[i], d = s.V * k, px = s.x + co * d, pz = s.z + si * d;
    const def = env.surf(px, pz) + env.margin + stop - (s.y + vzBase * k);
    if (def > 0) need = Math.max(need, def * 1.2 / Math.max(k, 0.9));
    if (k < 2) for (let sd = -1; sd <= 1; sd += 2) {
      const d2 = env.surf(px - si * 13 * sd, pz + co * 13 * sd) + env.margin + stop - (s.y + vzBase * k);
      if (d2 > 0) need = Math.max(need, d2 * 1.2 / Math.max(k, 0.9));
    }
  }
  const def0 = env.surf(s.x, s.z) + env.margin - s.y;
  if (def0 > 0) need = Math.max(need, def0 * 2 + 3 - vzBase);
  const cT = Math.min(need, 16);
  s.cushion += (cT - s.cushion) * (1 - Math.exp(-dt / (cT > s.cushion ? 0.4 : 2.2)));
  s.vz = clamp(vzBase + s.cushion, -0.85 * s.V, 0.6 * s.V);
  s.vzF += (s.vz - s.vzF) * (1 - Math.exp(-dt / 0.7));

  // -- heading and position --
  const vh = Math.sqrt(Math.max(s.V * s.V - s.vz * s.vz, 1));
  s.psi = wrap(s.psi + G * Math.tan(s.phi) / s.V * dt);
  s.x += Math.cos(s.psi) * vh * dt;
  s.z += Math.sin(s.psi) * vh * dt;
  s.y += s.vz * dt;
  s.x = clamp(s.x, bm.x0, bm.x1); s.z = clamp(s.z, bm.z0, bm.z1);
  const hard = env.surf(s.x, s.z) + 2;
  if (s.y < hard) s.y = hard;

  // -- attitude for the picture: path angle + angle of attack, nose drops in a stall --
  s.gamma = Math.atan2(s.vz, vh);
  const alpha = (-2 + 7.5 * n * (25 / s.V) * (25 / s.V)) * Math.PI / 180;
  s.pitch += (s.gamma + clamp(alpha, -0.05, 0.26) - s.stall * 0.16 - s.pitch) * (1 - Math.exp(-dt / 0.25));
  return s;
}
