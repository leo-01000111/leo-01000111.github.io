// Season + weather. Never real weather: the pick comes from the date and a rough climate band
// guessed from the browser's time zone (no permission prompt, no network), seeded so it stays
// the same all day. Particles live on the GPU and follow the camera in a wrapped box.
import * as THREE from "../core/three.js";
import { seeded, hashStr } from "../core/rng.js";

export const KINDS = ["leaves", "mist", "clear", "snow", "stars", "petals", "shower", "rain", "fireflies"];
export const SEASONS = ["autumn", "winter", "spring", "summer"];

// ---- where are we? [latitude, band] ----------------------------------------------------------------
const ZONES = {
  "Europe/Lisbon": [39, "warm"], "Europe/Madrid": [40, "warm"], "Europe/Rome": [42, "warm"], "Europe/Athens": [38, "warm"],
  "Europe/Istanbul": [41, "warm"], "Europe/Malta": [36, "warm"], "Atlantic/Canary": [28, "warm"],
  "Europe/Oslo": [60, "cold"], "Europe/Stockholm": [59, "cold"], "Europe/Helsinki": [60, "cold"], "Europe/Moscow": [56, "cold"],
  "Europe/Tallinn": [59, "cold"], "Europe/Riga": [57, "cold"], "Atlantic/Reykjavik": [64, "cold"], "Asia/Yekaterinburg": [57, "cold"],
  "Asia/Novosibirsk": [55, "cold"], "America/Anchorage": [61, "cold"], "America/Edmonton": [53, "cold"], "America/Winnipeg": [50, "cold"],
  "America/Denver": [40, "cold"], "America/Halifax": [45, "cold"], "America/St_Johns": [48, "cold"], "Asia/Ulaanbaatar": [48, "cold"],
  "Asia/Singapore": [1, "tropical"], "Asia/Jakarta": [-6, "tropical"], "Asia/Bangkok": [14, "tropical"], "Asia/Manila": [15, "tropical"],
  "Asia/Ho_Chi_Minh": [11, "tropical"], "Asia/Kuala_Lumpur": [3, "tropical"], "Asia/Colombo": [7, "tropical"],
  "Africa/Lagos": [6, "tropical"], "Africa/Nairobi": [-1, "tropical"], "Africa/Accra": [6, "tropical"], "Africa/Dar_es_Salaam": [-7, "tropical"],
  "America/Bogota": [5, "tropical"], "America/Lima": [-12, "tropical"], "America/Caracas": [10, "tropical"], "America/Panama": [9, "tropical"],
  "America/Guayaquil": [-2, "tropical"], "Australia/Darwin": [-12, "tropical"], "Pacific/Honolulu": [21, "tropical"], "Indian/Maldives": [4, "tropical"],
  "Asia/Dubai": [25, "warm"], "Asia/Riyadh": [25, "warm"], "Asia/Kolkata": [23, "warm"], "Asia/Karachi": [25, "warm"], "Asia/Tehran": [36, "warm"],
  "Africa/Cairo": [30, "warm"], "Africa/Casablanca": [34, "warm"], "Africa/Tunis": [36, "warm"], "Africa/Algiers": [36, "warm"],
  "America/Sao_Paulo": [-23, "warm"], "America/Mexico_City": [19, "warm"], "America/Los_Angeles": [34, "warm"], "America/Phoenix": [33, "warm"],
  "America/Havana": [23, "warm"], "Australia/Perth": [-32, "warm"], "Australia/Brisbane": [-27, "warm"],
  "Asia/Tokyo": [35, "temperate"], "Asia/Seoul": [37, "temperate"], "Asia/Shanghai": [31, "temperate"], "Asia/Hong_Kong": [22, "warm"],
  "Australia/Sydney": [-34, "temperate"], "Australia/Melbourne": [-38, "temperate"], "Pacific/Auckland": [-37, "temperate"],
  "Africa/Johannesburg": [-26, "temperate"], "America/Argentina/Buenos_Aires": [-34, "temperate"], "America/Santiago": [-33, "temperate"],
};
const PREFIX = { Europe: [50, "temperate"], America: [40, "temperate"], Asia: [35, "temperate"], Africa: [5, "tropical"],
  Australia: [-30, "temperate"], Pacific: [-10, "tropical"], Atlantic: [45, "temperate"], Indian: [-5, "tropical"], Antarctica: [-75, "cold"], Arctic: [75, "cold"] };

export function locate(tz) {
  if (ZONES[tz]) return { lat: ZONES[tz][0], band: ZONES[tz][1] };
  const z = PREFIX[String(tz || "").split("/")[0]] || [48, "temperate"];
  return { lat: z[0], band: z[1] };
}

export function seasonOf(date, lat, band) {
  if (band === "tropical") return "summer"; // no autumn, no winter
  const m = (date.getMonth() + (lat < 0 ? 6 : 0)) % 12;
  return m === 11 || m < 2 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
}

