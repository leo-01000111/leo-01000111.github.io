// PlaneLocate — signal processing.
// Raw microphone samples -> decimated stream -> STFT -> whitened spectrum ->
// spectral peaks -> ridge tracks (tones that persist and drift in frequency).

export const F_MIN = 40;    // Hz, lowest frequency analysed
export const F_MAX = 1600;  // Hz, highest frequency analysed
export const TARGET_FS = 4000;
export const FFT_N = 2048;  // ~0.5 s window at 4 kHz, ~2 Hz bins
export const HOP = 512;     // ~0.128 s between frames

// ——— Decimator: windowed-sinc low-pass + downsample by an integer factor ———
export class Decimator {
  constructor(inputRate, targetRate = TARGET_FS) {
    this.M = Math.max(1, Math.round(inputRate / targetRate));
    this.fs = inputRate / this.M;
    const M = this.M;
    const L = M === 1 ? 1 : 16 * M + 1;
    const fc = 0.45 / M; // cycles per input sample
    const h = new Float32Array(L);
    let sum = 0;
    for (let i = 0; i < L; i++) {
      const n = i - (L - 1) / 2;
      const sinc = n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n);
      const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (L - 1 || 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (L - 1 || 1));
      h[i] = M === 1 ? 1 : sinc * w;
      sum += h[i];
    }
    for (let i = 0; i < L; i++) h[i] /= sum;
    this.h = h;
    this.hist = new Float32Array(L - 1);
    this.next = 0; // index (relative to the joined buffer, after the history) of the next output
  }

  push(x) {
    if (this.M === 1) return Float32Array.from(x);
    const L = this.h.length, H = L - 1;
    const buf = new Float32Array(H + x.length);
    buf.set(this.hist);
    buf.set(x, H);
    const out = [];
    let j = H + this.next;
    for (; j < buf.length; j += this.M) {
      let acc = 0;
      const base = j - H;
      for (let k = 0; k < L; k++) acc += this.h[k] * buf[base + k];
      out.push(acc);
    }
    this.next = j - buf.length;
    this.hist = buf.slice(buf.length - H);
    return Float32Array.from(out);
  }
}

// ——— FFT (iterative radix-2, in place) ———
class FFT {
  constructor(n) {
    this.n = n;
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float32Array(n / 2);
    this.sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
  }
  run(re, im) {
    const n = this.n, rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let k = 0; k < half; k++) {
          const c = this.cos[k * step], s = this.sin[k * step];
          const a = i + k, b = a + half;
          const tr = re[b] * c - im[b] * s;
          const ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  }
}

// ——— STFT + whitening + peak picking ———
// Emits one frame per hop: { t, db (raw dB), w (whitened dB), peaks: [{f, s}] }.
export class Analyzer {
  constructor(fs, t0) {
    this.fs = fs;
    this.t0 = t0;              // absolute time (unix s) of decimated sample 0
    this.N = FFT_N;
    this.fft = new FFT(FFT_N);
    this.win = new Float32Array(FFT_N);
    for (let i = 0; i < FFT_N; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));
    this.kMin = Math.ceil((F_MIN * FFT_N) / fs);
    this.kMax = Math.floor((F_MAX * FFT_N) / fs);
    this.nb = this.kMax - this.kMin + 1;
    this.binHz = fs / FFT_N;
    this.buf = new Float32Array(FFT_N * 4);
    this.len = 0;
    this.consumed = 0;         // decimated samples dropped from the front of buf
    this.bg = null;
    this.re = new Float32Array(FFT_N);
    this.im = new Float32Array(FFT_N);
    this.dt = HOP / fs;
  }

  freqOfBin(i) { return (this.kMin + i) * this.binHz; }

  push(x, onFrame) {
    if (this.len + x.length > this.buf.length) {
      const nb = new Float32Array(Math.max(this.buf.length * 2, this.len + x.length));
      nb.set(this.buf.subarray(0, this.len));
      this.buf = nb;
    }
    this.buf.set(x, this.len);
    this.len += x.length;
    while (this.len >= this.N) {
      onFrame(this._frame());
      this.buf.copyWithin(0, HOP, this.len);
      this.len -= HOP;
      this.consumed += HOP;
    }
  }

  _frame() {
    const { N, re, im, win } = this;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += this.buf[i];
    mean /= N;
    for (let i = 0; i < N; i++) { re[i] = (this.buf[i] - mean) * win[i]; im[i] = 0; }
    this.fft.run(re, im);
    const nb = this.nb;
    const db = new Float32Array(nb);
    for (let i = 0; i < nb; i++) {
      const k = this.kMin + i;
      db[i] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
    }
    // Per-bin background: rises slowly (60 s), falls quickly (3 s), so steady
    // hums get absorbed while a moving tone stands out.
    if (!this.bg) this.bg = Float32Array.from(db);
    const aUp = this.dt / 60, aDown = this.dt / 3;
    const w = new Float32Array(nb);
    for (let i = 0; i < nb; i++) {
      const d = db[i] - this.bg[i];
      w[i] = d;
      this.bg[i] += d * (d > 0 ? aUp : aDown);
    }
    const sorted = Float32Array.from(w).sort();
    const med = sorted[nb >> 1];
    for (let i = 0; i < nb; i++) w[i] -= med;

    const t = this.t0 + (this.consumed + N / 2) / this.fs;
    return { t, db, w, peaks: this._peaks(db, w) };
  }

  _peaks(db, w, thresh = 8, maxPeaks = 16) {
    const out = [];
    const nb = this.nb;
    for (let i = 3; i < nb - 3; i++) {
      const v = w[i];
      if (v < thresh) continue;
      if (v < w[i - 1] || v < w[i + 1] || v < w[i - 2] || v < w[i + 2] || v < w[i - 3] || v < w[i + 3]) continue;
      const a = db[i - 1], b = db[i], c = db[i + 1];
      const den = a - 2 * b + c;
      const delta = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
      out.push({ f: this.freqOfBin(i + delta), s: v });
    }
    out.sort((p, q) => q.s - p.s);
    return out.slice(0, maxPeaks);
  }
}

