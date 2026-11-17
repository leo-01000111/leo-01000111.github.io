// Race HUD and panels, plain DOM under g.hud. Calm and small: position and lap top left, lap
// times top centre, three slow start lamps, speed and turbo at the bottom, the circuit map where
// the round minimap sits. Its own stylesheet is injected on creation and removed on dispose.
import * as C from "./circuit.js";

const CSS = `
.ccity.is-kart .ccity__minimap, .ccity.is-kart .ccity__hint, .ccity.is-kart .ccity__prompt { display: none !important; }
.ccity .ck { position: absolute; inset: 0; pointer-events: none; color: var(--cc-ink); font-family: var(--cc-mono); text-shadow: 0 0 10px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.7); opacity: 0; transition: opacity .5s ease; }
.ccity .ck.is-on { opacity: 1; }
.ccity .ck-left { position: absolute; left: var(--cc-edge); top: 68px; display: flex; flex-direction: column; gap: 6px; }
.ccity .ck-pos { font: 600 38px/1 var(--cc-mono); letter-spacing: -.02em; }
.ccity .ck-pos small { font: 400 13px/1 var(--cc-mono); color: var(--cc-dim); margin-left: 6px; letter-spacing: .04em; }
.ccity .ck-lap { font: 500 12px/1.2 var(--cc-mono); letter-spacing: .12em; text-transform: uppercase; color: var(--cc-dim); }
.ccity .ck-times { position: absolute; left: 50%; top: var(--cc-edge); transform: translateX(-50%); display: flex; gap: 26px; padding: 8px 18px; background: var(--cc-bg); border: 1px solid var(--cc-line); border-radius: 999px; text-shadow: none; }
.ccity .ck-times div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ccity .ck-times span { font: 500 9px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: var(--cc-dim); }
.ccity .ck-times b { font: 600 17px/1 var(--cc-mono); font-variant-numeric: tabular-nums; }
.ccity .ck-times .is-best b { color: #8fe6ff; }
.ccity .ck-lights { position: absolute; left: 50%; top: 98px; transform: translateX(-50%); display: flex; gap: 14px; opacity: 0; transition: opacity .6s ease; }
.ccity .ck-lights.is-on { opacity: 1; }
.ccity .ck-lights i { width: 26px; height: 26px; border-radius: 50%; background: rgba(11,13,22,.7); border: 1px solid var(--cc-line-hi); transition: background-color .5s ease, box-shadow .5s ease, border-color .5s ease; }
.ccity .ck-lights i.is-red { background: #ff4a52; border-color: #ff4a52; box-shadow: 0 0 18px rgba(255,74,82,.55); }
.ccity .ck-lights.is-go i { background: #6ef0b0; border-color: #6ef0b0; box-shadow: 0 0 18px rgba(110,240,176,.5); }
.ccity .ck-go { position: absolute; left: 50%; top: 138px; transform: translateX(-50%); font: 600 20px/1 var(--cc-sans); letter-spacing: .04em; opacity: 0; transition: opacity .6s ease; }
.ccity .ck-go.is-on { opacity: 1; }
.ccity .ck-bottom { position: absolute; left: 50%; bottom: var(--cc-edge); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 9px; }
.ccity .ck-speed { font: 600 26px/1 var(--cc-mono); font-variant-numeric: tabular-nums; }
.ccity .ck-speed small { font: 400 11px/1 var(--cc-mono); color: var(--cc-dim); margin-left: 5px; letter-spacing: .06em; }
.ccity .ck-boost { display: flex; align-items: center; gap: 8px; font: 500 9px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: var(--cc-dim); }
.ccity .ck-boost em { display: block; width: 120px; height: 3px; background: rgba(241,230,220,.2); border-radius: 2px; overflow: hidden; }
.ccity .ck-boost em i { display: block; height: 100%; width: 100%; background: #8fe6ff; transform-origin: left; transition: transform .12s linear; }
.ccity .ck-boost.is-active em i { background: #ffb070; }
.ccity .ck-keys { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; font: 400 11px/1.4 var(--cc-mono); letter-spacing: .04em; color: var(--cc-dim); max-width: min(560px, calc(100vw - 2 * (var(--cc-map) + var(--cc-edge))));}
.ccity .ck-keys kbd { font: 600 10px/1 var(--cc-mono); color: var(--cc-ink); padding: 3px 6px; margin-right: 2px; border: 1px solid var(--cc-line); border-radius: 3px; background: rgba(11,13,22,.38); }
.ccity .ck-map { position: absolute; right: var(--cc-edge); bottom: var(--cc-edge); width: var(--cc-map); height: var(--cc-map); background: rgba(11,13,22,.74); border: 1px solid var(--cc-line); border-radius: 12px; }
.ccity .ck-panel { --neon: #3fe6ff; position: absolute; left: 50%; top: 50%; width: min(380px, calc(100% - 36px)); transform: translate(-50%, calc(-50% - 6px)); opacity: 0; pointer-events: auto; display: flex; flex-direction: column; gap: 12px; padding: 22px 24px 20px; background: var(--cc-panel); border: 1px solid var(--cc-line); border-top: 2px solid var(--neon); border-radius: 10px; box-shadow: 0 0 30px color-mix(in srgb, var(--neon) 16%, transparent); transition: opacity .3s ease, transform .3s ease; text-shadow: none; font-family: var(--cc-sans); }
.ccity .ck-panel.is-on { opacity: 1; transform: translate(-50%, -50%); }
.ccity .ck-panel .ck-tag { font: 600 10px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: var(--neon); }
.ccity .ck-panel h2 { margin: 0; font: 600 18px/1.2 var(--cc-sans); color: var(--cc-ink); }
.ccity .ck-panel p { margin: 0; font: 400 14px/1.45 var(--cc-sans); color: var(--cc-ink); }
.ccity .ck-panel .ck-big { font: 600 40px/1 var(--cc-mono); letter-spacing: -.02em; }
.ccity .ck-panel .ck-big small { font: 400 14px/1 var(--cc-mono); color: var(--cc-dim); margin-left: 8px; }
.ccity .ck-panel .ck-row { display: flex; justify-content: space-between; gap: 12px; font: 400 13px/1.3 var(--cc-mono); color: var(--cc-dim); }
.ccity .ck-panel .ck-row b { color: var(--cc-ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.ccity .ck-panel .ck-new { color: #8fe6ff; font: 600 12px/1 var(--cc-mono); letter-spacing: .1em; text-transform: uppercase; }
.ccity .ck-panel .ck-hintline { font: 400 11px/1.3 var(--cc-mono); letter-spacing: .03em; color: var(--cc-dim); }
.ccity .ck-btns { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.ccity .ck-btn { appearance: none; -webkit-appearance: none; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 12px 15px; background: rgba(241,230,220,.04); color: var(--cc-ink); border: 1px solid var(--cc-line); border-radius: 8px; font: 600 14px/1.2 var(--cc-sans); transition: border-color .2s ease, background-color .2s ease; }
.ccity .ck-btn small { font: 400 11px/1.3 var(--cc-mono); color: var(--cc-dim); letter-spacing: .02em; }
.ccity .ck-btn:hover, .ccity .ck-btn:focus-visible { border-color: var(--neon); background: color-mix(in srgb, var(--neon) 9%, transparent); outline: none; }
.ccity .ck-btn.is-quiet { font-weight: 400; color: var(--cc-dim); }
@media (max-width: 640px) { .ccity .ck-keys { display: none; } .ccity .ck-times { gap: 14px; padding: 6px 12px; } }
@media (prefers-reduced-motion: reduce) { .ccity .ck, .ccity .ck-panel, .ccity .ck-lights, .ccity .ck-go { transition-duration: .01s; } }
`;

