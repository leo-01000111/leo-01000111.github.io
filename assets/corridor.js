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
  var M = 24;         // breathing room above / below a resting section
  var on = false, E = null, L = null, spacer = null;
  var touched = [];   // [element, property] pairs to clear on deactivate
  var lastY = -1, frame = 0;
  var anim = null;    // programmatic scroll in flight
  var idleTimer = 0, lastWheel = 0;
  var state = "free"; // contact box: free | rewinding | docked | sinking
  var entered = false, graceTimer = 0, sinkTimer = 0, waitingSink = false, bottomArmed = true, hoverArmed = true;

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
    var vw = root.clientWidth, vh = window.innerHeight;
    var cs = getComputedStyle(root);
    var cmax = parseFloat(cs.getPropertyValue("--content-max")) || 1232;
    var gut = parseFloat(cs.getPropertyValue("--space-6")) || 52;
    var gx = (vw - Math.min(vw, cmax)) / 2 + gut;
    var navH = E.header.offsetHeight;
    var avail = vh - navH;
    var m = E.main;
    setv(m, "--gx", gx + "px");
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
    setv(E.colMajor, "--door-dx", (-1.15 * gx) + "px");

    // Timeline: side by side it is scaled down into its column; zoomed it is
    // 1:1 and centred. Offsets are relative to its resting box.
    var colW = E.colMinor.clientWidth;
    var tlS = colW / TL_W;
    var minorLeft = gx + E.colMinor.offsetLeft;
    var tlX = (vw - TL_W) / 2 - minorLeft;
    var tlTop0 = colY + E.colMinor.offsetTop;
    var tlTopZ = navH + M;
    setv(E.cols, "--tl-s", String(tlS));
    setv(E.cols, "--tl-x", tlX + "px");
    setv(E.cols, "--tl-y", (tlTopZ - tlTop0) + "px");
    var tlH = E.bg.offsetHeight;

    // Contact box: under the zoomed timeline, same width.
    var ctH = E.contact.offsetHeight;
    var ctY0 = tlTopZ + tlH + 32;
    setv(m, "--ct-x", (vw - TL_W) / 2 + "px");
    setv(m, "--ct-y0", ctY0 + "px");
    var len4 = Math.max(0, ctY0 + ctH + M - vh);

    // Dock: right under the last of the leading "present" (green) entries.
    var entries = E.timeline.querySelectorAll(".home-tl-entry");
    var last = null;
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].classList.contains("home-tl-entry--go")) break;
      last = entries[i];
    }
    // offsetParents: entry -> .home-timeline -> .home-columns__minor <- .home-background
    var e3 = last ? (E.timeline.offsetTop - E.bg.offsetTop + last.offsetTop + last.offsetHeight
                     - parseFloat(getComputedStyle(last).paddingBottom)) : 0;
    var dockP = clamp(tlTopZ + e3 + 16 + ctH + M - vh, 0, len4);
    var dockTop = tlTopZ + e3 + 16 - dockP;

    var V = vh;
    var S = { a1: 0.12 * V, b1: 1.12 * V, s1: 1.3 * V, a2: 1.48 * V, b2: 2.48 * V, s2: 2.66 * V, a3: 2.84 * V, b3: 3.84 * V };
    S.s3 = S.b3;
    S.end = S.s3 + len4;
    L = { vw: vw, vh: vh, navH: navH, heroY: heroY, projY: projY, colY: colY, S: S, len4: len4,
          ctY0: ctY0, ctH: ctH, dockY: S.s3 + dockP, dockTop: dockTop, stops: [0, S.s1, S.s2, S.s3] };
    spacer.style.height = S.end + "px";
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
    var p4 = clamp(y - S.s3, 0, L.len4);
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
    var ctOn = p3 >= 1 || state !== "free";
    E.contact.classList.toggle("is-on", ctOn);
    E.contact.classList.toggle("is-live", ctOn);

    if (y < S.end - 0.3 * L.vh) bottomArmed = true;
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
  }
  function stopGlide() {
    if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
  }
  function glideDur(dist) { return clamp(380 + Math.abs(dist) * 0.35, 450, 1400); }

  // ── hybrid snap: when the user stops between stops, ease to the nearest ──
  function onIdle() {
    if (!on || anim || state !== "free") return;
    var y = window.scrollY, S = L.S;
    if (L.len4 > 0 && y >= S.end - 2 && bottomArmed) { rewind(); return; }
    if (hoverArmed && E.contact.classList.contains("is-on") && E.contact.matches(":hover")) { rewind(); return; }
    if (y >= S.s3) return; // never snap inside the timeline scroll
    var best = 0;
    L.stops.forEach(function (s) { if (Math.abs(s - y) < Math.abs(best - y)) best = s; });
    if (Math.abs(best - y) > 1) glide(best, 520, outCubic);
  }

  // ── contact box: rewind, dock, sink ──
  function pin(top) {
    setv(E.contact, "--ct-pin", top + "px");
    E.contact.classList.add("is-pinned");
  }
  function rewind() {
    if (state !== "free") return;
    var y = window.scrollY;
    var top = L.ctY0 - clamp(y - L.S.s3, 0, L.len4);
    state = "rewinding";
    bottomArmed = false;
    entered = E.contact.matches(":hover");
    pin(top);
    render(true);
    var dist = y - L.dockY;
    glide(L.dockY, clamp(1200 + Math.abs(dist) * 2.4, 1400, 4200), inOutSine,
      function (e) { setv(E.contact, "--ct-pin", lerp(top, L.dockTop, e) + "px"); },
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
  function dockNow() { // nav "Contact": glide to the docked view, raise the box
    if (state === "sinking") { clearTimeout(sinkTimer); E.contact.classList.remove("is-sinking"); }
    state = "free";
    E.contact.classList.remove("is-pinned");
    glide(L.dockY, glideDur(window.scrollY - L.dockY) + 300, inOutCubic, null, function () {
      state = "docked";
      bottomArmed = false;
      entered = E.contact.matches(":hover");
      pin(L.vh + 40);
      render(true);
      void E.contact.offsetHeight;
      E.contact.classList.add("is-releasing");
      setv(E.contact, "--ct-pin", L.dockTop + "px");
      setTimeout(function () { E.contact.classList.remove("is-releasing"); }, 460);
    });
  }

  // ── user input ──
  function userScrolled() {
    lastWheel = performance.now();
    if (state === "rewinding") release();
    else if (state === "docked") sink();
    else stopGlide();
  }
  function onWheel() { if (on) userScrolled(); }
  var SCROLL_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, " ": 1 };
  function onKey(e) {
    if (!on || !SCROLL_KEYS[e.key]) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    userScrolled();
  }
  function onDown(e) { if (on && e.clientX >= root.clientWidth) userScrolled(); } // scrollbar drag
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
    if (h === "#contact") { dockNow(); return; }
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
    return 3 + (y - st[3]) / Math.max(1, L.len4 + 1) * 0.999;
  }
  function fromLogical(v) {
    var st = L.stops;
    if (v <= 3) { var i = Math.min(2, Math.floor(v)); return st[i] + (v - i) * (st[i + 1] - st[i]); }
    return st[3] + (v - 3) / 0.999 * (L.len4 + 1);
  }
  function relayout() {
    if (!on) return;
    var v = toLogical(window.scrollY);
    layout();
    if (state === "rewinding" || state === "docked") { // sizes moved under a pinned box: re-dock at once
      stopGlide();
      state = "docked";
      window.scrollTo(0, L.dockY);
      pin(L.dockTop);
    } else if (state === "free" && !anim) window.scrollTo(0, Math.round(fromLogical(v)));
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
    window.scrollTo(0, target === "contact" ? L.dockY : L.stops[target]);
    if (target === "contact") { state = "docked"; bottomArmed = false; pin(L.dockTop); }
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
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onWheel, { passive: true });
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
