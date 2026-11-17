// La gare: the whole ticket-to-train flow. Everything is driven from update(); no timers.
//
//   idle      near the till: Space opens the till panel (a ticket is free). Near the board: the HUD
//             board shows, and a ticket's voie is revealed. On the right platform, a calm wait.
//   arriving  the train comes out of the tunnel and brakes into the platform (eased).
//   stopped   doors open, "Espace — monter". Nobody boards for a while: it leaves empty.
//   ride      the cutscene (see RIDE below): glide aboard, doors close, the train leaves, a window
//             shot over the sea, "this place does not exist yet", the train comes back, Cedric steps off.
//
// Destinations and the travel() hook are in places/destinations.js; times in places/schedule.js.
import * as THREE from "../core/three.js";
import * as L from "../world/layout.js";
import { createSignMaterial } from "../env/shade.js";
import { createTrain, DOORS, FLOOR_Y } from "./train.js";
import { createCarriage } from "./carriage.js";
import { DESTINATIONS, HERE, travel } from "./destinations.js";
import { clockMinutes, fmt, rows, signature } from "./schedule.js";
import { createTrainAudio } from "../audio/train.js";

const S = L.station;
const HOVER = 1.1, PLAT_Y = S.floorY + HOVER, CAR_Y = FLOOR_Y + HOVER + 0.05;
const X_FAR = 262;                                  // where the train waits, inside the tunnel
const WAIT_STOP = 45;                               // seconds a stopped train waits for Cedric
const TILL_R = 3.4, BOARD_R = 10;
const smooth = x => x * x * (3 - 2 * x);
const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const FONT = "'Ccity Plex Mono', 'IBM Plex Mono', Consolas, monospace";

// Cutscene timeline, seconds from Space.
const R = {
  glide: 2.4, close: 3.6,                          // glide aboard, doors closed
  leave: 10.1,                                     // the train is in the tunnel: first fade is done
  win: 17.9,                                       // end of the window shot
  hold: 19.3,                                      // end of the message on the cover
  arrive: 25.8,                                    // the train has stopped
  open: 26.8, end: 28.8,                           // doors open, Cedric on the platform
  fade: 0.8,
};

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));

