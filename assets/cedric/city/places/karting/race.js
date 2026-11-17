// The race: menu, grid and start lights, three AI karts (the friends), laps and positions, the
// chase camera, the finish panel and the Esc flow. One state machine driven by update():
//   idle -> menu -> grid (lights) -> race -> done (finish panel) -> idle
// While it runs, Cédric is locked (controls are off) on level "ride" and the camera is directed
// through g.player.ride, exactly like the elevator. The state machine runs from update() (no timers),
// so closing the game mid-race leaves nothing behind. This system sits before the camera and
// Cédric in the engine order, so both see this frame's kart.
import * as THREE from "../../core/three.js";
import { buildCedric } from "../../player/cedric3d.js";
import * as L from "../../world/layout.js";
import * as C from "./circuit.js";
import { PHYS, buildKartGeometry, makeKart, placeKart, stepKart, bump, aiInput, kartMatrix, wrap, clamp } from "./kart.js";
import { createKartSound } from "./sound.js";
import { createKartHud } from "./hud.js";
import { createWorldMaterial } from "../../env/shade.js";

const LAPS = 3;
const GRID = [ // [back distance behind the line (m), lateral offset (m)] for Basile, Octave, Cédric, Firmin
  [6, -2.4], [6, 2.4], [13, -2.4], [13, 2.4],
];
const FRIENDS = [
  { name: "Basile", eye: "#86a8ff", len: 1.05, tint: [0.45, 0.62, 1.0], skill: 0.945, off: -0.6, wob: 0.8, slot: 0 },
  { name: "Octave", eye: "#45c97a", len: 1.25, tint: [0.27, 0.8, 0.48], skill: 0.93, off: 0.7, wob: 1.0, slot: 1 },
  { name: "Firmin", eye: "#f5c518", len: 1.15, tint: [0.96, 0.78, 0.1], skill: 0.915, off: 0.2, wob: 1.2, slot: 3 },
];
const PLAYER_TINT = [1.0, 0.28, 0.64];
const CORAL = "#ff6f55";
const SEAT = 0.74;                         // Cédric hovers this far above the kart floor
const SCALE = 0.75;                        // he is smaller in the kart
const FOV = 54;

