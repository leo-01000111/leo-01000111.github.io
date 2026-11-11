// PlaneLocate — Doppler physics, geometry and curve fitting.

export const C_SOUND = 343;        // m/s, dry air at ~20 °C
const R_EARTH = 6371000;
const D2R = Math.PI / 180;
export const CENTS = 1200 / Math.LN2; // natural-log ratio -> cents

// ——— Geometry ———
// Local east/north frame around (lat0, lon0); fine for the few km we need.
export function enuFrame(lat0, lon0) {
  const kx = R_EARTH * D2R * Math.cos(lat0 * D2R);
  const ky = R_EARTH * D2R;
  return {
    toXY: (lat, lon) => {
      let dl = lon - lon0;
      if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
      return [dl * kx, (lat - lat0) * ky];
    },
    toLL: (x, y) => [lat0 + y / ky, lon0 + x / kx],
  };
}

export function offsetLL(lat, lon, bearingDeg, dist) {
  const b = bearingDeg * D2R;
  const dLat = (dist * Math.cos(b)) / (R_EARTH * D2R);
  const dLon = (dist * Math.sin(b)) / (R_EARTH * D2R * Math.cos(lat * D2R));
  return [lat + dLat, lon + dLon];
}

export function distM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((lon2 - lon1) * D2R) / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ——— Forward model along a real (sampled) trajectory ———
// pos(tau) -> [x, y, z] in metres relative to the listener. Returns the
// Doppler factor g = f_received / f_emitted heard at reception time t.
export function dopplerAt(pos, t, c = C_SOUND) {
  let tau = t, p, r = 0;
  for (let i = 0; i < 4; i++) {
    p = pos(tau);
    r = Math.hypot(p[0], p[1], p[2]);
    tau = t - r / c;
  }
  const a = pos(tau - 0.25), b = pos(tau + 0.25);
  const ra = Math.hypot(a[0], a[1], a[2]), rb = Math.hypot(b[0], b[1], b[2]);
  const drdt = (rb - ra) / 0.5;
  return { g: c / (c + drdt), r, tau };
}

// ——— Straight-line pass model (used before we know which aircraft it was) ———
// Aircraft at constant speed v on a straight line; slant distance D at closest
// approach, emitted at time tc. Returns log of the received frequency.
function logFreqStraight(t, lf0, v, D, tc, c = C_SOUND) {
  let tau = t;
  for (let i = 0; i < 6; i++) {
    const x = v * (tau - tc);
    tau = t - Math.sqrt(x * x + D * D) / c;
  }
  const x = v * (tau - tc);
  const r = Math.sqrt(x * x + D * D);
  const drdt = (v * x) / r;
  return lf0 + Math.log(c / (c + drdt));
}

// ——— Nelder–Mead ———
function nelderMead(f, x0, step, iters = 400) {
  const n = x0.length;
  let pts = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step[i]; pts.push(p); }
  let vals = pts.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = idx.map((i) => pts[i]); vals = idx.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < 1e-12) break;
    const cen = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += pts[i][j] / n;
    const along = (k) => cen.map((c, j) => c + k * (pts[n][j] - c));
    const xr = along(-1), fr = f(xr);
    if (fr < vals[0]) {
      const xe = along(-2), fe = f(xe);
      if (fe < fr) { pts[n] = xe; vals[n] = fe; } else { pts[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) {
      pts[n] = xr; vals[n] = fr;
    } else {
      const xc = along(fr < vals[n] ? -0.5 : 0.5), fc = f(xc);
      if (fc < Math.min(fr, vals[n])) { pts[n] = xc; vals[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])); vals[i] = f(pts[i]); }
      }
    }
  }
  return { x: pts[0], fx: vals[0] };
}

function median(a) { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }

