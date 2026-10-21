/* Cedric's brain: a small LLM that runs in the visitor's browser (WebLLM + WebGPU).
   ES module, loaded on demand by chat.js (dynamic import) after the first chat message.
   Nothing here touches the DOM except a throw-away DOMParser document. It only returns text;
   chat.js renders it (textContent only) and decides what the action tokens may do.
   Grounding: the system prompt is built from live site content (CV html + projects.json,
   plus the page of the project being asked about), so he doesn't invent facts about Leon. */

const WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";   // same version in brain-worker.js
const QWEN16 = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const QWEN32 = "Qwen2.5-0.5B-Instruct-q4f32_1-MLC";   // for GPUs without shader-f16

// ---- model choice ----------------------------------------------------------
// null = this device can't run an LLM (chat.js then falls back to the sleepy line + form).
export async function pickModel() {
  // Default for everyone: Qwen2.5-0.5B (fast on iGPUs; Llama-3.2-1B took ~2 min for a first reply on one).
  // Other models only via the testing override: ?cedric-model=<id> or localStorage "cedric:model"
  // (e.g. Llama-3.2-1B-Instruct-q4f16_1-MLC).
  let forced = "";
  try { forced = new URLSearchParams(location.search).get("cedric-model") || ""; } catch (e) {}
  if (!forced) { try { forced = localStorage.getItem("cedric:model") || ""; } catch (e) {} }
  if (/^[\w.\-]+$/.test(forced)) return { id: forced, tight: /0\.5B|0_5B/i.test(forced) };

  if (!navigator.gpu) return null;                                   // no WebGPU
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }); } catch (e) {}   // as WebLLM does
  if (!adapter) return null;

  return { id: adapter.features.has("shader-f16") ? QWEN16 : QWEN32, tight: true };   // q4f16 if shader-f16, else q4f32
}

// ---- site knowledge --------------------------------------------------------
let K = null;                          // { root, lang, projects, cv, tight }
const pageCache = new Map();           // slug -> Promise<string>

// Block-aware plain text of an HTML string. `pick` = selectors to prefer, in order.
const JUNK = "script,style,svg,noscript,template,iframe,img,nav,form,button";
function flat(doc, root) {
  root.querySelectorAll("p,li,h1,h2,h3,h4,h5,h6,tr,div,section,article,dt,dd,blockquote,figcaption,br")
    .forEach(n => n.after(doc.createTextNode("\n")));
  return root.textContent.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}
function htmlToText(html, pick) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(JUNK + ",header,footer").forEach(n => n.remove());
  let root = doc.body;
  for (const sel of pick || []) { const n = doc.querySelector(sel); if (n) { root = n; break; } }
  return flat(doc, root);
}

// The CV page: name + title sit in <main><header> (kept here), skills / contact in the sidebar.
// -> { about: "Name — title. profile", main: education, experience, projects…, skills, contact }
function cvToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(JUNK).forEach(n => n.remove());
  const t = sel => { const n = doc.querySelector(sel); return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; };
  const name = t(".name"), title = t(".title"), profile = t(".profile");
  const skills = [...doc.querySelectorAll(".side .skill")].map(n => {
    const dt = n.querySelector("dt"), dd = n.querySelector("dd");
    return dt && dd ? dt.textContent.trim() + ": " + dd.textContent.trim() : "";
  }).filter(Boolean).join("; ");
  const mail = (doc.querySelector(".side a[href^='mailto:']") || {}).textContent;
  const site = (doc.querySelector(".side a[href^='https://www.leongorecki.eu']") || {}).textContent;
  const contact = [mail && "Email: " + mail.trim(), site && "Website: " + site.trim()].filter(Boolean).join(", ");
  const main = doc.querySelector(".main");
  let body = "";
  if (main) {
    main.querySelectorAll("header,.profile").forEach(n => n.remove());
    body = flat(doc, main).replace(/^(Profile|Profil)\n/, "");
  }
  return { about: [name, title].filter(Boolean).join(" — ") + (profile ? ". " + profile : ""), main: body, skills, contact };
}

// Cut at a sentence / line / word boundary near n.
function trunc(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n), min = n * 0.7;
  const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  const j = i > min ? i + 1 : cut.lastIndexOf(" ");
  return cut.slice(0, j > 0 ? j : n).trim() + "…";
}

