// Audio system: one AudioContext, created on the first key or pointer press, faded in over 3 s,
// suspended while the tab is hidden, closed for good on dispose. Music and ambience each have a
// bus here; volumes and mute come from the persisted settings.
import { hashStr } from "../core/rng.js";
import * as L from "../world/layout.js";
import { buildMusic } from "./music.js";
import { buildAmbience } from "./ambience.js";

const FADE_IN = 3;
const vol = v => v * v; // perceptual-ish curve

// Master chain, also used by the offline preview: buses -> mute -> glue compressor -> limiter -> analyser -> out
export function createMaster(ctx) {
  const musicBus = ctx.createGain(), ambBus = ctx.createGain(), fade = ctx.createGain(), mute = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -9; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const level = ctx.createGain(); level.gain.value = 0.42; // conservative: peaks stay well under -6 dBFS
  const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
  musicBus.connect(fade); ambBus.connect(fade); fade.connect(mute); mute.connect(comp); comp.connect(limiter); limiter.connect(level);
  level.connect(analyser); level.connect(ctx.destination);
  return { musicBus, ambBus, fade, mute, comp, limiter, level, analyser };
}

// shortest distance from Cedric to the sea, 0 over the water / pier
function coastDistance(x, z) { return Math.max(0, x - L.shoreX(z)); }

export function createAudio(g) {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  let ctx = null, chain = null, music = null, amb = null, timer = 0, closed = false, acc = 0;
  const env = { sea: 0, wind: 0, rain: 0, snow: 0, leaves: 0, birds: 0, crickets: 0 };
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  const api = {
    name: "audio",
    supported: !!Ctor,
    get ctx() { return ctx; },
    get analyser() { return chain && chain.analyser; },
    get ambBus() { return chain && chain.ambBus; }, // --- port --- the ambience bus, for the launch and the bell buoy
    get bus() { return chain && chain.ambBus; }, // for one-off effects (the train)
    get started() { return !!ctx; },
    get sfxBus() { return chain && chain.ambBus; }, // --- karting --- kart engine rides the ambience bus
    duck(v) { api.duckV = v; api.applyVolumes(); }, // --- karting --- the music steps back a little during a race
    // current ambience layer levels (read-only, for tests)
    get levels() { return amb ? amb.levels : env; },
    applyVolumes() {
      if (!ctx) return;
      const now = ctx.currentTime, s = g.settings;
      chain.musicBus.gain.setTargetAtTime(vol(s.get("music")) * 1.0 * (api.duckV == null ? 1 : api.duckV), now, 0.12);
      chain.ambBus.gain.setTargetAtTime(vol(s.get("ambience")) * 1.0, now, 0.12);
      chain.mute.gain.setTargetAtTime(s.get("mute") ? 0 : 1, now, 0.15);
    },
    start() {
      if (ctx || closed || !Ctor) return;
      try { ctx = new Ctor({ latencyHint: "playback" }); } catch (e) { ctx = null; return; }
      chain = createMaster(ctx);
      const seed = hashStr(new Date().toDateString()) ^ 0x5eed;
      music = buildMusic(ctx, chain.musicBus, { seed });
      amb = buildAmbience(ctx, chain.ambBus, { seed: seed + 1 });
      api.applyVolumes();
      const now = ctx.currentTime;
      chain.fade.gain.setValueAtTime(0, now);
      chain.fade.gain.linearRampToValueAtTime(1, now + FADE_IN);
      music.start(now + 0.25);
      pump();
      timer = setInterval(pump, 90);
      sampleEnv(); amb.update(env, now);
      ctx.resume().catch(() => {});
    },
    update(dt) {
      if (!ctx) return;
      acc += dt;
      if (acc < 0.15) return;
      acc = 0;
      sampleEnv();
      amb.update(env);
      music.setMuffle(env.snow * 0.85);
    },
    init() {
      g.audio = api;
      if (!Ctor) return;
      const first = () => { removeGesture(); api.start(); };
      const removeGesture = () => {
        removeEventListener("keydown", onKey, true);
        removeEventListener("pointerdown", first, true);
      };
      const onKey = e => { if (e.key !== "Escape" && !e.metaKey && !e.ctrlKey) first(); };
      addEventListener("keydown", onKey, true);
      addEventListener("pointerdown", first, true);
      api._removeGesture = removeGesture;
      api._offSetting = g.events.on("setting", k => { if (k === "music" || k === "ambience" || k === "mute") api.applyVolumes(); });
      document.addEventListener("visibilitychange", onVis);
    },
    dispose() {
      closed = true;
      if (api._removeGesture) api._removeGesture();
      if (api._offSetting) api._offSetting();
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(timer);
      try { if (music) music.dispose(); if (amb) amb.dispose(); } catch (e) { /* ignore */ }
      if (ctx) { const c = ctx; ctx = null; try { c.close(); } catch (e) { /* ignore */ } api.closedContext = c; }
      if (g.audio === api) delete g.audio;
    },
  };

  function pump() {
    if (!ctx || ctx.state === "closed") return;
    const until = ctx.currentTime + 0.9;
    music.schedule(until);
    amb.tick(until);
  }
  function onVis() {
    if (!ctx || closed) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  }
  function sampleEnv() {
    const p = g.player.state.pos, w = g.env.weather.state, ph = g.env.time.phase, k = w.kind;
    const d = coastDistance(p.x, p.z);
    env.sea = 0.06 + 0.94 * Math.exp(-d / 55);
    env.wind = 0.22 + 0.5 * Math.exp(-d / 70) + (k === "leaves" || k === "snow" || k === "rain" ? 0.15 : 0);
    env.rain = k === "rain" || k === "shower" ? w.wet : 0;
    env.snow = k === "snow" ? w.snow : 0;
    env.leaves = k === "leaves" ? 1 : 0;
    env.birds = w.season === "spring" ? 1 - smooth(ph - 1) : 0; // daylight phases only
    env.crickets = k === "fireflies" ? smooth((ph - 1.4) / 0.9) : 0;
  }
  return api;
}
