// PlaneLocate — page wiring: microphone / simulation -> pipeline -> spectrogram, passes, map.

import { Decimator, Analyzer, RidgeTracker, mergeTracks, F_MIN, F_MAX } from "./dsp.js";
import { extractEvents, passCurve, distM } from "./doppler.js";
import { FlightBuffer, LiveFeed, stateAt } from "./feed.js";
import { locate } from "./match.js";
import { rng, planSimulation, synthesize } from "./sim.js";

const $ = (id) => document.getElementById(id);
const root = $("pl-demo");
const RELAY = (root.dataset.relay || "").trim();
const BASE = new URL(".", import.meta.url);
const SIM_RATE = 8000, SIM_SPEED = 6, SPAN = 60;
const FR = (document.documentElement.lang || "").startsWith("fr");
const fmt = new Intl.NumberFormat(FR ? "fr-FR" : "en-GB");
const n = (x) => fmt.format(x);
// Every user-facing string of the demo, in the page's language.
const T = FR ? {
  searching: (k) => `Recherche parmi ${n(k)} aéronefs`,
  loading: "Chargement des données de vol enregistrées",
  placing: "Placement d'un auditeur caché et synthèse de ce qu'il entend",
  playing: (d, x) => `Lecture de ${d} s d'audio simulé en vitesse ×${x}`,
  doneFix: "Terminé : position trouvée",
  doneAmb: "Terminé : meilleure estimation, mais d'autres lieux conviennent presque aussi bien",
  doneNone: "Terminé : les passages ne s'accordent sur aucun lieu",
  hear: "Écouter", stopSound: "Arrêter le son",
  micRefused: "L'accès au micro a été refusé ou est indisponible",
  feedError: (e) => `Données de vol indisponibles : ${e}`,
  listening: "Écoute en cours. En attente du passage d'un avion",
  listeningNoRelay: "Écoute en cours. Aucun relais de données de vol : les passages sont détectés mais pas appariés",
  listeningFor: (m) => `Écoute depuis ${m} min. En attente du passage d'un avion`,
  listeningFix: (k) => `Écoute en cours. Position tirée de ${k} passages ; d'autres passages l'affineront`,
  listeningSoFar: (k) => `Écoute en cours. ${k} passage${k > 1 ? "s" : ""} pour l'instant ; une position demande deux avions`,
  stopped: "Arrêté",
  noMic: "Ce navigateur ne peut pas ouvrir le micro ici ; la simulation fonctionne quand même",
  noPasses: "Aucun passage pour l'instant.",
  places: (k) => `${n(k)} lieu${k > 1 ? "x" : ""}`,
  pinFix: "Position", pinGuess: "Estimation", pinActual: "Réelle",
  rowPasses: "Passages entendus", rowOne: "Un passage correspond à", rowFix: "Position", rowUnc: "Incertitude",
  rowAircraft: "Avions utilisés", rowFit: "Ajustement", rowConf: "Confiance", rowErr: "Écart au réel", rowNote: "Note",
  needTwo: "Il faut des passages de 2 avions ou plus", noAgree: "Les passages ne s'accordent pas",
  loose: "ajustement lâche",
  silent: (k) => `${k} passage${k > 1 ? "s" : ""} proche${k > 1 ? "s" : ""} non entendu${k > 1 ? "s" : ""}`,
  rivals: (k) => `${k} lieu${k > 1 ? "x" : ""} concurrent${k > 1 ? "s" : ""}`,
  uncertain: (w) => `Incertain : ${w}`,
  agree: (k) => `${k} passages concordent`,
} : {
  searching: (k) => `Searching ${n(k)} aircraft`,
  loading: "Loading recorded flight data",
  placing: "Placing a hidden listener and synthesising what it hears",
  playing: (d, x) => `Playing ${d} s of simulated audio at ${x}× speed`,
  doneFix: "Done: located",
  doneAmb: "Done: best guess, but other places fit almost as well",
  doneNone: "Done: the passes did not agree on one place",
  hear: "Hear it", stopSound: "Stop sound",
  micRefused: "Microphone access was refused or is unavailable",
  feedError: (e) => `Flight data unavailable: ${e}`,
  listening: "Listening. Waiting for an aircraft to pass",
  listeningNoRelay: "Listening. No flight-data relay is set up, so passes are detected but not matched",
  listeningFor: (m) => `Listening for ${m} min. Waiting for an aircraft to pass`,
  listeningFix: (k) => `Listening. Fix from ${k} passes; more passes will firm it up`,
  listeningSoFar: (k) => `Listening. ${k} pass${k > 1 ? "es" : ""} so far; a fix needs two aircraft`,
  stopped: "Stopped",
  noMic: "This browser cannot open the microphone here; the simulation still works",
  noPasses: "No passes yet.",
  places: (k) => `${n(k)} place${k === 1 ? "" : "s"}`,
  pinFix: "Fix", pinGuess: "Best guess", pinActual: "Actual",
  rowPasses: "Passes heard", rowOne: "One pass fits", rowFix: "Fix", rowUnc: "Uncertainty",
  rowAircraft: "Aircraft used", rowFit: "Fit", rowConf: "Confidence", rowErr: "Error vs actual", rowNote: "Note",
  needTwo: "Needs passes by 2+ aircraft", noAgree: "No agreement between passes",
  loose: "loose fit",
  silent: (k) => `${k} close pass${k > 1 ? "es" : ""} not heard`,
  rivals: (k) => `${k} rival place${k === 1 ? "" : "s"}`,
  uncertain: (w) => `Uncertain: ${w}`,
  agree: (k) => `${k} passes agree`,
};

