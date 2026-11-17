// Le Port on the pen chart (minimap and big map): the quay, the slipway notch, the pontoon with its
// fingers, the breakwater with its curve. Called from ui/minimap.js drawChart after the pier.
import * as L from "../../world/layout.js";
import { arcPoint } from "./boat.js";

const INK = "234,223,210";

export function drawPort(c, X, Z, s, u) {
  const P = L.port, q = P.quay, p = P.pontoon, b = P.breakwater, hw = b.w / 2;
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  // outline of the breakwater: the straight leg, then the curve (outer edge out, inner edge back)
  const arc = [], inner = [], n = 14;
  for (let i = 0; i <= n; i++) {
    const m = arcPoint(b.arc.sweep * i / n), nx = -m.tz, nz = m.tx, out = ((m.x - b.arc.cx) * nx + (m.z - b.arc.cz) * nz) > 0 ? 1 : -1;
    arc.push([m.x + nx * out * hw, m.z + nz * out * hw]); inner.push([m.x - nx * out * hw, m.z - nz * out * hw]);
  }
  const bw = [[b.xRoot, b.z - hw], ...arc.map((a, i) => (i === 0 ? [b.xEnd, b.z - hw] : a)), ...inner.reverse(), [b.xRoot, b.z + hw]];
  const spine = rect(p.spine[0], p.spine[1], p.spine[2], p.spine[3]);
  const fingers = p.fingers.map(z => rect(p.spine[0] - p.fingerLen, p.spine[0], z - p.fingerW / 2, z + p.fingerW / 2));
  const path = pts => { c.beginPath(); pts.forEach((a, i) => (i ? c.lineTo(X(a[0]), Z(a[1])) : c.moveTo(X(a[0]), Z(a[1])))); c.closePath(); };
  const shapes = [rect(q.x0, q.x1, q.z0, q.z1), spine, ...fingers, bw];
  c.save();
  c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000";
  for (const sh of shapes) { path(sh); c.fill(); }
  c.restore();
  c.lineJoin = "round";
  // quay: faint ground, a firm edge on the sea side, a lighter one inland; the slipway is a notch in the sea edge
  path(shapes[0]); c.fillStyle = `rgba(${INK},.06)`; c.fill();
  c.lineWidth = 1.5 * u; c.strokeStyle = `rgba(${INK},.9)`;
  const S = P.slip;
  c.beginPath();
  c.moveTo(X(q.x1), Z(q.z0)); c.lineTo(X(q.x0), Z(q.z0)); c.lineTo(X(q.x0), Z(S.z0)); c.lineTo(X(S.xEnd), Z(S.z0)); c.lineTo(X(S.xEnd), Z(S.z1)); c.lineTo(X(q.x0), Z(S.z1)); c.lineTo(X(q.x0), Z(q.z1));
  c.stroke();
  c.lineWidth = 1 * u; c.strokeStyle = `rgba(${INK},.4)`;
  c.beginPath(); c.moveTo(X(q.x1), Z(q.z0)); c.lineTo(X(q.x1), Z(q.z1)); c.moveTo(X(q.x0), Z(q.z1)); c.lineTo(X(q.x1), Z(q.z1)); c.stroke();
  c.lineWidth = 1.5 * u; c.strokeStyle = `rgba(${INK},.9)`;
  for (const sh of [bw, spine, ...fingers]) { path(sh); c.stroke(); }
  // the cabin, hatched by the plot code already; the green and red lights as two small dots
  const tip = arcPoint(b.arc.sweep);
  for (const [x, z, col] of [[tip.x, tip.z, "255,80,70"], [q.x0 + 0.5, q.z1 - 0.5, "70,255,120"]]) { c.beginPath(); c.arc(X(x), Z(z), 2.6 * u, 0, Math.PI * 2); c.fillStyle = `rgba(${col},.95)`; c.fill(); }
}