// ——— Ridge tracker: link spectral peaks frame to frame ———
export class RidgeTracker {
  constructor({ maxGap = 1.6, minPoints = 10 } = {}) {
    this.active = [];
    this.done = [];
    this.maxGap = maxGap;
    this.minPoints = minPoints;
    this.nextId = 1;
  }

  static slope(tr) {
    const n = tr.t.length;
    if (n < 4) return 0;
    const k = Math.min(n, 10);
    let st = 0, sf = 0, stt = 0, stf = 0;
    for (let i = n - k; i < n; i++) { st += tr.t[i]; sf += tr.f[i]; stt += tr.t[i] * tr.t[i]; stf += tr.t[i] * tr.f[i]; }
    const den = k * stt - st * st;
    return den > 1e-9 ? (k * stf - st * sf) / den : 0;
  }

  push(t, peaks) {
    const pairs = [];
    for (let a = 0; a < this.active.length; a++) {
      const tr = this.active[a];
      const n = tr.t.length;
      const dt = t - tr.t[n - 1];
      const sl = Math.max(-80, Math.min(80, RidgeTracker.slope(tr)));
      const fPred = tr.f[n - 1] + sl * dt;
      const tol = Math.max(3, 0.025 * fPred) + 0.6 * Math.abs(sl) * dt;
      for (let p = 0; p < peaks.length; p++) {
        const d = Math.abs(peaks[p].f - fPred);
        if (d < tol) pairs.push([d / tol, a, p]);
      }
    }
    pairs.sort((x, y) => x[0] - y[0]);
    const usedT = new Set(), usedP = new Set();
    for (const [, a, p] of pairs) {
      if (usedT.has(a) || usedP.has(p)) continue;
      usedT.add(a); usedP.add(p);
      const tr = this.active[a];
      tr.t.push(t); tr.f.push(peaks[p].f); tr.w.push(peaks[p].s);
    }
    for (let p = 0; p < peaks.length; p++) {
      if (usedP.has(p)) continue;
      this.active.push({ id: this.nextId++, t: [t], f: [peaks[p].f], w: [peaks[p].s] });
    }
    const still = [];
    for (const tr of this.active) {
      if (t - tr.t[tr.t.length - 1] > this.maxGap) {
        if (tr.t.length >= this.minPoints) this.done.push(tr);
      } else still.push(tr);
    }
    this.active = still;
  }

  flush() {
    for (const tr of this.active) if (tr.t.length >= this.minPoints) this.done.push(tr);
    this.active = [];
  }

  // Tracks long enough to draw (finished and running).
  visible(minPts = 12) {
    return this.done.concat(this.active.filter((tr) => tr.t.length >= minPts));
  }
}

// Join a track that breaks up at closest approach (where the pitch drops
// fastest and the ridge smears) with the piece that follows it.
export function mergeTracks(tracks, maxGap = 3.5) {
  const list = tracks.map((tr) => ({ ...tr, t: tr.t.slice(), f: tr.f.slice(), w: tr.w.slice(), parts: [tr.id] }));
  list.sort((a, b) => a.t[0] - b.t[0]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length && !changed; i++) {
      const A = list[i];
      const tEnd = A.t[A.t.length - 1], fEnd = A.f[A.f.length - 1];
      let best = -1, bestD = Infinity;
      for (let j = 0; j < list.length; j++) {
        if (j === i) continue;
        const B = list[j];
        const gap = B.t[0] - tEnd;
        if (gap <= 0 || gap > maxGap) continue;
        const ratio = B.f[0] / fEnd;
        if (ratio > 1.02 || ratio < 0.72) continue;
        const d = gap + 4 * Math.abs(Math.log(ratio));
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) {
        const B = list[best];
        A.t.push(...B.t); A.f.push(...B.f); A.w.push(...B.w); A.parts.push(...B.parts);
        list.splice(best, 1);
        changed = true;
      }
    }
  }
  return list;
}