// ——— Status line ———
function status(state, text) {
  const el = $("pl-status");
  el.className = `hp-lamp hp-lamp--${state}${state === "go" ? " is-live" : ""}`;
  el.querySelector("span").textContent = text;
}
function progress(frac) {
  const p = $("pl-progress");
  p.hidden = frac == null;
  if (frac != null) p.firstElementChild.style.width = `${Math.round(frac * 100)}%`;
}

// ——— Spectrogram ———
// A black plate with light ink, whatever the theme: it reads like a sign face.
const PLATE = [18, 19, 20], INK = [236, 237, 231];
class Spectrogram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rows = 220;
    this.reset(0.128);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }
  reset(dt, analyzer) {
    this.dt = dt;
    this.cap = Math.ceil(SPAN / dt) + 4;
    this.off = document.createElement("canvas");
    this.off.width = this.cap; this.off.height = this.rows;
    this.octx = this.off.getContext("2d");
    this.octx.fillStyle = `rgb(${PLATE})`;
    this.octx.fillRect(0, 0, this.cap, this.rows);
    this.col = this.octx.createImageData(1, this.rows);
    this.count = 0;
    this.tLast = null;
    this.rowBins = null;
    if (analyzer) {
      this.rowBins = [];
      for (let r = 0; r < this.rows; r++) {
        const fHi = this.fOfRow(r - 0.5), fLo = this.fOfRow(r + 0.5);
        const a = Math.max(0, Math.round(fLo / analyzer.binHz) - analyzer.kMin);
        const b = Math.min(analyzer.nb - 1, Math.max(a, Math.round(fHi / analyzer.binHz) - analyzer.kMin));
        this.rowBins.push([a, b]);
      }
    }
  }
  fOfRow(r) { return F_MAX * Math.pow(F_MIN / F_MAX, r / (this.rows - 1)); }
  yOfF(f, H) { return (Math.log(F_MAX / f) / Math.log(F_MAX / F_MIN)) * H; }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
  }
  addFrame(fr) {
    if (!this.rowBins) return;
    const d = this.col.data;
    for (let r = 0; r < this.rows; r++) {
      const [a, b] = this.rowBins[r];
      let m = -99;
      for (let i = a; i <= b; i++) if (fr.w[i] > m) m = fr.w[i];
      const v = Math.pow(Math.min(1, Math.max(0, (m - 3) / 24)), 1.1);
      d[r * 4] = PLATE[0] + v * (INK[0] - PLATE[0]);
      d[r * 4 + 1] = PLATE[1] + v * (INK[1] - PLATE[1]);
      d[r * 4 + 2] = PLATE[2] + v * (INK[2] - PLATE[2]);
      d[r * 4 + 3] = 255;
    }
    this.octx.putImageData(this.col, this.count % this.cap, 0);
    this.count++;
    this.tLast = fr.t;
  }
  draw(tracks, events) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, dpr = this.dpr;
    ctx.fillStyle = `rgb(${PLATE})`;
    ctx.fillRect(0, 0, W, H);
    if (this.tLast == null) return;
    const colW = W / (SPAN / this.dt);
    const k = Math.min(this.count, this.cap);
    const newest = (this.count - 1) % this.cap;
    const startIdx = (newest - k + 1 + this.cap) % this.cap;
    const xStart = W - k * colW;
    if (startIdx + k <= this.cap) {
      ctx.drawImage(this.off, startIdx, 0, k, this.rows, xStart, 0, k * colW, H);
    } else {
      const k1 = this.cap - startIdx;
      ctx.drawImage(this.off, startIdx, 0, k1, this.rows, xStart, 0, k1 * colW, H);
      ctx.drawImage(this.off, 0, 0, k - k1, this.rows, xStart + k1 * colW, 0, (k - k1) * colW, H);
    }
    const tNow = this.tLast;
    const X = (t) => W - ((tNow - t) / SPAN) * W;
    const Y = (f) => this.yOfF(f, H);

    // Grid: frequency and time ticks.
    ctx.font = `${10 * dpr}px "Martian Mono Variable", ui-monospace, monospace`;
    ctx.fillStyle = "rgba(162,166,172,0.9)";
    ctx.strokeStyle = "rgba(162,166,172,0.18)";
    ctx.lineWidth = dpr;
    for (const f of [50, 100, 200, 500, 1000]) {
      const y = Math.round(Y(f)) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillText(`${f} Hz`, 6 * dpr, y - 4 * dpr);
    }
    for (let s = 10; s < SPAN; s += 10) {
      const x = Math.round(W - (s / SPAN) * W) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, H - 8 * dpr); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillText(`−${s} s`, x + 4 * dpr, H - 6 * dpr);
    }

    // Tracked tones.
    ctx.strokeStyle = "rgba(245,197,24,0.7)";
    ctx.lineWidth = 1.2 * dpr;
    for (const tr of tracks) {
      if (tr.t[tr.t.length - 1] < tNow - SPAN) continue;
      ctx.beginPath();
      for (let i = 0; i < tr.t.length; i++) {
        const x = X(tr.t[i]), y = Y(tr.f[i]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // Fitted passes.
    ctx.strokeStyle = "#86a8ff";
    ctx.fillStyle = "#86a8ff";
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    events.forEach((ev, i) => {
      for (const fit of ev.fits) {
        if (fit.T1 < tNow - SPAN) continue;
        const pts = passCurve(fit, fit.T0 - 4, fit.T1 + 4);
        ctx.beginPath();
        pts.forEach(([t, f], j) => (j ? ctx.lineTo(X(t), Y(f)) : ctx.moveTo(X(t), Y(f))));
        ctx.stroke();
      }
      const x = X(ev.tRx);
      if (x > 0) {
        ctx.save(); ctx.setLineDash([]);
        ctx.fillRect(x - 1 * dpr, 0, 2 * dpr, 14 * dpr);
        ctx.fillText(`P${i + 1}`, x + 4 * dpr, 11 * dpr);
        ctx.restore();
      }
    });
    ctx.setLineDash([]);
  }
}

// ——— Map ———
const SquareCanvas = L.Canvas.extend({
  _updateCircle(layer) {
    if (!this._drawing || layer._empty()) return;
    const p = layer._point, ctx = this._ctx, r = Math.max(Math.round(layer._radius), 1);
    ctx.beginPath();
    ctx.rect(p.x - r, p.y - r, 2 * r, 2 * r);
    this._fillStroke(ctx, layer);
  },
});
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function isDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
const map = L.map("pl-map", { worldCopyJump: true, zoomSnap: 0.5, renderer: new SquareCanvas() }).setView([30, 10], 1.5);
let tiles = null;
function setTiles() {
  // OSM standard tiles, toned to the theme by CSS (planelocate.css).
  document.getElementById("pl-map").classList.toggle("is-dark", isDark());
  if (tiles) return;
  tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}
setTiles();
new MutationObserver(setTiles).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", setTiles);
const layers = L.layerGroup().addTo(map);
const pin = (text, cls) => L.divIcon({ className: `pl-pin ${cls || ""}`, html: `<span>${text}</span>`, iconSize: null, iconAnchor: [0, 0] });

function drawPlaces(res) {
  layers.clearLayers();
  const muted = css("--ink-muted");
  const pts = [];
  for (const p of res.perEvent) for (const c of p.cands) {
    L.circleMarker([c.lat, c.lon], { radius: 2, stroke: false, fillColor: muted, fillOpacity: 0.55, interactive: false }).addTo(layers);
    pts.push([c.lat, c.lon]);
  }
  return pts;
}

function drawFix(res, truth) {
  const ink = css("--ink"), signal = css("--signal"), edge = css("--edge");
  if (!res.fix) return;
  const f = res.fix;
  for (const m of f.members) {
    const line = [];
    for (let t = m.event.tc - 120; t <= m.event.tc + 90; t += 5) {
      const s = stateAt(m.tr, t, 400);
      if (s) line.push([s.lat, s.lon]);
    }
    L.polyline(line, { color: ink, weight: 5, opacity: 0.9, interactive: false }).addTo(layers);
    L.polyline(line, { color: signal, weight: 2.5, interactive: false }).addTo(layers);
    const at = m.at;
    L.marker([at.lat, at.lon], { icon: pin(m.tr.cs || m.tr.icao, "pl-pin--ac"), interactive: false }).addTo(layers);
  }
  for (const a of res.alternatives.slice(0, 3)) {
    L.circleMarker([a.lat, a.lon], { radius: 5, color: ink, weight: 1.5, fillColor: signal, fillOpacity: 0.6 }).addTo(layers)
      .bindTooltip(`Alternative · ${a.members.length} passes · ${a.rms.toFixed(1)} cents`);
  }
  L.circle([f.lat, f.lon], { radius: f.radius, color: edge, weight: 2, dashArray: "6 4", fillOpacity: 0.08, interactive: false }).addTo(layers);
  L.marker([f.lat, f.lon], { icon: pin(res.ambiguous ? T.pinGuess : T.pinFix, "pl-pin--fix"), interactive: false }).addTo(layers);
  const view = [[f.lat, f.lon]];
  if (truth) {
    L.circleMarker(truth, { radius: 5, color: ink, weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(layers);
    L.marker(truth, { icon: pin(T.pinActual, "pl-pin--truth"), interactive: false }).addTo(layers);
    view.push(truth);
  }
  for (const m of f.members) view.push([m.at.lat, m.at.lon]);
  map.fitBounds(L.latLngBounds(view).pad(0.25), { maxZoom: 15 });
}

// ——— Passes list and result plate ———
function renderPasses(events, res) {
  const ol = $("pl-passes");
  if (!events.length) { ol.innerHTML = `<li class="muted">${T.noPasses}</li>`; return; }
  const t0 = state.t0;
  ol.innerHTML = events.map((ev, i) => {
    const places = res ? res.perEvent[i]?.cands.length : null;
    const used = res?.fix?.members.find((m) => m.event === ev);
    return `<li${used ? ' class="is-used"' : ""}><b>P${i + 1}</b><span>+${(ev.tRx - t0).toFixed(0)} s</span><span>${ev.v.toFixed(0)} m/s</span><span>${ev.D >= 1000 ? (ev.D / 1000).toFixed(1) + " km" : ev.D.toFixed(0) + " m"}</span><span>${ev.f0.toFixed(0)} Hz</span>${places != null ? `<span>${T.places(places)}</span>` : ""}${used ? `<span class="pl-ac">${used.tr.cs || used.tr.icao}</span>` : ""}</li>`;
  }).join("");
}

function renderResult(res, truth, extra = {}) {
  const dl = $("pl-result");
  const rows = [];
  const nEv = res ? res.perEvent.length : (extra.n || 0);
  rows.push([T.rowPasses, String(nEv)]);
  if (res && nEv) {
    const one = Math.max(...res.perEvent.map((p) => p.cands.length));
    rows.push([T.rowOne, T.places(one)]);
  }
  if (res?.fix) {
    const f = res.fix;
    rows.push([T.rowFix, `${f.lat.toFixed(4)}, ${f.lon.toFixed(4)}`]);
    rows.push([T.rowUnc, `± ${n(Math.round(f.radius))} m`]);
    rows.push([T.rowAircraft, f.members.map((m) => m.tr.cs || m.tr.icao).join(", ")]);
    rows.push([T.rowFit, `${f.rms.toFixed(1)} cents rms`]);
    const why = [];
    if (f.rms > 12) why.push(T.loose);
    if (f.silent) why.push(T.silent(f.silent));
    if (res.alternatives.length) why.push(T.rivals(res.alternatives.length));
    rows.push([T.rowConf, res.ambiguous
      ? `<span class="hp-lamp hp-lamp--caution"><i aria-hidden="true"></i><span>${T.uncertain(why.join(", "))}</span></span>`
      : `<span class="hp-lamp hp-lamp--go"><i aria-hidden="true"></i><span>${T.agree(f.members.length)}</span></span>`]);
    if (truth) {
      const err = distM(f.lat, f.lon, truth[0], truth[1]);
      rows.push([T.rowErr, err < 10000 ? `${n(Math.round(err))} m` : `${n(Math.round(err / 1000))} km`]);
    }
  } else if (res) {
    rows.push([T.rowFix, nEv < 2 ? T.needTwo : T.noAgree]);
  }
  if (extra.note) rows.push([T.rowNote, extra.note]);
  dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

// ——— Pipeline shared by both modes ———
const state = { mode: null, t0: 0, events: [], res: null, fitCache: new Map() };
const spec = new Spectrogram($("pl-spec"));

function makePipeline(inputRate, t0) {
  const dec = new Decimator(inputRate);
  const an = new Analyzer(dec.fs, t0);
  const rt = new RidgeTracker();
  spec.reset(an.dt, an);
  state.t0 = t0; state.events = []; state.res = null; state.fitCache = new Map();
  return {
    rt,
    push(x) { an.push(dec.push(x), (fr) => { rt.push(fr.t, fr.peaks); spec.addFrame(fr); }); },
    events(final) {
      if (final) rt.flush();
      const long = rt.done.filter((tr) => tr.t[tr.t.length - 1] - tr.t[0] > 2);
      return extractEvents(mergeTracks(long), state.fitCache);
    },
  };
}

let raf = null;
function drawLoop(pipe) {
  cancelAnimationFrame(raf);
  const tick = () => {
    spec.draw(pipe.rt.visible(14), state.events);
    raf = requestAnimationFrame(tick);
  };
  tick();
}

function setButtons(running) {
  $("pl-sim").disabled = running;
  $("pl-listen").disabled = running;
  $("pl-stop").disabled = !running;
}

async function solve(buffer, opts, truth) {
  status("caution", T.searching(buffer.size));
  progress(0);
  const res = await locate(state.events, buffer, opts, (i, n) => progress(i / n));
  progress(null);
  state.res = res;
  const pts = drawPlaces(res);
  renderPasses(state.events, res);
  renderResult(res, truth);
  if (res.fix) drawFix(res, truth);
  else if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.1));
  return res;
}

// ——— Simulation mode ———
let traffic = null;
let simAudio = null;
async function runSimulation() {
  stopAll();
  state.mode = "sim";
  setButtons(true);
  $("pl-hear").disabled = true;
  layers.clearLayers();
  renderPasses([], null);
  renderResult(null);
  status("caution", T.loading);
  if (!traffic) traffic = await (await fetch(new URL("sample-traffic.json", BASE))).json();
  const buffer = new FlightBuffer({ keepSeconds: 1e9 });
  buffer.addSnapshot(traffic);
  const seed = (Math.random() * 2 ** 31) | 0;
  const R = rng(seed);
  status("caution", T.placing);
  await new Promise((r) => setTimeout(r, 30));
  const plan = planSimulation(buffer, traffic.time, R);
  const audio = synthesize(plan, SIM_RATE, R);
  simAudio = audio;
  $("pl-hear").disabled = false;

  const pipe = makePipeline(SIM_RATE, plan.t0);
  drawLoop(pipe);
  status("go", T.playing(plan.dur, SIM_SPEED));
  let pos = 0, last = performance.now(), lastEv = 0;
  await new Promise((resolve) => {
    const step = (now) => {
      if (state.mode !== "sim") return resolve();
      const n = Math.min(audio.length - pos, Math.round(((now - last) / 1000) * SIM_RATE * SIM_SPEED));
      last = now;
      if (n > 0) { pipe.push(audio.subarray(pos, pos + n)); pos += n; }
      if (pos - lastEv > SIM_RATE * 2) {
        lastEv = pos;
        state.events = pipe.events(false);
        renderPasses(state.events, null);
        renderResult(null, null, { n: state.events.length });
      }
      if (pos >= audio.length) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  if (state.mode !== "sim") return;
  state.events = pipe.events(true);
  renderPasses(state.events, null);
  const res = await solve(buffer, { maxStale: 400, window: [plan.t0, plan.t0 + plan.dur] }, plan.P);
  if (state.mode !== "sim") return;
  status(res.fix ? "go" : "hold", res.fix ? (res.ambiguous ? T.doneAmb : T.doneFix) : T.doneNone);
  $("pl-status").classList.remove("is-live");
  setButtons(false);
  state.mode = null;
}

let player = null;
function hear() {
  if (!simAudio) return;
  if (player) { player.stop(); player = null; $("pl-hear").querySelector("span").textContent = T.hear; return; }
  const ctx = new AudioContext();
  const b = ctx.createBuffer(1, simAudio.length, SIM_RATE);
  b.copyToChannel(simAudio, 0);
  const src = ctx.createBufferSource();
  src.buffer = b;
  src.connect(ctx.destination);
  src.onended = () => { player = null; $("pl-hear").querySelector("span").textContent = T.hear; ctx.close(); };
  src.start();
  player = src;
  $("pl-hear").querySelector("span").textContent = T.stopSound;
}

// ——— Live mode ———
const live = { ctx: null, stream: null, feed: null, buffer: null, timer: null, solving: false, solvedFor: "" };
async function runLive() {
  stopAll();
  layers.clearLayers();
  renderPasses([], null);
  renderResult(null);
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    status("hold", T.micRefused);
    return;
  }
  state.mode = "live";
  setButtons(true);
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(new URL("capture-worklet.js", BASE));
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "planelocate-capture");
  src.connect(node);
  const mute = ctx.createGain(); mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination);
  live.ctx = ctx; live.stream = stream;

  const pipe = makePipeline(ctx.sampleRate, Date.now() / 1000);
  let first = true;
  node.port.onmessage = (e) => {
    if (first) { first = false; state.t0 = Date.now() / 1000 - e.data.length / ctx.sampleRate; }
    pipe.push(e.data);
  };
  drawLoop(pipe);

  live.buffer = new FlightBuffer({ keepSeconds: 900 });
  if (RELAY) {
    live.feed = new LiveFeed(RELAY, live.buffer, (f) => {
      if (f.error) status("hold", T.feedError(f.error));
    });
    live.feed.start();
  }
  const started = Date.now();
  status("go", RELAY ? T.listening : T.listeningNoRelay);
  live.timer = setInterval(async () => {
    state.events = pipe.events(false);
    const mins = ((Date.now() - started) / 60000).toFixed(0);
    if (!live.solving) { renderPasses(state.events, state.res); if (!state.res) renderResult(null, null, { n: state.events.length }); }
    if (!RELAY || live.solving || !state.events.length) {
      if (!state.events.length) status("go", T.listeningFor(mins));
      return;
    }
    // Match once the flight data covers the newest pass.
    const lastEv = state.events[state.events.length - 1];
    const key = state.events.map((e) => e.tRx.toFixed(0)).join(",");
    if (key === live.solvedFor || live.buffer.latest < lastEv.tRx + 15) return;
    live.solving = true;
    try {
      const res = await solve(live.buffer, { maxStale: 60, window: [state.t0, Date.now() / 1000 - 20] }, null);
      live.solvedFor = key;
      status("go", res.fix ? T.listeningFix(res.fix.members.length) : T.listeningSoFar(state.events.length));
    } finally { live.solving = false; }
  }, 2000);
}

function stopAll() {
  if (state.mode === "live") {
    clearInterval(live.timer);
    live.feed && live.feed.stop();
    live.stream && live.stream.getTracks().forEach((t) => t.stop());
    live.ctx && live.ctx.close();
    Object.assign(live, { ctx: null, stream: null, feed: null, timer: null, solvedFor: "" });
    status("off", T.stopped);
  } else if (state.mode === "sim") {
    status("off", T.stopped);
  }
  state.mode = null;
  setButtons(false);
  progress(null);
}

$("pl-sim").addEventListener("click", runSimulation);
$("pl-listen").addEventListener("click", runLive);
$("pl-stop").addEventListener("click", stopAll);
$("pl-hear").addEventListener("click", hear);
renderPasses([], null);
renderResult(null);
if (!navigator.mediaDevices || !window.AudioWorkletNode) {
  $("pl-listen").disabled = true;
  status("off", T.noMic);
}
