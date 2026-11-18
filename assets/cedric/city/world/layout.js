// The city plan. Pure data, no THREE. Everything else (terrain, massing, props, camera, minimap
// later) reads this file. Metres. +X inland (east), -X the sea (west), +Z "south", -Z "north".
// Heading angles used everywhere: direction = (cos a, sin a) in the X/Z plane, so a = PI looks
// west (towards the sea and the sunset), a = PI/2 looks +Z.
//
//        sea          beach   promenade   Front de mer      Avenue du tram          Rue Basse    Rue Haute
//   x:  < -24   -24 .. -16   -16 .. -2     1 .. 11            55 .. 65             114 .. 122   172 .. 180
//
// Skyline rises with x, so the sea stays open from the street level.
import { seeded, hashStr } from "../core/rng.js";
import * as KC from "../places/karting/circuit.js"; // --- karting ---

const PI = Math.PI;
const SUN_LOOK = PI - 0.12; // looking along the pier towards the low sun

export const SEA_Y = -0.28;

// ---- coast ---------------------------------------------------------------------------------
// Shoreline x as a function of z: a base line plus two slow waves [amp, period, phase].
export const coast = { x0: -24, waves: [[2.2, 23, 0], [1.2, 9, 1]], slope: 0.035 };
export const shoreX = z => coast.x0 + coast.waves.reduce((s, w) => s + w[0] * Math.sin(z / w[1] + w[2]), 0);
// Sand height: meets the sea level exactly on the shore line, rises 3.5 cm per metre inland.
export const beachY = (x, z) => SEA_Y + (x - shoreX(z)) * coast.slope;

export const promenade = { x0: -16, x1: -2, z0: -108, z1: 108, y: 0.2 };
export const pier = { x0: -62, x1: -16, z0: -2.5, z1: 2.5, y: 0.3, axisZ: 0 }; // on the axis of Rue du Phare
export const pierEnd = { x0: -72, x1: -62, z0: -5, z1: 5 }; // platform that carries Le Phare

// ---- world limits ----------------------------------------------------------------------------
export const world = { x0: -19, x1: 230, z0: -108, z1: 108 };
// Union of walkable rectangles (Cedric hovers, but stays over land and the pier).
export const walkable = [
  { x0: -19, x1: 230, z0: -107, z1: 107 },
  { x0: -71.5, x1: -18, z0: -2.1, z1: 2.1 },
  { x0: -71.5, x1: -62, z0: -4.6, z1: 4.6 },
];

// ---- street grid -------------------------------------------------------------------------------
// axis "z": runs north-south at x = at; axis "x": runs east-west at z = at. gaps: [from, to] pieces
// that are pedestrian (the plaza). Names live in text.js.
export const streets = [
  { id: "front", axis: "z", at: 6, w: 10, from: -100, to: 100 },
  { id: "avenue", axis: "z", at: 60, w: 10, from: -100, to: 100, gaps: [[-44, -5]] },
  { id: "basse", axis: "z", at: 118, w: 8, from: -100, to: 100 },
  { id: "haute", axis: "z", at: 176, w: 8, from: -100, to: 52 }, // dead end
  { id: "phare", axis: "x", at: 0, w: 10, from: -16, to: 230 }, // pier axis
  { id: "nord", axis: "x", at: -48, w: 8, from: 1, to: 230 },
  { id: "sud", axis: "x", at: 52, w: 8, from: 1, to: 230 },
  { id: "haut", axis: "x", at: -96, w: 7, from: 60, to: 230 },
  { id: "bas", axis: "x", at: 100, w: 7, from: 1, to: 176 },
];

// Reserved lanes for later layers. Paths are [x, z] polylines.
export const lanes = {
  tram: { path: [[60, -100], [60, 100]], width: 4.4 }, // runs straight through the plaza
  bike: { path: [[-4, -104], [-4, 104]], width: 1.6 },
  boat: { path: [[-95, -110], [-95, 110]], width: 8 },
};

