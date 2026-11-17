// Flight HUD in the game's pen-and-mono style: a strip of three cells (altitude, airspeed, vario with a
// hatched tape), a key hint, the "Espace — atterrir" prompt, the take-off panel, the "Rentrer ?" dialog and
// a flat dark cover used to fade between the field and the air. Its own <style>, removed on dispose.
// DOM text is only touched when a value changes.
const CSS = /* css */`
.ccity .ccfl__strip { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); display: flex; opacity: 0; transition: opacity .9s ease; pointer-events: none; }
.ccity .ccfl__strip.is-on { opacity: 1; }
.ccity .ccfl__cell { min-width: 96px; margin-left: -1px; padding: 8px 14px 9px; border: 1px solid var(--cc-line); background: var(--cc-bg); display: flex; flex-direction: column; gap: 6px; }
.ccity .ccfl__cell:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
.ccity .ccfl__cell:last-child { border-radius: 0 8px 8px 0; }
.ccity .ccfl__lab { font: 600 9.5px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: var(--cc-dim); }
.ccity .ccfl__val { font: 600 21px/1.05 var(--cc-mono); color: var(--cc-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ccity .ccfl__unit { font: 400 11px/1 var(--cc-mono); color: var(--cc-dim); margin-left: 5px; }
.ccity .ccfl__vario { flex-direction: row; align-items: stretch; gap: 11px; }
.ccity .ccfl__vcol { display: flex; flex-direction: column; gap: 6px; }
.ccity .ccfl__tape { position: relative; width: 7px; min-height: 40px; border: 1px solid var(--cc-line-hi); border-radius: 1px; }
.ccity .ccfl__tape::after { content: ""; position: absolute; left: -4px; right: -4px; top: 50%; border-top: 1px solid var(--cc-line-hi); }
.ccity .ccfl__fill { position: absolute; left: 0; right: 0; height: 0; --c: var(--cc-warm); background: repeating-linear-gradient(135deg, var(--c) 0 2px, transparent 2px 5px); }
.ccity .ccfl__fill.is-up { bottom: 50%; }
.ccity .ccfl__fill.is-down { top: 50%; --c: #8fb8ff; }
.ccity .ccfl__hint { position: absolute; left: 50%; bottom: 92px; transform: translateX(-50%); display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 20px; max-width: calc(100% - 2 * (var(--cc-map) + var(--cc-edge)) - 24px);
  font: 400 11px/1.4 var(--cc-mono); letter-spacing: .04em; color: var(--cc-dim); text-shadow: 0 0 8px rgba(0, 0, 0, .7), 0 0 2px rgba(0, 0, 0, .6); white-space: nowrap; opacity: 0; transition: opacity 1.8s ease; pointer-events: none; }
.ccity .ccfl__hint.is-on { opacity: 1; }
.ccity .ccfl__hint kbd { font: 600 10px/1 var(--cc-mono); color: var(--cc-ink); padding: 3px 6px; margin-right: 2px; border: 1px solid var(--cc-line); border-radius: 3px; background: rgba(11, 13, 22, .38); }
.ccity.ccfl-on .ccity__hint { visibility: hidden; }
.ccity .ccfl__prompt { bottom: 132px; }
.ccity .ccfl__note { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 8px 16px; border-radius: 999px; background: var(--cc-bg); border: 1px solid var(--cc-line); font: 500 12px/1 var(--cc-mono); letter-spacing: .04em; color: var(--cc-ink); opacity: 0; transition: opacity .8s ease; pointer-events: none; white-space: nowrap; }
.ccity .ccfl__note.is-on { opacity: 1; }
.ccity .ccfl__panel { --neon: #ff7a3a; position: absolute; left: 50%; top: 50%; width: min(380px, calc(100% - 36px)); transform: translate(-50%, calc(-50% - 8px)); opacity: 0; pointer-events: auto;
  padding: 22px 24px 20px; display: flex; flex-direction: column; gap: 12px; background: var(--cc-panel); border: 1px solid var(--cc-line); border-top: 2px solid var(--neon); border-radius: 10px;
  box-shadow: 0 0 30px color-mix(in srgb, var(--neon) 16%, transparent); transition: opacity .25s ease, transform .25s ease; }
.ccity .ccfl__panel.is-on { opacity: 1; transform: translate(-50%, -50%); }
.ccity .ccfl__panel h2 { margin: 0; font: 600 17px/1.2 var(--cc-sans); color: var(--cc-ink); }
.ccity .ccfl__panel p { margin: 0; font: 400 14px/1.45 var(--cc-sans); color: var(--cc-ink); }
.ccity .ccfl__panel .ccfl__tag { font: 600 10px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: var(--neon); }
.ccity .ccfl__panel .ccfl__foot { font: 400 11px/1.3 var(--cc-mono); letter-spacing: .03em; color: var(--cc-dim); }
.ccity .ccfl__row { display: flex; gap: 10px; justify-content: flex-end; }
.ccity .ccfl__go { border-color: var(--neon); }
.ccity .ccfl__fade { position: absolute; inset: 0; background: #0a0c13; opacity: 0; pointer-events: none; transition: opacity .7s ease; }
@media (max-width: 640px) { .ccity .ccfl__cell { min-width: 74px; padding: 7px 10px 8px; } .ccity .ccfl__val { font-size: 17px; } .ccity .ccfl__hint { display: none; } }
@media (prefers-reduced-motion: reduce) { .ccity .ccfl__strip, .ccity .ccfl__hint, .ccity .ccfl__panel, .ccity .ccfl__fade, .ccity .ccfl__note { transition-duration: .01s; } }
`;

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

