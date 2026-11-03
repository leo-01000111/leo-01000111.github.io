/* Corridor mode for the home page (large desktop only). See corridor.css.
   Loaded in <head> (not deferred) so html.corridor is set before the first
   paint; the rest waits for DOMContentLoaded. Native scroll drives it: a tall
   spacer under a sticky one-viewport <main>, and a rAF render that maps
   scrollY to CSS variables. Removing this file restores the normal page. */
(function () {
  "use strict";
  var GATE = "(min-width: 1280px) and (min-height: 720px) and (hover: hover) and (pointer: fine)";
  var mqGate = window.matchMedia(GATE);
  var mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;
  function wanted() { return mqGate.matches && !mqMotion.matches; }
  if (wanted()) root.classList.add("corridor");

  // ── maths ──
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function inOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function inOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

  var TL_W = 820;     // timeline layout width = its zoomed size
  var BASE_W = 1536, BASE_H = 864, MAX_SCALE = 2.2; // virtual screen; scaled up to the window
  var M = 24;         // breathing room above / below a resting section
  var on = false, E = null, L = null, spacer = null;
  var touched = [];   // [element, property] pairs to clear on deactivate
  var lastY = -1, frame = 0;
  var anim = null;    // programmatic scroll in flight
  var idleTimer = 0, lastWheel = 0;
  var state = "free"; // contact box: free | rewinding | docked | sinking
  var entered = false, graceTimer = 0, sinkTimer = 0, waitingSink = false, hoverArmed = true;
  var lock = false, quietTimer = 0, acc = 0, accTimer = 0; // guided level steps

  function setv(el, k, v) {
    el.style.setProperty(k, v);
    var seen = el._corridorProps || (el._corridorProps = {});
    if (!seen[k]) { seen[k] = 1; touched.push([el, k]); }
  }
  function show(el, yes) { setv(el, "visibility", yes ? "" : "hidden"); }

  function collect() {
    var q = function (s) { return document.querySelector(s); };
    E = {
      wrap: q(".wrap"), main: q("main"), header: q(".site-header"),
      hero: q(".home-hero"), heroMajor: q(".home-hero__major"), heroMinor: q(".home-hero__minor"),
      projects: q(".home-projects"),
      doors: Array.prototype.slice.call(document.querySelectorAll(".home-projects .hp-card, .home-projects__all")),
      cols: q(".home-columns"), colMajor: q(".home-columns__major"), colMinor: q(".home-columns__minor"),
      bg: q(".home-background"), timeline: q(".home-timeline"),
      contact: q(".home-contact")
    };
    for (var k in E) if (!E[k] || (E[k].length === 0)) return false;
    return true;
  }

  // ── layout: everything that depends on sizes, not on scroll ──
  function layout() {
    // Real window -> virtual screen. All geometry below is virtual px; only
    // scroll distances (the stops) are real px.
    var rvw = root.clientWidth, rvh = window.innerHeight;
    var k = clamp(Math.min(rvw / BASE_W, rvh / BASE_H), 1, MAX_SCALE);
    var vw = rvw / k, vh = rvh / k;
    setv(root, "--cs", String(k));
    setv(root, "--stage-w", vw + "px");
    setv(root, "--stage-h", vh + "px");
    var cs = getComputedStyle(root);
    var cmax = parseFloat(cs.getPropertyValue("--content-max")) || 1232;
    var gut = parseFloat(cs.getPropertyValue("--space-6")) || 52;
    var gx = (vw - Math.min(vw, cmax)) / 2 + gut;
    var navH = E.header.offsetHeight;
    var avail = vh - navH;
    var m = E.main;
    setv(root, "--gx", gx + "px");
    setv(m, "--tl-w", TL_W + "px");

    function rest(sec) {
      var h = sec.offsetHeight;
      var fit = Math.min(1, (avail - 2 * M) / h);
      setv(sec, "--fit", String(fit));
      return navH + (avail - h * fit) / 2;
    }
    var heroY = rest(E.hero), projY = rest(E.projects);

    // Columns: top-aligned under the nav; the skills column fits by scale.
    var colY = navH + M;
    setv(E.cols, "--fit", "1");
    var fitm = Math.min(1, (avail - 2 * M) / E.colMajor.offsetHeight);
    setv(E.colMajor, "--fitm", String(fitm));
    setv(E.colMajor, "--door-dx", (-Math.min(0.5 * gx, 48)) + "px");
    var parked = measureParked(colY, k);

    // Timeline: side by side it is scaled down into its column; zoomed it is
    // 1:1, in the free space right of the parked skills door.
    var colW = E.colMinor.clientWidth;
    var tlS = colW / TL_W;
    var minorLeft = gx + E.colMinor.offsetLeft;
    var free = vw - gx - parked.right;
    var tlLeft = parked.right + Math.max(32, (free - TL_W) / 2);
    tlLeft = clamp(tlLeft, (vw - TL_W) / 2, vw - gx - TL_W);
    var tlTop0 = colY + E.colMinor.offsetTop;
    var tlTopZ = navH + M;
    setv(E.cols, "--tl-s", String(tlS));
    setv(E.cols, "--tl-x", (tlLeft - minorLeft) + "px");
    setv(E.cols, "--tl-y", (tlTopZ - tlTop0) + "px");
    var tlH = E.bg.offsetHeight;

    // Contact box: the last item of the timeline, same width. The timeline
    // scroll ends with its bottom level with the parked Cedric.
    var ctH = E.contact.offsetHeight;
    var ctY0 = tlTopZ + tlH + 32;
    setv(m, "--ct-x", tlLeft + "px");
    setv(m, "--ct-y0", ctY0 + "px");
    var endBottom = clamp(parked.cedBottom, navH + ctH + M, vh - M);
    var len4 = Math.max(0, ctY0 + ctH - endBottom);

    // Dock line: right under the last of the leading "present" (green) entries.
    var entries = E.timeline.querySelectorAll(".home-tl-entry");
    var last = null;
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].classList.contains("home-tl-entry--go")) break;
      last = entries[i];
    }
    // offsetParents: entry -> .home-timeline -> .home-columns__minor <- .home-background
    var e3 = last ? (E.timeline.offsetTop - E.bg.offsetTop + last.offsetTop + last.offsetHeight
                     - parseFloat(getComputedStyle(last).paddingBottom)) : 0;

    var V = rvh;
    var S = { a1: 0.12 * V, b1: 1.12 * V, s1: 1.3 * V, a2: 1.48 * V, b2: 2.48 * V, s2: 2.66 * V, a3: 2.84 * V, b3: 3.84 * V };
    S.s3 = S.b3;
    S.end = S.s3 + len4 * k;
    L = { k: k, vw: vw, vh: vh, len4s: len4 * k, navH: navH, heroY: heroY, projY: projY, colY: colY, S: S, len4: len4,
          ctY0: ctY0, ctH: ctH, dockLine: tlTopZ + e3 + 16, stops: [0, S.s1, S.s2, S.s3] };
    spacer.style.height = (S.end + rvh - vh) + "px"; // <main> takes vh of flow
  }
  // Where the skills door ends up when parked: put it there for one read.
  function measureParked(colY, k) {
    var saved = [[E.cols, "--sz"], [E.cols, "--sy"], [E.colMajor, "--d"]].map(function (p) {
      return [p[0], p[1], p[0].style.getPropertyValue(p[1])];
    });
    E.cols.style.setProperty("--sz", "0");
    E.cols.style.setProperty("--sy", colY + "px");
    E.colMajor.style.setProperty("--d", "1");
    var r = E.colMajor.getBoundingClientRect();
    var ced = E.colMajor.querySelector(".home-cedric .cedric") || E.colMajor.querySelector(".home-cedric") || E.colMajor;
    var c = ced.getBoundingClientRect();
    saved.forEach(function (p) { if (p[2]) p[0].style.setProperty(p[1], p[2]); else p[0].style.removeProperty(p[1]); });
    return { right: r.right / k, cedBottom: c.bottom / k };
  }

  // ── render: scroll -> variables ──
  function render(force) {
    frame = 0;
    if (!on) return;
    var y = window.scrollY;
    if (!force && y === lastY) return;
    lastY = y;
    var S = L.S;
    var p1 = seg(y, S.a1, S.b1), p2 = seg(y, S.a2, S.b2), p3 = seg(y, S.a3, S.b3);
    var p4 = clamp((y - S.s3) / L.k, 0, L.len4);
    setv(E.main, "--p4", String(p4));

    // Hero: doors swing in, fade late.
    var d1 = inOutCubic(p1), o1 = 1 - smooth(seg(p1, 0.55, 1));
    [E.heroMajor, E.heroMinor].forEach(function (el) { setv(el, "--d", String(d1)); setv(el, "--o", String(o1)); });
    setv(E.hero, "--sy", L.heroY + "px");
    show(E.hero, p1 < 1);
    E.hero.classList.toggle("is-live", p1 < 0.02);

    // Projects: from depth during p1, cards swing out one by one during p2.
    var q1 = seg(p1, 0.35, 1);
    setv(E.projects, "--sy", L.projY + "px");
    setv(E.projects, "--sz", String(1 - outCubic(q1)));
    setv(E.projects, "--so", String(smooth(seg(q1, 0, 0.5))));
    var n = E.doors.length, step = 0.36 / Math.max(1, n - 1);
    E.doors.forEach(function (el, i) {
      var t = seg(p2, i * step, i * step + 0.64);
      setv(el, "--d", String(inOutCubic(t)));
      setv(el, "--o", String(1 - smooth(seg(t, 0.55, 1))));
    });
    show(E.projects, p1 > 0.35 && p2 < 1);
    E.projects.classList.toggle("is-live", p1 > 0.98 && p2 < 0.02);

    // Columns: from depth during p2; skills door + timeline zoom during p3.
    var q2 = seg(p2, 0.4, 1);
    setv(E.cols, "--sy", L.colY + "px");
    setv(E.cols, "--sz", String(1 - outCubic(q2)));
    setv(E.cols, "--so", String(smooth(seg(q2, 0, 0.5))));
    var d3 = inOutCubic(p3);
    setv(E.colMajor, "--d", String(d3));
    setv(E.cols, "--z3", String(d3));
    E.colMajor.classList.toggle("is-parked", p3 > 0.02);
    show(E.cols, p2 > 0.4);
    E.cols.classList.toggle("is-live", p2 > 0.98);

    // Contact: exists once the timeline is zoomed (or while pinned).
    var ctOn = p3 >= 0.999 || state !== "free";
    E.contact.classList.toggle("is-on", ctOn);
    E.contact.classList.toggle("is-live", ctOn);

  }
  function req() { if (!frame) frame = requestAnimationFrame(function () { render(false); }); }

  // ── programmatic scroll ──
  function glide(to, dur, ease, onStep, onDone) {
    stopGlide();
    var from = window.scrollY, t0 = performance.now();
    var a = { set: from, raf: 0 };
    anim = a;
    function tick(now) {
      if (anim !== a) return;
      var t = clamp((now - t0) / dur, 0, 1), e = ease(t);
      a.set = Math.round(lerp(from, to, e));
      window.scrollTo(0, a.set);
      if (onStep) onStep(e);
      render(true);
      if (t < 1) a.raf = requestAnimationFrame(tick);
      else { anim = null; if (onDone) onDone(); }
    }
    a.raf = requestAnimationFrame(tick);
    return a;
  }
  function stopGlide() {
    if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
  }
  function glideDur(dist) { return clamp(380 + Math.abs(dist) * 0.35, 450, 1400); }

  // ── fallback snap: a scrollbar drag that stops between levels eases to the nearest ──
  function onIdle() {
    if (!on || anim || state !== "free") return;
    var y = window.scrollY, S = L.S;
    if (hoverArmed && E.contact.classList.contains("is-on") && E.contact.matches(":hover")) { rewind(); return; }
    if (y >= S.s3) return; // never snap inside the timeline scroll
    var best = 0;
    L.stops.forEach(function (s) { if (Math.abs(s - y) < Math.abs(best - y)) best = s; });
    if (Math.abs(best - y) > 1) glide(best, 700, inOutCubic);
  }

  // ── contact box: rewind, dock, sink ──
  function pin(top) {
    setv(E.contact, "--ct-pin", top + "px");
    E.contact.classList.add("is-pinned");
  }
  function rewind() {
    if (state !== "free") return;
    var y = window.scrollY;
    var top = L.ctY0 - clamp((y - L.S.s3) / L.k, 0, L.len4);
    // The box freezes where it is and the timeline runs back beneath it, until
    // the 3rd entry meets the box or the timeline reaches its own top. Any gap
    // left above the box fades out the older entry showing in it.
    var p4 = clamp(L.dockLine - top, 0, L.len4);
    L.dockY = L.S.s3 + p4 * L.k;
    var e3 = L.dockLine - 16 - p4; // 3rd entry's bottom on screen once docked
    setv(E.contact, "--ct-fade", Math.max(0, top - e3) + "px");
    state = "rewinding";
    entered = E.contact.matches(":hover");
    pin(top);
    render(true);
    var dist = y - L.dockY;
    glide(L.dockY, clamp(1200 + Math.abs(dist) * 2.4, 1400, 4200), inOutSine,
      null,
      function () { state = "docked"; });
  }
  function release() { // user took over mid-rewind: the box goes back under the timeline
    stopGlide();
    clearTimeout(graceTimer); waitingSink = false;
    state = "free";
    hoverArmed = false; // only a fresh hover starts it again
    E.contact.classList.add("is-releasing");
    E.contact.classList.remove("is-pinned");
    setTimeout(function () { E.contact.classList.remove("is-releasing"); }, 460);
    render(true);
  }
  function blockedSink() {
    var a = document.activeElement;
    if (a && a !== document.body && E.contact.contains(a)) return true;
    var s = window.getSelection && window.getSelection();
    if (s && !s.isCollapsed && s.rangeCount && E.contact.contains(s.getRangeAt(0).commonAncestorContainer)) return true;
    return false;
  }
  function scheduleSink() {
    clearTimeout(graceTimer);
    graceTimer = setTimeout(function () {
      if (state !== "rewinding" && state !== "docked") return;
      if (E.contact.matches(":hover")) return;
      if (blockedSink()) { waitingSink = true; return; }
      sink();
    }, 750);
  }
  function sink() {
    stopGlide();
    clearTimeout(graceTimer); waitingSink = false;
    state = "sinking";
    E.contact.classList.add("is-sinking");
    setv(E.contact, "--ct-pin", (L.vh + 40) + "px");
    clearTimeout(sinkTimer);
    sinkTimer = setTimeout(function () {
      E.contact.classList.remove("is-sinking", "is-pinned");
      state = "free";
      render(true);
    }, 1320);
  }
  function toContact() { // nav "Contact": glide to the end of the timeline, box in view
    if (state === "sinking") { clearTimeout(sinkTimer); E.contact.classList.remove("is-sinking", "is-pinned"); }
    state = "free";
    glide(L.S.end, glideDur(window.scrollY - L.S.end) + 300, inOutCubic);
  }

  // ── user input ──
  // Between levels the page is guided: one wheel gesture or key press plays
  // the whole transition to the next level. The timeline scrolls freely.
  function userScrolled() {
    lastWheel = performance.now();
    if (state === "rewinding") release();
    else if (state === "docked") sink();
  }
  function levelIndex(y) {
    var best = 0;
    L.stops.forEach(function (s, i) { if (Math.abs(s - y) < Math.abs(L.stops[best] - y)) best = i; });
    return best;
  }
  function quiet() { // the lock lifts once the wheel (and its inertia) has been still a moment
    clearTimeout(quietTimer);
    quietTimer = setTimeout(function () { lock = false; acc = 0; }, 220);
  }
  function goLevel(i) {
    i = clamp(i, 0, 3);
    var to = L.stops[i];
    lock = true;
    clearTimeout(quietTimer);
    var a = glide(to, 1150, inOutCubic, null, quiet);
    a.guided = true;
  }
  function step(dir) {
    var y = window.scrollY, i = levelIndex(y), cur = L.stops[i];
    var next = dir > 0 ? (y < cur - 2 ? i : i + 1) : (y > cur + 2 ? i : i - 1);
    if (next >= 0 && next <= 3) goLevel(next);
  }
  function onWheel(e) {
    if (!on) return;
    userScrolled();
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    var y = window.scrollY, S = L.S;
    if (lock) { // a guided step is playing, or its inertia tail is still coming in
      quiet();
      if (y < S.s3 + 2 || (anim && anim.guided)) { e.preventDefault(); return; }
    }
    if (y > S.s3 + 1) { // timeline: native scroll, but it stops at the timeline's top
      stopGlide();
      if (y + dy < S.s3) { e.preventDefault(); window.scrollTo(0, S.s3); lock = true; quiet(); }
      return;
    }
    if (y >= S.s3 - 1 && dy > 0) { stopGlide(); return; } // into the timeline
    e.preventDefault();
    if (anim && !anim.guided) stopGlide();
    acc += dy;
    clearTimeout(accTimer);
    accTimer = setTimeout(function () { acc = 0; }, 250);
    if (Math.abs(acc) < 24) return;
    acc = 0;
    step(dy > 0 ? 1 : -1);
  }
  var KEY_DIR = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1, Home: 0, End: 0 };
  function onKey(e) {
    if (!on || !(e.key in KEY_DIR)) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
    userScrolled();
    var y = window.scrollY, S = L.S;
    var dir = e.key === " " && e.shiftKey ? -1 : KEY_DIR[e.key];
    if (e.key === "Home") { e.preventDefault(); goLevel(0); return; }
    if (e.key === "End") { e.preventDefault(); stopGlide(); glide(S.end, glideDur(y - S.end) + 300, inOutCubic); return; }
    if (y > S.s3 + 1 || (y >= S.s3 - 1 && dir > 0)) { stopGlide(); return; } // timeline: native
    e.preventDefault();
    if (!lock || !(anim && anim.guided)) step(dir);
  }
  function onDown(e) { if (on && e.clientX >= root.clientWidth) { userScrolled(); stopGlide(); } } // scrollbar drag
  function onScroll() {
    if (!on) return;
    if (anim ? Math.abs(window.scrollY - anim.set) > 3
             : state === "docked" && Math.abs(window.scrollY - L.dockY) > 3) userScrolled();
    req();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(onIdle, 180);
  }
  function onEnter() {
    if (!on) return;
    if (state === "free") {
      if (performance.now() - lastWheel > 250) rewind(); // else onIdle picks it up
    } else if (state === "rewinding" || state === "docked") {
      entered = true;
      clearTimeout(graceTimer); waitingSink = false;
    }
  }
  function onLeave() {
    hoverArmed = true;
    if (on && (state === "rewinding" || state === "docked") && entered) scheduleSink();
  }
  function onUnblock() { if (on && waitingSink && !blockedSink()) { waitingSink = false; scheduleSink(); } }

  // Nav / in-page links glide to their snap point (capture: beats main.js).
  var TARGETS = { "#top": 0, "#projects": 1, "#skills": 2, "#background": 3 };
  function onClick(e) {
    if (!on) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var h = a.getAttribute("href");
    if (h !== "#contact" && !(h in TARGETS)) return;
    e.preventDefault();
    e.stopPropagation();
    if (state === "rewinding") release();
    if (h === "#contact") { toContact(); return; }
    if (state === "docked") sink();
    var to = L.stops[TARGETS[h]];
    glide(to, glideDur(window.scrollY - to) + 300, inOutCubic);
  }
  // Keyboard focus landing in a hidden layer: bring that layer up.
  function onFocus(e) {
    if (!on || anim || state !== "free") return;
    var t = e.target, to = null;
    if (E.hero.contains(t) && !E.hero.classList.contains("is-live")) to = 0;
    else if (E.projects.contains(t) && !E.projects.classList.contains("is-live")) to = L.S.s1;
    else if (E.colMajor.contains(t) && window.scrollY !== L.S.s2) to = L.S.s2;
    else if (E.colMinor.contains(t) && window.scrollY < L.S.s3) to = L.S.s3;
    if (to !== null) glide(to, glideDur(window.scrollY - to), inOutCubic);
  }

  // ── position mapping across stops (resize, switching modes) ──
  function toLogical(y) {
    var st = L.stops;
    for (var i = 0; i < 3; i++) if (y <= st[i + 1]) return i + (y - st[i]) / (st[i + 1] - st[i]);
    return 3 + (y - st[3]) / Math.max(1, L.len4s + 1) * 0.999;
  }
  function fromLogical(v) {
    var st = L.stops;
    if (v <= 3) { var i = Math.min(2, Math.floor(v)); return st[i] + (v - i) * (st[i + 1] - st[i]); }
    return st[3] + (v - 3) / 0.999 * (L.len4s + 1);
  }
  function relayout() {
    if (!on) return;
    var v = toLogical(window.scrollY);
    layout();
    if (state !== "free") { // sizes moved under a pinned box: let it go back into the timeline
      stopGlide();
      clearTimeout(graceTimer); clearTimeout(sinkTimer); waitingSink = false;
      state = "free";
      E.contact.classList.remove("is-pinned", "is-sinking", "is-releasing");
    }
    if (!anim) window.scrollTo(0, Math.round(fromLogical(v)));
    render(true);
  }

  var ro = null, roFrame = 0;
  function activate(fromNormal) {
    if (on || !collect()) return;
    // where the normal page was, as a corridor position
    var target = 0;
    if (fromNormal) {
      var y = window.scrollY + window.innerHeight * 0.35;
      var top = function (el) { return el.getBoundingClientRect().top + window.scrollY; };
      if (y >= top(E.contact)) target = "contact";
      else if (y >= top(E.cols)) target = y - top(E.cols) > E.bg.offsetHeight * 0.3 ? 3 : 2;
      else if (y >= top(E.projects)) target = 1;
    } else if (location.hash === "#contact") target = "contact";
    else if (location.hash in TARGETS) target = TARGETS[location.hash];
    root.classList.add("corridor");
    on = true;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    spacer = document.createElement("div");
    spacer.className = "corridor-spacer";
    spacer.setAttribute("aria-hidden", "true");
    E.wrap.appendChild(spacer);
    state = "free";
    layout();
    window.scrollTo(0, target === "contact" ? L.S.end : L.stops[target]);
    render(true);
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (!roFrame) roFrame = requestAnimationFrame(function () { roFrame = 0; relayout(); });
      });
      [E.header, E.hero, E.projects, E.colMajor, E.bg, E.contact].forEach(function (el) { ro.observe(el); });
    }
  }
  function deactivate() {
    if (!on) return;
    var v = toLogical(window.scrollY), docked = state !== "free";
    on = false;
    stopGlide();
    clearTimeout(graceTimer); clearTimeout(sinkTimer); clearTimeout(idleTimer);
    if (ro) { ro.disconnect(); ro = null; }
    touched.forEach(function (p) { p[0].style.removeProperty(p[1]); p[0]._corridorProps = null; });
    touched = [];
    ["is-live", "is-parked", "is-on", "is-pinned", "is-releasing", "is-sinking"].forEach(function (c) {
      document.querySelectorAll("." + c).forEach(function (el) { el.classList.remove(c); });
    });
    if (spacer) { spacer.remove(); spacer = null; }
    root.classList.remove("corridor");
    if ("scrollRestoration" in history) history.scrollRestoration = "auto";
    lastY = -1; state = "free";
    var el = docked || v > 3.9 ? E.contact : v > 2.5 ? E.bg : v > 1.5 ? E.cols : v > 0.5 ? E.projects : null;
    window.scrollTo(0, el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 16) : 0);
  }

  // Live switch across the gate, with a short fade.
  var switching = 0;
  function onGate() {
    var want = wanted();
    if (want === on || switching) return;
    var b = document.body;
    b.style.transition = "opacity .18s ease";
    b.style.opacity = "0";
    switching = setTimeout(function () {
      if (wanted()) activate(true); else deactivate();
      requestAnimationFrame(function () {
        b.style.opacity = "";
        setTimeout(function () { b.style.transition = ""; switching = 0; onGate(); }, 200);
      });
    }, 190);
  }
  function listen(mq) {
    if (mq.addEventListener) mq.addEventListener("change", onGate); else mq.addListener(onGate);
  }

  function init() {
    if (!document.querySelector(".home-hero")) { root.classList.remove("corridor"); return; }
    listen(mqGate); listen(mqMotion);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", function () { if (on) { userScrolled(); stopGlide(); } }, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", function () { if (on && wanted()) relayout(); });
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("selectionchange", onUnblock);
    collect();
    if (E && E.contact) {
      E.contact.addEventListener("mouseenter", onEnter);
      E.contact.addEventListener("mouseleave", onLeave);
      E.contact.addEventListener("focusout", function () { setTimeout(onUnblock, 0); });
    }
    if (wanted()) activate(false); else root.classList.remove("corridor");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
