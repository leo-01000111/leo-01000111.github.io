// The glider flight, from the hangar door to the landing. One system, g.flight:
//   ground -> panel ("Décoller") -> fade -> launch (hold, winch roll, climb, release) -> fly -> land
//   (assisted: a smooth path to the aiming point, then the roll-out) -> on foot again.
// Esc in the air first asks "Rentrer à l'aérodrome ?"; yes fades out and puts Cédric back on foot at the
// hangar door. Camera: the shared ride override (g.player.ride), a chase view banked a little with the
// aircraft. Cédric's own body is hidden in flight, the glider carries a second copy in the cockpit.
import * as THREE from "../../core/three.js";
import * as L from "../../world/layout.js";
import { SEA_Y } from "../../world/layout.js";
import { liftAt } from "./air.js";
import { createState, step } from "./model.js";
import { createGliderObject, GLIDER } from "./glider.js";
import { createFlightHud } from "./hud.js";
import { createWindSound } from "./sound.js";
import { createAirViz } from "./airviz.js";

const A = L.aerodrome, NORTH = -Math.PI / 2, WHEEL_Y = 0.03 + 0.56;
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const IN_AIR = new Set(["launch", "fly", "land", "rollout", "landed"]);

export function createFlight(g) {
  const T = g.text.flight, st = g.player.state;
  const s = createState();
  let mode = "ground", tMode = 0, now = 0, paused = false, glider = null, hud = null, snd = null, viz = null;
  let ride = null, rideRate = 1.1, camPsi = NORTH, camSide = 0, bank = 0, offKey = null;
  const launch = { phase: 0, t: 0, V: 0, gamma: 0, x: 0, y: 0, z: 0 };
  const land = { V0: 0, u: 0, x0: 0, z0: 0, y0: 0, mx0: 0, mz0: 0, mx1: 0, mz1: 0, V: 0, v: 0, t: 0, psi: 0, phi: 0, pitch: 0, L: 0 };
  const V3 = THREE.Vector3, cam = { p: new V3(), l: new V3() };
  let gliderY = 0;

  // ---- what is below: sea, ground, roofs (colliders), the terraced backdrop -------------------------------
  const bd = L.backdrop;
  function backdropTop(x, z) {
    let top = 0;
    for (let i = 0; i < bd.length; i++) {
      const [x0, x1, z0, z1, n] = bd[i];
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      for (let t = 0; t < n; t++) {
        const o = t * 5.5;
        if (x1 - x0 - 2 * o < 8 || z1 - z0 - 2 * o < 8) break;
        if (x >= x0 + o && x <= x1 - o && z >= z0 + o * 0.8 && z <= z1 - o * 0.8) top = (t + 1) * 16 + 1.6;
      }
    }
    return top;
  }
  // surface height under (x, z); env.margin = how far above it the glider wants to stay
  const env = {
    margin: 6,
    lift: (x, y, z) => liftAt(x, y, z, now),
    surf(x, z) {
      const gy = g.world.groundY(x, z);
      let h = gy, m = gy <= SEA_Y + 0.02 ? 4.5 : 7;
      const top = g.world.collide.topAt(x, z);
      if (top > gy + 1) { h = top; m = 10; }
      if (x > 245) { const b = backdropTop(x, z); if (b > h) { h = b; m = 10; } }
      env.margin = m;
      return h;
    },
  };

  // ---- cockpit, camera -----------------------------------------------------------------------------------
  function showCedric(inCockpit) {
    const c = g.player.cedric;
    if (c) c.group.visible = !inCockpit;
    if (glider) glider.cedric.mesh.visible = inCockpit;
  }
  function place(x, y, z, psi, phi, pitch, brake) {
    glider.set(x, y, z, psi, phi, pitch, brake);
    gliderY = y; glider.psi = psi;
    st.pos.set(x, y + 0.45, z); st.heading = psi; st.speed = 0; st.turnRate = 0;
  }
  function chase(dt, snap) {
    const a = snap ? 1 : 1 - Math.exp(-dt * 1.6);
    const psi = glider.psi;
    camPsi = snap ? psi : camPsi + wrap(psi - camPsi) * a;
    camSide += ((mode === "launch" ? (launch.phase < 3 ? -5.5 : -2) : 0) - camSide) * (snap ? 1 : 1 - Math.exp(-dt * 0.5));
    const V = mode === "fly" ? s.V : 27;
    const dist = 15.5 + (V - 27) * 0.12, hgt = 4.8 + (mode === "land" ? 0.5 : 0);
    const c = Math.cos(camPsi), si = Math.sin(camPsi), gx = st.pos.x, gy = gliderY, gz = st.pos.z;
    cam.p.set(gx - c * dist - si * camSide, gy + hgt, gz - si * dist + c * camSide);
    const floor = env.surf(cam.p.x, cam.p.z) + 2.5;
    if (cam.p.y < floor) cam.p.y = floor;
    cam.l.set(gx + c * 15, gy + 1.0 + (mode === "fly" ? clamp(s.pitch, -0.3, 0.3) * 6 : 0), gz + si * 15);
    ride.pos.copy(cam.p); ride.look.copy(cam.l);
  }
  function enterAir() {
    ride = g.player.ride;
    if (ride) { rideRate = ride.rate; ride.rate = 3.2; ride.active = true; }
    g.player.locked = true;
    showCedric(true);
    glider.group.visible = true;
    hud.show(true);
  }
  function leaveAir() {
    if (ride) { ride.active = false; ride.rate = rideRate; }
    hud.show(false); hud.prompt(null);
    showCedric(false);
    if (snd) snd.set(false, 0);
  }
  function park() { // glider ready at the winch end of the runway, nobody in it
    glider.cedric.mesh.visible = false;
    glider.group.visible = true;
    glider.set(A.start.x, WHEEL_Y, A.start.z, NORTH, 0, 0.0, 0);
    glider.psi = NORTH;
  }
  function onFoot(x, z, heading) {
    st.pos.set(x, g.world.groundY(x, z) + 1.1, z);
    st.heading = heading; st.speed = 0; st.turnRate = 0;
    g.player.locked = false;
    g.events.emit("near", null);
  }

  // ---- phases ------------------------------------------------------------------------------------------------
  function beginLaunch() {
    mode = "launch";
    Object.assign(launch, { phase: 0, t: 0, V: 0, gamma: 0, x: A.start.x, y: WHEEL_Y, z: A.start.z });
    enterAir();
    glider.psi = NORTH; camSide = -5.5;
    place(launch.x, launch.y, launch.z, NORTH, 0, 0, 0);
    if (g.player.camera) g.player.camera.snap();
    chase(0, true);
    hud.fade(0, 900);
  }
  function startFlight(x, y, z, psi, V) { // free flight from a given state (also used by tests)
    Object.assign(s, { x, y, z, psi, phi: 0, V, Vt: Math.max(27, V * 0.9), vz: -1, vzF: -1, brake: 0, stall: 0, cushion: 0, pitch: -0.02, gamma: 0, bounds: 0 });
    glider.psi = psi;
    mode = "fly";
  }
  function stepLaunch(dt) {
    const l = launch;
    l.t += dt;
    if (l.phase === 0) { if (l.t > 2.4) { l.phase = 1; l.t = 0; hud.note(T.winch); } }
    else if (l.phase === 1) { // winch roll
      l.V = Math.min(l.V + 6.4 * dt, 27);
      l.z -= l.V * dt;
      if (l.V >= 24.6) { l.phase = 2; l.t = 0; }
    } else if (l.phase === 2) { // the cable lifts it: steep climb
      l.gamma += (0.7 - l.gamma) * (1 - Math.exp(-dt / 0.8));
      l.V += (31 - l.V) * (1 - Math.exp(-dt / 1.5));
      l.y += l.V * Math.sin(l.gamma) * dt; l.z -= l.V * Math.cos(l.gamma) * dt;
      if (l.y > 105) { l.phase = 3; l.t = 0; hud.note(T.release, 2600); }
    } else { // release: push over to level flight
      l.gamma += (-0.04 - l.gamma) * (1 - Math.exp(-dt / 0.9));
      l.V += (28.5 - l.V) * (1 - Math.exp(-dt / 1.5));
      l.y += l.V * Math.sin(l.gamma) * dt; l.z -= l.V * Math.cos(l.gamma) * dt;
      if (l.t > 3 && Math.abs(l.gamma) < 0.1) { startFlight(l.x, l.y, l.z, NORTH, l.V); return; }
    }
    const pitch = l.phase === 0 ? 0 : l.phase === 1 ? 0.03 + 0.05 * smooth((l.V - 18) / 7) : l.gamma + 0.09;
    place(l.x, l.y, l.z, NORTH, 0, pitch, 0);
    bank = 0;
    hud.stats(l.y, l.V * 3.6, l.phase >= 2 ? l.V * Math.sin(l.gamma) : 0);
    if (snd) snd.set(true, l.V * (l.phase < 1 ? 0 : 1));
  }

  // landing zone: south of the aiming point, aligned with the runway, low enough for the glide path
  function inZone() {
    const dx = s.x - A.touch.x, dz = s.z - A.touch.z, D = Math.hypot(dx, dz);
    return s.z > A.touch.z + 10 && s.z < 405 && Math.abs(s.x - A.runway.x) < 85 && D > 30 && -Math.sin(s.psi) > 0.34 && s.y < 20 + 0.5 * D;
  }
  function beginLanding() {
    mode = "land";
    const l = land, dx = A.touch.x - s.x, dz = A.touch.z - s.z, D = Math.hypot(dx, dz);
    l.x0 = s.x; l.z0 = s.z; l.y0 = s.y; l.u = 0; l.t = 0; l.V = s.V; l.V0 = s.V; l.psi = s.psi; l.phi = s.phi; l.pitch = s.pitch; l.v = 0;
    l.mx0 = Math.cos(s.psi) * D * 1.0; l.mz0 = Math.sin(s.psi) * D * 1.0;   // leave along the current track, arrive heading north
    l.mx1 = 0; l.mz1 = -D * 1.0;
    s.brake = 1;
    hud.note(T.landing, 3000); hud.prompt(null);
  }
  const hermX = u => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * land.x0 + (u3 - 2 * u2 + u) * land.mx0 + (-2 * u3 + 3 * u2) * A.touch.x + (u3 - u2) * land.mx1; };
  const hermZ = u => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * land.z0 + (u3 - 2 * u2 + u) * land.mz0 + (-2 * u3 + 3 * u2) * A.touch.z + (u3 - u2) * land.mz1; };
  const dHermX = u => { const u2 = u * u; return (6 * u2 - 6 * u) * land.x0 + (3 * u2 - 4 * u + 1) * land.mx0 + (-6 * u2 + 6 * u) * A.touch.x + (3 * u2 - 2 * u) * land.mx1; };
  const dHermZ = u => { const u2 = u * u; return (6 * u2 - 6 * u) * land.z0 + (3 * u2 - 4 * u + 1) * land.mz0 + (-6 * u2 + 6 * u) * A.touch.z + (3 * u2 - 2 * u) * land.mz1; };
  function stepLanding(dt) {
    const l = land;
    l.t += dt;
    // speed settles to 22 m/s over the first half of the path; the air brakes are out
    l.V += (Math.max(19, 22 + (l.V0 - 22) * (1 - smooth(l.u / 0.5))) - l.V) * (1 - Math.exp(-dt * 1.5));
    const dm = Math.max(Math.hypot(dHermX(l.u), dHermZ(l.u)), 1);
    l.u = Math.min(1, l.u + l.V * dt / dm);
    const x = hermX(l.u), z = hermZ(l.u), h = Math.max(WHEEL_Y, WHEEL_Y + (l.y0 - WHEEL_Y) * Math.pow(1 - l.u, 1.7));
    const psi = Math.atan2(dHermZ(l.u), dHermX(l.u)), dpsi = wrap(psi - l.psi);
    l.psi += dpsi * (1 - Math.exp(-dt * 6));
    l.phi += (clamp(Math.atan(dpsi / Math.max(dt, 1e-3) * l.V / 9.81), -0.6, 0.6) - l.phi) * (1 - Math.exp(-dt * 2));
    const vz = (h - gliderY) / Math.max(dt, 1e-3), gamma = Math.atan2(vz, l.V), flare = smooth((l.u - 0.9) / 0.1);
    l.pitch += ((clamp(gamma, -0.4, 0.1) + 0.09 + flare * 0.1) - l.pitch) * (1 - Math.exp(-dt * 3));
    s.brake += (1 - s.brake) * (1 - Math.exp(-dt * 2));
    place(x, h, z, l.psi, l.phi, l.pitch, s.brake);
    bank = l.phi;
    hud.stats(h, l.V * 3.6, clamp(vz, -9, 9));
    if (snd) snd.set(true, l.V);
    if (l.u >= 1) { mode = "rollout"; l.v = l.V; }
  }
  function stepRollout(dt) {
    const l = land;
    l.v = Math.max(0, l.v - 3.4 * dt);
    const z = st.pos.z - l.v * dt;
    l.pitch += (0.0 - l.pitch) * (1 - Math.exp(-dt * 2)); l.phi += (0 - l.phi) * (1 - Math.exp(-dt * 2));
    l.psi += wrap(NORTH - l.psi) * (1 - Math.exp(-dt * 3));
    glider.psi = l.psi;
    place(A.touch.x + (st.pos.x - A.touch.x) * 0.98, WHEEL_Y, z, l.psi, l.phi, l.pitch, 1);
    bank = 0;
    hud.stats(0.6, l.v * 3.6, 0);
    if (snd) snd.set(true, l.v);
    if (l.v < 0.05) { mode = "landed"; tMode = 0; hud.note(T.landed, 3500); }
  }
  function stepLanded(dt) {
    tMode += dt;
    if (snd) snd.set(false, 0);
    if (tMode < 1.6) return;
    // Cédric steps out beside the wing tip, facing the glider
    leaveAir();
    glider.cedric.mesh.visible = false;
    glider.set(st.pos.x, WHEEL_Y, st.pos.z, NORTH, 0, 0, 0);
    onFoot(A.runway.x + 11.4, st.pos.z, Math.PI);
    mode = "ground";
  }

  function stepFly(dt) {
    const inp = g.input;
    if (!paused) {
      const ctl = { pitch: inp.fwd, roll: inp.turn, brake: inp.down.has("ShiftLeft") || inp.down.has("ShiftRight") ? 1 : 0 };
      step(s, ctl, env, dt);
    }
    const wob = Math.sin(now * 1.7) * 0.012 + Math.sin(now * 0.63 + 1) * 0.008;
    bank = s.phi;
    glider.psi = s.psi;
    place(s.x, s.y, s.z, s.psi, s.phi + wob, s.pitch + wob * 0.5, s.brake);
    hud.stats(s.y, s.V * 3.6, s.vzF);
    if (snd) snd.set(!paused, s.V, Math.abs(s.w) * 0.5);
    const z = inZone();
    hud.prompt(z && !paused ? T.land : null);
    // the antennae stream back a little
    glider.cedric.swing(-bank * 0.2, -0.25 - (s.V - 20) * 0.01);
  }

  // ---- fades, home ----------------------------------------------------------------------------------------
  function goHome() {
    hud.closeConfirm(); paused = false;
    mode = "fadeHome"; tMode = 0;
    hud.fade(1, 700);
  }
  function returnHome() {
    leaveAir();
    park();
    const pl = L.places.find(p => p.id === "aerodrome");
    onFoot(pl.door[0] - 1.8, pl.door[1], Math.PI);   // under the porch's edge, facing the runway
    if (g.player.camera) g.player.camera.snap();
    hud.fade(0, 900);
    mode = "ground";
  }
  function openConfirm() { paused = true; hud.openConfirm(); }
  function resume() { hud.closeConfirm(); paused = false; }

  const api = {
    name: "flight",
    get mode() { return mode; },
    get active() { return IN_AIR.has(mode); },
    state: s,
    openPanel() {
      if (mode !== "ground" || g.player.locked) return;
      g.player.locked = true;
      mode = "panel";
      hud.openPanel();
    },
    // Esc: close the panel, ask before leaving the air. false = nothing of ours is open (the game may close).
    escape() {
      if (hud.confirmOpen) { resume(); return true; }
      if (mode === "panel") { hud.closePanel(); g.player.locked = false; mode = "ground"; return true; }
      if (IN_AIR.has(mode)) { openConfirm(); return true; }
      if (mode === "fadeOut" || mode === "fadeHome") return true;
      return false;
    },
    // tests: start free flight at once
    dev: { fly(x, y, z, psi, V = 28) { if (mode !== "ground" && mode !== "panel") return; if (mode === "panel") { hud.closePanel(); } enterAir(); showCedric(true); startFlight(x, y, z, psi, V); if (g.player.camera) g.player.camera.snap(); chase(0, true); }, land: () => { if (mode === "fly") beginLanding(); }, inZone },
    init() {
      glider = createGliderObject(g);
      glider.psi = NORTH;
      g.stats.tris += glider.tris;
      hud = createFlightHud(g, {
        onTakeoff() { hud.closePanel(); mode = "fadeOut"; tMode = 0; hud.fade(1, 700); },
        onStay() { hud.closePanel(); g.player.locked = false; mode = "ground"; },
        onHome: goHome, onResume: resume,
      });
      snd = createWindSound(g);
      viz = createAirViz(g); viz.init();
      park();
      g.flight = api;
      const onKey = e => {
        if (e.code !== "Space" || e.repeat || mode !== "fly" || paused) return;
        if (e.target && e.target.closest && e.target.closest(".ccity button")) return;
        if (inZone()) beginLanding(); else hud.note(T.notYet);
      };
      addEventListener("keydown", onKey, true);   // capture: input.js stops Space from bubbling
      offKey = () => removeEventListener("keydown", onKey, true);
    },
    update(dt, t) {
      now = t;
      viz.set(t);
      if (mode === "ground" || mode === "panel") return;
      if (mode === "fadeOut") { tMode += dt; if (tMode > 0.85) beginLaunch(); return; }
      if (mode === "fadeHome") { tMode += dt; if (tMode > 0.85) returnHome(); return; }
      if (mode === "launch") { if (!paused) stepLaunch(dt); }
      else if (mode === "fly") stepFly(dt);
      else if (mode === "land") { if (!paused) stepLanding(dt); }
      else if (mode === "rollout") { if (!paused) stepRollout(dt); }
      else if (mode === "landed") { if (!paused) stepLanded(dt); }
      if (IN_AIR.has(mode) && glider) chase(dt, false);
    },
    // after the camera has looked: bank the view a little with the aircraft
    late() {
      if (!(IN_AIR.has(mode) && ride && ride.active)) return;
      g.camera.rotateZ(-bank * 0.33);
      // from up here the haze thins a little, so the city reads below the sunset
      const U = g.env.shade.uniforms;
      U.uFogDen.value *= 1 - 0.42 * smooth((gliderY - 20) / 160);
    },
    dispose() {
      if (offKey) offKey();
      if (ride) { ride.active = false; ride.rate = rideRate; }
      const c = g.player.cedric;
      if (c) c.group.visible = true;
      if (snd) snd.dispose();
      if (hud) hud.dispose();
      if (viz) viz.dispose();
      if (glider) glider.dispose();
      if (g.flight === api) delete g.flight;
    },
  };
  return api;
}
