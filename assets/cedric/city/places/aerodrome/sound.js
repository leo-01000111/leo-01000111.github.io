// Soft wind in the canopy, rising with airspeed. Web Audio only, no files: looping filtered noise through
// a band-pass that opens with speed, and a very quiet narrow whistle at high speed. It joins the game's
// audio context once the player has made a gesture (the context starts on the first key press) and follows
// the ambience volume and the mute setting.
export function createWindSound(g) {
  let ctx = null, src = null, band = null, gain = null, whistle = null, wGain = null, out = null, offSet = null, level = 0, lvlTarget = 0;
  const vol = v => v * v;

  function mute() {
    if (!ctx || !out) return;
    const s = g.settings;
    out.gain.setTargetAtTime(s.get("mute") ? 0 : vol(s.get("ambience")), ctx.currentTime, 0.15);
  }
  function start() {
    const c = g.audio && g.audio.ctx;
    if (ctx || !c || c.state === "closed") return;
    ctx = c;
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;               // pink-ish noise (Paul Kellet), with a cross-faded loop
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    const fadeN = 4096;                        // the loop ends where the head was blended with the tail: no click at the seam
    for (let i = 0; i < fadeN; i++) { const t = i / fadeN; d[i] = d[i] * t + d[len - fadeN + i] * (1 - t); }
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopEnd = (len - fadeN) / ctx.sampleRate;
    band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 380; band.Q.value = 0.45;
    gain = ctx.createGain(); gain.gain.value = 0;
    whistle = ctx.createBiquadFilter(); whistle.type = "bandpass"; whistle.frequency.value = 1900; whistle.Q.value = 9;
    wGain = ctx.createGain(); wGain.gain.value = 0;
    out = ctx.createGain(); out.gain.value = 0;
    src.connect(band); band.connect(gain); gain.connect(out);
    src.connect(whistle); whistle.connect(wGain); wGain.connect(out);
    out.connect(ctx.destination);
    src.start();
    mute();
    offSet = g.events.on("setting", k => { if (k === "mute" || k === "ambience") mute(); });
  }
  return {
    start,
    // active: in the air; V: airspeed in m/s
    set(active, V, turbulence = 0) {
      if (!ctx && active) start();
      if (!ctx) return;
      const k = Math.max(0, Math.min(1, (V - 12) / 42));
      lvlTarget = active ? 0.012 + 0.2 * Math.pow(k, 1.5) : 0;
      level += (lvlTarget - level) * 0.04;
      const now = ctx.currentTime;
      gain.gain.setTargetAtTime(level, now, 0.08);
      band.frequency.setTargetAtTime(260 + 1500 * k * k + turbulence * 80, now, 0.15);
      wGain.gain.setTargetAtTime(active ? 0.012 * Math.pow(Math.max(0, k - 0.45) / 0.55, 2) : 0, now, 0.2);
      whistle.frequency.setTargetAtTime(1500 + 1800 * k, now, 0.2);
    },
    dispose() {
      if (offSet) offSet();
      try { if (src) src.stop(); } catch (e) { /* ignore */ }
      for (const n of [src, band, gain, whistle, wGain, out]) { try { if (n) n.disconnect(); } catch (e) { /* ignore */ } }
      ctx = src = band = gain = whistle = wGain = out = null;
    },
  };
}
