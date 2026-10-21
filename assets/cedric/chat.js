/* Cedric on the site: the home-page Cedric ([data-cedric-home]) and the "talk to Cedric"
   launcher in the bottom-right corner, which opens a chat panel. Cedric can't really chat:
   his first reply hands the visitor a form that sends Leon a message through Formspree; after
   that a small LLM running in the browser (brain.js, loaded on demand) answers.
   Loaded by main.js after design.js + cedric.js. Text lives in lines.json next to this file. */
(function () {
  const FORM_ENDPOINT = "https://formspree.io/f/xoejjdqw";   // Cedric chat form (separate from tutoring)
  const FALLBACK_EMAIL = "leon.gorecki.fr@proton.me";
  const LAUNCHER_VIEW = "whole";   // "whole" Cedric in the corner square, or "head" for a close-up
  const BASE = document.currentScript.src.replace(/[^/]*$/, "");
  const ROOT = BASE.replace(/assets\/cedric\/$/, "");
  const design = window.CEDRIC_DESIGN;
  const lang = (document.documentElement.lang || "en").toLowerCase().startsWith("fr") ? "fr" : "en";

  const UI = {
    en: {
      launcher: "Talk to Cédric", title: "Cédric", close: "Close chat", pin: "Keep chat open",
      placeholder: "Say something to Cédric…", send: "Send", typing: "Cédric is typing",
      name: "Name", email: "Email", message: "Message", submit: "Send to Leon", sending: "Sending…",
      fail: "That didn't go through. You can email Leon directly: ", subject: "Cédric chat: message from ",
      poke: "Cédric the shrimp. Poke him.", peek: "Blue Cédric is hiding here. Click him!",
      cv: "CV (PDF)",
      wake: "Wake up", mb: "MB", cancel: "Cancel", wakeFail: "Couldn't wake him up on this device.",
      note: ["Cédric is a small AI running on your device. He can be wrong. ", "Leon's CV", " is the source of truth."],
    },
    fr: {
      launcher: "Parler à Cédric", title: "Cédric", close: "Fermer le chat", pin: "Garder le chat ouvert",
      placeholder: "Dites quelque chose à Cédric…", send: "Envoyer", typing: "Cédric écrit",
      name: "Nom", email: "E-mail", message: "Message", submit: "Envoyer à Leon", sending: "Envoi…",
      fail: "L'envoi a échoué. Vous pouvez écrire à Leon directement : ", subject: "Chat Cédric : message de ",
      poke: "Cédric la crevette. Touchez-le.", peek: "Cédric bleu se cache ici. Cliquez dessus !",
      cv: "CV (PDF)",
      wake: "Réveiller", mb: "Mo", cancel: "Annuler", wakeFail: "Impossible de le réveiller sur cet appareil.",
      note: ["Cédric est une petite IA qui tourne sur votre appareil. Il peut se tromper : ", "le CV de Leon", " fait foi."],
    },
  }[lang];

  const FALLBACK_LINES = {
    greeting: "hi, I'm Cédric", wake: "!", poke: ["hi, I'm Cédric", "blub."],
    chat: {
      hello: "hi! I'm Cédric.",
      replies: ["I was sleeping… but you can send a message to Leon and he'll get back to you. I'll probably wake up if you keep talking, though."],
      after_sent: ["Leon has your message. Keep talking, I'm waking up."],
      waking: "waking up…",
      awake: "*yawn* ok, I'm awake. Ask me anything about Leon.",
      nudge: "zzz… press the Wake up button below.",
      no_brain: "zzz… I can't wake up on this device. The form above reaches Leon.",
      error: "zzz… I dozed off mid-sentence. Try again, or use the form to reach Leon.",
      sent: "Done! Leon has your message.",
    },
  };

  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // Head close-up for the launcher: a square around the eye and the whisker roots.
  function headViewBox() {
    const E = design.eye, a = design.pivots.ant;
    const ex = E.host.p[0] + E.dir[0] * E.u0, ey = E.host.p[1] + E.dir[1] * E.u0;
    const cx = (ex + a[0]) / 2, cy = (ey + a[1]) / 2, S = 400;
    return [cx - S * 0.62, cy - S * 0.5, S, S].map(Math.round).join(" ");
  }

  function start(all) {
    const lines = Object.assign({}, FALLBACK_LINES, all && all[lang]);
    lines.chat = Object.assign({}, FALLBACK_LINES.chat, lines.chat);

    // ---- home-page Cédric ----------------------------------------------------
    // Once Blue has been found, his pokes here are special: the 4th hints, the 5th
    // invites you on a trip to the ocean behind the page (ocean.js, loaded on demand).
    const home = document.querySelector("[data-cedric-home]");
    let homeC = null, bluePokes = 0, invite = null;
    const blueHome = lines.blue_home || ["blub."];
    const loadOcean = () => window.CedricOcean ? Promise.resolve() : new Promise((ok, fail) => {
      const sc = document.createElement("script");
      sc.src = BASE + "ocean.js";
      sc.onload = ok;
      sc.onerror = fail;
      document.head.appendChild(sc);
    });
    function onHomePoke() {
      if (document.documentElement.dataset.cedric !== "blue") return false;   // normal coral pokes
      homeC.flick();
      if (invite) return true;
      bluePokes++;
      if (bluePokes % 5 !== 0) { homeC.say(blueHome[(bluePokes - 1) % 5 % blueHome.length]); return true; }
      loadOcean().catch(() => {});
      homeC.root.classList.add("is-inviting");
      invite = h("button", "ctrip", lines.trip || "Take a trip with me?");
      invite.type = "button";
      homeC.root.appendChild(invite);
      invite.addEventListener("click", () => {
        loadOcean().then(() => {
          if (wrap.dataset.state !== "closed") shut();
          invite.remove();
          invite = null;
          homeC.root.classList.remove("is-inviting");
          window.CedricOcean.open({
            home: homeC, lang, ocean: all && all.ocean, back: lines.back || "← Back to homepage",
            onClosed: () => { bluePokes = 0; homeC.root.querySelector(".cedric__btn").focus(); },
          });
        });
      });
      return true;
    }
    if (home) homeC = Cedric.mount({ design, target: home, fixed: false, lines, label: UI.poke, onPoke: onHomePoke });

    // ---- launcher + panel ----------------------------------------------------
    const wrap = h("div", "cchat");
    wrap.dataset.state = "closed";
    const launcher = h("button", "cchat__launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "cchat-panel");
    const face = h("span", "cchat__face");
    face.setAttribute("aria-hidden", "true");
    launcher.append(face, h("span", "cchat__label", UI.launcher));

    const panel = h("section", "cchat__panel");
    panel.id = "cchat-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", UI.launcher);
    const head = h("header", "cchat__head");
    const close = h("button", "cchat__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", UI.close);
    // Pin: when on, clicking outside the panel doesn't minimise it. Remembered in localStorage.
    let pinned = false;
    try { pinned = localStorage.getItem("cedric:pinned") === "1"; } catch (e) {}
    const pin = h("button", "cchat__pin");
    pin.type = "button";
    pin.title = UI.pin;
    pin.setAttribute("aria-label", UI.pin);
    pin.setAttribute("aria-pressed", String(pinned));
    pin.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 2h5M6.5 2v4L4.5 9h7l-2-3V2M8 9v5"/></svg>';
    pin.addEventListener("click", () => {
      pinned = !pinned;
      pin.setAttribute("aria-pressed", String(pinned));
      try { localStorage.setItem("cedric:pinned", pinned ? "1" : "0"); } catch (e) {}
    });
    head.append(h("span", "cchat__title", UI.title), h("span", "cchat__ref", "LG-03"), pin, close);
    const hero = h("div", "cchat__hero");
    const log = h("ol", "cchat__log");
    log.setAttribute("aria-live", "polite");
    const input = h("form", "cchat__input");
    const ta = h("textarea");
    ta.rows = 1;
    ta.placeholder = UI.placeholder;
    ta.setAttribute("aria-label", UI.placeholder);
    const sendBtn = h("button", "cchat__send", UI.send);
    sendBtn.type = "submit";
    input.append(ta, sendBtn);
    const note = h("p", "cchat__note");   // permanent small print once the Wake up button shows
    note.hidden = true;
    const cvLink = h("a", null, UI.note[1]);
    cvLink.href = ROOT + (lang === "fr" ? "cv-fr.pdf" : "cv.pdf");
    cvLink.target = "_blank";
    cvLink.rel = "noopener";
    note.append(UI.note[0], cvLink, UI.note[2]);
    panel.append(head, hero, log, note, input);
    wrap.append(launcher, panel);
    document.body.appendChild(wrap);

    const faceC = Cedric.mount({ design, target: face, fixed: false, interactive: false,
                   viewBox: LAUNCHER_VIEW === "head" ? headViewBox() : undefined });
    let big = null;

    // ---- open / close --------------------------------------------------------
    function open() {
      panel.hidden = false;
      wrap.dataset.state = history.length ? "talking" : "open";
      launcher.setAttribute("aria-expanded", "true");
      if (!big) {
        big = Cedric.mount({ design, target: hero, fixed: false, lines, label: UI.poke });
        setTimeout(() => big.say(lines.chat.hello), 1300);
      }
      ta.focus();
    }
    function shut(noFocus) {
      panel.hidden = true;
      wrap.dataset.state = "closed";
      launcher.setAttribute("aria-expanded", "false");
      if (noFocus !== true) launcher.focus();
    }
    launcher.addEventListener("click", open);
    close.addEventListener("click", () => shut());
    // Click / tap outside the open panel minimises it (unless pinned). Not the secrets: Blue Cédric, swimmers, ocean.
    document.addEventListener("pointerdown", e => {
      if (pinned || wrap.dataset.state === "closed" || wrap.contains(e.target)) return;
      if (e.target.closest && e.target.closest(".cpeek,.cswim,.cocean,.ctrip")) return;
      shut(true);   // no focus theft: only × / Escape return focus to the launcher
    });
    panel.addEventListener("keydown", e => { if (e.key === "Escape") shut(); });

    // ---- chatting ------------------------------------------------------------
    const history = [];
    let replyN = 0, afterN = 0, sent = false, busy = false;
    const keep = { name: "", email: "" };

    function scrollDown() { log.scrollTop = log.scrollHeight; }
    function addMsg(who, text) {
      const li = h("li", "cchat__msg cchat__msg--" + who);
      if (text != null) li.appendChild(h("p", null, text));
      log.appendChild(li);
      scrollDown();
      return li;
    }

    ta.addEventListener("input", () => {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 110) + "px";
    });
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); input.requestSubmit(); }
    });
    input.addEventListener("submit", e => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text || busy) return;
      ta.value = "";
      ta.style.height = "auto";
      history.push(text);
      turns.push({ role: "user", content: text });
      loadShorts();
      wrap.dataset.state = "talking";
      addMsg("you", text);
      reply();
    });

    // The brain: an LLM in a worker (brain.js). Nothing LLM-related loads before the first reply.
    // Everything the model says is rendered with textContent only, and its action tokens
    // can only show the form or build links from the fixed whitelist (see renderActions).
    // Flow: first reply -> offerWake() swaps the text box for a "Wake up (~N MB)" button ->
    // click = progress bar + Cancel -> at 100% the text box comes back and the LLM answers.
    const turns = [];   // {role, content} for the model
    let brain = null, awake = false, brainDead = !navigator.gpu, offered = false, runId = 0;
    const bar = h("div", "cchat__wakebar");   // takes the place of the text box while waking
    const loadBrain = () => brain ? Promise.resolve(brain) : import(BASE + "brain.js").then(m => (brain = m));
    const show = el => { const other = el === input ? bar : input; if (other.isConnected) other.replaceWith(el); };

    async function offerWake() {
      if (brainDead || offered) return;
      offered = true;
      let info = null;
      try { info = await (await loadBrain()).prepare(); } catch (e) { console.warn("Cédric: brain unavailable", e); }
      if (!info) { brainDead = true; return; }   // no WebGPU / no model: the text box stays, replies are sleepy
      note.hidden = false;
      showOffer(info);
    }

    function showOffer(info) {
      const label = UI.wake + (info.mb ? " (≈" + info.mb + " " + UI.mb + ")" : "");
      const b = h("button", "cchat__wakebtn", label);
      b.type = "button";
      b.addEventListener("click", () => wake(info));
      bar.replaceChildren(b);
      show(bar);
      if (!panel.hidden) b.focus();
    }

    function wake(info) {
      const id = ++runId;
      const track = h("div", "cchat__progress"), fill = h("span", "cchat__fill"), txt = h("span", "cchat__ptext", lines.chat.waking);
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", lines.chat.waking);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", "0");
      track.append(fill, txt);
      const cancel = h("button", "cchat__cancel", UI.cancel);
      cancel.type = "button";
      bar.replaceChildren(track, cancel);
      cancel.focus();
      const set = f => {
        const p = Math.min(100, Math.max(0, Math.floor(f * 100)));
        fill.style.width = p + "%";
        track.setAttribute("aria-valuenow", p);
        txt.textContent = lines.chat.waking + " " + p + "%";
      };
      cancel.addEventListener("click", () => { runId++; brain.cancel(); showOffer(info); });   // stops the download
      loadBrain().then(b => b.start({ root: ROOT, lang, onProgress: set })).then(() => {
        if (id !== runId) return;
        awake = true;
        show(input);
        if (!panel.hidden) ta.focus();
        addMsg("cedric", lines.chat.awake);
        if (big) big.flick();
      }).catch(e => {
        if (id !== runId || (e && e.cancelled)) return;
        brainDead = true;
        console.warn("Cédric: could not wake up", e);
        const err = h("p", "cchat__wakeerr", UI.wakeFail);
        err.setAttribute("role", "status");
        bar.replaceChildren(err);
        setTimeout(() => show(input), 3500);
      });
    }

    function typingBubble() {
      const typing = addMsg("cedric");
      typing.classList.add("is-typing");
      typing.setAttribute("aria-label", UI.typing);
      for (let i = 0; i < 3; i++) typing.appendChild(document.createElement("span"));
      return typing;
    }
    function done() { if (big) big.flick(); busy = false; scrollDown(); }

    function reply() {
      busy = true;
      const typing = typingBubble();
      const delay = 900 + Math.random() * 700;
      if (history.length === 1) {   // first message: he's asleep. Form now, model loads meanwhile.
        setTimeout(() => {
          typing.remove();
          const C = lines.chat;
          const text = sent ? C.after_sent[afterN++ % C.after_sent.length] : C.replies[replyN++ % C.replies.length];
          const li = addMsg("cedric", text);
          if (!sent) li.appendChild(makeForm());
          turns.push({ role: "assistant", content: text });
          done();
          offerWake();
        }, delay);
      } else if (awake) {
        think(typing);
      } else {   // no model on this device / failed (sleepy line + form), or the Wake up button is still being prepared
        setTimeout(() => fallback(typing, brainDead ? "no_brain" : "nudge"), delay);
      }
    }

    // Sleepy fallback (no WebGPU / load failed). Makes sure a form is there.
    function fallback(typing, key) {
      typing.remove();
      const li = addMsg("cedric", lines.chat[key || "no_brain"]);
      if (key !== "nudge" && !sent && !log.querySelector(".cchat__form")) li.appendChild(makeForm());
      done();
    }

    async function think(typing) {
      let li = null, p = null;
      const bubble = () => { if (!li) { typing.remove(); li = addMsg("cedric", ""); p = li.firstChild; } };
      try {
        const out = await brain.ask(turns, raw => {
          const r = brain.parse(raw, false);
          if (!r.text) return;   // still only a half-written token
          bubble();
          p.textContent = r.text;
          scrollDown();
        });
        const r = brain.parse(out, true);
        if (!r.text && !r.actions.length) throw new Error("empty answer");
        bubble();
        if (r.text) p.textContent = r.text; else p.remove();
        turns.push({ role: "assistant", content: out });
        renderActions(li, r.actions);
      } catch (e) {
        console.warn("Cédric: no answer", e);
        if (!li) return fallback(typing, "error");
      }
      done();
    }

    // Action tokens -> UI. The model never supplies a URL: links are built here from the
    // projects.json slugs (brain.projectShort knows them) and the two CV files. [[form]] only
    // appends the existing form; filling or sending it stays with the visitor.
    function renderActions(li, actions) {
      const box = h("div", "cchat__actions");
      const link = (href, label, blank) => {
        const a = h("a", "cchat__btn", label);
        a.href = href;
        if (blank) { a.target = "_blank"; a.rel = "noopener"; }
        box.appendChild(a);
      };
      let wantForm = false;
      for (const a of actions) {
        if (a.kind === "form") wantForm = true;
        else if (a.kind === "project") {
          const short = brain.projectShort(a.arg);
          if (short) link(ROOT + (lang === "fr" ? "fr/projects/" : "projects/") + encodeURIComponent(a.arg) + ".html", short);
        } else if (a.kind === "cv" && (a.arg === "" || a.arg === "en" || a.arg === "fr")) {
          const l = a.arg || lang;
          link(ROOT + (l === "fr" ? "cv-fr.pdf" : "cv.pdf"), UI.cv + (a.arg ? " · " + a.arg.toUpperCase() : ""), true);
        }
      }
      if (box.children.length) li.appendChild(box);
      if (wantForm && !sent) li.appendChild(makeForm(history[history.length - 1]));
    }

    // Tidy the visitor's text for the form's message field (deterministic, no spelling fixes):
    // capital letters, "I", proper nouns, a "?" after an unfinished question. The chat log is untouched.
    let shorts = null;   // project short names, fetched once (first message)
    function loadShorts() {
      if (shorts) return;
      shorts = [];
      fetch(ROOT + "projects/projects.json").then(r => r.json())
        .then(l => { shorts = l.map(p => p && p.short).filter(s => s && s.length >= 3); }).catch(() => {});
    }
    const QW = {
      en: "who|what|when|where|why|how|is|are|do|does|did|can|could|would|will|should|which",
      fr: "qui|que|quoi|quand|où|pourquoi|comment|est-ce|quel|quelle|quels|quelles|combien",
    };
    function tidy(raw) {
      const names = ["Leon", "Cédric", "Górecki", "Centrale Nantes", ...(shorts || [])], canon = new Map();
      names.forEach(n => canon.set(n.toLowerCase(), n));
      canon.set("cedric", "Cédric"); canon.set("gorecki", "Górecki");
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const proper = new RegExp("(?<![\\p{L}\\p{N}])(" + [...canon.keys()].sort((a, b) => b.length - a.length).map(esc).join("|") + ")(?![\\p{L}\\p{N}])", "giu");
      const qre = new RegExp("^(?:(?:" + QW[lang] + ")(?![\\p{L}\\p{N}-])|[\\p{L}]+-(?:vous|tu|il|elle|on|ils|elles|je|nous)(?![\\p{L}\\p{N}]))", "iu");
      return String(raw).split("\n").map(line => {
        line = line.replace(/[ \t]+/g, " ").trim();
        return line.split(/(?<=[.!?…])\s+/).map(sen => {
          if (qre.test(sen) && !/[.!?…]$/.test(sen)) sen += (lang === "fr" ? "\u00a0?" : "?");
          if (lang === "en") sen = sen.replace(/(?<![\p{L}\p{N}'’-])i(?=(?:['’](?:m|ve|ll|d))?(?![\p{L}\p{N}]))/gu, "I");
          sen = sen.replace(proper, m => canon.get(m.toLowerCase()) || m);
          return sen.replace(/^(\P{L}*)(\p{L})/u, (m, a, b) => a + b.toUpperCase());
        }).join(" ");
      }).join("\n").trim();
    }

    // The message form. Only the newest one stays; name/email carry over.
    // `text` = what to prefill (default: everything the visitor typed so far).
    function makeForm(text) {
      log.querySelectorAll(".cchat__form").forEach(f => f.remove());
      const f = h("form", "cchat__form");
      f.noValidate = false;
      const field = (label, el) => { const l = h("label", "cchat__field"); l.append(h("span", null, label), el); return l; };
      const name = h("input"); name.name = "name"; name.required = true; name.autocomplete = "name"; name.value = keep.name;
      const email = h("input"); email.name = "email"; email.type = "email"; email.required = true; email.autocomplete = "email"; email.value = keep.email;
      const msg = h("textarea"); msg.name = "message"; msg.required = true; msg.rows = 3; msg.value = tidy(text != null ? text : history.join("\n\n"));
      name.oninput = () => { keep.name = name.value; };
      email.oninput = () => { keep.email = email.value; };
      const trap = h("input"); trap.name = "_gotcha"; trap.tabIndex = -1; trap.autocomplete = "off"; trap.className = "cchat__trap";
      const btn = h("button", "cchat__submit", UI.submit); btn.type = "submit";
      const status = h("p", "cchat__status");
      status.setAttribute("role", "status");
      f.append(field(UI.name, name), field(UI.email, email), field(UI.message, msg), trap, btn, status);
      f.addEventListener("submit", e => {
        e.preventDefault();
        const data = new FormData(f);
        data.append("_subject", UI.subject + (name.value || "?"));
        data.append("page", location.href);
        data.append("via", "Cédric chat (" + lang + ")");
        btn.disabled = true;
        btn.textContent = UI.sending;
        status.textContent = "";
        fetch(FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
          .then(r => { if (!r.ok) throw new Error(r.status); })
          .then(() => {
            sent = true;
            f.replaceWith(h("p", "cchat__sent", lines.chat.sent));
            if (big) { big.flick(); big.say("♥"); }
            scrollDown();
          })
          .catch(() => {
            btn.disabled = false;
            btn.textContent = UI.submit;
            status.textContent = UI.fail;
            const a = h("a", null, FALLBACK_EMAIL);
            a.href = "mailto:" + FALLBACK_EMAIL;
            status.appendChild(a);
          });
      });
      return f;
    }

    // ---- Blue Cedric: hide-and-seek ------------------------------------------
    // Every day the original (blue) Cedric peeks out from a corner of a card on one
    // project page. Clicking him: he swims into the corner square and the coral Cedric
    // swims out. Blue then stays on every page for this tab, until midnight.
    const KEY = "cedric:blue";
    const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
    const hash = str => { let x = 2166136261; for (const c of str) { x ^= c.codePointAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
    const isFound = () => { try { return sessionStorage.getItem(KEY) === today(); } catch (e) { return false; } };
    const blue = on => { if (on) document.documentElement.dataset.cedric = "blue"; else delete document.documentElement.dataset.cedric; };
    blue(isFound());

    let peek = null;
    function unpeek() { if (peek) { peek.cedric.destroy(); peek.box.remove(); peek = null; } }

    function placePeek() {
      if (isFound()) return;
      const m = location.pathname.match(/\/projects\/([^/]+)\.html$/);
      if (!m || m[1] === "index" || m[1].charAt(0) === "_") return;
      fetch(ROOT + "projects/projects.json").then(r => r.json()).then(list => {
        const day = today(), slugs = list.map(p => p.slug).filter(Boolean).sort();
        if (slugs[hash(day) % slugs.length] !== m[1]) return;
        // Only the big section cards: there's a gap above them to peek over.
        let cards = [...document.querySelectorAll(".card")].filter(c => c.offsetWidth >= 300 && !c.parentElement.closest(".card"));
        if (!cards.length) cards = [...document.querySelectorAll(".hp-card")];
        if (!cards.length) return;
        const card = cards[hash(day + "/card") % cards.length];
        const side = hash(day + "/corner") % 2 ? "right" : "left";
        if (getComputedStyle(card).position === "static") card.style.position = "relative";
        const box = h("button", "cpeek cpeek--" + side);
        box.type = "button";
        box.setAttribute("aria-label", UI.peek);
        card.appendChild(box);
        const mirror = h("span", "cpeek__m");   // faces out of whichever corner he's in
        box.appendChild(mirror);
        const c = Cedric.mount({ design, target: mirror, fixed: false, interactive: false, draw: false });
        c.root.classList.add("cedric--blue");
        peek = { box, cedric: c, side };
        box.addEventListener("click", swim);
      }).catch(e => console.warn("Cedric: hide-and-seek skipped", e));
    }

    // Points along a cubic Bézier, with heading, for keyframes.
    function path(P0, P1, P2, P3, n) {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        const x = u*u*u*P0[0] + 3*u*u*t*P1[0] + 3*u*t*t*P2[0] + t*t*t*P3[0];
        const y = u*u*u*P0[1] + 3*u*u*t*P1[1] + 3*u*t*t*P2[1] + t*t*t*P3[1];
        const dx = 3*u*u*(P1[0]-P0[0]) + 6*u*t*(P2[0]-P1[0]) + 3*t*t*(P3[0]-P2[0]);
        const dy = 3*u*u*(P1[1]-P0[1]) + 6*u*t*(P2[1]-P1[1]) + 3*t*t*(P3[1]-P2[1]);
        out.push({ t, x, y, a: Math.atan2(dy, dx) * 180 / Math.PI });
      }
      return out;
    }
    // One keyframe. He never rotates with the path: he stays upright and only leans
    // (r, degrees, + = clockwise) the way you lean forward on a motorbike. sx is his
    // horizontal scale: negative = facing left; passing through 0 reads as turning around.
    const kf = (x, y, r, sx, s, offset) => ({
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${s.toFixed(3)})`,
      offset: Math.min(1, offset),
    });
    const LEAN = 11;
    const ramp = u => Math.min(1, u * 3.5) * Math.min(1, (1 - u) * 3.5);   // lean in, hold, ease off

    function swimmer(W, cls) {
      const el = h("div", "cswim " + (cls || ""));
      el.style.width = W + "px";
      el.style.marginLeft = -W / 2 + "px";
      el.style.marginTop = -W * 0.36 + "px";
      document.body.appendChild(el);
      const c = Cedric.mount({ design, target: el, fixed: false, interactive: false, draw: false });
      c.root.classList.add("is-swimming");
      return { el, c };
    }

    function found() {
      try { sessionStorage.setItem(KEY, today()); } catch (e) {}
      blue(true);
      face.style.visibility = "";
      faceC.draw();
    }

    function swim() {
      if (!peek) return;
      if (wrap.dataset.state !== "closed") shut();
      const r = peek.cedric.svg.getBoundingClientRect(), side = peek.side;
      unpeek();
      if (still()) { found(); return; }

      const W = r.width, lr = launcher.getBoundingClientRect(), fr = face.getBoundingClientRect();
      const endW = fr.width * 0.9;
      const S = [r.left + W / 2, r.top + r.height / 2];
      const E = [lr.left + lr.width / 2, fr.top + fr.height / 2];     // the face, inside the square
      const U = [lr.left - endW * 0.9, E[1]];                          // just left of it, level with the face
      const d1 = Math.min(2600, Math.max(1500, Math.hypot(U[0] - S[0], U[1] - S[1]) * 1.6));

      // 1. Blue: face left, swim a bit left and down, turn around, then swim right and
      //    down to just left of the square, arriving level with it.
      const b = swimmer(W, "cswim--blue");
      b.c.root.classList.add("cedric--blue");
      const f0 = side === "left" ? -1 : 1, s1 = endW / W, sA = 1 + (s1 - 1) * 0.25;
      const A = [Math.max(S[0] - 130, W * 0.6), S[1] + 90];   // stays on screen
      const tTurn0 = f0 === 1 ? 260 : 0, tA = 750, tTurn = 300;
      const total = tTurn0 + tA + tTurn + d1;
      const ks = [kf(S[0], S[1], 0, f0, 1, 0)];
      let t = tTurn0;
      if (tTurn0) ks.push(kf(S[0], S[1], 0, -1, 1, t / total));
      for (let i = 1; i <= 10; i++) {                       // left and down, leaning (facing left: nose down = anticlockwise)
        const u = i / 10, e = 1 - (1 - u) * (1 - u);
        ks.push(kf(S[0] + (A[0] - S[0]) * e, S[1] + (A[1] - S[1]) * e, -LEAN * ramp(u), -(1 + (sA - 1) * u), 1 + (sA - 1) * u, (t + u * tA) / total));
      }
      t += tA + tTurn;
      ks.push(kf(A[0], A[1], 0, sA, sA, t / total));       // turned around, now facing right
      const curve = path(A, [A[0] + 160, A[1] + 20], [U[0] - 260, U[1]], U, 1000);
      for (let i = 1; i <= 24; i++) {                       // right and down to the square, leaning (nose down = clockwise)
        const u = i / 24, e = u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
        const p = curve[Math.round(e * 1000)];
        const sc = sA + (s1 - sA) * u;
        ks.push(kf(p.x, p.y, LEAN * Math.min(1, u * 3.5) * (1 - 0.6 * u * u), sc, sc, (t + u * d1) / total));
      }
      b.el.animate(ks, { duration: total, easing: "linear", fill: "forwards" })
        .finished.then(() => {
          // 2. He slides in from the left, beneath the square (z-index below it), levelling out...
          const l2 = [];
          for (let i = 0; i <= 10; i++) {
            const u = i / 10, e = u * u * (3 - 2 * u);
            l2.push(kf(U[0] + (E[0] - U[0]) * e, U[1] + (E[1] - U[1]) * e, LEAN * 0.4 * (1 - u), s1, s1, u));
          }
          b.el.animate(l2, { duration: 800, easing: "linear", fill: "forwards" })
            .finished.then(() => { b.c.destroy(); b.el.remove(); found(); });

          // ...while Coral leaves out the right side, above everything (z-index over it).
          face.style.visibility = "hidden";
          const cw = fr.width, C0 = [fr.left + cw / 2, fr.top + fr.height / 2];
          const k = swimmer(cw, "cswim--coral");
          k.c.root.classList.add("cedric--coral");
          const out = [];
          for (let i = 0; i <= 16; i++) {
            const u = i / 16, e = u * u;                       // speeds up as he leaves
            out.push(kf(C0[0] + (innerWidth + cw * 1.5 - C0[0]) * e, C0[1] - Math.sin(u * Math.PI) * 10, LEAN * Math.min(1, u * 4), 1, 1, u));
          }
          k.el.animate(out, { duration: 1100, easing: "linear", fill: "forwards" })
            .finished.then(() => { k.c.destroy(); k.el.remove(); });
        });
    }

    // Midnight: Blue goes back into hiding, somewhere new.
    (function midnight() {
      const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setTimeout(() => {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        blue(false);
        unpeek();
        placePeek();
        midnight();
      }, next - now + 1000);
    })();
    placePeek();
  }

  fetch(BASE + "lines.json").then(r => r.json()).then(start, () => start(null));
})();
