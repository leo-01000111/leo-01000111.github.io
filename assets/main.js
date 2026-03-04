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
  function _skeletonCard() {
    return `<div class="skel-proj" aria-hidden="true" role="presentation">
      <div class="skel" style="width:120px;height:68px;border-radius:12px;flex-shrink:0;"></div>
      <div class="skel-body">
        <div class="skel" style="height:17px;width:58%;"></div>
        <div class="skel" style="height:13px;width:88%;"></div>
        <div class="skel" style="height:13px;width:70%;"></div>
      </div>
    </div>`;
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
        noscript: "Enable JavaScript to see the projects list."
      },
      fr: {
        home: "Accueil",
        all: "Tous les projets",
        title: "Projets",
        lead: "Travaux d'ingenierie en commande, simulation et analyse.",
        noscript: "Active JavaScript pour afficher la liste des projets."
      }
    }[lang] || {};

    const map = [
      ["[data-ui='home']", copy.home],
      ["[data-ui='allProjects']", copy.all],
      ["#projects-title", copy.title],
      ["#projects-lead", copy.lead],
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
      ["[data-ui='home']", copy.home],
      ["[data-ui='allProjects']", copy.all],
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
  function _setProject1PageCopy(lang) {
    const slug = (document.body?.getAttribute("data-project-slug") || "").trim();
    const pid = (document.body?.getAttribute("data-project-id") || "").trim();
    if (slug !== "project1" && pid !== "1") return;

    const copy = {
      en: {
        pdfBtn: "Open thesis PDF",
        source: "Source: Chapter 5 and Chapter 6 of the thesis LaTeX manuscript.",
        setupTitle: "Study Setup",
        setup1: "Controllers: Tube RMPC and PPO.",
        setup2: "Evaluation dataset size: N = 500 environments.",
        setup3: "Same worlds used for both controllers and both denial configurations.",
        setup4: "Conditions: nominal and GNSS-denied operation.",
        keyTitle: "Key Metric Definition",
        keyText:
          "Tracking quality is measured with Cross-Track Error (XTE), defined as the Euclidean distance from robot position to the nearest reference waypoint with monotonic index progression along the path.",
        rawTitle: "Raw Results (Thesis Table, N = 500)",
        colMetric: "Metric",
        colRmpcNom: "RMPC (nominal)",
        colPpoNom: "PPO (nominal)",
        colRmpcDen: "RMPC (denial)",
        colPpoDen: "PPO (denial)",
        rowSuccess: "Success [%]",
        rowCollision: "Collision [%]",
        rowTimeout: "Timeout [%]",
        rowXteMean: "XTE_nom / XTE_mean [m]",
        rowXteIn: "XTE_in [m]",
        rowXteOut: "XTE_out [m]",
        degTitle: "Head-to-Head Degradation (Thesis Formulas)",
        deg1: "RMPC P_deg-nom = ((0.3245 / 0.2664) - 1) x 100% = +21.81%.",
        deg2: "RMPC P_deg-InOut = ((0.3245 / 0.3276) - 1) x 100% = -0.95%.",
        deg3: "PPO P_deg-nom = ((0.8515 / 0.7312) - 1) x 100% = +16.45%.",
        deg4: "PPO P_deg-InOut = ((0.2099 / 0.8667) - 1) x 100% = -75.78%.",
        workTitle: "Workload and Runtime Cost (Thesis Table)",
        workColMetric: "Metric",
        workColRmpc: "Tube RMPC",
        workColPpo: "PPO",
        workRowImpl: "Implementation time [man-hours]",
        workRowTrain: "Training/tuning duration [h]",
        workRowSpeed: "Rollout speed [actions/s]",
        concTitle: "Thesis Conclusions (Condensed)",
        conc1:
          "RMPC: strongest on safety/predictability, with conservative behavior and higher online compute cost.",
        conc2:
          "PPO: strongest on flexibility/adaptability and online speed, without formal stability/constraint guarantees.",
        conc3: "No universal winner: controller choice depends on system priorities and risk tolerance.",
        chartsTitle: "Results Visualised",
        chart1Title: "Success Rate",
        chart2Title: "Cross-Track Error — lower is better"
      },
      fr: {
        pdfBtn: "Ouvrir le PDF du mémoire",
        source: "Source : chapitres 5 et 6 du manuscrit LaTeX de la these.",
        setupTitle: "Cadre de l'etude",
        setup1: "Controleurs : Tube RMPC et PPO.",
        setup2: "Taille du jeu d'evaluation : N = 500 environnements.",
        setup3: "Memes mondes utilises pour les deux controleurs et les deux configurations de deni.",
        setup4: "Conditions : nominale et GNSS denie.",
        keyTitle: "Definition de la mesure cle",
        keyText:
          "La qualite de suivi est mesuree par la Cross-Track Error (XTE), definie comme la distance euclidienne entre la position du robot et le point de reference le plus proche, avec progression monotone de l'index le long de la trajectoire.",
        rawTitle: "Resultats bruts (table de these, N = 500)",
        colMetric: "Mesure",
        colRmpcNom: "RMPC (nominal)",
        colPpoNom: "PPO (nominal)",
        colRmpcDen: "RMPC (deni)",
        colPpoDen: "PPO (deni)",
        rowSuccess: "Succes [%]",
        rowCollision: "Collision [%]",
        rowTimeout: "Timeout [%]",
        rowXteMean: "XTE_nom / XTE_mean [m]",
        rowXteIn: "XTE_in [m]",
        rowXteOut: "XTE_out [m]",
        degTitle: "Degradation face-a-face (formules de these)",
        deg1: "RMPC P_deg-nom = ((0.3245 / 0.2664) - 1) x 100% = +21.81%.",
        deg2: "RMPC P_deg-InOut = ((0.3245 / 0.3276) - 1) x 100% = -0.95%.",
        deg3: "PPO P_deg-nom = ((0.8515 / 0.7312) - 1) x 100% = +16.45%.",
        deg4: "PPO P_deg-InOut = ((0.2099 / 0.8667) - 1) x 100% = -75.78%.",
        workTitle: "Charge de travail et cout d'execution (table de these)",
        workColMetric: "Mesure",
        workColRmpc: "Tube RMPC",
        workColPpo: "PPO",
        workRowImpl: "Temps d'implementation [heures-homme]",
        workRowTrain: "Duree d'entrainement/reglage [h]",
        workRowSpeed: "Vitesse de rollout [actions/s]",
        concTitle: "Conclusions de la these (resume)",
        conc1:
          "RMPC : meilleur sur la securite/predictibilite, avec un comportement conservateur et un cout en ligne plus eleve.",
        conc2:
          "PPO : meilleur sur la flexibilite/adaptabilite et la vitesse en ligne, sans garanties formelles de stabilite/contraintes.",
        conc3:
          "Pas de gagnant universel : le choix du controleur depend des priorites systeme et de la tolerance au risque.",
        chartsTitle: "Résultats visualisés",
        chart1Title: "Taux de succès",
        chart2Title: "Erreur transversale — plus bas = mieux"
      }
    }[lang] || {};

    const map = [
      ["#p1-pdf-btn", copy.pdfBtn],
      ["#p1-source", copy.source],
      ["#p1-setup-title", copy.setupTitle],
      ["#p1-setup-1", copy.setup1],
      ["#p1-setup-2", copy.setup2],
      ["#p1-setup-3", copy.setup3],
      ["#p1-setup-4", copy.setup4],
      ["#p1-key-title", copy.keyTitle],
      ["#p1-key-text", copy.keyText],
      ["#p1-raw-title", copy.rawTitle],
      ["#p1-col-metric", copy.colMetric],
      ["#p1-col-rmpc-nom", copy.colRmpcNom],
      ["#p1-col-ppo-nom", copy.colPpoNom],
      ["#p1-col-rmpc-den", copy.colRmpcDen],
      ["#p1-col-ppo-den", copy.colPpoDen],
      ["#p1-row-success", copy.rowSuccess],
      ["#p1-row-collision", copy.rowCollision],
      ["#p1-row-timeout", copy.rowTimeout],
      ["#p1-row-xtemean", copy.rowXteMean],
      ["#p1-row-xtein", copy.rowXteIn],
      ["#p1-row-xteout", copy.rowXteOut],
      ["#p1-deg-title", copy.degTitle],
      ["#p1-deg-1", copy.deg1],
      ["#p1-deg-2", copy.deg2],
      ["#p1-deg-3", copy.deg3],
      ["#p1-deg-4", copy.deg4],
      ["#p1-work-title", copy.workTitle],
      ["#p1-work-col-metric", copy.workColMetric],
      ["#p1-work-col-rmpc", copy.workColRmpc],
      ["#p1-work-col-ppo", copy.workColPpo],
      ["#p1-work-row-impl", copy.workRowImpl],
      ["#p1-work-row-train", copy.workRowTrain],
      ["#p1-work-row-speed", copy.workRowSpeed],
      ["#p1-conc-title", copy.concTitle],
      ["#p1-conc-1", copy.conc1],
      ["#p1-conc-2", copy.conc2],
      ["#p1-conc-3", copy.conc3],
      ["#p1-charts-title", copy.chartsTitle],
      ["#p1-chart1-title", copy.chart1Title],
      ["#p1-chart2-title", copy.chart2Title]
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

    host.innerHTML = _skeletonCard();
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
    grid.innerHTML = [1,2].map(_skeletonCard).join("");
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
    _setProject1PageCopy(lang);
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

  // Scroll-reveal via IntersectionObserver
  function _initReveal() {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.10, rootMargin: "0px 0px -20px 0px" });

    // Wait one frame so we know which elements are already in viewport
    requestAnimationFrame(function() {
      var vh = window.innerHeight;
      document.querySelectorAll(".card, .tl-item").forEach(function(el) {
        var rect = el.getBoundingClientRect();
        if (rect.top >= vh) {
          // Below fold — animate it in
          el.classList.add("reveal");
          io.observe(el);
        }
        // Already visible on load — no animation, avoid flash
      });
      // Stagger timeline items
      var tlItems = document.querySelectorAll(".tl-item.reveal");
      tlItems.forEach(function(el, i) {
        el.style.transitionDelay = (i * 90) + "ms";
      });
    });
  }

  const lang = _getLang();
  _syncLangUI(lang);
  // Fix home link to respect current language
  document.querySelectorAll("[data-ui='home']").forEach(function(a) {
    a.setAttribute("href", lang === "fr" ? (_siteRoot() + "fr/") : _siteRoot());
  });
  _initFeaturedProjects(lang);
  _initProjectsIndex(lang);
  _initProjectPage(lang);
  _initReveal();
})();
