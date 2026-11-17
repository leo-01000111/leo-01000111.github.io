// Le Port: the launch's motion. Pure maths, no THREE. Gentle inertia, a rudder that bites with speed,
// soft bounces off the pier, breakwater, pontoon and rock, shallows that slow and nudge the boat
// off, and soft limits far out that turn it back. Nothing is allocated while stepping.
import { shoreX, port as PT, pier, pierEnd } from "../../world/layout.js";

const TAU = Math.PI * 2;
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

export const MAX_FWD = 6.6, MAX_BACK = 1.9, RADIUS = 0.95, PROBES = [-1.8, 0, 1.8];

// ---- obstacles (oriented rectangles and circles) ------------------------------------------------
const obstacles = [];
const rect = (cx, cz, hw, hd, rot = 0) => obstacles.push({ t: 1, x: cx, z: cz, hw, hd, c: Math.cos(rot), s: Math.sin(rot), r: 0 });
const circle = (x, z, r) => obstacles.push({ t: 0, x, z, r, hw: 0, hd: 0, c: 1, s: 0 });
const box = (x0, x1, z0, z1, pad = 0) => rect((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2 + pad, (z1 - z0) / 2 + pad);

export function arcPoint(phiDeg) {
  const a = (PT.breakwater.arc.from - phiDeg) * Math.PI / 180, A = PT.breakwater.arc;
  return { x: A.cx + A.r * Math.cos(a), z: A.cz + A.r * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) };
}

(function build() {
  const q = PT.quay, s = PT.slip, p = PT.pontoon, b = PT.breakwater;
  // quay slab, minus the slipway notch (the ramp itself is shallow, so it is an obstacle too)
  box(q.x0, q.x1, q.z0, s.z0, 0); box(q.x0, q.x1, s.z1, q.z1, 0);
  box(s.xTop, q.x1, s.z0, s.z1, 0); box(s.xEnd, s.xTop, s.z0, s.z1, 0);
  // breakwater: straight leg with its armour, then the arc
  rect((b.xRoot + b.xEnd) / 2, b.z, Math.abs(b.xRoot - b.xEnd) / 2, b.w / 2 + 1.4);
  const A = b.arc, n = 11, step = A.sweep / n, len = 2 * A.r * Math.sin(step * Math.PI / 360);
  for (let i = 0; i < n; i++) {
    const m = arcPoint((i + 0.5) * step);
    rect(m.x, m.z, len / 2 + 0.3, b.w / 2 + 1.4, Math.atan2(m.tz, m.tx));
  }
  // pontoon: spine, fingers, gangway
  box(p.spine[0], p.spine[1], p.spine[2], p.spine[3], 0.15);
  for (const fz of p.fingers) box(p.spine[0] - p.fingerLen, p.spine[0], fz - p.fingerW / 2, fz + p.fingerW / 2, 0.1);
  box(p.gang[0], p.gang[1], p.gang[2], p.gang[3], 0);
  // pier, its end platform (the lighthouse stands on it)
  box(pier.x0 - 0.5, pier.x1, pier.z0 - 0.3, pier.z1 + 0.3);
  box(pierEnd.x0 - 0.8, pierEnd.x1, pierEnd.z0 - 0.3, pierEnd.z1 + 0.3);
  circle(PT.rock.x, PT.rock.z, PT.rock.r);
  circle(PT.bell[0], PT.bell[1], 1.0);
})();

// moored boats and buoys are added by life.js once their places are known
export function addCircle(x, z, r) { circle(x, z, r); }

// ---- shallows ---------------------------------------------------------------------------------------
// Metres from the waterline (positive offshore). The harbour basin is dredged, so it counts as deep.
export function offshore(x, z) {
  const harb = Math.min(smooth((-102 - z) / 10), smooth((z + 190) / 8));
  return shoreX(z) - x + 14 * harb;
}
export const shoal = (x, z) => 1 - smooth((offshore(x, z) - 3) / 15);

// ---- the boat -----------------------------------------------------------------------------------------
const hit = { nx: 0, nz: 0, d: 0 };
// penetration of a circle (px, pz, r) into obstacle o; fills hit and returns true on overlap (within r + soft margin)
function probe(o, px, pz, r) {
  if (o.t === 0) {
    const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz), m = r + o.r;
    if (d >= m) return false;
    if (d > 1e-6) { hit.nx = dx / d; hit.nz = dz / d; } else { hit.nx = 1; hit.nz = 0; }
    hit.d = m - d; return true;
  }
  const dx = px - o.x, dz = pz - o.z, lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c;
  const qx = clamp(lx, -o.hw, o.hw), qz = clamp(lz, -o.hd, o.hd);
  let ex = lx - qx, ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 >= r * r) return false;
  let nx, nz;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; hit.d = r - d; }
  else { const ox = o.hw - Math.abs(lx), oz = o.hd - Math.abs(lz); if (ox < oz) { nx = lx < 0 ? -1 : 1; nz = 0; hit.d = ox + r; } else { nx = 0; nz = lz < 0 ? -1 : 1; hit.d = oz + r; } }
  hit.nx = nx * o.c - nz * o.s; hit.nz = nx * o.s + nz * o.c;
  return true;
}

