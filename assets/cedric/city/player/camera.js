// The camera. One setting k: 0 = cinematic (slow lag, three-quarter side offset, breathing
// distance, vista framing), 1 = follow (straight behind, stiff, no vista). The pointer only
// glances: about 25 deg yaw, and pitch from 10 deg down to 50 deg up (pointer towards the top of
// the screen looks up at the towers, the camera easing lower and closer as it does). The boom
// shortens when a building is in the way.
import * as THREE from "../core/three.js";
import * as L from "../world/layout.js";

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const GLANCE_YAW = 25 * Math.PI / 180, GLANCE_UP = 50 * Math.PI / 180, GLANCE_DOWN = 10 * Math.PI / 180;

export function createCamera(g) {
  const cam = g.camera;
  const pos = new THREE.Vector3(), look = new THREE.Vector3();         // smoothed
  const dPos = new THREE.Vector3(), dLook = new THREE.Vector3();       // desired
  const head = new THREE.Vector3(), end = new THREE.Vector3(), final = new THREE.Vector3();
  const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
  const vw = L.vistas.map(() => 0);
  let boom = 1, gy = 0, gp = 0, first = true;

  function compute(dt, t, snap) {
    const st = g.player.state, p = st.pos, k = g.settings.get("cam");
    const fx = Math.cos(st.heading), fz = Math.sin(st.heading);

    // pointer glance (smoothed): yaw a little, pitch up a lot (the towers), down a little. Centre = no change.
    const inp = g.input, ga = 1 - Math.exp(-dt * (snap ? 1e3 : 1.8));
    const py = inp.inside ? inp.py : 0, upT = smooth((-py - 0.06) / 0.9), dnT = smooth((py - 0.06) / 0.9);
    gy += ((inp.inside ? -inp.px * GLANCE_YAW * lerp(1, 0.55, k) : 0) - gy) * (snap ? 1 : 1 - Math.exp(-dt * 2.2));
    gp += (upT * GLANCE_UP - dnT * GLANCE_DOWN - gp) * ga;
    const lift = Math.max(0, gp) / GLANCE_UP;        // 0..1 how far up he is looking

    // base framing: behind Cédric, rotated off to a three-quarter angle when cinematic
    const roof = g.level.id === "roof";
    const psi = st.heading + Math.PI + (roof ? 0.6 : 0.1) + (1 - k) * 0.2;   // a slight angle even when following: end-on he is just a stack of bars
    // roof terrace: higher and further, so the loop shows the views (nothing there shortens the boom but the elevator shaft)
    const dist = roof ? lerp(11.5, 9.5, k) + Math.sin(t * 0.21) * 0.8 * (1 - k) : lerp(11.5, 7.2, k) + Math.sin(t * 0.21) * 1.2 * (1 - k);
    dPos.set(p.x + Math.cos(psi) * dist, p.y + (roof ? lerp(6.8, 5.8, k) : lerp(3.6, 2.6, k)), p.z + Math.sin(psi) * dist);
    const ahead = lerp(5, 5.5, k);
    dLook.set(p.x + fx * ahead, p.y + (roof ? 1.0 : 0.5), p.z + fz * ahead);

    // vista framing: ease in while Cédric is inside a vista volume
    // A vista only takes over when Cédric is resting or already swimming towards the view,
    // so the camera never looks away from where he is going.
    const still = 1 - smooth(Math.abs(st.speed) / 1.5);
    const rc = g.player.ride, ride = !!(rc && rc.active); // elevator ride / bench drift: the camera is directed
    if (ride) { dPos.copy(rc.pos); dLook.copy(rc.look); }
    for (let i = 0; i < L.vistas.length && !ride && !roof; i++) {
      const v = L.vistas[i], b = v.box;
      const facing = smooth((fx * Math.cos(v.look) + fz * Math.sin(v.look) - 0.3) / 0.5);
      const edge = Math.min(p.x - b[0], b[1] - p.x, p.z - b[2], b[3] - p.z);
      const target = smooth(edge / v.blend) * Math.max(still, facing);
      vw[i] += (target - vw[i]) * (1 - Math.exp(-dt * 0.7));
      const w = vw[i] * (1 - k);
      if (w < 0.001) continue;
      const lx = Math.cos(v.look), lz = Math.sin(v.look);
      dPos.x = lerp(dPos.x, p.x - lx * v.dist, w); dPos.z = lerp(dPos.z, p.z - lz * v.dist, w); dPos.y = lerp(dPos.y, p.y + v.height, w);
      dLook.x = lerp(dLook.x, p.x + lx * v.ahead, w); dLook.z = lerp(dLook.z, p.z + lz * v.ahead, w); dLook.y = lerp(dLook.y, p.y + v.raise, w);
    }

    const a = snap ? 1 : 1 - Math.exp(-dt * (ride && rc.rate ? rc.rate : lerp(2.4, 6, k)));
    pos.lerp(dPos, a);
    look.lerp(dLook, snap ? 1 : 1 - Math.exp(-dt * (ride && rc.rate ? rc.rate * 1.3 : lerp(3.2, 7, k))));

    // boom: never inside a building. Quick in, slow out.
    head.set(p.x, p.y + 0.6, p.z);
    const len = head.distanceTo(pos);
    const hit = ride ? -1 : g.level.segmentHit(head, pos);
    const tb = hit >= 0 ? Math.max(0.2, hit - 0.7 / Math.max(len, 1)) : 1;
    boom += (tb - boom) * (snap ? 1 : 1 - Math.exp(-dt * (tb < boom ? 9 : 0.9)));
    if (ride) boom = 1;
    final.copy(head).lerp(pos, boom);
    // looking up: ease lower and closer so the buildings rise above Cédric (only ever shortens the boom)
    const lw = ride ? 0 : smooth(lift);
    final.lerp(head, 0.3 * lw);
    final.y -= (roof ? 1.2 : 0.9) * lw;
    const floor = g.level.floorY(final.x, final.z) + 0.8;
    if (!ride && final.y < floor) final.y = floor;
    cam.position.copy(final);
    cam.up.copy(UP);
    cam.lookAt(look);

    // apply the glance: rotate the view, it returns when the pointer leaves
    qYaw.setFromAxisAngle(UP, gy);
    qPitch.setFromAxisAngle(RIGHT, gp);
    cam.quaternion.premultiply(qYaw).multiply(qPitch);
  }

  return {
    name: "camera",
    snap() { first = true; },
    init() { cam.fov = 52; cam.near = 0.3; cam.updateProjectionMatrix(); },
    update(dt, t) { compute(dt, t, first); first = false; },
    dispose() {},
  };
}
