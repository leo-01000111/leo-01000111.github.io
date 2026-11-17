// Chez Basile elevator ride. Controls lock, Cedric glides into the cabin, the cabin rises (or
// sinks) slowly with him inside, the camera rides outside the glass, then he glides out and the
// level changes (ground <-> roof). Driven by update(): no timers, so closing the game mid-ride
// leaves nothing behind.
import * as THREE from "../core/three.js";

const HOVER = 1.1, CAB_HOVER = 1.0;     // body height above the floor: outside / inside the cabin
const T_IN = 2.6, T_RIDE = 7, T_OUT = 2.6;
const smooth = x => x * x * (3 - 2 * x);
const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);   // ease in and out, long and soft
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export function createElevator(g) {
  const st = g.player.state, V3 = THREE.Vector3;
  const ride = g.player.ride = { active: false, pos: new V3(), look: new V3(), rate: 1.1 };
  let d = null;                       // elevator data, read on first use
  let run = null;                     // the ride in progress
  const from = { x: 0, y: 0, z: 0, h: 0 }, to = { x: 0, y: 0, z: 0, h: 0 };
  const c = new V3(), ou = { x: -1, z: 0 }, sd = { x: 0, z: -1 };

  function data() {
    if (d) return d;
    const p = g.world.places && g.world.places.basile;
    if (!p || !p.elevator || !p.roof) return null;
    const e = p.elevator;
    d = { e, roofY: p.roof.y, cab: e.cabin };
    // out = from the shaft towards the street; the camera sits out and to the north of the cabin
    const dx = e.doorPos[0] - e.shaft[0], dz = e.doorPos[1] - e.shaft[1], n = Math.hypot(dx, dz) || 1;
    ou.x = dx / n; ou.z = dz / n;
    sd.x = -ou.z; sd.z = ou.x;
    if (sd.z > 0) { sd.x = -sd.x; sd.z = -sd.z; }
    d.outHeading = Math.atan2(ou.z, ou.x);
    return d;
  }

  function glide(f, t, e) {            // f -> t at ease e, into the player state
    st.pos.x = f.x + (t.x - f.x) * e; st.pos.y = f.y + (t.y - f.y) * e; st.pos.z = f.z + (t.z - f.z) * e;
    st.heading = f.h + wrap(t.h - f.h) * e;
  }
  function setFrom() { from.x = st.pos.x; from.y = st.pos.y; from.z = st.pos.z; from.h = st.heading; }

  function begin(phase) {
    run.phase = phase; run.t = 0;
    setFrom();
    const e = d.e, cabY = d.cab.position.y;
    if (phase === 0) { to.x = e.shaft[0]; to.z = e.shaft[1]; to.y = cabY + CAB_HOVER + 0.15; to.h = d.outHeading; }
    else if (phase === 2) {
      if (run.dir > 0) { to.x = e.roofPos[0]; to.z = e.roofPos[2]; to.y = d.roofY + HOVER; to.h = e.roofHeading; }
      else { to.x = e.doorPos[0] + ou.x * 2.4; to.z = e.doorPos[1] + ou.z * 2.4; to.y = g.world.groundY(to.x, to.z) + HOVER; to.h = d.outHeading; }
    }
  }

  function camera(u) {
    const cy = d.cab.position.y + 1.1;
    c.set(d.e.shaft[0], cy, d.e.shaft[1]);
    // from the north along the facade: the sea opens on one side, the city on the other
    const out = 9 - 3 * u, side = 7 + 7 * u, up = 1.6 + 2.0 * u;
    ride.pos.set(c.x + ou.x * out + sd.x * side, c.y + up, c.z + ou.z * out + sd.z * side);
    const ahead = 1 + 5 * u;
    ride.look.set(c.x + ou.x * ahead, c.y + 0.6 + 1.4 * u, c.z + ou.z * ahead);
  }

  const api = {
    get busy() { return !!run; },
    start(dir) {
      if (run || !data()) return false;
      if (dir > 0 && g.level.id !== "ground") return false;
      if (dir < 0 && g.level.id !== "roof") return false;
      run = { dir, phase: 0, t: 0 };
      g.player.locked = true;
      st.speed = 0; st.turnRate = 0;
      d.cab.position.y = dir > 0 ? d.e.yBottom : d.e.yTop;
      g.level.setLevel("ride");
      g.level.rideFloor = d.cab.position.y;
      ride.active = true;
      begin(0);
      return true;
    },
    rideUp() { return api.start(1); },
    rideDown() { return api.start(-1); },
    update(dt) {
      if (!run) return;
      const e = d.e;
      run.t += dt;
      let u;
      if (run.phase === 0) {
        const k = Math.min(1, run.t / T_IN);
        glide(from, to, smoother(k));
        u = run.dir > 0 ? 0 : 1;
        if (k >= 1) begin(1);
      } else if (run.phase === 1) {
        const k = Math.min(1, run.t / T_RIDE), p = smoother(k), pr = run.dir > 0 ? p : 1 - p;
        d.cab.position.y = e.yBottom + (e.yTop - e.yBottom) * pr;
        st.pos.y = d.cab.position.y + CAB_HOVER + 0.15;
        u = pr;
        if (k >= 1) begin(2);
      } else {
        const k = Math.min(1, run.t / T_OUT);
        glide(from, to, smoother(k));
        u = run.dir > 0 ? 1 : 0;
        if (k >= 1) { finish(); return; }
      }
      g.level.rideFloor = d.cab.position.y;
      camera(u);
    },
    dispose() { if (run) finish(true); ride.active = false; if (g.player.ride === ride) delete g.player.ride; },
  };

  function finish(quiet) {
    const dir = run.dir;
    run = null;
    g.level.setLevel(dir > 0 ? "roof" : "ground");
    g.player.locked = false;
    ride.active = false;
    st.speed = 0; st.turnRate = 0; st.heading = wrap(st.heading);
    if (!quiet) g.events.emit("ride", dir > 0 ? "roof" : "ground");
  }
  return api;
}
