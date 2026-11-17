// The airfield on the pen-and-hatch chart (minimap and big map): the promenade carried south, the service
// road, apron and tie-down yard, the runway hatched warm with its centre line. Called from ui/minimap.js
// drawChart with that function's own helpers.
import * as L from "../../world/layout.js";

const INK = "234,223,210", WARM = "255,176,112", NEON = "255,122,58";
const rgba = (c, a) => `rgba(${c},${a})`;

export function drawAerodrome(c, X, Z, s, u, lines, rectPoly, strokeRect) {
  const A = L.aerodrome, R = A.runway, P = L.promenade, rx0 = R.x - R.w / 2, rx1 = R.x + R.w / 2;
  c.setLineDash([7 * u, 4 * u]); c.lineWidth = 1 * u; c.strokeStyle = rgba(INK, 0.5);
  for (const x of [P.x0, P.x1]) { c.beginPath(); c.moveTo(X(x), Z(P.z1)); c.lineTo(X(x), Z(A.promenadeEnd)); c.stroke(); }
  c.setLineDash([]);
  c.lineWidth = 1 * u; c.strokeStyle = rgba(INK, 0.45);
  strokeRect(P.x1, 84, A.road.z0, A.road.z1);
  const ap = A.apron;
  lines(rectPoly(ap.x0, ap.x1, ap.z0, ap.z1), 50, 4 * u, 1 * u, rgba(INK, 0.28));
  lines(rectPoly(ap.x0, ap.x1 + 44, 236, 274), 50, 4 * u, 1 * u, rgba(INK, 0.28));
  c.lineWidth = 0.9 * u; c.strokeStyle = rgba(INK, 0.5);
  strokeRect(ap.x0, ap.x1, ap.z0, ap.z1); strokeRect(ap.x0, ap.x1 + 44, 236, 274);
  lines(rectPoly(rx0, rx1, R.z0, R.z1), 90, 3.2 * u, 1.1 * u, rgba(WARM, 0.5));
  c.lineWidth = 1.4 * u; c.strokeStyle = rgba(INK, 0.95); strokeRect(rx0, rx1, R.z0, R.z1);
  c.setLineDash([5 * u, 5 * u]); c.lineWidth = 1 * u; c.strokeStyle = rgba(INK, 0.8);
  c.beginPath(); c.moveTo(X(R.x), Z(R.z0 + 8)); c.lineTo(X(R.x), Z(R.z1 - 8)); c.stroke();
  c.setLineDash([]);
  c.strokeStyle = rgba(NEON, 0.85); c.lineWidth = 1.2 * u;           // the tower
  c.beginPath(); c.arc(X(A.tower.x), Z(A.tower.z), 3.4 * s, 0, Math.PI * 2); c.stroke();
}
