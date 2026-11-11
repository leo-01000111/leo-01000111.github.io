// PlaneLocate — match detected passes against real aircraft and solve for the listener.
//
// One pass on its own is weak evidence: any aircraft anywhere that flew at a
// similar speed and height could have made it, and sliding the listener along
// that aircraft's track absorbs the timing. So each pass gives a cloud of
// possible places (two per plausible aircraft, one each side of its track).
// The fix comes from two or more passes by *different* aircraft whose clouds
// meet: there a joint fit against both real flight paths pins the listener down.

import { enuFrame, offsetLL, distM, dopplerAt, C_SOUND, CENTS } from "./doppler.js";
import { stateAt, makeSampler } from "./feed.js";

const yieldUI = () => new Promise((r) => setTimeout(r, 0));

function observations(event, maxTracks, maxPts) {
  const tracks = event.tracks.slice().sort((a, b) => b.t.length - a.t.length).slice(0, maxTracks);
  return tracks.map((tr) => {
    const step = Math.max(1, Math.floor(tr.t.length / maxPts));
    const t = [], lf = [], w = [];
    for (let i = 0; i < tr.t.length; i += step) { t.push(tr.t[i]); lf.push(Math.log(tr.f[i])); w.push(Math.min(tr.w[i], 30)); }
    return { t, lf, w };
  });
}

// Mean squared log-frequency residual, with each track's emitted tone fitted out.
function costFn(obs, sampler, c) {
  return (px, py) => {
    const pos = sampler(px, py);
    let tot = 0, sw = 0;
    for (const o of obs) {
      const n = o.t.length;
      const r = new Float64Array(n);
      let m = 0, ws = 0;
      for (let i = 0; i < n; i++) {
        r[i] = o.lf[i] - Math.log(dopplerAt(pos, o.t[i], c).g);
        m += o.w[i] * r[i]; ws += o.w[i];
      }
      m /= ws;
      for (let i = 0; i < n; i++) tot += o.w[i] * (r[i] - m) ** 2;
      sw += ws;
    }
    return tot / sw;
  };
}

// Every aircraft whose speed and height fit the pass gives two mirror-image places.
export function findCandidates(event, buffer, { maxStale = 60 } = {}) {
  const out = [];
  const v = event.v;
  const [gLo, gHi] = event.complete ? [v - Math.max(14, 0.16 * v), v + Math.max(14, 0.16 * v)] : [0.75 * v, 2.6 * v];
  for (const tr of buffer.trajectories()) {
    const s = stateAt(tr, event.tc, maxStale);
    if (!s) continue;
    if (s.alt > event.D + 700) continue;
    if (s.gs < gLo || s.gs > gHi) continue;
    const h = Math.sqrt(Math.max(event.D * event.D - s.alt * s.alt, 0));
    for (const side of [1, -1]) {
      const [lat, lon] = offsetLL(s.lat, s.lon, s.trk + 90 * side, h);
      out.push({ lat, lon, side, tr, at: s, event });
    }
  }
  return out;
}

// Grid-search the listener position that best explains every member pass,
// each against its own aircraft's real flight path.
function jointSolve(members, { maxStale, c = C_SOUND, span, step, fine, lite }) {
  let la = 0, lo = 0;
  for (const m of members) { la += m.cand.lat; lo += m.cand.lon; }
  const frame = enuFrame(la / members.length, lo / members.length);
  const costs = [];
  for (const m of members) {
    const obs = lite ? m.lite : m.full;
    let tMin = Infinity, tMax = -Infinity;
    for (const o of obs) { tMin = Math.min(tMin, o.t[0]); tMax = Math.max(tMax, o.t[o.t.length - 1]); }
    const sampler = makeSampler(m.cand.tr, frame, tMin - 40, tMax + 1, maxStale);
    if (!sampler) return null;
    costs.push(costFn(obs, sampler, c));
  }
  const J = (x, y) => { let s = 0; for (const f of costs) s += f(x, y); return s / costs.length; };
  const grid = [];
  let best = { x: 0, y: 0, j: Infinity };
  const scan = (cx, cy, half, st) => {
    for (let x = cx - half; x <= cx + half + 1e-6; x += st)
      for (let y = cy - half; y <= cy + half + 1e-6; y += st) {
        const j = J(x, y);
        grid.push([x, y, j]);
        if (j < best.j) best = { x, y, j };
      }
  };
  scan(0, 0, span, step);
  if (fine) { scan(best.x, best.y, step * 1.5, step / 5); scan(best.x, best.y, step / 5, step / 25); }
  const rms = Math.sqrt(best.j) * CENTS;
  let radius = 40;
  const lim = (rms * 1.3 + 1.5) / CENTS;
  for (const [x, y, j] of grid) if (j <= lim * lim) radius = Math.max(radius, Math.hypot(x - best.x, y - best.y));
  const [lat, lon] = frame.toLL(best.x, best.y);
  return { lat, lon, rms, radius };
}

