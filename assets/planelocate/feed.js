// PlaneLocate — flight data: a buffer of ADS-B positions and trajectory sampling.
// Snapshot format (sample-traffic.json and the relay both serve it):
//   { time, fields: [...], ac: [[icao24, callsign, lat, lon, alt_m, gs_ms, track_deg, vrate_ms, t_pos], ...] }

import { offsetLL } from "./doppler.js";

export class FlightBuffer {
  constructor({ keepSeconds = 900 } = {}) {
    this.map = new Map();
    this.keep = keepSeconds;
    this.latest = 0;
    this.earliest = Infinity;
  }

  addSnapshot(snap) {
    for (const a of snap.ac) {
      const [icao, cs, lat, lon, alt, gs, trk, vr, tpos] = a;
      const t = tpos || snap.time;
      let tr = this.map.get(icao);
      if (!tr) { tr = { icao, cs, pts: [] }; this.map.set(icao, tr); }
      if (cs) tr.cs = cs;
      const last = tr.pts[tr.pts.length - 1];
      if (last && t <= last.t) continue;
      tr.pts.push({ t, lat, lon, alt, gs, trk, vr });
    }
    this.latest = Math.max(this.latest, snap.time);
    this.earliest = Math.min(this.earliest, snap.time);
    const cut = this.latest - this.keep;
    for (const [k, tr] of this.map) {
      while (tr.pts.length && tr.pts[0].t < cut) tr.pts.shift();
      if (!tr.pts.length) this.map.delete(k);
    }
  }

  get size() { return this.map.size; }
  trajectories() { return this.map.values(); }
}

// Position/velocity of a trajectory at time t. Interpolates between reports,
// dead-reckons (speed, track, climb rate) beyond them up to maxStale seconds.
export function stateAt(tr, t, maxStale = 60) {
  const p = tr.pts;
  if (!p.length) return null;
  if (t <= p[0].t || t >= p[p.length - 1].t || p.length === 1) {
    const ref = t <= p[0].t ? p[0] : p[p.length - 1];
    const dt = t - ref.t;
    if (Math.abs(dt) > maxStale) return null;
    const [lat, lon] = offsetLL(ref.lat, ref.lon, ref.trk, ref.gs * dt);
    return { lat, lon, alt: Math.max(0, ref.alt + (ref.vr || 0) * dt), gs: ref.gs, trk: ref.trk };
  }
  let i = 0;
  while (i < p.length - 2 && p[i + 1].t < t) i++;
  const a = p[i], b = p[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  if (b.t - a.t > maxStale * 2) return null;
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360; else if (dLon < -180) dLon += 360;
  return {
    lat: a.lat + u * (b.lat - a.lat),
    lon: a.lon + u * dLon,
    alt: a.alt + u * (b.alt - a.alt),
    gs: a.gs + u * (b.gs - a.gs),
    trk: u < 0.5 ? a.trk : b.trk,
  };
}

// Pre-sample a trajectory in a local frame so the inner loops are cheap.
// Returns pos(tau) -> [x, y, z] relative to (px, py, elev).
export function makeSampler(tr, frame, t0, t1, maxStale, dt = 0.25) {
  const n = Math.max(2, Math.ceil((t1 - t0) / dt) + 1);
  const xs = new Float64Array(n), ys = new Float64Array(n), zs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = stateAt(tr, t0 + i * dt, maxStale);
    if (!s) return null;
    const [x, y] = frame.toXY(s.lat, s.lon);
    xs[i] = x; ys[i] = y; zs[i] = s.alt;
  }
  const sampler = (px, py, elev = 0) => (tau) => {
    let u = (tau - t0) / dt;
    if (u < 0) u = 0; else if (u > n - 1.001) u = n - 1.001;
    const i = Math.floor(u), f = u - i;
    return [
      xs[i] + f * (xs[i + 1] - xs[i]) - px,
      ys[i] + f * (ys[i + 1] - ys[i]) - py,
      zs[i] + f * (zs[i + 1] - zs[i]) - elev,
    ];
  };
  return sampler;
}

// Polls the relay every 10 s while the microphone is open.
export class LiveFeed {
  constructor(url, buffer, onUpdate) {
    this.url = url;
    this.buffer = buffer;
    this.onUpdate = onUpdate;
    this.timer = null;
    this.error = null;
  }
  async tick() {
    try {
      const r = await fetch(this.url, { cache: "no-store" });
      if (!r.ok) throw new Error(`relay answered ${r.status}`);
      const snap = await r.json();
      this.buffer.addSnapshot(snap);
      this.error = null;
    } catch (e) {
      this.error = e.message || String(e);
    }
    this.onUpdate && this.onUpdate(this);
  }
  start() { this.stop(); this.tick(); this.timer = setInterval(() => this.tick(), 10000); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