export function createFlightHud(g, cb) {
  const T = g.text.flight, hud = g.hud, root = hud.closest(".ccity") || hud;
  const style = document.createElement("style");
  style.setAttribute("data-ccity-flight", ""); style.textContent = CSS;
  document.head.appendChild(style);

  const fade = el("div", "ccfl__fade");
  fade.setAttribute("aria-hidden", "true");

  // strip
  const strip = el("div", "ccfl__strip");
  strip.setAttribute("role", "status"); strip.setAttribute("aria-label", T.title);
  const cell = (cls, lab, unit) => {
    const c = el("div", "ccfl__cell " + cls), l = el("span", "ccfl__lab", lab), v = el("span", "ccfl__val", "0"), u = el("span", "ccfl__unit", unit);
    const row = el("div"); row.append(v, u);
    c.append(l, row);
    return { c, v, l, row };
  };
  const alt = cell("", T.hud.alt, T.hud.m), spd = cell("", T.hud.speed, T.hud.kmh);
  const var_ = cell("ccfl__vario", T.hud.vario, T.hud.ms);
  const vcol = el("div", "ccfl__vcol"); vcol.append(var_.l, var_.row);
  const tape = el("div", "ccfl__tape"), fill = el("div", "ccfl__fill");
  tape.appendChild(fill);
  var_.c.textContent = ""; var_.c.append(vcol, tape);
  strip.append(alt.c, spd.c, var_.c);
  const last = { a: NaN, s: NaN, v: NaN };

  // hint
  const hint = el("div", "ccfl__hint");
  hint.setAttribute("role", "note"); hint.setAttribute("aria-label", T.hintLabel);
  for (const [k, v] of T.hint) { const it = el("span"), kb = el("kbd", null, k); it.append(kb, document.createTextNode(" " + v)); hint.appendChild(it); }

  // prompt + note
  const prompt = el("div", "ccity__prompt ccfl__prompt"), ptxt = el("span");
  prompt.setAttribute("role", "status"); prompt.setAttribute("aria-live", "polite");
  prompt.style.setProperty("--neon", "#ff7a3a");
  prompt.appendChild(ptxt);
  const note = el("div", "ccfl__note");
  note.setAttribute("role", "status"); note.setAttribute("aria-live", "polite");

  // panels
  const panel = (tag, title, text, foot, yes, no) => {
    const p = el("div", "ccfl__panel"), h = el("h2", null, title);
    p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", title);
    const row = el("div", "ccfl__row"), b1 = el("button", "ccity__btn ccfl__go", yes), b2 = el("button", "ccity__btn", no);
    b1.type = b2.type = "button";
    row.append(b2, b1);
    p.append(el("p", "ccfl__tag", tag), h, el("p", null, text));
    if (foot) p.append(el("p", "ccfl__foot", foot));
    p.append(row);
    return { p, yes: b1, no: b2 };
  };
  const take = panel(T.tag, T.title, T.text, T.panelHint, T.takeoff, T.stay);
  const conf = panel(T.tag, T.confirmTitle, T.confirmText, null, T.confirmYes, T.confirmNo);
  hud.append(fade, strip, hint, prompt, note, take.p, conf.p);

  let hintTimer = 0, noteTimer = 0, openedAt = 0;
  const open = (pn, focus) => {
    pn.p.hidden = false; openedAt = performance.now();
    requestAnimationFrame(() => pn.p.classList.add("is-on"));
    focus.focus({ preventScroll: true });
  };
  const close = pn => {
    pn.p.classList.remove("is-on");
    setTimeout(() => { if (!pn.p.classList.contains("is-on")) pn.p.hidden = true; }, 260);
    root.focus({ preventScroll: true });
  };
  const click = (fn) => () => { if (performance.now() - openedAt > 300) fn(); };
  take.yes.addEventListener("click", click(() => cb.onTakeoff()));
  take.no.addEventListener("click", click(() => cb.onStay()));
  conf.yes.addEventListener("click", click(() => cb.onHome()));
  conf.no.addEventListener("click", click(() => cb.onResume()));
  // Space / Enter on these buttons belong to the buttons
  for (const pn of [take.p, conf.p]) pn.addEventListener("keydown", e => { if (e.code === "Space" || e.code === "Enter") e.stopPropagation(); });

  return {
    get panelOpen() { return take.p.classList.contains("is-on"); },
    get confirmOpen() { return conf.p.classList.contains("is-on"); },
    openPanel() { open(take, take.yes); },
    closePanel() { close(take); },
    openConfirm() { open(conf, conf.yes); },
    closeConfirm() { close(conf); },
    // the strip and its hint come and go with the flight
    show(on) {
      strip.classList.toggle("is-on", on);
      root.classList.toggle("ccfl-on", on);
      clearTimeout(hintTimer);
      hint.classList.toggle("is-on", on);
      if (on) hintTimer = setTimeout(() => hint.classList.remove("is-on"), 12000);
      if (!on) prompt.classList.remove("is-on");
    },
    stats(altM, kmh, vz) {
      const a = Math.round(altM), s = Math.round(kmh), v = Math.round(vz * 10) / 10;
      if (a !== last.a) { last.a = a; alt.v.textContent = String(a); }
      if (s !== last.s) { last.s = s; spd.v.textContent = String(s); }
      if (v !== last.v) {
        last.v = v;
        var_.row.firstChild.textContent = (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
        const h = Math.min(1, Math.abs(v) / 5) * 50;
        fill.className = "ccfl__fill " + (v >= 0 ? "is-up" : "is-down"); fill.style.height = h + "%";
      }
    },
    prompt(text) {
      if (text) { if (ptxt.textContent !== text) ptxt.textContent = text; prompt.classList.add("is-on"); }
      else prompt.classList.remove("is-on");
    },
    note(text, ms = 3200) {
      note.textContent = text; note.classList.add("is-on");
      clearTimeout(noteTimer); noteTimer = setTimeout(() => note.classList.remove("is-on"), ms);
    },
    fade(to, ms = 700) { fade.style.transition = `opacity ${ms}ms ease`; fade.style.opacity = to ? "1" : "0"; },
    dispose() {
      clearTimeout(hintTimer); clearTimeout(noteTimer);
      root.classList.remove("ccfl-on");
      for (const e of [fade, strip, hint, prompt, note, take.p, conf.p]) e.remove();
      style.remove();
    },
  };
}
