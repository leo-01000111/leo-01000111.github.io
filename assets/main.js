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

  // subtle cursor glow in hero
  const glow = document.getElementById("glow");
  const hero = document.querySelector(".hero");
  function moveGlow(e) {
    if (!glow || !hero) return;
    const r = hero.getBoundingClientRect();
    glow.style.left = `${e.clientX - r.left}px`;
    glow.style.top = `${e.clientY - r.top}px`;
  }
  if (hero) {
    hero.addEventListener("mousemove", moveGlow);
    hero.addEventListener(
      "touchmove",
      (e) => {
        if (!e.touches?.[0]) return;
        moveGlow(e.touches[0]);
      },
      { passive: true }
    );
  }

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
  function _parseFeaturedIds(cfgText) {
    const m = cfgText.match(/featured\s+projects\s*:\s*([0-9\s]+)/i);
    if (!m) return [];
    return m[1]
      .trim()
      .split(/\s+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n));
  }
  function _projectFileName(p) {
    const slug = (p?.slug || "").toString().trim();
    if (slug) return `${slug}.html`;
    if (Number.isFinite(Number(p?.id))) return `project${Number(p.id)}.html`;
    return "";
  }
  function _projectHref(p, lang) {
    const file = _projectFileName(p);
    const q = lang === "fr" ? "?lang=fr" : "";
    if (!file) return `${_siteRoot()}projects/${q}`;
    return `${_siteRoot()}projects/${file}${q}`;
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
            <a class="proj-thumb" href="${href}" aria-label="${openLabel}: ${_escapeHtml(title)}">
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
  function _setProjectsPageCopy(lang) {
    const copy = {
      en: {
        home: "Home",
        all: "All projects",
        title: "Projects",
        lead: "Engineering work in controls, simulation, and analysis.",
        tip: "Tip: edit /projects/projects.json to add projects and /config.txt to choose featured ones.",
        noscript: "Enable JavaScript to see the projects list."
      },
      fr: {
        home: "Accueil",
        all: "Tous les projets",
        title: "Projets",
        lead: "Travaux d'ingenierie en commande, simulation et analyse.",
        tip: "Astuce : modifie /projects/projects.json pour ajouter des projets et /config.txt pour choisir les projets en avant.",
        noscript: "Active JavaScript pour afficher la liste des projets."
      }
    }[lang] || {};

    const map = [
      ["[data-ui='home']", copy.home],
      ["[data-ui='allProjects']", copy.all],
      ["#projects-title", copy.title],
      ["#projects-lead", copy.lead],
      ["#projects-tip", copy.tip],
      ["#projects-noscript", copy.noscript]
    ];
    map.forEach(([selector, text]) => {
      if (!text) return;
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    });

    if (copy.title) document.title = `${copy.title} - Leon Górecki`;
  }
  function _setProjectPageCopy(lang) {
    const copy = {
      en: {
        home: "Home",
        all: "All projects",
        back: "Back to projects",
        homeBtn: "Home",
        note: "Add content sections below as you develop this project page.",
        overview: "Overview",
        what: "What I did",
        results: "Results",
        links: "Links",
        overviewText: "Write 3 to 6 sentences describing the problem and context.",
        resultsText: "Add plots, images, or a short bullet list of outcomes.",
        linksText: "Add: GitHub repo, PDF report, demo video, etc."
      },
      fr: {
        home: "Accueil",
        all: "Tous les projets",
        back: "Retour aux projets",
        homeBtn: "Accueil",
        note: "Ajoute les sections ci-dessous au fur et a mesure du developpement du projet.",
        overview: "Contexte",
        what: "Ce que j'ai fait",
        results: "Resultats",
        links: "Liens",
        overviewText: "Ecris 3 a 6 phrases pour decrire le probleme et le contexte.",
        resultsText: "Ajoute des graphes, images, ou une liste courte des resultats.",
        linksText: "Ajoute : depot GitHub, rapport PDF, video de demo, etc."
      }
    }[lang] || {};

    const map = [
      ["[data-ui='home']", copy.home],
      ["[data-ui='allProjects']", copy.all],
      ["#proj-back", copy.back],
      ["#proj-home", copy.homeBtn],
      ["#proj-note", copy.note],
      ["#sec-overview", copy.overview],
      ["#sec-what", copy.what],
      ["#sec-results", copy.results],
      ["#sec-links", copy.links],
      ["#txt-overview", copy.overviewText],
      ["#txt-results", copy.resultsText],
      ["#txt-links", copy.linksText]
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

  async function _initFeaturedProjects(lang) {
    const host = document.getElementById("featured-projects");
    if (!host) return;

    try {
      const [cfgText, all] = await Promise.all([
        _fetchText(_joinRoot("config.txt")),
        _fetchJSON(_joinRoot("projects/projects.json"))
      ]);
      const featured = _parseFeaturedIds(cfgText);
      const byId = new Map((all || []).map((p) => [p.id, p]));
      const list = featured.length ? featured.map((id) => byId.get(id)).filter(Boolean) : (all || []).slice(0, 3);

      if (!list.length) {
        host.innerHTML = `<div class="small">${lang === "fr" ? "Aucun projet configure." : "No projects configured."}</div>`;
        return;
      }
      host.innerHTML = list.map((p) => _renderProjectCard(p, lang)).join("");
    } catch (e) {
      host.innerHTML = `<div class="small">${lang === "fr" ? "Impossible de charger les projets." : "Could not load projects."}</div>`;
    }
  }

  async function _initProjectsIndex(lang) {
    const grid = document.getElementById("projects-grid");
    if (!grid) return;

    _setProjectsPageCopy(lang);
    try {
      const all = await _fetchJSON(_joinRoot("projects/projects.json"));
      if (!Array.isArray(all) || !all.length) {
        grid.innerHTML = `<div class="small">${lang === "fr" ? "Aucun projet pour le moment." : "No projects yet."}</div>`;
        return;
      }
      grid.innerHTML = all.map((p) => _renderProjectCard(p, lang)).join("");
    } catch (e) {
      grid.innerHTML = `<div class="small">${lang === "fr" ? "Impossible de charger la liste des projets." : "Could not load the projects list."}</div>`;
    }
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

  const lang = _getLang();
  _syncLangUI(lang);
  _initFeaturedProjects(lang);
  _initProjectsIndex(lang);
  _initProjectPage(lang);
})();
