/* Cédric's ocean: the secret behind the page. Blue Cédric's 5th poke on the home page
   invites you on a trip; the page pans left and an ocean floor slides in, where his friends
   Basile, Octave and Firmin are swimming. Loaded on demand by chat.js.
   All shrimp talk here is French (lines.json → "ocean"); only the back button follows
   the site language. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const PAN_MS = 1700;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const s = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const n1 = v => Math.round(v * 10) / 10;

  // ---- scenery, drawn in Cédric's pen-hatch style --------------------------------
  // Parallel round-capped strokes clipped to a polygon (same idea as his body).
  function hatch(poly, angle, spacing, w) {
    const d = [Math.cos(angle * Math.PI / 180), Math.sin(angle * Math.PI / 180)], nrm = [-d[1], d[0]];
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
      us.sort((a, b) => a - b);
      for (let k = 0; k + 1 < us.length; k += 2) {
        const u0 = us[k] + w * 0.55, u1 = us[k + 1] - w * 0.55;
        if (u1 - u0 > 2) out.push([nrm[0] * c + d[0] * u0, nrm[1] * c + d[1] * u0, nrm[0] * c + d[0] * u1, nrm[1] * c + d[1] * u1]);
      }
    }
    return out;
  }
  const line = (g, x0, y0, x1, y1, w, cls) =>
    g.appendChild(s("path", { d: `M${n1(x0)} ${n1(y0)}L${n1(x1)} ${n1(y1)}`, "stroke-width": w, class: cls }));

  const ART_W = 1600, ART_H = 900, FLOOR = 720;
  const floorY = x => FLOOR + 18 * Math.sin(x / 170) + 9 * Math.sin(x / 61 + 1);
  const duneY = x => FLOOR - 46 + 20 * Math.sin(x / 230 + 2) + 8 * Math.sin(x / 83);

  // Seeded random, so the scene is drawn the same way on every visit.
  function seeded(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Keep the part of a polygon on the + side of the line dot(p, n) = c.
  function clipHalf(poly, nrm, c) {
    const out = [], f = p => p[0] * nrm[0] + p[1] * nrm[1] - c;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
      if (fa >= 0) out.push(A);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
    return out;
  }
  const pathOf = (pts, closed) => "M" + pts.map(p => `${n1(p[0])} ${n1(p[1])}`).join("L") + (closed ? "Z" : "");
  const stroke = (g, d, w, cls, extra) => {
    const p = s("path", Object.assign({ d, "stroke-width": w, class: cls }, extra || {}));
    g.appendChild(p);
    return p;
  };
  const qcurve = (g, a, c, b, w, cls) =>
    stroke(g, `M${n1(a[0])} ${n1(a[1])}Q${n1(c[0])} ${n1(c[1])} ${n1(b[0])} ${n1(b[1])}`, w, cls);
  const swaying = (g, x, y, R, amp) => {
    g.classList.add("cocean__sway");
    g.style.transformOrigin = `${n1(x)}px ${n1(y)}px`;
    g.style.animationDelay = -R() * 6 + "s";
    g.style.animationDuration = 5 + R() * 3 + "s";
    if (amp) g.style.setProperty("--amp", amp + "deg");
    return g;
  };

  // ---- the pieces ----

  function sandLayer(R) {
    const g = s("g", {});
    // far dune: lighter, sparser
    const dune = [];
    for (let x = -20; x <= ART_W + 20; x += 20) dune.push([x, duneY(x)]);
    dune.push([ART_W + 20, FLOOR + 60], [-20, FLOOR + 60]);
    hatch(dune, -22, 15, 3).forEach(q => line(g, ...q, 3, "cocean__duneline"));
    stroke(g, pathOf(dune.slice(0, -2)), 4, "cocean__duneline", { "stroke-dasharray": "70 18" });
    return g;
  }

  function floorLayer(R) {
    const g = s("g", {});
    const floor = [];
    for (let x = -20; x <= ART_W + 20; x += 16) floor.push([x, floorY(x)]);
    floor.push([ART_W + 20, ART_H + 20], [-20, ART_H + 20]);
    hatch(floor, -22, 11, 3.5).forEach(q => line(g, ...q, 3.5, "cocean__sand"));
    // top edge: a broken pen line
    stroke(g, pathOf(floor.slice(0, -2)), 5, "cocean__sanddark", { "stroke-dasharray": "90 14 30 12" });
    // ripples: short wavy arcs in rows below the edge
    for (let row = 1; row <= 4; row++) {
      for (let x = R() * 60; x < ART_W; x += 70 + R() * 60) {
        const y = floorY(x) + row * 34 + R() * 8, len = 40 + R() * 40;
        qcurve(g, [x, y], [x + len / 2, y - 7], [x + len, y + 1], 3.5, "cocean__sanddark");
      }
    }
    // grains
    for (let i = 0; i < 170; i++) {
      const x = R() * ART_W, y = floorY(x) + 14 + R() * (ART_H - FLOOR);
      line(g, x, y, x + 3 + R() * 4, y - 1 - R() * 2, 3, "cocean__sanddark");
    }
    // pebbles
    for (let i = 0; i < 16; i++) {
      const x = R() * ART_W, y = floorY(x) + 10 + R() * 120, r = 4 + R() * 6;
      g.appendChild(s("ellipse", { cx: n1(x), cy: n1(y), rx: n1(r * 1.3), ry: n1(r), "stroke-width": 3, class: "cocean__pebble" }));
    }
    // shells: a little fan of ribs under an arc
    [[300, 40], [770, 70], [1270, 30], [1560, 90]].forEach(([x, dy]) => {
      const y = floorY(x) + dy, r = 14;
      stroke(g, `M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}`, 4, "cocean__shell");
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + Math.PI * (k + 0.5) / 5;
        line(g, x, y + 4, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, 2.5, "cocean__shell");
      }
    });
    return g;
  }

  // Rock: irregular dome, light hatch overall, cross-hatched shadow on the lower right,
  // a broken outline, a couple of cracks and some moss on top.
  function rock(g, R, cx, rx, ry) {
    const cy = floorY(cx) + 16, top = [], poly = [];
    for (let k = 0; k <= 22; k++) {
      const t = Math.PI * k / 22, wob = 1 + (R() - 0.5) * 0.16;
      top.push([cx + rx * Math.cos(t) * wob, cy - ry * Math.sin(t) * wob * (1 + 0.1 * Math.sin(3 * t))]);
    }
    poly.push(...top, [cx - rx, cy + 10], [cx + rx, cy + 10]);
    hatch(poly, 35, 10, 3.5).forEach(q => line(g, ...q, 3.5, "cocean__rock"));
    const nl = [0.8, 0.6], len = Math.hypot(...nl), nrm = [nl[0] / len, nl[1] / len];
    const shadow = clipHalf(poly, nrm, cx * nrm[0] + (cy - ry * 0.35) * nrm[1]);
    if (shadow.length > 2) hatch(shadow, -40, 8, 3).forEach(q => line(g, ...q, 3, "cocean__rockdark"));
    stroke(g, pathOf(top), 4.5, "cocean__rockdark", { "stroke-dasharray": `${50 + R() * 30} 12` });
    for (let c = 0; c < 2; c++) {
      let x = cx + (R() - 0.5) * rx, y = cy - ry * (0.3 + R() * 0.4);
      const pts = [[x, y]];
      for (let k = 0; k < 3; k++) { x += (R() - 0.5) * 18; y += 8 + R() * 8; pts.push([x, y]); }
      stroke(g, pathOf(pts), 3, "cocean__rockdark");
    }
    for (let m = 0; m < 9; m++) {
      const p = top[3 + Math.floor(R() * (top.length - 6))];
      line(g, p[0], p[1] - 2, p[0] + (R() - 0.5) * 8, p[1] - 6 - R() * 6, 3.5, "cocean__weedline2");
    }
  }

  // Kelp: wavy stem, curved leaf blades alternating sides, a few air bladders.
  function kelp(g, R, bx, height, cls) {
    const base = floorY(bx) + 8, k = s("g", {}), ph = R() * 6, stem = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      stem.push([bx + Math.sin(t * 3.2 + ph) * 18 * t, base - t * height]);
    }
    stroke(k, pathOf(stem), 5, cls);
    const n = Math.round(height / 26);
    for (let i = 1; i < n; i++) {
      const t = i / n, p = stem[Math.round(t * 24)], side = i % 2 ? 1 : -1, len = 42 * (1 - t * 0.5) + R() * 10;
      qcurve(k, p, [p[0] + side * len * 0.55, p[1] - len * 0.05], [p[0] + side * len, p[1] - len * 0.6], 6, cls);
      qcurve(k, [p[0] + side * 6, p[1] - 3], [p[0] + side * len * 0.55, p[1] - len * 0.35], [p[0] + side * len * 0.85, p[1] - len * 0.62], 3, cls);
      if (i % 3 === 0) k.appendChild(s("circle", { cx: n1(p[0] - side * 7), cy: n1(p[1] - 4), r: 4, "stroke-width": 3, class: "cocean__bladder" }));
    }
    g.appendChild(swaying(k, bx, base, R));
  }

  // Sea grass: a tuft of thin curved blades.
  function grass(g, R, bx) {
    const base = floorY(bx) + 6, t = s("g", {}), n = 6 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = (-35 + 70 * i / (n - 1) + (R() - 0.5) * 10) * Math.PI / 180, h = 50 + R() * 60;
      const tip = [bx + Math.sin(a) * h, base - Math.cos(a) * h];
      qcurve(t, [bx + (R() - 0.5) * 10, base], [bx + Math.sin(a) * h * 0.2, base - h * 0.6], tip, 4, i % 2 ? "cocean__weedline" : "cocean__weedline2");
    }
    g.appendChild(swaying(t, bx, base, R, 6));
  }

  // Staghorn coral: recursively forking, tapering pink branches.
  function staghorn(g, R, bx) {
    const base = floorY(bx) + 8, c = s("g", {});
    const grow = (x, y, ang, len, w, depth) => {
      const bend = (R() - 0.5) * 0.4;
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      qcurve(c, [x, y], [x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5], [ex, ey], w, "cocean__coral1");
      if (depth <= 0) return;
      const spread = 0.3 + R() * 0.25;
      grow(ex, ey, ang - spread, len * (0.72 + R() * 0.1), w * 0.78, depth - 1);
      grow(ex, ey, ang + spread, len * (0.72 + R() * 0.1), w * 0.78, depth - 1);
      if (R() < 0.3) grow(ex, ey, ang + (R() - 0.5) * 0.3, len * 0.55, w * 0.7, depth - 2);
    };
    grow(bx, base, -Math.PI / 2 + (R() - 0.5) * 0.2, 46, 13, 4);
    g.appendChild(c);
  }

  // Sea fan: ribs fanning out from the base, forked tips, and a fine net between ribs.
  function seafan(g, R, bx, radius) {
    const base = floorY(bx) + 6, f = s("g", {}), ribs = [], n = 11;
    for (let i = 0; i < n; i++) {
      const a = (-62 + 124 * i / (n - 1)) * Math.PI / 180, r = radius * (0.82 + R() * 0.18), pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, wob = Math.sin(t * 5 + i) * 4;
        pts.push([bx + Math.sin(a) * r * t + wob, base - Math.cos(a) * r * t]);
      }
      ribs.push(pts);
      stroke(f, pathOf(pts), 4.5, "cocean__coral2");
      const tip = pts[8], prev = pts[6];
      [-0.45, 0.45].forEach(da => {
        const dir = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) + da;
        line(f, ...pts[7], pts[7][0] + Math.cos(dir) * 18, pts[7][1] + Math.sin(dir) * 18, 3, "cocean__coral2");
      });
    }
    for (let k = 2; k <= 7; k++) {
      for (let i = 0; i + 1 < n; i++) {
        const a = ribs[i][k], b = ribs[i + 1][k];
        qcurve(f, a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 5], b, 2, "cocean__coral2");
      }
    }
    g.appendChild(swaying(f, bx, base, R, 3));
  }

  // Brain coral: a dome of wavy, maze-like contour lines.
  function brain(g, R, bx, rx, ry) {
    const base = floorY(bx) + 10, b = s("g", {});
    for (let ring = 0; ring < 6; ring++) {
      const sc = 1 - ring * 0.16, pts = [];
      for (let k = 0; k <= 40; k++) {
        const t = Math.PI * k / 40, wig = Math.sin(t * 16 + ring * 1.7) * 4 * sc;
        pts.push([bx + Math.cos(t) * (rx * sc + wig), base - Math.sin(t) * (ry * sc + wig)]);
      }
      stroke(b, pathOf(pts), ring === 0 ? 5 : 3.5, "cocean__coral3");
    }
    g.appendChild(b);
  }

  // Tube anemones: a cluster of tubes, each with a rim and wiggly tentacles.
  function tubes(g, R, bx) {
    const t = s("g", {});
    for (let i = 0; i < 5; i++) {
      const x = bx + (i - 2) * 16 + (R() - 0.5) * 6, base = floorY(x) + 8, h = 30 + R() * 45;
      line(t, x, base, x + (R() - 0.5) * 6, base - h, 11, "cocean__coral1");
      t.appendChild(s("ellipse", { cx: n1(x), cy: n1(base - h - 2), rx: 8, ry: 3.5, "stroke-width": 3, class: "cocean__rim" }));
      for (let k = 0; k < 6; k++) {
        const a = (-70 + 140 * k / 5) * Math.PI / 180, L = 10 + R() * 8;
        qcurve(t, [x, base - h - 3], [x + Math.sin(a) * L * 0.5 + 3, base - h - 3 - Math.cos(a) * L * 0.6], [x + Math.sin(a) * L, base - h - 3 - Math.cos(a) * L], 2.5, "cocean__coral3");
      }
    }
    g.appendChild(swaying(t, bx, floorY(bx), R, 2));
  }

  function scenery() {
    const R = seeded(20261007);
    const svg = s("svg", { viewBox: `0 0 ${ART_W} ${ART_H}`, preserveAspectRatio: "xMidYMax slice", class: "cocean__art", "aria-hidden": "true" });
    const defs = s("defs", {}), grad = s("linearGradient", { id: "coWater", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(s("stop", { offset: "0", class: "cocean__w0" }), s("stop", { offset: "1", class: "cocean__w1" }));
    defs.appendChild(grad);
    svg.append(defs, s("rect", { x: 0, y: 0, width: ART_W, height: ART_H, fill: "url(#coWater)" }));

    // light rays from the surface
    const rays = s("g", { class: "cocean__rays" });
    [[180, 90], [520, 60], [860, 120], [1240, 80]].forEach(([x, w], i) => {
      const p = s("polygon", { points: `${x},0 ${x + w},0 ${x + w + 380},${FLOOR} ${x + 300},${FLOOR}`, class: "cocean__ray" });
      p.style.animationDelay = -i * 2.3 + "s";
      rays.appendChild(p);
    });
    svg.appendChild(rays);

    // back to front: far dune, tall kelp, rocks, the sand floor, then corals and grass on it
    svg.appendChild(sandLayer(R));
    const back = s("g", {});
    kelp(back, R, 95, 300, "cocean__weedline");
    kelp(back, R, 560, 250, "cocean__weedline2");
    kelp(back, R, 1045, 320, "cocean__weedline");
    kelp(back, R, 1505, 230, "cocean__weedline2");
    svg.appendChild(back);
    const rocks = s("g", {});
    rock(rocks, R, 255, 125, 70);
    rock(rocks, R, 1185, 165, 78);
    rock(rocks, R, 1440, 90, 50);
    rock(rocks, R, 760, 60, 34);
    svg.appendChild(rocks);
    svg.appendChild(floorLayer(R));
    const front = s("g", {});
    staghorn(front, R, 415);
    staghorn(front, R, 1330);
    seafan(front, R, 655, 140);
    seafan(front, R, 1580, 120);
    brain(front, R, 965, 72, 46);
    brain(front, R, 140, 52, 34);
    tubes(front, R, 860);
    tubes(front, R, 1110);
    [335, 520, 715, 920, 1250, 1470].forEach(x => grass(front, R, x));
    svg.appendChild(front);

    // rising bubbles
    const bubbles = s("g", {});
    [130, 420, 590, 900, 1080, 1190, 1340, 1520].forEach(x => {
      for (let k = 0; k < 2; k++) {
        const c = s("circle", { cx: x + rand(-20, 20), cy: floorY(x) - 30, r: rand(4, 10), class: "cocean__bubble" });
        c.style.animationDuration = rand(6, 11) + "s";
        c.style.animationDelay = -rand(0, 11) + "s";
        bubbles.appendChild(c);
      }
    });
    svg.appendChild(bubbles);
    return svg;
  }

  // ---- swimmers ------------------------------------------------------------------
  // The page-to-ocean leg uses the same upright, leaning keyframes as hide-and-seek.
  const kf = (x, y, r, sx, sc, offset) => ({
    transform: `translate(${n1(x)}px, ${n1(y)}px) rotate(${n1(r)}deg) scale(${sx.toFixed(3)}, ${sc.toFixed(3)})`, offset,
  });
  function travel(el, from, to, w0, w1, W, facing, duration, turnAtEnd) {
    const ks = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30, e = u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
      const x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e - Math.sin(u * Math.PI) * 40;
      const sc = (w0 + (w1 - w0) * u) / W;
      let f = facing;
      if (turnAtEnd && u > .82) f = facing + (-facing - facing) * ((u - .82) / .18);   // turn round at the end
      const lean = 10 * Math.min(1, u * 4) * Math.min(1, (1 - u) * 4);
      ks.push(kf(x, y, facing * lean, f * sc, sc, u));
    }
    return el.animate(ks, { duration, easing: "linear", fill: "forwards" }).finished;
  }
  function swimmer(W, cls) {
    const el = h("div", "cswim cswim--trip " + (cls || ""));
    el.style.width = W + "px";
    el.style.marginLeft = -W / 2 + "px";
    el.style.marginTop = -W * 0.36 + "px";
    document.body.appendChild(el);
    const c = Cedric.mount({ design: window.CEDRIC_DESIGN, target: el, fixed: false, interactive: false, draw: false });
    c.root.classList.add("is-swimming");
    return { el, c };
  }

  let state = null;

  // Ocean bounds in screen pixels (the art is bottom-aligned and scaled to cover).
  function bounds() {
    const W = innerWidth, H = innerHeight, k = Math.max(W / ART_W, H / ART_H);
    const floor = H - (ART_H - FLOOR) * k;
    // Keep ~120 px from the sides so speech bubbles (centred above them) stay on screen.
    return { W, H, x0: Math.max(W * 0.08, 120), x1: Math.min(W * 0.92, W - 120), y0: Math.max(H * 0.14, 90), y1: floor - 60 };
  }
  const fishSize = () => clamp(innerWidth * 0.13, 100, 190);

  function addFish(opts) {
    const size = fishSize(), el = h("div", "cfish-wrap");
    el.style.width = size + "px";
    state.layer.appendChild(el);
    const c = Cedric.mount({
      design: window.CEDRIC_DESIGN, target: el, fixed: false, draw: false, sleepy: false,
      lines: { greeting: "", wake: "", poke: opts.lines }, label: opts.name,
    });
    c.root.classList.add("cfish", ...(opts.cls || []));
    const f = Math.random() < .5 ? -1 : 1;
    const F = { el, c, name: opts.name, x: opts.x, y: opts.y, vx: 0, vy: 0, f, sx: f, r: 0, size,
                speed: rand(55, 85), target: null, idleUntil: performance.now() + rand(0, 1500) };
    if (opts.f) { F.f = F.sx = opts.f; }
    state.fish.push(F);
    place(F);
    return F;
  }
  function place(F) {
    F.el.style.transform = `translate(${n1(F.x - F.size / 2)}px, ${n1(F.y - F.size * 0.36)}px)`;
    const svg = F.c.svg;
    if (svg) svg.style.transform = `rotate(${n1(F.r)}deg) scale(${F.sx.toFixed(3)}, 1)`;
  }

  // Each fish: pick a spot, swim there (upright, leaning into the motion, turning round
  // when it changes direction), idle a moment, repeat. Light separation keeps them apart.
  function loop(now) {
    if (!state) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    const B = bounds(), calm = still() ? 0.5 : 1, size = fishSize();
    for (const F of state.fish) {
      if (F.size !== size) { F.size = size; F.el.style.width = size + "px"; }   // window resized
      if (!F.target && now > F.idleUntil) F.target = [rand(B.x0, B.x1), rand(B.y0, B.y1)];
      let dvx = 0, dvy = 0;
      if (F.target) {
        const dx = F.target[0] - F.x, dy = F.target[1] - F.y, d = Math.hypot(dx, dy);
        if (d < 12) { F.target = null; F.idleUntil = now + rand(700, 2600); }
        else { const sp = Math.min(F.speed * calm, d * 1.2); dvx = dx / d * sp; dvy = dy / d * sp; }
      }
      for (const G of state.fish) {
        if (G === F) continue;
        const dx = F.x - G.x, dy = F.y - G.y, d = Math.hypot(dx, dy), min = (F.size + G.size) * 0.6;
        if (d > 0 && d < min) { const push = (min - d) / min * 110; dvx += dx / d * push; dvy += dy / d * push; }
      }
      F.vx += (dvx - F.vx) * Math.min(1, dt * 1.8);
      F.vy += (dvy - F.vy) * Math.min(1, dt * 1.8);
      F.x = clamp(F.x + F.vx * dt, B.x0, B.x1);
      F.y = clamp(F.y + F.vy * dt, B.y0, B.y1);
      if (Math.abs(F.vx) > 10) F.f = Math.sign(F.vx);
      F.sx += (F.f - F.sx) * Math.min(1, dt * 5);
      const lean = clamp(F.vx / F.speed, -1, 1) * 8 + F.f * clamp(F.vy / F.speed, -1, 1) * 5;
      F.r += (lean - F.r) * Math.min(1, dt * 4);
      place(F);
    }
  }

  // ---- scroll lock while in the ocean ---------------------------------------------
  const KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
  function blockScroll(e) {
    if (e.type === "keydown") {
      if (e.key === "Escape") { close(); return; }
      if (!KEYS.includes(e.key) || (e.target.closest && e.target.closest("button, input, textarea"))) return;
    }
    e.preventDefault();
  }

  // ---- open / close ---------------------------------------------------------------
  function open(ctx) {
    if (state) return;
    const L = ctx.ocean || {};
    const layer = h("div", "cocean");
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", ctx.lang === "fr" ? "L'océan de Cédric" : "Cédric's ocean");
    layer.appendChild(scenery());
    const back = h("button", "cocean__back", ctx.back);
    back.type = "button";
    back.addEventListener("click", close);
    layer.appendChild(back);
    const moving = [...document.body.children].filter(e => !e.matches("script, style, link, .cswim"));
    document.body.appendChild(layer);

    state = { layer, fish: [], last: performance.now(), moving, ctx, closing: false };
    ["wheel", "touchmove", "keydown"].forEach(t => addEventListener(t, blockScroll, { passive: false }));

    // friends, already swimming
    const B = bounds(), friends = L.friends || {};
    const eyes = { Basile: "cfish--blue-eye", Octave: "cfish--green-eye", Firmin: "cfish--yellow-eye" };
    Object.keys(eyes).forEach((name, i) => addFish({
      name, cls: ["cfish--coral", eyes[name]], lines: friends[name] || ["blub."],
      x: B.x0 + (B.x1 - B.x0) * (0.45 + i * 0.22), y: B.y0 + (B.y1 - B.y0) * rand(0.2, 0.8),
    }));
    requestAnimationFrame(loop);

    const homeSvg = ctx.home.svg, S0 = homeSvg.getBoundingClientRect();
    state.homeRect = S0;
    ctx.home.root.style.visibility = "hidden";
    const target = [B.x0 + (B.x1 - B.x0) * 0.25, B.y0 + (B.y1 - B.y0) * 0.45];

    const arrive = () => {
      const F = addFish({ name: "Cédric", cls: ["cedric--blue"], lines: L.blue || ["blub."], x: target[0], y: target[1], f: 1 });
      state.blue = F;
      F.idleUntil = performance.now() + 1500;
      setTimeout(() => F.c.say((L.blue || ["blub."])[0]), 400);
      state.fish.filter(G => G !== F).forEach((G, i) =>
        setTimeout(() => state && G.c.say(((friends[G.name] || ["salut !"])[0])), 1600 + i * 900));
      back.focus();
    };

    if (still()) {
      moving.forEach(e => { e.style.visibility = "hidden"; });
      arrive();
      return;
    }
    layer.style.transform = "translateX(100vw)";
    layer.getBoundingClientRect();
    const tr = `transform ${PAN_MS}ms cubic-bezier(.6,0,.3,1)`;
    layer.style.transition = tr;
    moving.forEach(e => { e.style.transition = tr; e.style.transform = "translateX(-100vw)"; });
    layer.style.transform = "translateX(0)";

    const sw = swimmer(S0.width, "cswim--blue");
    sw.c.root.classList.add("cedric--blue");
    const from = [S0.left + S0.width / 2, S0.top + S0.height / 2];
    travel(sw.el, from, target, S0.width, fishSize(), S0.width, 1, PAN_MS + 250).then(() => {
      sw.c.destroy(); sw.el.remove();
      if (state) arrive();
    });
  }

  function close() {
    if (!state || state.closing) return;
    state.closing = true;
    const { layer, moving, ctx, homeRect: S0 } = state;
    const done = () => {
      state.fish.forEach(F => F.c.destroy());
      layer.remove();
      moving.forEach(e => { e.style.transition = ""; e.style.transform = ""; e.style.visibility = ""; });
      ["wheel", "touchmove", "keydown"].forEach(t => removeEventListener(t, blockScroll, { passive: false }));
      state = null;
      ctx.home.root.style.visibility = "";
      ctx.onClosed && ctx.onClosed();
    };
    if (still()) { done(); return; }

    // Blue leaves his friends and swims back home, left, while the page pans back.
    const B = state.blue;
    const from = B ? [B.x, B.y] : [innerWidth * 0.3, innerHeight * 0.45], w0 = B ? B.size : fishSize();
    if (B) { state.fish = state.fish.filter(F => F !== B); B.c.destroy(); B.el.remove(); }
    const sw = swimmer(S0.width, "cswim--blue");
    sw.c.root.classList.add("cedric--blue");
    const to = [S0.left + S0.width / 2, S0.top + S0.height / 2];
    const tr = `transform ${PAN_MS}ms cubic-bezier(.6,0,.3,1)`;
    layer.style.transition = tr;
    layer.style.transform = "translateX(100vw)";
    moving.forEach(e => { e.style.transition = tr; e.style.transform = "translateX(0)"; });
    travel(sw.el, from, to, w0, S0.width, S0.width, -1, PAN_MS + 250, true).then(() => {
      sw.c.destroy(); sw.el.remove();
      done();
    });
  }

  window.CedricOcean = { open, close };
})();