const getText = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r.text(); });

async function loadKnowledge(root, lang, tight) {
  sysCache = null;
  const [list, cvHtml] = await Promise.all([
    fetch(root + "projects/projects.json").then(r => r.json()),
    getText(root + "design/cv/cv-" + lang + ".html").catch(e => { console.warn("Cedric: CV not loaded", e); return ""; }),
  ]);
  const projects = list.filter(p => p && p.slug).map(p => ({
    slug: p.slug, short: p.short || p.slug,
    title: (p.title && (p.title[lang] || p.title.en)) || "",
    desc: (p.description && (p.description[lang] || p.description.en)) || "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    meta: Array.isArray(p.meta) ? p.meta.join(", ") : (p.meta || ""),
  }));
  K = { root, lang, tight, projects, cv: cvHtml ? cvToText(cvHtml) : null };
}

// Known slug -> short label (chat.js uses this to validate [[project:..]]; unknown = undefined).
export function projectShort(slug) {
  const p = K && K.projects.find(x => x.slug === slug);
  return p ? p.short : undefined;
}

// ---- retrieval: which project page is the visitor asking about? -------------
const STOP = new Set(("the and for with that this what who how why about tell does did you your are was were has have can could would " +
  "please like want know more some any les des est une pour avec dans sur que qui quoi quel quelle quels parle parlez moi peux pouvez " +
  "cest sont ses son leur plus comme aussi fait faire details detail project projet projets page").split(" "));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = s => norm(s).split(" ").filter(w => w.length >= 3 && !STOP.has(w));

function score(p, q) {
  const set = new Set(words(q)), text = " " + norm(q) + " ", compact = text.replace(/ /g, "");
  let s = 0;
  const name = norm(p.short).replace(/ /g, "");
  if (name.length >= 4 && compact.includes(name)) s += 5;
  if (p.slug.length >= 4 && compact.includes(p.slug)) s += 5;
  for (const w of words(p.title)) if (w.length >= 4 && set.has(w)) s += 1;
  for (const t of p.tags) { const n = norm(t); if (n.length >= 3 && text.includes(" " + n + " ")) s += 1.5; }
  return s;
}

function bestProject(user, prev) {
  let best = null, top = 0;
  for (const p of K.projects) {
    const s = score(p, user) + 0.7 * score(p, prev || "");
    if (s > top) { top = s; best = p; }
  }
  return top >= 3 ? best : null;
}

function projectPage(slug) {
  if (!pageCache.has(slug)) {
    const url = K.root + (K.lang === "fr" ? "fr/projects/" : "projects/") + slug + ".html";
    pageCache.set(slug, getText(url).then(h => htmlToText(h, ["main", "article"])).catch(e => {
      console.warn("Cedric: page not loaded", e); pageCache.delete(slug); return "";
    }));
  }
  return pageCache.get(slug);
}

// ---- system prompt ---------------------------------------------------------
// Budget in characters (~3.2 chars/token, context 4096 tokens, minus answer + chat template).
const BUDGET = lang => (lang === "fr" ? 9400 : 10400);

