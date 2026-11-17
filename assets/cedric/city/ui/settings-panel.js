// Settings panel: camera slider (Cinématique <-> Suivi), time of evening, music, ambience, mute.
// Real form controls, labelled, with visible focus. It swallows its own key presses so typing in
// it never steers Cédric, and Esc closes it before it would close the game.
import { PHASES } from "../env/time.js";

let uid = 0;

export function createSettingsPanel(g, hud, onToggle) {
  const T = g.text, S = T.settings, id = "ccity-s" + (++uid);
  const el = document.createElement("div");
  el.className = "ccity__settings"; el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", S.title);

  const h = document.createElement("h2"); h.textContent = S.title;
  el.appendChild(h);

  const field = (cls) => { const d = document.createElement("div"); d.className = "ccity__field" + (cls ? " " + cls : ""); el.appendChild(d); return d; };
  const slider = (key, label, extraEnds) => {
    const d = field(), lab = document.createElement("label"), inp = document.createElement("input");
    lab.htmlFor = id + "-" + key; lab.textContent = label;
    inp.type = "range"; inp.min = "0"; inp.max = "1"; inp.step = "0.01"; inp.id = id + "-" + key;
    inp.value = String(g.settings.get(key));
    inp.addEventListener("input", () => g.settings.set(key, parseFloat(inp.value), false));
    inp.addEventListener("change", () => g.settings.set(key, parseFloat(inp.value), true));
    d.append(lab, inp);
    if (extraEnds) {
      const ends = document.createElement("div"); ends.className = "ccity__ends"; ends.setAttribute("aria-hidden", "true");
      for (const t of extraEnds) { const sp = document.createElement("span"); sp.textContent = t; ends.appendChild(sp); }
      d.appendChild(ends);
    }
    return inp;
  };

  const cam = slider("cam", S.camera, [S.cine, S.follow]);
  cam.setAttribute("aria-describedby", id + "-camhint");
  const camHint = document.createElement("span");
  camHint.id = id + "-camhint"; camHint.className = "ccity__sr"; camHint.textContent = S.cine + " – " + S.follow;
  cam.parentNode.appendChild(camHint);

  // time of evening: four radios styled as a segmented control
  const fs = document.createElement("fieldset"), lg = document.createElement("legend"), seg = document.createElement("div");
  fs.className = "ccity__field ccity__time"; lg.textContent = S.time; seg.className = "ccity__seg";
  fs.append(lg, seg);
  el.appendChild(fs);
  const radios = PHASES.map((name, i) => {
    const lab = document.createElement("label"), inp = document.createElement("input"), sp = document.createElement("span");
    inp.type = "radio"; inp.name = id + "-time"; inp.value = name;
    sp.textContent = T.phases[name];
    inp.addEventListener("change", () => { if (inp.checked) g.env.time.set(name); });
    lab.append(inp, sp); seg.appendChild(lab);
    return inp;
  });

  const music = slider("music", S.music);
  const amb = slider("ambience", S.ambience);

  const md = field("ccity__check"), mlab = document.createElement("label"), mute = document.createElement("input"), mtx = document.createElement("span");
  mute.type = "checkbox"; mute.id = id + "-mute"; mlab.htmlFor = mute.id;
  mtx.textContent = S.mute;
  mute.addEventListener("change", () => g.settings.set("mute", mute.checked ? 1 : 0));
  mlab.append(mute, mtx); md.appendChild(mlab);

  const close = document.createElement("button");
  close.type = "button"; close.className = "ccity__btn ccity__setclose"; close.textContent = T.panel.close;
  close.setAttribute("aria-label", S.close);
  el.appendChild(close);
  hud.appendChild(el);

  let open = false, lastLabel = "";
  const focusables = () => [...el.querySelectorAll("input, button")].filter(n => !n.disabled);

  function sync() {
    const lab = g.env.time.label;
    if (lab !== lastLabel) { lastLabel = lab; radios.forEach(r => { r.checked = r.value === lab; }); }
  }
  function syncAll() {
    cam.value = String(g.settings.get("cam")); music.value = String(g.settings.get("music")); amb.value = String(g.settings.get("ambience"));
    mute.checked = !!g.settings.get("mute");
    lastLabel = ""; sync();
  }
  const offSetting = g.events.on("setting", (k) => { if (k === "mute") mute.checked = !!g.settings.get("mute"); });

  el.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); api.close(true); e.stopPropagation(); return; }
    if (e.key === "Tab") {
      const f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation();
  });
  close.addEventListener("click", () => api.close(true));

  const api = {
    el,
    get isOpen() { return open; },
    open() {
      if (open) return;
      syncAll();
      open = true; el.hidden = false;
      requestAnimationFrame(() => { if (open) el.classList.add("is-on"); });
      cam.focus({ preventScroll: true });
      if (onToggle) onToggle(true);
    },
    // refocus: give the keyboard back to the game
    close(refocus) {
      if (!open) return;
      open = false; el.classList.remove("is-on");
      setTimeout(() => { if (!open) el.hidden = true; }, 260);
      if (refocus) { const r = el.closest(".ccity"); if (r) r.focus({ preventScroll: true }); }
      if (onToggle) onToggle(false);
    },
    toggle() { open ? api.close(true) : api.open(); },
    update() { if (open) sync(); },
    dispose() { offSetting(); el.remove(); },
  };
  return api;
}
