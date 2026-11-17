// Entry: open(ctx) builds the overlay, picks the mode and boots the engine; close() undoes
// everything. ctx = { lang, home, ocean, onClosed, params, dev } (all optional). ctx.ocean.friends
// holds the friends' lines (French); ctx.home.root is the home-page Cedric, hidden while we are open.
import * as THREE from "./core/three.js";
import { T } from "./text.js";
import { createEvents } from "./core/events.js";
import { createSettings } from "./core/settings.js";
import { createInput } from "./core/input.js";
import { seeded } from "./core/rng.js";
import { createEngine, guessTier, TIERS } from "./core/engine.js";
import { createCollide } from "./world/collide.js";
import { createTime, PHASES } from "./env/time.js";
import { createShade } from "./env/shade.js";
import { createWeather } from "./env/weather.js";
import { createSky } from "./env/sky.js";
import { createSea } from "./env/sea.js";
import { createPost } from "./env/post.js";
import { createTerrain } from "./world/terrain.js";
import { createBuildings } from "./world/buildings/index.js";
import { createHologram } from "./world/hologram.js";
import { createProps } from "./world/props.js";
import { createFlora } from "./world/flora.js";
import { createFauna } from "./world/fauna.js";
import { createTraffic } from "./world/traffic.js";
import { createNpcs } from "./world/npcs.js";
import { createCedric } from "./player/cedric3d.js";
import { createControls } from "./player/controls.js";
import { createCamera } from "./player/camera.js";
import * as L from "./world/layout.js";
import { createAudio } from "./audio/audio.js";
import { createHud } from "./ui/hud.js";
import { createNamePopup } from "./ui/namepopup.js";
import { createLevel } from "./player/level.js";
import { createPlaces } from "./places/registry.js";
import { createBench } from "./mobile/bench.js";
import { createKartRace, createKartVenue } from "./places/karting/index.js"; // --- karting ---

// --- aerodrome ---
import { createFlight } from "./places/aerodrome/index.js";
// --- end aerodrome ---
let live = null;
const FADE_IN = 800, FADE_OUT = 1200, CLOSE_MS = 700, REVEAL_MS = 700;
const mq = q => { try { return !!(window.matchMedia && matchMedia(q).matches); } catch (e) { return false; } };

const css = (el, o) => Object.assign(el.style, o);

function ensureDesign() {
  if (window.CEDRIC_DESIGN) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = new URL("../design.js", import.meta.url).href;
    s.onload = () => (window.CEDRIC_DESIGN ? ok() : no(new Error("design")));
    s.onerror = () => no(new Error("design.js"));
    document.head.appendChild(s);
  });
}

