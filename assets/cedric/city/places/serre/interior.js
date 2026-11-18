// La Serre, inside: a glass barrel vault on a steel frame, raised concrete beds, a potting bench,
// hanging baskets, string lights. Built once, on first entry, in local coordinates (floor top at
// y = 0, room centred on the origin, door on the -z side); places/serre/index.js moves the group
// high above the plot so nothing of the street can be seen through the glass. Opaque parts use
// the world material, the glazing the glass material.
import * as THREE from "../../core/three.js";
import { Buf } from "../../core/buf.js";
import { seeded } from "../../core/rng.js";
import { createKit, K_PLAIN, K_GLASS, K_RAW, K_LAMP } from "../../world/kit/kit.js";
import { C } from "../../world/kit/parts.js";
import { GLSL_COMMON } from "../../env/shade.js";

export const HW = 8, HD = 11, WH = 3.2, RISE = 3.8; // half width, half depth, wall height, vault rise
export const BED = { hw: 1.1, hd: 1.65, h: 0.7, soil: 0.6 };
export const BED_X = [-4.2, 4.2], BED_Z = [-6.2, -2.1, 2.0, 6.1];
export const DOOR = { x: 0, z: -HD, w: 1.5, h: 3.1 };

const WOOD = [0.42, 0.28, 0.17], WOOD2 = [0.33, 0.21, 0.13], TERRA = [0.66, 0.33, 0.2], TERRA2 = [0.52, 0.25, 0.15];
const TILE = [0.2, 0.17, 0.15], PATH = [0.5, 0.36, 0.22], ZINC = [0.46, 0.52, 0.52], SOIL = [0.15, 0.1, 0.075];
const tintG = [0.55, 0.78, 0.62];

export function bedRect(i) {
  const cx = BED_X[i >> 2], cz = BED_Z[i & 3];
  return { cx, cz, x0: cx - BED.hw, x1: cx + BED.hw, z0: cz - BED.hd, z1: cz + BED.hd };
}

