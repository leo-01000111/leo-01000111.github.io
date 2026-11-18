// La Serre's HUD, plain DOM under g.hud: a small badge (harvests), a toast line, and the bed menu.
// Keys follow the karting menu: arrows (or W / S) move between the buttons, Space or Enter press
// the focused one, 1..6 pick a seed, Esc closes. The stylesheet is injected on creation and removed
// on dispose. All text goes in with textContent.
const CSS = `
.ccity .cs-badge { position: absolute; left: var(--cc-edge); top: 68px; display: flex; flex-direction: column; gap: 6px; opacity: 0; transition: opacity .6s ease; pointer-events: none; text-shadow: 0 0 10px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.7); }
.ccity .cs-badge.is-on { opacity: 1; }
.ccity .cs-badge b { font: 600 11px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: #9bff8a; }
.ccity .cs-badge span { font: 500 13px/1.2 var(--cc-mono); color: var(--cc-ink); font-variant-numeric: tabular-nums; }
.ccity .cs-toast { position: absolute; left: 50%; bottom: 132px; transform: translate(-50%, 6px); opacity: 0; pointer-events: none; padding: 9px 18px; background: var(--cc-bg); border: 1px solid var(--cc-line); border-radius: 999px; font: 500 13px/1.2 var(--cc-mono); letter-spacing: .02em; white-space: nowrap; transition: opacity .5s ease, transform .5s ease; }
.ccity .cs-toast.is-on { opacity: 1; transform: translate(-50%, 0); }
.ccity.is-serre-menu .ccity__prompt { opacity: 0 !important; }
.ccity .cs-panel { --neon: #9bff8a; position: absolute; left: 50%; top: 50%; width: min(380px, calc(100% - 36px)); max-height: calc(100% - 36px); overflow: auto; transform: translate(-50%, calc(-50% - 6px)); opacity: 0; pointer-events: auto; display: flex; flex-direction: column; gap: 12px; padding: 22px 24px 20px; background: var(--cc-panel); border: 1px solid var(--cc-line); border-top: 2px solid var(--neon); border-radius: 10px; box-shadow: 0 0 30px color-mix(in srgb, var(--neon) 16%, transparent); transition: opacity .3s ease, transform .3s ease; font-family: var(--cc-sans); }
.ccity .cs-panel.is-on { opacity: 1; transform: translate(-50%, -50%); }
.ccity .cs-tag { font: 600 10px/1 var(--cc-mono); letter-spacing: .16em; text-transform: uppercase; color: var(--neon); }
.ccity .cs-panel h2 { margin: 0; font: 600 18px/1.2 var(--cc-sans); color: var(--cc-ink); }
.ccity .cs-panel p { margin: 0; font: 400 14px/1.45 var(--cc-sans); color: var(--cc-ink); }
.ccity .cs-bar { height: 3px; background: rgba(241,230,220,.2); border-radius: 2px; overflow: hidden; }
.ccity .cs-bar i { display: block; height: 100%; width: 0; background: var(--neon); }
.ccity .cs-btns { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
.ccity .cs-btn { position: relative; appearance: none; -webkit-appearance: none; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 11px 15px; background: rgba(241,230,220,.04); color: var(--cc-ink); border: 1px solid var(--cc-line); border-radius: 8px; font: 600 14px/1.2 var(--cc-sans); transition: border-color .2s ease, background-color .2s ease; }
.ccity .cs-btn small { font: 400 11px/1.3 var(--cc-mono); color: var(--cc-dim); letter-spacing: .02em; }
.ccity .cs-btn kbd { position: absolute; right: 12px; top: 11px; font: 600 10px/1 var(--cc-mono); padding: 3px 6px; border: 1px solid var(--cc-line); border-radius: 3px; color: var(--cc-dim); }
.ccity .cs-btn:hover, .ccity .cs-btn:focus-visible { border-color: var(--neon); background: color-mix(in srgb, var(--neon) 9%, transparent); outline: none; }
.ccity .cs-btn.is-quiet { font-weight: 400; color: var(--cc-dim); }
.ccity .cs-hintline { font: 400 11px/1.3 var(--cc-mono); letter-spacing: .03em; color: var(--cc-dim); }
@media (prefers-reduced-motion: reduce) { .ccity .cs-badge, .ccity .cs-toast, .ccity .cs-panel { transition-duration: .01s; } }
`;

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const STALE = ["ArrowUp", "ArrowDown", "KeyW", "KeyS", "Enter", "Space", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"];

export function createSerreUi(g) {
  const T = g.text.serre, host = g.hud, rootEl = host.closest(".ccity");
  const style = el("style"); style.setAttribute("data-ccity-serre", ""); style.textContent = CSS;
  document.head.appendChild(style);
  const badge = el("div", "cs-badge"), badgeTag = el("b", "", T.tag), badgeHarvest = el("span", "", "");
  badge.append(badgeTag, badgeHarvest);
  const toastEl = el("div", "cs-toast"); toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite");
  const panel = el("div", "cs-panel"); panel.hidden = true; panel.setAttribute("role", "dialog");
  host.append(badge, toastEl, panel);

  let open = false, pendingFocus = false, keys = null, toastT = 0, badgeOn = false, harvests = -1;
  const buttons = () => Array.from(panel.querySelectorAll("button"));
  const refocus = () => { if (rootEl) rootEl.focus({ preventScroll: true }); };

  const api = {
    get isOpen() { return open; },
    badge(on, n) {
      if (on !== badgeOn) { badgeOn = on; badge.classList.toggle("is-on", on); }
      if (on && n !== harvests) { harvests = n; badgeHarvest.textContent = T.harvests + " : " + n; }
    },
    toast(msg, secs = 2.6) {
      toastEl.textContent = msg; toastEl.classList.add("is-on"); toastT = secs;
    },
    // m: { tag, title, line, progress (0..1 or null), items: [{ label, sub, key, quiet, fn }] }
    menu(m) {
      const h = el("h2", "", m.title), tag = el("div", "cs-tag", m.tag), line = el("p", "", m.line);
      const kids = [tag, h, line];
      if (m.progress != null) { const bar = el("div", "cs-bar"), fill = el("i"); fill.style.width = Math.round(m.progress * 100) + "%"; bar.appendChild(fill); kids.push(bar); }
      const list = el("div", "cs-btns");
      keys = {};
      for (const it of m.items) {
        const b = el("button", "cs-btn" + (it.quiet ? " is-quiet" : ""), it.label); b.type = "button";
        if (it.key) { b.appendChild(el("kbd", "", it.key)); keys["Digit" + it.key] = it.fn; }
        if (it.sub) b.appendChild(el("small", "", it.sub));
        b.addEventListener("click", it.fn);
        list.appendChild(b);
      }
      kids.push(list, el("p", "cs-hintline", T.menuHint));
      panel.replaceChildren(...kids);
      panel.setAttribute("aria-label", m.title);
      panel.hidden = false; open = true;
      panel.classList.remove("is-on");
      requestAnimationFrame(() => { if (open) panel.classList.add("is-on"); });
      for (const k of STALE) g.input.consume(k);
      pendingFocus = true; // focus the first button once Space / Enter are released, so the key that opened the menu cannot press it
      if (rootEl) rootEl.classList.add("is-serre-menu");
    },
    close() {
      if (!open) return false;
      open = false; keys = null; pendingFocus = false;
      panel.classList.remove("is-on");
      setTimeout(() => { if (!open) panel.hidden = true; }, 320);
      if (rootEl) rootEl.classList.remove("is-serre-menu");
      refocus();
      return true;
    },
    update(dt) {
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove("is-on"); }
      if (!open) return;
      const inp = g.input;
      if (pendingFocus && !inp.down.has("Space") && !inp.down.has("Enter")) { pendingFocus = false; const b = buttons()[0]; if (b) b.focus({ preventScroll: true }); }
      if (keys) for (const k in keys) if (inp.consume(k)) { keys[k](); return; }
      const dn = inp.consume("ArrowDown") || inp.consume("KeyS"), up = inp.consume("ArrowUp") || inp.consume("KeyW");
      if (dn || up) {
        const bs = buttons(), i = bs.indexOf(document.activeElement);
        const j = i < 0 ? 0 : (i + (dn ? 1 : -1) + bs.length) % bs.length;
        if (bs[j]) bs[j].focus({ preventScroll: true });
      }
    },
    dispose() {
      if (rootEl) rootEl.classList.remove("is-serre-menu");
      badge.remove(); toastEl.remove(); panel.remove(); style.remove();
    },
  };
  return api;
}
