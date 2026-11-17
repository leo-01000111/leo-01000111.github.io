// Le Port: what happens at the pontoon. Space opens a small panel ("Larguer les amarres"); Cédric
// glides aboard, the launch pushes off and he sails it: W forward, S back, A / D rudder, with
// inertia, over the same swell the sea draws. Near the pontoon "Espace — accoster" glides the boat
// home (assisted); Esc asks "Rentrer au port ?" and a second Esc brings him back on foot (a flat
// fade, no cut). Scripted like the elevator: g.player.locked, the camera override g.player.ride and
// g.level "ride" while afloat; update() only, no timers, so closing the game mid-sail leaves nothing.
import * as THREE from "../../core/three.js";
import * as L from "../../world/layout.js";
import { createBoat, MAX_FWD } from "./boat.js";
import { LAUNCH } from "./models.js";
import { createPortSound } from "./sound.js";

const PT = L.port, SEA = L.SEA_Y, HOVER = 1.1, ABOVE_DECK = 0.95;
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoother = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const T_BOARD = 2.6, T_OUT = 2.4, T_FADE = 0.9, PUSH = 2.6;

export function createPortPlace(g) {
  const st = g.player.state, V3 = THREE.Vector3, T = g.text.port;
  const ride = g.player.ride || (g.player.ride = { active: false, pos: new V3(), look: new V3(), rate: 1.1 });
  const boat = createBoat();
  const sound = createPortSound(g);
  const pose = { x: PT.berth.x, y: SEA, z: PT.berth.z, h: PT.berth.heading, pitch: 0, roll: 0 };
  const from = { x: 0, y: 0, z: 0, h: 0 }, deck = { x: 0, y: 0, z: 0 }, dst = { x: 0, y: 0, z: 0 };
  let P = null, lastT = 0, mode = "ashore", clock = 0, push = 0, camH = 0, asking = 0, hintLeft = 0;
  let panelOpen = false, panelCooldown = 0, dock = null, fadeEl = null, promptEl = null, panelEl = null, rootEl = null;
  let spaceHit = false, origEscape = null, hooked = false, smoothThr = 0, msgKey = "", lastBump = 0;
  const off = [];

  // ---- DOM: the panel, the one-line message, the fade ----
  function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function build() {
    rootEl = g.hud.closest(".ccity");
    panelEl = mk("div", "ccity__soon"); panelEl.hidden = true; panelEl.setAttribute("role", "dialog"); panelEl.setAttribute("aria-label", T.title);
    panelEl.style.setProperty("--neon", PT.neon);
    const row = mk("div"); row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap";
    const later = mk("button", "ccity__btn", T.later), cast = mk("button", "ccity__btn", T.cast);
    later.type = cast.type = "button"; later.style.padding = cast.style.padding = "8px 14px";
    cast.style.borderColor = PT.neon;
    later.addEventListener("click", () => closePanel()); cast.addEventListener("click", () => confirm());
    row.append(later, cast);
    panelEl.append(mk("p", "ccity__tag", T.tag), mk("h2", "", T.title), mk("p", "", T.text), mk("p", "ccity__hintline", T.hint), row);
    promptEl = mk("div", "ccity__prompt"); promptEl.setAttribute("role", "status"); promptEl.setAttribute("aria-live", "polite");
    promptEl.style.setProperty("--neon", PT.neon);
    fadeEl = mk("div"); fadeEl.style.cssText = "position:absolute;inset:0;background:#0a0c13;opacity:0;pointer-events:none;transition:opacity " + T_FADE + "s ease";
    g.hud.append(panelEl, promptEl, fadeEl);
    panelEl._cast = cast;
  }
  function openPanel() {
    if (panelOpen || mode !== "ashore" || panelCooldown > 0) return;
    if (g.ui && g.ui.closeAll) g.ui.closeAll();
    panelOpen = true; panelEl.hidden = false;
    requestAnimationFrame(() => { if (panelOpen) panelEl.classList.add("is-on"); });
  }
  function closePanel() {
    if (!panelOpen) return false;
    panelOpen = false; panelEl.classList.remove("is-on"); panelCooldown = 0.4;
    setTimeout(() => { if (!panelOpen && panelEl) panelEl.hidden = true; }, 260);
    if (rootEl) rootEl.focus({ preventScroll: true });
    return true;
  }
  function say(key, a, b) {
    if (key === msgKey) return;
    msgKey = key;
    if (!key) { promptEl.classList.remove("is-on"); return; }
    promptEl.textContent = "";
    const s1 = mk("span", "", a); promptEl.appendChild(s1);
    if (b) { const s2 = mk("span", "", b); s2.style.cssText = "opacity:.62;margin-left:14px;font-weight:400"; promptEl.appendChild(s2); }
    promptEl.classList.add("is-on");
  }

  // ---- poses ----
  function poseBoat(t) {
    const w = P.wave(boat.x, boat.z, t), c = Math.cos(boat.h), s = Math.sin(boat.h);
    pose.x = boat.x; pose.z = boat.z; pose.h = boat.h;
    pose.y = SEA + w.y * 0.9 + 0.04 + Math.min(1, Math.abs(boat.u) / 6.6) * 0.07;
    pose.pitch = 1.5 * (w.gx * c + w.gz * s) + 0.014 * boat.u;
    pose.roll = 1.5 * (w.gx * s - w.gz * c) + 0.022 * boat.r * boat.u;
    P.setPose(P.launches, 0, pose.x, pose.y, pose.z, pose.h, pose.pitch, pose.roll);
    P.place(pose);
    g.level.rideFloor = pose.y + LAUNCH.deckY;
  }
  function deckPoint() {
    deck.x = pose.x + Math.cos(pose.h) * LAUNCH.helm; deck.z = pose.z + Math.sin(pose.h) * LAUNCH.helm;
    deck.y = pose.y + LAUNCH.deckY + ABOVE_DECK;
    return deck;
  }
  function putOnBoat(dt) {
    const d = deckPoint();
    st.pos.set(d.x, d.y, d.z);
    st.heading = pose.h; st.speed = boat.u; st.turnRate = boat.r * 1.5;
  }
  function camera(dt, t, snap) {
    camH += wrap(boat.h - camH) * (snap ? 1 : 1 - Math.exp(-dt * 1.4));
    const dx = Math.cos(camH), dz = Math.sin(camH), dist = 8.4 + 0.22 * Math.abs(boat.u), side = Math.sin(t * 0.17) * 0.9;
    ride.pos.set(pose.x - dx * dist - dz * side, SEA + 2.45 + 0.07 * Math.abs(boat.u) + Math.sin(t * 0.23) * 0.2, pose.z - dz * dist + dx * side);
    ride.look.set(pose.x + dx * 6.5, pose.y + 1.35, pose.z + dz * 6.5);
    ride.rate = 3.4;
  }
  const glide = (a, b, e) => { st.pos.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, a.z + (b.z - a.z) * e); };

  // ---- flow ----
  function confirm() {
    if (mode !== "ashore") return;
    closePanel();
    mode = "boarding"; clock = 0;
    boat.reset(PT.berth.x, PT.berth.z, PT.berth.heading);
    P.player.active = true; camH = boat.h;
    g.player.locked = true; st.speed = 0; st.turnRate = 0;
    g.level.setLevel("ride");
    ride.active = true;
    from.x = st.pos.x; from.y = st.pos.y; from.z = st.pos.z; from.h = st.heading;
    asking = 0; push = PUSH; hintLeft = 0;
    poseBoat(lastT); camera(0.016, lastT, true); // the camera override must be valid before the camera system reads it
  }
  function startDock() {
    const q = PT.berth, u0 = Math.max(0, boat.u), dx = q.x - boat.x, dz = q.z - boat.z, dist = Math.hypot(dx, dz);
    const L0 = Math.max(6, dist * 0.9), T1 = Math.max(6, dist * 0.8), D = clamp(dist / 2 + 2, 5, 11);
    const v0 = Math.min(u0 / L0, 1.6 / D), a = v0, b = (3 / D - 2 * a) / D, c = (a * D - 2) / (D * D * D);
    dock = { x0: boat.x, z0: boat.z, tx0: Math.cos(boat.h) * L0, tz0: Math.sin(boat.h) * L0, tx1: Math.cos(q.heading) * T1, tz1: Math.sin(q.heading) * T1, a, b, c, D, t: 0 };
    mode = "docking"; clock = 0; asking = 0;
  }
  function stepDock(dt) {
    const d = dock, q = PT.berth;
    d.t = Math.min(d.D, d.t + dt);
    const t = d.t, s = d.a * t + d.b * t * t + d.c * t * t * t, ds = d.a + 2 * d.b * t + 3 * d.c * t * t;
    const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const x = h00 * d.x0 + h10 * d.tx0 + h01 * q.x + h11 * d.tx1, z = h00 * d.z0 + h10 * d.tz0 + h01 * q.z + h11 * d.tz1;
    const g00 = 6 * s2 - 6 * s, g10 = 3 * s2 - 4 * s + 1, g01 = -6 * s2 + 6 * s, g11 = 3 * s2 - 2 * s;
    const vx = g00 * d.x0 + g10 * d.tx0 + g01 * q.x + g11 * d.tx1, vz = g00 * d.z0 + g10 * d.tz0 + g01 * q.z + g11 * d.tz1;
    const sp = Math.hypot(vx, vz);
    const prevH = boat.h;
    boat.x = Math.min(x, PT.quay.x0 - 1.4); boat.z = z;
    if (sp > 0.05) boat.h = Math.atan2(vz, vx);
    boat.u = sp * Math.max(0, ds); boat.vx = Math.cos(boat.h) * boat.u; boat.vz = Math.sin(boat.h) * boat.u;
    boat.r = wrap(boat.h - prevH) / Math.max(dt, 1e-3);
    if (d.t >= d.D) {
      boat.reset(q.x, q.z, q.heading);
      mode = "deboarding"; clock = 0; dock = null;
      poseBoat(performance.now() / 1000);
      from.x = st.pos.x; from.y = st.pos.y; from.z = st.pos.z; from.h = st.heading;
    }
  }
  function backAshore() {
    mode = "ashore"; clock = 0;
    P.player.active = false; P.wake.clear();
    boat.reset(PT.berth.x, PT.berth.z, PT.berth.heading);
    g.level.setLevel("ground");
    g.player.locked = false; ride.active = false;
    st.speed = 0; st.turnRate = 0; st.heading = wrap(st.heading);
    msgKey = ""; say("");
    g.events.emit("ride", "ground");
  }
  function startReturn() {
    mode = "returning"; clock = 0; asking = 0;
    fadeEl.style.opacity = "1";
  }
  function stepReturn(dt, t) {
    clock += dt;
    if (clock >= T_FADE && fadeEl.style.opacity === "1") {
      // dark: the launch is back at its berth, Cédric on the pontoon, then the light comes back
      boat.reset(PT.berth.x, PT.berth.z, PT.berth.heading);
      P.player.active = false; P.wake.clear();
      const sx = PT.stand[0], sz = PT.stand[1];
      st.pos.set(sx, g.world.groundY(sx, sz) + HOVER, sz); st.heading = Math.PI; st.speed = 0; st.turnRate = 0;
      g.level.setLevel("ground"); g.player.locked = false; ride.active = false;
      if (g.player.camera) g.player.camera.snap();
      fadeEl.style.opacity = "0";
      mode = "ashore"; msgKey = ""; say("");
    }
  }

  function escape() {
    if (panelOpen) { closePanel(); return true; }
    if (mode === "sailing") {
      if (asking > 0) startReturn(); else asking = 6;
      return true;
    }
    return mode !== "ashore"; // boarding, docking, returning: nothing to cancel, but the game stays open
  }

  const api = {
    name: "port",
    get sailing() { return mode !== "ashore" && mode !== "returning"; },
    get mode() { return mode; },
    get boat() { return boat; },
    enter() { if (panelOpen) confirm(); else openPanel(); },
    // the big map shows the open water while afloat
    mapExtent(ext) {
      const S = PT.sail;
      if (mode !== "ashore") { ext.x0 = S.x0 - 12; ext.z0 = S.z0 - 12; ext.z1 = Math.max(S.z1 + 12, L.world.z1 + 6); } else { ext.x0 = -104; ext.z0 = L.world.z0 - 6; ext.z1 = L.world.z1 + 6; }
      ext.x1 = L.world.x1 + 6;
    },
    init() {
      build();
      g.port = api;
      const onKey = e => { if (e.code === "Space" && !e.repeat) spaceHit = true; };
      addEventListener("keydown", onKey, true);
      off.push(() => removeEventListener("keydown", onKey, true));
    },
    update(dt, t) {
      if (!P) { P = g.world.port; if (!P) return; P.onBell = (x, z) => sound.bell(x, z); }
      if (!hooked && g.ui) { // Esc goes to the boat first
        hooked = true; origEscape = g.ui.escape;
        g.ui.escape = () => {
          if ((g.ui.map && g.ui.map.isOpen) || (g.ui.settings && g.ui.settings.isOpen)) return origEscape();
          return escape() || origEscape();
        };
      }
      panelCooldown = Math.max(0, panelCooldown - dt);
      const spacePressed = spaceHit; spaceHit = false;
      lastT = t;
      clock += mode === "returning" ? 0 : dt;

      if (mode === "ashore") {
        if (panelOpen && (st.pos.y > 4 || Math.hypot(st.pos.x - PT.stand[0], st.pos.z - PT.stand[1]) > 9 || g.level.id !== "ground")) closePanel();
        // the swell never stops: the berth boat is posed by life.js
        sound.update(dt, { on: false, speed: 0, throttle: 0, near: clamp(1 - Math.hypot(st.pos.x - PT.stand[0], st.pos.z - PT.stand[1]) / 22, 0, 1) });
        P.wake.update(dt, boat.x, boat.z, boat.h, 0, false);
        return;
      }

      // ---- afloat ----
      let fwd = g.input.fwd, turn = g.input.turn, lim = 1;
      if (mode === "boarding") {
        boat.u = 0; poseBoat(t);
        const e = smoother(clock / T_BOARD), d = deckPoint();
        glide(from, d, e); st.heading = from.h + wrap(pose.h - from.h) * e; st.speed = 0; st.turnRate = 0;
        if (clock >= T_BOARD) { mode = "sailing"; clock = 0; hintLeft = 10; }
      } else if (mode === "sailing") {
        if (push > 0) { push -= dt; fwd = 1; turn = -1; lim = 0.25; } // the launch pushes off from the pontoon
        else if (asking > 0 && (fwd !== 0 || turn !== 0 || spacePressed)) asking = 0;
        if (asking > 0) asking -= dt;
        boat.step(dt, fwd, turn, lim);
        if (boat.bump > 0.2 && t - lastBump > 0.6) { lastBump = t; sound.bump(boat.bump); }
        poseBoat(t); putOnBoat(dt);
        const dd = Math.hypot(boat.x - PT.dock.x, boat.z - PT.dock.z);
        const near = boat.x > -78 && boat.x < -36 && boat.z > -138 && boat.z < -102 && dd < PT.dock.r && Math.abs(boat.u) < 5.5 && push <= 0;
        if (near && spacePressed && asking <= 0) startDock();
        // message line
        if (asking > 0) say("ask", T.ask, T.askKeys);
        else if (near) say("dock", T.dock);
        else if (hintLeft > 0) { hintLeft -= dt; say("keys", T.keys); }
        else say("");
      } else if (mode === "docking") {
        stepDock(dt);
        if (mode === "docking") { poseBoat(t); putOnBoat(dt); }
        say("");
      } else if (mode === "deboarding") {
        boat.u = 0; poseBoat(t);
        const e = smoother(clock / T_OUT), sx = PT.stand[0], sz = PT.stand[1];
        dst.x = sx; dst.y = g.world.groundY(sx, sz) + HOVER; dst.z = sz;
        glide(from, dst, e);
        st.heading = from.h + wrap(Math.PI - from.h) * e; st.speed = 0; st.turnRate = 0;
        if (clock >= T_OUT) backAshore();
      } else if (mode === "returning") {
        stepReturn(dt, t);
        if (mode === "returning") { poseBoat(t); putOnBoat(dt); }
      }
      if (mode !== "ashore") camera(dt, t, false);
      P.wake.update(dt, boat.x, boat.z, boat.h, boat.u, mode === "sailing" || mode === "docking" || mode === "boarding");
      sound.update(dt, { on: mode === "sailing" || mode === "docking", speed: boat.u, throttle: mode === "sailing" ? (smoothThr += ((fwd > 0 ? 1 : fwd < 0 ? -0.5 : 0) - smoothThr) * (1 - Math.exp(-dt * 2))) : 0, near: 0 });
    },
    // after the shared shading has run: no dithered window while afloat (open water, nothing to cut)
    late() { if (mode !== "ashore") g.env.shade.uniforms.uCut.value = 0; },
    dispose() {
      for (const o of off) o();
      sound.dispose();
      if (hooked && g.ui && g.ui.escape && origEscape) g.ui.escape = origEscape;
      if (mode !== "ashore") { ride.active = false; g.player.locked = false; if (g.level) g.level.setLevel("ground"); }
      if (P) { P.player.active = false; P.onBell = null; }
      for (const e of [panelEl, promptEl, fadeEl]) if (e) e.remove();
      if (g.port === api) delete g.port;
    },
  };
  return api;
}