// ---- blocks --------------------------------------------------------------------------------------
// Block rectangles between the streets. "spec" says how a block is cut into plots.
const COLS = [[11, 55], [65, 114], [122, 172], [180, 230]];
const ROWS = [[-92.5, -52], [-44, -5], [5, 48], [56, 96.5]];
const SPEC = {
  "0,0": { axis: "z", n: 2, hero: { 0: "aquarium", 1: "basile" } }, // Chez Basile: rooftop bar on the seafront
  "0,1": { type: "plaza", x1: 65 }, // the plaza swallows the avenue crossing
  "0,2": { type: "park" },
  "0,3": { axis: "z", n: 3, hero: { 0: "arcade" } },
  "1,0": { axis: "x", n: 2, hero: { 0: "serre" } },        // La Serre fronts the avenue
  "1,1": { axis: "x", n: 1, hero: { 0: "mairie" } },
  "1,2": { axis: "g", n: 4 },
  "1,3": { axis: "x", n: 2, hero: { 0: "mediatheque" } },  // the fin wall fronts the avenue
  "2,0": { axis: "g", n: 4 },
  "2,1": { axis: "x", n: 1, hero: { 0: "terrasses" } },    // the ziggurat takes the whole block
  "2,2": { axis: "g", n: 4 },
  "3,0": { type: "track" },
  "3,1": { type: "track", skip: 4 }, // --- karting --- circuit corner; skip keeps the later plot ids stable
  "3,2": { axis: "x", n: 3, hero: { 2: "tour" } },
  "23,3": { axis: "x", n: 1, hero: { 0: "chateau" }, x0: 122, x1: 144 }, // Rue Haute dead-ends, two blocks merge; the east part is the station
};
const HERO = { // height and kind of the hand-designed plots; building = recipe name (phase 2)
  aquarium: { h: 0, kind: "empty" },
  arcade: { h: 6, kind: "leisure", building: "arcade" },
  serre: { h: 14, kind: "culture", building: "serre" },
  basile: { h: 18, kind: "leisure", building: "basile" },
  mairie: { h: 24, kind: "civic", building: "mairie" },
  mediatheque: { h: 18, kind: "culture", building: "mediatheque" },
  terrasses: { h: 32, kind: "residential", building: "terrasses" },
  tour: { h: 56, kind: "tower", building: "tour" },
  chateau: { h: 38, kind: "landmark", building: "chateau" },
};

const MARGIN = 2.5; // sidewalk between block edge and plots
const ALLEY = 3;

function buildBlocks() {
  const blocks = [], plots = [];
  let pid = 0;
  const addBlock = (id, x0, x1, z0, z1, type) => { blocks.push({ id, x0, x1, z0, z1, type }); };
  const addPlot = (rect, hero, rnd) => {
    const cx = (rect[0] + rect[1]) / 2, cz = (rect[2] + rect[3]) / 2;
    const t = Math.min(1, Math.max(0, (cx - 11) / 219)); // 0 at the sea, 1 inland
    const h = HERO[hero] ? HERO[hero].h : Math.round((7 + t * 46) * (0.75 + rnd() * 0.5));
    const kind = HERO[hero] ? HERO[hero].kind : (t < 0.25 ? "commerce" : t < 0.55 ? "culture" : t < 0.8 ? "residential" : "tower");
    plots.push({
      id: hero || "p" + String(++pid).padStart(2, "0"), x: cx, z: cz, w: rect[1] - rect[0], d: rect[3] - rect[2],
      rot: 0, kind, building: hero && HERO[hero].building || null, h, variant: Math.floor(rnd() * 12),
    });
  };
  // Split [a, b] into n parts with random weights and alleys between them.
  const split = (a, b, n, rnd) => {
    const free = b - a - ALLEY * (n - 1), ws = [];
    let sum = 0;
    for (let i = 0; i < n; i++) { ws.push(0.8 + rnd() * 0.45); sum += ws[i]; }
    const out = [];
    let p = a;
    for (let i = 0; i < n; i++) { const l = free * ws[i] / sum; out.push([p, p + l]); p += l + ALLEY; }
    return out;
  };

  for (const key in SPEC) {
    const s = SPEC[key], [c, r] = key.split(",").map(Number);
    const rnd = seeded(hashStr("block" + key));
    const col = key === "23,3" ? [s.x0, s.x1] : COLS[c], row = ROWS[r];
    const x0 = col[0], x1 = s.x1 && s.type ? s.x1 : col[1], z0 = row[0], z1 = row[1];
    if (s.type) { addBlock(key, x0, x1, z0, z1, s.type); pid += s.skip || 0; continue; }
    addBlock(key, x0, x1, z0, z1, "plain");
    const ix0 = x0 + MARGIN, ix1 = x1 - MARGIN, iz0 = z0 + MARGIN, iz1 = z1 - MARGIN;
    let rects = [];
    if (s.axis === "x") rects = split(ix0, ix1, s.n, rnd).map(a => [a[0], a[1], iz0, iz1]);
    else if (s.axis === "z") rects = split(iz0, iz1, s.n, rnd).map(a => [ix0, ix1, a[0], a[1]]);
    else { // 2 x 2 grid
      const xs = split(ix0, ix1, 2, rnd), zs = split(iz0, iz1, 2, rnd);
      for (const zz of zs) for (const xx of xs) rects.push([xx[0], xx[1], zz[0], zz[1]]);
    }
    rects.forEach((rc, i) => addPlot(rc, s.hero && s.hero[i], rnd));
  }
  return { blocks, plots };
}