// ---- weights (temperate), shifted per band -------------------------------------------------------------
function table(season, band) {
  const t = {
    autumn: { leaves: 70, mist: 20, clear: 10 },
    winter: { snow: 75, stars: 25 },
    spring: { petals: 60, clear: 25, shower: 15 },
    summer: { rain: 60, fireflies: 40 },
  }[season];
  const o = Object.assign({}, t);
  if (band === "cold") {
    if (season === "autumn") { o.mist = 35; o.leaves = 55; }
    if (season === "winter") { o.snow = 90; o.stars = 10; }
    if (season === "summer") { o.rain = 40; o.fireflies = 60; }
  } else if (band === "warm") {
    if (season === "winter") { delete o.snow; o.stars = 50; o.fireflies = 50; } // no snow: clear, with fireflies
    if (season === "spring") { o.shower = 25; o.clear = 20; o.petals = 55; }
    if (season === "summer") { o.fireflies = 55; o.rain = 45; }
  } else if (band === "tropical") {
    o.rain = 70; o.fireflies = 30;
  }
  return o;
}

export function pick(date, tz, season, band) {
  const rnd = seeded(hashStr(date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate() + "|" + tz));
  const o = table(season, band), keys = Object.keys(o);
  let sum = 0;
  for (const k of keys) sum += o[k];
  let r = rnd() * sum;
  for (const k of keys) { r -= o[k]; if (r <= 0) return k; }
  return keys[0];
}

// ---- looks -----------------------------------------------------------------------------------------------
const FOLIAGE = { autumn: [0.62, 0.19, 0.05], winter: [0.62, 0.70, 0.78], spring: [0.78, 0.42, 0.55], summer: [0.10, 0.50, 0.24] };
// fall: m/s, sway: m, drift: m/s, size: m, op: opacity, narrow: >1 = vertical streak, y: [low, high] of the box
const PRESETS = {
  leaves:    { col: [1.0, 0.60, 0.29], size: 0.42, fall: 1.3, sway: 1.6, drift: 0.35, op: 0.95, narrow: 1.5, y: [0, 22], frac: 0.45, add: 0 },
  snow:      { col: [1, 1, 1],         size: 0.26, fall: 1.1, sway: 0.7, drift: 0.30, op: 0.90, narrow: 1.0, y: [0, 24], frac: 1.0,  add: 0 },
  petals:    { col: [1.0, 0.75, 0.85], size: 0.30, fall: 0.8, sway: 1.3, drift: 0.50, op: 0.90, narrow: 1.3, y: [0, 20], frac: 0.55, add: 0 },
  rain:      { col: [0.66, 0.81, 0.90], size: 0.80, fall: 13,  sway: 0.05, drift: 0.8, op: 0.45, narrow: 7.0, y: [0, 24], frac: 1.0,  add: 0 },
  shower:    { col: [0.66, 0.81, 0.90], size: 0.70, fall: 11,  sway: 0.05, drift: 0.6, op: 0.35, narrow: 7.0, y: [0, 24], frac: 0.5,  add: 0 },
  mist:      { col: [1.0, 0.84, 0.69], size: 2.2,  fall: 0.02, sway: 0.5, drift: 0.15, op: 0.07, narrow: 1.0, y: [0.5, 9], frac: 0.3, add: 0 },
  fireflies: { col: [1.0, 0.89, 0.48], size: 0.20, fall: 0,    sway: 0.7, drift: 0.0, op: 0.95, narrow: 1.0, y: [0.4, 5], frac: 0.3,  add: 1 },
  clear:     null, stars: null,
};
const STATE = { // wet, fogMul, snow
  leaves: [0, 1.05, 0], mist: [0.2, 1.9, 0], clear: [0, 1, 0], snow: [0, 1.3, 1], stars: [0, 1, 0],
  petals: [0, 1, 0], shower: [0.55, 1.12, 0], rain: [1, 1.25, 0], fireflies: [0, 1, 0],
};
const STAR_MUL = { clear: 0.9, stars: 1.0, fireflies: 0.9, petals: 0.8, leaves: 0.7, mist: 0.2, snow: 0.3, shower: 0.35, rain: 0.2 };
const COUNT = { high: 1400, medium: 900, low: 500 };
const MAX = 1400;