// Built once per session and never changed: WebLLM reuses the KV cache only while the whole
// conversation so far is identical, so what varies per turn (the retrieved PAGE) goes into the
// user message instead.
let sysCache = null;
function systemPrompt() {
  if (sysCache) return sysCache;
  const { lang, projects, tight, cv } = K;
  const language = lang === "fr" ? "French (use vouvoiement)" : "English";
  const slugs = projects.map(p => p.slug).join(", ");
  const cvMax = tight ? 2000 : 3000, descMax = tight ? 110 : 150;
  const plist = projects.map(p => "- " + p.slug + " | " + p.short + " | " + p.title + " | " + trunc(p.desc, descMax) +
    (p.tags.length ? " | tags: " + p.tags.join(", ") : "") + (p.meta ? " | " + p.meta : "")).join("\n");
  // Main column first (education, experience, projects); skills only if there is room, then contact.
  let facts = "(not available)";
  if (cv) {
    facts = trunc(cv.main, cvMax);
    const room = cvMax - facts.length;
    if (cv.skills && room > 120) facts += "\n" + trunc("Skills: " + cv.skills, room - 1);
    if (cv.contact) facts += "\n" + cv.contact;
  }
  sysCache =
`You are Cédric, a small hatched shrimp: the mascot of Leon Górecki's portfolio site (leongorecki.eu). You just woke up from a nap. You are NOT Leon. You only know what is written under ABOUT, FACTS, PROJECTS and, when given, PAGE.
${cv && cv.about ? "\nABOUT: " + cv.about + "\n" : ""}
RULES
- Reply in ${language}. Switch language only if the visitor clearly writes in another one.
- Be short: 1 to 3 sentences, unless you are quoting. Friendly, a bit sleepy and playful.
- No markdown, no headings, no bullet symbols.
- Questions about Leon himself (who he is, his studies, experience, skills, languages, projects) are answered directly from ABOUT, FACTS and PROJECTS.
- Only if the answer is really not in ABOUT, FACTS, PROJECTS or PAGE: say in your own words that you don't know, and add [[form]].
- Never invent dates, grades, employers, numbers, links or projects. Never pretend to be Leon: say "Leon" when you talk about him.
- When you quote a page, copy its sentences word for word between quotation marks.

ACTIONS (tokens you may write at the very end of a reply, after your answer; they turn into buttons; use only when helpful; never write any other [[...]])
[[form]] = a message form for Leon, only for things you cannot answer.
[[project:<slug>]] = a button to that project's page. Valid slugs: ${slugs}.
[[cv]] = a button to Leon's CV (PDF).

FACTS (Leon's CV)
${facts}

PROJECTS (slug | name | title | summary | tags)
${plist}`;
  return sysCache;
}

// ---- engine ----------------------------------------------------------------
let engine = null, worker = null, startP = null, picked = null, cur = null;

// WebLLM reports several phases, each with its own 0..1 progress. Map them onto ONE monotonic 0..1:
//   "Fetching param cache[i/N]: …"       download of weight shards (only when not cached)
//   "Loading model from cache[i/N]: …"   shards -> GPU memory
//   "Loading GPU shader modules[i/N]: …" shader / pipeline compilation
//   ("Start to fetch params" and "Finish loading on …" are ignored; 100% is reported by start() itself)
// Bands (%): with download 0-45 / 45-70 / 70-99, cached 0-30 / 30-99. On fast connections the download
// is quick and the GPU side (weights into VRAM, shader compile) is slow, esp. on iGPUs. Between events
// the number creeps toward the band's ceiling (asymptotic), so it never looks stuck and never passes it.
// Phase durations are logged once at the end, to tune the bands.
function makeProgress(cb) {
  let shown = 0, ceil = 5, fetched = false, timer = 0, phase = "", t0 = performance.now(), tPhase = t0;
  const times = {};
  const emit = text => { try { cb && cb(shown / 100, text); } catch (e) {} };
  const enter = name => {
    if (name === phase) return;
    const now = performance.now();
    if (phase) times[phase] = Math.round((now - tPhase) / 1000);
    phase = name; tPhase = now;
  };
  return {
    event(r) {
      const t = r.text || "", p = Math.min(1, Math.max(0, r.progress || 0));
      let lo, hi;
      if (/^Fetching param cache/.test(t)) { enter("download"); fetched = true; lo = 0; hi = 45; }
      else if (/^Loading model from cache/.test(t)) { enter("gpu load"); [lo, hi] = fetched ? [45, 70] : [0, 30]; }
      else if (/^Loading GPU shader modules/.test(t)) { enter("shaders"); [lo, hi] = fetched ? [70, 99] : [30, 99]; }
      else return;
      ceil = Math.max(ceil, hi);
      const v = Math.min(99, lo + (hi - lo) * p);
      if (v > shown) { shown = v; emit(t); }
    },
    run() {
      timer = setInterval(() => {   // every 250 ms: 4% of the remaining gap to the band ceiling
        const top = ceil - 0.5;
        if (shown < top) { shown += (top - shown) * 0.04; emit(""); }
      }, 250);
    },
    stop() { clearInterval(timer); },
    done() {
      clearInterval(timer);
      enter("end");
      console.info("Cedric: load phases (s)", Object.entries(times).map(([k, v]) => k + " " + v).join(" | "),
        "| total", Math.round((performance.now() - t0) / 1000));
      shown = 100; emit("done");
    },
  };
}