function grid(cands, cell) {
  const g = new Map();
  for (const c of cands) {
    const k = `${Math.floor(c.lat / cell)},${Math.floor(c.lon / cell)}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(c);
  }
  return {
    near(lat, lon) {
      const i = Math.floor(lat / cell), j = Math.floor(lon / cell), out = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = g.get(`${i + a},${j + b}`); if (l) out.push(...l); }
      return out;
    },
  };
}

// Main entry. events: output of extractEvents. Returns every candidate place
// per event, and, when passes agree, a joint fix.
export async function locate(events, buffer, opts = {}, onProgress) {
  const o = { maxStale: 60, c: C_SOUND, ...opts };
  const R = 4000; // passes must place the listener within this of each other
  const perEvent = events.map((ev) => ({ event: ev, cands: findCandidates(ev, buffer, o) }));
  const obsCache = new Map();
  const obsOf = (ev) => {
    if (!obsCache.has(ev)) obsCache.set(ev, { lite: observations(ev, 2, 24), full: observations(ev, 3, 60) });
    return obsCache.get(ev);
  };

  // 1. Pairs of passes, by different aircraft, whose candidate places land close together.
  const grids = perEvent.map((p) => grid(p.cands, 0.05));
  const pairs = [];
  for (let i = 0; i < perEvent.length; i++)
    for (const a of perEvent[i].cands)
      for (let j = i + 1; j < perEvent.length; j++)
        for (const b of grids[j].near(a.lat, a.lon)) {
          if (b.tr === a.tr) continue;
          const d = distM(a.lat, a.lon, b.lat, b.lon);
          if (d < R) pairs.push({ a, b, d });
        }
  pairs.sort((p, q) => p.d - q.d);
  const list = pairs.slice(0, 400);
  const total = list.length + 12;
  const member = (cand) => ({ cand, ...obsOf(cand.event) });

  // 2. Quick joint fit of every pair, then a careful one on the best few.
  const scored = [];
  for (let i = 0; i < list.length; i++) {
    const members = [member(list[i].a), member(list[i].b)];
    const r = jointSolve(members, { ...o, span: 3000, step: 250, fine: false, lite: true });
    if (r) scored.push({ members, quick: r });
    if (i % 10 === 9) { onProgress && onProgress(i + 1, total); await yieldUI(); }
  }
  scored.sort((a, b) => a.quick.rms - b.quick.rms);
  const finals = [];
  for (const s of scored.slice(0, 8)) {
    const r = jointSolve(s.members, { ...o, span: 1200, step: 100, fine: true, lite: false });
    if (r) finals.push({ ...r, members: s.members });
    onProgress && onProgress(list.length + finals.length, total);
    await yieldUI();
  }
  finals.sort((a, b) => a.rms - b.rms);

  // 3. Grow each good pair with any other pass that agrees with it. A third
  // aircraft agreeing by chance is far less likely than a second one.
  const grow = async (start) => {
    let fix = start;
    const used = new Set(fix.members.map((m) => m.cand.event));
    for (let k = 0; k < perEvent.length; k++) {
      const ev = perEvent[k].event;
      if (used.has(ev)) continue;
      const near = grids[k].near(fix.lat, fix.lon)
        .filter((c) => !fix.members.some((m) => m.cand.tr === c.tr))
        .map((c) => [distM(fix.lat, fix.lon, c.lat, c.lon), c])
        .filter(([d]) => d < R).sort((p, q) => p[0] - q[0]).slice(0, 3);
      let bestExt = null;
      for (const [, c] of near) {
        const members = [...fix.members, member(c)];
        const r = jointSolve(members, { ...o, span: 500, step: 50, fine: true, lite: false });
        if (r && r.rms <= Math.max(fix.rms * 1.3, fix.rms + 3) && (!bestExt || r.rms < bestExt.rms)) bestExt = { ...r, members };
        await yieldUI();
      }
      if (bestExt) { fix = bestExt; used.add(ev); }
    }
    return fix;
  };
  const grown = [];
  for (const f of finals.filter((f) => f.rms < 20).slice(0, 5)) {
    const g = await grow(f);
    g.silent = o.window ? silentPasses(g, events, buffer, o) : 0;
    grown.push(g);
  }
  // Score: passes explained, minus close passes the recording should have heard but didn't.
  const score = (g) => g.members.length - g.silent;
  grown.sort((a, b) => (score(b) - score(a)) || (a.rms - b.rms));
  onProgress && onProgress(total, total);
  if (!grown.length) return { perEvent, fix: null, alternatives: finals.map(strip), ambiguous: false };

  // Different places that explain the passes about as well, or a loose fit: say so.
  const fix = grown[0];
  const rivals = grown.slice(1).filter((g) => distM(g.lat, g.lon, fix.lat, fix.lon) > 1000);
  const ambiguous = fix.rms > 12 || fix.silent > 0 || rivals.some((g) => score(g) === score(fix) && g.rms < fix.rms * 1.25 + 1);
  return { perEvent, fix: strip(fix), alternatives: rivals.map(strip), ambiguous };
}

// Negative evidence: low aircraft that passed within 1.5 km of a candidate place
// while we were recording, but match no detected pass. A real listener there
// would almost certainly have heard them.
function silentPasses(fix, events, buffer, { window: [t0, t1], maxStale, c = C_SOUND }) {
  const mid = (t0 + t1) / 2;
  const memberTr = new Set(fix.members.map((m) => m.cand.tr));
  let silent = 0;
  for (const tr of buffer.trajectories()) {
    if (memberTr.has(tr)) continue;
    const s = stateAt(tr, mid, maxStale);
    if (!s || distM(fix.lat, fix.lon, s.lat, s.lon) > 25000) continue;
    let dmin = Infinity, tmin = 0;
    for (let t = t0; t <= t1; t += 2) {
      const p = stateAt(tr, t, maxStale);
      if (!p) continue;
      const d = Math.hypot(distM(fix.lat, fix.lon, p.lat, p.lon), p.alt);
      if (d < dmin) { dmin = d; tmin = t; }
    }
    if (dmin > 1500 || tmin < t0 + 10 || tmin > t1 - 10) continue;
    const tRx = tmin + dmin / c;
    if (!events.some((e) => Math.abs(e.tRx - tRx) < 8)) silent++;
  }
  return silent;
}

const strip = (r) => ({ lat: r.lat, lon: r.lon, rms: r.rms, radius: r.radius, members: r.members.map((m) => m.cand), silent: r.silent || 0 });
