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
    const r = await fetch(url + "?t=" + Date.now());
    if (!r.ok) throw new Error(`fetch failed: ${url}`);
    return r.text();
  }
  async function _fetchJSON(url) {
    const r = await fetch(url + "?t=" + Date.now());
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
        // Context
        ctxTitle: "What this thesis is about",
        ctxText:
          "A simulated ground robot navigates cluttered indoor environments, following a reference path to a goal while avoiding obstacles. " +
          "The thesis asks one question: when GPS positioning is jammed mid-run, which controller holds up better — Tube Robust MPC, with " +
          "formal safety guarantees, or PPO, a neural network trained through reinforcement learning? " +
          "Both were benchmarked head-to-head across 500 identical environments under nominal GPS and GNSS-denied conditions.",
        // Controllers
        ctrlTitle: "Controllers at a glance",
        ctrlRmpcName: "Tube Robust MPC",
        ctrlRmpc1: "Predicts future states using an explicit dynamics model",
        ctrlRmpc2: "Tube formulation bounds the effect of noise — hard constraints guaranteed",
        ctrlRmpc3: "Conservative by design; higher online compute cost",
        ctrlPpoName: "Proximal Policy Optimisation (PPO)",
        ctrlPpo1: "Policy learned through simulated trial-and-error — no explicit model",
        ctrlPpo2: "Single neural-network forward pass; 63× faster online than RMPC",
        ctrlPpo3: "No formal stability or obstacle-avoidance guarantees",
        // Experiment at a glance
        expTitle: "Experiment at a glance",
        stat1: "environments evaluated",
        stat2: "controllers compared",
        stat3: "operating conditions",
        stat4: "RMPC collision rate",
        // Safety callout
        safetyTitle: "Safety highlight",
        safetyText:
          "RMPC recorded zero collisions in both nominal and GNSS-denied conditions. " +
          "PPO collided in 3.1% of nominal runs and 4.7% under GPS denial — a direct result of operating without hard obstacle-avoidance constraints.",
        // Charts
        chartsTitle: "Results Visualised",
        chart1Title: "Success Rate",
        chart2Title: "Cross-Track Error — lower is better",
        // Raw table
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
        // GNSS denial
        degTitle: "GNSS Denial: Performance Impact",
        degM1: "Tracking degradation (nominal → denied)",
        degM2: "Denial-zone consistency (inside vs. outside)",
        degM3: "Tracking degradation (nominal → denied)",
        degM4: "Denial-zone consistency (inside vs. outside)",
        degD1: "0.266 → 0.325 m mean XTE",
        degD2: "XTE_in 0.321 m ≈ XTE_out 0.328 m",
        degD3: "0.731 → 0.852 m mean XTE",
        degD4: "XTE_in 0.210 m vs XTE_out 0.867 m — spike after denial",
        degNote:
          "P_deg-nom compares tracking error under denial vs. nominal. P_deg-InOut isolates whether degradation occurs " +
          "inside the denial zone or outside it. RMPC's −0.95% means it degrades uniformly throughout. " +
          "PPO's −75.8% reveals it tracks well inside the denial zone but accumulates large error once outside — " +
          "suggesting position drift that compounds after denial ends.",
        // Study setup
        setupTitle: "Study Setup",
        setup1: "Controllers: Tube RMPC and PPO.",
        setup2: "Evaluation dataset size: N = 500 environments.",
        setup3: "Same worlds used for both controllers and both denial configurations.",
        setup4: "Conditions: nominal and GNSS-denied operation.",
        // Key metric
        keyTitle: "Key Metric Definition",
        keyText:
          "Tracking quality is measured with Cross-Track Error (XTE), defined as the Euclidean distance from robot position to the nearest reference waypoint with monotonic index progression along the path.",
        // Cost of deployment
        workTitle: "Cost of Deployment",
        workNote:
          "Rollout speed measures how fast each controller issues actions during operation. " +
          "PPO's advantage (63× faster) comes from a single neural-network forward pass, " +
          "versus RMPC solving an online optimisation problem at each timestep.",
        workColMetric: "Metric",
        workColRmpc: "Tube RMPC",
        workColPpo: "PPO",
        workRowImpl: "Implementation time [man-hours]",
        workRowTrain: "Training/tuning duration [h]",
        workRowSpeed: "Rollout speed [actions/s]",
        // Verdict
        verdictTitle: "Verdict",
        v1Badge: "Safety & Predictability",
        v1Text:
          "RMPC is the clear winner where hard constraints matter. Zero collisions across 1 000 runs, predictable degradation under denial, and formal guarantees on obstacle avoidance make it the right choice for safety-critical applications — at the cost of slower online execution and a more complex implementation.",
        v2Badge: "Flexibility & Online Speed",
        v2Text:
          "PPO matched or exceeded RMPC on raw success rate and runs 63× faster online. Its policy adapts naturally without an explicit model — but the 3–5% collision rate and lack of formal guarantees disqualify it from safety-critical use as-is.",
        v3Badge: "Takeaway",
        v3Text:
          "No universal winner. RMPC is the right choice when safety is non-negotiable; PPO when throughput and adaptability matter more than constraint guarantees. The real value of this thesis is the direct, controlled comparison under identical conditions — a practical baseline for future controller design decisions."
      },
      fr: {
        pdfBtn: "Ouvrir le PDF du mémoire",
        source: "Source : chapitres 5 et 6 du manuscrit LaTeX de la thèse.",
        // Context
        ctxTitle: "De quoi parle cette thèse",
        ctxText:
          "Un robot terrestre simulé navigue dans des environnements intérieurs encombrés, en suivant une trajectoire de référence vers un objectif tout en évitant les obstacles. " +
          "La thèse pose une question : lorsque le positionnement GPS est brouillé en pleine course, quel contrôleur résiste mieux — le Tube RMPC, avec ses garanties formelles de sécurité, ou le PPO, un réseau de neurones entraîné par apprentissage par renforcement ? " +
          "Les deux ont été comparés sur 500 environnements identiques, en conditions nominales et avec refus GNSS.",
        // Controllers
        ctrlTitle: "Les contrôleurs en un coup d'œil",
        ctrlRmpcName: "Tube Robust MPC",
        ctrlRmpc1: "Prédit les états futurs à l'aide d'un modèle dynamique explicite",
        ctrlRmpc2: "La formulation tube borne l'effet du bruit — contraintes dures garanties",
        ctrlRmpc3: "Conservateur par construction ; coût de calcul en ligne plus élevé",
        ctrlPpoName: "Proximal Policy Optimisation (PPO)",
        ctrlPpo1: "Politique apprise par essai-erreur simulé — sans modèle explicite",
        ctrlPpo2: "Passage direct dans un réseau de neurones ; 63× plus rapide en ligne que RMPC",
        ctrlPpo3: "Aucune garantie formelle de stabilité ou d'évitement d'obstacles",
        // Experiment at a glance
        expTitle: "L'expérience en chiffres",
        stat1: "environnements évalués",
        stat2: "contrôleurs comparés",
        stat3: "conditions d'opération",
        stat4: "taux de collision RMPC",
        // Safety callout
        safetyTitle: "Résultat de sécurité",
        safetyText:
          "RMPC n'a enregistré aucune collision, ni en conditions nominales ni avec refus GNSS. " +
          "PPO a percuté des obstacles dans 3,1 % des courses nominales et 4,7 % avec refus GPS — conséquence directe de l'absence de contraintes formelles d'évitement.",
        // Charts
        chartsTitle: "Résultats visualisés",
        chart1Title: "Taux de succès",
        chart2Title: "Erreur transversale — plus bas = mieux",
        // Raw table
        rawTitle: "Résultats bruts (table de thèse, N = 500)",
        colMetric: "Mesure",
        colRmpcNom: "RMPC (nominal)",
        colPpoNom: "PPO (nominal)",
        colRmpcDen: "RMPC (refus)",
        colPpoDen: "PPO (refus)",
        rowSuccess: "Succès [%]",
        rowCollision: "Collision [%]",
        rowTimeout: "Timeout [%]",
        rowXteMean: "XTE_nom / XTE_mean [m]",
        rowXteIn: "XTE_in [m]",
        rowXteOut: "XTE_out [m]",
        // GNSS denial
        degTitle: "Refus GNSS : impact sur les performances",
        degM1: "Dégradation du suivi (nominal → refus)",
        degM2: "Cohérence en zone de refus (intérieur vs. extérieur)",
        degM3: "Dégradation du suivi (nominal → refus)",
        degM4: "Cohérence en zone de refus (intérieur vs. extérieur)",
        degD1: "XTE moyenne 0,266 → 0,325 m",
        degD2: "XTE_in 0,321 m ≈ XTE_out 0,328 m",
        degD3: "XTE moyenne 0,731 → 0,852 m",
        degD4: "XTE_in 0,210 m vs XTE_out 0,867 m — pic après le refus",
        degNote:
          "P_deg-nom : erreur de suivi avec refus vs nominale. P_deg-InOut : erreur à l'intérieur de la zone de refus par rapport à l'extérieur. " +
          "Le −0,95 % de RMPC indique une dégradation uniforme. " +
          "Le −75,8 % de PPO révèle qu'il suit bien à l'intérieur de la zone mais accumule une grande erreur après — " +
          "suggérant une dérive de position qui s'amplifie une fois le refus terminé.",
        // Study setup
        setupTitle: "Cadre de l'étude",
        setup1: "Contrôleurs : Tube RMPC et PPO.",
        setup2: "Taille du jeu d'évaluation : N = 500 environnements.",
        setup3: "Mêmes mondes utilisés pour les deux contrôleurs et les deux configurations de refus.",
        setup4: "Conditions : nominale et GNSS refusé.",
        // Key metric
        keyTitle: "Définition de la mesure clé",
        keyText:
          "La qualité de suivi est mesurée par la Cross-Track Error (XTE), définie comme la distance euclidienne entre la position du robot et le point de référence le plus proche, avec progression monotone de l'index le long de la trajectoire.",
        // Cost of deployment
        workTitle: "Coût de déploiement",
        workNote:
          "La vitesse de rollout mesure la rapidité avec laquelle chaque contrôleur émet des actions en fonctionnement. " +
          "L'avantage de PPO (63× plus rapide) vient d'un passage direct dans un réseau de neurones, " +
          "contre la résolution d'un problème d'optimisation en ligne à chaque pas de temps pour RMPC.",
        workColMetric: "Mesure",
        workColRmpc: "Tube RMPC",
        workColPpo: "PPO",
        workRowImpl: "Temps d'implémentation [heures-homme]",
        workRowTrain: "Durée d'entraînement/réglage [h]",
        workRowSpeed: "Vitesse de rollout [actions/s]",
        // Verdict
        verdictTitle: "Verdict",
        v1Badge: "Sécurité & Prévisibilité",
        v1Text:
          "RMPC est le grand gagnant là où les contraintes dures importent. Zéro collision sur 1 000 courses, dégradation prévisible sous refus GNSS et garanties formelles d'évitement d'obstacles en font le choix approprié pour les applications à risque — au prix d'une exécution en ligne plus lente et d'une implémentation plus complexe.",
        v2Badge: "Flexibilité & Vitesse en ligne",
        v2Text:
          "PPO égale ou dépasse RMPC sur le taux de succès brut et est 63× plus rapide en ligne. Sa politique s'adapte naturellement sans modèle explicite — mais le taux de collision de 3 à 5 % et l'absence de garanties formelles l'excluent des usages critiques en l'état.",
        v3Badge: "À retenir",
        v3Text:
          "Pas de gagnant universel. RMPC s'impose quand la sécurité est non-négociable ; PPO quand le débit et l'adaptabilité priment sur les garanties de contraintes. La vraie valeur de cette thèse est la comparaison directe et contrôlée dans des conditions identiques — une base pratique pour les futures décisions de conception de contrôleurs."
      }
    }[lang] || {};

    const map = [
      ["#p1-pdf-btn",        copy.pdfBtn],
      ["#p1-source",         copy.source],
      ["#p1-ctx-title",      copy.ctxTitle],
      ["#p1-ctx-text",       copy.ctxText],
      ["#p1-ctrl-title",     copy.ctrlTitle],
      ["#p1-ctrl-rmpc-name", copy.ctrlRmpcName],
      ["#p1-ctrl-rmpc-1",    copy.ctrlRmpc1],
      ["#p1-ctrl-rmpc-2",    copy.ctrlRmpc2],
      ["#p1-ctrl-rmpc-3",    copy.ctrlRmpc3],
      ["#p1-ctrl-ppo-name",  copy.ctrlPpoName],
      ["#p1-ctrl-ppo-1",     copy.ctrlPpo1],
      ["#p1-ctrl-ppo-2",     copy.ctrlPpo2],
      ["#p1-ctrl-ppo-3",     copy.ctrlPpo3],
      ["#p1-exp-title",      copy.expTitle],
      ["#p1-stat-1",         copy.stat1],
      ["#p1-stat-2",         copy.stat2],
      ["#p1-stat-3",         copy.stat3],
      ["#p1-stat-4",         copy.stat4],
      ["#p1-safety-title",   copy.safetyTitle],
      ["#p1-safety-text",    copy.safetyText],
      ["#p1-charts-title",   copy.chartsTitle],
      ["#p1-chart1-title",   copy.chart1Title],
      ["#p1-chart2-title",   copy.chart2Title],
      ["#p1-raw-title",      copy.rawTitle],
      ["#p1-col-metric",     copy.colMetric],
      ["#p1-col-rmpc-nom",   copy.colRmpcNom],
      ["#p1-col-ppo-nom",    copy.colPpoNom],
      ["#p1-col-rmpc-den",   copy.colRmpcDen],
      ["#p1-col-ppo-den",    copy.colPpoDen],
      ["#p1-row-success",    copy.rowSuccess],
      ["#p1-row-collision",  copy.rowCollision],
      ["#p1-row-timeout",    copy.rowTimeout],
      ["#p1-row-xtemean",    copy.rowXteMean],
      ["#p1-row-xtein",      copy.rowXteIn],
      ["#p1-row-xteout",     copy.rowXteOut],
      ["#p1-deg-title",      copy.degTitle],
      ["#p1-deg-m1",         copy.degM1],
      ["#p1-deg-m2",         copy.degM2],
      ["#p1-deg-m3",         copy.degM3],
      ["#p1-deg-m4",         copy.degM4],
      ["#p1-deg-d1",         copy.degD1],
      ["#p1-deg-d2",         copy.degD2],
      ["#p1-deg-d3",         copy.degD3],
      ["#p1-deg-d4",         copy.degD4],
      ["#p1-deg-note",       copy.degNote],
      ["#p1-setup-title",    copy.setupTitle],
      ["#p1-setup-1",        copy.setup1],
      ["#p1-setup-2",        copy.setup2],
      ["#p1-setup-3",        copy.setup3],
      ["#p1-setup-4",        copy.setup4],
      ["#p1-key-title",      copy.keyTitle],
      ["#p1-key-text",       copy.keyText],
      ["#p1-work-title",     copy.workTitle],
      ["#p1-work-note",      copy.workNote],
      ["#p1-work-col-metric",copy.workColMetric],
      ["#p1-work-col-rmpc",  copy.workColRmpc],
      ["#p1-work-col-ppo",   copy.workColPpo],
      ["#p1-work-row-impl",  copy.workRowImpl],
      ["#p1-work-row-train", copy.workRowTrain],
      ["#p1-work-row-speed", copy.workRowSpeed],
      ["#p1-verdict-title",  copy.verdictTitle],
      ["#p1-v1-badge",       copy.v1Badge],
      ["#p1-v1-text",        copy.v1Text],
      ["#p1-v2-badge",       copy.v2Badge],
      ["#p1-v2-text",        copy.v2Text],
      ["#p1-v3-badge",       copy.v3Badge],
      ["#p1-v3-text",        copy.v3Text]
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

  // === COOKIE CONSENT + GA4 ===
  var GA_ID = "G-5QXQGJWG3M";
  var CONSENT_KEY = "cookie-consent";

  function _loadGA() {
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function _initConsent(lang) {
    var stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "accepted") { _loadGA(); return; }
    if (stored === "declined") { return; }

    var copy = {
      en: { text: "This site uses cookies for anonymous visit statistics (Google Analytics).", accept: "Accept", decline: "Decline" },
      fr: { text: "Ce site utilise des cookies pour des statistiques de visite anonymes (Google Analytics).", accept: "Accepter", decline: "Refuser" }
    }[lang] || {};

    var banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", lang === "fr" ? "Consentement aux cookies" : "Cookie consent");
    banner.innerHTML =
      '<p class="cookie-text">' + copy.text + '</p>' +
      '<div class="cookie-btns">' +
        '<button class="cookie-btn cookie-accept">' + copy.accept + '</button>' +
        '<button class="cookie-btn cookie-decline">' + copy.decline + '</button>' +
      '</div>';
    document.body.appendChild(banner);

    // Trigger slide-in on next paint
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { banner.classList.add("visible"); });
    });

    function dismiss() {
      banner.classList.remove("visible");
      setTimeout(function() { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 320);
    }
    banner.querySelector(".cookie-accept").addEventListener("click", function() {
      localStorage.setItem(CONSENT_KEY, "accepted");
      dismiss();
      _loadGA();
    });
    banner.querySelector(".cookie-decline").addEventListener("click", function() {
      localStorage.setItem(CONSENT_KEY, "declined");
      dismiss();
    });
  }

  // === HAMBURGER NAV TOGGLE ===
  (function() {
    var toggle = document.querySelector(".nav-toggle");
    var nav    = document.querySelector("nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function(e) {
      e.stopPropagation();
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function(e) {
      if (nav.classList.contains("open") && !nav.contains(e.target)) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    // Close on Escape
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  })();

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
  _initConsent(lang);
})();
