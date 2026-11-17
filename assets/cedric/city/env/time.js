// The evening clock: golden -> sunset -> blue -> night, then it holds. `phase` runs 0..3 and every
// look parameter is interpolated between the four keys. The sun sets in the west (-X).
import * as THREE from "../core/three.js";

export const PHASES = ["golden", "sunset", "blue", "night"];
const DURATION = [480, 360, 240]; // seconds: golden -> sunset, sunset -> blue, blue -> night
const SUN_AZ = Math.PI - 0.12;    // a touch south of due west, so the pier points just left of the sun
const D2R = Math.PI / 180;

const KEYS = [
  { elev: 14, sunCol: [1.35, 0.98, 0.66], amb: [0.42, 0.40, 0.52], ambUp: [0.22, 0.16, 0.12],
    fogNear: [0.98, 0.74, 0.46], fogFar: [0.50, 0.42, 0.58], fogDen: 0.0042,
    skyTop: [0.16, 0.27, 0.52], skyMid: [0.66, 0.46, 0.52], skyHor: [1.0, 0.74, 0.46], glow: 0.5, lights: 0, neon: 0.12, stars: 0 },
  { elev: 3, sunCol: [1.25, 0.62, 0.32], amb: [0.30, 0.27, 0.46], ambUp: [0.25, 0.10, 0.12],
    fogNear: [0.96, 0.45, 0.20], fogFar: [0.15, 0.11, 0.25], fogDen: 0.0065,
    skyTop: [0.04, 0.06, 0.15], skyMid: [0.50, 0.17, 0.34], skyHor: [1.0, 0.50, 0.20], glow: 0.55, lights: 0.3, neon: 0.5, stars: 0 },
  { elev: -4, sunCol: [0.30, 0.20, 0.42], amb: [0.17, 0.16, 0.31], ambUp: [0.08, 0.06, 0.16],
    fogNear: [0.45, 0.22, 0.38], fogFar: [0.10, 0.09, 0.22], fogDen: 0.0072,
    skyTop: [0.02, 0.03, 0.11], skyMid: [0.15, 0.10, 0.32], skyHor: [0.55, 0.24, 0.36], glow: 0.3, lights: 0.85, neon: 0.9, stars: 0.45 },
  { elev: -12, sunCol: [0.10, 0.17, 0.28], amb: [0.075, 0.095, 0.18], ambUp: [0.03, 0.04, 0.09],
    fogNear: [0.07, 0.09, 0.19], fogFar: [0.03, 0.04, 0.09], fogDen: 0.0085,
    skyTop: [0.005, 0.01, 0.04], skyMid: [0.02, 0.03, 0.10], skyHor: [0.08, 0.08, 0.22], glow: 0.05, lights: 1, neon: 1, stars: 1 },
];

const smooth = x => x * x * (3 - 2 * x);
const mix3 = (out, a, b, f) => out.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);

// Start phase from the local clock: 06-16 golden, 16-20 sunset, 20-23 blue, 23-06 night.
export function phaseFromClock(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= 6 && h < 16 ? 0 : h >= 16 && h < 20 ? 1 : h >= 20 && h < 23 ? 2 : 3;
}

export function createTime(g, opts = {}) {
  const V = () => new THREE.Vector3();
  const p = {
    elev: 0, fogDen: 0, glow: 0, lights: 0, neon: 0, stars: 0, disc: 1,
    sunCol: V(), amb: V(), ambUp: V(), fogNear: V(), fogFar: V(), skyTop: V(), skyMid: V(), skyHor: V(),
  };
  const sunDir = V(), lightDir = V(), moon = new THREE.Vector3(-0.35, 0.75, 0.45).normalize(), _l = V();
  const api = {
    name: "time", p, sunDir, lightDir, frozen: !!opts.frozen, phase: opts.phase == null ? phaseFromClock() : opts.phase,
    set(v) { api.phase = typeof v === "string" ? Math.max(0, PHASES.indexOf(v)) : Math.max(0, Math.min(3, v)); evaluate(); },
    get index() { return Math.round(api.phase); },
    get label() { return PHASES[Math.round(api.phase)]; },
    init() { evaluate(); },
    update(dt) {
      if (!api.frozen && api.phase < 3) api.phase = Math.min(3, api.phase + dt / DURATION[Math.min(2, Math.floor(api.phase))]);
      evaluate();
    },
    dispose() {},
  };

  function evaluate() {
    const i = Math.min(2, Math.floor(api.phase)), f = smooth(Math.min(1, api.phase - i));
    const a = KEYS[i], b = KEYS[i + 1];
    p.elev = a.elev + (b.elev - a.elev) * f;
    p.fogDen = a.fogDen + (b.fogDen - a.fogDen) * f;
    p.glow = a.glow + (b.glow - a.glow) * f;
    p.lights = a.lights + (b.lights - a.lights) * f;
    p.neon = a.neon + (b.neon - a.neon) * f;
    p.stars = a.stars + (b.stars - a.stars) * f;
    p.disc = smooth(Math.max(0, Math.min(1, (p.elev + 3) / 2.5)));
    for (const k of ["sunCol", "amb", "ambUp", "fogNear", "fogFar", "skyTop", "skyMid", "skyHor"]) mix3(p[k], a[k], b[k], f);
    const e = p.elev * D2R, ce = Math.cos(e);
    sunDir.set(ce * Math.cos(SUN_AZ), Math.sin(e), ce * Math.sin(SUN_AZ));
    // light comes from the sun while it is up, from a cool "moon" once it is gone
    const m = smooth(Math.max(0, Math.min(1, (2 - p.elev) / 8)));
    _l.copy(sunDir); _l.y = Math.max(_l.y, 0.06); _l.normalize();
    lightDir.copy(_l).lerp(moon, m).normalize();
  }
  evaluate();
  return api;
}
