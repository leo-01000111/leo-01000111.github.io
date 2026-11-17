// Pen-and-hatch chart, built from world/layout.js only. The static chart is drawn once to an
// offscreen canvas (sea in parallel strokes at one angle, like the ocean scenery); the round
// minimap just rotates and blits it each frame, with upright labels on top. M opens the big map.
import * as L from "../world/layout.js";
import { drawPort } from "../places/port/chart.js"; // --- port ---

import { drawAerodrome } from "../places/aerodrome/chart.js"; // --- aerodrome ---
const INK = "234,223,210", SEA = "112,196,210", SAND = "232,198,140", PARK = "122,204,142", WARM = "255,176,112", CYAN = "63,230,255";
const BG = "11,13,22";
const FONT = "'Ccity Plex Mono', ui-monospace, Menlo, Consolas, monospace";
const rgba = (c, a) => `rgba(${c},${a})`;
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };

// Parallel strokes clipped to a polygon (same idea as ocean.js hatch()). Returns [x0,y0,x1,y1] segments.
function hatch(poly, angle, spacing, w) {
  const a = angle * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], nrm = [-d[1], d[0]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const ns = poly.map(p => dot(p, nrm)), out = [];
  for (let c = Math.ceil(Math.min(...ns) / spacing) * spacing; c <= Math.max(...ns); c += spacing) {
    const us = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], fa = dot(A, nrm) - c, fb = dot(B, nrm) - c;
      if ((fa < 0) !== (fb < 0)) {
        const t = fa / (fa - fb);
        us.push(dot([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], d));
      }
    }
    us.sort((p, q) => p - q);
    for (let k = 0; k + 1 < us.length; k += 2) {
      const u0 = us[k] + w * 0.55, u1 = us[k + 1] - w * 0.55;
      if (u1 - u0 > 2) out.push([nrm[0] * c + d[0] * u0, nrm[1] * c + d[1] * u0, nrm[0] * c + d[0] * u1, nrm[1] * c + d[1] * u1]);
    }
  }
  return out;
}

function halo(c, txt, x, y, u, fill) {
  c.lineWidth = 3.2 * u; c.strokeStyle = rgba(BG, 0.92); c.lineJoin = "round";
  c.strokeText(txt, x, y);
  c.fillStyle = fill; c.fillText(txt, x, y);
}

