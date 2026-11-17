// Cédric's steering, relative to his own orientation (not the camera): W swims forward,
// Shift sprints, A / D turn, S drifts back slowly. Arrow keys mirror WASD. Everything is eased.
import * as THREE from "../core/three.js";
import * as L from "../world/layout.js";

const SWIM = 4.6, SPRINT = 8, DRIFT = 1.4, TURN = 2.4, HOVER = 1.1, RADIUS = 0.8;

export function createControls(g) {
  const st = {
    pos: new THREE.Vector3(), heading: 0, speed: 0, turnRate: 0, near: null,
  };
  g.player.state = st;
  g.player.locked = false; // elevator ride, bench mode: steering is off
  const api = {
    name: "controls",
    place(x, z, heading) {
      st.pos.set(x, g.world.groundY(x, z) + HOVER, z);
      if (heading != null) st.heading = heading;
      st.speed = 0; st.turnRate = 0;
    },
    init() {
      const s = g.spawn || L.spawn;
      api.place(s.x, s.z, s.heading);
    },
    update(dt) {
      const inp = g.input;
      inp.update();
      if (g.player.locked) { // someone else moves him; keep the keys from piling up
        inp.consume("Space");
        if (st.near) { st.near = null; g.events.emit("near", null); }
        return;
      }
      const sprint = inp.down.has("ShiftLeft") || inp.down.has("ShiftRight");
      const tSpeed = inp.fwd > 0 ? (sprint ? SPRINT : SWIM) : inp.fwd < 0 ? -DRIFT : 0;
      st.speed += (tSpeed - st.speed) * (1 - Math.exp(-dt * (tSpeed === 0 ? 2.8 : 2.2)));
      const tTurn = inp.turn * TURN;
      st.turnRate += (tTurn - st.turnRate) * (1 - Math.exp(-dt * 6));
      st.heading += st.turnRate * dt;
      if (st.heading > Math.PI) st.heading -= Math.PI * 2; else if (st.heading < -Math.PI) st.heading += Math.PI * 2;
      st.pos.x += Math.cos(st.heading) * st.speed * dt;
      st.pos.z += Math.sin(st.heading) * st.speed * dt;
      g.level.resolve(st.pos, RADIUS);
      const gy = g.level.floorY(st.pos.x, st.pos.z) + HOVER;
      st.pos.y += (gy - st.pos.y) * (1 - Math.exp(-dt * 3));

      // nearest place whose door is in range on this level (Space enters)
      const near = g.level.nearPlace(st.pos);
      if (near !== st.near) { st.near = near; g.events.emit("near", near); }
      if (inp.consume("Space") && st.near) g.events.emit("enter", st.near);
    },
    dispose() {},
  };
  return api;
}