const built = buildBlocks();
export const blocks = built.blocks;
export const plots = built.plots;

// Plot that is not part of a block: the lighthouse at the pier end.
plots.push({ id: "phare", x: -66.5, z: 0, w: 5, d: 5, rot: 0, kind: "landmark", building: "phare", h: 24, variant: 0 });

// --- karting ---
// The circuit (places/karting/circuit.js) starts in the top-right block: pit building on the
// west of the start straight, grandstand on the east, then it leaves the city to the north and
// climbs the hills (world/hills.js). Blocks "3,0" and "3,1" are the circuit blocks.
const kb = blocks.find(b => b.id === "3,0");
plots.push({ id: "karting", x: (kb.x0 + kb.x1) / 2, z: (kb.z0 + kb.z1) / 2, w: kb.x1 - kb.x0 - 4, d: kb.z1 - kb.z0 - 4, rot: 0, kind: "leisure", building: "karting", h: 8, variant: 0 });
export const track = {
  hw: KC.HW, length: KC.LENGTH, bounds: KC.bounds, outline: KC.outline(5),
  line: { x: KC.X[0], z: KC.Z[0], hd: KC.HD[0] },
  pit: { x0: 183, x1: 193, z0: -91, z1: -62 },       // pit building, west of the straight
  stand: { x0: 218, x1: 229, z0: -91, z1: -53 },     // grandstand, east of the straight
};
// --- end karting ---

// Gare de Cédric-sur-Mer: the south-east block east of the Château d'eau. A terminus: the hall faces the
// city, three platform tracks (voies) run east and leave the map through a tunnel portal.
// Everything that places the station (recipe, flow, terrain floor, colliders) reads this.
export const station = {
  block: { x0: 146, x1: 230, z0: 56, z1: 96.5 },
  hall: { x0: 150, x1: 187, z0: 58.5, z1: 94 },
  floorY: 0.5, bed: 1.9,
  track: { x0: 187, x1: 234 },            // rails: from the buffer stops to the tunnel
  portalX: 231,
  voies: [{ n: 1, z: 65 }, { n: 2, z: 76 }, { n: 3, z: 87 }],
  // platform strips between / beside the tracks; `voies` = the tracks they serve; side of that track (-1 north, +1 south)
  platforms: [
    { id: 0, z0: 58.5, z1: 63.1, voies: [1] },
    { id: 1, z0: 66.9, z1: 74.1, voies: [1, 2] },
    { id: 2, z0: 77.9, z1: 85.1, voies: [2, 3] },
    { id: 3, z0: 88.9, z1: 94, voies: [3] },
  ],
  platX: { x0: 187, x1: 229 },
  till: { x: 161, z: 69 },               // where Cedric stands to buy a ticket
  board: { x: 172, z: 76 },               // the departures board over the concourse
};
{
  const s = station.block;
  blocks.push({ id: "gare", x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, type: "station" });
  plots.push({ id: "gare", x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, w: s.x1 - s.x0 - 5, d: s.z1 - s.z0 - 5, rot: 0, kind: "landmark", building: "gare", h: 12, variant: 0 });
}

export const plaza = blocks.find(b => b.type === "plaza");
export const park = blocks.find(b => b.type === "park");
export const plotById = id => plots.find(p => p.id === id);

