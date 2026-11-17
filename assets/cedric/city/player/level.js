// Levels: where Cedric is standing. "ground" is the city (the 2D collider grid + terrain height);
// "roof" is the Chez Basile terrace (its own floor height, bounds and obstacle rectangles);
// "ride" is the elevator cabin (controls are locked, the floor is the cabin floor).
// Controls, camera and the shadow ask g.level instead of the terrain, so ground behaviour is
// untouched and the roof only adds a second answer to the same questions.
import * as L from "../world/layout.js";

export function createLevel(g) {
  let roof = null, down = null, rideY = 0;
  const lv = {
    id: "ground",
    // elevator ride sets this every frame
    set rideFloor(y) { rideY = y; },
    floorY(x, z) {
      return lv.id === "roof" ? roof.y : lv.id === "ride" ? rideY : g.world.groundY(x, z);
    },
    // push the circle (pos.x, pos.z) out of this level's obstacles and keep it inside
    resolve(pos, r) {
      if (lv.id === "ground") { g.world.collide.resolveCircle(pos, r); return; }
      if (lv.id === "ride") return;
      const o = roof.obstacles, b = roof.bounds;
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < o.length; i++) {
          const w = o[i];
          const qx = Math.max(w[0], Math.min(w[1], pos.x)), qz = Math.max(w[2], Math.min(w[3], pos.z));
          let dx = pos.x - qx, dz = pos.z - qz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
          else { // centre inside: leave through the nearest side
            const l = pos.x - w[0], rr = w[1] - pos.x, n = pos.z - w[2], s = w[3] - pos.z, m = Math.min(l, rr, n, s);
            if (m === l) pos.x = w[0] - r; else if (m === rr) pos.x = w[1] + r; else if (m === n) pos.z = w[2] - r; else pos.z = w[3] + r;
          }
        }
        pos.x = Math.max(b[0] + r, Math.min(b[1] - r, pos.x));
        pos.z = Math.max(b[2] + r, Math.min(b[3] - r, pos.z));
      }
    },
    // camera boom: on the roof the building under it must not count
    // On the roof only the solid machine head on top of the elevator shaft is in the way (a box: the shaft below it is glass and thin steel); neighbours and furniture are not.
    segmentHit(a, b) {
      if (lv.id !== "roof") return g.world.collide.segmentHit(a, b, lv.id !== "ground");
      const s = roof.shaft;
      if (!s) return -1;
      let t0 = 0, t1 = 1;
      const m = 0.25, lo = [s.rect[0] - m, s.bottom, s.rect[2] - m], hi = [s.rect[1] + m, s.top, s.rect[3] + m];
      const o = [a.x, a.y, a.z], v = [b.x - a.x, b.y - a.y, b.z - a.z];
      for (let i = 0; i < 3; i++) {
        if (Math.abs(v[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return -1; continue; }
        let ta = (lo[i] - o[i]) / v[i], tb = (hi[i] - o[i]) / v[i];
        if (ta > tb) { const q = ta; ta = tb; tb = q; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) return -1;
      }
      return t0 > 0 ? t0 : -1;
    },
    // the place whose door is in range, or null. The roof only knows its elevator.
    nearPlace(pos) {
      if (lv.id === "ground") {
        let near = null, best = 1e9;
        for (let i = 0; i < L.places.length; i++) {
          const p = L.places[i];
          if (p.noEnter) continue; // the station has no door: places/station.js owns its prompts
          const d = Math.hypot(pos.x - p.door[0], pos.z - p.door[1]);
          if (d < p.radius && d < best) { best = d; near = p; }
        }
        return near;
      }
      if (lv.id === "roof" && down && Math.hypot(pos.x - down.door[0], pos.z - down.door[1]) < down.radius) return down;
      return null;
    },
    setLevel(id) {
      if (!roof) {
        const p = g.world.places && g.world.places.basile;
        if (!p || !p.roof) { if (id === "roof") return false; lv.id = id; return true; }
        roof = p.roof;
        down = { id: "basile-down", plot: "basile", door: [p.elevator.roofPos[0], p.elevator.roofPos[2]], radius: 3.2, neon: "#ffb03f" };
      }
      lv.id = id;
      return true;
    },
    get roof() { return roof; },
  };
  g.level = lv;
  return lv;
}
