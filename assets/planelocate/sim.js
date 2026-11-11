// PlaneLocate — simulation: place a hidden listener next to real aircraft from
// a recorded ADS-B snapshot and synthesise what their microphone would hear.

import { enuFrame, offsetLL, distM, dopplerAt, C_SOUND } from "./doppler.js";
import { stateAt, makeSampler } from "./feed.js";

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const STALE = 400; // the snapshot is a single moment, so dead-reckon further

function closestPass(tr, P, t0, dur) {
  let dmin = Infinity, tmin = 0;
  for (let t = t0; t <= t0 + dur; t += 2) {
    const s = stateAt(tr, t, STALE);
    if (!s) return null;
    const d = Math.hypot(distM(P[0], P[1], s.lat, s.lon), s.alt);
    if (d < dmin) { dmin = d; tmin = t; }
  }
  return { dmin, tmin };
}

export function planSimulation(buffer, snapTime, rand, dur = 150) {
  const all = [...buffer.trajectories()];
  const low = all.filter((tr) => {
    const p = tr.pts[0];
    return p.alt > 150 && p.alt < 2000 && p.gs > 40 && p.gs < 130 && Math.abs(p.vr || 0) < 8;
  });
  let best = null;
  for (let it = 0; it < 220; it++) {
    const A = low[Math.floor(rand() * low.length)];
    const tcpa = snapTime + 10 + rand() * 80;
    const s = stateAt(A, tcpa, STALE);
    if (!s) continue;
    const side = rand() < 0.5 ? 1 : -1;
    const P = offsetLL(s.lat, s.lon, s.trk + 90 * side, 150 + rand() * 1150);
    const t0 = tcpa - 45 - rand() * 45;
    const near = all.filter((tr) => distM(P[0], P[1], tr.pts[0].lat, tr.pts[0].lon) < 45000);
    const sources = [];
    let complete = 0;
    for (const tr of near) {
      const cp = closestPass(tr, P, t0, dur);
      if (!cp || cp.dmin > 8000) continue;
      const done = cp.dmin < 3500 && cp.tmin > t0 + 15 && cp.tmin < t0 + dur - 15;
      if (done) complete++;
      sources.push({ tr, ...cp, complete: done });
    }
    const score = complete + rand() * 0.5;
    if (!best || score > best.score) best = { score, P, t0, dur, target: A, sources, complete };
    if (complete >= 3) break;
  }
  best.c = C_SOUND + (rand() - 0.5) * 12; // the air is never exactly 20 °C
  return best;
}

// Synthesise the recording. Each aircraft is a set of harmonic tones (propeller
// blade rate or fan tone) plus broadband engine noise, Doppler-shifted, delayed
// and attenuated along its real path; under it sits background noise and mains hum.
export function synthesize(plan, fs, rand) {
  const N = Math.round(plan.dur * fs);
  const out = new Float32Array(N);
  const frame = enuFrame(plan.P[0], plan.P[1]);

  // Background: pink noise (Kellet filter), a little rumble, mains hum.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, rum = 0;
  const hum = 50 + (rand() < 0.4 ? 10 : 0);
  for (let i = 0; i < N; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    rum += 0.01 * (w - rum);
    const t = i / fs;
    out[i] = 0.012 * pink + 0.05 * rum + 0.003 * Math.sin(2 * Math.PI * hum * t) + 0.002 * Math.sin(4 * Math.PI * hum * t);
  }

  const CR = 50; // control rate, Hz
  const nC = Math.ceil(plan.dur * CR) + 2;
  for (const src of plan.sources) {
    const sampler = makeSampler(src.tr, frame, plan.t0 - 40, plan.t0 + plan.dur + 1, STALE);
    if (!sampler) continue;
    const pos = sampler(0, 0, 0);
    const u = hash01(src.tr.icao);
    const gs = src.tr.pts[0].gs;
    const prop = gs < 85;
    const f0 = prop ? 70 + 60 * u : 160 + 260 * u;
    const K = prop ? 7 : 4;
    const level = prop ? 28 : 22;
    const bbLevel = prop ? 6 : 26;
    const ak = Array.from({ length: K }, (_, k) => 1 / Math.pow(k + 1, prop ? 0.8 : 1));
    const G = new Float32Array(nC), A = new Float32Array(nC), R = new Float32Array(nC);
    for (let k = 0; k < nC; k++) {
      const d = dopplerAt(pos, plan.t0 + k / CR, plan.c);
      G[k] = d.g; R[k] = d.r; A[k] = 1 / Math.max(d.r, 60);
    }
    const ph = new Float64Array(K).map(() => rand() * 2 * Math.PI);
    const modF = 0.2 + rand() * 0.5, modP = rand() * 6;
    let bb = 0;
    for (let i = 0; i < N; i++) {
      const cu = (i / fs) * CR, ci = Math.floor(cu), cf = cu - ci;
      const g = G[ci] + cf * (G[ci + 1] - G[ci]);
      const a = (A[ci] + cf * (A[ci + 1] - A[ci])) * (1 + 0.15 * Math.sin(2 * Math.PI * modF * (i / fs) + modP));
      const r = R[ci];
      let s = 0;
      for (let k = 0; k < K; k++) {
        const f = (k + 1) * f0 * g;
        if (f > fs * 0.45) break;
        ph[k] += (2 * Math.PI * f) / fs;
        if (ph[k] > 1e6) ph[k] %= 2 * Math.PI;
        const att = Math.pow(10, (-5e-6 * f * r) / 20);
        s += ak[k] * att * Math.sin(ph[k]);
      }
      bb += 0.35 * ((rand() * 2 - 1) - bb);
      out[i] += a * (level * s + bbLevel * bb);
    }
  }

  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = 0.8 / (peak || 1);
  for (let i = 0; i < N; i++) out[i] *= k;
  return out;
}
