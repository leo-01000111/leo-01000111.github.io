// Eco-brutalist parts. All coordinates are local to the kit frame (front = -z). Storeys sit on a
// 3.2 m grid so the shader's lit window cells line up with the glazing bands.
import { K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "./kit.js";

export const C = {
  conc: [0.53, 0.505, 0.485], light: [0.62, 0.595, 0.565], warm: [0.58, 0.51, 0.45], dark: [0.37, 0.36, 0.37],
  black: [0.105, 0.105, 0.125], wood: [0.36, 0.24, 0.16], rust: [0.46, 0.22, 0.11], soil: [0.17, 0.12, 0.09],
  steel: [0.16, 0.17, 0.19], cream: [0.78, 0.74, 0.66], glass: [0.1, 0.1, 0.12], warmLight: [1.0, 0.62, 0.3],
};
export const tint = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
export const FL = 3.2;
const gridUp = y => Math.ceil((y - 0.45) / FL) * FL;

// Storeys of solid spandrel + recessed glazing band, from y0 to y1, then a roof cap.
// o: { c, rec, sill, sides ("lrfb" = -x, +x, -z, +z get glazing), piers (spacing), cap, glassC }
export function bands(K, x0, x1, z0, z1, y0, y1, o = {}) {
  const c = o.c || C.conc, rec = o.rec == null ? 0.55 : o.rec, sill = o.sill == null ? 1.05 : o.sill;
  const sides = o.sides == null ? "lrfb" : o.sides, cap = o.cap == null ? 0.45 : o.cap;
  const ix0 = x0 + (sides.includes("l") ? rec : 0), ix1 = x1 - (sides.includes("r") ? rec : 0);
  const iz0 = z0 + (sides.includes("f") ? rec : 0), iz1 = z1 - (sides.includes("b") ? rec : 0);
  let y = gridUp(y0), end = y0;
  if (y > y0 + 0.05) { K.box(x0, x1, y0, Math.min(y, y1), z0, z1, c, K_RAW); end = Math.min(y, y1); }
  while (y + 1.9 <= y1 + 0.01) {
    const top = Math.min(y + FL, y1), s = Math.max(y, y0);
    K.box(x0, x1, s, y + sill, z0, z1, c, K_RAW);
    if (sides) {
      K.box(ix0, ix1, y + sill, top, iz0, iz1, o.glassC || C.glass, K_GLASS, false);
      if (o.piers && rec > 0.2) piers(K, x0, x1, z0, z1, ix0, ix1, iz0, iz1, y + sill, top, o.piers, sides, c);
    } else K.box(x0, x1, y + sill, top, z0, z1, c, K_RAW, false);
    end = top;
    y += FL;
  }
  if (end < y1 - 0.01) { K.box(x0, x1, end, y1, z0, z1, c, K_RAW); end = y1; }
  const top = end;
  if (cap > 0) K.box(x0 - (o.over || 0), x1 + (o.over || 0), top, top + cap, z0 - (o.over || 0), z1 + (o.over || 0), c, K_RAW, true);
  return top + cap;
}

function piers(K, x0, x1, z0, z1, ix0, ix1, iz0, iz1, y0, y1, sp, sides, c) {
  const w = 0.17;
  if (sides.includes("f") || sides.includes("b")) {
    const n = Math.max(1, Math.round((x1 - x0) / sp));
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      if (sides.includes("f")) K.box(x - w, x + w, y0, y1, z0, iz0, c, K_RAW, false);
      if (sides.includes("b")) K.box(x - w, x + w, y0, y1, iz1, z1, c, K_RAW, false);
    }
  }
  if (sides.includes("l") || sides.includes("r")) {
    const n = Math.max(1, Math.round((z1 - z0) / sp));
    for (let i = 1; i < n; i++) {
      const z = z0 + (z1 - z0) * i / n;
      if (sides.includes("l")) K.box(x0, ix0, y0, y1, z - w, z + w, c, K_RAW, false);
      if (sides.includes("r")) K.box(ix1, x1, y0, y1, z - w, z + w, c, K_RAW, false);
    }
  }
}

// Low wall ring round a roof or terrace.
export function parapet(K, x0, x1, z0, z1, y, h = 0.95, t = 0.25, c = C.conc, skip = "") {
  if (!skip.includes("f")) K.box(x0, x1, y, y + h, z0, z0 + t, c, K_RAW, false);
  if (!skip.includes("b")) K.box(x0, x1, y, y + h, z1 - t, z1, c, K_RAW, false);
  if (!skip.includes("l")) K.box(x0, x0 + t, y, y + h, z0 + t, z1 - t, c, K_RAW, false);
  if (!skip.includes("r")) K.box(x1 - t, x1, y, y + h, z0 + t, z1 - t, c, K_RAW, false);
}

