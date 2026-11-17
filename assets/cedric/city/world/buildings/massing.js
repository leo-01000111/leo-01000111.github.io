// Phase 1 placeholder: simple stepped volumes per plot from the layout, with colliders, so the
// core can be tested. The hero buildings (phase 2) replace these recipe by recipe.
import { Buf, hex } from "../../core/buf.js";
import { seeded, hashStr } from "../../core/rng.js";
import * as L from "../layout.js";

const CONC = [0.46, 0.44, 0.44];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

export function createMassing(g) {
  let group;
  const coll = g.world.collide;

  function planter(B, x0, x1, z0, z1, y, rnd) {
    const g2 = () => [rnd(), 0, 0];
    B.box(x0, x1, y, y + 0.55, z0, z0 + 0.7, g2(), 2); B.box(x0, x1, y, y + 0.55, z1 - 0.7, z1, g2(), 2);
    B.box(x0, x0 + 0.7, y, y + 0.55, z0, z1, g2(), 2); B.box(x1 - 0.7, x1, y, y + 0.55, z0, z1, g2(), 2);
  }

  // Stepped volumes: tiers get smaller, roofs get planters, a few vines hang down the faces.
  function stepped(B, p, rnd, colour) {
    let a = p.x - p.w / 2, b = p.x + p.w / 2, c = p.z - p.d / 2, d = p.z + p.d / 2, y = 0;
    const tiers = p.h < 12 ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3);
    for (let t = 0; t < tiers; t++) {
      const th = p.h / tiers * (0.7 + rnd() * 0.6), y1 = y + th;
      B.box(a, b, y, y1, c, d, colour, 0);
      planter(B, a, b, c, d, y1, rnd);
      for (let v = 0; v < 3; v++) {
        const len = 1.5 + rnd() * Math.min(7, th * 0.8), w = 0.8 + rnd() * 1.6, side = Math.floor(rnd() * 4);
        if (side < 2) { const z = c + rnd() * Math.max(0.1, d - c - w), x = side ? b : a - 0.14; B.box(x, x + 0.14, y1 - len, y1 + 0.1, z, z + w, [rnd(), 0, 0], 2); }
        else { const x = a + rnd() * Math.max(0.1, b - a - w), z = side === 2 ? c - 0.14 : d; B.box(x, x + w, y1 - len, y1 + 0.1, z, z + 0.14, [rnd(), 0, 0], 2); }
      }
      y = y1;
      const m = () => rnd() < 0.35 ? -1.2 : 1 + rnd() * 2;
      const na = a + m(), nb = b - m(), nc = c + m(), nd = d - m();
      if (nb - na < 5 || nd - nc < 5) break;
      a = na; b = nb; c = nc; d = nd;
    }
    return y;
  }

  function neonStrip(B, x0, x1, y0, y1, z0, z1, col) { B.box(x0, x1, y0, y1, z0, z1, col, 3); }

  function aquarium(B, p) {
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
    B.box(x0, x1, 0.15, 0.17, z0, z1, [0.2, 0.19, 0.18], 1); // gravel
    const post = (x, z) => B.box(x - 0.08, x + 0.08, 0.15, 2.0, z - 0.08, z + 0.08, [0.2, 0.2, 0.22], 1);
    for (let x = x0; x <= x1 + 0.01; x += 3) { post(x, z0); post(x, z1); }
    for (let z = z0; z <= z1 + 0.01; z += 3) { post(x0, z); post(x1, z); }
    for (const y of [0.7, 1.5]) {
      B.box(x0, x1, y, y + 0.05, z0 - 0.03, z0 + 0.03, [0.28, 0.28, 0.3], 1); B.box(x0, x1, y, y + 0.05, z1 - 0.03, z1 + 0.03, [0.28, 0.28, 0.3], 1);
      B.box(x0 - 0.03, x0 + 0.03, y, y + 0.05, z0, z1, [0.28, 0.28, 0.3], 1); B.box(x1 - 0.03, x1 + 0.03, y, y + 0.05, z0, z1, [0.28, 0.28, 0.3], 1);
    }
    coll.addRect(p.x, z0, p.w / 2, 0.15, 0, 2); coll.addRect(p.x, z1, p.w / 2, 0.15, 0, 2);
    coll.addRect(x0, p.z, 0.15, p.d / 2, 0, 2); coll.addRect(x1, p.z, 0.15, p.d / 2, 0, 2);
  }

  function arcade(B, p, col) {
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
    B.box(x0, x1, 0, p.h, z0, z1, [0.13, 0.13, 0.16], 0);
    B.box(x0 - 2.6, x0, 3.6, 3.9, z0 + 0.5, z1 - 0.5, [0.2, 0.2, 0.23], 1); // long canopy
    neonStrip(B, x0 - 2.7, x0 - 2.55, 3.35, 3.6, z0 + 0.5, z1 - 0.5, col);
    neonStrip(B, x0 - 0.05, x0 + 0.02, p.h - 0.6, p.h - 0.35, z0 + 1, z1 - 1, col);
    coll.addRect(p.x, p.z, p.w / 2, p.d / 2, 0, p.h);
  }

  function basile(B, p, col) {
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2, lift = 2.4;
    for (const x of [x0 + 0.5, x1 - 0.5]) for (const z of [z0 + 0.5, z1 - 0.5, p.z]) { B.box(x - 0.2, x + 0.2, 0, lift, z - 0.2, z + 0.2, CONC, 1); coll.addCircle(x, z, 0.3, lift); }
    B.box(x0, x1, lift, lift + 3.4, z0, z1, mul(CONC, 0.95), 0);
    B.box(x1 - 0.1, x1 + 2.2, lift - 0.1, lift + 0.1, z0, z1, mul(CONC, 0.8), 1); // terrace slab on the promenade side
    B.box(x1 + 2.1, x1 + 2.2, lift + 0.1, lift + 1.1, z0, z1, mul(CONC, 0.8), 1);
    neonStrip(B, x1 - 0.05, x1 + 0.06, lift + 3.0, lift + 3.2, z0 + 0.5, z1 - 0.5, col);
    B.box(x0 - 0.3, x1 + 0.3, lift + 3.4, lift + 3.7, z0 - 0.3, z1 + 0.3, mul(CONC, 0.7), 1);
    coll.addRect(p.x, p.z, p.w / 2 - 0.3, p.d / 2 - 0.3, 0, lift + 3.7);
  }

  function mairie(B, p, rnd) {
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
    B.box(x0, x1, 0, 6, z0, z1, CONC, 0);
    B.box(x0 + 4, x1 - 4, 6, p.h, z0 + 5, z1 - 5, mul(CONC, 0.92), 0);
    for (let i = 0; i < 6; i++) B.box(x0 - 1 - i * 0.6, x0, 0, 0.5 + i * 0.5, p.z - 7, p.z + 7, mul(CONC, 1.05), 1); // stair towards the plaza
    B.box(p.x - 2, p.x + 2, p.h, p.h + 9, p.z - 2, p.z + 2, mul(CONC, 0.85), 0);        // clock tower
    planter(B, x0 + 4, x1 - 4, z0 + 5, z1 - 5, p.h, rnd);
    coll.addRect(p.x, p.z, p.w / 2, p.d / 2, 0, p.h);
  }

  function karting(B, p, col) {
    const k = L.track.pit, w = k.x1 - k.x0, d = k.z1 - k.z0;
    B.box(k.x0, k.x1, 0.15, 5, k.z0, k.z1, [0.2, 0.2, 0.23], 0);
    B.box(k.x0, k.x1 + 2, 5, 5.3, k.z0 - 0.5, k.z1 + 0.5, [0.26, 0.26, 0.29], 1);
    neonStrip(B, k.x0 - 0.05, k.x0 + 0.05, 4.1, 4.3, k.z0 + 0.5, k.z1 - 0.5, col);
    coll.addRect((k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2, w / 2, d / 2, 0, 5.3);
    // low fence round the track
    const T = L.track, N = 28;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, x = T.cx + (T.outer[0] + 1.2) * Math.cos(a), z = T.cz + (T.outer[1] + 1.2) * Math.sin(a);
      B.box(x - 0.1, x + 0.1, 0.15, 1.0, z - 0.1, z + 0.1, [0.5, 0.5, 0.52], 1);
    }
  }

  function phare(B, p, col) {
    B.frustum(p.x, p.z, 0.3, p.h - 3, 2.2, 1.2, 8, mul(CONC, 0.95), 1);
    B.box(p.x - 1.7, p.x + 1.7, p.h - 3, p.h - 2.6, p.z - 1.7, p.z + 1.7, mul(CONC, 0.7), 1);
    B.frustum(p.x, p.z, p.h - 2.6, p.h, 1.0, 1.0, 8, col, 3);
    B.frustum(p.x, p.z, p.h, p.h + 1.2, 1.4, 0, 8, mul(CONC, 0.6), 1);
    coll.addCircle(p.x, p.z, 2.3, p.h);
  }

  function backdrop(B, rnd) {
    for (const [x0, x1, z0, z1, n] of L.backdrop) {
      for (let t = 0; t < n; t++) {
        const s = t * 5.5;
        if (x1 - x0 - 2 * s < 8 || z1 - z0 - 2 * s < 8) break;
        B.box(x0 + s, x1 - s, t * 16, (t + 1) * 16, z0 + s * 0.8, z1 - s * 0.8, mul(CONC, 0.72 + rnd() * 0.08), 0);
      }
    }
  }

  return {
    name: "buildings",
    init() {
      const B = new Buf(96);
      const neon = {};
      for (const pl of L.places) neon[pl.plot] = hex(pl.neon);
      for (const p of L.plots) {
        const rnd = seeded(hashStr(p.id));
        const colour = mul(CONC, 0.82 + rnd() * 0.3);
        if (p.id === "aquarium") aquarium(B, p);
        else if (p.id === "arcade") arcade(B, p, neon.arcade);
        else if (p.id === "basile") basile(B, p, neon.basile);
        else if (p.id === "mairie") mairie(B, p, rnd);
        else if (p.id === "karting") karting(B, p, neon.karting);
        else if (p.id === "phare") phare(B, p, [1, 0.7, 0.35]);
        else {
          const top = stepped(B, p, rnd, colour);
          void top;
          coll.addRect(p.x, p.z, p.w / 2, p.d / 2, p.rot, p.h);
        }
      }
      backdrop(B, seeded(99));
      group = B.build(g.env.shade.world, "buildings");
      g.scene.add(group);
      g.stats.tris += B.tris;
    },
    update() {},
    dispose() { if (group) g.scene.remove(group); },
  };
}
