// Ambience from filtered noise and a few scheduled voices: sea (level follows the coast), wind,
// rain, snow hush, leaf rustle, spring birds, crickets. Every layer crossfades slowly.
// buildAmbience(ctx, out, opts) -> { update(levels), tick(until), dispose() }
import { seeded } from "../core/rng.js";

const FADE = 2.4; // seconds, time constant of every level change

function pinkBuffer(ctx, rnd, secs) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return b;
}
function whiteBuffer(ctx, rnd, secs) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  return b;
}

export function buildAmbience(ctx, out, opts = {}) {
  const rnd = seeded(opts.seed == null ? 11 : opts.seed);
  const R = (a, b) => a + (b - a) * rnd();
  const sources = [], oscs = [];
  const gain = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const pink = pinkBuffer(ctx, rnd, 8), white = whiteBuffer(ctx, rnd, 4);
  const noise = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, rnd() * 3); sources.push(s); return s; };
  const lfo = (hz, depth, param) => {
    const o = ctx.createOscillator(), a = gain(depth);
    o.frequency.value = hz; o.connect(a); a.connect(param); o.start(); oscs.push(o);
    return o;
  };
  // each layer: a level gain (smoothed) into the shared output
  const layer = (v = 0) => { const g = gain(v); g.connect(out); return g; };

  // ---- sea: low body + foam hiss, both swelling on slow, unrelated cycles ----
  const seaLvl = layer();
  {
    const body = noise(pink), f = filt("lowpass", 520, 0.5), sw = gain(0.55);
    body.connect(f); f.connect(sw); sw.connect(seaLvl);
    lfo(0.105, 0.3, sw.gain); lfo(0.061, 0.2, sw.gain); lfo(0.105, 320, f.frequency);
    const foam = noise(white), hp = filt("highpass", 1500, 0.5), bp = filt("lowpass", 6500, 0.5), sw2 = gain(0.2);
    foam.connect(hp); hp.connect(bp); bp.connect(sw2); sw2.connect(seaLvl);
    lfo(0.086, 0.14, sw2.gain); lfo(0.047, 0.08, sw2.gain);
  }
  // ---- wind ----
  const windLvl = layer();
  {
    const n = noise(pink), bp = filt("bandpass", 380, 0.9), sw = gain(0.6);
    n.connect(bp); bp.connect(sw); sw.connect(windLvl);
    lfo(0.07, 160, bp.frequency); lfo(0.043, 0.35, sw.gain); lfo(0.12, 0.1, sw.gain);
  }
  // ---- rain: hiss with a ragged patter ----
  const rainLvl = layer();
  {
    const n = noise(white), hp = filt("highpass", 1100, 0.6), lp = filt("lowpass", 8500, 0.6), pat = gain(0.78);
    n.connect(hp); hp.connect(lp); lp.connect(pat); pat.connect(rainLvl);
    const m = noise(white), mlp = filt("lowpass", 22, 0.5), mg = gain(7);
    m.connect(mlp); mlp.connect(mg); mg.connect(pat.gain);
    const drum = noise(pink), dlp = filt("bandpass", 260, 0.8), dg = gain(0.5);
    drum.connect(dlp); dlp.connect(dg); dg.connect(rainLvl); // rain on distant roofs
  }
  // ---- snow: a muffled hush ----
  const snowLvl = layer();
  {
    const n = noise(pink), lp = filt("lowpass", 240, 0.5), sw = gain(0.7);
    n.connect(lp); lp.connect(sw); sw.connect(snowLvl);
    lfo(0.05, 0.25, sw.gain); lfo(0.05, 60, lp.frequency);
  }
  // ---- leaf rustle: short dry bursts through a band-pass ----
  const leafLvl = layer();
  const leafBurst = gain(0), leafBP = filt("bandpass", 4500, 1.1);
  { const n = noise(white); n.connect(leafBP); leafBP.connect(leafBurst); leafBurst.connect(leafLvl); }
  // ---- birds, crickets: scheduled voices ----
  const birdLvl = layer(), cricketLvl = layer();
  const crickets = [4100, 4550, 3850].map((f, i) => {
    const o = ctx.createOscillator(), g = gain(0), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = "sine"; o.frequency.value = f; o.connect(g);
    if (p) { p.pan.value = [-0.6, 0.15, 0.7][i]; g.connect(p); p.connect(cricketLvl); } else g.connect(cricketLvl);
    o.start(); oscs.push(o);
    return { g, next: 0, base: f };
  });

  const lvl = { sea: 0, wind: 0, rain: 0, snow: 0, leaves: 0, birds: 0, crickets: 0 };
  const nxt = { leaf: 0, bird: 0 };
  // per-layer calibration: what "1" means for each
  const CAL = { sea: 0.5, wind: 0.2, rain: 0.2, snow: 0.2, leaves: 0.16, birds: 0.22, crickets: 0.05 };
  const nodeOf = { sea: seaLvl, wind: windLvl, rain: rainLvl, snow: snowLvl, leaves: leafLvl, birds: birdLvl, crickets: cricketLvl };

  function birdChirp(t) {
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const f0 = R(2600, 5200), n = 2 + Math.floor(rnd() * 4), gap = R(0.09, 0.16), up = rnd() < 0.55;
    if (pan) { pan.pan.value = R(-0.8, 0.8); pan.connect(birdLvl); }
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = gain(0), s = t + i * gap, d = R(0.05, 0.085);
      o.type = "sine";
      o.frequency.setValueAtTime(f0 * (up ? 0.85 : 1.1), s);
      o.frequency.exponentialRampToValueAtTime(f0 * (up ? 1.15 : 0.8), s + d);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.5 * (1 - i * 0.1), s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + d + 0.02);
      o.connect(g); g.connect(pan || birdLvl);
      o.start(s); o.stop(s + d + 0.05);
    }
  }
  function leafBurstAt(t) {
    leafBP.frequency.setValueAtTime(R(3200, 6800), t);
    leafBurst.gain.setValueAtTime(0, t);
    leafBurst.gain.linearRampToValueAtTime(R(0.35, 0.9), t + 0.02);
    leafBurst.gain.setTargetAtTime(0, t + 0.02, R(0.04, 0.1));
  }
  function cricketAt(c, t) {
    const pulses = 3 + Math.floor(rnd() * 3), step = 0.034;
    for (let i = 0; i < pulses; i++) {
      const s = t + i * step;
      c.g.gain.setValueAtTime(0, s);
      c.g.gain.linearRampToValueAtTime(0.5, s + 0.006);
      c.g.gain.linearRampToValueAtTime(0, s + 0.024);
    }
  }

  return {
    levels: lvl,
    // l = { sea, wind, rain, snow, leaves, birds, crickets } each 0..1
    update(l, t = ctx.currentTime) {
      for (const k in lvl) {
        const v = Math.max(0, Math.min(1, l[k] || 0));
        if (Math.abs(v - lvl[k]) < 0.002) continue;
        lvl[k] = v;
        nodeOf[k].gain.setTargetAtTime(v * CAL[k], t, FADE);
      }
    },
    // schedule the sparse voices up to `until` (audio clock seconds)
    tick(until) {
      const now = ctx.currentTime;
      if (lvl.leaves > 0.02) {
        if (nxt.leaf < now) nxt.leaf = now + 0.05;
        while (nxt.leaf < until) {
          const burst = 2 + Math.floor(rnd() * 4);
          for (let i = 0; i < burst; i++) leafBurstAt(nxt.leaf + i * R(0.07, 0.17));
          nxt.leaf += R(0.7, 2.6) / (0.4 + lvl.leaves * 0.6);
        }
      } else nxt.leaf = 0;
      if (lvl.birds > 0.02) {
        if (nxt.bird < now) nxt.bird = now + R(0.5, 3);
        while (nxt.bird < until) { birdChirp(nxt.bird); nxt.bird += R(3.5, 11); }
      } else nxt.bird = 0;
      if (lvl.crickets > 0.02) {
        for (const c of crickets) {
          if (c.next < now) c.next = now + R(0.1, 1);
          while (c.next < until) {
            cricketAt(c, c.next);
            c.next += R(0.42, 0.62) * (0.9 + c.base / 12000);
            if (rnd() < 0.12) c.next += R(0.6, 1.8); // a pause now and then
          }
        }
      } else for (const c of crickets) c.next = 0;
    },
    dispose() {
      for (const s of sources) { try { s.stop(); } catch (e) { /* stopped */ } }
      for (const o of oscs) { try { o.stop(); } catch (e) { /* stopped */ } }
    },
  };
}
