// La Serre as a place: Space at the door fades out, Cédric appears inside a glasshouse built far
// above the plot (the inside only exists in the scene while he is in it), and a calm garden
// waits there. Beds take a seed, water and a harvest; growth runs on the wall clock (garden.js)
// and is saved per browser. Walking uses the normal controls on level "serre" (player/level.js);
// the camera follows g.player.ride. No timers: fades and effects run from update().
import * as THREE from "../../core/three.js";
import * as L from "../../world/layout.js";
import { buildInterior, bedRect, BED, HW, HD, DOOR } from "./interior.js";
import { plantGeometry, disposePlants } from "./plants.js";
import { createSerreUi } from "./ui.js";
import { createSerreSound } from "./sound.js";
import { BEDS, ORDER, SPECIES, STAGES, advance, look, minutes, createStore, plant, water } from "./garden.js";

const Y0 = 300;                       // the inside floats this far above the street
const HOVER = 1.1, CAM_BACK = 5.8, FADE = 0.5;
const NEON = "#9bff8a";
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export function createSerrePlace(g) {
  const T = g.text.serre, st = () => g.player.state, store = createStore();
  const plot = L.plotById("serre"), OX = plot.x, OZ = plot.z, place = L.places.find(p => p.id === "serre");
  let room = null, ui = null, sound = null, inside = false, data = null;
  let fade = null;                    // { dir: "out" | "in", t, then, after }
  let mist = null, spray = null, sprayT = 0, sprayAt = [0, 0, 0], plantsGroup = null;
  let bedMeshes = [], looks = [], poll = 0, camBack = CAM_BACK, savedRate = 1.1, clock = 0;
  const cls = {};                     // pseudo places (what Space does inside): cached so the prompt only changes with the class
  const exitSpot = { x: OX, z: OZ - HD + 1.5 };
  const cell = (id, extra) => cls[id] || (cls[id] = Object.assign({ id, plot: "serre", neon: NEON, door: [OX, OZ], radius: 2 }, extra));
  const bedPlace = (i, k) => { const key = "serre-bed-" + k + i; return cls[key] || (cls[key] = { id: "serre-bed-" + k, plot: "serre", neon: NEON, door: [OX + bedRect(i).cx, OZ + bedRect(i).cz], radius: 2, bed: i }); };

  const cover = v => { const c = g.cover; if (!c) return; c.style.transition = "none"; c.style.opacity = v <= 0.001 ? "0" : v >= 0.999 ? "1" : v.toFixed(3); if (g.coverText) g.coverText.style.display = "none"; };
  const now = () => Date.now();

  // ---------- the garden on screen ----------
  function buildPlants() {
    plantsGroup = new THREE.Group();
    bedMeshes = [];
    for (let i = 0; i < BEDS; i++) {
      const b = bedRect(i), row = [];
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(plantGeometry("basilic", 0), g.env.shade.world);
        m.position.set(b.cx + (k === 1 ? 0.2 : -0.15), BED.soil, b.cz + (k - 1) * 1.0);
        m.visible = false; m.userData.key = "";
        plantsGroup.add(m); row.push(m);
      }
      bedMeshes.push(row);
    }
    room.group.add(plantsGroup);
  }
  function paintBed(i) {
    const b = data.beds[i], lk = looks[i], row = bedMeshes[i];
    for (let k = 0; k < row.length; k++) {
      const m = row[k];
      if (!b) { m.visible = false; m.userData.key = ""; continue; }
      const key = b.s + lk.stage;
      if (m.userData.key !== key) { m.geometry = plantGeometry(b.s, lk.stage); m.userData.key = key; }
      const s = (lk.stage === STAGES - 1 ? 1 : 0.85 + 0.15 * lk.inner) * (k === 1 ? 1.05 : 0.95 - 0.05 * (k & 1));
      m.scale.set(s, s * (1 - 0.22 * lk.dry), s);
      m.rotation.set(0, k * 2.1 + i, (k === 1 ? 1 : -1) * 0.16 * lk.dry);
      m.visible = true;
    }
  }
  function refresh(force) {
    const t = now();
    for (let i = 0; i < BEDS; i++) {
      const b = data.beds[i];
      if (b) advance(b, t);
      const lk = look(b, t), old = looks[i];
      looks[i] = lk;
      if (force || !lk !== !old || (lk && (lk.stage !== old.stage || Math.abs(lk.dry - old.dry) > 0.02 || Math.abs(lk.inner - old.inner) > 0.03))) paintBed(i);
    }
  }

  // ---------- effects: drifting mist, the watering spray ----------
  let dotTex = null;
  function dot() { // a soft round sprite, so the particles are not squares
    if (dotTex) return dotTex;
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const x = c.getContext("2d"), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    return (dotTex = new THREE.CanvasTexture(c));
  }
  function buildFx() {
    const n = 70, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() * 2 - 1) * (HW - 1); pos[i * 3 + 1] = 0.6 + Math.random() * 4.5; pos[i * 3 + 2] = (Math.random() * 2 - 1) * (HD - 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    mist = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1de, size: 0.22, map: dot(), transparent: true, opacity: 0.22, depthWrite: false }));
    mist.frustumCulled = false;
    const m = 36, sp = new Float32Array(m * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    spray = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.12, map: dot(), transparent: true, opacity: 0.85, depthWrite: false }));
    spray.frustumCulled = false; spray.visible = false;
    room.group.add(mist, spray);
  }
  function sprayAtBed(i) {
    const b = bedRect(i); sprayAt = [b.cx, BED.h + 1.3, b.cz]; sprayT = 1.1; spray.visible = true;
    const a = spray.geometry.attributes.position.array;
    for (let k = 0; k < a.length; k += 3) { a[k] = sprayAt[0] + (Math.random() - 0.5) * 1.4; a[k + 1] = sprayAt[1] + Math.random() * 0.6; a[k + 2] = sprayAt[2] + (Math.random() - 0.5) * 2.2; }
    spray.geometry.attributes.position.needsUpdate = true;
  }
  function fx(dt) {
    const a = mist.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += Math.sin(clock * 0.3 + i) * 0.1 * dt; a[i + 1] += 0.12 * dt; a[i + 2] += Math.cos(clock * 0.25 + i * 0.7) * 0.1 * dt;
      if (a[i + 1] > 5.2) { a[i] = (Math.random() * 2 - 1) * (HW - 1); a[i + 1] = 0.5; a[i + 2] = (Math.random() * 2 - 1) * (HD - 1); }
    }
    mist.geometry.attributes.position.needsUpdate = true;
    if (sprayT > 0) {
      sprayT -= dt;
      const s = spray.geometry.attributes.position.array;
      for (let k = 0; k < s.length; k += 3) s[k + 1] -= (1.8 + (k % 5) * 0.3) * dt;
      spray.geometry.attributes.position.needsUpdate = true;
      spray.material.opacity = Math.max(0, Math.min(0.85, sprayT * 1.2));
      if (sprayT <= 0) spray.visible = false;
    }
  }

  // ---------- actions ----------
  const save = () => store.save(data);
  const nm = id => T.species[id].name;
  function menuFor(i) {
    const b = data.beds[i], t = now(), n = i + 1;
    if (b) advance(b, t);
    const lk = look(b, t), items = [], back = { label: T.back, quiet: true, fn: () => ui.close() };
    const tag = T.bed.replace("{n}", n);
    if (!b) {
      ORDER.forEach((id, k) => items.push({ label: nm(id), sub: T.minutes.replace("{n}", minutes(id)), key: String(k + 1), fn: () => sow(i, id) }));
      items.push(back);
      return { tag, title: T.free, line: T.freeLine, progress: null, items };
    }
    const line = lk.ready ? T.ready : lk.dry >= 1 ? T.resting : lk.thirsty ? T.thirsty : T.fine;
    if (lk.ready) items.push({ label: T.harvest, sub: nm(b.s), fn: () => harvest(i) });
    else items.push({ label: T.water, sub: lk.wet ? T.alreadyWet : T.waterSub, fn: () => sprinkle(i) });
    items.push({ label: T.clear, sub: T.clearSub, fn: () => clearBed(i) });
    items.push(back);
    return { tag, title: nm(b.s) + " · " + T.stage[lk.stage], line, progress: lk.f, items };
  }
  function sow(i, id) {
    data.beds[i] = plant(id, now()); save(); refresh(true); ui.close();
    ui.toast(T.planted.replace("{sp}", nm(id)));
  }
  function sprinkle(i) {
    const b = data.beds[i], t = now(); ui.close();
    if (!b) return;
    if (look(b, t).wet) { ui.toast(T.alreadyWet); return; }
    water(b, t); save(); refresh(true); sprayAtBed(i);
    ui.toast(T.watered.replace("{n}", i + 1));
  }
  function harvest(i) {
    const b = data.beds[i]; ui.close();
    if (!b) return;
    data.harvests++; data.beds[i] = null; save(); refresh(true);
    ui.toast(T.harvested.replace("{sp}", nm(b.s))); ui.badge(true, data.harvests);
  }
  function clearBed(i) {
    data.beds[i] = null; save(); refresh(true); ui.close();
    ui.toast(T.cleared.replace("{n}", i + 1));
  }

  // ---------- the level the player walks on while inside ----------
  function innerLevel() {
    const bd = room.bounds, ob = room.obstacles.map(o => [o[0] + OX, o[1] + OX, o[2] + OZ, o[3] + OZ]);
    return {
      y: Y0, bounds: [bd[0] + OX, bd[1] + OX, bd[2] + OZ, bd[3] + OZ], obstacles: ob,
      near(p) {
        if (!inside || fade) return null;
        let best = -1, bd2 = 1.9;
        for (let i = 0; i < BEDS; i++) {
          const b = bedRect(i), dx = Math.max(b.x0 + OX - p.x, 0, p.x - (b.x1 + OX)), dz = Math.max(b.z0 + OZ - p.z, 0, p.z - (b.z1 + OZ));
          const d = Math.hypot(dx, dz);
          if (d < bd2) { bd2 = d; best = i; }
        }
        if (Math.hypot(p.x - exitSpot.x, p.z - exitSpot.z) < 2.2) return cell("serre-out");
        if (best < 0) return null;
        const lk = looks[best];
        return bedPlace(best, !lk ? "free" : lk.ready ? "ready" : lk.thirsty ? "dry" : "grow");
      },
    };
  }

  // ---------- entering and leaving ----------
  function swapIn() {
    if (!room) {
      room = buildInterior(g);
      room.group.position.set(OX, Y0, OZ);
      buildPlants(); buildFx();
      g.stats.serreTris = room.tris;
    }
    data = store.load(now());
    looks = new Array(BEDS).fill(null);
    refresh(true);
    g.scene.add(room.group);
    g.level.setInner(innerLevel());
    g.level.setLevel("serre");
    const p = st();
    p.pos.set(OX, Y0 + HOVER, OZ - HD + 4.8); p.heading = Math.PI / 2; p.speed = 0; p.turnRate = 0;
    const r = g.player.ride; savedRate = r.rate; r.rate = 4; r.active = true;
    camBack = CAM_BACK; frameCamera(1); g.player.camera.snap();
    inside = true; poll = 0;
    ui.badge(true, data.harvests); sound.set(true);
  }
  function swapOut() {
    ui.close(); ui.badge(false, 0); sound.set(false);
    inside = false;
    g.level.setLevel("ground");
    g.scene.remove(room.group);
    const p = st(), d = place.door;
    p.pos.set(d[0], g.world.groundY(d[0], d[1]) + HOVER, d[1]); p.heading = place.facing; p.speed = 0; p.turnRate = 0;
    const r = g.player.ride; r.rate = savedRate; r.active = false;
    g.player.camera.snap();
  }
  function go(dir) {
    if (fade || ui.isOpen) return false;
    g.player.locked = true; const p = st(); p.speed = 0; p.turnRate = 0;
    fade = { dir: "out", t: 0, swap: dir > 0 ? swapIn : swapOut };
    return true;
  }

  function frameCamera(k) {
    const p = st(), r = g.player.ride;
    const ca = p.heading + Math.PI + 0.3, dx = Math.cos(ca), dz = Math.sin(ca); // a little off the axis: end-on he is only bars
    const xMin = OX - HW + 0.5, xMax = OX + HW - 0.5, zMin = OZ - HD + 0.5, zMax = OZ + HD - 0.5;
    let t = CAM_BACK;
    if (dx > 1e-4) t = Math.min(t, (xMax - p.pos.x) / dx); else if (dx < -1e-4) t = Math.min(t, (xMin - p.pos.x) / dx);
    if (dz > 1e-4) t = Math.min(t, (zMax - p.pos.z) / dz); else if (dz < -1e-4) t = Math.min(t, (zMin - p.pos.z) / dz);
    t = Math.max(0.9, t);
    camBack += (t - camBack) * (k >= 1 ? 1 : Math.min(1, k * (t < camBack ? 8 : 1.5)));
    const squeeze = 1 - camBack / CAM_BACK;
    r.pos.set(p.pos.x + dx * camBack, p.pos.y + 1.7 + 1.8 * squeeze, p.pos.z + dz * camBack);
    r.look.set(p.pos.x + Math.cos(p.heading) * 4, p.pos.y + 0.4, p.pos.z + Math.sin(p.heading) * 4);
  }

  const api = {
    get inside() { return inside; },
    get busy() { return !!fade; },
    enter() { return !inside && go(1); },
    exit() { return inside && go(-1); },
    interact(pl) {
      if (!inside || fade || ui.isOpen) return;
      if (pl.id === "serre-out") { api.exit(); return; }
      if (pl.bed != null) { g.player.locked = true; const p = st(); p.speed = 0; p.turnRate = 0; ui.menu(menuFor(pl.bed)); }
    },
    // hud.js: Esc closes the menu first
    escape() { return ui && ui.isOpen ? (ui.close(), g.player.locked = false, true) : false; },
    // debug / tests
    get data() { return data; },
    get room() { return room; },
    init() {
      ui = createSerreUi(g); sound = createSerreSound(g);
    },
    update(dt) {
      clock += dt;
      ui.update(dt);
      if (fade) {
        fade.t += dt;
        if (fade.dir === "out") {
          cover(smooth(fade.t / FADE));
          if (fade.t >= FADE) { fade.swap(); fade.dir = "in"; fade.t = 0; }
        } else {
          cover(1 - smooth(fade.t / FADE));
          if (fade.t >= FADE) { fade = null; cover(0); g.player.locked = false; st().speed = 0; }
        }
      }
      if (!inside) return;
      if (!ui.isOpen && !fade && g.player.locked) g.player.locked = false;
      poll -= dt;
      if (poll <= 0) { poll = 1; refresh(false); }
      frameCamera(Math.min(1, dt));
      fx(dt);
      sound.update(dt);
      // the menu closes when the player is moved away from the bed (never while locked, here for safety)
    },
    late() {
      if (!inside) return;
      const U = g.env.shade.uniforms;   // indoors: no snow on the plants, no wet sheen
      U.uSnow.value = 0; U.uWet.value = 0;
    },
    dispose() {
      if (inside) { try { g.level.setLevel("ground"); } catch (e) { /* ignore */ } const r = g.player.ride; if (r) { r.rate = savedRate; r.active = false; } }
      if (room) { g.scene.remove(room.group); room.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== g.env.shade.world && o.material !== g.env.shade.glass) o.material.dispose(); }); }
      disposePlants(); if (dotTex) dotTex.dispose();
      if (ui) ui.dispose(); if (sound) sound.dispose();
      room = null; inside = false;
    },
  };
  void wrap; void SPECIES; void DOOR;
  return api;
}
