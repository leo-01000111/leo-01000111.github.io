// Renderer, loop, resize, quality tiers and the system registry.
// A system is { name, init(g), update(dt, t), late?(dt, t), dispose() }.
import * as THREE from "./three.js";

export const TIERS = {
  high:   { cap: 1.5,  samples: 4, far: 900, particles: 1400 },
  medium: { cap: 1.25, samples: 2, far: 700, particles: 900 },
  low:    { cap: 1,    samples: 0, far: 520, particles: 500 },
};
const ORDER = ["high", "medium", "low"];

// First guess from device hints; the loop steps down later if frames stay slow.
export function guessTier() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900 && !matchMedia("(any-pointer: fine)").matches);
  if (mobile) return "low";
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  return cores >= 8 && mem >= 4 ? "high" : "medium";
}

export function createEngine(g, canvas, host) {
  THREE.ColorManagement.enabled = false; // colours are authored as display values
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x0a0c13, 1);
  renderer.info.autoReset = false; // count draw calls over both passes
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 900);
  g.renderer = renderer; g.scene = scene; g.camera = camera;
  g.size = { w: 1, h: 1, pr: 1 };
  g.stats = { fps: 0, ms: 0, tris: 0, calls: 0 };

  const systems = [];
  let raf = 0, last = 0, running = false, hidden = document.hidden;
  let ema = 16, slowFor = 0, age = 0, locked = false;

  function setTier(name, lock) {
    g.quality = name; g.qualityInfo = TIERS[name];
    if (lock) locked = true;
    camera.far = TIERS[name].far; camera.updateProjectionMatrix();
    if (g.size.w > 1) resize();
    g.events.emit("quality", name);
  }

  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, g.qualityInfo.cap);
    g.size.w = w; g.size.h = h; g.size.pr = pr;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    g.events.emit("resize", g.size);
  }
  const ro = new ResizeObserver(() => resize());

  function step(dt, t) {
    for (let i = 0; i < systems.length; i++) systems[i].update(dt, t);
    for (let i = 0; i < systems.length; i++) if (systems[i].late) systems[i].late(dt, t);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - last) / 1000; last = now;
    const dt = Math.max(0, Math.min(0.05, real)), t = now / 1000;   // rAF time can precede the boot timestamp
    step(dt, t);
    renderer.info.reset();
    g.env.post.render();
    // fps + adaptive quality (never steps up)
    ema += (real * 1000 - ema) * 0.05;
    g.stats.ms = ema; g.stats.fps = 1000 / ema; g.stats.calls = renderer.info.render.calls; g.stats.drawTris = renderer.info.render.triangles;
    age += real;
    if (!locked && age > 2) {
      slowFor = ema > 22 ? slowFor + real : 0;
      const i = ORDER.indexOf(g.quality);
      if (slowFor > 3 && i < ORDER.length - 1) { slowFor = 0; setTier(ORDER[i + 1]); }
    }
  }

  const onVis = () => {
    hidden = document.hidden;
    if (hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener("visibilitychange", onVis);

  const api = {
    renderer, scene, camera, systems, setTier, resize, step,
    add(sys) { systems.push(sys); return sys; },
    init() { for (const s of systems) s.init(g); },
    start() {
      ro.observe(host); resize();
      running = true; last = performance.now(); age = 0;
      if (!hidden) raf = requestAnimationFrame(frame);
    },
    // Advance the simulation without rendering (tests).
    advance(seconds, hz = 30) {
      const dt = 1 / hz;
      for (let t = 0; t < seconds; t += dt) step(dt, performance.now() / 1000);
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf); raf = 0;
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      for (let i = systems.length - 1; i >= 0; i--) { try { systems[i].dispose(); } catch (e) { console.error(e); } }
      systems.length = 0;
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        }
        if (o.isInstancedMesh) o.dispose();
      });
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      THREE.ColorManagement.enabled = true;
    },
  };
  return api;
}
