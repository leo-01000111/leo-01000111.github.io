// HUD: back button, sound toggle, settings, controls hint, minimap, big map (M), door prompt and
// the "Bientôt" panel. Quiet on purpose. Injects ui/city.css on open and removes it on close.
// Everything lives under g.hud (a child of .ccity); DOM text is only touched when a value changes.
import { createMinimap, createBigMap } from "./minimap.js";
import { createPrompt, createSoonPanel } from "./prompt.js";
import { createSettingsPanel } from "./settings-panel.js";

const SVG = "http://www.w3.org/2000/svg";
function icon(paths) {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false");
  for (const d of paths) { const p = document.createElementNS(SVG, "path"); p.setAttribute("d", d); s.appendChild(p); }
  return s;
}
const SPEAKER = ["M4 9.5h3.5L12 6v12l-4.5-3.5H4z"];
const WAVES = ["M15.2 9.2a4 4 0 0 1 0 5.6", "M17.8 6.8a7.6 7.6 0 0 1 0 10.4"];
const CROSS = ["M16 9.5l5 5", "M21 9.5l-5 5"];
const SLIDERS = ["M4 7h9", "M17 7h3", "M4 17h3", "M11 17h9", "M15 4.5v5", "M9 14.5v5"];

function button(cls, label) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ccity__btn " + cls;
  if (label) b.setAttribute("aria-label", label);
  return b;
}