// Fit the straight-pass model to one ridge track {t[], f[], w[]}.
export function fitPass(trIn) {
  const step = Math.max(1, Math.floor(trIn.t.length / 160));
  const tr = step === 1 ? trIn : {
    t: trIn.t.filter((_, i) => i % step === 0), f: trIn.f.filter((_, i) => i % step === 0), w: trIn.w.filter((_, i) => i % step === 0),
  };
  const n = tr.t.length;
  if (n < 25) return null;
  const T0 = tr.t[0], T1 = tr.t[n - 1];
  if (T1 - T0 < 6) return null;
  const head = Math.min(6, n >> 2);
  const fHi = median(tr.f.slice(0, head)), fLo = median(tr.f.slice(n - head));
  if (fHi / fLo < 1.03) return null; // no pitch drop, not a passing source

  const lf = tr.f.map(Math.log);
  const w = tr.w.map((s) => Math.min(s, 30));
  const sw = w.reduce((a, b) => a + b, 0);

  const f0i = 2 / (1 / fHi + 1 / fLo);
  const vi = Math.min(180, Math.max(30, (C_SOUND * (fHi - fLo)) / (fHi + fLo)));
  let tci = T0 + (T1 - T0) / 2;
  for (let i = 1; i < n; i++) if (tr.f[i - 1] >= f0i && tr.f[i] < f0i) { tci = tr.t[i]; break; }

  const cost = (p) => {
    const [lf0, v, lD, tc] = p;
    if (v < 15 || v > 260 || lD < Math.log(30) || lD > Math.log(12000)) return 1e3;
    const D = Math.exp(lD);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const e = lf[i] - logFreqStraight(tr.t[i], lf0, v, D, tc);
      s += w[i] * e * e;
    }
    return s / sw;
  };

  let best = null;
  for (const D0 of [200, 600, 1500, 3500]) {
    const r = nelderMead(cost, [Math.log(f0i), vi, Math.log(D0), tci - D0 / C_SOUND], [0.02, 10, 0.5, 2], 300);
    if (!best || r.fx < best.fx) best = r;
  }
  const r2 = nelderMead(cost, best.x, [0.005, 3, 0.15, 0.5], 400);
  if (r2.fx < best.fx) best = r2;

  const [lf0, v, lD, tc] = best.x;
  const D = Math.exp(lD);
  const rmsCents = Math.sqrt(best.fx) * CENTS;
  const tRx = tc + D / C_SOUND; // when the closest-approach sound reached us
  const ok = rmsCents < 30 && v > 30 && v < 250 && D > 40 && D < 9000 && tRx > T0 + 1.5 && tRx < T1 - 1.5;
  // How much of the full pitch drop we actually heard. Without both
  // asymptotes, speed and distance trade off against each other.
  let fMax = 0, fMin = Infinity;
  for (const f of tr.f) { fMax = Math.max(fMax, f); fMin = Math.min(fMin, f); }
  const coverage = Math.log(fMax / fMin) / Math.log((C_SOUND + v) / (C_SOUND - v));
  return { f0: Math.exp(lf0), v, D, tc, tRx, rmsCents, ok, coverage, complete: coverage > 0.75, n: trIn.t.length, T0, T1 };
}

// Points of the fitted curve, for drawing.
export function passCurve(fit, t0, t1, dt = 0.25) {
  const out = [];
  for (let t = t0; t <= t1; t += dt) out.push([t, Math.exp(logFreqStraight(t, Math.log(fit.f0), fit.v, fit.D, fit.tc))]);
  return out;
}

// Turn a set of finished ridge tracks into aircraft-pass events. Harmonics of
// the same aircraft give several fits with the same timing and speed; they are
// grouped into one event that keeps every track for the matching step.
export function extractEvents(tracks, cache) {
  const fits = [];
  for (const tr of tracks) {
    const key = `${(tr.parts || [tr.id]).join(",")}:${tr.t.length}`;
    let fit = cache && cache.get(key);
    if (fit === undefined) { fit = fitPass(tr); if (cache) cache.set(key, fit); }
    if (fit && fit.ok) fits.push({ fit, tr });
  }
  // Best-described pass first: complete curves, then long ones.
  fits.sort((a, b) => (b.fit.complete - a.fit.complete) || (b.fit.n * Math.min(1, b.fit.coverage) - a.fit.n * Math.min(1, a.fit.coverage)));
  const events = [];
  for (const it of fits) {
    // Two different aircraft rarely pass within 4 s of each other.
    const e = events.find((ev) => Math.abs(ev.tRx - it.fit.tRx) < 4);
    if (e) { e.tracks.push(it.tr); e.fits.push(it.fit); continue; }
    events.push({ ...it.fit, tracks: [it.tr], fits: [it.fit] });
  }
  events.sort((a, b) => a.tRx - b.tRx);
  return events;
}
