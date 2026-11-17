// The hills north and east of the city, as an additive height field: hills.height(x, z) is 0
// everywhere inside the existing city, rises smoothly outside it, and is carved flat (cuttings
// and embankments) along the karting circuit. Pure functions, no THREE.
import * as C from "../places/karting/circuit.js";

const sstep = (a, b, x) => { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

// [centre x, centre z, height, spread x, spread z]
const BLOBS = [
  [220, -250, 34, 55, 45],    // the climb
  [320, -290, 40, 80, 50],    // the ridge
  [370, -250, 36, 50, 50],    // the crest hairpin sits in its shoulder
  [330, -180, 20, 50, 50],    // inside the loop
  [410, -120, 36, 55, 55],
  [300, -135, 14, 40, 40],    // flanks of the gully
  [140, -300, 30, 70, 50],
  [460, -260, 50, 70, 70],
  [80, -290, 24, 60, 60],
  [240, -335, 30, 70, 40],
  [440, -30, 26, 50, 40],
];
export const REGION = { x0: 110, x1: 480, z0: -360, z1: -8 };

// 0 inside the city, 1 well outside it to the north and east. Never in the south-east (the station).
export function mask(x, z) {
  const dx = Math.max(0, x - 238), dz = Math.max(0, -114 - z);
  const d = Math.hypot(dx, dz);
  return sstep(0, 70, d) * sstep(95, 135, x) * (1 - sstep(-70, -12, z));
}

export function raw(x, z) {
  let h = 0;
  for (let i = 0; i < BLOBS.length; i++) {
    const b = BLOBS[i], u = (x - b[0]) / b[3], v = (z - b[1]) / b[4];
    h += b[2] * Math.exp(-(u * u + v * v) * 0.5);
  }
  h += 1.7 * Math.sin(x * 0.043 + 1.3) * Math.sin(z * 0.051 + 0.4) + 0.9 * Math.sin(x * 0.11 + z * 0.07);
  // the gully the bridge crosses (east-west trench across the southbound leg)
  const G = C.GULLY, tz = (z - G.z) / 11, tx = (x - G.x) / (G.half * 2.2);
  h -= 15 * Math.exp(-tz * tz) * Math.exp(-tx * tx);
  return h < 0 ? 0 : h;
}

// A flat lookout pad in the middle of the crest hairpin.
export const PAD = { x: 366, z: -244, r: 9, y: 25.2 };

const _h = C.makeHit();
const FLAT = C.HW + C.WALL + 8, FALL = 20;   // flat strip wide enough that every 7 m mesh vertex near the road is carved

export function height(x, z) {
  const m = mask(x, z);
  if (m <= 0) return 0;
  let hill = raw(x, z) * m;
  { const pd = Math.hypot(x - PAD.x, z - PAD.z); if (pd < PAD.r + 9) hill += (PAD.y - hill) * (1 - sstep(PAD.r, PAD.r + 9, pd)) * m; }
  if (x < C.bounds.x0 - 45 || x > C.bounds.x1 + 45 || z < C.bounds.z0 - 45 || z > C.bounds.z1 + 45) return hill;
  const hit = C.project(x, z, -1, _h);
  if (!hit || hit.d > FLAT + FALL) return hill;
  // carve: the ground follows the circuit near it (a little below the asphalt), the hill beyond
  let w = 1 - sstep(FLAT, FLAT + FALL, hit.d);
  w *= 1 - hit.br;
  w *= sstep(0, 22, Math.hypot(Math.max(0, x - 238), Math.max(0, -114 - z)) + 6);
  const ty = hit.y - 0.32 - Math.abs(hit.bank) * (C.HW + C.KERB);
  let h = hill + (Math.max(ty, 0) - hill) * w;
  // never above the ribbon (or the bridge deck) near the road, whatever the hills or the bridge blend do
  if (hit.d < C.HW + C.WALL + 1.2) { const cap = hit.y - Math.abs(hit.bank) * Math.min(Math.abs(hit.lat), C.HW + C.KERB) - 0.22; if (h > cap) h = cap; }
  return h < 0 ? 0 : h;
}
