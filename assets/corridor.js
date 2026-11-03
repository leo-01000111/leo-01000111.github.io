/* Corridor mode for the home page (large desktop only). See corridor.css.
   Loaded in <head> (not deferred) so html.corridor is set before the first
   paint. When the gate matches it loads GSAP (core + Observer, vendored in
   assets/vendor/gsap/) and takes over the page: no native scroll; GSAP
   tweens one state object ({ lvl, p4 }) and render() maps it to CSS
   variables. Removing this file restores the normal page. */
(function () {
  "use strict";
  var GATE = "(min-width: 1280px) and (min-height: 720px) and (hover: hover) and (pointer: fine)";
  var mqGate = window.matchMedia(GATE);
  var mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;
  function wanted() { return mqGate.matches && !mqMotion.matches; }
  if (wanted()) root.classList.add("corridor", "corridor-boot");

  // ── maths ──
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  // ── tuning: all motion timings live here ──
  var STEP_DUR = 0.95, STEP_EASE = "power2.inOut";        // one level
  var JUMP_DUR = 0.35;                                     // + per extra level (nav links)
  var SCROLL_DUR = 0.6, SCROLL_EASE = "power3.out";        // timeline wheel scroll
  var REWIND_EASE = "sine.inOut";                          // contact rewind, 1.4-4.2 s by distance
  var GESTURE_GAP = 160;  // ms of wheel silence that starts a new gesture
  var STEP_DELTA = 20;    // px of wheel in one gesture to trigger a level step

  var TL_W = 820;     // timeline layout width = its zoomed size
  var BASE_W = 1536, BASE_H = 864, MAX_SCALE = 2.2; // virtual screen; scaled up to the window
  var M = 24;         // breathing room above / below a resting section
  var on = false, E = null, L = null, gsap = null, observer = null;
  var touched = [];   // [element, property] pairs to clear on deactivate
  var S = { lvl: 0, p4: 0 };  // level 0..3 (hero, projects, columns, zoomed timeline); timeline scroll (virtual px)
  var cur = 0, p4T = 0;       // level and timeline-scroll targets
  var lvlTween = null, rewindTween = null;
  var g = { last: 0, prev: 0, armed: false, acc: 0 }; // wheel gesture tracking
  var lastWheel = 0, hoverTimer = 0;
  var state = "free"; // contact box: free | rewinding | docked | sinking
  var entered = false, graceTimer = 0, sinkTimer = 0, waitingSink = false, hoverArmed = true;

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

  // ── layout: everything that depends on sizes, not on progress ──
  function layout() {
    // Real window -> virtual screen. All geometry below is virtual px.
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
    var projFit = Math.min(1, (avail - 2 * M) / E.projects.offsetHeight);

    // Columns: top-aligned under the nav; the skills column fits by scale.
    var colY = navH + M;
    setv(E.cols, "--fit", "1");
    var fitm = Math.min(1, (avail - 2 * M) / E.colMajor.offsetHeight);
    setv(E.colMajor, "--fitm", String(fitm));
    var doorDx = -Math.min(0.5 * gx, 48);
    setv(E.colMajor, "--door-dx", doorDx + "px");
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

    L = { k: k, vw: vw, vh: vh, navH: navH, heroY: heroY, projY: projY, colY: colY, len4: len4,
          ctY0: ctY0, ctH: ctH, dockLine: tlTopZ + e3 + 16,
          projFit: projFit, fitm: fitm, doorDx: doorDx, tlS: tlS, tlX: tlLeft - minorLeft, tlY: tlTopZ - tlTop0 };
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

  // ── pose: where everything is at a given level (one source for both paths) ──
  function pose(lvl) {
    var p1 = clamp(lvl, 0, 1), p2 = clamp(lvl - 1, 0, 1), p3 = clamp(lvl - 2, 0, 1);
    var d1 = seg(p1, 0, 0.8);                       // hero doors swing, fade late
    var q1 = seg(p1, 0.3, 1), q2 = seg(p2, 0.35, 1); // projects / columns come from depth
    var n = E.doors.length, step = 0.3 / Math.max(1, n - 1);
    var cards = E.doors.map(function (el, i) {      // cards swing out one by one
      var t = seg(p2, i * step, i * step + 0.6);
      return { d: t, o: 1 - smooth(seg(t, 0.55, 1)) };
    });
    return { p1: p1, p2: p2, p3: p3, d1: d1, o1: 1 - smooth(seg(d1, 0.55, 1)),
             sz1: 1 - q1, so1: smooth(seg(q1, 0, 0.5)), sz2: 1 - q2, so2: smooth(seg(q2, 0, 0.5)),
             cards: cards, d3: p3 };               // skills door + timeline zoom
  }

  // ── render: state -> variables (all easing comes from the GSAP tween) ──
  function render() {
    if (!on) return;
    var P = pose(S.lvl);
    setv(E.main, "--p4", String(S.p4));

    [E.heroMajor, E.heroMinor].forEach(function (el) { setv(el, "--d", String(P.d1)); setv(el, "--o", String(P.o1)); });
    setv(E.hero, "--sy", L.heroY + "px");
    show(E.hero, P.p1 < 1);
    E.hero.classList.toggle("is-live", P.p1 < 0.02);

    setv(E.projects, "--sy", L.projY + "px");
    setv(E.projects, "--sz", String(P.sz1));
    setv(E.projects, "--so", String(P.so1));
    E.doors.forEach(function (el, i) {
      setv(el, "--d", String(P.cards[i].d));
      setv(el, "--o", String(P.cards[i].o));
    });
    show(E.projects, P.p1 > 0.3 && P.p2 < 1);
    E.projects.classList.toggle("is-live", P.p1 > 0.98 && P.p2 < 0.02);

    setv(E.cols, "--sy", L.colY + "px");
    setv(E.cols, "--sz", String(P.sz2));
    setv(E.cols, "--so", String(P.so2));
    setv(E.colMajor, "--d", String(P.d3));
    setv(E.cols, "--z3", String(P.d3));
    E.colMajor.classList.toggle("is-parked", P.p3 > 0.02);
    show(E.cols, P.p2 > 0.35);
    E.cols.classList.toggle("is-live", P.p2 > 0.98);

    // Contact: exists once the timeline is zoomed (or while pinned).
    var ctOn = P.p3 >= 0.999 || state !== "free";
    E.contact.classList.toggle("is-on", ctOn);
    E.contact.classList.toggle("is-live", ctOn);
  }

  // ── Firefox: play each level step as compositor animations ──
  // Firefox re-draws a 3D-transformed layer whenever the main thread changes
  // it, so a door swung frame by frame clips and snaps on large windows.
  // Web Animations of transform/opacity run on its compositor instead. The
  // keyframes are sampled from pose() along the same ease as the GSAP tween,
  // so the sequence is identical; GSAP still runs for everything else, and
  // the CSS variables take over again when the step ends.
  var OMTA = !!(window.CSS && CSS.supports && CSS.supports("-moz-appearance", "none"));
  var omta = [];
  function frameOf(P, p4) { // the same transforms as corridor.css, as strings
    var f = [
      [E.heroMajor, "rotateY(" + P.d1 * 88 + "deg)", P.o1],
      [E.heroMinor, "rotateY(" + P.d1 * -88 + "deg)", P.o1],
      [E.projects, "translate3d(0," + L.projY + "px," + P.sz1 * -1600 + "px) scale(" + L.projFit + ")", P.so1],
      [E.cols, "translate3d(0," + L.colY + "px," + P.sz2 * -1600 + "px) scale(1)", P.so2],
      [E.colMajor, "translateX(" + P.d3 * L.doorDx + "px) scale(" + L.fitm * (1 - P.d3 * 0.04) + ") rotateY(" + P.d3 * 50 + "deg)", 1 - P.d3 * 0.25],
      [E.bg, "translate3d(" + L.tlX * P.d3 + "px," + (L.tlY * P.d3 - p4) + "px,0) scale(" + (L.tlS + (1 - L.tlS) * P.d3) + ")", 1]
    ];
    E.doors.forEach(function (el, i) { f.push([el, "rotateY(" + P.cards[i].d * 88 + "deg)", P.cards[i].o]); });
    return f;
  }
  function stopOmta() { omta.forEach(function (a) { a.cancel(); }); omta = []; }
  function playOmta(l1, q1, dur, ease) {
    stopOmta();
    var l0 = S.lvl, q0 = S.p4, fn = gsap.parseEase(ease), N = 30, tracks = null;
    for (var k = 0; k <= N; k++) {
      var e = fn(k / N), fr = frameOf(pose(l0 + (l1 - l0) * e), q0 + (q1 - q0) * e);
      if (!tracks) tracks = fr.map(function (x) { return { el: x[0], kf: [] }; });
      fr.forEach(function (x, j) { tracks[j].kf.push({ transform: x[1], opacity: x[2] }); });
    }
    omta = tracks.map(function (t) { return t.el.animate(t.kf, { duration: dur * 1000, fill: "forwards" }); });
  }

  // ── motion ──
  function busy() { return !!(lvlTween && lvlTween.isActive()); }
  function goLevel(i, after) {
    i = clamp(i, 0, 3);
    var dist = Math.abs(i - S.lvl);
    cur = i;
    if (lvlTween) lvlTween.kill();
    root.classList.add("corridor-moving"); // see corridor.css: layers raster once per step
    var vars = { lvl: i, duration: STEP_DUR + JUMP_DUR * Math.max(0, dist - 1), ease: STEP_EASE,
                 onUpdate: render,
                 onComplete: function () {
                   root.classList.remove("corridor-moving");
                   render(); stopOmta(); // CSS variables hold the final pose
                   if (after) after();
                 } };
    if (i < 3) { // leaving the timeline: it rolls back to its top on the way
      gsap.killTweensOf(S, "p4");
      p4T = 0;
      if (S.p4 > 0) vars.p4 = 0;
    }
    if (OMTA) playOmta(i, i < 3 ? 0 : S.p4, vars.duration, STEP_EASE);
    lvlTween = gsap.to(S, vars);
  }
  function scrollTimeline(dv) { // dv in virtual px
    p4T = clamp(p4T + dv, 0, L.len4);
    gsap.to(S, { p4: p4T, duration: SCROLL_DUR, ease: SCROLL_EASE, overwrite: "auto", onUpdate: render });
  }

  // ── contact box: rewind, dock, sink ──
  function pin(top) {
    setv(E.contact, "--ct-pin", top + "px");
    E.contact.classList.add("is-pinned");
  }
  function rewind() {
    if (state !== "free" || cur !== 3 || busy()) return;
    gsap.killTweensOf(S, "p4");
    var top = L.ctY0 - S.p4;
    // The box freezes where it is and the timeline runs back beneath it, until
    // the 3rd entry meets the box or the timeline reaches its own top. Any gap
    // left above the box fades out the older entry showing in it.
    var to = clamp(L.dockLine - top, 0, L.len4);
    var e3 = L.dockLine - 16 - to; // 3rd entry's bottom on screen once docked
    setv(E.contact, "--ct-fade", Math.max(0, top - e3) + "px");
    state = "rewinding";
    entered = E.contact.matches(":hover");
    pin(top);
    render();
    p4T = to;
    rewindTween = gsap.to(S, { p4: to, duration: clamp(1.2 + Math.abs(S.p4 - to) * 0.0026, 1.4, 4.2),
                               ease: REWIND_EASE, onUpdate: render,
                               onComplete: function () { rewindTween = null; state = "docked"; } });
  }
  function release() { // user took over mid-rewind: the box goes back under the timeline
    if (rewindTween) { rewindTween.kill(); rewindTween = null; }
    p4T = S.p4;
    clearTimeout(graceTimer); waitingSink = false;
    state = "free";
    hoverArmed = false; // only a fresh hover starts it again
    E.contact.classList.add("is-releasing");
    E.contact.classList.remove("is-pinned");
    setTimeout(function () { E.contact.classList.remove("is-releasing"); }, 460);
    render();
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
    if (rewindTween) { rewindTween.kill(); rewindTween = null; }
    p4T = S.p4;
    clearTimeout(graceTimer); waitingSink = false;
    state = "sinking";
    E.contact.classList.add("is-sinking");
    setv(E.contact, "--ct-pin", (L.vh + 40) + "px");
    clearTimeout(sinkTimer);
    sinkTimer = setTimeout(function () {
      E.contact.classList.remove("is-sinking", "is-pinned");
      state = "free";
      render();
    }, 1320);
  }
  function toContact() { // nav "Contact": to the end of the timeline, box in view
    if (state === "rewinding") release();
    if (state === "sinking") { clearTimeout(sinkTimer); E.contact.classList.remove("is-sinking", "is-pinned"); }
    state = "free";
    var end = function () { scrollTimeline(L.len4 - p4T); };
    if (cur === 3 && !busy()) end(); else goLevel(3, end);
  }
  function checkHover() {
    if (on && state === "free" && hoverArmed && E.contact.classList.contains("is-on") && E.contact.matches(":hover")) rewind();
  }

  // ── user input: GSAP Observer for the wheel, keys by hand ──
  function userInput() {
    lastWheel = performance.now();
    if (state === "rewinding") release();
    else if (state === "docked") sink();
  }
  // Trackpads keep firing decaying wheel events (inertia) after the finger
  // lifts. A new gesture is a pause in the events or a rise in their size.
  function fresh(d, now) {
    var isNew = now - g.last > GESTURE_GAP || (d > g.prev * 1.3 && d > 6);
    g.last = now; g.prev = d;
    return isNew;
  }
  function onWheelY(self) {
    if (!on) return;
    var ev = self.event;
    if (ev && ev.ctrlKey) return; // pinch / browser zoom
    var dy = self.deltaY, now = performance.now();
    if (!dy) return;
    userInput();
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(checkHover, 260);
    if (fresh(Math.abs(dy), now)) { g.armed = true; g.acc = 0; }
    var dir = dy > 0 ? 1 : -1;

    if (busy()) { // a step is playing: a fresh gesture the other way turns it round
      if (g.armed && dir !== Math.sign(cur - S.lvl)) {
        g.armed = false;
        goLevel(dir > 0 ? Math.ceil(S.lvl) : Math.floor(S.lvl));
      }
      return;
    }
    if (cur === 3 && (dir > 0 || p4T > 0)) { // timeline: smooth free scroll, stops at its top
      scrollTimeline(dy / L.k);
      if (p4T === 0) g.armed = false; // inertia reaching the top doesn't step on
      return;
    }
    if (!g.armed) return;
    g.acc += dy;
    if (Math.abs(g.acc) < STEP_DELTA) return;
    g.armed = false;
    if (cur + dir >= 0 && cur + dir <= 3) goLevel(cur + dir);
  }
  var KEY_DIR = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
  function onKey(e) {
    if (!on) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
    if (e.key === "Home") { e.preventDefault(); userInput(); goLevel(0); return; }
    if (e.key === "End") { e.preventDefault(); userInput(); toContact(); return; }
    if (!(e.key in KEY_DIR)) return;
    e.preventDefault();
    userInput();
    var dir = e.key === " " && e.shiftKey ? -1 : KEY_DIR[e.key];
    if (busy()) return;
    if (cur === 3 && (dir > 0 || p4T > 0)) {
      scrollTimeline(dir * (/Page| /.test(e.key) ? L.vh * 0.8 : 90));
      return;
    }
    if (cur + dir >= 0 && cur + dir <= 3) goLevel(cur + dir);
  }
  function onEnter() {
    if (!on) return;
    if (state === "free") {
      if (performance.now() - lastWheel > 250) rewind(); // else checkHover picks it up
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

  // Nav / in-page links go to their level (capture: beats main.js).
  var TARGETS = { "#top": 0, "#projects": 1, "#skills": 2, "#background": 3 };
  function onClick(e) {
    if (!on) return;
    var lang = e.target.closest && e.target.closest(".hp-lang a[hreflang]");
    if (lang) { // EN <-> FR: the other page opens at the same level and timeline spot
      try { sessionStorage.setItem("corridorPos", JSON.stringify({ lvl: cur, p4: p4T, t: Date.now() })); } catch (err) {}
      return;
    }
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var h = a.getAttribute("href");
    if (h !== "#contact" && !(h in TARGETS)) return;
    e.preventDefault();
    e.stopPropagation();
    if (h === "#contact") { toContact(); return; }
    userInput();
    goLevel(TARGETS[h]);
  }
  // Keyboard focus landing in a hidden layer: bring that layer up.
  function onFocus(e) {
    if (!on || busy() || state !== "free") return;
    var t = e.target, to = null;
    if (E.hero.contains(t)) to = 0;
    else if (E.projects.contains(t)) to = 1;
    else if (E.colMajor.contains(t)) to = 2;
    else if (E.colMinor.contains(t)) to = 3;
    if (to !== null && to !== cur) goLevel(to);
  }

  function relayout() {
    if (!on) return;
    stopOmta();
    layout();
    if (state !== "free") { // sizes moved under a pinned box: let it go back into the timeline
      if (rewindTween) { rewindTween.kill(); rewindTween = null; }
      clearTimeout(graceTimer); clearTimeout(sinkTimer); waitingSink = false;
      state = "free";
      E.contact.classList.remove("is-pinned", "is-sinking", "is-releasing");
    }
    gsap.killTweensOf(S, "p4");
    S.p4 = p4T = clamp(S.p4, 0, L.len4);
    render();
  }

  // ── GSAP, loaded only when corridor mode is actually used ──
  var gsapCbs = null;
  function withGsap(cb) {
    if (gsap) { cb(); return; }
    if (gsapCbs) { gsapCbs.push(cb); return; }
    gsapCbs = [cb];
    var files = ["gsap.min.js", "Observer.min.js"], n = 0, failed = false;
    files.forEach(function (f) {
      var s = document.createElement("script");
      s.src = "/assets/vendor/gsap/" + f;
      s.async = false; // keep order: core first
      s.onload = function () {
        if (++n < files.length || failed) return;
        gsap = window.gsap;
        gsap.registerPlugin(window.Observer);
        observer = window.Observer.create({ target: window, type: "wheel", onChangeY: onWheelY });
        var cbs = gsapCbs; gsapCbs = null;
        cbs.forEach(function (c) { c(); });
      };
      s.onerror = function () { // no GSAP: stay on the normal page
        failed = true; gsapCbs = null;
        root.classList.remove("corridor", "corridor-boot");
      };
      document.head.appendChild(s);
    });
  }

  var ro = null, roFrame = 0;
  function activate(fromNormal) {
    if (on || !collect()) return;
    // where the normal page was, as a corridor level
    var target = 0, toEnd = false;
    if (fromNormal) {
      var y = window.scrollY + window.innerHeight * 0.35;
      var top = function (el) { return el.getBoundingClientRect().top + window.scrollY; };
      if (y >= top(E.contact)) { target = 3; toEnd = true; }
      else if (y >= top(E.cols)) target = y - top(E.cols) > E.bg.offsetHeight * 0.3 ? 3 : 2;
      else if (y >= top(E.projects)) target = 1;
    } else if (location.hash === "#contact") { target = 3; toEnd = true; }
    else if (location.hash in TARGETS) target = TARGETS[location.hash];
    var keep = null;
    try { keep = JSON.parse(sessionStorage.getItem("corridorPos")); sessionStorage.removeItem("corridorPos"); } catch (err) {}
    if (!fromNormal && keep && Date.now() - keep.t < 30000) target = clamp(Math.round(keep.lvl), 0, 3);
    else keep = null;
    root.classList.add("corridor");
    on = true;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    state = "free";
    layout();
    S.lvl = cur = target;
    S.p4 = p4T = toEnd ? L.len4 : keep && target === 3 ? clamp(keep.p4, 0, L.len4) : 0;
    render();
    if (observer) observer.enable();
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (!roFrame) roFrame = requestAnimationFrame(function () { roFrame = 0; relayout(); });
      });
      [E.header, E.hero, E.projects, E.colMajor, E.bg, E.contact].forEach(function (el) { ro.observe(el); });
    }
    // Fonts, Cedric and the contributions grid land after the first layout,
    // not always as a size change the ResizeObserver sees: measure again.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    if (document.readyState !== "complete") window.addEventListener("load", relayout, { once: true });
    setTimeout(relayout, 1200);
    void root.offsetHeight; // laid out at opacity 0 first, so the reveal fades in
    root.classList.remove("corridor-boot");
  }
  function deactivate() {
    if (!on) return;
    var lvl = S.lvl, docked = state !== "free", deep = S.p4 > L.len4 * 0.9;
    on = false;
    gsap.killTweensOf(S);
    stopOmta();
    lvlTween = rewindTween = null;
    if (observer) observer.disable();
    clearTimeout(graceTimer); clearTimeout(sinkTimer); clearTimeout(hoverTimer);
    if (ro) { ro.disconnect(); ro = null; }
    touched.forEach(function (p) { p[0].style.removeProperty(p[1]); p[0]._corridorProps = null; });
    touched = [];
    ["is-live", "is-parked", "is-on", "is-pinned", "is-releasing", "is-sinking"].forEach(function (c) {
      document.querySelectorAll("." + c).forEach(function (el) { el.classList.remove(c); });
    });
    root.classList.remove("corridor", "corridor-boot", "corridor-moving");
    if ("scrollRestoration" in history) history.scrollRestoration = "auto";
    state = "free";
    var el = docked || deep ? E.contact : lvl > 2.5 ? E.bg : lvl > 1.5 ? E.cols : lvl > 0.5 ? E.projects : null;
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
      var done = function () {
        setTimeout(function () {
          b.style.opacity = "";
          setTimeout(function () { b.style.transition = ""; switching = 0; onGate(); }, 200);
        }, 20);
      };
      if (wanted()) withGsap(function () { activate(true); done(); });
      else { deactivate(); done(); }
    }, 190);
  }
  function listen(mq) {
    if (mq.addEventListener) mq.addEventListener("change", onGate); else mq.addListener(onGate);
  }

  function init() {
    if (!document.querySelector(".home-hero")) { root.classList.remove("corridor", "corridor-boot"); return; }
    listen(mqGate); listen(mqMotion);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", function () {
      if (wanted() !== on) onGate(); // backs up the media-query change events
      else if (on) relayout();
    });
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("selectionchange", onUnblock);
    collect();
    if (E && E.contact) {
      E.contact.addEventListener("mouseenter", onEnter);
      E.contact.addEventListener("mouseleave", onLeave);
      E.contact.addEventListener("focusout", function () { setTimeout(onUnblock, 0); });
    }
    if (wanted()) withGsap(function () { activate(false); });
    else root.classList.remove("corridor", "corridor-boot");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
