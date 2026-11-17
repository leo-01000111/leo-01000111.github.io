// "Espace — entrer ..." near a door, eased in and out; and the small place panel (name, one line
// of flavour, "Bientôt") that Space opens until each place has its real content.

export function createPrompt(g, hud) {
  const el = document.createElement("div");
  el.className = "ccity__prompt";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  const txt = document.createElement("span");
  el.appendChild(txt);
  hud.appendChild(el);
  let shown = null, forceOff = false;
  const sync = () => el.classList.toggle("is-on", !!shown && !forceOff);
  return {
    el,
    show(place) {
      if (place === shown) return;
      shown = place;
      if (place) {
        const t = g.text.places[place.id];
        txt.textContent = t ? t.prompt : g.text.enter;
        el.style.setProperty("--neon", place.neon);
      }
      sync();
    },
    // another overlay is on screen: keep the prompt out of the way without forgetting the place
    suppress(v) { forceOff = !!v; sync(); },
    dispose() { el.remove(); },
  };
}

export function createSoonPanel(g, hud, onToggle) {
  const T = g.text;
  const el = document.createElement("div");
  el.className = "ccity__soon"; el.hidden = true;
  el.setAttribute("role", "dialog");
  const h = document.createElement("h2"), tag = document.createElement("p"), msg = document.createElement("p"), foot = document.createElement("p");
  tag.className = "ccity__tag"; tag.textContent = T.soon;
  msg.textContent = T.panelSoon;
  foot.className = "ccity__hintline"; foot.textContent = T.panel.hint;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "ccity__btn ccity__soonclose"; btn.textContent = T.panel.close;
  el.append(tag, h, msg, foot, btn);
  hud.appendChild(el);
  let open = false;
  const api = {
    el, closeBtn: btn,
    get isOpen() { return open; },
    open(place) {
      const t = T.places[place.id];
      h.textContent = t ? t.name : place.id;
      msg.textContent = (t && t.flavour) || T.panelSoon;
      el.setAttribute("aria-label", h.textContent);
      el.style.setProperty("--neon", place.neon);
      open = true; el.hidden = false;
      requestAnimationFrame(() => { if (open) el.classList.add("is-on"); });
      if (onToggle) onToggle(true);
    },
    close() {
      if (!open) return;
      open = false; el.classList.remove("is-on");
      setTimeout(() => { if (!open) el.hidden = true; }, 260);
      if (onToggle) onToggle(false);
    },
    dispose() { el.remove(); },
  };
  btn.addEventListener("click", () => api.close());
  return api;
}
