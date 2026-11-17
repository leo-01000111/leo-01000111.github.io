// The air over the bay: a gentle north-west sea breeze, thermals over the city, ridge lift where the
// breeze meets the coast and the rising skyline, a little sink out over the cold sea. Pure data and
// functions (no THREE), shared by the flight model, the particles and the windsock.
import * as L from "../../world/layout.js";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

export const BOUNDS = L.aerodrome.bounds;
export const CEILING = 430;      // thermals die out above this (m)

// Wind direction is the heading it blows TOWARDS (atan2(z, x)): south-east, so a north-bound take-off is a head wind.
export function windAt(t, out) {
  out.dir = 1.17 + 0.32 * Math.sin(t * 0.037) + 0.16 * Math.sin(t * 0.091 + 1.3);
  out.speed = 4.6 + 1.3 * Math.sin(t * 0.052 + 0.6) + 0.5 * Math.sin(t * 0.17);
  return out;
}

// x, z centre, r core radius (m), w peak climb (m/s). Over the denser blocks of the city, one over the field.
export const THERMALS = [
  { x: 50, z: -62, r: 68, w: 3.0 },
  { x: 122, z: -22, r: 82, w: 3.5 },
  { x: 196, z: -68, r: 86, w: 3.2 },
  { x: 84, z: 44, r: 62, w: 2.8 },
  { x: 158, z: 58, r: 76, w: 3.1 },
  { x: 214, z: 16, r: 70, w: 2.7 },
  { x: 30, z: 20, r: 54, w: 2.5 },
  { x: 66, z: 286, r: 66, w: 2.4 },
];

// Centres drift a few tens of metres, slowly. The particle shader repeats this formula.
export function thermalCenter(i, t, out) {
  const th = THERMALS[i];
  out.x = th.x + Math.sin(t * 0.013 + i * 1.7) * 22;
  out.z = th.z + Math.cos(t * 0.011 + i * 2.3) * 22;
  return out;
}

const _c = { x: 0, z: 0 };
// Vertical air speed (m/s, up positive) at a point.
export function liftAt(x, y, z, t) {
  let w = 0;
  const vf = smooth(8, 70, y) * (1 - smooth(300, 430, y));
  if (vf > 0) {
    for (let i = 0; i < THERMALS.length; i++) {
      const th = THERMALS[i];
      thermalCenter(i, t, _c);
      const dx = x - _c.x, dz = z - _c.z, u = Math.sqrt(dx * dx + dz * dz) / th.r;
      if (u < 1) w += th.w * (1 - u * u) * (0.88 + 0.12 * Math.sin(t * 0.21 + i * 1.3));
      else if (u < 1.7) w -= 0.22 * th.w * Math.sin(Math.PI * (u - 1) / 0.7);
    }
    w *= vf;
  }
  // ridge lift: the onshore breeze climbs the coast and the rising skyline (x -16 .. +60), low only
  const bx = (x - 18) / 46;
  const ridge = Math.exp(-bx * bx) * smooth(-120, -80, z) * (1 - smooth(300, 360, z)) * smooth(4, 40, y) * (1 - smooth(110, 175, y));
  w += 1.9 * ridge;
  // cool sea air sinks a little, well off the coast
  w -= 0.4 * smooth(-70, -170, x) * smooth(3, 30, y);
  // soft turbulence, so the vario is never perfectly still
  w += 0.14 * Math.sin(t * 0.83 + x * 0.043 + z * 0.021) + 0.1 * Math.sin(t * 1.9 + z * 0.057 - x * 0.03);
  return w;
}
