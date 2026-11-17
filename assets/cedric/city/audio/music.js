// Generative lofi, Web Audio only, no files. buildMusic(ctx, out, opts) only creates nodes and
// schedules events on the context clock, so the same graph runs live and in an OfflineAudioContext.
// ~70 bpm, lazy swing, four 7th/9th chords per cycle that change from cycle to cycle.
import { seeded } from "../core/rng.js";

export const BPM = 70;
const BEAT = 60 / BPM, BAR = BEAT * 4, SWING = 0.58;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// intervals above the root, rootless (the bass plays the root)
const TYPES = {
  maj9: [4, 7, 11, 14], maj7: [4, 7, 11, 16], m9: [3, 7, 10, 14], m7: [3, 7, 10, 15],
  m11: [3, 7, 10, 17], dom9: [4, 7, 10, 14], dom13: [4, 10, 14, 21],
};
// [degree in semitones from the key, chord type]
const PROGS = [
  [[2, "m9"], [7, "dom13"], [0, "maj9"], [9, "m9"]],
  [[0, "maj9"], [9, "m9"], [2, "m9"], [7, "dom9"]],
  [[5, "maj9"], [4, "m7"], [2, "m9"], [7, "dom13"]],
  [[0, "maj7"], [5, "maj9"], [4, "m7"], [9, "m9"]],
  [[9, "m9"], [2, "m9"], [7, "dom13"], [0, "maj9"]],
  [[5, "maj9"], [7, "dom9"], [4, "m7"], [9, "m11"]],
];
// comping rhythms: [eighth index 0..7, velocity, length in beats]
const COMPS = [
  [[0, 1, 2.2], [3, 0.65, 1.2]],
  [[0, 1, 3], [5, 0.55, 1]],
  [[1, 0.8, 1.6], [4, 0.6, 1.4], [7, 0.45, 0.8]],
  [[0, 0.95, 3.6]],
  [[0, 0.9, 1.5], [3, 0.6, 1], [6, 0.5, 1]],
];
const PENTA = [0, 2, 4, 7, 9];

function noiseBuffer(ctx, rnd, secs) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  return b;
}

// Hiss with sparse pops, long enough that the loop is not noticed.
function crackleBuffer(ctx, rnd, secs) {
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += ((rnd() * 2 - 1) * 0.02 - lp) * 0.35;
    d[i] = lp;
    if (rnd() < 11 / sr) {
      const a = Math.pow(rnd(), 3) * 0.7 * (rnd() < 0.5 ? -1 : 1);
      d[i] += a; if (i + 1 < n) d[i + 1] -= a * 0.55;
    }
    if (rnd() < 0.5 / sr) { const a = 0.9 * (rnd() < 0.5 ? -1 : 1); d[i] += a; if (i + 2 < n) d[i + 2] -= a * 0.6; }
  }
  return b;
}

function impulse(ctx, rnd, secs, power) {
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const f = i / n;
      lp += ((rnd() * 2 - 1) - lp) * (0.5 - 0.38 * f); // gets darker as it decays
      d[i] = lp * Math.pow(1 - f, power);
    }
  }
  return b;
}