export function buildInterior(g) {
  const world = { collide: { addRect() {}, addCircle() {} }, anchors: [], glows: [], signs: {}, props: [] };
  const B = new Buf(1e5), BG = new Buf(1e5), K = createKit(B, world), G = createKit(BG, world);
  K.at(0, 0, 0); G.at(0, 0, 0);
  const r = seeded(4242), rl = () => r() * 0.28;
  const GREENS = [[0.12, 0.34, 0.14], [0.18, 0.44, 0.17], [0.25, 0.52, 0.2], [0.1, 0.28, 0.13]], lc = () => GREENS[Math.floor(r() * 4)]; // leaves: plain greens, so autumn and snow never touch them

  // ---- floor: dark tile, slatted aisle (hatching) ----
  K.box(-HW - 0.4, HW + 0.4, -0.4, 0, -HD - 0.4, HD + 0.4, TILE, K_PLAIN, false);
  for (let z = -HD + 2.6; z < HD - 1.5; z += 0.34) K.box(-1.5, 1.5, 0, 0.07, z, z + 0.2, PATH, K_PLAIN, false);
  K.box(-1.65, -1.5, 0, 0.07, -HD + 2.5, HD - 1.4, WOOD2, K_PLAIN, false);
  K.box(1.5, 1.65, 0, 0.07, -HD + 2.5, HD - 1.4, WOOD2, K_PLAIN, false);

  // ---- frame: knee walls, columns, ribs, purlins ----
  const zs = [-HD, -HD / 2, 0, HD / 2, HD];
  for (const s of [-1, 1]) K.box(s > 0 ? HW - 0.3 : -HW, s > 0 ? HW : -HW + 0.3, 0, 0.9, -HD, HD, C.conc, K_RAW, false);
  const arc = i => { const a = Math.PI * i / 12; return [Math.cos(a) * HW, WH + Math.sin(a) * RISE]; };
  for (const z of zs) {
    for (const s of [-1, 1]) K.box(s * HW - 0.11, s * HW + 0.11, 0.9, WH, z - 0.11, z + 0.11, C.steel, K_PLAIN, false);
    for (let i = 0; i < 12; i++) K.tube([arc(i)[0], arc(i)[1], z], [arc(i + 1)[0], arc(i + 1)[1], z], 0.09, 4, C.steel, K_PLAIN);
  }
  for (const i of [2, 4, 6, 8, 10]) K.tube([arc(i)[0], arc(i)[1], -HD], [arc(i)[0], arc(i)[1], HD], 0.06, 4, C.steel, K_PLAIN);
  K.tube([0, WH + RISE, -HD], [0, WH + RISE, HD], 0.08, 4, C.steel, K_PLAIN);
  // glass: both walls, the vault in 12 slices, the front gable around the door
  for (const s of [-1, 1]) G.box(s * (HW - 0.15) - 0.02, s * (HW - 0.15) + 0.02, 0.9, WH, -HD, HD, tintG, K_GLASS);
  for (let i = 0; i < 12; i++) {
    const [x0, y0] = arc(i), [x1, y1] = arc(i + 1);
    G.face([G.W(x0, y0, -HD), G.W(x1, y1, -HD), G.W(x1, y1, HD), G.W(x0, y0, HD)], tintG, K_GLASS);
    G.face([G.W(0, WH, -HD + 0.04), G.W(x0, y0, -HD + 0.04), G.W(x1, y1, -HD + 0.04)], tintG, K_GLASS);
  }
  const dz = -HD + 0.04;
  G.box(-HW, -DOOR.w, 0.9, WH, dz - 0.02, dz + 0.02, tintG, K_GLASS);
  G.box(DOOR.w, HW, 0.9, WH, dz - 0.02, dz + 0.02, tintG, K_GLASS);
  G.box(-DOOR.w, DOOR.w, DOOR.h, WH, dz - 0.02, dz + 0.02, tintG, K_GLASS);
  K.box(-HW, -DOOR.w, 0, 0.9, -HD - 0.3, -HD + 0.3, C.conc, K_RAW, false);
  K.box(DOOR.w, HW, 0, 0.9, -HD - 0.3, -HD + 0.3, C.conc, K_RAW, false);
  // door frame and a warm lamp over it
  K.box(-DOOR.w - 0.14, -DOOR.w + 0.06, 0, DOOR.h + 0.14, -HD - 0.1, -HD + 0.16, C.steel, K_PLAIN, false);
  K.box(DOOR.w - 0.06, DOOR.w + 0.14, 0, DOOR.h + 0.14, -HD - 0.1, -HD + 0.16, C.steel, K_PLAIN, false);
  K.box(-DOOR.w - 0.14, DOOR.w + 0.14, DOOR.h, DOOR.h + 0.14, -HD - 0.1, -HD + 0.16, C.steel, K_PLAIN, false);
  K.box(-0.5, 0.5, DOOR.h + 0.3, DOOR.h + 0.42, -HD + 0.22, -HD + 0.34, C.warmLight, K_LAMP, true);
  // back wall: concrete, wooden lattice (hatching), climbers
  K.box(-HW, HW, 0, WH + RISE + 0.2, HD, HD + 0.4, C.conc, K_RAW, false);
  for (let y = 0.5; y < 6.9; y += 0.3) K.box(-HW + 0.3, HW - 0.3, y, y + 0.05, HD - 0.07, HD, WOOD2, K_PLAIN, false);
  for (let x = -HW + 0.6; x < HW - 0.4; x += 1.3) K.box(x, x + 0.06, 0.3, 6.9, HD - 0.14, HD - 0.07, WOOD2, K_PLAIN, false);
  for (let i = 0; i < 26; i++) {
    const x = -HW + 0.7 + r() * (2 * HW - 1.4), y = 2.5 + r() * 4, w = 0.3 + r() * 0.5, h = 0.5 + r() * 1.2;
    K.box(x, x + w, y, y + h, HD - 0.3, HD - 0.14, lc(), K_PLAIN, false);
  }

  // ---- beds ----
  for (let i = 0; i < 8; i++) {
    const b = bedRect(i), t = 0.14;
    K.box(b.x0, b.x1, 0, BED.h, b.z0, b.z0 + t, C.conc, K_RAW, false); K.box(b.x0, b.x1, 0, BED.h, b.z1 - t, b.z1, C.conc, K_RAW, false);
    K.box(b.x0, b.x0 + t, 0, BED.h, b.z0 + t, b.z1 - t, C.conc, K_RAW, false); K.box(b.x1 - t, b.x1, 0, BED.h, b.z0 + t, b.z1 - t, C.conc, K_RAW, false);
    K.box(b.x0 + t, b.x1 - t, 0, BED.soil, b.z0 + t, b.z1 - t, SOIL, K_PLAIN, false);
    // cap: a rim on the walls only, 6 cm above them, so the soil shows
    const cy0 = BED.h, cy1 = BED.h + 0.06, o = 0.06, ti = t + 0.02;
    K.box(b.x0 - o, b.x1 + o, cy0, cy1, b.z0 - o, b.z0 + ti, C.light, K_RAW, true); K.box(b.x0 - o, b.x1 + o, cy0, cy1, b.z1 - ti, b.z1 + o, C.light, K_RAW, true);
    K.box(b.x0 - o, b.x0 + ti, cy0, cy1, b.z0 + ti, b.z1 - ti, C.light, K_RAW, true); K.box(b.x1 - ti, b.x1 + o, cy0, cy1, b.z0 + ti, b.z1 - ti, C.light, K_RAW, true);
    const ax = b.cx < 0 ? b.x1 : b.x0, ds = b.cx < 0 ? 1 : -1; // wooden label plate on the aisle side
    K.box(Math.min(ax, ax + ds * 0.07), Math.max(ax, ax + ds * 0.07), 0.3, 0.55, b.cz - 0.3, b.cz + 0.3, WOOD, K_PLAIN, false);
  }

  // soil in a pot: K.cyl always caps the top, so a low dark mound sits just proud of the pot's lid (r = its top radius)
  const soil = (x, z, top, r) => K.cyl(x, z, top - 0.02, top + 0.015, r * 0.84, r * 0.8, 7, SOIL, K_PLAIN, 0, false);
  // ---- potting bench against the back wall, can, pots, sacks ----
  const bz0 = HD - 1.55, bz1 = HD - 0.15;
  K.box(-3.4, 3.4, 0.96, 1.06, bz0, bz1, WOOD, K_PLAIN, true);
  for (const x of [-3.3, -1.1, 1.1, 3.3]) { K.box(x - 0.07, x + 0.07, 0, 0.96, bz0 + 0.05, bz0 + 0.19, WOOD2, K_PLAIN, false); K.box(x - 0.07, x + 0.07, 0, 0.96, bz1 - 0.19, bz1 - 0.05, WOOD2, K_PLAIN, false); }
  K.box(-3.3, 3.3, 0.3, 0.38, bz0 + 0.05, bz1 - 0.05, WOOD2, K_PLAIN, true);
  for (let i = 0; i < 6; i++) { const x = -3.1 + i * 0.5, h = 0.26 + (i % 3) * 0.04; K.cyl(x, bz1 - 0.5, 0.38, 0.38 + h, 0.16, 0.21, 7, i % 2 ? TERRA : TERRA2, K_PLAIN, 0, false); soil(x, bz1 - 0.5, 0.38 + h, 0.21); }
  for (const [x, z] of [[2.0, bz1 - 0.55], [2.6, bz1 - 0.6], [3.0, bz1 - 0.5]]) { K.cyl(x, z, 1.06, 1.32, 0.15, 0.2, 7, TERRA, K_PLAIN, 0, false); soil(x, z, 1.32, 0.2); }
  K.cyl(2.3, bz0 + 0.5, 1.06, 1.14, 0.25, 0.25, 8, SOIL, K_PLAIN, 0, false);
  K.obox(-0.2, bz0 + 0.5, 0.3, 0.2, 0.2, 1.06, 1.34, [0.62, 0.55, 0.4], K_PLAIN, false); // sack of soil
  // the watering can: zinc body, long spout, rose and handle
  const wx = -1.9, wz = bz0 + 0.6;
  K.cyl(wx, wz, 1.06, 1.46, 0.24, 0.21, 8, ZINC, K_PLAIN, 0, false);
  K.tube([wx - 0.18, 1.2, wz], [wx - 0.78, 1.7, wz], 0.04, 5, ZINC, K_PLAIN, 0.03);
  K.cyl(wx - 0.82, wz, 1.68, 1.76, 0.1, 0.1, 8, ZINC, K_PLAIN, 0, true);
  K.tube([wx + 0.2, 1.4, wz], [wx + 0.32, 1.62, wz], 0.025, 4, ZINC, K_PLAIN); K.tube([wx + 0.32, 1.62, wz], [wx + 0.05, 1.7, wz], 0.025, 4, ZINC, K_PLAIN);
  // side shelves with pots, a rain barrel by the door
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? HW - 0.95 : -HW + 0.3, x1 = s > 0 ? HW - 0.3 : -HW + 0.95;
    for (const z of [-7.4, -0.4, 6.6]) {
      K.box(x0, x1, 0.8, 0.86, z - 1.5, z + 1.5, WOOD, K_PLAIN, true);
      K.box(x0, x1, 1.5, 1.56, z - 1.5, z + 1.5, WOOD, K_PLAIN, true);
      for (let j = 0; j < 5; j++) {
        const px = (x0 + x1) / 2, pz = z - 1.2 + j * 0.6;
        K.cyl(px, pz, 0.86, 1.06, 0.12, 0.16, 6, j % 2 ? TERRA : TERRA2, K_PLAIN, 0, false); soil(px, pz, 1.06, 0.16);
        K.cyl(px, pz, 1.06, 1.28 + rl(), 0.0, 0.18, 5, lc(), K_PLAIN, 0, false);
        K.cyl(px, pz + 0.3, 1.56, 1.74, 0.12, 0.15, 6, j % 2 ? TERRA2 : TERRA, K_PLAIN, 0, false); soil(px, pz + 0.3, 1.74, 0.15);
        K.cyl(px, pz + 0.3, 1.74, 1.98 + rl(), 0.0, 0.2, 5, lc(), K_PLAIN, 0, false);
      }
      for (const zz of [z - 1.5, z + 1.5]) K.box(x0, x1, 0, 0.8, zz - 0.04, zz + 0.04, WOOD2, K_PLAIN, false);
    }
  }
  K.cyl(-6.3, -HD + 1.6, 0, 1.0, 0.55, 0.5, 10, [0.2, 0.25, 0.3], K_PLAIN, 0, false);
  K.cyl(-6.3, -HD + 1.6, 1.0, 1.04, 0.5, 0.5, 10, [0.12, 0.2, 0.28], K_PLAIN, 0, true);

  // ---- hanging baskets and trailing plants ----
  const rib = x => WH + RISE * Math.sqrt(Math.max(0, 1 - (x / HW) * (x / HW)));
  for (let i = 0; i < 10; i++) {
    const x = [-2.6, 2.6, -5.6, 5.6][i % 4], z = zs[1 + (i >> 2) % 3] + (i % 2 ? 1.6 : -1.6) * (i > 3 ? 1 : 0), y = rib(x) - 1.55 - (i % 3) * 0.25;
    K.tube([x, rib(x) - 0.05, z], [x, y + 0.5, z], 0.012, 3, C.steel, K_PLAIN);
    K.cyl(x, z, y, y + 0.34, 0.14, 0.3, 7, i % 2 ? TERRA : TERRA2, K_PLAIN, 0, false);
    K.cyl(x, z, y + 0.34, y + 0.62 + rl(), 0.28, 0.0, 6, lc(), K_PLAIN, 0, false);
    for (let j = 0; j < 4; j++) { const a = j * 1.6 + i, px = x + Math.cos(a) * 0.27, pz = z + Math.sin(a) * 0.27; K.cyl(px, pz, y - 0.35 - (j % 2) * 0.2, y + 0.3, 0.0, 0.1, 4, lc(), K_PLAIN, 0, false); }
  }
  // string lights across the aisle, a bulb every metre
  for (const z of [-HD / 2, 0, HD / 2]) {
    let px = -6.5, py = 4.1;
    for (let x = -6.5; x <= 6.51; x += 1) {
      const y = 3.55 + 0.007 * x * x;
      if (x > -6.5) K.tube([px, py, z], [x, y, z], 0.01, 3, C.black, K_PLAIN);
      K.box(x - 0.06, x + 0.06, y - 0.16, y - 0.04, z - 0.06, z + 0.06, C.warmLight, K_LAMP, true);
      px = x; py = y;
    }
  }

  const group = new THREE.Group();
  group.name = "serre-interior";
  const solid = B.build(g.env.shade.world, "serre-solid"), glass = BG.build(g.env.shade.glass, "serre-glass");
  group.add(solid, glass);
  // ground haze below the floor: from here the street 300 m down never shows through the glass
  const U = g.env.shade.uniforms;
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: "varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader: "varying vec3 vW;" + GLSL_COMMON + "void main(){ vec3 d=normalize(vW-uCam); gl_FragColor=vec4(skyColor(normalize(vec3(d.x,0.02,d.z)))*.9,1.); }",
  }));
  haze.position.y = -4; haze.frustumCulled = false;
  group.add(haze);

  // walkable area and obstacles (local x/z rectangles [x0, x1, z0, z1])
  const obstacles = [];
  for (let i = 0; i < 8; i++) { const b = bedRect(i); obstacles.push([b.x0 - 0.06, b.x1 + 0.06, b.z0 - 0.06, b.z1 + 0.06]); }
  obstacles.push([-3.4, 3.4, bz0, bz1 + 0.5]);
  for (const s of [-1, 1]) for (const z of [-7.4, -0.4, 6.6]) obstacles.push(s > 0 ? [HW - 0.95, HW, z - 1.5, z + 1.5] : [-HW, -HW + 0.95, z - 1.5, z + 1.5]);
  obstacles.push([-6.9, -5.7, -HD + 1.0, -HD + 2.2]);
  return { group, tris: B.tris + BG.tris, bounds: [-HW + 0.3, HW - 0.3, -HD + 0.3, HD - 0.3], obstacles, haze };
}