function hasWebGL2() {
  try {
    const c = document.createElement("canvas"), gl = c.getContext("webgl2");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

export function open(ctx = {}) {
  if (live) return live.ready;
  const params = ctx.params instanceof URLSearchParams ? ctx.params : new URLSearchParams(ctx.params || "");
  const prevFocus = document.activeElement;
  const prevOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
  const reduced = mq("(prefers-reduced-motion: reduce)"), coarse = mq("(pointer: coarse)"), narrow = innerWidth < 900;
  const mp = params.get("mode");
  const bench = mp ? mp === "bench" : (coarse || narrow || reduced); // phones and calm-motion users get the bench
  const quick = !!ctx.dev || params.get("cover") === "0";
  const k = reduced ? 0.25 : 1; // calm, but never a hard cut

  // ---- overlay ----
  const root = document.createElement("div");
  root.className = "ccity";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", T.title);
  root.tabIndex = -1;
  css(root, { position: "fixed", inset: "0", zIndex: "9000", background: quick ? "#0a0c13" : "transparent", overflow: "hidden", outline: "none", overscrollBehavior: "contain" });
  const canvas = document.createElement("canvas");
  css(canvas, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", touchAction: "none" });
  const hud = document.createElement("div");
  hud.className = "ccity__hud";
  css(hud, { position: "absolute", inset: "0", pointerEvents: "none" });
  const cover = document.createElement("div"); // flat cover: fades in and out instead of animating the canvas
  css(cover, { position: "absolute", inset: "0", background: "#0a0c13", opacity: quick ? "1" : "0", transition: quick ? "none" : `opacity ${FADE_IN * k}ms ease`, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" });
  const loading = document.createElement("p"); // French loading line, fades with the cover
  loading.textContent = T.loading;
  css(loading, { margin: "0", color: "rgba(241,230,220,.7)", font: "400 13px/1.4 ui-monospace, Menlo, Consolas, monospace", letterSpacing: ".06em", pointerEvents: "none" });
  cover.appendChild(loading);
  root.append(canvas, hud, cover);
  // name popup over the cover (skipped by dev.html, cover=0 or name=0); loading goes on behind it
  let namePop = null;
  if (!quick && params.get("name") !== "0") { try { namePop = createNamePopup(root, T.name, () => { namePop = null; if (!L2.closed) root.focus({ preventScroll: true }); }); } catch (e) { console.error(e); } }
  document.body.appendChild(root);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  // the page behind can neither scroll nor be reached by Tab; the home Cedric steps out of the way
  const inerted = [];
  for (const el of document.body.children) if (el !== root && !el.inert && el.tagName !== "SCRIPT") { el.inert = true; inerted.push(el); }
  const homeEl = ctx.home && ctx.home.root, homeVis = homeEl ? homeEl.style.visibility : "";
  if (homeEl) homeEl.style.visibility = "hidden";
  root.focus({ preventScroll: true });
  if (!quick) { root.getBoundingClientRect(); cover.style.opacity = "1"; }
  // wheel and touch stop here: the page behind (the home page's corridor mode listens on window) never sees them
  root.addEventListener("wheel", e => e.stopPropagation(), { passive: true });
  root.addEventListener("touchmove", e => { if (!(e.target.closest && e.target.closest(".ccity__settings, .ccity__board"))) e.preventDefault(); e.stopPropagation(); }, { passive: false });

  const L2 = { root, canvas, hud, cover, closed: false, engine: null, g: null, timers: [] };
  live = L2;
  const onEsc = e => { if (e.key === "Escape" && !L2.g) L2.close(); }; // before the game's own input exists
  addEventListener("keydown", onEsc);

  const teardown = (instant) => {
    if (L2.closed) return;
    L2.closed = true;
    removeEventListener("keydown", onEsc);
    if (namePop) { try { namePop.dispose(); } catch (e) { /* ignore */ } }
    for (const t of L2.timers) clearTimeout(t);
    try { if (L2.engine) L2.engine.dispose(); } catch (e) { console.error(e); }
    try { if (L2.g) { L2.g.input.dispose(); L2.g.events.clear(); } } catch (e) { console.error(e); }
    canvas.remove(); hud.remove();
    document.documentElement.style.overflow = prevOverflow[0];
    document.body.style.overflow = prevOverflow[1];
    for (const el of inerted) el.inert = false;
    if (homeEl) homeEl.style.visibility = homeVis;
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    if (window.__city === L2.g) delete window.__city;
    live = null;
    // calm exit: the page is back underneath while the cover fades away
    if (instant || quick) root.remove();
    else {
      root.inert = true; root.style.background = "transparent";
      cover.style.transition = `opacity ${REVEAL_MS * k}ms ease`; cover.style.opacity = "0";
      setTimeout(() => root.remove(), REVEAL_MS * k + 80);
    }
    if (ctx.onClosed) ctx.onClosed();
  };

  // close with a fade, then dispose
  L2.close = (instant) => new Promise(done => {
    if (L2.closing) return done(L2.closing);
    if (instant) { teardown(true); return done(); }
    cover.style.background = "#0a0c13"; loading.style.display = "none";
    cover.style.transition = `opacity ${CLOSE_MS * k}ms ease`;
    root.style.background = "#0a0c13"; cover.style.opacity = "1";
    L2.closing = setTimeout(() => { teardown(); done(); }, quick ? 450 : CLOSE_MS * k);
    L2.timers.push(L2.closing);
  });

  const failure = (msg) => {
    loading.remove();
    css(cover, { opacity: "1", transition: "none", pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "#f1e6dc", font: "15px/1.5 system-ui, sans-serif", textAlign: "center", padding: "24px" });
    const p = document.createElement("p"); p.textContent = msg;
    const b = document.createElement("button"); b.textContent = T.back; b.type = "button";
    b.addEventListener("click", () => L2.close());
    cover.append(p, b);
    window.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { removeEventListener("keydown", esc); L2.close(); } });
    b.focus();
  };

  L2.ready = (async () => {
    if (!quick) await new Promise(ok => L2.timers.push(setTimeout(ok, FADE_IN * k + 40))); // boot behind the cover, not in front of the page
    if (L2.closed) return;
    root.style.background = "#0a0c13";
    if (!hasWebGL2()) return failure(T.noWebGL);
    try { await ensureDesign(); } catch (e) { return failure(T.failed); }
    if (L2.closed) return;

    // ---- game context ----
    const events = createEvents(), settings = createSettings(events), input = createInput(events);
    const g = {
      THREE, text: T, events, settings, input, rng: seeded(20261116), mode: bench ? "bench" : "game",
      env: {}, world: { layout: L, collide: createCollide() }, player: {}, hud,
      quality: "high", qualityInfo: TIERS.high,
      lines: { friends: ctx.ocean && ctx.ocean.friends || null }, // the friends' spoken lines, if the page passed them
      reduced,
    };
    L2.g = g;
    createLevel(g);
    const camParam = parseFloat(params.get("cam"));
    if (!isNaN(camParam)) settings.set("cam", Math.min(1, Math.max(0, camParam)), false);
    const pos = (params.get("pos") || "").split(",").map(Number);
    if (pos.length === 2 && pos.every(isFinite)) g.spawn = { x: pos[0], z: pos[1], heading: L.spawn.heading };
    const hdg = parseFloat(params.get("hdg"));
    if (bench && !g.spawn) g.spawn = { x: L.bench.x, z: L.bench.z, heading: L.bench.facing };
    if (g.spawn && !isNaN(hdg)) g.spawn.heading = hdg * Math.PI / 180;
    else if (!isNaN(hdg)) g.spawn = { x: L.spawn.x, z: L.spawn.z, heading: hdg * Math.PI / 180 };

    const engine = createEngine(g, canvas, root);
    L2.engine = engine;
    const q = params.get("quality");
    const phone = bench && (coarse || narrow);
    engine.setTier(TIERS[q] ? q : (phone ? "low" : guessTier()), !!TIERS[q] || phone);
    events.on("escape", () => { if (g.ui && g.ui.escape()) return; L2.close(); }); // HUD overlays close first

    // ---- time + weather picks ----
    const tp = params.get("time");
    const run = params.get("run") === "1";
    g.env.time = createTime(g, { phase: PHASES.includes(tp) ? PHASES.indexOf(tp) : bench ? 1 : undefined, frozen: PHASES.includes(tp) && !run });
    g.env.shade = createShade(g);
    g.env.weather = createWeather(g, { season: params.get("season") || undefined, kind: params.get("weather") || undefined });
    g.env.sky = createSky(g);
    g.env.sea = createSea(g);
    g.env.post = createPost(g);

    // order matters: input and player first, then world and environment, post last
    for (const s of [
      g.env.time, g.env.shade, g.env.weather,
      createControls(g), bench ? createBench(g) : createPlaces(g), bench ? null : createKartRace(g), /* --- karting --- before the camera and Cédric */ createCamera(g), createCedric(g),
      g.env.sky, g.env.sea,
      createTerrain(g), createBuildings(g), bench ? null : createKartVenue(g), /* --- karting --- */ createHologram(g), createProps(g), createFlora(g), createFauna(g), createTraffic(g), bench ? null : createNpcs(g),
      createAudio(g), createHud(g),
      g.env.post,
    ].filter(Boolean)) engine.add(s);
    // camera must read the player's state after controls, the shared uniforms after the camera
    g.player.state = g.player.state || {};
    g.stats.tris = 0;

    // --- aerodrome ---
    // the glider flight updates after controls and places, before the camera reads the ride override
    if (!bench) engine.systems.splice(engine.systems.findIndex(s => s.name === "camera"), 0, createFlight(g));
    // --- end aerodrome ---
    engine.init();
    g.player.camera = engine.systems.find(s => s.name === "camera");
    g.player.camera.snap();
    engine.start();
    if (ctx.dev || params.get("dev") === "1") window.__city = g;
    g.engine = engine;
    g.cover = cover; g.coverText = loading; // the station cutscene fades through the flat cover

    // first frames are black behind the cover; fade it out once something has been drawn
    if (quick) { cover.style.transition = "none"; cover.style.opacity = "0"; }
    else requestAnimationFrame(() => requestAnimationFrame(() => { if (!L2.closed) { cover.style.transition = `opacity ${FADE_OUT * k}ms ease`; cover.style.opacity = "0"; } }));
  })().catch(e => { console.error(e); if (!L2.closed) failure(T.failed); });

  return L2.ready;
}

export function close(instant) {
  return live ? live.close(instant) : Promise.resolve();
}
