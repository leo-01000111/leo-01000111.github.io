// Background plots: twelve parametric variants built from the same kit. The plot's kind picks a
// short list, plot.variant picks within it. Every variant faces the nearest street.
import { K_PLAIN, K_NEON, K_GLASS, K_RAW, K_LAMP } from "../kit/kit.js";
import { C, tint, FL, bands, parapet, planter, pilotis, fins, crate, stepped, stairCore, roofGarden, bridge, vinesOver, canopy } from "../kit/parts.js";

const BY_KIND = {
  commerce: [11, 0, 3, 8, 6],
  culture: [0, 4, 6, 7, 8, 3, 1],
  residential: [1, 3, 4, 5, 6, 9, 0],
  tower: [2, 5, 10, 7, 4, 8],
};
const snap = h => Math.max(2, Math.round(h / FL)) * FL;

// Which side of its block the plot is closest to (that edge is a street).
function sideOf(p, L) {
  const b = L.blocks.find(b => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1);
  if (!b) return "w";
  const d = { w: p.x - p.w / 2 - b.x0, e: b.x1 - p.x - p.w / 2, n: p.z - p.d / 2 - b.z0, s: b.z1 - p.z - p.d / 2 };
  let best = "w";
  for (const k of ["w", "n", "s", "e"]) if (d[k] < d[best] - 0.5) best = k;
  return best;
}