export function createStation(g) {
  const T = g.text.station, st = g.player.state, V3 = THREE.Vector3;
  const U = g.env.shade.uniforms;
  let train = null, carriage = null, audio = null;
  let mode = "idle", ticket = null, serial = 0, wait = 0, noteT = 0, noteTxt = "", stopT = 0, acc = 0, spaceReq = false, closing = false, gone = false;
  let lastSig = "", signsBuilt = false;
  let tr = null, ride = null;                         // the train in motion / the cutscene
  const signs = [], tex = [];
  let boardCtx = null, boardTex = null, fontsDirty = false;
  let promptEl, promptTxt, cardEl, cardDest, cardVoie, cardTime, tboard, tbHead, tbRows, tbSub, till, tillList, tillItems = [], tillSel = 1, tillOpen = false, prevLocked = false, prevFocus = null;
  let offs = [];
  const camPos = new V3(), camLook = new V3(), tmp = new V3(), tmp2 = new V3();
  const from = { x: 0, y: 0, z: 0, h: 0 };

  // ---------- geometry helpers ----------
  const voieZ = n => S.voies[n - 1].z;
  const platformAt = (x, z) => {
    if (x < S.platX.x0 + 1 || x > S.platX.x1) return null;
    for (let i = 0; i < S.platforms.length; i++) { const p = S.platforms[i]; if (z >= p.z0 - 0.1 && z <= p.z1 + 0.1) return p; }
    return null;
  };
  const sideOf = (pf, n) => ((pf.z0 + pf.z1) / 2 > voieZ(n) ? 1 : -1);   // which side of the track the platform is on
  const clock = () => clockMinutes(g.env.time.phase);

  // ---------- canvas signs (board, voie plates, name, till) ----------
  function canvasFor(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function addSign(canvas, m) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    const mat = createSignMaterial(U, t);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.w * canvas.height / canvas.width), mat);
    mesh.position.set(m.x, m.y, m.z);
    mesh.rotation.y = Math.PI / 2 - m.facing;
    g.scene.add(mesh);
    signs.push(mesh); tex.push(t);
    return t;
  }
  function plate(text, w, h, size, colour, border) {
    const c = canvasFor(w, h), x = c.getContext("2d");
    const draw = () => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = "#04060b"; x.fillRect(0, 0, w, h);
      x.strokeStyle = border || colour; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10);
      x.font = `600 ${size}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
      x.shadowColor = colour; x.shadowBlur = 18; x.fillStyle = colour; x.fillText(text, w / 2, h / 2 + 3);
      x.shadowBlur = 0; x.fillStyle = "#fff"; x.globalAlpha = 0.7; x.fillText(text, w / 2, h / 2 + 3); x.globalAlpha = 1;
    };
    draw();
    return { c, draw };
  }
  const plates = [];                                  // redrawn once the web font has loaded

  function drawBoard(list, now, seen) {
    const c = boardCtx, w = 1024, h = 384, B = T.board;
    c.fillStyle = "#05070d"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#35e0c8"; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
    c.textBaseline = "middle"; c.textAlign = "left";
    c.font = `600 40px ${FONT}`; c.fillStyle = "#ffb03f"; c.shadowColor = "#ffb03f"; c.shadowBlur = 14;
    c.fillText(B.title.toUpperCase(), 34, 44);
    c.textAlign = "right"; c.fillStyle = "#35e0c8"; c.shadowColor = "#35e0c8"; c.fillText(fmt(now), w - 34, 44);
    c.shadowBlur = 0; c.fillStyle = "rgba(53,224,200,.55)"; c.fillRect(34, 74, w - 68, 3);
    c.font = `500 22px ${FONT}`; c.fillStyle = "rgba(241,230,220,.5)"; c.textAlign = "left";
    c.fillText(B.time.toUpperCase(), 40, 98); c.fillText(B.dest.toUpperCase(), 200, 98);
    c.textAlign = "center"; c.fillText(B.voie.toUpperCase(), 770, 98); c.textAlign = "left"; c.fillText(B.note.toUpperCase(), 836, 98);
    for (let i = 0; i < list.length; i++) {
      const r = list[i], y = 142 + i * 41;
      if (r.mine) { c.fillStyle = "rgba(255,176,63,.22)"; c.fillRect(24, y - 20, w - 48, 40); c.fillStyle = "#ffb03f"; c.fillRect(24, y - 20, 6, 40); }
      c.font = `600 31px ${FONT}`; c.textAlign = "left";
      c.fillStyle = r.mine ? "#ffd9a0" : "#ffb03f"; c.shadowColor = c.fillStyle; c.shadowBlur = r.mine ? 12 : 6;
      c.fillText(fmt(r.min), 40, y);
      c.fillStyle = r.mine ? "#fff4e4" : "rgba(241,230,220,.9)"; c.shadowColor = "#f1e6dc"; c.shadowBlur = 3;
      let name = r.dest.name;
      while (c.measureText(name).width > 520 && name.length > 4) name = name.slice(0, -1);
      c.fillText(name, 200, y);
      c.textAlign = "center"; c.fillStyle = "#35e0c8"; c.shadowColor = "#35e0c8"; c.shadowBlur = 8;
      c.fillText(r.mine && !seen ? "—" : String(r.voie), 770, y);
      c.font = `400 22px ${FONT}`; c.textAlign = "left"; c.shadowBlur = 0;
      c.fillStyle = r.note === "late" ? "#ff9a7a" : r.mine ? "#ffd9a0" : "rgba(241,230,220,.6)";
      c.fillText(r.mine ? B.yours : r.note === "late" ? B.late : B.onTime, 836, y);
    }
    c.shadowBlur = 0;
    boardTex.needsUpdate = true;
  }

  function buildSigns() {
    const M = g.world.places && g.world.places.gare && g.world.places.gare.mounts;
    if (!M) return;
    const bc = canvasFor(1024, 384);
    boardCtx = bc.getContext("2d");
    boardTex = addSign(bc, M.boards[0]);
    // the back of the board shows the same canvas
    { const mat = createSignMaterial(U, boardTex), m = M.boards[1];
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.w * 384 / 1024), mat);
      mesh.position.set(m.x, m.y, m.z); mesh.rotation.y = Math.PI / 2 - m.facing; g.scene.add(mesh); signs.push(mesh); }
    for (const v of M.voies) {
      const pl = plate(T.voieSign + " " + v.n, 512, 160, 84, "#35e0c8");
      plates.push(pl); addSign(pl.c, v);
    }
    { const pl = plate(T.plate, 1024, 112, 58, "#35e0c8", "#1c6f66"); plates.push(pl); addSign(pl.c, M.name); }
    { const pl = plate(T.tillSign, 512, 128, 70, "#ffb03f"); plates.push(pl); addSign(pl.c, M.till); }
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load("600 40px 'Ccity Plex Mono'"), document.fonts.load("400 22px 'Ccity Plex Mono'")])
        .then(() => { fontsDirty = true; }).catch(() => {});
    }
  }

  // ---------- HUD: prompt, ticket card, board, till ----------
  function buildHud() {
    const hud = g.hud;
    promptEl = el("div", "ccity__prompt ccity__stprompt"); promptEl.setAttribute("role", "status"); promptEl.setAttribute("aria-live", "polite");
    promptEl.style.setProperty("--neon", "#35e0c8");
    promptTxt = el("span"); promptEl.appendChild(promptTxt);

    cardEl = el("div", "ccity__ticket"); cardEl.hidden = true; cardEl.setAttribute("role", "group");
    cardEl.append(el("span", "ccity__tkstub"));
    const body = el("div", "ccity__tkbody");
    cardDest = el("p", "ccity__tkdest");
    const row = el("p", "ccity__tkrow");
    cardVoie = el("b"); cardTime = el("b");
    const a = el("span"), b = el("span");
    a.append(document.createTextNode(T.ticket.voie + " "), cardVoie); b.append(document.createTextNode(T.ticket.depart + " "), cardTime);
    row.append(a, b);
    body.append(el("p", "ccity__tktag", T.ticket.label + " · " + T.ticket.free), cardDest, row);
    cardEl.appendChild(body);

    tboard = el("div", "ccity__tboard"); tboard.setAttribute("role", "region"); tboard.setAttribute("aria-label", T.board.title);
    tbHead = el("p", "ccity__tbhead", T.board.title); tbSub = el("span", "ccity__tbsub", T.board.sub);
    tbHead.appendChild(tbSub);
    tbRows = el("ul", "ccity__tbrows");
    tboard.append(tbHead, tbRows);

    till = el("div", "ccity__till"); till.hidden = true; till.tabIndex = -1; till.dataset.typing = "1";
    till.setAttribute("role", "dialog"); till.setAttribute("aria-modal", "true"); till.setAttribute("aria-label", T.till.title);
    const head = el("div", "ccity__tillhead"), tt = el("div");
    tt.append(el("p", "ccity__tag", T.till.tag), el("h2", null, T.till.title));
    const closeBtn = el("button", "ccity__btn ccity__soonclose", T.till.close); closeBtn.type = "button";
    closeBtn.addEventListener("click", () => closeTill());
    head.append(tt, closeBtn);
    tillList = el("ul", "ccity__dests"); tillList.setAttribute("role", "listbox"); tillList.setAttribute("aria-label", T.till.listLabel);
    [HERE].concat(DESTINATIONS).forEach((d, i) => {
      const li = el("li"), b = el("button", "ccity__dest"); b.type = "button"; b.dataset.i = i;
      b.append(el("span", "ccity__destname", d.name), el("span", "ccity__destblurb", d.blurb));
      if (d.here) { b.classList.add("is-here"); b.setAttribute("aria-disabled", "true"); b.appendChild(el("span", "ccity__desthere", T.till.here)); }
      b.setAttribute("role", "option");
      b.addEventListener("click", () => { if (!d.here) buy(d); });
      b.addEventListener("pointerenter", () => { if (!d.here) selectDest(i); });
      li.appendChild(b); tillList.appendChild(li); tillItems.push(b);
    });
    till.append(head, el("p", "ccity__tillintro", T.till.intro), tillList, el("p", "ccity__hintline", T.till.hint));
    till.addEventListener("keydown", onTillKey);
    hud.append(promptEl, cardEl, tboard, till);
  }

  function selectDest(i) {
    tillSel = i;
    tillItems.forEach((b, k) => { const on = k === i; b.classList.toggle("is-sel", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
  }
  function onTillKey(e) {
    e.stopPropagation();
    const k = e.code;
    if (k === "Escape") { e.preventDefault(); closeTill(); return; }
    if (k === "ArrowDown" || k === "KeyS" || k === "ArrowUp" || k === "KeyW") {
      e.preventDefault();
      const d = k === "ArrowDown" || k === "KeyS" ? 1 : -1, n = tillItems.length;
      let i = tillSel;
      do { i = (i + d + n) % n; } while (i === 0);       // the first row is "here"
      selectDest(i); tillItems[i].focus({ preventScroll: true });
      return;
    }
    if ((k === "Enter" || k === "Space" || k === "NumpadEnter") && !e.repeat) {
      e.preventDefault();
      if (tillSel > 0) buy(DESTINATIONS[tillSel - 1]);
      return;
    }
    if (k === "Tab") { e.preventDefault(); const i = (tillSel % (tillItems.length - 1)) + 1; selectDest(i); tillItems[i].focus({ preventScroll: true }); }
  }
  function openTill() {
    if (tillOpen) return;
    if (g.ui && g.ui.closeAll) g.ui.closeAll();
    tillOpen = true; prevFocus = document.activeElement;
    prevLocked = g.player.locked; g.player.locked = true; st.speed = 0; st.turnRate = 0;
    till.hidden = false;
    selectDest(ticket ? 1 + DESTINATIONS.indexOf(ticket.dest) : 1);
    requestAnimationFrame(() => { if (tillOpen) { till.classList.add("is-on"); tillItems[tillSel].focus({ preventScroll: true }); } });
    setPrompt("");
  }
  function closeTill() {
    if (!tillOpen) return false;
    tillOpen = false; till.classList.remove("is-on");
    setTimeout(() => { if (!tillOpen) till.hidden = true; }, 260);   // cosmetic only: the panel is already inert
    g.player.locked = prevLocked;
    const back = prevFocus && prevFocus.isConnected ? prevFocus : till.closest(".ccity");
    if (back && back.focus) back.focus({ preventScroll: true });
    return true;
  }

  // ---------- the ticket ----------
  function buy(dest) {
    const now = clock(), had = !!ticket;
    const min = Math.ceil((now + 6 + Math.floor(g.rng() * 3)) / 5) * 5;
    ticket = { dest, voie: 1 + Math.floor(g.rng() * 3), min, seen: false, wait: 6 + g.rng() * 4, serial: ++serial };
    wait = 0;
    closeTill();
    note(fill(T.bought, { dest: dest.name }) + (had ? " " + T.replaced : ""), 6);
    paintCard(); lastSig = ""; refreshBoard(true);
  }
  function paintCard() {
    cardEl.hidden = !ticket;
    if (!ticket) return;
    cardDest.textContent = ticket.dest.name;
    cardVoie.textContent = ticket.seen ? String(ticket.voie) : "—";
    cardTime.textContent = fmt(ticket.min);
    cardEl.setAttribute("aria-label", fill(T.ticket.aria, { dest: ticket.dest.name, time: fmt(ticket.min), voie: ticket.seen ? ticket.voie : "—" }));
    cardEl.classList.remove("is-new"); void cardEl.offsetWidth; cardEl.classList.add("is-new");
  }

  // ---------- the board (world canvas + HUD) ----------
  function refreshBoard(force) {
    const now = clock(), list = rows(now, ticket), sig = signature(list, ticket && ticket.seen) + "@" + now;
    if (!force && sig === lastSig && !fontsDirty) return;
    lastSig = sig;
    if (fontsDirty) { fontsDirty = false; for (const p of plates) { p.draw(); } for (const t of tex) t.needsUpdate = true; }
    if (boardCtx) drawBoard(list, now, ticket && ticket.seen);
    tbRows.replaceChildren();
    const B = T.board;
    for (const r of list) {
      const li = el("li", "ccity__tbrow" + (r.mine ? " is-mine" : ""));
      li.append(el("span", "ccity__tbtime", fmt(r.min)), el("span", "ccity__tbdest", r.dest.name),
        el("span", "ccity__tbvoie", r.mine && !ticket.seen ? "—" : String(r.voie)),
        el("span", "ccity__tbnote" + (r.note === "late" ? " is-late" : ""), r.mine ? B.yours : r.note === "late" ? B.late : B.onTime));
      tbRows.appendChild(li);
    }
  }

  // ---------- prompt / hints ----------
  function setPrompt(text, hint) {
    if (text === promptTxt.textContent && (promptEl.dataset.hint === "1") === !!hint) return;
    promptTxt.textContent = text;
    promptEl.dataset.hint = hint ? "1" : "";
    promptEl.classList.toggle("is-on", !!text);
  }
  function note(text, secs) { noteTxt = text; noteT = secs; }

  // ---------- the train ----------
  function chooseStop(px) {
    let best = 1e9, xs = 208, j = 0;
    for (let k = 0; k < DOORS.length; k++) {
      const c = Math.max(205, Math.min(212, px - DOORS[k])), e = Math.abs(px - (c + DOORS[k]));
      if (e < best) { best = e; xs = c; j = k; }
    }
    return { xs, j };
  }
  function startArrival(pf) {
    const n = ticket.voie, zT = voieZ(n), side = sideOf(pf, n), c = chooseStop(st.pos.x);
    tr = { n, zT, side, xs: c.xs, j: c.j, t: 0, T: 10.5, kind: "in", x0: X_FAR, x: X_FAR };
    train.setPose(X_FAR, zT); train.setDoors(-1, 0); train.setDoors(1, 0); train.show(true);
    mode = "arriving"; wait = 0;
    note(T.hint.arriving, 4);
  }
  function startLeaveEmpty() {
    tr.kind = "out"; tr.t = 0; tr.T = 8; tr.x0 = tr.x; mode = "leaving"; tr.door = train.doorsOpen;
  }
  function runTrain(dt) {
    // returns the speed (0..1) for the sound
    tr.t += dt;
    const u = clamp01(tr.t / tr.T);
    if (tr.kind === "in") {
      const p = 1 - Math.pow(1 - u, 2.4);
      tr.x = lerp(tr.x0, tr.xs, p);
      train.setPose(tr.x, tr.zT);
      return Math.pow(1 - u, 1.4);
    }
    const p = Math.pow(u, 2.1);
    tr.x = lerp(tr.x0, X_FAR, p);
    train.setPose(tr.x, tr.zT);
    return Math.pow(u, 1.1);
  }
  function doorsTo(side, target, dt, rate) {
    const v = train.doorsOpen, d = target - v;
    train.setDoors(side, Math.abs(d) < 0.001 ? target : v + Math.sign(d) * Math.min(Math.abs(d), dt * rate));
  }

  // ---------- the cutscene ----------
  const cover = () => g.cover, ctext = () => g.coverText;
  function setCover(v) {
    const c = cover(); if (!c || closing) return;
    c.style.transition = "none"; c.style.opacity = v <= 0.001 ? "0" : v >= 0.999 ? "1" : v.toFixed(3);
  }
  function coverMessage(on) {
    const t = ctext(); if (!t || closing) return;
    if (on) {
      t.textContent = T.notExist;
      Object.assign(t.style, { display: "block", font: "400 17px/1.55 'Ccity Plex Sans', system-ui, sans-serif", letterSpacing: "0", textAlign: "center", maxWidth: "26em", padding: "0 24px", color: "rgba(241,230,220,.92)" });
    } else { t.style.display = "none"; }
  }
  function startRide(j) {
    const dxw = tr.x + DOORS[j];
    tr.j = j;
    ride = { j, side: tr.side, t: 0, dxw, zT: tr.zT, phase: "in", moved: false, windowed: false, tunnel: false };
    mode = "ride"; stopT = 0;
    g.player.locked = true; st.speed = 0; st.turnRate = 0;
    from.x = st.pos.x; from.y = st.pos.y; from.z = st.pos.z; from.h = st.heading;
    const r = g.player.ride; r.active = true; r.rate = 1.6;
    setPrompt(""); tboard.classList.remove("is-on");
    coverMessage(false);
    ticket.seen = true; paintCard();
  }
  function endRide() {
    const dest = ticket && ticket.dest;
    ride = null; mode = "idle"; tr = null;
    train.show(false); carriage.show(false);
    train.setDoors(-1, 0); train.setDoors(1, 0);
    ticket = null; wait = 0; paintCard(); lastSig = ""; refreshBoard(true);
    g.player.locked = false; g.player.ride.active = false;
    st.speed = 0; st.turnRate = 0; st.heading = wrap(st.heading);
    setCover(0); coverMessage(false);
    if (dest) note(fill(T.ticketUsed, { dest: dest.name }), 5);
    g.events.emit("ride", "gare");
  }
  function toWorld(out, x, y, z) { return carriage.toWorld(out, x, y, z); }

  function runRide(dt) {
    ride.t += dt;
    const t = ride.t, r = g.player.ride, zT = ride.zT, side = ride.side, j = ride.j, dxw = ride.dxw;
    let speed = 0, cam = 0;                                 // cam: 1 = the camera is set below
    // ---- glide aboard, doors close ----
    if (t < R.close) {
      const k = clamp01(t / R.glide);
      const kA = smoother(clamp01(k / 0.45)), kB = smoother(clamp01((k - 0.45) / 0.55));
      const yEdge = PLAT_Y, zEdge = zT + side * (S.bed + 0.8);
      st.pos.x = lerp(lerp(from.x, dxw, kA), dxw, kB);
      st.pos.z = lerp(lerp(from.z, zEdge, kA), zT, kB);
      st.pos.y = lerp(lerp(from.y, yEdge, kA), CAR_Y, kB);
      st.heading = from.h + wrap(-side * Math.PI / 2 - from.h) * smoother(clamp01(k / 0.5));
      doorsTo(side, t < R.glide ? 1 : 0, dt, 1 / 1.1);
      r.rate = 1.8;
      camPos.set(dxw + 6, S.floorY + 2.4, zT + side * 7.2); camLook.set(dxw - 0.4, S.floorY + 1.9, zT);
      cam = 1;
    } else if (t < R.leave) {                               // ---- the train leaves; tracking shot ----
      if (ride.phase === "in") { ride.phase = "out"; tr.kind = "out"; tr.t = 0; tr.T = R.leave - R.close; tr.x0 = tr.x; ride.x0 = tr.x; }
      speed = runTrain(dt);
      st.pos.x = tr.x + DOORS[j]; st.pos.z = zT; st.pos.y = CAR_Y; st.heading = 0;
      const slide = Math.min(dxw + 6 + (tr.x - ride.x0) * 0.62, 222.5);
      camPos.set(slide, S.floorY + 2.9 + 1.1 * smooth(clamp01((t - R.close) / 5)), zT + side * 10);
      camLook.set(Math.min(tr.x + DOORS[j] + 2.5, 236), S.floorY + 1.8, zT);
      r.rate = 3.2; cam = 1;
      setCover(smooth(clamp01((t - (R.leave - R.fade)) / R.fade)));
    } else if (t < R.win) {                                 // ---- the window: city and sea slide by ----
      if (!ride.windowed) {
        ride.windowed = true;
        if (travel(ticket.dest, g)) { endRide(); return; }   // a real environment took over (none yet)
        train.show(false); carriage.show(true);
        ride.dest = ticket.dest;
        g.player.camera.snap();
      }
      const u = clamp01((t - R.leave) / (R.win - R.leave));
      const uu = u * 0.5 + smooth(u) * 0.5;
      const G = carriage.group;
      G.position.set(-40, 11.5, lerp(-36, 38, uu)); G.rotation.y = -Math.PI / 2; G.updateMatrixWorld(true);
      toWorld(st.pos, 0.5, 1.25, -0.7); st.heading = 0; // he looks out of the window, east
      toWorld(camPos, lerp(-2.9, -2.3, u), 1.7, 0.95);
      toWorld(camLook, lerp(0.2, 1.3, u), lerp(1.45, 1.6, u), -3.4);
      r.rate = 40; cam = 1; speed = 0.8;
      setCover(Math.max(1 - smooth(clamp01((t - R.leave) / R.fade)), smooth(clamp01((t - (R.win - R.fade)) / R.fade))));
    } else if (t < R.hold) {                                // ---- the message on the cover ----
      if (ride.phase !== "msg") {
        ride.phase = "msg";
        carriage.show(false);
        coverMessage(true);
        // place the next scene while it is dark: Cedric inside the standing train at the tunnel end
        train.show(true); tr.kind = "in"; tr.t = 0; tr.T = R.arrive - R.hold; tr.x0 = X_FAR; tr.x = X_FAR; train.setPose(X_FAR, zT);
        train.setDoors(-1, 0); train.setDoors(1, 0);
      }
      setCover(1);
      st.pos.x = tr.x + DOORS[j]; st.pos.z = zT; st.pos.y = CAR_Y; st.heading = 0;
      camPos.set(dxw + 12, S.floorY + 3.0, zT - side * 7.8); camLook.set(dxw, S.floorY + 1.8, zT);
      r.rate = 40; cam = 1;
    } else if (t < R.arrive) {                              // ---- the train comes back and brakes ----
      if (ride.phase === "msg") { ride.phase = "back"; g.player.camera.snap(); }
      speed = runTrain(dt);
      st.pos.x = tr.x + DOORS[j]; st.pos.z = zT; st.pos.y = CAR_Y; st.heading = 0;
      camPos.set(dxw + 12.5, S.floorY + 3.0, zT - side * 7.8);
      camLook.set(lerp(Math.max(tr.x + DOORS[j] - 5, dxw), dxw, smooth(clamp01((t - R.hold) / (R.arrive - R.hold)))), S.floorY + 1.8, zT);
      r.rate = 5; cam = 1;
      const f = smooth(clamp01((t - R.hold) / R.fade));
      setCover(1 - f);
      if (f > 0.5) coverMessage(false);
    } else if (t < R.end) {                                 // ---- doors open, Cedric steps off ----
      if (ride.phase !== "off") { ride.phase = "off"; audio && audio.chime(); from.x = dxw; from.z = zT; from.y = CAR_Y; tr.x = tr.xs; train.setPose(tr.x, zT); }
      doorsTo(side, 1, dt, 1 / 0.9);
      if (t >= R.open) {
        const k = smoother(clamp01((t - R.open) / (R.end - R.open)));
        st.pos.x = dxw - k * 0.8;
        st.pos.z = lerp(zT, zT + side * (S.bed + 0.9), k);
        st.pos.y = lerp(CAR_Y, PLAT_Y, k);
        st.heading = wrap(lerp(0, Math.PI, k));
      } else { st.pos.x = dxw; st.pos.z = zT; st.pos.y = CAR_Y; }
      camPos.set(dxw + 12.5, S.floorY + 3.0, zT - side * 7.8); camLook.set(dxw, S.floorY + 1.8, zT);
      r.rate = 3; cam = 1;
    } else { endRide(); return; }
    if (cam) { r.pos.copy(camPos); r.look.copy(camLook); }
    return speed;
  }

  // ---------- system ----------
  function overlayOpen() {
    const u = g.ui;
    return !!(tillOpen || (u && ((u.map && u.map.isOpen) || (u.settings && u.settings.isOpen) || (u.soon && u.soon.isOpen))) || (g.places && g.places.board && g.places.board.isOpen));
  }
  const onKey = e => {
    if (e.code !== "Space" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest("button, a, input, textarea, select, [data-typing], [role=button]")) return;
    spaceReq = true;
  };

  const api = {
    get busy() { return mode === "ride" || tillOpen; },
    get mode() { return mode; },
    get ticket() { return ticket; },
    get state() { return { mode, ticket, wait, tr, ride }; },
    init() {
      train = createTrain(g);
      carriage = createCarriage(g, [0.2, 0.9, 0.8]);
      g.stats.tris += train.tris + carriage.tris;
      buildHud();
      audio = createTrainAudio(g);
      refreshBoard(true);
      addEventListener("keydown", onKey, true);
    },
    escape() {
      if (tillOpen) return closeTill();
      if (mode === "ride") closing = true;                  // the game is about to close: stop touching the cover
      return false;
    },
    update(dt) {
      if (gone || closing) return;
      if (!signsBuilt) { signsBuilt = true; buildSigns(); refreshBoard(true); } // the buildings (and their mounts) are made after the places
      const sp = spaceReq; spaceReq = false;
      if (noteT > 0) noteT -= dt;
      acc += dt;
      let speed = 0;
      if (mode === "ride") {
        setPrompt(""); tboard.classList.remove("is-on");
        const s = runRide(dt); if (s != null) speed = s;
      } else {
        const px = st.pos.x, pz = st.pos.z, ground = g.level.id === "ground" && !g.player.locked || tillOpen;
        // the train in the station
        if (mode === "arriving") {
          speed = runTrain(dt);
          if (tr.t >= tr.T) { mode = "stopped"; stopT = 0; audio && audio.chime(); }
        } else if (mode === "stopped") {
          doorsTo(tr.side, 1, dt, 1 / 1.1);
          const pf = platformAt(px, pz);
          const ok = pf && pf.voies.includes(tr.n) && sideOf(pf, tr.n) === tr.side;
          stopT = ok ? 0 : stopT + dt;
          if (stopT > WAIT_STOP) startLeaveEmpty();
        } else if (mode === "leaving") {
          doorsTo(tr.side, 0, dt, 1 / 1.1);
          if (train.doorsOpen < 0.01) { speed = runTrain(dt); if (tr.t >= tr.T) { mode = "idle"; train.show(false); tr = null; } }
        }
        // what Cedric is doing
        let text = "", hint = false;
        if (ground && !overlayOpen()) {
          const dTill = Math.hypot(px - S.till.x, pz - S.till.z);
          const inTill = dTill < TILL_R, nearBoard = Math.hypot(px - S.board.x, pz - S.board.z) < BOARD_R && px < S.hall.x1 + 2;
          const pf = platformAt(px, pz);
          let boardable = false, boardJ = 0;
          if (mode === "stopped" && pf && pf.voies.includes(tr.n) && sideOf(pf, tr.n) === tr.side && train.doorsOpen > 0.9) {
            let dmin = 1e9; for (let k = 0; k < DOORS.length; k++) { const d = Math.abs(px - (tr.x + DOORS[k])); if (d < dmin) { dmin = d; boardJ = k; } }
            boardable = dmin < 6;
          }
          // the board reveals the voie
          if (ticket && nearBoard && !ticket.seen) { ticket.seen = true; paintCard(); refreshBoard(true); }
          tboard.classList.toggle("is-on", nearBoard);
          // waiting for the train on the right platform
          if (ticket && ticket.seen && mode === "idle" && pf && pf.voies.includes(ticket.voie)) wait += dt;
          else if (mode === "idle") wait = Math.max(0, wait - dt * 1.5);
          if (mode === "idle" && ticket && wait >= ticket.wait) startArrival(pf);
          // text
          if (noteT > 0) text = noteTxt;
          else if (boardable) text = T.promptBoard;
          else if (inTill && mode !== "ride") text = T.promptBuy;
          else if (pf && ticket && mode === "idle") {
            hint = true;
            if (!ticket.seen) text = T.hint.readBoard;
            else if (!pf.voies.includes(ticket.voie)) text = fill(T.hint.wrongPlatform, { n: ticket.voie });
            else text = T.hint.announced;
          }
          if (sp) {
            if (boardable) startRide(boardJ);
            else if (inTill && mode !== "ride" && !tillOpen) openTill();
          }
        } else tboard.classList.remove("is-on");
        setPrompt(tillOpen ? "" : text, hint && noteT <= 0);
      }
      if (acc > 0.5) { acc = 0; refreshBoard(false); }
      // sound: ~10 Hz is plenty
      if (audio) {
        const near = mode === "ride" ? 1 : tr ? Math.exp(-Math.hypot(st.pos.x - tr.x, st.pos.z - tr.zT) / 45) : 0;
        audio._t = (audio._t || 0) + dt;
        if (audio._t > 0.1) { audio._t = 0; audio.level(speed, tr || mode === "ride" ? near : 0); }
      }
    },
    // after every system has run: no dithered window during the cutscene
    late() { if (mode === "ride") U.uCut.value = 0; },
    dispose() {
      gone = true;
      removeEventListener("keydown", onKey, true);
      if (tillOpen) g.player.locked = prevLocked;
      if (mode === "ride") { g.player.locked = false; if (g.player.ride) g.player.ride.active = false; }
      for (const o of offs) o();
      offs = [];
      for (const m of signs) { g.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      for (const t of tex) t.dispose();
      signs.length = 0; tex.length = 0;
      for (const e of [promptEl, cardEl, tboard, till]) if (e) e.remove();
      if (train) train.dispose();
      if (carriage) carriage.dispose();
      if (audio) audio.dispose();
    },
  };
  return api;
}