export function createRace(g) {
  const T = g.text.kart, st = g.player.state;
  const karts = [makeKart("Cédric"), ...FRIENDS.map(f => makeKart(f.name))];
  const player = karts[0];
  const ride = () => g.player.ride;
  const cam = { h: 0, x: 0, y: 0, z: 0, fov: FOV, ready: false };
  const inp = { thr: 0, brk: 0, steer: 0, boost: false }, aiOut = { thr: 0, brk: 0, steer: 0, boost: false };
  const order = [0, 1, 2, 3], ordTmp = [0, 1, 2, 3];
  const m4 = new THREE.Matrix4();
  const door = L.places.find(p => p.id === "karting");
  let mesh = null, geo = null, mat = null, bodies = [], hud = null, sound = null;
  let state = "idle", mode = "race", laps = LAPS, nKarts = 4;
  let t = 0, gridT = 0, doneT = 0, paused = false, wasLocked = false, acc = 0, mapAcc = 0, hudAcc = 0;
  let newRecord = false, lastLap = 0, finalPlace = 0, sessionBest = 0;
  const finishOrder = []; // kart indices in the order they crossed the line
  const ground = (x, z) => g.world.groundY(x, z);

  // ---- helpers ---------------------------------------------------------------------------------------------------------
  const best = () => { const b = g.settings.get("kartBest"); return b > 0 ? b : 0; };
  function rank() {
    // finished karts first (by finish order), then everyone else by distance covered
    for (let i = 0; i < nKarts; i++) ordTmp[i] = i;
    for (let i = 1; i < nKarts; i++) {
      const v = ordTmp[i]; let j = i - 1;
      while (j >= 0 && ahead(v, ordTmp[j])) { ordTmp[j + 1] = ordTmp[j]; j--; }
      ordTmp[j + 1] = v;
    }
    for (let i = 0; i < nKarts; i++) order[i] = ordTmp[i];
  }
  function ahead(a, b) {
    const ka = karts[a], kb = karts[b];
    if (ka.finished || kb.finished) {
      if (ka.finished && kb.finished) return ka.finishT < kb.finishT;
      return ka.finished;
    }
    return ka.prog > kb.prog;
  }
  const placeOf = i => { for (let r = 0; r < nKarts; r++) if (order[r] === i) return r + 1; return nKarts; };

  function setRide(active) {
    const r = ride();
    if (r) r.active = active;
  }
  function lockPlayer(on) {
    if (on) { wasLocked = g.player.locked; g.player.locked = true; }
    else g.player.locked = false;
  }

  // ---- entering and leaving ------------------------------------------------------------------------------------------------
  function openMenu() {
    if (state !== "idle" || !hud) return;
    if (g.places && g.places.elevator && g.places.elevator.busy) return;
    state = "menu";
    lockPlayer(true); st.speed = 0; st.turnRate = 0;
    if (g.ui && g.ui.closeAll) g.ui.closeAll();
    hud.showMenu(best(), mode => startRace(mode), () => leave(true));
  }

  function startRace(m) {
    mode = m; laps = m === "race" ? LAPS : 1; nKarts = m === "race" ? 4 : 1;
    hud.hidePanel();
    state = "grid"; gridT = 0; t = 0; doneT = 0; paused = false; newRecord = false; lastLap = 0; sessionBest = 0;
    finishOrder.length = 0; acc = 0;
    // grid
    const slots = [GRID[2], GRID[0], GRID[1], GRID[3]]; // player, Basile, Octave, Firmin
    karts.forEach((k, i) => {
      const [back, l] = slots[i];
      placeKart(k, C.LENGTH - back, l, ground);
      k.prog = -back; k.lapIdx = -1; k.lapStart = -1; k.finished = false; k.finishT = 0; k.auto = false; k.bestLap = 0;
      if (i > 0) { const f = FRIENDS[i - 1]; k.skill = f.skill; k.off = f.off; k.wob = f.wob; k.phase = i * 2.1; k.react = 0.15 + 0.12 * i; k.lineScale = 1; }
    });
    // Cédric moves into the kart seat; the camera glides in from where he stood
    g.level.setLevel("ride"); g.level.rideFloor = player.y;
    setRide(true);
    const r = ride();
    if (r) { r.rate = 1.4; r.pos.copy(g.camera.position); r.look.set(st.pos.x, st.pos.y, st.pos.z); }
    cam.h = player.h; cam.ready = false; cam.fov = g.camera.fov;
    g.player.cedric.group.scale.setScalar(SCALE);
    syncVisuals(0);
    mesh.count = nKarts;
    for (const b of bodies) b.mesh.visible = false;
    for (let i = 0; i < nKarts - 1; i++) bodies[i].mesh.visible = true;
    mesh.visible = true;
    hud.showRace(mode, laps, nKarts);
    if (sound) sound.start();
    if (g.audio && g.audio.duck) g.audio.duck(0.55);
    rank();
  }

  // Back to the city on foot, at the pit door.
  function leave(fromMenu) {
    const wasRacing = state !== "menu" && state !== "idle";
    state = "idle"; paused = false;
    hud.hidePanel(); hud.hideRace();
    if (sound) sound.stop();
    if (g.audio && g.audio.duck) g.audio.duck(1);
    if (wasRacing) {
      const x = door.door[0] + Math.cos(door.facing) * 2.2, z = door.door[1] + Math.sin(door.facing) * 2.2;
      st.pos.set(x, ground(x, z) + 1.1, z); st.heading = door.facing; st.speed = 0; st.turnRate = 0;
      g.player.cedric.group.scale.setScalar(1);
      g.level.setLevel("ground");
      setRide(false);
      resetFov();
      if (mesh) mesh.visible = false;
      for (const b of bodies) b.mesh.visible = false;
    }
    lockPlayer(false);
    st.near = null; g.events.emit("near", null); // the prompt reappears on the next frame
    if (hud.root) hud.root.focus({ preventScroll: true });
  }
  function resetFov() { if (g.camera.fov !== FOV) { g.camera.fov = FOV; g.camera.updateProjectionMatrix(); } cam.fov = FOV; }

  // ---- finishing -----------------------------------------------------------------------------------------------------------
  function onLine(i, k, m) {
    // k crossed the line m times (m = 0 is the first crossing, the start of lap 1)
    if (i === 0 && m >= 1) {
      lastLap = t - k.lapStart;
      if (!sessionBest || lastLap < sessionBest) sessionBest = lastLap;
      const b = best();
      if (lastLap > 1 && (!b || lastLap < b)) { newRecord = true; g.settings.set("kartBest", +lastLap.toFixed(3)); }
    }
    k.lapStart = t;
    if (m >= laps && !k.finished) {
      k.finished = true; k.finishT = t; finishOrder.push(i);
      if (i === 0) { k.auto = true; doneT = 0; state = "done"; rank(); finalPlace = placeOf(0); }
    }
  }
  function showFinish() {
    rank();
    const standing = [];
    for (let r = 0; r < nKarts; r++) standing.push(karts[order[r]].name);
    hud.showFinish({
      mode, place: finalPlace, of: nKarts, total: player.finishT, bestLap: sessionBest, record: newRecord, stored: best(), standing,
    }, () => startRace(mode), () => leave(false));
  }

  // ---- visuals ---------------------------------------------------------------------------------------------------------------
  function syncVisuals(dt) {
    for (let i = 0; i < nKarts; i++) {
      const k = karts[i];
      mesh.setMatrixAt(i, kartMatrix(k, m4));
      if (i > 0) {
        const b = bodies[i - 1].mesh;
        b.position.set(k.x, k.y + SEAT * 0.82, k.z);
        b.rotation.set(k.roll * 0.8 + k.yaw * 0.05, -k.h, k.pitch);
        if (dt > 0) bodies[i - 1].swing(-k.yaw * 0.12, -Math.min(0.2, k.speed * 0.01));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    // the player's Cédric: the on-foot system draws him from the player state
    st.pos.set(player.x, player.y + SEAT, player.z);
    st.heading = player.h;
    st.turnRate = clamp(player.yaw * 0.8, -1.4, 1.4);
    st.speed = clamp(player.speed * 0.1, -0.9, 2.2);
    g.level.rideFloor = player.y;
  }

  function camera(dt) {
    const r = ride();
    if (!r) return;
    const k = player, sp = Math.hypot(k.vx, k.vz);
    // the view trails the direction of travel a little, so a drift shows
    const tgt = sp > 5 ? k.h + wrap(Math.atan2(k.vz, k.vx) - k.h) * 0.4 : k.h;
    if (!cam.ready) { cam.h = tgt; cam.ready = true; }
    cam.h += wrap(tgt - cam.h) * (1 - Math.exp(-dt * 3.2));
    const dist = 6.4 + sp * 0.045, hgt = 2.35 + sp * 0.014, cx = Math.cos(cam.h), cz = Math.sin(cam.h);
    const al = 0.42, bx = Math.cos(cam.h + al), bz = Math.sin(cam.h + al); // a little round the back: end-on, Cédric is only a stack of bars
    const px = k.x - bx * dist, pz = k.z - bz * dist;
    r.pos.set(px, Math.max(k.y + hgt, ground(px, pz) + 1.0), pz);
    r.look.set(k.x + cx * 5.5, k.y + 1.15, k.z + cz * 5.5);
    r.rate = Math.min(5.5, r.rate + dt * 2);
    const want = FOV + 6 * clamp(sp / PHYS.vmax, 0, 1) + (k.boostT > 0 ? 3 : 0);
    cam.fov += (want - cam.fov) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(g.camera.fov - cam.fov) > 0.02) { g.camera.fov = cam.fov; g.camera.updateProjectionMatrix(); }
  }

  // ---- simulation ------------------------------------------------------------------------------------------------------------
  function simulate(h) {
    const go = state === "race" || state === "done";
    // player input
    const ip = g.input;
    inp.thr = ip.fwd > 0 ? 1 : 0; inp.brk = ip.fwd < 0 ? 1 : 0; inp.steer = ip.turn;
    inp.boost = ip.down.has("ShiftLeft") || ip.down.has("ShiftRight");
    if (!go) { inp.thr = 0; inp.brk = 0; inp.boost = false; }
    if (player.auto) { // after the flag: coast round on the line at a quiet pace
      aiInput(player, t, 0.5, aiOut); stepKart(player, aiOut, h, ground, 0.6);
    } else stepKart(player, inp, h, ground);
    player.thr = inp.thr; player.brk = inp.brk;
    for (let i = 1; i < nKarts; i++) {
      const k = karts[i];
      if (!go || t < k.react) { aiOut.thr = 0; aiOut.brk = 0; aiOut.steer = 0; aiOut.boost = false; stepKart(k, aiOut, h, ground); continue; }
      // rubber band: keep the race close but beatable
      const gap = k.prog - player.prog;
      const rub = gap > 0 ? 1 - 0.12 * clamp(gap / 90, 0, 1) : 1 + 0.07 * clamp(-gap / 70, 0, 1);
      aiInput(k, t, k.finished ? 0.5 : rub, aiOut);
      stepKart(k, aiOut, h, ground, k.finished ? 0.6 : 1);
    }
    for (let a = 0; a < nKarts; a++) for (let b = a + 1; b < nKarts; b++) bump(karts[a], karts[b]);
    for (let i = 0; i < nKarts; i++) {
      const k = karts[i];
      const m = k.prog < 0 ? -1 : Math.floor(k.prog / C.LENGTH);
      if (m > k.lapIdx) { k.lapIdx = m; onLine(i, k, m); }
    }
  }

  const api = {
    name: "karting-race",
    get state() { return state; },
    karts,
    open: openMenu,
    startRace,
    leave: () => leave(false),
    get hud() { return hud; },
    // Esc: true when the race layer used it
    escape() {
      if (state === "idle") return false;
      if (state === "menu") { leave(true); return true; }
      if (state === "done" && hud.panelOpen) { leave(false); return true; }
      if (paused) { paused = false; hud.hidePanel(); if (sound) sound.pause(false); return true; }
      paused = true;
      if (sound) sound.pause(true);
      hud.showQuit(() => { paused = false; leave(false); }, () => { paused = false; if (sound) sound.pause(false); });
      return true;
    },
    init() {
      geo = buildKartGeometry(g.world);
      // like the city material but without the dithered window: karts, ground and track must never be cut away
      mat = createWorldMaterial(Object.assign({}, g.env.shade.uniforms, { uCut: { value: 0 } }));
      g.world.karting = { mat, circuit: C };
      mesh = new THREE.InstancedMesh(geo, mat, 4);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const col = new THREE.Color();
      [PLAYER_TINT, ...FRIENDS.map(f => f.tint)].forEach((c, i) => mesh.setColorAt(i, col.setRGB(c[0], c[1], c[2])));
      mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(295, 40, -184), 330); mesh.visible = false; mesh.name = "karts";   // karts stay on the circuit: sphere over the whole karting region
      g.scene.add(mesh);
      for (const f of FRIENDS) {
        const b = buildCedric(window.CEDRIC_DESIGN, { ink: CORAL, eye: f.eye }, f.len);
        b.mesh.rotation.order = "YXZ"; b.mesh.visible = false;
        g.scene.add(b.mesh); bodies.push(b);
      }
      hud = createKartHud(g);
      sound = createKartSound(g);
      g.kart = api;
      g.stats.tris += geo.userData.tris * 4;
      g.stats.kartTris = geo.userData.tris * 4;
    },
    update(dt) {
      if (state === "idle") return;
      if (state === "menu") { hud.keys(); return; }
      if (paused) { hud.keys(); camera(0.0001); return; }
      if (state === "grid") {
        gridT += dt;
        hud.lights(gridT);
        if (gridT >= 4.0) { state = "race"; t = 0; hud.go(); }
      }
      if (state === "race" || state === "done") t += dt;
      if (state === "done") { doneT += dt; if (doneT > 1.9 && !hud.panelOpen) showFinish(); }
      const n = Math.ceil(dt / 0.0167); // two or three substeps keep the physics steady at low frame rates
      acc = dt / n;
      for (let i = 0; i < n; i++) simulate(acc);
      rank();
      syncVisuals(dt);
      camera(dt);
      hudAcc += dt;
      if (hudAcc > 0.05) {
        hudAcc = 0;
        hud.update({
          mode, laps, nKarts, t, lapIdx: player.lapIdx, lapStart: player.lapStart, place: placeOf(0), speed: Math.abs(player.speed), boost: player.boostT > 0 ? 1 : 1 - clamp(player.cd / (PHYS.boostTime + PHYS.boostCooldown), 0, 1) * 1,
          boostActive: player.boostT > 0, best: best(), state,
        });
        hud.map(karts, nKarts, dt);
      }
      if (sound) sound.update(dt, player, state === "race" || state === "done" ? inp.thr : 0);
      hud.keys();
    },
    dispose() {
      if (state !== "idle") { try { leave(false); } catch (e) { /* ignore */ } }
      if (sound) sound.dispose();
      if (hud) hud.dispose();
      if (mesh) { g.scene.remove(mesh); mesh.dispose(); }
      if (geo) geo.dispose();
      if (mat) mat.dispose();
      if (g.world.karting && g.world.karting.mat === mat) delete g.world.karting;
      for (const b of bodies) { g.scene.remove(b.mesh); b.dispose(); }
      bodies = [];
      if (g.kart === api) delete g.kart;
    },
  };
  return api;
}
