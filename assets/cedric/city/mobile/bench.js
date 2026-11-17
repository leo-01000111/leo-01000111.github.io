// Bench mode (phones, narrow windows, prefers-reduced-motion): no steering, no minimap. Cedric
// hovers on THE bench on the promenade and watches the sea; the camera drifts very slowly around
// him (not at all under reduced motion: one composed frame). Weather, clock and audio run as
// usual; sound still needs a tap, so a small "son" button sits top right.
import * as THREE from "../core/three.js";
import * as L from "../world/layout.js";

const SEAT = 0.7;                                  // top of the oak seat above the sea level of the promenade
// Seen from the side, not end-on (from behind his hatch lines read as a comb): he is turned to
// YAW towards the camera, the camera sits CAM_AZ round from straight behind, a little above him,
// and looks a little towards the sun so both share the frame. The drift stays within +-DRIFT.
const DIST = 4.6, EYE = 1.9, LOOK_UP = 0.5, LOOK_AHEAD = 12, YAW = 0.9, CAM_AZ = 0.55, DRIFT = 0.12;

export function createBench(g) {
  const st = g.player.state, cam = g.camera;
  const ride = g.player.ride = { active: true, pos: new THREE.Vector3(), look: new THREE.Vector3(), rate: 0.5 };
  let btn = null, armed = false, aspect = 0, offs = [];

  function compose(t) {
    const p = st.pos, still = g.reduced;
    const sway = still ? 0 : Math.sin(t * 0.026), bob = still ? 0 : Math.sin(t * 0.017 + 1);
    const ang = L.bench.facing + Math.PI + (aspect < 1 ? CAM_AZ - 0.24 : CAM_AZ) + sway * DRIFT;  // behind him and round to the side
    const d = DIST + (still ? 0 : bob * 0.7) + (aspect < 1 ? 0.8 : 0.9);
    const cx = p.x + Math.cos(ang) * d, cz = p.z + Math.sin(ang) * d;
    ride.pos.set(cx, p.y + EYE + (still ? 0 : bob * 0.15), cz);
    // look through him, out to sea: he stays in the middle, low in the frame
    const va = Math.atan2(p.z - cz, p.x - cx) - (aspect < 1 ? 0.17 : 0.27);  // turned towards the sun, so Cedric and the sun share the frame
    ride.look.set(cx + Math.cos(va) * (d + LOOK_AHEAD), p.y + (aspect < 1 ? LOOK_UP : -0.5), cz + Math.sin(va) * (d + LOOK_AHEAD));
  }

  function paintBtn() {
    const on = armed && !g.settings.get("mute");
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? g.text.bench.sonOff : g.text.bench.sonOn);
  }

  const api = {
    name: "bench",
    init() {
      g.player.locked = true;
      st.pos.y = L.promenade.y + SEAT + 0.42;
      st.heading = L.bench.facing - YAW;
      ride.pos.copy(cam.position); ride.look.set(st.pos.x - 10, st.pos.y + 1.5, st.pos.z);
      btn = document.createElement("button");
      btn.type = "button"; btn.className = "ccity__btn ccity__son"; btn.textContent = g.text.bench.son;
      btn.addEventListener("click", () => {
        if (!armed) { armed = true; g.settings.set("mute", 0); if (g.audio) g.audio.start(); }
        else g.settings.set("mute", g.settings.get("mute") ? 0 : 1);
        paintBtn();
      });
      g.hud.appendChild(btn);
      paintBtn();
      offs.push(g.events.on("setting", k => { if (k === "mute") paintBtn(); }));
      compose(0);
    },
    update(dt, t) {
      // a tall narrow screen needs a wider lens to keep the sea in frame
      const a = g.size.w / Math.max(1, g.size.h);
      if (a !== aspect) { aspect = a; cam.fov = a < 1 ? 74 : 52; cam.updateProjectionMatrix(); }
      st.speed = 0; st.turnRate = 0;
      compose(t);
    },
    compose,
    dispose() { for (const o of offs) o(); offs = []; if (btn) btn.remove(); delete g.player.ride; },
  };
  return api;
}