const V = [];
// 0: slab lifted on pilotis, glazed lobby core underneath, roof garden
V[0] = (K, hw, hd, H, c, r) => {
  const lift = 4.4, ins = 0.6;
  const pts = [];
  for (let x = -hw + 1.2; x <= hw - 1.1; x += (2 * hw - 2.4) / Math.max(1, Math.round((2 * hw - 2.4) / 6))) for (const z of [-hd + 1.2, hd - 1.2]) pts.push([x, z]);
  pilotis(K, pts, 0.15, lift, 0.42, r() < 0.5 ? "mush" : "round", c);
  for (const [x, z] of pts) K.circle(x, z, 0.5, lift);
  K.box(-hw * 0.45, hw * 0.45, 0.15, lift, -hd * 0.4, hd * 0.4, C.glass, K_GLASS, false);
  K.rect(-hw * 0.45, hw * 0.45, -hd * 0.4, hd * 0.4, H);
  K.box(-hw, hw, lift, lift + 0.6, -hd, hd, c, K_RAW, true);
  const top = bands(K, -hw + ins, hw - ins, -hd + ins, hd - ins, lift + 0.6, H, { piers: 3, c, rec: 0.7 });
  roofGarden(K, -hw + ins, hw - ins, -hd + ins, hd - ins, top, { c });
  K.box(-hw + 1, hw - 1, lift - 0.06, lift, -hd + 1, hd - 1, C.warmLight, K_LAMP, true);
};
// 1: stepped terraces towards the street
V[1] = (K, hw, hd, H, c, r) => {
  const st = 2, tiers = Math.max(2, Math.round(H / (st * FL + 0.4)));
  stepped(K, -hw, hw, -hd, hd, 0, tiers, st, { f: Math.min(2.6, (2 * hd - 6) / tiers), l: r() < 0.5 ? 1.2 : 0, r: r() < 0.5 ? 1.2 : 0 }, { c, piers: 2.8 });
  K.rect(-hw, hw, -hd, hd, H + 2);
};
// 2: tower with vertical fins on front and back, chamfered crown
V[2] = (K, hw, hd, H, c, r) => {
  const top = bands(K, -hw + 1, hw - 1, -hd + 1, hd - 1, 0, H, { piers: 0, c, rec: 0.3, sill: 0.9 });
  const n = Math.round((2 * hw - 2) / 1.6), a = (r() - 0.5) * 0.6;
  fins(K, -hw + 1, hw - 1, -hd + 1, 0.15, top - 0.6, n, 1.0, 0.22, () => a, c);
  K.at(K.ox, K.oz, K.rot + Math.PI); fins(K, -hw + 1, hw - 1, -hd + 1, 0.15, top - 0.6, n, 1.0, 0.22, () => a, c); K.at(K.ox, K.oz, K.rot - Math.PI);
  K.prism([[-hw + 1, -hd + 2.5], [-hw + 2.5, -hd + 1], [hw - 2.5, -hd + 1], [hw - 1, -hd + 2.5], [hw - 1, hd - 2.5], [hw - 2.5, hd - 1], [-hw + 2.5, hd - 1], [-hw + 1, hd - 2.5]], top, top + 3.2, tint(c, 1.05), K_RAW);
  roofGarden(K, -hw + 2.6, hw - 2.6, -hd + 2.6, hd - 2.6, top + 3.2, { c, pergola: false });
  K.rect(-hw + 1, hw - 1, -hd, hd, H + 3);
};
// 3: stacked boxes, each turned and shifted, gardens on the exposed roofs
V[3] = (K, hw, hd, H, c, r) => {
  const n = Math.max(2, Math.min(4, Math.round(H / 10))), per = snap(H / n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const wide = i % 2 === 0, sx = (r() - 0.5) * 3, sz = (r() - 0.5) * 3;
    const a = wide ? hw : hw * 0.6, b = wide ? hd * 0.65 : hd;
    const x0 = Math.max(-hw - 1.5, -a + sx), x1 = Math.min(hw + 1.5, a + sx), z0 = Math.max(-hd - 1.5, -b + sz), z1 = Math.min(hd + 1.5, b + sz);
    const top = bands(K, x0, x1, z0, z1, y, y + per, { piers: 2.6, c, cap: 0.4, rec: 0.6 });
    if (i === n - 1) roofGarden(K, x0, x1, z0, z1, top, { c });
    else { planter(K, x0, x0 + 1.2, z0, z1, top, { h: 0.6, c, vines: "l", len: per }); planter(K, x1 - 1.2, x1, z0, z1, top, { h: 0.6, c, vines: "r", len: per }); }
    if (i === 0) K.rect(x0, x1, z0, z1, H + 2);
    y = top;
  }
  K.rect(-hw, hw, -hd, hd, 2.5);
};
// 4: egg-crate frame with deep cells, some with a balcony tree
V[4] = (K, hw, hd, H, c, r) => {
  const top = bands(K, -hw + 1.2, hw - 1.2, -hd + 1.2, hd - 1.2, 0, H, { piers: 0, c, rec: 0.2 });
  crate(K, -hw + 1.2, hw - 1.2, -hd + 1.2, 0.15, top, 1.2, 2.8, c);
  K.at(K.ox, K.oz, K.rot + Math.PI); crate(K, -hw + 1.2, hw - 1.2, -hd + 1.2, 0.15, top, 1.2, 2.8, c); K.at(K.ox, K.oz, K.rot - Math.PI);
  for (let y = FL; y < top - 3; y += FL) for (let x = -hw + 2.6; x < hw - 2; x += 2.8) if (r() < 0.12) { K.tree(x, y + 1.05, -hd + 0.6, 0.32, "plane"); K.bed(x - 0.8, x + 0.8, -hd + 0.1, -hd + 1.1, y + 1.05, 0.5); }
  roofGarden(K, -hw + 1.2, hw - 1.2, -hd + 1.2, hd - 1.2, top, { c });
  K.rect(-hw, hw, -hd, hd, H + 2);
};
// 5: twin towers joined by sky bridges
V[5] = (K, hw, hd, H, c, r) => {
  const along = hw >= hd, gap = 2.4;
  const A = along ? [[-hw, -gap], [gap, hw]] : [[-hd, -gap], [gap, hd]];
  const tops = [];
  A.forEach(([a, b], i) => {
    const h = snap(H * (i ? 0.8 + r() * 0.2 : 1));
    const box = along ? [a, b, -hd + 1, hd - 1] : [-hw + 1, hw - 1, a, b];
    const top = bands(K, box[0], box[1], box[2], box[3], 0, h, { piers: 2.6, c, rec: 0.6 });
    roofGarden(K, box[0], box[1], box[2], box[3], top, { c });
    K.rect(box[0], box[1], box[2], box[3], top + 1);
    tops.push(top);
  });
  const lo = Math.min(tops[0], tops[1]);
  for (const y of [snap(lo * 0.4), snap(lo * 0.75)]) {
    if (along) bridge(K, -gap, gap, -2, 2, y, FL); else { K.at(K.ox, K.oz, K.rot + Math.PI / 2); bridge(K, -gap, gap, -2, 2, y, FL); K.at(K.ox, K.oz, K.rot - Math.PI / 2); }
  }
};
// 6: U around a planted court open to the street
V[6] = (K, hw, hd, H, c, r) => {
  const w = Math.min(6.5, hw * 0.45), h = snap(H);
  const t1 = bands(K, -hw, -hw + w, -hd, hd, 0, h, { piers: 2.6, c });
  const t2 = bands(K, hw - w, hw, -hd, hd, 0, h, { piers: 2.6, c });
  const t3 = bands(K, -hw + w, hw - w, hd - w, hd, 0, snap(h * 0.7), { piers: 2.6, c });
  roofGarden(K, -hw, -hw + w, -hd, hd, t1, { c }); roofGarden(K, hw - w, hw, -hd, hd, t2, { c });
  roofGarden(K, -hw + w, hw - w, hd - w, hd, t3, { c, pergola: false });
  vinesOver(K, -hw, -hw + w, -hd, hd, t1, "r", 9, 0.6); vinesOver(K, hw - w, hw, -hd, hd, t2, "l", 9, 0.6);
  K.bed(-hw + w + 0.8, hw - w - 0.8, -hd + 0.8, hd - w - 0.8, 0.15, 0.7);
  K.tree(0, 0.15, (hd - w - hd) / 2 - 1, 1.1, "plane");
  K.rect(-hw, -hw + w, -hd, hd, h + 1); K.rect(hw - w, hw, -hd, hd, h + 1); K.rect(-hw + w, hw - w, hd - w, hd, h + 1);
};
// 7: two-storey base with a glazed drum rising from it
V[7] = (K, hw, hd, H, c, r) => {
  const base = bands(K, -hw, hw, -hd, hd, 0, 2 * FL, { piers: 3, c, cap: 0.5 });
  roofGarden(K, -hw, hw, -hd, hd, base, { c, pergola: false });
  const R = Math.min(hw, hd) * 0.72, h = snap(H);
  let y = base;
  for (; y < h - 2; y += FL) {
    K.cyl(0, 0, y, y + 1.05, R, R, 20, c, K_RAW, 0, false);
    K.cyl(0, 0, y + 1.05, y + FL, R - 0.5, R - 0.5, 20, C.glass, K_GLASS, 0, false);
  }
  K.cyl(0, 0, y, y + 1.4, R + 0.6, R + 0.6, 20, c, K_RAW, 0, true);
  K.cyl(0, 0, y + 1.4, y + 2.1, R + 0.6, R - 1, 20, c, K_RAW);
  K.tree(0, y + 2.1, 0, 0.7, "pine");
  K.rect(-hw, hw, -hd, hd, base); K.circle(0, 0, R + 0.6, y + 2);
};
// 8: slab with round external stair cores at both ends, deep horizontal bands
V[8] = (K, hw, hd, H, c, r) => {
  const h = snap(H), rc = 1.9, x0 = -hw + 2 * rc, x1 = hw - 2 * rc;
  const top = bands(K, x0, x1, -hd + 0.5, hd - 0.5, 0, h, { piers: 3.2, c, rec: 1.0, sill: 1.15 });
  stairCore(K, -hw + rc, 0, rc, 0, h + 1.6, c); stairCore(K, hw - rc, 0, rc, 0, h + 1.6, c);
  roofGarden(K, x0, x1, -hd + 0.5, hd - 0.5, top, { c });
  K.rect(-hw, hw, -hd, hd, h + 2);
};
// 9: A-frame hill: terraces step down to the street and to the back
V[9] = (K, hw, hd, H, c, r) => {
  const tiers = Math.max(3, Math.min(7, Math.round(H / FL)));
  const s = Math.min(2.2, (hd - 2.5) / tiers);
  stepped(K, -hw, hw, -hd, hd, 0, tiers, 1, { f: s, b: s }, { c, piers: 2.9 });
  K.rect(-hw, hw, -hd, hd, tiers * FL + 2);
};
// 10: slim shaft with a cantilevered planted crown
V[10] = (K, hw, hd, H, c, r) => {
  const h = snap(H * 0.82), a = hw * 0.62, b = hd * 0.62;
  const top = bands(K, -a, a, -b, b, 0, h, { piers: 2.4, c, rec: 0.8 });
  const ct = bands(K, -hw, hw, -hd, hd, top, top + 2 * FL, { piers: 2.4, c, rec: 1.2, cap: 0.5 });
  K.box(-hw, hw, top - 0.4, top, -hd, hd, c, K_RAW, true);
  for (const s of [-1, 1]) for (const z of [-b * 0.7, b * 0.7]) K.tube([s * a, top - 5, z], [s * (hw - 0.4), top - 0.4, z], 0.28, 6, c, K_RAW);
  roofGarden(K, -hw, hw, -hd, hd, ct, { c, len: 8 });
  K.rect(-a, a, -b, b, ct + 1);
};
// 11: low commerce with a street colonnade, pergola roof and shopfront neon
V[11] = (K, hw, hd, H, c, r) => {
  const h = snap(Math.min(H, 12));
  K.box(-hw, hw, 0, 0.15, -hd, hd, C.dark, K_RAW, false);
  K.box(-hw + 0.4, hw - 0.4, 0.15, FL + 0.6, -hd + 2.6, hd - 0.4, C.glass, K_GLASS, false);
  for (let x = -hw + 0.4; x <= hw - 0.39; x += (2 * hw - 0.8) / Math.max(1, Math.round((2 * hw - 0.8) / 3.4))) { K.box(x - 0.3, x + 0.3, 0.15, FL + 0.6, -hd, -hd + 0.6, c, K_RAW); K.circle(x, -hd + 0.3, 0.45, FL + 0.6); }
  K.box(-hw, hw, FL + 0.6, FL + 1.1, -hd, hd, c, K_RAW, true);
  const neonC = [[1, 0.25, 0.65], [0.25, 0.9, 1], [1, 0.62, 0.25]][Math.floor(r() * 3)];
  if (r() < 0.6) K.box(-hw * 0.5, hw * 0.5, FL - 0.2, FL, -hd + 2.5, -hd + 2.6, neonC, K_NEON, true);
  K.box(-hw + 1, hw - 1, FL + 0.54, FL + 0.6, -hd + 0.8, -hd + 2.2, C.warmLight, K_LAMP, true);
  const top = bands(K, -hw, hw, -hd + 1.0, hd, FL + 1.1, h, { piers: 2.6, c, rec: 0.7 });
  roofGarden(K, -hw, hw, -hd + 1.0, hd, top, { c });
  planter(K, -hw, hw, -hd, -hd + 1.0, FL + 1.1, { h: 0.6, c, vines: "f", len: 2.5 });
  K.rect(-hw, hw, -hd + 2.6, hd, h + 2);
};