export function buildMusic(ctx, out, opts = {}) {
  const rnd = seeded(opts.seed == null ? 7 : opts.seed);
  const chance = p => rnd() < p;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const lfos = [];
  const lp = (f, q = 0.7, type = "lowpass") => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const gain = v => { const n = ctx.createGain(); n.gain.value = v; return n; };

  // ---- buses: keys (ducked) + drums + vinyl -> sum -> muffle -> soft compressor -> out ----
  const sum = gain(1), muffle = lp(16000, 0.5);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3;
  sum.connect(muffle); muffle.connect(comp); comp.connect(out);
  const keys = gain(1), duck = gain(1), drums = gain(0.85);
  keys.connect(duck); duck.connect(sum); drums.connect(sum);

  // electric piano bus: low-pass that drifts slowly, a warm reverb and a dotted-eighth echo
  const epLP = lp(2100, 0.6), epOut = gain(0.9);
  epLP.connect(epOut); epOut.connect(keys);
  const drift = ctx.createOscillator(), driftAmt = gain(550);
  drift.frequency.value = 1 / 43; drift.connect(driftAmt); driftAmt.connect(epLP.frequency); drift.start(); lfos.push(drift);
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, rnd, 2.6, 3);
  const verbRet = gain(0.55); verb.connect(verbRet); verbRet.connect(sum);
  const epVerb = gain(0.38); epLP.connect(epVerb); epVerb.connect(verb);
  const echo = ctx.createDelay(2), echoFb = gain(0.36), echoLP = lp(1700, 0.5), echoSend = gain(0.16);
  echo.delayTime.value = BEAT * 0.75;
  epLP.connect(echoSend); echoSend.connect(echo); echo.connect(echoLP); echoLP.connect(echoFb); echoFb.connect(echo); echoLP.connect(keys); echoLP.connect(verb);
  const bassLP = lp(420, 0.6), bassOut = gain(1); bassLP.connect(bassOut); bassOut.connect(keys);

  // tape wow: slow pitch wander in cents, fed to every oscillator's detune
  const wow = gain(1);
  for (const [hz, cents] of [[0.47, 5], [0.083, 9], [6.1, 1.4]]) {
    const o = ctx.createOscillator(), a = gain(cents);
    o.frequency.value = hz; o.connect(a); a.connect(wow); o.start(); lfos.push(o);
  }
  const withWow = (o, onEnd) => {
    wow.connect(o.detune);
    o.addEventListener("ended", () => { try { wow.disconnect(o.detune); } catch (e) { /* gone */ } if (onEnd) onEnd(); });
  };

  // vinyl crackle, always on, very low
  const vinyl = ctx.createBufferSource();
  vinyl.buffer = crackleBuffer(ctx, rnd, 9); vinyl.loop = true;
  const vHP = lp(650, 0.5, "highpass"), vLP = lp(8500, 0.5), vGain = gain(0.034);
  vinyl.connect(vHP); vHP.connect(vLP); vLP.connect(vGain); vGain.connect(sum); vinyl.start();
  const noise = noiseBuffer(ctx, rnd, 1.5);

  // ---- voices ----
  function ep(t, midi, vel, len, bright = 1) {
    const f = mtof(midi), g = gain(0);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = "sine"; o2.type = "triangle"; o3.type = "sine";
    o1.frequency.value = f; o2.frequency.value = f; o3.frequency.value = f * 4;
    o1.detune.value = -6; o2.detune.value = 7;
    const a1 = gain(0.55), a2 = gain(0.26), bell = gain(0);
    o1.connect(a1); o2.connect(a2); o3.connect(bell);
    a1.connect(g); a2.connect(g); bell.connect(g); g.connect(epLP);
    const peak = vel * 0.1, sus = peak * 0.42;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.007);
    g.gain.setTargetAtTime(sus, t + 0.007, 0.5);
    g.gain.setTargetAtTime(0, t + len, 0.16);
    // the tine: a short bright ping an octave-and-a-bit above
    bell.gain.setValueAtTime(0, t);
    bell.gain.linearRampToValueAtTime(0.05 * bright * vel, t + 0.004);
    bell.gain.setTargetAtTime(0, t + 0.004, 0.05);
    const end = t + len + 1.4;
    for (const o of [o1, o2, o3]) { o.start(t); o.stop(end); withWow(o); }
  }
  function bass(t, midi, vel, len) {
    const f = mtof(midi), g = gain(0);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = "sine"; o2.type = "triangle"; o1.frequency.value = f; o2.frequency.value = f;
    const a2 = gain(0.35);
    o1.connect(g); o2.connect(a2); a2.connect(g); g.connect(bassLP);
    const peak = vel * 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.014);
    g.gain.setTargetAtTime(peak * 0.5, t + 0.014, 0.4);
    g.gain.setTargetAtTime(0, t + len, 0.07);
    for (const o of [o1, o2]) { o.start(t); o.stop(t + len + 0.7); withWow(o); }
  }
  function noiseHit(t, type, freq, q, vel, attack, dur, verbSend) {
    const s = ctx.createBufferSource(), f = lp(freq, q, type), g = gain(0);
    s.buffer = noise;
    s.connect(f); f.connect(g); g.connect(drums);
    if (verbSend) { const v = gain(verbSend); g.connect(v); v.connect(verb); }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, rnd() * 1.0); s.stop(t + dur + 0.05);
  }
  function kick(t, vel) {
    const o = ctx.createOscillator(), g = gain(0);
    o.type = "sine";
    o.frequency.setValueAtTime(118, t);
    o.frequency.exponentialRampToValueAtTime(47, t + 0.11);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(drums); o.start(t); o.stop(t + 0.38);
    // gentle side-chain feel: the keys duck a little and breathe back
    duck.gain.setValueAtTime(1, t);
    duck.gain.linearRampToValueAtTime(0.74, t + 0.014);
    duck.gain.setTargetAtTime(1, t + 0.014, 0.1);
  }
  function snare(t, vel) {
    noiseHit(t, "bandpass", 3000, 0.45, vel * 0.16, 0.012, 0.24, 0.35);
    const o = ctx.createOscillator(), g = gain(0);
    o.type = "sine"; o.frequency.value = 188;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.05, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(drums); o.start(t); o.stop(t + 0.12);
  }
  const hat = (t, vel) => noiseHit(t, "highpass", 7600, 0.7, vel * 0.05, 0.002, 0.05, 0);

  // ---- composition state ----
  let bar = 0, cycle = -1, tonic = pick([0, 3, 5, 8, 10, 2]), prog = PROGS[0], lastProg = -1, nextTime = 0, started = false;
  let pentaIdx = 2;

  function newCycle() {
    cycle++;
    if (cycle > 0 && cycle % 3 === 2 && chance(0.65)) tonic = (tonic + pick([5, 7, 2, 10])) % 12; // related key
    let pi;
    do { pi = Math.floor(rnd() * PROGS.length); } while (pi === lastProg);
    lastProg = pi; prog = PROGS[pi];
  }

  function scheduleBar(t0) {
    const bi = bar++, ci = bi % 4;
    if (ci === 0) newCycle();
    const [deg, type] = prog[ci];
    const rootPc = (tonic + deg) % 12;
    const at = k => t0 + Math.floor(k / 2) * BEAT + (k % 2 ? SWING * BEAT : 0);
    const hum = (s = 0.012) => (rnd() - 0.5) * s;
    const vv = v => v * (0.85 + rnd() * 0.3);

    // piano: rootless voicing folded into a comfortable range, lazily rolled
    const notes = TYPES[type].map(i => {
      let n = 48 + rootPc + i;
      while (n > 76) n -= 12;
      while (n < 56) n += 12;
      return n;
    }).sort((a, b) => a - b).filter((n, i, a) => i === 0 || n !== a[i - 1]);
    const comp = bi % 8 === 7 && chance(0.4) ? [[0, 0.8, 3.8]] : pick(COMPS);
    for (const [k, v, lenB] of comp) {
      if (k > 0 && chance(0.18)) continue;
      const base = at(k) + hum();
      notes.forEach((n, i) => ep(base + i * (0.011 + rnd() * 0.012), n, vv(v) * (0.82 + 0.18 * (i / notes.length)), lenB * BEAT));
    }
    // sparse top line on the key's pentatonic
    if (bi >= 2 && chance(0.42)) {
      let k = pick([1, 2, 3]);
      const count = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < count && k < 8; j++) {
        pentaIdx = Math.max(0, Math.min(PENTA.length - 1, pentaIdx + pick([-2, -1, -1, 0, 1, 1, 2])));
        let m = 72 + ((tonic + PENTA[pentaIdx]) % 12);
        if (m > 82) m -= 12;
        ep(at(k) + hum(), m, vv(0.5), BEAT * (1 + rnd()), 1.4);
        k += pick([1, 2, 2, 3]);
      }
    }

    // bass
    const rb = 36 + rootPc, nextRoot = 36 + (tonic + prog[(ci + 1) % 4][0]) % 12;
    bass(at(0) + hum(0.008), rb, vv(1), BEAT * 1.7);
    if (chance(0.3)) bass(at(3) + hum(0.008), rb + 7, vv(0.55), BEAT * 0.8);
    else if (chance(0.4)) bass(at(5) + hum(0.008), rb + 12, vv(0.5), BEAT * 0.6);
    if (chance(0.22)) bass(at(7) + hum(0.008), nextRoot + (nextRoot > rb ? -1 : 1), vv(0.45), BEAT * 0.4);

    // drums: bar 0-1 piano and vinyl only, an occasional breakdown bar
    const play = bi >= 2 && !(bi % 16 === 15 && chance(0.5));
    if (play) {
      kick(at(0) + 0.006, vv(1));
      if (chance(0.62)) kick(at(chance(0.6) ? 5 : 3) + hum(0.01), vv(0.7));
      if (chance(0.18)) kick(at(7) + hum(0.01), vv(0.5));
      snare(at(2) + 0.012 + hum(0.01), vv(1));
      snare(at(6) + 0.012 + hum(0.01), vv(0.95));
      if (ci === 3 && chance(0.35)) snare(at(7) + hum(0.01), vv(0.35)); // ghost note
      if (bi >= 3) for (let k = 0; k < 8; k++) {
        if (chance(0.14)) continue;
        hat(at(k) + 0.006 + hum(0.01), vv(k % 2 ? 0.45 : k % 4 === 0 ? 1 : 0.7));
      }
    }
  }

  return {
    start(t) { nextTime = t; started = true; },
    schedule(until) { if (!started) return; while (nextTime < until) { scheduleBar(nextTime); nextTime += BAR; } },
    // 0 = open, 1 = muffled (snow)
    setMuffle(x, t = ctx.currentTime) { muffle.frequency.setTargetAtTime(16000 * Math.pow(1500 / 16000, Math.max(0, Math.min(1, x))), t, 1.5); },
    barSeconds: BAR,
    dispose() {
      started = false;
      for (const o of lfos) { try { o.stop(); } catch (e) { /* stopped */ } }
      try { vinyl.stop(); } catch (e) { /* stopped */ }
      try { comp.disconnect(); } catch (e) { /* gone */ }
    },
  };
}
