// The train's sound, from Web Audio only: a low rumble, a band of wheel hiss that swells with speed,
// and a soft two-note chime when the doors open. Built on first use, once the audio context exists
// (it starts on the first key press). level(speed 0..1, near 0..1) is called a few times a second.
export function createTrainAudio(g) {
  let ctx = null, out = null, rumble = null, hiss = null, nodes = [], dead = false;

  function pink(secs) {
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    return b;
  }
  function build() {
    const bus = g.audio && g.audio.bus;
    if (!bus || !g.audio.ctx || g.audio.ctx.state === "closed") return false;
    ctx = g.audio.ctx;
    out = ctx.createGain(); out.gain.value = 0; out.connect(bus);
    const src = ctx.createBufferSource(); src.buffer = pink(3); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 170; lp.Q.value = 0.5;
    rumble = ctx.createGain(); rumble.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7;
    hiss = ctx.createGain(); hiss.gain.value = 0;
    src.connect(lp); lp.connect(rumble); rumble.connect(out);
    src.connect(bp); bp.connect(hiss); hiss.connect(out);
    const hum = ctx.createOscillator(); hum.type = "sine"; hum.frequency.value = 54;
    const hg = ctx.createGain(); hg.gain.value = 0.12;
    hum.connect(hg); hg.connect(rumble);
    src.start(); hum.start();
    nodes = [src, hum];
    return true;
  }
  const ready = () => ctx && ctx.state !== "closed" && !dead;
  const api = {
    // speed 0..1: how fast the train moves; near 0..1: how close it is to the listener
    level(speed, near) {
      if (!ctx && !build()) return;
      if (!ready()) return;
      const t = ctx.currentTime, v = Math.max(0, Math.min(1, near));
      rumble.gain.setTargetAtTime(0.9 * speed * v, t, 0.35);
      hiss.gain.setTargetAtTime(0.5 * speed * speed * v, t, 0.35);
      out.gain.setTargetAtTime(1, t, 0.5);
    },
    chime() {
      if (!ctx && !build()) return;
      if (!ready()) return;
      const t0 = ctx.currentTime + 0.02;
      [[880, 0], [659.25, 0.42]].forEach(([f, dt]) => {
        const o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        gn.gain.setValueAtTime(0, t0 + dt);
        gn.gain.linearRampToValueAtTime(0.16, t0 + dt + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dt + 1.7);
        o.connect(gn); gn.connect(g.audio.bus);
        o.start(t0 + dt); o.stop(t0 + dt + 1.8);
      });
    },
    dispose() {
      dead = true;
      for (const n of nodes) { try { n.stop(); } catch (e) { /* stopped */ } }
      try { if (out) out.disconnect(); } catch (e) { /* closed */ }
      nodes = [];
    },
  };
  return api;
}