// Concrete planter with soil and a flora bed. Optional vines over one outer side ("f", "b", "l", "r").
export function planter(K, x0, x1, z0, z1, y, o = {}) {
  const h = o.h || 0.6, t = o.t || 0.2, c = o.c || C.conc;
  parapet(K, x0, x1, z0, z1, y, h, t, c);
  K.box(x0 + t, x1 - t, y, y + h - 0.12, z0 + t, z1 - t, C.soil, K_PLAIN, false);
  K.bed(x0 + t, x1 - t, z0 + t, z1 - t, y + h - 0.12, o.d == null ? 1 : o.d);
  if (o.vines) vinesOver(K, x0, x1, z0, z1, y + h, o.vines, o.len || 4, o.dens || 0.5);
}

// Vine anchors spilling over an edge of a rectangle at height y.
export function vinesOver(K, x0, x1, z0, z1, y, side, len = 4, dens = 0.5) {
  const r = K.rnd, along = side === "f" || side === "b";
  const a0 = along ? x0 : z0, a1 = along ? x1 : z1;
  for (let a = a0 + 0.4; a < a1 - 0.6; a += 0.9 + r() * 1.6) {
    if (r() > dens) continue;
    const w = 0.7 + r() * 1.3, l = len * (0.35 + r() * 0.75), m = Math.min(a + w / 2, a1 - 0.3);
    if (side === "f") K.vine(m, y, z0 - 0.06, 0, -1, w, l);
    else if (side === "b") K.vine(m, y, z1 + 0.06, 0, 1, w, l);
    else if (side === "l") K.vine(x0 - 0.06, y, m, -1, 0, w, l);
    else K.vine(x1 + 0.06, y, m, 1, 0, w, l);
  }
}

// Columns: list of [x, z]. shape "sq" | "round" | "mush" (flares to a capital).
export function pilotis(K, pts, y0, y1, r = 0.35, shape = "round", c = C.conc) {
  for (const [x, z] of pts) {
    if (shape === "sq") K.box(x - r, x + r, y0, y1, z - r, z + r, c, K_RAW);
    else if (shape === "mush") { K.cyl(x, z, y0, y1 - 0.8, r, r * 1.15, 10, c, K_RAW); K.cyl(x, z, y1 - 0.8, y1, r * 1.15, r * 2.4, 10, c, K_RAW); }
    else K.cyl(x, z, y0, y1, r, r, 10, c, K_RAW);
  }
}

// Vertical fins on the front plane z (they stick out towards -z by depth), angle per fin.
export function fins(K, x0, x1, z, y0, y1, n, depth, t, angle = () => 0, c = C.conc) {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n, a = angle(i / Math.max(1, n - 1));
    K.obox(x, z - depth / 2, t / 2, depth / 2, a, y0, y1, c, K_RAW);
  }
}

// Egg-crate frame in front of the plane z: vertical members every cw, slabs on every storey line.
export function crate(K, x0, x1, z, y0, y1, depth, cw, c = C.conc) {
  const n = Math.max(1, Math.round((x1 - x0) / cw));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; K.box(x - 0.16, x + 0.16, y0, y1, z - depth, z, c, K_RAW); }
  for (let y = gridUp(y0); y <= y1 - 1; y += FL) K.box(x0 - 0.16, x1 + 0.16, y + 0.75, y + 1.05, z - depth, z, c, K_RAW);
}

// Monumental stair rising towards +z, from (z0, y0) to (z1, y1).
export function stairs(K, x0, x1, z0, z1, y0, y1, n, c = C.light) {
  for (let i = 0; i < n; i++) {
    const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n;
    K.box(x0, x1, y0, y0 + (y1 - y0) * (i + 1) / n, za, zb, c, K_RAW, false);
  }
}

// Round external stair core with a helix of lit slit windows and a cap.
export function stairCore(K, x, z, r, y0, y1, c = C.conc) {
  K.cyl(x, z, y0, y1, r, r, 14, c, K_RAW);
  K.cyl(x, z, y1, y1 + 0.5, r + 0.25, r + 0.25, 14, c, K_RAW);
  let a = K.rnd() * 6;
  for (let y = y0 + 1.6; y < y1 - 1.2; y += 0.85) {
    a += 0.62;
    const px = x + Math.cos(a) * (r + 0.01), pz = z + Math.sin(a) * (r + 0.01);
    K.obox(px, pz, 0.05, 0.16, a, y, y + 0.75, C.warmLight, K_LAMP);
  }
}

