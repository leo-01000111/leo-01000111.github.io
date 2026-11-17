// Le Port: sound for the launch, all from Web Audio (no files). A soft electric whine that follows the
// speed, water rushing past the hull, slow lapping at the pontoon, a bump when the fender meets stone,
// and the bell buoy. It joins the game's ambience bus once the audio context exists (after the first
// key or click), so the mute and the volume sliders apply.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createPortSound(g) {
  let ctx = null, out = null, nodes = null, closed = false;

  function noise(secs) {
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = l * 0.7 + w * 0.3; d[i] = l * 1.6; }
    return b;
  }
  function build() {
    const a = g.audio;
    if (!a || !a.ctx || !a.ambBus || a.ctx.state === "closed") return false;
    ctx = a.ctx; out = a.ambBus;
    const gain = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = filt("lowpass", 420), eg = gain(0);
    o1.type = "sine"; o2.type = "triangle"; o1.frequency.value = o2.frequency.value = 70;
    o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(out); o1.start(); o2.start();
    const buf = noise(3);
    const rush = ctx.createBufferSource(), rbp = filt("bandpass", 650, 0.5), rg = gain(0);
    rush.buffer = buf; rush.loop = true; rush.connect(rbp); rbp.connect(rg); rg.connect(out); rush.start(0, 0.3);
    const lap = ctx.createBufferSource(), llp = filt("lowpass", 360), lg = gain(0), lfo = ctx.createOscillator(), ld = gain(0.012);
    lap.buffer = buf; lap.loop = true; lap.connect(llp); llp.connect(lg); lg.connect(out); lap.start(0, 1.4);
    lfo.frequency.value = 0.19; lfo.connect(ld); ld.connect(lg.gain); lfo.start();
    nodes = { o1, o2, eg, rush, rg, lap, lg, lfo, extras: [lp, rbp, llp, ld] };
    return true;
  }
  const api = {
    // st: { on (sailing), speed, throttle, near (0..1 closeness to the pontoon) }
    update(dt, st) {
      if (closed) return;
      if (!nodes && !build()) return;
      const now = ctx.currentTime, sp = clamp(Math.abs(st.speed) / 6.6, 0, 1);
      nodes.o1.frequency.setTargetAtTime(64 + sp * 70 + st.throttle * 8, now, 0.25);
      nodes.o2.frequency.setTargetAtTime((64 + sp * 70 + st.throttle * 8) * 2.003, now, 0.25);
      nodes.eg.gain.setTargetAtTime(st.on ? 0.03 + 0.035 * Math.abs(st.throttle) + 0.03 * sp : 0, now, 0.4);
      nodes.rg.gain.setTargetAtTime(st.on ? 0.1 * Math.pow(sp, 1.4) : 0, now, 0.3);
      nodes.lg.gain.setTargetAtTime(st.on ? 0.035 : 0.05 * st.near, now, 0.6);
    },
    // one stroke of the bell buoy, softer with distance
    bell(x, z) {
      if (!nodes || closed) return;
      const p = g.player.state.pos, d = Math.hypot(p.x - x, p.z - z), v = Math.pow(clamp(1 - d / 170, 0, 1), 1.6);
      if (v < 0.02) return;
      const now = ctx.currentTime, lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 2600; lp.connect(out);
      [[1, 1, 4.2], [2.4, 0.4, 2.4], [3.0, 0.28, 1.8], [5.4, 0.1, 0.9]].forEach(([r, a, dec]) => {
        const o = ctx.createOscillator(), e = ctx.createGain();
        o.type = "sine"; o.frequency.value = 392 * r;
        e.gain.setValueAtTime(0, now); e.gain.linearRampToValueAtTime(a * v * 0.1, now + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, now + dec);
        o.connect(e); e.connect(lp); o.start(now); o.stop(now + dec + 0.1);
      });
    },
    // fender on stone: a short low thump
    bump(level) {
      if (!nodes || closed || level < 0.08) return;
      const now = ctx.currentTime, o = ctx.createOscillator(), e = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(110, now); o.frequency.exponentialRampToValueAtTime(48, now + 0.25);
      e.gain.setValueAtTime(0, now); e.gain.linearRampToValueAtTime(0.16 * level, now + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      o.connect(e); e.connect(out); o.start(now); o.stop(now + 0.4);
    },
    dispose() {
      closed = true;
      if (!nodes) return;
      for (const k of ["o1", "o2", "rush", "lap", "lfo"]) { try { nodes[k].stop(); } catch (e) { /* already stopped */ } }
      for (const k of ["o1", "o2", "eg", "rush", "rg", "lap", "lg", "lfo"]) { try { nodes[k].disconnect(); } catch (e) { /* ignore */ } }
      nodes = null;
    },
  };
  return api;
}
