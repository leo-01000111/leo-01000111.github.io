// Player-name popup, shown over the loading cover. It never blocks loading: the game boots behind it
// and starts whatever the player does. A non-empty name is sent once per page load through the
// its own Formspree form; skipping or Esc sends nothing. All text goes in with textContent.
const FORM_URL = "https://formspree.io/f/xrpqqlyd"; // its own Formspree form (not the notice board's)
const NAME_MAX = 40, NAME_KEY = "cedric:city:name", MESSAGE = "a new player has logged in";
let sent = false; // at most one send per page load

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max).replace(/\s+/g, " ").trim();
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function remembered() { try { return clean(localStorage.getItem(NAME_KEY), NAME_MAX); } catch (e) { return ""; } }
function remember(name) { try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* ignore */ } }

function send(name, subject) {
  if (sent || !name) return;
  sent = true;
  try {
    fetch(FORM_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name, message: MESSAGE, _subject: subject, _gotcha: "" }),
    }).catch(() => { /* fire and forget */ });
  } catch (e) { /* ignore */ }
}

// parent: the .ccity root. onDone() runs when the popup closes (focus hand-back). Returns { dispose }.
export function createNamePopup(parent, T, onDone) {
  let gone = false;
  const panel = el("div", "ccity__board ccity__namepop");
  panel.tabIndex = -1; panel.dataset.typing = "1";
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", T.title);
  const h = el("h2", null, T.title), form = el("form"), label = el("label", "ccity__sr", T.label);
  form.noValidate = true;
  const input = el("input"); input.type = "text"; input.name = "name"; input.maxLength = NAME_MAX; input.autocomplete = "nickname";
  input.setAttribute("aria-label", T.label); input.value = remembered();
  const go = el("button", "ccity__btn", T.go); go.type = "submit";
  const skip = el("button", "ccity__btn", T.skip); skip.type = "button";
  const row = el("div", "ccity__boardrow"); row.append(skip, go);
  const note = el("p", "ccity__namenote", T.note);
  form.append(label, input, row);
  panel.append(h, form, note);
  parent.appendChild(panel);
  // city.css is injected later by the HUD: stay hidden until it applies, so the popup never flashes unstyled
  panel.style.visibility = "hidden";
  const show = () => {
    if (gone) return;
    if (getComputedStyle(panel).position !== "absolute") { setTimeout(show, 50); return; }
    panel.style.visibility = "";
    setTimeout(() => { if (!gone) { panel.classList.add("is-on"); try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 30);
  };
  setTimeout(show, 0);

  function close() {
    if (gone) return;
    gone = true; panel.remove();
    try { if (onDone) onDone(); } catch (e) { /* ignore */ }
  }
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = clean(input.value, NAME_MAX);
    if (name) { remember(name); send(name, T.subject); }
    close();
  });
  skip.addEventListener("click", close);
  panel.addEventListener("pointerdown", e => e.stopPropagation());
  panel.addEventListener("keydown", e => {
    e.stopPropagation(); // no key reaches the game, nor main.js's Esc-to-quit
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll("button, input")].filter(n => !n.disabled && n.tabIndex >= 0);
    const a = document.activeElement;
    if (!f.length) { e.preventDefault(); panel.focus(); return; }
    if (e.shiftKey && (a === f[0] || a === panel)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  return { dispose: close };
}