// Draws the north-up chart. world (x, z) -> px ((x - x0) * s, (z - z0) * s). u = line unit in px.
export function drawChart(c, o) {
  const { s, x0, z0, W, H, u, T } = o;
  const X = x => (x - x0) * s, Z = z => (z - z0) * s;
  const rectPoly = (a, b, c0, d) => [[X(a), Z(c0)], [X(b), Z(c0)], [X(b), Z(d)], [X(a), Z(d)]];
  const lines = (poly, ang, sp, w, col) => {
    c.beginPath();
    for (const q of hatch(poly, ang, sp, w)) { c.moveTo(q[0], q[1]); c.lineTo(q[2], q[3]); }
    c.lineWidth = w; c.strokeStyle = col; c.stroke();
  };
  const strokeRect = (a, b, c0, d) => { c.beginPath(); c.rect(X(a), Z(c0), (b - a) * s, (d - c0) * s); c.stroke(); };
  c.clearRect(0, 0, W, H);
  c.lineCap = "round"; c.lineJoin = "round";

  const zA = Math.max(z0 - 5, Math.min(L.world.z0, L.port.sail.z0) - 40), zB = Math.min(z0 + H / s + 5, Math.max(L.world.z1, L.port.sail.z1) + 40); // --- port --- the chart covers the open water too
  const xw = x0 - 5, zs = [];
  for (let z = zA; z <= zB; z += 3) zs.push(z);

  // land tint, so the sea hatch reads against something
  c.beginPath();
  zs.forEach((z, i) => { const px = X(L.shoreX(z)), py = Z(z); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
  const xE = Math.max(L.world.x1, L.track.bounds.x1 + 14); c.lineTo(X(xE), Z(zB)); c.lineTo(X(xE), Z(zA)); c.closePath();
  c.fillStyle = rgba(INK, 0.045); c.fill();

  // sea: parallel strokes at one angle
  const sea = [[X(xw), Z(zs[0])], ...zs.map(z => [X(L.shoreX(z)), Z(z)]), [X(xw), Z(zs[zs.length - 1])]];
  lines(sea, -22, 5.4 * u, 1.15 * u, rgba(SEA, 0.5));

  // beach: sparse sand strokes at another angle
  const sand = [...zs.map(z => [X(L.shoreX(z) + 1.2), Z(z)]), ...zs.slice().reverse().map(z => [X(L.promenade.x0), Z(z)])];
  lines(sand, 38, 7.5 * u, 1 * u, rgba(SAND, 0.38));

  // pier and lighthouse platform clear the sea hatch, then get pen outlines
  c.save();
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = "#000";
  for (const r of [L.pier, L.pierEnd]) c.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
  c.restore();
  c.lineWidth = 1.5 * u; c.strokeStyle = rgba(INK, 0.9);
  c.beginPath();
  c.moveTo(X(L.pier.x1), Z(L.pier.z0)); c.lineTo(X(L.pierEnd.x1), Z(L.pier.z0)); c.lineTo(X(L.pierEnd.x1), Z(L.pierEnd.z0));
  c.lineTo(X(L.pierEnd.x0), Z(L.pierEnd.z0)); c.lineTo(X(L.pierEnd.x0), Z(L.pierEnd.z1)); c.lineTo(X(L.pierEnd.x1), Z(L.pierEnd.z1));
  c.lineTo(X(L.pierEnd.x1), Z(L.pier.z1)); c.lineTo(X(L.pier.x1), Z(L.pier.z1));
  c.stroke();
  drawPort(c, X, Z, s, u); // --- port ---

  // coast: a firm pen line and a faint surf line
  const coast = (dx, w, col, dash) => {
    c.beginPath();
    zs.forEach((z, i) => { const px = X(L.shoreX(z) + dx), py = Z(z); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
    c.setLineDash(dash || []); c.lineWidth = w; c.strokeStyle = col; c.stroke(); c.setLineDash([]);
  };
  coast(0, 1.7 * u, rgba(INK, 0.9));
  coast(-2.4, 1 * u, rgba(SEA, 0.55), [5 * u, 6 * u]);

  // promenade edges
  c.setLineDash([7 * u, 4 * u]); c.lineWidth = 1 * u; c.strokeStyle = rgba(INK, 0.5);
  for (const x of [L.promenade.x0, L.promenade.x1]) { c.beginPath(); c.moveTo(X(x), Z(L.promenade.z0)); c.lineTo(X(x), Z(L.promenade.z1)); c.stroke(); }
  c.setLineDash([]);

  // blocks: light outlines; park hatched another way; plaza dotted
  const neon = {};
  for (const p of L.places) neon[p.plot] = hexRgb(p.neon);
  for (const b of L.blocks) {
    if (b.type === "park") {
      lines(rectPoly(b.x0, b.x1, b.z0, b.z1), 62, 4 * u, 1.1 * u, rgba(PARK, 0.7));
      c.lineWidth = 1 * u; c.strokeStyle = rgba(PARK, 0.9); strokeRect(b.x0, b.x1, b.z0, b.z1);
    } else if (b.type === "plaza") {
      c.fillStyle = rgba(WARM, 0.08); c.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s);
      c.setLineDash([1.5 * u, 4 * u]); c.lineWidth = 1.3 * u; c.strokeStyle = rgba(INK, 0.75); strokeRect(b.x0, b.x1, b.z0, b.z1); c.setLineDash([]);
    } else {
      c.lineWidth = 1.1 * u; c.strokeStyle = rgba(INK, b.type === "track" ? 0.3 : 0.5); strokeRect(b.x0, b.x1, b.z0, b.z1);
    }
  }
  // plots: faint outlines, the hand-designed ones lightly hatched
  for (const p of L.plots) {
    if (p.id === "karting") continue;
    const a = p.x - p.w / 2, b = p.x + p.w / 2, c0 = p.z - p.d / 2, d = p.z + p.d / 2;
    if (p.kind === "empty") { c.setLineDash([3 * u, 3 * u]); c.lineWidth = 1 * u; c.strokeStyle = rgba(INK, 0.45); strokeRect(a, b, c0, d); c.setLineDash([]); continue; }
    if (p.building) lines(rectPoly(a, b, c0, d), 50, 3.6 * u, 1 * u, rgba(neon[p.id] || WARM, neon[p.id] ? 0.62 : 0.4));
    c.lineWidth = 0.9 * u; c.strokeStyle = rgba(INK, p.building ? 0.55 : 0.24); strokeRect(a, b, c0, d);
  }
  // --- karting --- the circuit: a wide soft line, a thin one, the pit building, the grandstand and the start line
  const tr = L.track;
  const circuit = () => { c.beginPath(); tr.outline.forEach((q, i) => { if (i) c.lineTo(X(q[0]), Z(q[1])); else c.moveTo(X(q[0]), Z(q[1])); }); c.closePath(); };
  circuit(); c.lineWidth = Math.max(3 * u, tr.hw * 2 * s); c.strokeStyle = rgba(CYAN, 0.16); c.stroke();
  circuit(); c.lineWidth = 1.3 * u; c.strokeStyle = rgba(CYAN, 0.85); c.stroke();
  c.lineWidth = 1 * u; strokeRect(tr.pit.x0, tr.pit.x1, tr.pit.z0, tr.pit.z1); strokeRect(tr.stand.x0, tr.stand.x1, tr.stand.z0, tr.stand.z1);
  c.lineWidth = 2 * u; c.strokeStyle = rgba(INK, 0.95); c.beginPath(); c.moveTo(X(tr.line.x - tr.hw), Z(tr.line.z)); c.lineTo(X(tr.line.x + tr.hw), Z(tr.line.z)); c.stroke();

  drawAerodrome(c, X, Z, s, u, lines, rectPoly, strokeRect); // --- aerodrome ---
  if (o.names) streetNames(c, o, X, Z);
}

// Street names along the street, in the gap between two crossing streets.
function streetNames(c, o, X, Z) {
  const { s, u, T } = o;
  const zAts = L.streets.filter(t => t.axis === "x").map(t => t.at).sort((a, b) => a - b);
  const xAts = L.streets.filter(t => t.axis === "z").map(t => t.at).sort((a, b) => a - b);
  c.font = `500 ${Math.round(10.5 * u)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
  const inGap = (t, v) => (t.gaps || []).some(g => v > g[0] - 4 && v < g[1] + 4);
  for (const st of L.streets) {
    const name = (T.streets[st.id] || st.id).toUpperCase();
    const cross = st.axis === "z" ? zAts : xAts;
    const spans = [];
    for (let i = 0; i + 1 < cross.length; i++) {
      const a = Math.max(cross[i], st.from) , b = Math.min(cross[i + 1], st.to);
      if (b - a > 30 && !inGap(st, (a + b) / 2)) spans.push((a + b) / 2);
    }
    if (st.axis === "x") { // also try the stretch past the last crossing street
      const a = Math.max(cross[cross.length - 1], st.from), b = st.to;
      if (b - a > 30 && !inGap(st, (a + b) / 2)) spans.push((a + b) / 2);
    }
    if (!spans.length) continue;
    const m = spans[Math.floor(spans.length / 2)];
    c.save();
    if (st.axis === "z") { c.translate(X(st.at), Z(m)); c.rotate(-Math.PI / 2); } else c.translate(X(m), Z(st.at));
    halo(c, name, 0, 0, u, rgba(INK, 0.78));
    c.restore();
  }
}

// ---- round minimap ----------------------------------------------------------------------------------
const VIEW_M = 60; // metres from Cedric to the rim

export function createMinimap(g, hud) {
  const T = g.text, wrap = document.createElement("div");
  wrap.className = "ccity__minimap";
  const cv = document.createElement("canvas");
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", T.hud.minimap);
  wrap.appendChild(cv);
  hud.appendChild(wrap);
  const c = cv.getContext("2d");
  let off = null, offC = null, size = 0, dpr = 1, s = 1, R = 0, X0 = 0, Z0 = 0, grad = null;

  function layout(force) {
    const css = wrap.clientWidth || 160;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(css * dpr);
    if (px === size && force !== true) return;
    size = px; cv.width = px; cv.height = px; R = px / 2;
    s = R / VIEW_M;
    // static chart covers the whole city plus the view radius around it
    X0 = L.port.sail.x0 - VIEW_M; Z0 = Math.min(L.world.z0, L.port.sail.z0, L.track.bounds.z0 - 14) - VIEW_M - 8; // the chart also reaches the whole circuit
    // --- port --- the chart reaches the sailing limits
    const W = Math.ceil((Math.max(L.world.x1, L.track.bounds.x1 + 14) + VIEW_M - X0) * s), H = Math.ceil((Math.max(L.world.z1, L.port.sail.z1) + VIEW_M + 8 - Z0) * s); // --- port ---
    if (!off) off = document.createElement("canvas");
    off.width = W; off.height = H; offC = off.getContext("2d");
    drawChart(offC, { s, x0: X0, z0: Z0, W, H, u: dpr, T });
    grad = c.createRadialGradient(R, R, R * 0.7, R, R, R);
    grad.addColorStop(0, rgba(BG, 0)); grad.addColorStop(1, rgba(BG, 0.6));
  }
  layout();
  const off1 = g.events.on("resize", () => layout());
  // The wrapper can be measured before city.css has applied (Gecko, slow loads), which sizes the canvas
  // to the whole HUD and shrinks every mark. Re-measure whenever the wrapper's box changes.
  let ro = null;
  if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(() => { layout(); frame(); }); ro.observe(wrap); }
  // Canvas text falls back to the default font until the web font has loaded: redraw the chart once it has.
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load("600 10px 'Ccity Plex Mono'"), document.fonts.load("500 10px 'Ccity Plex Mono'")])
      .then(() => { if (off) { layout(true); frame(); } }).catch(() => {});
  }

  const places = L.places.map(p => ({ id: p.id, x: p.door[0], z: p.door[1], col: hexRgb(p.neon), name: T.places[p.id] ? T.places[p.id].name : p.id }));

  function frame() {
    if (!off) return;
    const st = g.player.state, a = st.heading, th = -Math.PI / 2 - a, ct = Math.cos(th), sn = Math.sin(th), u = dpr;
    const px = st.pos.x, pz = st.pos.z;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = rgba(BG, 0.74); c.fillRect(0, 0, size, size);
    c.translate(R, R); c.rotate(th);
    c.drawImage(off, (X0 - px) * s, (Z0 - pz) * s);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = grad; c.fillRect(0, 0, size, size);

    // places: neon marks with upright labels; the far ones sit on the rim as dots
    c.font = `600 ${Math.round(10 * u)}px ${FONT}`; c.textBaseline = "middle";
    for (const p of places) {
      const wx = (p.x - px) * s, wy = (p.z - pz) * s;
      const sx = wx * ct - wy * sn, sy = wx * sn + wy * ct, d = Math.hypot(sx, sy);
      if (d < R - 9 * u) {
        c.beginPath(); c.arc(R + sx, R + sy, 6.5 * u, 0, Math.PI * 2); c.strokeStyle = rgba(p.col, 0.45); c.lineWidth = 1 * u; c.stroke();
        c.beginPath(); c.arc(R + sx, R + sy, 3 * u, 0, Math.PI * 2); c.fillStyle = `rgb(${p.col})`; c.fill();
        const right = sx < R * 0.2;
        c.textAlign = right ? "left" : "right";
        halo(c, p.name, R + sx + (right ? 9 : -9) * u, R + sy + 0.5 * u, u, `rgb(${p.col})`);
      } else {
        const k = (R - 5 * u) / d;
        c.beginPath(); c.arc(R + sx * k, R + sy * k, 2.6 * u, 0, Math.PI * 2); c.fillStyle = rgba(p.col, 0.9); c.fill();
      }
    }

    c.restore();

    // rim: ring, compass ticks, north, sun (not clipped)
    c.lineWidth = 1.3 * u; c.strokeStyle = rgba(INK, 0.7);
    c.beginPath(); c.arc(R, R, R - 1.2 * u, 0, Math.PI * 2); c.stroke();
    const phiN = -Math.PI - a; // world north on screen
    c.lineWidth = 1 * u; c.strokeStyle = rgba(INK, 0.55);
    for (let i = 1; i < 12; i++) {
      const f = phiN + i * Math.PI / 6, r0 = R - 1.2 * u, r1 = r0 - (i % 3 ? 3 : 5) * u;
      c.beginPath(); c.moveTo(R + Math.cos(f) * r0, R + Math.sin(f) * r0); c.lineTo(R + Math.cos(f) * r1, R + Math.sin(f) * r1); c.stroke();
    }
    c.lineWidth = 1.6 * u; c.strokeStyle = rgba(INK, 0.95);
    const nr = R - 1.2 * u;
    c.beginPath(); c.moveTo(R + Math.cos(phiN) * nr, R + Math.sin(phiN) * nr); c.lineTo(R + Math.cos(phiN) * (nr - 7 * u), R + Math.sin(phiN) * (nr - 7 * u)); c.stroke();
    c.font = `600 ${Math.round(10 * u)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
    halo(c, T.map.north, R + Math.cos(phiN) * (nr - 14 * u), R + Math.sin(phiN) * (nr - 14 * u), u, rgba(INK, 1));

    const sd = g.env.time.sunDir, phiS = Math.atan2(sd.z, sd.x) + th, dim = 0.3 + 0.7 * g.env.time.p.disc;
    const sx = R + Math.cos(phiS) * (R - 1.2 * u), sy = R + Math.sin(phiS) * (R - 1.2 * u);
    c.beginPath(); c.arc(sx, sy, 6 * u, 0, Math.PI * 2); c.fillStyle = rgba(BG, 0.95); c.fill();
    c.strokeStyle = rgba(WARM, dim); c.fillStyle = rgba(WARM, dim); c.lineWidth = 1.2 * u;
    c.beginPath(); c.arc(sx, sy, 2.6 * u, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 8; i++) {
      const f = i * Math.PI / 4;
      c.beginPath(); c.moveTo(sx + Math.cos(f) * 4 * u, sy + Math.sin(f) * 4 * u); c.lineTo(sx + Math.cos(f) * 5.8 * u, sy + Math.sin(f) * 5.8 * u); c.stroke();
    }

    // Cedric: a small mark in the middle, heading up
    c.save(); c.translate(R, R);
    c.beginPath(); c.moveTo(0, -6.5 * u); c.lineTo(4.2 * u, 4.5 * u); c.lineTo(0, 2.2 * u); c.lineTo(-4.2 * u, 4.5 * u); c.closePath();
    c.fillStyle = "#9db8ff"; c.strokeStyle = rgba(BG, 0.9); c.lineWidth = 1.4 * u; c.stroke(); c.fill();
    c.beginPath(); c.arc(0, -2.4 * u, 1.1 * u, 0, Math.PI * 2); c.fillStyle = "#ff4d63"; c.fill();
    c.restore();
  }

  return {
    el: wrap,
    frame,
    dispose() { off1(); if (ro) ro.disconnect(); off = null; offC = null; wrap.remove(); },
  };
}

// ---- big map (M) -------------------------------------------------------------------------------------------
export function createBigMap(g, hud, onToggle) {
  const T = g.text;
  const root = document.createElement("div");
  root.className = "ccity__map"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-label", T.map.title);
  const fig = document.createElement("div"); fig.className = "ccity__mapfig";
  const base = document.createElement("canvas"), over = document.createElement("canvas");
  base.className = "ccity__mapbase"; over.className = "ccity__mapover";
  const title = document.createElement("div"); title.className = "ccity__maptitle"; title.textContent = T.map.title;
  const foot = document.createElement("div"); foot.className = "ccity__mapfoot"; foot.textContent = T.map.close;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button"; closeBtn.className = "ccity__btn ccity__mapclose"; closeBtn.setAttribute("aria-label", T.map.closeBtn); closeBtn.textContent = "×";
  fig.append(base, over, title, foot, closeBtn);
  root.appendChild(fig);
  hud.appendChild(root);
  const ext = { x0: -84, x1: L.world.x1 + 6, z0: L.world.z0 - 6, z1: L.world.z1 + 6 };
  ext.x1 = Math.max(ext.x1, L.track.bounds.x1 + 14); ext.z0 = Math.min(ext.z0, L.track.bounds.z0 - 14); // --- karting --- the map shows the whole circuit
  let open = false, s = 1, dpr = 1, W = 0, H = 0, acc = 0, lastKey = "";
  const places = L.places.map(p => ({ id: p.id, x: p.door[0], z: p.door[1], col: hexRgb(p.neon), name: T.places[p.id] ? T.places[p.id].name : p.id }));

  function build() {
    const vw = root.clientWidth || innerWidth, vh = root.clientHeight || innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mw = ext.x1 - ext.x0, mh = ext.z1 - ext.z0;
    s = Math.max(1, Math.min((vw - 56) / mw, (vh - 130) / mh));
    W = Math.round(mw * s); H = Math.round(mh * s);
    const key = W + "x" + H + "@" + dpr;
    fig.style.width = W + "px"; fig.style.height = H + "px";
    if (key === lastKey) return;
    lastKey = key;
    for (const cv of [base, over]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; }
    const c = base.getContext("2d");
    drawChart(c, { s: s * dpr, x0: ext.x0, z0: ext.z0, W: base.width, H: base.height, u: dpr, T, names: true });
  }

  function marks() {
    const c = over.getContext("2d"), u = dpr, k = s * dpr, st = g.player.state;
    const X = x => (x - ext.x0) * k, Z = z => (z - ext.z0) * k;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, over.width, over.height);
    c.textBaseline = "middle"; c.textAlign = "left";
    c.font = `600 ${Math.round(12 * u)}px ${FONT}`;
    for (const p of places) {
      const x = X(p.x), y = Z(p.z);
      c.beginPath(); c.arc(x, y, 8 * u, 0, Math.PI * 2); c.strokeStyle = rgba(p.col, 0.45); c.lineWidth = 1 * u; c.stroke();
      c.beginPath(); c.arc(x, y, 3.6 * u, 0, Math.PI * 2); c.fillStyle = `rgb(${p.col})`; c.fill();
      const lf = x > over.width * 0.72; c.textAlign = lf ? "right" : "left"; // labels near the east edge flip to the left
      halo(c, p.name, x + (lf ? -12 : 12) * u, y, u, `rgb(${p.col})`);
    }
    // you are here
    const x = X(st.pos.x), y = Z(st.pos.z), a = st.heading + Math.PI / 2;
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(0, -8 * u); c.lineTo(5.4 * u, 6 * u); c.lineTo(0, 3 * u); c.lineTo(-5.4 * u, 6 * u); c.closePath();
    c.fillStyle = "#9db8ff"; c.strokeStyle = rgba(BG, 0.9); c.lineWidth = 1.6 * u; c.stroke(); c.fill();
    c.beginPath(); c.arc(0, -3 * u, 1.3 * u, 0, Math.PI * 2); c.fillStyle = "#ff4d63"; c.fill();
    c.restore();
    c.font = `600 ${Math.round(12 * u)}px ${FONT}`;
    const left = x > over.width * 0.75;
    c.textAlign = left ? "right" : "left";
    halo(c, T.map.here, x + (left ? -14 : 14) * u, y - 22 * u, u, "#9db8ff");
    // north arrow and sunset mark
    const nx = over.width - 23 * u, ny = 66 * u;
    c.strokeStyle = rgba(INK, 0.9); c.lineWidth = 1.5 * u;
    c.beginPath(); c.moveTo(nx, ny + 12 * u); c.lineTo(nx, ny - 12 * u); c.lineTo(nx - 4 * u, ny - 6 * u); c.moveTo(nx, ny - 12 * u); c.lineTo(nx + 4 * u, ny - 6 * u); c.stroke();
    c.textAlign = "center"; halo(c, T.map.north, nx, ny - 21 * u, u, rgba(INK, 1));
    const sx = 20 * u, sy = Z(0) - 22 * u;
    c.strokeStyle = rgba(WARM, 0.9); c.fillStyle = rgba(WARM, 0.9); c.lineWidth = 1.2 * u;
    c.beginPath(); c.arc(sx, sy, 3 * u, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 8; i++) { const f = i * Math.PI / 4; c.beginPath(); c.moveTo(sx + Math.cos(f) * 5 * u, sy + Math.sin(f) * 5 * u); c.lineTo(sx + Math.cos(f) * 7.5 * u, sy + Math.sin(f) * 7.5 * u); c.stroke(); }
    c.textAlign = "left"; c.font = `500 ${Math.round(10.5 * u)}px ${FONT}`; halo(c, T.map.sun, sx + 13 * u, sy, u, rgba(WARM, 0.95));
  }

  const api = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true; root.hidden = false;
      if (g.port) { g.port.mapExtent(ext); lastKey = ""; } // --- port --- the map follows the boat out to sea
      ext.x1 = Math.max(ext.x1, L.track.bounds.x1 + 14); ext.z0 = Math.min(ext.z0, L.track.bounds.z0 - 14); // --- karting --- keep the whole circuit in view
      build(); marks();
      requestAnimationFrame(() => { if (open) root.classList.add("is-on"); });
      closeBtn.focus({ preventScroll: true });
      if (onToggle) onToggle(true);
    },
    close() {
      if (!open) return;
      open = false; root.classList.remove("is-on");
      setTimeout(() => { if (!open) root.hidden = true; }, 260);
      if (onToggle) onToggle(false);
    },
    toggle() { open ? api.close() : api.open(); },
    update(dt) { if (!open) return; acc += dt; if (acc > 0.12) { acc = 0; marks(); } },
    resize() { if (open) { build(); marks(); } },
    closeBtn,
    dispose() { root.remove(); },
  };
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load("600 12px 'Ccity Plex Mono'"), document.fonts.load("500 12px 'Ccity Plex Mono'")])
      .then(() => { lastKey = ""; if (open) { build(); marks(); } }).catch(() => {});
  }
  root.addEventListener("pointerdown", e => { if (e.target === root) api.close(); });
  closeBtn.addEventListener("click", () => api.close());
  return api;
}