// ---- places ----------------------------------------------------------------------------------------
// door: where Space works. facing: direction the entrance looks (outwards from the facade).
// enter: panel id for the HUD (phase 2); minigames come later.
function door(plot, side) {
  const hw = plot.w / 2, hd = plot.d / 2;
  if (side === "w") return { door: [plot.x - hw - 1.6, plot.z], facing: PI };
  if (side === "e") return { door: [plot.x + hw + 1.6, plot.z], facing: 0 };
  if (side === "n") return { door: [plot.x, plot.z - hd - 1.6], facing: -PI / 2 };
  return { door: [plot.x, plot.z + hd + 1.6], facing: PI / 2 };
}
function place(id, side, neon, extra) {
  const plot = plotById(id);
  return Object.assign({ id, plot: id, side, radius: 6.5, neon, enter: "panel:" + id }, door(plot, side), extra);
}
export const places = [
  place("mairie", "w", "#ffb070"), // faces the plaza
  place("arcade", "w", "#ff3fa4"),
  place("karting", "w", "#3fe6ff", { door: [195.6, -74], facing: 0 }), // --- karting --- door on the pit lane
  place("basile", "w", "#ffb03f"), // foot of the glass elevator, facing Front de mer and the sea
];
// The aquarium stays an empty fenced lot with a "Bientôt" sign facing the promenade.
// The station is a place on the map (label, neon) but not an entrance: its prompts are the till, the board and boarding.
export const gare = place("gare", "n", "#35e0c8", { door: [169, 55.2], facing: -PI / 2, radius: 0, noEnter: true });
places.push(gare);
places.push(place("serre", "s", "#9bff8a")); // --- serre --- the glasshouse door, on the street side
export const aquarium = Object.assign({ plot: "aquarium", side: "w" }, door(plotById("aquarium"), "w"));

// ---- vistas ------------------------------------------------------------------------------------------
// Boxes in which the cinematic camera frames Cedric against the scene.
// look: world heading the camera looks along. dist/height: boom behind Cedric. ahead: look-at
// distance in front of him. raise: height of the look-at point (higher = Cedric lower in frame).
export const vistas = [
  { id: "promenade", box: [-16, -2, -104, 104], blend: 5, look: SUN_LOOK, dist: 9.5, height: 3.4, ahead: 6, raise: 3.2 },
  { id: "pier", box: [-72, -16, -5, 5], blend: 4, look: SUN_LOOK, dist: 10.5, height: 3.0, ahead: 12, raise: 3.1 },
  { id: "plaza", box: [plaza.x0, plaza.x1, plaza.z0, plaza.z1], blend: 6, look: SUN_LOOK - 0.1, dist: 11, height: 4.4, ahead: 8, raise: 3.6 },
];

// ---- hologram ---------------------------------------------------------------------------------------
// The tower that projects the giant shrimp, inland of Chez Basile on its axis (Basile z ~ -63).
export const hologram = { host: "p12", length: 46, lift: 19 };

// ---- start, bench, backdrop -----------------------------------------------------------------------
export const spawn = { x: -7, z: -14, heading: PI / 2 };
export const bench = { x: -5.5, z: 36, facing: PI }; // seat on the promenade, looks at the sea
// The friends' strolling loops [x, z]: open ground only (the promenade strip between the benches
// and the lamps; the middle of the plaza between its two planter rows). Basile stays on the roof.
export const npcRoutes = {
  octave: [[-10, 2], [-10, 30], [-5.5, 30], [-5.5, 2]],
  firmin: [[20, -30], [50, -30], [50, -18], [20, -18]],
};
// Terraced megastructures beyond the east edge, closing the skyline. [x0, x1, z0, z1, tiers].
export const backdrop = [[255, 345, 20, 120, 5], [330, 420, -40, 60, 7]]; // --- karting --- the first block made way for the hills

// --- aerodrome ---
// Glider field south of the street grid (+Z), along the coast. The runway runs north-south, parallel to
// the shore; everything flies and lands heading north (-Z) into the north-west sea breeze. The raised
// promenade continues south along the shore (x -16..-2) and a service road leaves it towards the hangar.
export const aerodrome = {
  runway: { x: 14, w: 14, z0: 172, z1: 332 },
  apron: { x0: 21, x1: 34, z0: 170, z1: 236 },
  road: { z0: 144, z1: 152 },
  start: { x: 14, z: 322 },        // winch launch starts here, heading north
  touch: { x: 14, z: 300 },        // assisted landing touchdown
  winch: { x: 14, z: 158 },
  tower: { x: 31, z: 164 },
  sock: { x: 27, z: 262 },
  promenadeEnd: 342,
  bounds: { x0: -300, x1: 320, z0: -190, z1: 400 },
};
plots.push({ id: "aerodrome", x: 52, z: 204, w: 36, d: 44, rot: 0, kind: "leisure", building: "aerodrome", h: 16, variant: 0 });
places.push(place("aerodrome", "w", "#ff7a3a")); // door under the hangar's porch, facing the runway
walkable.push({ x0: -19, x1: 104, z0: 104, z1: 346 });
// --- end aerodrome ---

