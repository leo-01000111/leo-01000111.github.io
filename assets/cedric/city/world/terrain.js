// Ground: outskirts, asphalt, sidewalk blocks, plaza, park, promenade, beach, pier, karting track.
// One merged build, chunked. Also answers groundY(x, z) for Cedric and the camera.
import * as THREE from "../core/three.js";
import { Buf } from "../core/buf.js";
import { seeded } from "../core/rng.js";
import * as L from "./layout.js";
import * as Hills from "./hills.js"; // --- karting ---

const ASPH = [0.065, 0.065, 0.085], WALK = [0.24, 0.23, 0.24], SAND = [0.50, 0.36, 0.26], WET = [0.32, 0.24, 0.20];
const CONC = [0.42, 0.40, 0.40], GRASS = [0.10, 0.26, 0.14], WOOD = [0.28, 0.20, 0.15], DARK = [0.16, 0.15, 0.16];
const tint = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

export function createTerrain(g) {
  let group;
  const coll = g.world.collide;

  function groundY(x, z) {
    const fl = g.world.floorAt && g.world.floorAt(x, z); // raised station floor (set by the station recipe)
    if (fl != null) return fl;
    // --- port --- harbour surfaces (quay, pontoon, slipway, breakwater walk)
    const py = L.portGround(x, z); if (py !== undefined) return py;
    const P = L.pier, E = L.pierEnd;
    if ((x >= P.x0 && x <= P.x1 && Math.abs(z) <= P.z1 + 0.3) || (x >= E.x0 && x <= E.x1 && Math.abs(z) <= E.z1)) return P.y;
    if (x < L.promenade.x0) return Math.max(L.beachY(x, z), L.SEA_Y);
    if (x < L.promenade.x1) return L.promenade.y;
    for (const b of L.blocks) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.type === "park" ? 0.22 : 0.15;
    return Hills.height(x, z); // --- karting --- the hills north and east of the city (0 inside it)
  }
  g.world.groundY = groundY;

  function build() {
    const B = new Buf(96), rnd = seeded(77);

    // outskirts and asphalt
    B.flat(-16, 520, -420, 420, -0.06, [0.05, 0.065, 0.06]);
    B.flat(-14, 234, -112, 112, 0, ASPH);

    // sidewalk blocks, with a little tone variation
    for (const b of L.blocks) {
      const v = 0.92 + rnd() * 0.16;
      if (b.type === "plaza") {
        B.box(b.x0, b.x1, -0.02, 0.15, b.z0, b.z1, tint([0.34, 0.31, 0.31], 1), 1);
        for (let x = b.x0 + 4; x < b.x1; x += 4) B.flat(x - 0.06, x + 0.06, b.z0, b.z1, 0.152, [0.24, 0.22, 0.23]);
        for (let z = b.z0 + 4; z < b.z1; z += 4) B.flat(b.x0, b.x1, z - 0.06, z + 0.06, 0.152, [0.24, 0.22, 0.23]);
      } else if (b.type === "park") {
        B.box(b.x0, b.x1, -0.02, 0.15, b.z0, b.z1, WALK, 1);
        B.box(b.x0 + 1.5, b.x1 - 1.5, 0.15, 0.22, b.z0 + 1.5, b.z1 - 1.5, tint(GRASS, 1), 1);
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        B.flat(cx - 1.2, cx + 1.2, b.z0 + 1.5, b.z1 - 1.5, 0.225, [0.40, 0.31, 0.22]); // paths
        B.flat(b.x0 + 1.5, b.x1 - 1.5, cz - 1.2, cz + 1.2, 0.226, [0.40, 0.31, 0.22]);
      } else {
        B.box(b.x0, b.x1, -0.02, 0.15, b.z0, b.z1, tint(WALK, v), 1);
      }
    }

    // lane dashes along streets, skipping crossings and the plaza
    for (const s of L.streets) {
      for (let a = s.from + 6; a < s.to - 3; a += 7) {
        let skip = false;
        const x = s.axis === "z" ? s.at : a, z = s.axis === "z" ? a : s.at;
        for (const o of L.streets) {
          if (o === s || o.axis === s.axis) continue;
          const ox = o.axis === "z" ? o.at : null, oz = o.axis === "x" ? o.at : null;
          if (ox !== null && Math.abs(x - ox) < o.w / 2 + 2 && z >= o.from && z <= o.to) skip = true;
          if (oz !== null && Math.abs(z - oz) < o.w / 2 + 2 && x >= o.from && x <= o.to) skip = true;
        }
        if (s.gaps) for (const gp of s.gaps) if (a > gp[0] - 2 && a < gp[1] + 2) skip = true;
        if (skip) continue;
        if (s.axis === "z") B.flat(x - 0.09, x + 0.09, z - 1.5, z + 1.5, 0.012, [0.5, 0.45, 0.34]);
        else B.flat(x - 1.5, x + 1.5, z - 0.09, z + 0.09, 0.012, [0.5, 0.45, 0.34]);
      }
    }

    // promenade: raised concrete with expansion joints, and a darker kerb on the sea side
    const P = L.promenade;
    B.box(P.x0, P.x1, -0.1, P.y, P.z0, P.z1, CONC, 1);
    B.flat(P.x0, P.x0 + 0.5, P.z0, P.z1, P.y + 0.002, tint(CONC, 0.7));
    for (let z = P.z0; z < P.z1; z += 6) B.flat(P.x0, P.x1, z - 0.04, z + 0.04, P.y + 0.002, tint(CONC, 0.7));
    B.flat(P.x1 - 0.4, P.x1, P.z0, P.z1, P.y + 0.002, tint(CONC, 0.8));

    // beach: a strip of quads that follows the shore line, vertices shared between rows
    const COLS = 9, rows = [];
    for (let z = -240; z <= 240; z += 4) {
      const row = [], s = L.shoreX(z);
      for (let j = 0; j <= COLS; j++) {
        const x = (s - 6) + (P.x0 - (s - 6)) * (j / COLS);
        row.push([x, L.beachY(x, z), z]);
      }
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < COLS; j++) {
        const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j + 1], d = rows[i + 1][j];
        const off = (a[0] + c[0]) / 2 - L.shoreX((a[2] + c[2]) / 2); // metres inland of the waterline
        const wet = Math.max(0, 1 - Math.max(0, off) / 3);
        const col = off < 0 ? tint(WET, 0.8) : [SAND[0] + (WET[0] - SAND[0]) * wet, SAND[1] + (WET[1] - SAND[1]) * wet, SAND[2] + (WET[2] - SAND[2]) * wet];
        B.quadP(a, d, c, b, tint(col, 0.94 + ((i * 7 + j * 3) % 5) * 0.025), 1);
      }
    }

    // pier: deck, plank lines, piles, railings, end platform
    const Pr = L.pier, E = L.pierEnd;
    B.box(Pr.x0, Pr.x1 + 0.5, 0, Pr.y, Pr.z0, Pr.z1, WOOD, 1);
    B.box(E.x0, E.x1, 0, Pr.y, E.z0, E.z1, WOOD, 1);
    for (let x = E.x0; x < Pr.x1; x += 1.2) B.flat(x, x + 0.06, x < E.x1 ? -E.z1 : -Pr.z1, x < E.x1 ? E.z1 : Pr.z1, Pr.y + 0.002, tint(WOOD, 0.6));
    for (let x = Pr.x0 + 3; x < Pr.x1; x += 6) for (const sz of [-1, 1]) B.box(x - 0.25, x + 0.25, -1.6, 0, sz * 2.0 - 0.25, sz * 2.0 + 0.25, DARK, 1);
    const rail = (x0, x1, z) => { B.box(x0, x1, Pr.y, Pr.y + 1.0, z - 0.04, z + 0.04, tint(CONC, 0.8), 1); B.box(x0, x1, Pr.y + 0.95, Pr.y + 1.05, z - 0.08, z + 0.08, tint(CONC, 1), 1); };
    rail(Pr.x0, Pr.x1, -Pr.z1 + 0.05); rail(Pr.x0, Pr.x1, Pr.z1 - 0.05);
    rail(E.x0, E.x1, -E.z1 + 0.05); rail(E.x0, E.x1, E.z1 - 0.05);
    B.box(E.x0 - 0.1, E.x0 + 0.1, Pr.y, Pr.y + 1.0, -E.z1, E.z1, tint(CONC, 0.8), 1);
    for (const [z0, z1] of [[E.z0, -Pr.z1], [Pr.z1, E.z1]]) B.box(E.x1 - 0.1, E.x1 + 0.1, Pr.y, Pr.y + 1.0, z0, z1, tint(CONC, 0.8), 1);

    // --- karting --- the circuit, its lawns and the hills are built by places/karting/venue.js
    for (const id of ["2,0", "3,0", "3,1"]) { // lawn under the circuit blocks
      const kb = L.blocks.find(b => b.id === id);
      if (kb && kb.type === "track") B.box(kb.x0 + 1, kb.x1 - 1, 0.15, 0.16, kb.z0 + 1, kb.z1 - 1, [0.11, 0.19, 0.12], 1);
    }

    group = B.build(g.env.shade.world, "terrain");
    g.scene.add(group);
    g.stats.tris += B.tris;
  }

  return {
    name: "terrain",
    init() { build(); },
    update() {},
    dispose() { if (group) g.scene.remove(group); },
  };
}