// Roof garden: parapet, planters with trees and shrubs, a pergola of thin beams.
export function roofGarden(K, x0, x1, z0, z1, y, o = {}) {
  const r = K.rnd, c = o.c || C.conc;
  parapet(K, x0, x1, z0, z1, y, 0.9, 0.25, c);
  if (o.vines !== false) for (const s of "fblr") if (r() < 0.6) vinesOver(K, x0, x1, z0, z1, y + 0.9, s, o.len || 5, 0.45);
  const w = x1 - x0, d = z1 - z0;
  if (w < 4 || d < 4) return;
  const pw = Math.min(2.2, w * 0.3), pd = Math.min(2.2, d * 0.3);
  planter(K, x0 + 0.5, x0 + 0.5 + pw, z0 + 0.5, z1 - 0.5, y, { h: 0.7, c });
  if (r() < 0.8) K.tree(x0 + 0.5 + pw / 2, y + 0.58, z0 + d * (0.3 + r() * 0.4), 0.55 + r() * 0.3, o.sp);
  if (w > 9) {
    planter(K, x1 - 0.5 - pw, x1 - 0.5, z0 + 0.5, z0 + 0.5 + pd * 1.6, y, { h: 0.7, c });
    if (r() < 0.7) K.tree(x1 - 0.5 - pw / 2, y + 0.58, z0 + 0.5 + pd * 0.8, 0.5 + r() * 0.3, o.sp);
  }
  if (o.pergola !== false && w > 7 && d > 6) {
    const px0 = x0 + 1 + pw, px1 = Math.min(x1 - 1, px0 + 6), pz0 = z1 - 0.6 - Math.min(5, d * 0.45), pz1 = z1 - 0.6;
    for (const px of [px0, px1]) for (const pz of [pz0, pz1]) K.box(px - 0.12, px + 0.12, y, y + 2.6, pz - 0.12, pz + 0.12, C.steel, K_PLAIN);
    for (let px = px0; px <= px1 + 0.01; px += 0.8) K.box(px - 0.05, px + 0.05, y + 2.6, y + 2.75, pz0 - 0.3, pz1 + 0.3, C.wood, K_PLAIN);
    K.bed(px0, px1, pz1 - 0.6, pz1 - 0.1, y, 0.6);
  }
  K.bed(x0 + 0.8, x1 - 0.8, z1 - 1.2, z1 - 0.4, y, 0.3);
}

// Stepped planted terraces: each tier is a banded volume, setbacks per side per tier
// ({ l, r, f, b }). Edge planters, vines and some trees on every exposed terrace.
export function stepped(K, x0, x1, z0, z1, y0, tiers, storeys, set, o = {}) {
  const r = K.rnd;
  let a = x0, b = x1, c = z0, d = z1, y = y0;
  for (let t = 0; t < tiers; t++) {
    const top = bands(K, a, b, c, d, y, gridUp(y) + storeys * FL, Object.assign({ cap: 0.4 }, o, { sides: o.sides || "lrfb" }));
    const na = a + (set.l || 0), nb = b - (set.r || 0), nc = c + (set.f || 0), nd = d - (set.b || 0);
    const last = t === tiers - 1 || nb - na < 4 || nd - nc < 4;
    if (last) { roofGarden(K, a, b, c, d, top, { c: o.c, sp: o.sp }); return { a, b, c, d, y: top }; }
    // terrace planters along each side that steps back
    const pc = { h: 0.6, c: o.c, len: storeys * FL * 0.9, dens: 0.55 };
    if ((set.f || 0) > 1.2) { planter(K, a, b, c, c + Math.min(1.2, set.f - 0.4), top, Object.assign({ vines: "f" }, pc)); if (r() < 0.5) K.tree(a + (b - a) * r(), top + 0.48, c + 0.6, 0.45 + r() * 0.25, o.sp); }
    if ((set.b || 0) > 1.2) planter(K, a, b, d - Math.min(1.2, set.b - 0.4), d, top, Object.assign({ vines: "b" }, pc));
    if ((set.l || 0) > 1.2) planter(K, a, a + Math.min(1.2, set.l - 0.4), c + 1.3, d - 1.3, top, Object.assign({ vines: "l" }, pc));
    if ((set.r || 0) > 1.2) planter(K, b - Math.min(1.2, set.r - 0.4), b, c + 1.3, d - 1.3, top, Object.assign({ vines: "r" }, pc));
    a = na; b = nb; c = nc; d = nd; y = top;
  }
  return { a, b, c, d, y };
}

// Thin cantilevered canopy with an optional neon strip along its outer (front) edge.
export function canopy(K, x0, x1, z0, z1, y, t = 0.22, neon) {
  K.box(x0, x1, y, y + t, z0, z1, C.conc, K_RAW, true);
  if (neon) K.box(x0, x1, y - 0.07, y, z0, z0 + 0.1, neon, K_NEON, true);
}

// Enclosed sky bridge between two volumes, along x.
export function bridge(K, x0, x1, z0, z1, y, h = 3.2) {
  K.box(x0, x1, y, y + 0.5, z0, z1, C.conc, K_RAW, true);
  K.box(x0, x1, y + 0.5, y + h - 0.4, z0 + 0.3, z1 - 0.3, C.glass, K_GLASS, false);
  K.box(x0, x1, y + h - 0.4, y + h, z0, z1, C.conc, K_RAW, true);
}
