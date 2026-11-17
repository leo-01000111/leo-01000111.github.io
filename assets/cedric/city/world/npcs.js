// NPC layer: Basile, Octave and Firmin, small coral Cédric-shaped shrimp, each with his own eye
// colour. Basile tends the roof bar and turns to face Cédric; Octave and Firmin stroll slow loops
// (layout.npcRoutes), pause now and then and never walk through Cédric. When Cédric is close one
// of them says a line in a small HUD bubble that follows him on screen, one line at a time.
import * as THREE from "../core/three.js";
import { buildCedric } from "../player/cedric3d.js";
import * as L from "./layout.js";

const CORAL = "#ff6f55";
const FRIENDS = [
  { name: "Basile", key: "basile", eye: "#86a8ff", len: 1.05, bar: true },
  { name: "Octave", key: "octave", eye: "#45c97a", len: 1.25, route: L.npcRoutes.octave },
  { name: "Firmin", key: "firmin", eye: "#f5c518", len: 1.15, route: L.npcRoutes.firmin },
];
const HOVER = 0.9, RADIUS = 0.6, WALK = 0.9, TURN = 1.1;
const LISTEN = 5.2, LEAVE = 6.6, TALK = 6.5, TALK_BASILE = 8;
const SHOW = 4.6, GAP = 3.2;                  // seconds a line stays; quiet time before the next
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export function createNpcs(g) {
  const list = [];
  let shadowGeo = null, shadowMat = null;
  let speaker = null, shown = 0, quiet = 2, last = null;
  const v = new THREE.Vector3();
  let bar = null;                                  // Basile's spot: { x, z, y, front, px, pz }

  function lines(n) {
    const f = g.lines && g.lines.friends && g.lines.friends[n.name];
    return f && f.length ? f : g.text.friends[n.name];
  }

  function make(def) {
    const body = buildCedric(window.CEDRIC_DESIGN, { ink: CORAL, eye: def.eye }, def.len);
    const group = new THREE.Group(), shadow = new THREE.Mesh(shadowGeo, shadowMat);
    group.rotation.order = "YXZ";
    group.add(body.mesh);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.9 * def.len / 1.25, 0.55 * def.len / 1.25, 1);
    g.scene.add(group, shadow);
    const el = document.createElement("div");
    el.className = "ccity__bubble"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.style.setProperty("--eye", def.eye);
    const nm = document.createElement("span"), tx = document.createElement("span");
    nm.className = "ccity__bname"; nm.textContent = def.name;
    el.append(nm, tx); g.hud.appendChild(el);
    return {
      def, name: def.name, body, group, shadow, el, tx, line: 0, sx: -1e9, sy: -1e9,
      x: 0, y: 0, z: 0, h: 0, speed: 0, wp: 0, pause: 0, engaged: 0, ignore: 0, ph: g.rng() * 6.28, ay: 0, ad: 0, base: 0,
    };
  }

  function say(n) {
    const ls = lines(n);
    n.tx.textContent = ls[n.line++ % ls.length];
    n.el.classList.add("is-on");
    speaker = n; shown = 0;
  }
  function hush() {
    if (speaker) speaker.el.classList.remove("is-on");
    speaker = null; quiet = GAP + g.rng() * 2.5;
  }

  const api = {
    name: "npcs",
    init() {
      shadowGeo = new THREE.CircleGeometry(1, 16);
      shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (const def of FRIENDS) list.push(make(def));
      for (const n of list) {
        const r = n.def.route;
        if (!r) continue;
        const i = n.def.key === "octave" ? 1 : 2, j = (i + 1) % r.length;
        n.x = r[i][0]; n.z = r[i][1]; n.h = Math.atan2(r[j][1] - n.z, r[j][0] - n.x); n.wp = j;
        n.base = g.world.groundY(n.x, n.z) + HOVER; n.y = n.base;
      }
      // Basile: behind the counter, between it and the back shelf (the first roof obstacle is counter + gap + shelf)
      const roof = g.world.places && g.world.places.basile && g.world.places.basile.roof;
      if (roof) {
        const o = roof.obstacles[0], sk = roof.views.skyline, b = list[0];
        bar = { x: (o[0] + o[1]) / 2 + Math.cos(sk) * 0.2, z: (o[2] + o[3]) / 2 + Math.sin(sk) * 0.2, y: roof.y + 1.45, front: roof.views.sunset };
        bar.px = -Math.sin(bar.front); bar.pz = Math.cos(bar.front);   // along the counter
        b.x = bar.x; b.z = bar.z; b.y = bar.y; b.h = bar.front;
      }
      api.list = list;
    },
    update(dt, t) {
      const st = g.player.state, cp = st.pos;
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        let tgtH = n.h, tgtV = 0;
        const dx = cp.x - n.x, dz = cp.z - n.z, dy = cp.y - n.y;
        const dC = Math.hypot(dx, dz), dC3 = Math.hypot(dC, dy);
        let floor;
        if (n.def.bar) {
          if (!bar) { n.group.visible = false; n.shadow.visible = false; continue; }
          const sway = Math.sin(t * 0.21 + n.ph) * 0.55;
          n.x = bar.x + bar.px * sway; n.z = bar.z + bar.pz * sway; n.y = bar.y + Math.sin(t * 1.5 + n.ph) * 0.05;
          if (dC3 < 9) { // turn to Cédric, but never with his back to the counter
            const want = Math.atan2(dz, dx);
            tgtH = bar.front + Math.max(-1.7, Math.min(1.7, wrap(want - bar.front)));
          } else tgtH = bar.front;
          n.h += wrap(tgtH - n.h) * (1 - Math.exp(-dt * 1.6));
          floor = bar.y - 1.45;
        } else {
          n.ignore = Math.max(0, n.ignore - dt);
          // Cédric close: stop and turn towards him, until he leaves or the wait gets long
          if (n.engaged > 0) n.engaged = dC > LEAVE ? 0 : n.engaged + dt;
          else if (dC < LISTEN && n.ignore === 0 && Math.abs(dy) < 4) n.engaged = 0.001;
          if (n.engaged > 16) { n.engaged = 0; n.ignore = 12; }
          const r = n.def.route, w = r[n.wp];
          if (n.engaged > 0) tgtH = Math.atan2(dz, dx);
          else if (n.pause > 0) n.pause -= dt;
          else {
            const wx = w[0] - n.x, wz = w[1] - n.z, wd = Math.hypot(wx, wz);
            if (wd < 0.9) { n.wp = (n.wp + 1) % r.length; if (g.rng() < 0.55) n.pause = 2.5 + g.rng() * 5; }
            else { tgtH = Math.atan2(wz, wx); tgtV = WALK; }
            // somebody (Cédric) right ahead: wait instead of walking through him
            if (dC < 3.4 && (Math.cos(n.h) * dx + Math.sin(n.h) * dz) / Math.max(dC, 0.01) > 0.25) tgtV = 0;
          }
          const dh = wrap(tgtH - n.h);
          n.h += Math.max(-TURN * dt, Math.min(TURN * dt, dh * (1 - Math.exp(-dt * 2.2)) * 3));
          n.speed += (tgtV * Math.max(0.15, 1 - Math.abs(dh) / 1.2) - n.speed) * (1 - Math.exp(-dt * 1.6));
          n.x += Math.cos(n.h) * n.speed * dt; n.z += Math.sin(n.h) * n.speed * dt;
          if (dC < 1.9 && dC > 1e-3) { const k = (1.9 - dC) / dC * Math.min(1, dt * 2.5); n.x -= dx * k; n.z -= dz * k; } // give way
          v.set(n.x, 0, n.z); g.world.collide.resolveCircle(v, RADIUS); n.x = v.x; n.z = v.z;
          floor = g.world.groundY(n.x, n.z);
          n.base = floor + HOVER;
          n.y += (n.base + Math.sin(t * 1.4 + n.ph) * 0.05 - n.y) * (1 - Math.exp(-dt * 3));
        }
        // pose
        n.group.position.set(n.x, n.y, n.z);
        n.group.rotation.y = -n.h;
        n.group.rotation.z = Math.sin(t * 1.7 + n.ph + 1) * 0.03 + n.speed * 0.05;
        const a = 1 - Math.exp(-dt * 3);
        n.ay += (Math.sin(t * 1.3 + n.ph) * 0.05 - n.ay) * a;
        n.ad += (-n.speed * 0.2 + Math.sin(t * 1.1 + n.ph + 2) * 0.03 - n.ad) * a;
        n.body.swing(n.ay, n.ad);
        n.shadow.position.set(n.x, floor + 0.04, n.z);
        n.shadow.rotation.z = n.h;
      }

      // one line at a time, calm timing
      if (speaker) {
        const n = speaker, dd = Math.hypot(cp.x - n.x, cp.y - n.y, cp.z - n.z);
        shown += dt;
        if (dd > (n.def.bar ? TALK_BASILE + 2 : TALK + 2) || shown > SHOW) hush();
      } else {
        quiet -= dt;
        if (quiet <= 0) {
          let best = null, bd = 1e9;
          for (let i = 0; i < list.length; i++) {
            const n = list[i], dd = Math.hypot(cp.x - n.x, cp.y - n.y, cp.z - n.z);
            if (dd < (n.def.bar ? TALK_BASILE : TALK) && dd < bd && (n !== last || list.length < 2)) { best = n; bd = dd; }
          }
          if (best) { say(best); last = best; } else last = null;
        }
      }
    },
    // after the camera has moved: put the bubble on the speaker's head
    late() {
      if (!speaker) return;
      const n = speaker, cam = g.camera;
      cam.updateMatrixWorld();
      v.set(n.x, n.y + 0.55, n.z).project(cam);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.08 || v.y > 1.05 || v.y < -1.05) { n.el.style.visibility = "hidden"; return; } // out of frame: no bubble pointing at nothing
      n.el.style.visibility = "";
      const w = g.size.w, h = g.size.h;
      const x = Math.max(100, Math.min(w - 100, (v.x * 0.5 + 0.5) * w)), y = Math.max(70, (-v.y * 0.5 + 0.5) * h);
      if (Math.abs(x - n.sx) > 0.5 || Math.abs(y - n.sy) > 0.5) {
        n.sx = x; n.sy = y;
        n.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%,-100%)";
      }
    },
    dispose() {
      for (const n of list) { g.scene.remove(n.group); g.scene.remove(n.shadow); n.body.dispose(); n.el.remove(); }
      list.length = 0;
      if (shadowGeo) shadowGeo.dispose();
      if (shadowMat) shadowMat.dispose();
      speaker = null;
    },
  };
  return api;
}