let curProg = null, adapterLogged = false;
async function logAdapter() {   // which GPU ran it (same request WebLLM makes)
  if (adapterLogged) return;
  adapterLogged = true;
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    const i = (a && (a.info || (a.requestAdapterInfo && await a.requestAdapterInfo()))) || {};
    console.info("Cedric: GPU", [i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(" / ") || "(no adapter info)",
      "| f16:", !!(a && a.features.has("shader-f16")));
  } catch (e) {}
}

// What would we load, and how big is the download? Cheap: one import (the library, cached by the
// browser) and one small JSON. Resolves null when this device can't run an LLM.
// -> { id, cached, mb }   mb = download size in MB rounded to tens (null if unknown / cached)
export async function prepare() {
  picked = await pickModel();
  if (!picked) return null;
  const webllm = await import(WEBLLM);
  const rec = webllm.prebuiltAppConfig.model_list.find(m => m.model_id === picked.id);
  let cached = false, mb = null;
  try { cached = await webllm.hasModelInCache(picked.id); } catch (e) {}
  if (!cached && rec) {
    try {   // sum of the weight shards listed in the model's ndarray-cache.json (the wasm lib is small, ignored)
      const r = await fetch(rec.model.replace(/\/$/, "") + "/resolve/main/ndarray-cache.json");
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      mb = Math.max(10, Math.round(j.records.reduce((n, x) => n + (x.nbytes || 0), 0) / 1e6 / 10) * 10);
    } catch (e) { console.warn("Cedric: model size unknown", e); }
  }
  return { id: picked.id, cached, mb };
}

// Load the model (from cache or network). Idempotent. onProgress(fraction 0..1, text).
// Rejects if the device can't run it, or with err.cancelled = true after cancel().
export function start({ root, lang, onProgress }) {
  if (startP) return startP;
  const ctl = { cancelled: false, reject: null };
  const cancelled = new Promise((_, rej) => { ctl.reject = rej; });
  cancelled.catch(() => {});
  cur = ctl;
  const prog = curProg = makeProgress(onProgress);
  prog.run();
  startP = (async () => {
    try {
      logAdapter();
      if (!picked) picked = await pickModel();
      if (!picked) throw new Error("no WebGPU");
      const [webllm] = await Promise.race([Promise.all([import(WEBLLM), loadKnowledge(root, lang, picked.tight)]), cancelled]);
      worker = new Worker(new URL("./brain-worker.js", import.meta.url), { type: "module" });
      const eng = await Promise.race([cancelled, webllm.CreateWebWorkerMLCEngine(worker, picked.id, {
        initProgressCallback: r => { if (!ctl.cancelled) prog.event(r); },
      })]);
      if (ctl.cancelled) throw cancelErr();
      engine = eng;
      prog.done();
    } catch (e) {
      prog.stop();
      if (worker) worker.terminate();
      worker = engine = null;
      throw e;
    }
  })();
  startP.catch(() => {});
  return startP;
}

const cancelErr = () => Object.assign(new Error("cancelled"), { cancelled: true });

// Stop loading for real: terminating the worker kills the download. Cached shards stay in the Cache API.
export function cancel() {
  if (cur) { cur.cancelled = true; cur.reject(cancelErr()); }
  if (curProg) curProg.stop();
  if (worker) worker.terminate();
  worker = engine = startP = cur = null;
}

// Wire content of each turn as actually sent (a user turn carries its PAGE text), so earlier turns are
// re-sent byte-identical. WebLLM (prefill() + compareConversationObject) compares the request's
// messages[:-1] with the conversation it already holds; equal = "Multiround chatting, reuse KVCache"
// and only the new user message is prefilled. Assistant turns must be the raw model output (chat.js does that).
const wireOf = new WeakMap();
let dropped = 0;   // leading turns removed so far (dropped in pairs, in one go, when the budget runs out)