export function background(K, p, X) {
  const side = sideOf(p, X.L);
  K.at(p.x, p.z, side, X.rnd);
  const ew = side === "e" || side === "w", hw = (ew ? p.d : p.w) / 2, hd = (ew ? p.w : p.d) / 2;
  const list = BY_KIND[p.kind] || BY_KIND.culture, v = list[p.variant % list.length];
  const r = X.rnd, c = [C.conc, C.light, C.warm, tint(C.conc, 0.92), tint(C.warm, 1.05)][Math.floor(r() * 5)];
  V[v](K, hw, hd, p.h, c, r);
  return v;
}

// The hologram host: a tall tower with a projector ledge on its sea-facing side. Returns the
// emitter position (world) so the hologram system can sit above it.
export function holoTower(K, p, X) {
  K.at(p.x, p.z, "w", X.rnd);
  const hw = p.d / 2 - 0.5, hd = p.w / 2 - 0.5, c = C.dark, H = 57.6;
  const top = bands(K, -hw + 1, hw - 1, -hd + 1, hd - 1, 0, H, { piers: 0, c, rec: 0.3, sill: 0.9 });
  fins(K, -hw + 1, hw - 1, -hd + 1, 0.15, top - 0.5, Math.round((2 * hw - 2) / 1.6), 0.9, 0.22, () => 0, c);
  roofGarden(K, -hw + 1, hw - 1, -hd + 1, hd - 1, top, { c, pergola: false });
  // projector ledge at 38 m on the front, violet emitter strip and lenses
  const ly = 38.4;
  K.box(-hw + 0.5, hw - 0.5, ly, ly + 0.9, -hd - 4, -hd + 1, tint(c, 1.15), K_RAW, true);
  K.box(-hw + 0.5, hw - 0.5, ly + 0.9, ly + 1.8, -hd - 4, -hd - 3.8, tint(c, 1.15), K_RAW, false);
  for (let x = -3; x <= 3; x += 3) { K.cyl(x, -hd - 2, ly + 0.9, ly + 1.4, 0.7, 0.55, 10, C.steel, K_PLAIN); K.cyl(x, -hd - 2, ly + 1.4, ly + 1.48, 0.5, 0.5, 10, [0.9, 0.35, 1.0], K_NEON); }
  K.box(-hw + 0.5, hw - 0.5, ly - 0.08, ly, -hd - 4, -hd - 3.85, [0.9, 0.3, 1.0], K_NEON, true);
  for (let x = -hw + 1; x < hw - 1; x += 3) K.box(x - 0.1, x + 0.1, ly - 4, ly, -hd + 0.8, -hd + 1.0, c, K_RAW);
  K.rect(-hw, hw, -hd, hd, H + 2);
  const e = K.W(0, ly + 1.5, -hd - 2);
  return { x: e[0], y: e[1], z: e[2], facing: K.heading(0, -1) };
}
