/* Cedric's brain: a small LLM that runs in the visitor's browser (WebLLM + WebGPU).
   ES module, loaded on demand by chat.js (dynamic import) after the first chat message.
   Nothing here touches the DOM except a throw-away DOMParser document. It only returns text;
   chat.js renders it (textContent only) and decides what the action tokens may do.
   Grounding: the system prompt is built from live site content (CV html + projects.json,
   plus the page of the project being asked about), so he doesn't invent facts about Leon. */

const WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";   // same version in brain-worker.js
const LLAMA = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const QWEN16 = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const QWEN32 = "Qwen2.5-0.5B-Instruct-q4f32_1-MLC";   // for GPUs without shader-f16

// ---- model choice ----------------------------------------------------------
// null = this device can't run an LLM (chat.js then falls back to the sleepy line + form).
export async function pickModel() {
  // Testing override: ?cedric-model=<id> or localStorage "cedric:model".
  let forced = "";
  try { forced = new URLSearchParams(location.search).get("cedric-model") || ""; } catch (e) {}
  if (!forced) { try { forced = localStorage.getItem("cedric:model") || ""; } catch (e) {} }
  if (/^[\w.\-]+$/.test(forced)) return { id: forced, tight: /0\.5B|0_5B/i.test(forced) };

  if (!navigator.gpu) return null;                                   // no WebGPU
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter(); } catch (e) {}
  if (!adapter) return null;

  const f16 = adapter.features.has("shader-f16");
  const mobile = navigator.userAgentData ? !!navigator.userAgentData.mobile
    : /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const mem = navigator.deviceMemory;                                // GB, rounded, Chromium only (capped at 8)
  const net = navigator.connection;                                  // Chromium only
  const bigBuffers = adapter.limits.maxBufferSize >= 0.9 * 2 ** 30;  // about 1 GiB
  const strong = f16 && !mobile && bigBuffers
    && (mem === undefined || mem >= 8)
    && (!net || (!net.saveData && net.downlink >= 10));
  if (strong) return { id: LLAMA, tight: false };                    // 1B: better answers, ~700 MB download
  return { id: f16 ? QWEN16 : QWEN32, tight: true };                 // 0.5B: lighter, tighter prompt
}

// ---- site knowledge --------------------------------------------------------
let K = null;                          // { root, lang, projects, cv, tight }
const pageCache = new Map();           // slug -> Promise<string>

// Block-aware plain text of an HTML string. `pick` = selectors to prefer, in order.
function htmlToText(html, pick) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,svg,noscript,template,iframe,img,nav,header,footer,form,button").forEach(n => n.remove());
  let root = doc.body;
  for (const sel of pick || []) { const n = doc.querySelector(sel); if (n) { root = n; break; } }
  root.querySelectorAll("p,li,h1,h2,h3,h4,h5,h6,tr,div,section,article,dt,dd,blockquote,figcaption,br")
    .forEach(n => n.after(doc.createTextNode("\n")));
  return root.textContent.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
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
  K = { root, lang, tight, projects, cv: cvHtml ? htmlToText(cvHtml, [".page", "body"]) : "" };
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