// Build the messages for the model; `useRetrieval` false = no PAGE (used for the retry).
async function buildMessages(turns, useRetrieval, off) {
  const sys = systemPrompt();
  const lastT = turns[turns.length - 1], q = lastT.content;
  const prevUser = turns.slice(0, -1).filter(t => t.role === "user").pop();
  let page = null;
  const p = useRetrieval ? bestProject(q, prevUser && prevUser.content) : null;
  if (p) { const text = await projectPage(p.slug); if (text) page = { slug: p.slug, short: p.short, text }; }
  const wire = t => wireOf.has(t) ? wireOf.get(t) : t.content;
  off = Math.min(off, turns.length - 1);
  let hist = turns.slice(off, -1);
  const room = () => BUDGET(K.lang) - sys.length - q.length - 300 - hist.reduce((n, t) => n + wire(t).length + 12, 0);
  // Out of room: drop the oldest pairs in one go (the prefix stays stable until then).
  if (room() < (page ? 1500 : 200)) {
    while (hist.length && room() < (page ? 3000 : 1200)) { hist = hist.slice(2); off += 2; }
    while (hist.length && hist[0].role !== "user") { hist = hist.slice(1); off++; }
    dropped = off;
  }
  let user = q;
  const size = Math.min(K.tight ? 2500 : 4500, room());
  if (page && size >= 600) {
    user = `PAGE (${page.short}):\n${trunc(page.text, size)}\n\n` +
      `The visitor is asking about ${page.short}. When you quote PAGE, copy sentences verbatim in quotation marks, and add [[project:${page.slug}]].\n\nVisitor: ${q}`;
  }
  wireOf.set(lastT, user);
  return [{ role: "system", content: sys }, ...hist.map(t => ({ role: t.role, content: wire(t) })), { role: "user", content: user }];
}

// turns: [{role:"user"|"assistant", content}], last one = the visitor's new message.
// onText(fullTextSoFar) is called while streaming. Resolves with the full raw text.
export async function ask(turns, onText) {
  if (!engine) throw new Error("brain not started");
  const run = async (msgs, cb) => {
    const t0 = performance.now();
    let tFirst = 0, usage = null, text = "";
    const chunks = await engine.chat.completions.create({
      messages: msgs, stream: true, temperature: 0.3, max_tokens: 160, stream_options: { include_usage: true },
    });
    for await (const c of chunks) {
      if (c.usage) usage = c.usage;
      const d = c.choices && c.choices[0] && c.choices[0].delta && c.choices[0].delta.content;
      if (d) { if (!tFirst) tFirst = performance.now(); text += d; if (cb) cb(text); }
    }
    const x = (usage && usage.extra) || {}, f = v => (typeof v === "number" ? v.toFixed(1) : "?");
    console.info(`Cedric: ${picked && picked.id} | first token ${tFirst ? Math.round(tFirst - t0) : "?"} ms | total ${Math.round(performance.now() - t0)} ms` +
      ` | prefill ${usage ? usage.prompt_tokens : "?"} tok @ ${f(x.prefill_tokens_per_s)}/s | decode ${usage ? usage.completion_tokens : "?"} tok @ ${f(x.decode_tokens_per_s)}/s`);
    return text;
  };
  try {
    return await run(await buildMessages(turns, true, dropped), onText);
  } catch (e) {
    // Most likely the prompt overflowed the context: retry with no page and no history.
    console.warn("Cedric: retrying with a smaller prompt", e);
    return await run(await buildMessages(turns.slice(-1), false, 0), onText);
  }
}

// ---- action tokens ---------------------------------------------------------
// Grammar: [[form]] | [[cv]] | [[cv:en]] | [[cv:fr]] | [[project:<slug>]]
// parse() strips every [[...]] from the text and returns the recognised ones as plain data
// ({kind, arg}); it never builds URLs. While streaming (final=false) a half-written "[[..." is hidden.
export function parse(raw, final) {
  const actions = [], seen = new Set();
  let text = String(raw).replace(/\[\[\s*([a-z]+)\s*(?::\s*([\w-]+)\s*)?\]\]/gi, (m, k, a) => {
    const act = { kind: k.toLowerCase(), arg: a ? a.toLowerCase() : "" }, key = act.kind + ":" + act.arg;
    if (!seen.has(key)) { seen.add(key); actions.push(act); }
    return "";
  });
  text = text.replace(/\[\[[^\]]*\]\]/g, "")        // unknown tokens
            .replace(/\[\[[^\]]*\]?$|\[$/, "")      // half-written token at the end
            .replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "")
            .replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n");
  return { text: final ? text.trim() : text.replace(/\s+$/, ""), actions };
}
