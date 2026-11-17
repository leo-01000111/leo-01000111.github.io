// The notice board on the plaza: one paper rectangle per post (at most 12) pinned on the board
// that world/buildings/mairie.js builds. One mesh, the shared world material, one draw call.
import * as THREE from "../core/three.js";
import { Buf } from "../core/buf.js";
import { K_PLAIN } from "../world/kit/kit.js";

const MAX = 12, COLS = 4, ROWS = 3;
const PAPER = [[0.93, 0.88, 0.76], [0.9, 0.86, 0.8], [0.95, 0.9, 0.72], [0.86, 0.88, 0.82]], PIN = [0.78, 0.22, 0.2];
const jit = i => { const s = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return s - Math.floor(s) - 0.5; };

export function createBoardProp(g) {
  let mesh = null;
  const api = {
    clear() {
      if (!mesh) return;
      g.scene.remove(mesh); mesh.geometry.dispose(); mesh = null;
    },
    // anchor: mairie.js publishes g.world.places.mairie.board = { o, u, n } (origin on the board's
    // centre line at ground level, unit x along the front, unit normal towards the plaza)
    set(count) {
      api.clear();
      const b = g.world.places && g.world.places.mairie && g.world.places.mairie.board;
      const n = Math.min(MAX, count | 0);
      if (!b || n < 1) return;
      const B = new Buf(1e4), bk = B.bucket(b.o[0], b.o[2]);
      const at = (x, y, d) => [b.o[0] + b.u[0] * x + b.n[0] * d, y, b.o[2] + b.u[2] * x + b.n[2] * d];
      for (let i = 0; i < n; i++) {
        const cx = -0.98 + (i % COLS) * 0.65 + jit(i) * 0.1, cy = 2.12 - Math.floor(i / COLS) * 0.4 + jit(i + 50) * 0.06;
        const a = jit(i + 100) * 0.3, co = Math.cos(a), si = Math.sin(a), hw = 0.25, hh = 0.17, d = 0.09 + i * 0.0006;
        const P = (sx, sy) => at(cx + sx * hw * co - sy * hh * si, cy + sx * hw * si + sy * hh * co, d);
        B.quad(bk, P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), b.n, PAPER[i % PAPER.length], K_PLAIN);
        const px = cx - hh * si * 0.9, py = cy + hh * co * 0.9, q = 0.035;
        B.quad(bk, at(px - q, py - q, d + 0.004), at(px + q, py - q, d + 0.004), at(px + q, py + q, d + 0.004), at(px - q, py + q, d + 0.004), b.n, PIN, K_PLAIN);
      }
      mesh = new THREE.Mesh(B.geometry(), g.env.shade.world);
      mesh.name = "board-papers";
      g.scene.add(mesh);
    },
    dispose() { api.clear(); },
  };
  return api;
}
