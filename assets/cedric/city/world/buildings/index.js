// Buildings system (replaces the phase 1 massing.js): hero recipes, parametric background
// variants, the aquarium lot and the terraced backdrop, all merged per chunk through the kit.
// Fills g.world.anchors (flora), g.world.glows / signs / props / strings (props).
import { Buf } from "../../core/buf.js";
import { hex } from "../../core/buf.js";
import { seeded, hashStr } from "../../core/rng.js";
import { createKit, K_LEAF, K_WIN, K_RAW } from "../kit/kit.js";
import { C, tint } from "../kit/parts.js";
import * as L from "../layout.js";
import mairie from "./mairie.js";
import arcade from "./arcade.js";
import karting from "./karting.js";
import basile from "./basile.js";
import terrasses from "./terrasses.js";
import tour from "./tour.js";
import mediatheque from "./mediatheque.js";
import serre from "./serre.js";
import chateau from "./chateau.js";
import phare from "./phare.js";
import gare from "./gare.js";
import aquarium from "./aquarium.js";
// --- aerodrome ---
import aerodrome from "./aerodrome.js";
// --- end aerodrome ---
import { background, holoTower } from "./variants.js";
import port from "./port.js"; // --- port ---

const RECIPES = { mairie, arcade, karting, basile, terrasses, tour, mediatheque, serre, chateau, phare, gare };
// --- aerodrome ---
RECIPES.aerodrome = aerodrome;
// --- end aerodrome ---
RECIPES.port = port; // --- port ---

export function createBuildings(g) {
  const groups = [], extra = [], ups = [];
  const W = g.world;

  function backdrop(K, rnd) {
    K.at(0, 0, 0, rnd);
    for (const [x0, x1, z0, z1, n] of L.backdrop) {
      for (let t = 0; t < n; t++) {
        const s = t * 5.5;
        if (x1 - x0 - 2 * s < 8 || z1 - z0 - 2 * s < 8) break;
        const c = tint(C.conc, 0.7 + rnd() * 0.08), a = x0 + s, b = x1 - s, zc = z0 + s * 0.8, zd = z1 - s * 0.8;
        K.box(a, b, t * 16, (t + 1) * 16, zc, zd, c, K_WIN, false);
        K.box(a - 0.3, b + 0.3, (t + 1) * 16, (t + 1) * 16 + 0.8, zc - 0.3, zd + 0.3, tint(c, 0.9), K_RAW, true);
        K.box(a - 0.2, b + 0.2, (t + 1) * 16 + 0.8, (t + 1) * 16 + 1.6, zc - 0.2, zc + 1.2, [rnd(), 0, 0], K_LEAF, false);
      }
    }
  }

  return {
    name: "buildings",
    init() {
      W.anchors = W.anchors || []; W.glows = W.glows || []; W.signs = W.signs || {}; W.props = W.props || []; W.strings = W.strings || [];
      const B = new Buf(96), BG = new Buf(160);
      const K = createKit(B, W), KG = createKit(BG, W);
      const neon = {};
      for (const pl of L.places) neon[pl.id] = hex(pl.neon);
      let tris = 0;
      const X = {
        g, L, neon, glass: KG, world: W,
        add(obj, meshes) { g.scene.add(obj); extra.push({ obj, meshes: meshes || [] }); },
        onUpdate(fn) { ups.push(fn); },
        stats(n) { tris += n; },
      };
      W.variants = {};
      // background plots next to the two tall landmarks stay low so their silhouettes read
      const marks = ["chateau", "tour"].map(id => L.plotById(id));
      const lowered = p => marks.some(m => Math.hypot(m.x - p.x, m.z - p.z) < 36) ? Object.assign({}, p, { h: Math.min(p.h, 24) }) : p;
      for (const p0 of L.plots) {
        const p = RECIPES[p0.building] || p0.id === "aquarium" ? p0 : lowered(p0);
        X.rnd = seeded(hashStr(p.id));
        if (p.id === "aquarium") aquarium(K, p, X);
        else if (RECIPES[p.building]) RECIPES[p.building](K, p, X);
        else if (L.hologram && p.id === L.hologram.host) W.holoEmitter = holoTower(K, p, X);
        else W.variants[p.id] = background(K, p, X);
      }
      backdrop(K, seeded(99));
      groups.push(B.build(g.env.shade.world, "buildings"), BG.build(g.env.shade.glass, "glass"));
      for (const gr of groups) g.scene.add(gr);
      g.stats.tris += B.tris + BG.tris + tris;
      g.stats.buildingTris = B.tris + BG.tris + tris;
    },
    update(dt, t) { for (let i = 0; i < ups.length; i++) ups[i](dt, t); },
    dispose() {
      for (const gr of groups) { g.scene.remove(gr); gr.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      for (const e of extra) { g.scene.remove(e.obj); for (const m of e.meshes) { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== g.env.shade.world && m.material !== g.env.shade.glass) m.material.dispose(); } }
      groups.length = 0; extra.length = 0; ups.length = 0;
    },
  };
}