function systemPrompt(page, size) {
  const { lang, projects, tight } = K;
  const language = lang === "fr" ? "French (use vouvoiement)" : "English";
  const slugs = projects.map(p => p.slug).join(", ");
  const withPage = !!page;
  const cvMax = withPage ? 1400 : (tight ? 2600 : 3200), descMax = withPage ? 90 : (tight ? 150 : 190);
  const plist = projects.map(p => "- " + p.slug + " | " + p.short + " | " + p.title + " | " + trunc(p.desc, descMax) +
    (p.tags.length ? " | tags: " + p.tags.join(", ") : "") + (p.meta ? " | " + p.meta : "")).join("\n");

  let s =
`You are Cédric, a small hatched shrimp: the mascot of Leon Górecki's portfolio site (leongorecki.eu). You just woke up from a nap. You are NOT Leon. You only know what is written under FACTS, PROJECTS and PAGE below.

RULES
- Reply in ${language}. Switch language only if the visitor clearly writes in another one.
- Be short: 1 to 3 sentences, unless you are quoting. Friendly, a bit sleepy and playful.
- No markdown, no headings, no bullet symbols.
- Answer ONLY from FACTS, PROJECTS and PAGE. If the answer is not there, say you don't know and offer the form with [[form]].
- Never invent dates, grades, employers, numbers, links or projects. Never pretend to be Leon: say "Leon" when you talk about him.
- When you quote a page, copy its sentences word for word between quotation marks.

ACTIONS (write them at the end of your reply; they turn into buttons. Use them only when helpful. Never write any other [[...]].)
[[form]] shows the message form for Leon. Example: I don't know that. Want to ask Leon? [[form]]
[[project:<slug>]] shows a button to that project's page. Valid slugs: ${slugs}. Example: Leon made MILTOM-Bot to watch public tenders. [[project:miltombot]]
[[cv]] shows a button to Leon's CV (PDF). Example: Here is his CV. [[cv]]

FACTS (Leon's CV)
${trunc(K.cv, cvMax) || "(not available)"}

PROJECTS (slug | name | title | summary | tags)
${plist}`;

  if (withPage) {
    s += `\n\nPAGE (${page.short}):\n${trunc(page.text, size)}\n` +
      `The visitor is asking about ${page.short}. When you quote PAGE, copy sentences verbatim in quotation marks, and add [[project:${page.slug}]].`;
  }
  return s;
}

// ---- engine ----------------------------------------------------------------
let engine = null, worker = null, startP = null, picked = null, cur = null;

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
  startP = (async () => {
    try {
      if (!picked) picked = await pickModel();
      if (!picked) throw new Error("no WebGPU");
      const [webllm] = await Promise.race([Promise.all([import(WEBLLM), loadKnowledge(root, lang, picked.tight)]), cancelled]);
      worker = new Worker(new URL("./brain-worker.js", import.meta.url), { type: "module" });
      const eng = await Promise.race([cancelled, webllm.CreateWebWorkerMLCEngine(worker, picked.id, {
        initProgressCallback: r => { if (!ctl.cancelled) try { onProgress && onProgress(r.progress, r.text); } catch (e) {} },
      })]);
      if (ctl.cancelled) throw cancelErr();
      engine = eng;
    } catch (e) {
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
  if (worker) worker.terminate();
  worker = engine = startP = cur = null;
}

// Build the messages for the model; `page` null = no retrieval (used for the retry).
async function buildMessages(turns, useRetrieval) {
  const last = turns[turns.length - 1].content;
  const prevUser = turns.slice(0, -1).filter(t => t.role === "user").pop();
  let page = null;
  const p = useRetrieval ? bestProject(last, prevUser && prevUser.content) : null;
  if (p) { const text = await projectPage(p.slug); if (text) page = { slug: p.slug, short: p.short, text }; }
  const chars = turns.reduce((n, t) => n + t.content.length + 12, 0);
  // What's left for the page after persona + facts + projects + chat history.
  let size = 0;
  if (page) {
    const base = systemPrompt({ slug: page.slug, short: page.short, text: "" }, 0).length;
    size = Math.max(0, Math.min(K.tight ? 3500 : 6000, BUDGET(K.lang) - base - chars));
    if (size < 600) page = null;
  }
  return [{ role: "system", content: systemPrompt(page, size) }, ...turns.map(t => ({ role: t.role, content: t.content }))];
}

// turns: [{role:"user"|"assistant", content}], last one = the visitor's new message.
// onText(fullTextSoFar) is called while streaming. Resolves with the full raw text.
export async function ask(turns, onText) {
  if (!engine) throw new Error("brain not started");
  turns = turns.slice(-6);
  const run = async (msgs, cb) => {
    const chunks = await engine.chat.completions.create({ messages: msgs, stream: true, temperature: 0.3, max_tokens: 220 });
    let text = "";
    for await (const c of chunks) {
      const d = c.choices && c.choices[0] && c.choices[0].delta && c.choices[0].delta.content;
      if (d) { text += d; if (cb) cb(text); }
    }
    return text;
  };
  try {
    return await run(await buildMessages(turns, true), onText);
  } catch (e) {
    // Most likely the prompt overflowed the context: retry with no page and a short history.
    console.warn("Cedric: retrying with a smaller prompt", e);
    return await run(await buildMessages(turns.slice(-2), false), onText);
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
