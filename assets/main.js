(function () {
  // year
  ["year", "y"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(new Date().getFullYear());
  });

  // smooth scroll (only real anchors like "#projects")
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = (a.getAttribute("href") || "").trim();
      if (id.length <= 1) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // site root helper (supports hosting under subpaths if needed)
  function _siteRoot() {
    const meta = document.querySelector('meta[name="site-root"]');
    let root = meta ? meta.getAttribute("content") || "/" : "/";
    if (!root.startsWith("/")) root = `/${root}`;
    if (!root.endsWith("/")) root = `${root}/`;
    return root;
  }
  function _joinRoot(path) {
    return `${_siteRoot()}${(path || "").replace(/^\/+/, "")}`;
  }

  // projects system (featured + listing + per-project pages)
  async function _fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch failed: ${url}`);
    return r.text();
  }
  async function _fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch failed: ${url}`);
    return r.json();
  }
  function _getLang() {
    const u = new URL(window.location.href);
    const qp = (u.searchParams.get("lang") || "").toLowerCase();
    if (qp === "fr") return "fr";
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("fr")) return "fr";
    return "en";
  }
  function _syncLangUI(lang) {
    document.documentElement.setAttribute("lang", lang);
    document.querySelectorAll(".lang a[data-lang]").forEach((a) => {
      if ((a.dataset.lang || "").toLowerCase() === lang) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }
  function _projectFileName(p) {
    const slug = (p?.slug || "").toString().trim();
    if (slug) return `${slug}.html`;
    if (Number.isFinite(Number(p?.id))) return `project${Number(p.id)}.html`;
    return "";
  }
  function _projectHref(p, lang) {
    const file = _projectFileName(p);
    const base = lang === "fr" ? `${_siteRoot()}fr/projects/` : `${_siteRoot()}projects/`;
    return file ? `${base}${file}` : base;
  }
  function _escapeHtml(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function _projectThumbAlt(title, lang) {
    return lang === "fr" ? `Miniature du projet : ${title}` : `Project thumbnail: ${title}`;
  }
  function _renderProjectCard(p, lang) {
    const title = p?.title?.[lang] || p?.title?.en || "";
    const desc = p?.description?.[lang] || p?.description?.en || "";
    const tags = Array.isArray(p?.tags) ? p.tags : [];
    const thumb = p?.thumbnail || "/assets/thumbs/1.svg";
    const href = _projectHref(p, lang);
    const openLabel = lang === "fr" ? "Ouvrir" : "Open";
    return `
      <article class="proj">
        <div class="proj-top">
          <div class="proj-media">
            <a class="proj-thumb${p.thumb_invert ? ' thumb-on-white' : ''}" href="${href}" aria-label="${openLabel}: ${_escapeHtml(title)}">
              <img src="${thumb}" alt="${_escapeHtml(_projectThumbAlt(title, lang))}" loading="lazy" />
            </a>
            <div>
              <h3>${_escapeHtml(title)}</h3>
              <p>${_escapeHtml(desc)}</p>
            </div>
          </div>
          <a class="pill" href="${href}">${openLabel}</a>
        </div>
        <div class="meta">
          ${tags.map((t) => `<span class="chip">${_escapeHtml(t)}</span>`).join("")}
        </div>
      </article>
    `;
  }
  function _setProjectPageCopy(lang) {
    const copy = {
      en: {
        home: "Home",
        all: "All projects",
        back: "Back to projects",
        homeBtn: "Home",
        overview: "Overview",
        what: "What I did",
        results: "Results",
        links: "Links"
      },
      fr: {
        home: "Accueil",
        all: "Tous les projets",
        back: "Retour aux projets",
        homeBtn: "Accueil",
        overview: "Contexte",
        what: "Ce que j'ai fait",
        results: "Résultats",
        links: "Liens"
      }
    }[lang] || {};

    const map = [
      ["#proj-back", copy.back],
      ["#proj-home", copy.homeBtn],
      ["#sec-overview", copy.overview],
      ["#sec-what", copy.what],
      ["#sec-results", copy.results],
      ["#sec-links", copy.links]
    ];
    map.forEach(([selector, text]) => {
      if (!text) return;
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    });
  }
  function _findProjectByPage(all) {
    const idRaw = document.body?.getAttribute("data-project-id");
    if (idRaw && idRaw !== "__ID__") {
      const pid = parseInt(idRaw, 10);
      if (Number.isFinite(pid)) return (all || []).find((x) => x.id === pid) || null;
    }
    const slugRaw = (document.body?.getAttribute("data-project-slug") || "").trim();
    if (slugRaw && slugRaw !== "__SLUG__") {
      return (all || []).find((x) => (x?.slug || "").trim() === slugRaw) || null;
    }
    const file = window.location.pathname.split("/").pop() || "";
    const slug = file.replace(/\.html$/i, "");
    if (!slug || slug.toLowerCase() === "index") return null;
    return (all || []).find((x) => (x?.slug || `project${x?.id || ""}`) === slug) || null;
  }

  async function _initProjectPage(lang) {
    const titleEl = document.getElementById("proj-title");
    if (!titleEl) return;

    _setProjectPageCopy(lang);
    try {
      const all = await _fetchJSON(_joinRoot("projects/projects.json"));
      const p = _findProjectByPage(Array.isArray(all) ? all : []);
      if (!p) {
        const d = document.getElementById("proj-desc");
        if (d) d.textContent = lang === "fr" ? "Projet introuvable dans projects.json." : "Project not found in projects.json.";
        return;
      }

      const title = p?.title?.[lang] || p?.title?.en || "Project";
      const desc = p?.description?.[lang] || p?.description?.en || "";
      const thumb = p?.thumbnail || "/assets/thumbs/1.svg";
      const tags = Array.isArray(p?.tags) ? p.tags : [];

      const d = document.getElementById("proj-desc");
      const img = document.getElementById("proj-thumb");
      const meta = document.getElementById("proj-tags");
      titleEl.textContent = title;
      if (d) d.textContent = desc;
      if (img) {
        img.src = thumb;
        img.alt = _projectThumbAlt(title, lang);
        img.closest(".proj-thumb")?.classList.toggle("thumb-on-white", !!p.thumb_invert);
      }
      if (meta) meta.innerHTML = tags.map((t) => `<span class="chip">${_escapeHtml(t)}</span>`).join("");

      document.title = `${title} - Leon Górecki`;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", document.title);
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && desc) metaDesc.setAttribute("content", desc);
    } catch (e) {
      const d = document.getElementById("proj-desc");
      if (d) d.textContent = lang === "fr" ? "Impossible de charger ce projet." : "Could not load this project.";
    }
  }

  async function _initSeeAlso(lang) {
    const host = document.getElementById("see-also");
    if (!host) return;
    try {
      const all = await _fetchJSON(_joinRoot("projects/projects.json"));
      const current = _findProjectByPage(Array.isArray(all) ? all : []);
      const others = (Array.isArray(all) ? all : [])
        .filter((p) => p !== current)
        .slice(0, 2);
      if (!others.length) { host.remove(); return; }
      const heading = lang === "fr" ? "Voir aussi" : "See also";
      host.innerHTML =
        `<h2>${heading}</h2>` +
        `<div class="projects">${others.map((p) => _renderProjectCard(p, lang)).join("")}</div>`;
    } catch (e) {
      host.remove();
    }
  }

  function _initAiBadge(lang) {
    if (lang !== "fr") return;
    const host = document.querySelector(".header-inner");
    if (!host || host.querySelector(".ai-badge")) return;
    const badge = document.createElement("div");
    badge.className = "ai-badge";
    badge.title = "Certaines traductions sont générées par IA et peuvent être imparfaites.";
    badge.setAttribute("role", "note");
    badge.setAttribute("aria-label", "Traduit par IA");
    badge.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">' +
        '<path d="M6 0.5L7.35 4.65L11.5 6L7.35 7.35L6 11.5L4.65 7.35L0.5 6L4.65 4.65Z"/>' +
      "</svg>" +
      "Traduit par IA";
    const langDiv = host.querySelector('.hp-lang[aria-label="Language"]');
    if (langDiv) langDiv.parentNode.insertBefore(badge, langDiv);
    else host.appendChild(badge);
  }

  function _initBackToTop() {
    const btn = document.createElement("button");
    btn.id = "back-to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.textContent = "\u2191";
    document.body.appendChild(btn);
    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const lang = _getLang();
  _syncLangUI(lang);
  // Fix home link to respect current language
  document.querySelectorAll("[data-ui='home']").forEach(function(a) {
    a.setAttribute("href", lang === "fr" ? (_siteRoot() + "fr/") : _siteRoot());
  });
  // Point "All projects" at the matching language's projects index
  document.querySelectorAll("[data-ui='allProjects']").forEach(function(a) {
    a.setAttribute("href", lang === "fr" ? (_siteRoot() + "fr/projects/") : (_siteRoot() + "projects/"));
  });
  _initAiBadge(lang);
  _initProjectPage(lang);
  _initSeeAlso(lang);
  _initBackToTop();
})();
