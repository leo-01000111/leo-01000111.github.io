// Static colliders (circles and oriented rectangles) on a coarse grid, plus the walkable limits.
// Cedric is a circle in the XZ plane. The camera boom is a segment in 3D: colliders have a top
// height so the camera can pass over low things.
import { walkable } from "./layout.js";

const CELL = 16;

export function createCollide() {
  const items = [];           // { t:0 circle | 1 rect, x, z, r | hw, hd, c, s, h }
  const grid = new Map();     // "i,j" -> item indices
  let stamp = 0;

  function cellsOf(x0, x1, z0, z1, fn) {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) fn(i + "," + j);
  }
  function insert(it, x0, x1, z0, z1) {
    const idx = items.push(it) - 1;
    cellsOf(x0, x1, z0, z1, key => { let a = grid.get(key); if (!a) grid.set(key, (a = [])); a.push(idx); });
  }

  function addCircle(x, z, r, h = 99) {
    insert({ t: 0, x, z, r, h, seen: 0 }, x - r, x + r, z - r, z + r);
  }
  function addRect(x, z, hw, hd, rot = 0, h = 99) {
    const c = Math.cos(rot), s = Math.sin(rot), ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    insert({ t: 1, x, z, hw, hd, c, s, h, seen: 0 }, x - ex, x + ex, z - ez, z + ez);
  }

  // Push the circle at pos (x, z used) out of everything, then back inside the walkable area.
  function resolveCircle(pos, r) {
    for (let pass = 0; pass < 2; pass++) {
      stamp++;
      cellsOf(pos.x - r, pos.x + r, pos.z - r, pos.z + r, key => {
        const a = grid.get(key);
        if (!a) return;
        for (let n = 0; n < a.length; n++) {
          const it = items[a[n]];
          if (it.seen === stamp) continue;
          it.seen = stamp;
          if (it.t === 0) {
            const dx = pos.x - it.x, dz = pos.z - it.z, d = Math.hypot(dx, dz), m = r + it.r;
            if (d < m) {
              if (d > 1e-6) { const k = (m - d) / d; pos.x += dx * k; pos.z += dz * k; } else pos.z += m;
            }
          } else {
            const dx = pos.x - it.x, dz = pos.z - it.z;
            const lx = dx * it.c + dz * it.s, lz = -dx * it.s + dz * it.c;
            const qx = Math.max(-it.hw, Math.min(it.hw, lx)), qz = Math.max(-it.hd, Math.min(it.hd, lz));
            let ex = lx - qx, ez = lz - qz;
            const d2 = ex * ex + ez * ez;
            if (d2 >= r * r) continue;
            let px, pz;
            if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; px = ex * k; pz = ez * k; }
            else { // centre inside: leave through the nearest side
              const ox = it.hw - Math.abs(lx), oz = it.hd - Math.abs(lz);
              if (ox < oz) { px = (lx < 0 ? -1 : 1) * (ox + r); pz = 0; } else { px = 0; pz = (lz < 0 ? -1 : 1) * (oz + r); }
            }
            pos.x += px * it.c - pz * it.s; pos.z += px * it.s + pz * it.c;
          }
        }
      });
    }
    clampWalkable(pos, r);
  }

  // Keep (x, z) inside the union of walkable rectangles, shrunk by r.
  function clampWalkable(pos, r) {
    let best = 1e9, bx = pos.x, bz = pos.z;
    for (let i = 0; i < walkable.length; i++) {
      const w = walkable[i];
      const x = Math.max(w.x0 + r, Math.min(w.x1 - r, pos.x)), z = Math.max(w.z0 + r, Math.min(w.z1 - r, pos.z));
      const d = (x - pos.x) * (x - pos.x) + (z - pos.z) * (z - pos.z);
      if (d < best) { best = d; bx = x; bz = z; if (d === 0) break; }
    }
    pos.x = bx; pos.z = bz;
  }

  // First hit of segment a->b (objects with x, y, z) against colliders: fraction 0..1, or -1.
  // skipInside: ignore colliders the segment starts inside (a camera boom on a roof).
  function segmentHit(a, b, skipInside) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    let best = 2;
    stamp++;
    cellsOf(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), key => {
      const arr = grid.get(key);
      if (!arr) return;
      for (let n = 0; n < arr.length; n++) {
        const it = items[arr[n]];
        if (it.seen === stamp) continue;
        it.seen = stamp;
        if (skipInside && a.y <= it.h) {
          const sx = a.x - it.x, sz = a.z - it.z;
          if (it.t === 1 ? (Math.abs(sx * it.c + sz * it.s) <= it.hw && Math.abs(-sx * it.s + sz * it.c) <= it.hd) : (sx * sx + sz * sz <= it.r * it.r)) continue;
        }
        let t0 = 0, t1 = 1;
        if (it.t === 1) { // slab test in the rectangle's frame
          const ax = a.x - it.x, az = a.z - it.z, ox = ax * it.c + az * it.s, oz = -ax * it.s + az * it.c;
          const vx = dx * it.c + dz * it.s, vz = -dx * it.s + dz * it.c;
          let ok = true;
          for (let k = 0; k < 2 && ok; k++) {
            const o = k ? oz : ox, v = k ? vz : vx, h = k ? it.hd : it.hw;
            if (Math.abs(v) < 1e-9) { if (o < -h || o > h) ok = false; }
            else { let ta = (-h - o) / v, tb = (h - o) / v; if (ta > tb) { const s = ta; ta = tb; tb = s; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false; }
          }
          if (!ok) continue;
        } else { // circle
          const fx = a.x - it.x, fz = a.z - it.z, A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - it.r * it.r;
          if (A < 1e-12) continue;
          const disc = B * B - 4 * A * C;
          if (disc < 0) continue;
          const sq = Math.sqrt(disc);
          t0 = Math.max(0, (-B - sq) / (2 * A)); t1 = Math.min(1, (-B + sq) / (2 * A));
          if (t0 > t1) continue;
        }
        // height: only the part of the segment below the top counts
        let t = t0;
        if (a.y + dy * t0 > it.h) {
          if (a.y + dy * t1 > it.h || Math.abs(dy) < 1e-9) continue;
          t = Math.max(t0, (it.h - a.y) / dy);
          if (t > t1) continue;
        }
        if (t < best) best = t;
      }
    });
    return best <= 1 ? best : -1;
  }

  // --- aerodrome ---
  // Height of the tallest collider covering (x, z): roofs and walls, for the glider's look-ahead. 0 if none.
  function topAt(x, z) {
    const a = grid.get(Math.floor(x / CELL) + "," + Math.floor(z / CELL));
    let top = 0;
    if (!a) return top;
    for (let n = 0; n < a.length; n++) {
      const it = items[a[n]];
      if (it.h <= top) continue;
      const dx = x - it.x, dz = z - it.z;
      if (it.t === 1 ? (Math.abs(dx * it.c + dz * it.s) <= it.hw && Math.abs(-dx * it.s + dz * it.c) <= it.hd) : (dx * dx + dz * dz <= it.r * it.r)) top = it.h > 90 ? 60 : it.h;
    }
    return top;
  }
  // --- end aerodrome ---

  return { addCircle, addRect, resolveCircle, segmentHit, clampWalkable, topAt, count: () => items.length };
}