export function createBoat() {
  const b = {
    x: 0, z: 0, h: 0, vx: 0, vz: 0, u: 0, w: 0, r: 0, // position, heading, world velocity, surge, sway, yaw rate
    shoal: 0, bump: 0, edge: 0,                        // read by the caller: shallow amount, last impact (0..1), how close to the soft limit
    reset(x, z, h) { b.x = x; b.z = z; b.h = h; b.vx = b.vz = b.u = b.w = b.r = 0; b.shoal = b.bump = b.edge = 0; },
    step(dt, fwd, turn, lim = 1) {
      const S = PT.sail, cx = (S.x0 + S.x1) / 2 - 60, c = Math.cos(b.h), s = Math.sin(b.h);
      b.u = b.vx * c + b.vz * s; b.w = -b.vx * s + b.vz * c;
      // soft limits: slow down and swing back in
      const M = 70;
      b.edge = Math.max(clamp((S.x0 + M - b.x) / M, 0, 1), clamp((S.z0 + M - b.z) / M, 0, 1), clamp((b.z - (S.z1 - M)) / M, 0, 1));
      b.shoal = shoal(b.x, b.z);
      // surge
      const cap = (1 - 0.72 * b.shoal) * (1 - 0.5 * b.edge) * lim;
      const target = fwd > 0 ? MAX_FWD * cap : fwd < 0 ? -MAX_BACK : 0;
      const k = fwd === 0 ? 0.32 : (fwd > 0) === (b.u >= 0) || Math.abs(b.u) < 0.3 ? 0.62 : 1.5;
      b.u += (target - b.u) * (1 - Math.exp(-dt * k));
      b.u *= Math.exp(-dt * b.shoal * 2.2);
      b.w *= Math.exp(-dt * 1.5);
      // rudder: nothing at rest, full at 2.5 m/s, reversed when backing
      const eff = clamp(Math.abs(b.u) / 2.5, 0, 1) * (b.u < -0.15 ? -1 : 1) + (Math.abs(b.u) < 0.3 ? turn * 0.12 : 0);
      let rt = turn * 0.95 * eff;
      if (b.edge > 0) { // turn back from the far limits
        const want = Math.atan2(-b.z * 0.4, cx - b.x), e = wrap(want - b.h);
        rt += clamp(e, -0.9, 0.9) * b.edge * 1.3;
      }
      b.r += (rt - b.r) * (1 - Math.exp(-dt * 1.9));
      b.h = wrap(b.h + b.r * dt);
      const c2 = Math.cos(b.h), s2 = Math.sin(b.h);
      b.vx = c2 * b.u - s2 * b.w; b.vz = s2 * b.u + c2 * b.w;
      // the beach nudges the boat out to sea
      if (b.shoal > 0) b.vx -= b.shoal * 1.6 * dt;
      b.x += b.vx * dt; b.z += b.vz * dt;
      // hard stops: shallow limit, edge of the open water
      const off = offshore(b.x, b.z);
      if (off < 2.6) { b.x -= 2.6 - off; if (b.vx > 0) b.vx *= 0.5; }
      if (b.x < S.x0) { b.x = S.x0; if (b.vx < 0) b.vx = 0; }
      if (b.z < S.z0) { b.z = S.z0; if (b.vz < 0) b.vz = 0; }
      if (b.z > S.z1) { b.z = S.z1; if (b.vz > 0) b.vz = 0; }
      // soft collisions
      let impact = 0;
      for (let pass = 0; pass < 2; pass++) for (let p = 0; p < PROBES.length; p++) {
        const px = b.x + c2 * PROBES[p], pz = b.z + s2 * PROBES[p];
        for (let i = 0; i < obstacles.length; i++) {
          const o = obstacles[i];
          if (Math.abs(px - o.x) > 90 || Math.abs(pz - o.z) > 90) continue;
          if (!probe(o, px, pz, RADIUS)) continue;
          b.x += hit.nx * hit.d; b.z += hit.nz * hit.d;
          const vn = b.vx * hit.nx + b.vz * hit.nz;
          if (vn < 0) { b.vx -= 1.2 * vn * hit.nx; b.vz -= 1.2 * vn * hit.nz; impact = Math.max(impact, -vn); }
          // the bow swings away a little, like a fender
          b.r += clamp((hit.nx * s2 - hit.nz * c2) * PROBES[p] * 0.05, -0.2, 0.2);
        }
      }
      b.u = b.vx * c2 + b.vz * s2;
      b.bump = Math.max(b.bump * Math.exp(-dt * 3), clamp(impact / 5, 0, 1));
    },
  };
  return b;
}