const ORD = (T, n) => T.ord[n - 1] || n + "e";
export const fmt = s => {
  if (!(s > 0)) return "0:00.0";
  const m = Math.floor(s / 60), r = s - m * 60;
  return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1);
};

export function createKartHud(g) {
  const T = g.text.kart, host = g.hud, rootEl = host.closest(".ccity");
  const style = document.createElement("style");
  style.setAttribute("data-ccity-kart", ""); style.textContent = CSS;
  document.head.appendChild(style);

  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const root = el("div", "ck"); root.setAttribute("aria-live", "off");
  const left = el("div", "ck-left"), pos = el("div", "ck-pos"), posN = el("span", "", "1"), posOf = el("small", "", "/ 4"), lap = el("div", "ck-lap", "");
  pos.append(posN, posOf); left.append(pos, lap);
  const times = el("div", "ck-times"), tCur = el("div"), tBest = el("div", "is-best");
  const tCurB = el("b", "", "0:00.0"), tBestB = el("b", "", "—");
  tCur.append(el("span", "", T.current), tCurB); tBest.append(el("span", "", T.bestLabel), tBestB); times.append(tCur, tBest);
  const lights = el("div", "ck-lights"), lamps = [el("i"), el("i"), el("i")]; lights.append(...lamps);
  const goText = el("div", "ck-go", T.go);
  const bottom = el("div", "ck-bottom"), speed = el("div", "ck-speed"), speedB = el("span", "", "0"), speedU = el("small", "", T.speedUnit);
  speed.append(speedB, speedU);
  const boost = el("div", "ck-boost"), boostBar = el("em"), boostFill = el("i");
  boostBar.appendChild(boostFill); boost.append(el("span", "", T.boost), boostBar);
  const keys = el("div", "ck-keys");
  for (const [k, v] of T.keys) { const it = el("span"), kb = el("kbd", "", k); it.append(kb, document.createTextNode(" " + v)); keys.appendChild(it); }
  bottom.append(speed, boost, keys);
  const map = el("canvas", "ck-map"); map.setAttribute("role", "img"); map.setAttribute("aria-label", T.mapLabel);
  const panel = el("div", "ck-panel"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.hidden = true;
  root.append(left, times, lights, goText, bottom, map, panel);
  host.appendChild(root);

  // ---- circuit map: the outline is drawn once, the dots every few frames ---------------------------------------------------
  const outline = C.outline(6), B = C.bounds, bg = document.createElement("canvas");
  let mw = 0, mh = 0, scale = 1, ox = 0, oz = 0, dpr = 1;
  const mctx = map.getContext("2d"), bctx = bg.getContext("2d");
  const DOT = ["#ff4fa8", "#86a8ff", "#45c97a", "#f5c518"];
  function layoutMap() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = map.clientWidth || 150, px = Math.round(css * dpr);
    if (px === mw && mh === px) return;
    mw = mh = px; map.width = map.height = px; bg.width = bg.height = px;
    const pad = 14 * dpr, w = B.x1 - B.x0, h = B.z1 - B.z0;
    scale = Math.min((px - 2 * pad) / w, (px - 2 * pad) / h);
    ox = (px - w * scale) / 2 - B.x0 * scale; oz = (px - h * scale) / 2 - B.z0 * scale;
    bctx.clearRect(0, 0, px, px);
    bctx.lineJoin = "round"; bctx.lineCap = "round";
    const path = () => { bctx.beginPath(); outline.forEach((p, i) => { const x = p[0] * scale + ox, y = p[1] * scale + oz; if (i) bctx.lineTo(x, y); else bctx.moveTo(x, y); }); bctx.closePath(); };
    path(); bctx.strokeStyle = "rgba(63,230,255,.22)"; bctx.lineWidth = 7 * dpr; bctx.stroke();
    path(); bctx.strokeStyle = "rgba(234,223,210,.85)"; bctx.lineWidth = 1.6 * dpr; bctx.stroke();
    // start line tick
    const sx = C.X[0] * scale + ox, sy = C.Z[0] * scale + oz;
    bctx.strokeStyle = "#ffffff"; bctx.lineWidth = 2 * dpr; bctx.beginPath(); bctx.moveTo(sx - 5 * dpr, sy); bctx.lineTo(sx + 5 * dpr, sy); bctx.stroke();
  }

  let onPanelKeys = null, panelOpenFlag = false;
  const state = { posN: "", posOf: "", lap: "", cur: "", best: "", speed: "", boost: -1, boostActive: null };

  function setPanel(neon, children, focusFirst = true) {
    panel.replaceChildren(...children);
    panel.style.setProperty("--neon", neon || "#3fe6ff");
    panel.hidden = false; panelOpenFlag = true;
    panel.classList.remove("is-on");
    requestAnimationFrame(() => { if (panelOpenFlag) panel.classList.add("is-on"); });
    if (focusFirst) { const b = panel.querySelector("button"); if (b) b.focus({ preventScroll: true }); }
  }
  function btn(label, sub, cls, fn) {
    const b = el("button", "ck-btn " + (cls || ""), label); b.type = "button";
    if (sub) b.appendChild(el("small", "", sub));
    b.addEventListener("click", fn);
    return b;
  }
  function refocus() { if (rootEl) rootEl.focus({ preventScroll: true }); }

  const api = {
    root: rootEl,
    get panelOpen() { return panelOpenFlag; },
    hidePanel() {
      panelOpenFlag = false; onPanelKeys = null;
      panel.classList.remove("is-on");
      setTimeout(() => { if (!panelOpenFlag) panel.hidden = true; }, 320);
      refocus();
    },
    showMenu(bestSec, onStart, onClose) {
      const h = el("h2", "", T.title), tag = el("div", "ck-tag", T.title), line = el("p", "", T.menuLine);
      const rec = el("div", "ck-row"); rec.append(el("span", "", T.record), el("b", "", bestSec > 0 ? fmt(bestSec) : T.none));
      const b1 = btn(T.race, T.raceSub, "", () => onStart("race")), b2 = btn(T.free, T.freeSub, "", () => onStart("free")), b3 = btn(T.later, "", "is-quiet", () => onClose());
      const hint = el("div", "ck-hintline", T.menuHint);
      tag.textContent = T.tag; h.textContent = T.title;
      setPanel("#3fe6ff", [tag, h, line, rec, el("div", "ck-btns"), hint]);
      panel.querySelector(".ck-btns").append(b1, b2, b3);
      b1.focus({ preventScroll: true });
      onPanelKeys = { "Digit1": () => onStart("race"), "Digit2": () => onStart("free") };
    },
    showQuit(onYes, onNo) {
      const tag = el("div", "ck-tag", T.tag), h = el("h2", "", T.quitTitle), p = el("p", "", T.quitText), bs = el("div", "ck-btns");
      bs.append(btn(T.quitNo, "", "", () => { api.hidePanel(); onNo(); }), btn(T.quitYes, "", "is-quiet", () => { api.hidePanel(); onYes(); }));
      setPanel("#ffb070", [tag, h, p, bs]);
      onPanelKeys = {};
    },
    showFinish(d, onReplay, onBack) {
      const tag = el("div", "ck-tag", d.mode === "race" ? T.endRace : T.endFree);
      const kids = [tag];
      if (d.mode === "race") {
        const big = el("div", "ck-big", ORD(T, d.place)); big.appendChild(el("small", "", T.sur + " " + d.of)); kids.push(big);
      } else kids.push(el("div", "ck-big", fmt(d.total)));
      const row = (a, b) => { const r = el("div", "ck-row"); r.append(el("span", "", a), el("b", "", b)); return r; };
      if (d.mode === "race") kids.push(row(T.total, fmt(d.total)));
      kids.push(row(T.bestLap, d.bestLap > 0 ? fmt(d.bestLap) : T.none));
      if (d.record) kids.push(el("div", "ck-new", T.newRecord));
      else if (d.stored > 0) kids.push(row(T.record, fmt(d.stored)));
      if (d.mode === "race") kids.push(el("div", "ck-hintline", T.standing + " : " + d.standing.map((n, i) => (i + 1) + ". " + n).join("   ")));
      const bs = el("div", "ck-btns"); bs.append(btn(T.replay, "", "", () => { api.hidePanel(); onReplay(); }), btn(T.back, "", "", () => { api.hidePanel(); onBack(); }));
      kids.push(bs);
      setPanel("#8fe6ff", kids);
      onPanelKeys = {};
    },
    showRace(mode, laps, n) {
      state.boostActive = null; state.posN = state.posOf = state.lap = state.cur = state.best = state.speed = ""; state.boost = -1;
      posOf.textContent = "/ " + n; pos.style.display = n > 1 ? "" : "none";
      root.classList.add("is-on"); if (rootEl) rootEl.classList.add("is-kart");
      lights.classList.add("is-on"); lights.classList.remove("is-go"); goText.classList.remove("is-on");
      for (const l of lamps) l.classList.remove("is-red");
      layoutMap();
    },
    hideRace() {
      root.classList.remove("is-on"); if (rootEl) rootEl.classList.remove("is-kart");
      lights.classList.remove("is-on");
    },
    // countdown: a lamp every second, slowly
    lights(t) {
      const n = t < 0.7 ? 0 : t < 1.7 ? 1 : t < 2.7 ? 2 : 3;
      for (let i = 0; i < 3; i++) lamps[i].classList.toggle("is-red", i < n);
    },
    go() {
      lights.classList.add("is-go"); goText.classList.add("is-on");
      for (const l of lamps) l.classList.remove("is-red");
      setTimeout(() => { lights.classList.remove("is-on"); goText.classList.remove("is-on"); }, 1600);
    },
    update(o) {
      const set = (key, node, v) => { if (state[key] !== v) { state[key] = v; node.textContent = v; } };
      if (o.nKarts > 1) set("posN", posN, String(o.place));
      const lapNow = Math.min(o.laps, Math.max(0, o.lapIdx) + 1);
      set("lap", lap, T.lap + " " + lapNow + " " + T.sur + " " + o.laps);
      set("cur", tCurB, o.lapIdx >= 0 ? fmt(o.t - o.lapStart) : "0:00.0");
      set("best", tBestB, o.best > 0 ? fmt(o.best) : T.none);
      set("speed", speedB, String(Math.round(o.speed * 3.6)));
      const b = Math.round(o.boost * 20) / 20;
      if (b !== state.boost) { state.boost = b; boostFill.style.transform = "scaleX(" + b + ")"; }
      if (o.boostActive !== state.boostActive) { state.boostActive = o.boostActive; boost.classList.toggle("is-active", o.boostActive); }
    },
    map(karts, n) {
      if (!mw) layoutMap();
      mctx.clearRect(0, 0, mw, mh);
      mctx.drawImage(bg, 0, 0);
      for (let i = n - 1; i >= 0; i--) {
        const k = karts[i], x = k.x * scale + ox, y = k.z * scale + oz, r = (i === 0 ? 4.4 : 3.2) * dpr;
        mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2);
        mctx.fillStyle = DOT[i]; mctx.fill();
        if (i === 0) { mctx.lineWidth = 1.4 * dpr; mctx.strokeStyle = "rgba(11,13,22,.9)"; mctx.stroke(); }
      }
    },
    // keyboard on the panels: 1 / 2 in the menu, arrows move between buttons
    keys() {
      if (!panelOpenFlag) return;
      const inp = g.input;
      if (onPanelKeys) for (const k in onPanelKeys) if (inp.consume(k)) { onPanelKeys[k](); return; }
      const dn = inp.consume("ArrowDown") || inp.consume("KeyS"), up = inp.consume("ArrowUp") || inp.consume("KeyW");
      if (dn || up) {
        const bs = Array.from(panel.querySelectorAll("button")), i = bs.indexOf(document.activeElement);
        const j = (i + (dn ? 1 : -1) + bs.length) % bs.length;
        if (bs[j]) bs[j].focus({ preventScroll: true });
      }
    },
    resize() { mw = 0; layoutMap(); },
    dispose() {
      if (rootEl) rootEl.classList.remove("is-kart");
      root.remove(); style.remove();
    },
  };
  api.offResize = g.events.on("resize", () => api.resize());
  const baseDispose = api.dispose;
  api.dispose = () => { if (api.offResize) api.offResize(); baseDispose(); };
  return api;
}
