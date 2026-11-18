// The garden's rules and its memory. No THREE, no DOM: species, growth from timestamps, saving.
// Growth runs on the wall clock, also while the player is away. A bed is
//   null | { s: species id, planted: ms, at: ms, prog: seconds of growth, wat: ms of the last watering }
// `prog` is integrated up to `at`; moving `at` forward to "now" adds exactly what the clock
// allowed in between, so nothing is lost when the page is closed. A plant never dies: when it
// stays dry it first grows slowly, then waits (drooping) until it is watered again.

export const KEY = "cedric:city:serre", VERSION = 1, BEDS = 8;
const FAST = 12 * 60, SLOW = 40 * 60, SLOW_RATE = 0.3; // seconds after a watering: full speed, then slow, then paused

// total: seconds of growth at full speed (about the real minutes with a watering every 12 minutes)
export const SPECIES = {
  basilic:  { total: 600,  thirst: 1 },
  fraisier: { total: 840,  thirst: 1 },
  lavande:  { total: 1080, thirst: 1 },
  cactus:   { total: 1200, thirst: 3 },
  tomate:   { total: 1380, thirst: 1 },
  tournesol: { total: 1620, thirst: 1 },
};
export const ORDER = ["basilic", "fraisier", "lavande", "cactus", "tomate", "tournesol"];
export const STAGES = 4;

const clamp01 = x => Math.max(0, Math.min(1, x));
// growth seconds gained while the time since the last watering goes from a to b (seconds)
const F = (t, k) => { const w1 = FAST * k, w2 = SLOW * k; return Math.min(t, w1) + Math.max(0, Math.min(t, w2) - w1) * SLOW_RATE; };

export function advance(b, now) {
  if (!b) return b;
  const sp = SPECIES[b.s];
  if (now < b.at) { b.at = now; if (b.wat > now) b.wat = now; return b; } // the clock went back: wait, never lose growth
  if (b.prog < sp.total) {
    const k = sp.thirst;
    b.prog = Math.min(sp.total, b.prog + F((now - b.wat) / 1000, k) - F((b.at - b.wat) / 1000, k));
  }
  b.at = now;
  return b;
}

// what the screen shows: stage 0..3, fraction inside the stage, ready, dryness 0 (wet) .. 1 (paused)
export function look(b, now) {
  if (!b) return null;
  const sp = SPECIES[b.s], f = clamp01(b.prog / sp.total), t = (now - b.wat) / 1000, k = sp.thirst;
  const ready = b.prog >= sp.total;
  const stage = ready ? 3 : f < 0.25 ? 0 : f < 0.55 ? 1 : 2;
  const lo = [0, 0.25, 0.55, 1][stage], hi = [0.25, 0.55, 1, 1][stage];
  const dry = ready ? 0 : clamp01((t - FAST * k) / ((SLOW - FAST) * k));
  const thirsty = !ready && t > FAST * k;
  return { stage, inner: hi > lo ? clamp01((f - lo) / (hi - lo)) : 1, f, ready, dry, thirsty, wet: t < 90 };
}

// minutes of growth with regular watering (shown in the seed menu)
export const minutes = id => Math.round(SPECIES[id].total / 60);

// ---- storage: guarded everywhere, memory only when blocked ----
export function createStore() {
  let mem = null; // the session copy
  const blank = () => ({ v: VERSION, beds: Array.from({ length: BEDS }, () => null), harvests: 0 });
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object" || raw.v !== VERSION || !Array.isArray(raw.beds)) return null;
      const d = blank();
      d.harvests = Math.max(0, Math.floor(+raw.harvests || 0));
      for (let i = 0; i < BEDS; i++) {
        const b = raw.beds[i];
        if (!b || !SPECIES[b.s]) continue;
        const planted = +b.planted, at = +b.at, wat = +b.wat, prog = +b.prog;
        if (![planted, at, wat, prog].every(Number.isFinite)) continue;
        d.beds[i] = { s: b.s, planted, at, wat, prog: Math.max(0, Math.min(SPECIES[b.s].total, prog)) };
      }
      return d;
    } catch (e) { return null; }
  }
  return {
    load(now) {
      const d = read() || mem || blank();
      for (const b of d.beds) advance(b, now);
      mem = d;
      return d;
    },
    save(d) {
      mem = d;
      try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
    },
  };
}

export const plant = (s, now) => ({ s, planted: now, at: now, prog: 0, wat: now }); // planting waters the seed
export const water = (b, now) => { advance(b, now); b.wat = now; };
