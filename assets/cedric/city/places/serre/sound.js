// A quiet glasshouse: a soft mist hiss, a drip now and then, a bird far off. Built on the shared
// ambience bus (so volume and mute follow the settings); nothing is created until the audio
// context exists, and everything is scheduled on the audio clock, with no timers.
export function createSerreSound(g) {
  let ctx = null, gain = null, src = null, on = false, drip = 2, bird = 8;

  function start() {
    const a = g.audio;
    if (!a || !a.ctx || !a.ambBus) return false;
    ctx = a.ctx;
    try {
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; }
      src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.4;
      gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(hp); hp.connect(bp); bp.connect(gain); gain.connect(a.ambBus);
      src.start();
      gain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.4);
      return true;
    } catch (e) { src = gain = null; return false; }
  }
  function blip(f0, f1, dur, vol, delay = 0) {
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), v = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(vol, t + 0.008); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(v); v.connect(g.audio.ambBus); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  return {
    set(v) {
      on = v;
      if (!v && gain && ctx) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        try { src.stop(ctx.currentTime + 2); } catch (e) { /* ignore */ }
        src = gain = null;
      }
    },
    update(dt) {
      if (!on) return;
      if (!src && !start()) return; // the context may only exist after the first key press
      drip -= dt; bird -= dt;
      if (drip <= 0) { drip = 1.5 + Math.random() * 3.5; blip(1500 + Math.random() * 500, 700, 0.11, 0.035); }
      if (bird <= 0) { bird = 9 + Math.random() * 14; const f = 2600 + Math.random() * 900, n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) blip(f, f * 1.35, 0.09, 0.012, i * 0.13); }
    },
    dispose() { on = false; if (gain && ctx) { try { gain.gain.value = 0; src.stop(); } catch (e) { /* ignore */ } } src = gain = null; },
  };
}
