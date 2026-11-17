// Kart engine, soft and synthesised: two detuned oscillators through a low-pass filter, a quiet
// noise bed for the tyres on grass and a short hush on boost. It plays on the ambience bus, so the
// sound button and the ambience slider govern it. Nothing is created until the audio context
// exists (the first key press starts it), and everything is torn down on stop().
import { PHYS } from "./kart.js";

export function createKartSound(g) {
  let ctx = null, nodes = null, paused = false, wantOn = false, retry = 0;

  function build() {
    const au = g.audio;
    if (!au || !au.ctx || au.ctx.state === "closed") return false;
    ctx = au.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400; lp.Q.value = 0.7;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = "sawtooth"; o2.type = "square"; o1.frequency.value = 50; o2.frequency.value = 25;
    const g1 = ctx.createGain(), g2 = ctx.createGain(); g1.gain.value = 0.55; g2.gain.value = 0.3;
    o1.connect(g1); o2.connect(g2); g1.connect(lp); g2.connect(lp); lp.connect(out);
    // tyre noise: one second of noise, looped, band-passed
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0;
    ns.connect(bp); bp.connect(ng); ng.connect(out);
    out.connect(au.sfxBus || ctx.destination);
    o1.start(); o2.start(); ns.start();
    nodes = { out, lp, o1, o2, ns, ng, bp, g1, g2 };
    return true;
  }
  function teardown() {
    if (!nodes) return;
    const n = nodes; nodes = null;
    const drop = () => { try { n.out.disconnect(); n.lp.disconnect(); n.bp.disconnect(); n.ng.disconnect(); n.g1.disconnect(); n.g2.disconnect(); n.o1.disconnect(); n.o2.disconnect(); n.ns.disconnect(); } catch (e) { /* ignore */ } };
    try {
      const t = ctx.currentTime;                                  // a short fade, then the nodes go
      n.out.gain.cancelScheduledValues(t); n.out.gain.setTargetAtTime(0, t, 0.05);
      n.o1.onended = drop;
      n.o1.stop(t + 0.35); n.o2.stop(t + 0.35); n.ns.stop(t + 0.35);
    } catch (e) { drop(); }
  }

  return {
    get running() { return !!nodes; },
    start() { wantOn = true; paused = false; retry = 0; if (!nodes) build(); },
    stop() { wantOn = false; teardown(); },
    pause(b) { paused = b; if (nodes) nodes.out.gain.setTargetAtTime(b ? 0 : 0.0001, ctx.currentTime, 0.05); },
    update(dt, k, thr) {
      if (!wantOn) return;
      if (!nodes) { retry -= dt; if (retry <= 0) { retry = 1; build(); } if (!nodes) return; }
      if (paused) return;
      const now = ctx.currentTime, v = Math.abs(k.speed), f = clamp01(v / PHYS.vmax);
      // gears: the pitch climbs, drops a little at each shift
      const gear = Math.min(3, Math.floor(f * 4)), within = f * 4 - gear;
      const rpm = 0.25 + 0.75 * within + (thr > 0 ? 0.08 : 0);
      const hz = 36 + 70 * rpm + gear * 7 + (k.boostT > 0 ? 14 : 0);
      nodes.o1.frequency.setTargetAtTime(hz, now, 0.06);
      nodes.o2.frequency.setTargetAtTime(hz * 0.5, now, 0.06);
      nodes.lp.frequency.setTargetAtTime(220 + 520 * rpm + (thr > 0 ? 220 : 0), now, 0.08);
      nodes.out.gain.setTargetAtTime(0.045 + 0.05 * (thr > 0 ? 1 : 0.35) * (0.4 + f), now, 0.08);
      nodes.ng.gain.setTargetAtTime((k.grass ? 0.35 : 0.06 * Math.min(1, Math.abs(k.steer) * f * 2)) * f, now, 0.1);
      nodes.bp.frequency.setTargetAtTime(500 + 900 * f, now, 0.1);
    },
    dispose() { wantOn = false; teardown(); },
  };
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
