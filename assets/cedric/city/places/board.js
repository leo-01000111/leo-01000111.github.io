// The public notice board at the Hôtel de Ville ("Panneau d'affichage"). Entering the town hall
// opens this panel: the notes from board.json, newest first, pinned as paper, and a small form
// that sends a new note to Leon through Formspree. Notes are approved by hand and added to
// board.json later. All text goes in with textContent, never innerHTML.
// The one cross-origin request of the whole city is the Formspree POST below, and only once FORM_ID is set.
import { createBoardProp } from "./boardprop.js";

const FORM_ID = "mnpddnql"; // Formspree form id (notice board)
const NAME_MAX = 40, TEXT_MAX = 280, MAX_POSTS = 30, THROTTLE_MS = 30000;
const TILTS = [-1.6, 1.1, -0.7, 1.8, -1.2, 0.6, 1.4, -0.4];
let lastSent = 0; // one submit per 30 s per session

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return "";
  try { return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
  catch (e) { return m[0]; }
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createBoard(g) {
  const T = g.text.board, prop = createBoardProp(g);
  let posts = [], loaded = false, open = false, prevLocked = false, prevFocus = null, busy = false, gone = false, timer = 0;
  let panel, list, empty, form, nameIn, msgIn, hp, counter, submit, status, closeBtn, fs;

  function normalise(data) {
    const arr = data && Array.isArray(data.posts) ? data.posts : [];
    const out = [];
    for (const p of arr) {
      if (!p || typeof p !== "object") continue;
      const text = clean(p.text, TEXT_MAX).trim();
      if (!text) continue;
      out.push({ id: clean(p.id, 40), name: clean(p.name, NAME_MAX).replace(/\s+/g, " ").trim(), text, date: clean(p.date, 10) });
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return out.slice(0, MAX_POSTS);
  }

  function refresh() {
    let url;
    try { url = new URL("../board.json", import.meta.url); } catch (e) { return Promise.resolve(); }
    return fetch(url, { cache: "no-cache" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => normalise(d), () => [])
      .then(p => { if (gone) return; posts = p; loaded = true; render(); prop.set(posts.length); });
  }

  function render() {
    if (!list) return;
    list.replaceChildren();
    empty.hidden = !loaded || posts.length > 0;
    posts.forEach((p, i) => {
      const li = el("li", "ccity__note");
      li.style.setProperty("--tilt", TILTS[i % TILTS.length] + "deg");
      const meta = el("p", "ccity__notemeta");
      meta.append(el("span", "ccity__notename", p.name || T.anonymous));
      const d = fmtDate(p.date);
      if (d) meta.append(el("span", "ccity__notedate", d));
      li.append(el("p", "ccity__notetext", p.text), meta);
      list.appendChild(li);
    });
  }

  const say = (msg, kind) => { status.textContent = msg; status.dataset.kind = kind || ""; };
  function count() { counter.textContent = msgIn.value.length + "/" + TEXT_MAX; }

  function build() {
    panel = el("div", "ccity__board"); panel.hidden = true; panel.tabIndex = -1;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", T.title);
    panel.dataset.typing = "1"; // core/input.js ignores keys typed in here
    const head = el("div", "ccity__boardhead");
    const titles = el("div"), tag = el("p", "ccity__tag", g.text.places.mairie.name), h = el("h2", null, T.title);
    titles.append(tag, h);
    closeBtn = el("button", "ccity__btn ccity__soonclose", g.text.panel.close); closeBtn.type = "button";
    closeBtn.addEventListener("click", () => api.close());
    head.append(titles, closeBtn);

    list = el("ul", "ccity__notes"); list.tabIndex = 0; list.setAttribute("aria-label", T.listLabel);
    empty = el("p", "ccity__boardempty", T.empty); empty.hidden = true;

    form = el("form", "ccity__boardform"); form.noValidate = true;
    fs = el("fieldset", "ccity__boardfields");
    const nl = el("label", null, T.name), ml = el("label", null, T.message);
    nameIn = el("input"); nameIn.type = "text"; nameIn.name = "name"; nameIn.maxLength = NAME_MAX; nameIn.autocomplete = "nickname";
    msgIn = el("textarea"); msgIn.name = "message"; msgIn.maxLength = TEXT_MAX; msgIn.rows = 3; msgIn.required = true;
    nl.appendChild(nameIn); ml.appendChild(msgIn);
    counter = el("span", "ccity__count", "0/" + TEXT_MAX);
    hp = el("input"); hp.type = "text"; hp.name = "_gotcha"; hp.tabIndex = -1; hp.autocomplete = "off";
    const hpw = el("div", "ccity__hp"); hpw.setAttribute("aria-hidden", "true"); hpw.appendChild(hp);
    submit = el("button", "ccity__btn ccity__boardsend", T.send); submit.type = "submit";
    const row = el("div", "ccity__boardrow"); row.append(counter, submit);
    fs.append(nl, ml, hpw, row);
    status = el("p", "ccity__boardstatus"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    form.append(fs, status);
    if (!FORM_ID) { fs.disabled = true; say(T.soon, "soon"); }

    msgIn.addEventListener("input", count);
    form.addEventListener("submit", onSubmit);
    panel.addEventListener("keydown", onKey);
    panel.append(head, list, empty, form);
    g.hud.appendChild(panel);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!FORM_ID || busy) return;
    const message = clean(msgIn.value, TEXT_MAX).trim(), name = clean(nameIn.value, NAME_MAX).replace(/\s+/g, " ").trim();
    if (!message) { say(T.needText, "error"); msgIn.focus(); return; }
    if (Date.now() - lastSent < THROTTLE_MS) { say(T.wait, "error"); return; }
    busy = true; submit.disabled = true; submit.textContent = T.sending; say("");
    fetch("https://formspree.io/f/" + FORM_ID, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, _subject: T.subject, _gotcha: hp.value }),
    })
      .then(r => { if (!r.ok) throw new Error(r.status); })
      .then(() => { lastSent = Date.now(); msgIn.value = ""; count(); say(T.thanks, "ok"); },
            () => say(T.error, "error"))
      .then(() => { busy = false; submit.disabled = false; submit.textContent = T.send; });
  }

  // Esc closes this panel only; Tab stays inside; no key reaches the page behind
  function onKey(e) {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); api.close(); return; }
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll("button, input, textarea, [tabindex='0']")].filter(n => !n.disabled && n.tabIndex >= 0 && n.offsetParent !== null);
    if (!f.length) { e.preventDefault(); panel.focus(); return; }
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || a === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }
  const onFocusIn = e => { if (open && !panel.contains(e.target)) panel.focus({ preventScroll: true }); };

  const api = {
    name: "board",
    get isOpen() { return open; },
    init() { build(); refresh(); document.addEventListener("focusin", onFocusIn); },
    open(place) {
      if (open) return;
      if (g.ui && g.ui.closeAll) g.ui.closeAll();
      open = true; prevFocus = document.activeElement;
      panel.style.setProperty("--neon", (place && place.neon) || "#ffb070");
      clearTimeout(timer); panel.hidden = false;
      prevLocked = g.player.locked; g.player.locked = true; g.player.state.speed = 0; g.player.state.turnRate = 0;
      refresh();
      render();
      requestAnimationFrame(() => { if (open) { panel.classList.add("is-on"); panel.focus({ preventScroll: true }); } });
    },
    close() {
      if (!open) return false;
      open = false; panel.classList.remove("is-on");
      timer = setTimeout(() => { if (!open) panel.hidden = true; }, 260);
      g.player.locked = prevLocked;
      const back = prevFocus && prevFocus.isConnected ? prevFocus : panel.closest(".ccity");
      if (back && back.focus) back.focus({ preventScroll: true });
      return true;
    },
    dispose() {
      gone = true; clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      if (open) g.player.locked = prevLocked;
      prop.dispose();
      if (panel) panel.remove();
    },
  };
  return api;
}