// --- port ---
// Le Port: a small harbour at the north end of the promenade, and the sea west of the city for sailing.
// Pure data. world/buildings/port.js builds it, places/port/* plays on it. The quay is a slab (top
// y 0.2, like the promenade) that reaches into the sea; the pontoon floats off its west face; a
// breakwater runs west from the quay's north corner, then curves south.
export const port = {
  neon: "#48e8d2",
  quay: { x0: -34, x1: 14, z0: -180, z1: -108, y: 0.2 },
  slip: { z0: -132, z1: -122, xTop: -26, xEnd: -40, yEnd: -0.78 }, // concrete slipway, runs into the water
  shed: { x0: -24, x1: -6, z0: -133, z1: -121 }, // boat shed, open to the west on the slipway
  cabin: { x: -9, z: -152, w: 7, d: 10 }, // harbour master's cabin (front looks west)
  pontoon: { y: 0.14, spine: [-42, -37.5, -173, -136], fingers: [-150, -158, -166], fingerLen: 10, fingerW: 1.4, gang: [-37.5, -34, -147.5, -144.5] }, // [x0, x1, z0, z1]
  berth: { x: -43.2, z: -141.5, heading: -PI / 2 }, // Cédric's boat lies along the south end of the spine
  stand: [-39.8, -141.5], // where Cédric steps on and off
  dock: { x: -44.5, z: -126, r: 34 }, // approach point for assisted docking
  breakwater: { y: 0.62, w: 3.6, z: -178, xRoot: -34, xEnd: -74, arc: { cx: -74, cz: -160, r: 18, from: -90, sweep: 110 } }, // arc angles in degrees, sweeping towards the south
  sail: { x0: -480, x1: -40, z0: -225, z1: 225 }, // soft limits of the open water
  bell: [-145, 18], rock: { x: -230, z: 34, r: 4.2 },
  friend: { x: -70.3, z: -3.4, heading: PI }, // a friend waves from the pier end
};
walkable.push(
  { x0: -34, x1: 14, z0: -179.6, z1: -108 }, // --- port --- the quay
  { x0: -19, x1: 14, z0: -112, z1: -103 }, // joins the quay to the city walkable area (that one starts at z -107; without this a 1 m gap walled the port off)
  { x0: -73.6, x1: -30, z0: -179.8, z1: -176.2 }, // the breakwater's straight leg (reaches into the quay so the shrunk rects overlap)
  { x0: -42, x1: -37.5, z0: -173, z1: -136 }, // pontoon spine
  { x0: -40, x1: -32, z0: -147.5, z1: -144.5 }, // gangway (overlaps quay and spine, see above)
);
world.z0 = Math.min(world.z0, -196); // charts and the big map include the harbour
plots.push({ id: "port", x: port.cabin.x, z: port.cabin.z, w: port.cabin.w, d: port.cabin.d, rot: 0, kind: "leisure", building: "port", h: 8, variant: 0 });
places.push(place("port", "w", port.neon, { door: port.stand, facing: PI, radius: 5.5 }));
// Ground height on the harbour's own surfaces, or undefined elsewhere (terrain.js asks first).
export function portGround(x, z) {
  if (x < -75 || x > 15 || z < -181 || z > -107) return undefined;
  const q = port.quay, s = port.slip, p = port.pontoon, b = port.breakwater;
  if (z >= s.z0 && z <= s.z1 && x >= s.xEnd && x < s.xTop) return q.y + (s.xTop - x) * (s.yEnd - q.y) / (s.xTop - s.xEnd);
  if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return q.y;
  if (x >= p.spine[0] && x <= p.spine[1] && z >= p.spine[2] && z <= p.spine[3]) return p.y;
  if (x >= p.gang[0] && x <= p.gang[1] && z >= p.gang[2] && z <= p.gang[3]) return q.y + (p.y - q.y) * Math.min(1, (q.x0 - x) / (q.x0 - p.gang[0]));
  if (x >= b.xEnd && x <= b.xRoot && Math.abs(z - b.z) <= b.w / 2 + 0.2) { const u = Math.min(1, Math.max(0, (b.xRoot - x) / 6)); return q.y + (b.y - q.y) * u * u * (3 - 2 * u); }
  return undefined;
}
// --- end port ---
// --- aerodrome ---
world.z1 = 352; // the maps (minimap chart, big map) reach the end of the shore walk
// --- end aerodrome ---