export function createHud(g) {
  const T = g.text, hud = g.hud, ev = g.events;
  let link = null, minimap, bigmap, prompt, soon, settings, soundBtn, settingsBtn, hint;
  let hintTimer = 0, moved = false, offs = [], rootEl = null;

  const refocus = () => { if (rootEl) rootEl.focus({ preventScroll: true }); };
  const overlayChanged = () => prompt && prompt.suppress(soon.isOpen || bigmap.isOpen);

  function closeOthers(except) {
    if (!settings) return; // bench mode has no panels
    if (except !== settings && settings.isOpen) settings.close(false);
    if (except !== soon && soon.isOpen) soon.close();
    if (except !== bigmap && bigmap.isOpen) bigmap.close();
  }

  function paintSound() {
    const muted = !!g.settings.get("mute"), label = muted ? T.hud.soundOn : T.hud.soundOff;
    soundBtn.setAttribute("aria-label", label); soundBtn.title = label;
    soundBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    soundBtn.classList.toggle("is-muted", muted);
  }

  const api = {
    name: "hud",
    init() {
      rootEl = hud.closest(".ccity");
      // stylesheet: hidden until it has loaded, so the HUD never flashes unstyled
      const href = new URL("./city.css", import.meta.url).href;
      link = document.createElement("link");
      link.rel = "stylesheet"; link.href = href; link.setAttribute("data-ccity", "");
      hud.style.visibility = "hidden";
      const show = () => { hud.style.visibility = ""; };
      link.addEventListener("load", show); link.addEventListener("error", show);
      document.head.appendChild(link);
      if (document.fonts && document.fonts.load) {
        document.fonts.load("600 11px 'Ccity Plex Mono'").catch(() => {});
        document.fonts.load("400 11px 'Ccity Plex Mono'").catch(() => {});
      }

      // back
      const back = button("ccity__back"); back.textContent = T.hud.back; back.setAttribute("aria-label", T.hud.backLabel);
      back.addEventListener("click", () => { closeOthers(null); ev.emit("escape"); });

      // top-right tools
      const tools = document.createElement("div"); tools.className = "ccity__tools";
      soundBtn = button("ccity__icon");
      const sw = icon(SPEAKER.concat(WAVES)), sx = icon(SPEAKER.concat(CROSS));
      sw.setAttribute("class", "ccity__ic-on"); sx.setAttribute("class", "ccity__ic-off");
      soundBtn.append(sw, sx);
      soundBtn.addEventListener("click", () => { g.settings.set("mute", g.settings.get("mute") ? 0 : 1); paintSound(); refocus(); });
      settingsBtn = button("ccity__icon", T.hud.settings); settingsBtn.title = T.hud.settings;
      settingsBtn.appendChild(icon(SLIDERS));
      settingsBtn.setAttribute("aria-haspopup", "dialog");
      tools.append(settingsBtn);
      if (!g.audio || g.audio.supported) tools.prepend(soundBtn);

      // hint
      hint = document.createElement("div"); hint.className = "ccity__hint";
      hint.setAttribute("role", "note"); hint.setAttribute("aria-label", T.hud.hintLabel);
      for (const [k, v] of T.hud.hint) {
        const it = document.createElement("span"), kb = document.createElement("kbd");
        kb.textContent = k; it.append(kb, document.createTextNode(" " + v)); hint.appendChild(it);
      }

      // work-in-progress tag next to Retour
      const wip = document.createElement("span"); wip.className = "ccity__wip"; wip.textContent = T.hud.wip; wip.title = T.hud.wipLabel;
      if (g.mode === "bench") { // phone / reduced motion: Retour and nothing else (bench.js adds "son")
        hud.append(back, wip);
        g.ui = { escape: () => false };
        return;
      }
      hud.append(back, wip, tools, hint);
      prompt = createPrompt(g, hud);
      soon = createSoonPanel(g, hud, () => { overlayChanged(); if (!soon.isOpen) refocus(); });
      bigmap = createBigMap(g, hud, on => { if (on) closeOthers(bigmap); overlayChanged(); if (!on) refocus(); });
      minimap = createMinimap(g, hud);
      settings = createSettingsPanel(g, hud, on => { if (on) closeOthers(settings); settingsBtn.setAttribute("aria-expanded", on ? "true" : "false"); });
      settingsBtn.setAttribute("aria-expanded", "false");
      settingsBtn.addEventListener("click", () => settings.toggle());
      minimap.el.setAttribute("title", T.hud.mapOpen);
      minimap.el.addEventListener("click", () => { closeOthers(bigmap); bigmap.toggle(); });
      paintSound();

      // Space / Enter on a HUD button must activate the button, not steer the game
      hud.addEventListener("keydown", e => {
        if ((e.code === "Space" || e.code === "Enter") && e.target.tagName === "BUTTON") e.stopPropagation();
      });

      offs.push(ev.on("near", place => prompt.show(place)));
      offs.push(ev.on("resize", () => bigmap.resize()));
      offs.push(ev.on("setting", k => { if (k === "mute") paintSound(); }));
      if (g.player.state.near) prompt.show(g.player.state.near);

      // main.js asks this before closing the game on Esc: the top overlay goes first
      g.ui = {
        escape() {
          if (g.kart && g.kart.escape()) return true; // --- karting --- menu, race and finish panel come first
          if (g.places && g.places.board && g.places.board.close()) return true;
          if (g.places && g.places.station && g.places.station.escape()) return true;
          if (bigmap.isOpen) { bigmap.close(); return true; }
          if (soon.isOpen) { soon.close(); return true; }
          if (settings.isOpen) { settings.close(true); return true; }
          // --- aerodrome ---
          if (g.flight && g.flight.escape()) return true;   // the take-off panel, or "Rentrer à l'aérodrome ?" in the air
          // --- end aerodrome ---
          return false;
        },
        // places/registry.js calls this: Space toggles the place panel
        panel(place) {
          if (soon.isOpen) { soon.close(); return; }
          closeOthers(soon);
          soon.open(place);
        },
        closeAll() { closeOthers(null); },
        map: bigmap, settings, soon,
      };
    },
    update(dt) {
      if (g.mode === "bench") return;
      const inp = g.input;
      if (inp.consume("KeyM") && !(g.places && g.places.board && g.places.board.isOpen)) { closeOthers(bigmap); bigmap.toggle(); }
      if (!moved && (inp.fwd !== 0 || inp.turn !== 0)) {
        moved = true;
        hintTimer = setTimeout(() => hint.classList.add("is-gone"), 1800);
      }
      if (!bigmap.isOpen) minimap.frame();
      bigmap.update(dt);
      settings.update();
    },
    dispose() {
      clearTimeout(hintTimer);
      for (const o of offs) o();
      offs = [];
      for (const p of [minimap, bigmap, prompt, soon, settings]) if (p) p.dispose();
      if (link) { link.remove(); link = null; }
      if (g.ui) delete g.ui;
    },
  };
  return api;
}