export function createWeather(g, opts = {}) {
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } })();
  const loc = locate(tz), now = new Date();
  const season = opts.season || seasonOf(now, loc.lat, loc.band);
  let kind = KINDS.includes(opts.kind) ? opts.kind : pick(now, tz, season, loc.band);
  // an explicit weather without an explicit season picks the season that makes sense for it
  const state = { season, kind, snow: 0, wet: 0, fogMul: 1, starMul: 1, foliage: FOLIAGE[season].slice(), tz, band: loc.band, lat: loc.lat };
  const target = { snow: 0, wet: 0, fogMul: 1, starMul: 1 };

  const U = {
    uTime: null, uCam: { value: new THREE.Vector3() }, uScale: { value: 600 },
    uSize: { value: 0.3 }, uFall: { value: 1 }, uSway: { value: 1 }, uDrift: { value: 0.3 }, uOp: { value: 1 },
    uNarrow: { value: 1 }, uY: { value: new THREE.Vector2(0, 24) }, uCol: { value: new THREE.Vector3(1, 1, 1) },
    uPulse: { value: 0 },
  };
  let points, geo, mat, preset = null, frac = 0;
  const _sz = new THREE.Vector2(), _c = new THREE.Vector3();

  function apply(k) {
    kind = k; state.kind = k;
    const s = STATE[k];
    target.wet = s[0]; target.fogMul = s[1]; target.snow = s[2]; target.starMul = STAR_MUL[k] == null ? 1 : STAR_MUL[k];
    preset = PRESETS[k];
    if (preset) {
      U.uSize.value = preset.size; U.uFall.value = preset.fall; U.uSway.value = preset.sway; U.uDrift.value = preset.drift;
      U.uOp.value = preset.op; U.uNarrow.value = preset.narrow; U.uY.value.set(preset.y[0], preset.y[1]); U.uPulse.value = preset.add;
      mat.blending = preset.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
    setCount();
  }
  function setCount() {
    const n = preset ? Math.round((COUNT[g.quality] || 900) * preset.frac) : 0;
    frac = n;
    geo.setDrawRange(0, n);
    points.visible = n > 0;
  }

  const api = {
    name: "weather", state, kinds: KINDS,
    set(k) { if (KINDS.includes(k)) apply(k); },
    setSeason(s) { if (FOLIAGE[s]) { state.season = s; state.foliage = FOLIAGE[s].slice(); } },
    init() {
      U.uTime = g.env.shade.uniforms.uTime;
      const seed = new Float32Array(MAX * 4), rnd = seeded(1234);
      for (let i = 0; i < seed.length; i++) seed[i] = rnd();
      geo = new THREE.BufferGeometry();
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); // unused, needed for draw count
      mat = new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthWrite: false,
        vertexShader: /* glsl */`
          attribute vec4 aSeed;
          uniform float uTime,uScale,uSize,uFall,uSway,uDrift,uOp,uPulse; uniform vec3 uCam; uniform vec2 uY;
          varying float vA;
          void main(){
            float ph=aSeed.w*6.2831, H=uY.y-uY.x;
            float y=aSeed.y*H-uFall*(.7+.6*fract(aSeed.w*13.))*uTime;
            y=mod(y,H)+uY.x;
            vec2 ab=(aSeed.xz-.5)*70.+vec2(sin(uTime*.8+ph)*uSway-uDrift*uTime,cos(uTime*.6+ph*1.3)*uSway);
            vec2 q=mod(ab-uCam.xz+35.,70.)-35.;
            if(uPulse>.5) y+=sin(uTime*.35+ph*2.)*.6;
            vec4 mv=viewMatrix*vec4(uCam.x+q.x,y,uCam.z+q.y,1.);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=max(uSize*uScale/max(-mv.z,.1),1.5);
            float edge=1.-smoothstep(24.,35.,max(abs(q.x),abs(q.y)));
            float near=smoothstep(.6,2.5,-mv.z);
            float pulse=uPulse>.5?.35+.65*pow(.5+.5*sin(uTime*.9+ph*3.),2.):1.;
            vA=edge*near*uOp*pulse;
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uCol; uniform float uNarrow; varying float vA;
          void main(){
            vec2 pc=gl_PointCoord-.5;
            float r=length(vec2(pc.x*uNarrow,pc.y))*2.;
            float a=smoothstep(1.,.25,r);
            if(a<.01) discard;
            gl_FragColor=vec4(uCol,a*vA);
          }`,
      });
      points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      g.scene.add(points);
      apply(kind);
      // start settled: no fade-in from "clear" on the first frame
      state.snow = target.snow; state.wet = target.wet; state.fogMul = target.fogMul; state.starMul = target.starMul;
    },
    update(dt) {
      const a = 1 - Math.exp(-dt * 0.5);
      state.snow += (target.snow - state.snow) * a;
      state.wet += (target.wet - state.wet) * a;
      state.fogMul += (target.fogMul - state.fogMul) * a;
      state.starMul += (target.starMul - state.starMul) * a;
      if (frac !== Math.round((COUNT[g.quality] || 900) * (preset ? preset.frac : 0))) setCount();
      if (preset) {
        const tm = g.env.time.p;
        // particles are lit like the world, glowing ones are not
        const lit = preset.add ? 1 : Math.min(1.1, Math.max(0.28, (tm.amb.x + tm.amb.y + tm.amb.z) / 3 * 2.2 + (tm.sunCol.x + tm.sunCol.y + tm.sunCol.z) / 3 * 0.25));
        U.uCol.value.set(preset.col[0] * lit, preset.col[1] * lit, preset.col[2] * lit);
        U.uCam.value.copy(g.camera.position);
        g.renderer.getDrawingBufferSize(_sz);
        U.uScale.value = _sz.y * 0.5 * g.camera.projectionMatrix.elements[5];
      }
    },
    dispose() { if (points) { geo.dispose(); mat.dispose(); g.scene.remove(points); } },
  };
  return api;
}
