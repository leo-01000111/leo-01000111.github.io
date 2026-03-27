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
        repoBtn: "View repo",
        source: "BEng thesis — Warsaw University of Technology, Nov 2025. Supervisor: Prof. Marcin Żugaj, DSc, Eng.",
        // In action
        actionTitle: "In action — GNSS-denied run, environment 044",
        actionDesc: "Same environment, same conditions. Watch how each controller handles the denial zone.",
        // Context
        ctxTitle: "What this thesis is about",
        ctxText:
          "Full title: \"A Comparative Analysis of Reinforcement Learning and Robust Model Predictive Control under GNSS-denial conditions using a mobile robot platform.\" " +
          "A simulated Roomba navigates cluttered indoor environments, following a reference path to a goal while avoiding obstacles and a local GNSS-denial zone. " +
          "The research objective was a structured comparison across four dimensions: stability, accuracy, robustness, and computational load — " +
          "under both nominal GPS and actively jammed conditions. " +
          "Both controllers were benchmarked across 500 identical environments to ensure a fair, reproducible comparison.",
        // Controllers
        ctrlTitle: "Controllers at a glance",
        ctrlRmpcName: "Tube Robust MPC",
        ctrlRmpc1: "Predicts future states using an explicit dynamics model with LQR disturbance rejection",
        ctrlRmpc2: "Tube formulation bounds the effect of noise — hard obstacle-avoidance constraints guaranteed",
        ctrlRmpc3: "Conservative by design; 10–15% timeout rate signals a need for constraint relaxation in real deployments",
        ctrlPpoName: "Proximal Policy Optimisation (PPO)",
        ctrlPpo1: "End-to-end learned policy via multi-stage curriculum training — no explicit system model",
        ctrlPpo2: "Single neural-network forward pass; 63× faster online than RMPC",
        ctrlPpo3: "3–5% collision rate partly reflects a reward-shape conflict, not purely a fundamental RL limitation",
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
          "RMPC is the clear winner where safety is non-negotiable. Zero collisions across 1 000 runs and formally guaranteed obstacle-avoidance constraints make it the right choice for safety-critical applications. " +
          "Real weakness: a 10–15% timeout rate — the receding-horizon solver occasionally cannot find a feasible path in time, which would require constraint relaxation or a fallback controller in a real deployment.",
        v2Badge: "Flexibility & Online Speed",
        v2Text:
          "PPO matched or exceeded RMPC on success rate and runs 63× faster online. " +
          "A notable intra-controller result: PPO's XTE was lower inside the denial zone (0.21 m) than outside it (0.87 m) — suggesting it holds the path reasonably well during denial but accumulates drift that compounds after GPS returns. " +
          "The 3–5% collision rate is partly a reward-shaping artifact — path-following and obstacle-avoidance objectives were in conflict during training — not necessarily a ceiling for the approach.",
        v3Badge: "Honest Takeaway",
        v3Text:
          "No universal winner — and the honest caveat from the defense: the test environment may have been too simple for a fully fair verdict. " +
          "RMPC excels when slow operation (~20 fps) is acceptable and safety guarantees are required. " +
          "PPO's relative strengths in adaptability and noise rejection would likely become more pronounced in more complex environments with harsher disturbances. " +
          "The thesis establishes a reproducible baseline; a definitive comparison would require both controllers at equal levels of optimisation."
      },
      fr: {
        pdfBtn: "Ouvrir le PDF du mémoire",
        repoBtn: "Voir le dépôt",
        source: "Mémoire de licence — Université de Technologie de Varsovie, nov. 2025. Directeur : Prof. Marcin Żugaj, DSc, Ing.",
        // In action
        actionTitle: "En action — course avec refus GNSS, environnement 044",
        actionDesc: "Même environnement, mêmes conditions. Observez comment chaque contrôleur gère la zone de refus.",
        // Context
        ctxTitle: "De quoi parle cette thèse",
        ctxText:
          "Titre complet : « Analyse comparative de l'apprentissage par renforcement et du contrôle prédictif robuste en conditions de refus GNSS sur une plateforme robotique mobile. » " +
          "Un Roomba simulé navigue dans des environnements intérieurs encombrés, en suivant une trajectoire de référence tout en évitant les obstacles et une zone de refus GNSS locale. " +
          "L'objectif de recherche était une comparaison structurée selon quatre dimensions : stabilité, précision, robustesse et charge de calcul — " +
          "en conditions nominales et avec brouillage actif. " +
          "Les deux contrôleurs ont été comparés sur 500 environnements identiques pour garantir une comparaison équitable et reproductible.",
        // Controllers
        ctrlTitle: "Les contrôleurs en un coup d'œil",
        ctrlRmpcName: "Tube Robust MPC",
        ctrlRmpc1: "Prédit les états futurs via un modèle dynamique explicite avec rejet de perturbations par LQR",
        ctrlRmpc2: "La formulation tube borne l'effet du bruit — contraintes d'évitement d'obstacles garanties",
        ctrlRmpc3: "Conservateur par construction ; taux de timeout de 10–15 % nécessitant une relaxation des contraintes en déploiement réel",
        ctrlPpoName: "Proximal Policy Optimisation (PPO)",
        ctrlPpo1: "Politique apprise de bout en bout par curriculum d'entraînement progressif — sans modèle explicite",
        ctrlPpo2: "Passage direct dans un réseau de neurones ; 63× plus rapide en ligne que RMPC",
        ctrlPpo3: "Taux de collision de 3–5 % en partie dû à un conflit de récompenses, pas nécessairement une limite fondamentale",
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
          "RMPC est le grand gagnant là où la sécurité est non-négociable. Zéro collision sur 1 000 courses et garanties formelles d'évitement font de lui le choix approprié pour les applications critiques. " +
          "Point faible réel : un taux de timeout de 10–15 % — le solveur à horizon glissant ne trouve parfois pas de trajectoire faisable à temps, ce qui nécessiterait une relaxation des contraintes ou un contrôleur de secours en déploiement réel.",
        v2Badge: "Flexibilité & Vitesse en ligne",
        v2Text:
          "PPO égale ou dépasse RMPC sur le taux de succès brut et est 63× plus rapide en ligne. " +
          "Résultat intra-contrôleur notable : la XTE de PPO est plus faible à l'intérieur de la zone de refus (0,21 m) qu'à l'extérieur (0,87 m) — il maintient la trajectoire correctement pendant le refus, mais accumule une dérive qui s'amplifie après le retour du GPS. " +
          "Le taux de collision de 3–5 % est en partie un artefact de la forme de récompense — conflit entre suivi de trajectoire et évitement d'obstacles durant l'entraînement — et non nécessairement un plafond fondamental.",
        v3Badge: "À retenir honnêtement",
        v3Text:
          "Pas de gagnant universel — et l'aveu honnête de la soutenance : l'environnement de test était peut-être trop simple pour un verdict définitif. " +
          "RMPC excelle quand une opération lente (~20 fps) est acceptable et que des garanties de sécurité sont requises. " +
          "Les forces relatives de PPO en adaptabilité et rejet du bruit se manifesteraient davantage dans des environnements plus complexes avec des perturbations plus sévères. " +
          "La thèse établit une base reproductible ; une comparaison définitive nécessiterait les deux contrôleurs au même niveau d'optimisation."
      }
    }[lang] || {};

    const map = [
      ["#p1-pdf-btn",        copy.pdfBtn],
      ["#p1-repo-btn",       copy.repoBtn],
      ["#p1-source",         copy.source],
      ["#p1-action-title",   copy.actionTitle],
      ["#p1-action-desc",    copy.actionDesc],
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
  function _setLgflowPageCopy(lang) {
    const slug = (document.body?.getAttribute("data-project-slug") || "").trim();
    const pid  = (document.body?.getAttribute("data-project-id")   || "").trim();
    if (slug !== "lgflow" && pid !== "3") return;

    const copy = {
      en: {
        kicker:     "CFD · Simulation · C++",
        repoBtn:    "View repo \u2197",
        ctxTitle:   "What it is",
        ctxText:
          "LG-FLOW is a research-grade 2D incompressible Navier-Stokes solver built in C++20. " +
          "It implements the Finite Volume Method (FVM) with SIMPLE pressure-velocity coupling on a staggered grid, " +
          "and validates against the canonical Ghia et al. (1982) lid-driven cavity benchmark at Re\u202f=\u202f100 and Re\u202f=\u202f1000. " +
          "Designed for clarity and correctness, it outputs per-iteration residuals, centerline velocity profiles, " +
          "VTK snapshots, and L2/L\u221e error metrics.",
        techTitle:  "Technical stack",
        tc1Label: "Language",    tc1Value: "C++20 (GCC 11+, Clang 14+, MSVC 19.29+)",
        tc2Label: "Method",      tc2Value: "Finite Volume Method \u00b7 SIMPLE pressure-velocity coupling",
        tc3Label: "Libraries",   tc3Value: "Eigen3 (linear algebra) \u00b7 GoogleTest (unit testing)",
        tc4Label: "Build",       tc4Value: "CMake 3.20+",
        tc5Label: "Convection",  tc5Value: "Upwind \u00b7 Central difference \u00b7 Adaptive CFL clamping",
        tc6Label: "Output",      tc6Value: "VTK snapshots \u00b7 Centerline velocity profiles \u00b7 L2/L\u221e error metrics \u00b7 CSV residuals",
        valTitle:  "Validation \u2014 Ghia et al. lid-driven cavity",
        valDesc:
          "The solver is benchmarked against Ghia, Ghia & Shin (1982), the canonical reference for 2D incompressible lid-driven cavity flow. " +
          "Both Re\u202f=\u202f100 and Re\u202f=\u202f1000 cases pass automated L2/L\u221e error thresholds.",
        vthCase: "Case", vthRe: "Re", vthRef: "Reference", vthStatus: "Status",
        vc1Case: "Lid-driven cavity", vc2Case: "Lid-driven cavity",
        pass1: "PASS", pass2: "PASS",
        valNote:
          "Validation is automated: the solver exits with a non-zero code if any metric falls outside tolerance \u2014 machine-readable for CI pipelines.",
        phaseTitle: "Implementation highlights",
        p1: "Staggered grid with collocated pressure \u2014 avoids pressure-velocity decoupling",
        p2: "SIMPLE pressure-correction loop with configurable multi-pass solving",
        p3: "Stencil-consistent discretisation \u2014 same interpolation scheme throughout",
        p4: "Automated validation suite: machine-readable pass/fail with configurable exit codes",
        p5: "VTK export for post-processing in ParaView or similar tools"
      },
      fr: {
        kicker:     "CFD \u00b7 Simulation \u00b7 C++",
        repoBtn:    "Voir le d\u00e9p\u00f4t \u2197",
        ctxTitle:   "Pr\u00e9sentation",
        ctxText:
          "LG-FLOW est un solveur 2D incompressible de Navier-Stokes \u00e0 vis\u00e9e p\u00e9dagogique et de recherche, \u00e9crit en C++20. " +
          "Il impl\u00e9mente la m\u00e9thode des volumes finis (FVM) avec couplage pression-vitesse SIMPLE sur une grille d\u00e9cal\u00e9e, " +
          "et se valide sur le cas de r\u00e9f\u00e9rence de Ghia et al. (1982) en cavit\u00e9 entra\u00een\u00e9e pour Re\u202f=\u202f100 et Re\u202f=\u202f1000. " +
          "Les sorties comprennent les r\u00e9sidus par it\u00e9ration, les profils de vitesse sur la ligne centrale, " +
          "des instantan\u00e9s VTK et les m\u00e9triques d\u2019erreur L2/L\u221e.",
        techTitle:  "Stack technique",
        tc1Label: "Langage",     tc1Value: "C++20 (GCC 11+, Clang 14+, MSVC 19.29+)",
        tc2Label: "M\u00e9thode", tc2Value: "Volumes finis (FVM) \u00b7 Couplage SIMPLE",
        tc3Label: "Biblioth\u00e8ques", tc3Value: "Eigen3 (alg\u00e8bre lin\u00e9aire) \u00b7 GoogleTest (tests unitaires)",
        tc4Label: "Build",       tc4Value: "CMake 3.20+",
        tc5Label: "Convection",  tc5Value: "Upwind \u00b7 Diff\u00e9rences centr\u00e9es \u00b7 CFL adaptatif",
        tc6Label: "Sorties",     tc6Value: "Instantan\u00e9s VTK \u00b7 Profils de vitesse \u00b7 M\u00e9triques L2/L\u221e \u00b7 R\u00e9sidus CSV",
        valTitle:  "Validation \u2014 cavit\u00e9 entra\u00een\u00e9e de Ghia et al.",
        valDesc:
          "Le solveur est bench contre Ghia, Ghia & Shin (1982), la r\u00e9f\u00e9rence canonique pour l\u2019\u00e9coulement incompressible en cavit\u00e9 entra\u00een\u00e9e 2D. " +
          "Les deux cas Re\u202f=\u202f100 et Re\u202f=\u202f1000 passent les seuils d\u2019erreur L2/L\u221e automatis\u00e9s.",
        vthCase: "Cas", vthRe: "Re", vthRef: "R\u00e9f\u00e9rence", vthStatus: "Statut",
        vc1Case: "Cavit\u00e9 entra\u00een\u00e9e", vc2Case: "Cavit\u00e9 entra\u00een\u00e9e",
        pass1: "OK", pass2: "OK",
        valNote:
          "La validation est automatis\u00e9e : le solveur retourne un code non nul si une m\u00e9trique d\u00e9passe la tol\u00e9rance \u2014 compatible avec les pipelines CI.",
        phaseTitle: "Points cl\u00e9s d\u2019impl\u00e9mentation",
        p1: "Grille d\u00e9cal\u00e9e avec pression colloqu\u00e9e \u2014 \u00e9vite le d\u00e9couplage pression-vitesse",
        p2: "Boucle de correction de pression SIMPLE avec multi-passes configurables",
        p3: "Discr\u00e9tisation stencil-coh\u00e9rente \u2014 m\u00eame sch\u00e9ma d\u2019interpolation partout",
        p4: "Suite de validation automatis\u00e9e : pass/fail lisible par machine avec codes de sortie configurables",
        p5: "Export VTK pour post-traitement dans ParaView ou \u00e9quivalent"
      }
    }[lang] || {};

    const map = [
      ["#lg-kicker",     copy.kicker],
      ["#lg-repo-btn",   copy.repoBtn],
      ["#lg-ctx-title",  copy.ctxTitle],
      ["#lg-ctx-text",   copy.ctxText],
      ["#lg-tech-title", copy.techTitle],
      ["#lg-tc1-label",  copy.tc1Label], ["#lg-tc1-value", copy.tc1Value],
      ["#lg-tc2-label",  copy.tc2Label], ["#lg-tc2-value", copy.tc2Value],
      ["#lg-tc3-label",  copy.tc3Label], ["#lg-tc3-value", copy.tc3Value],
      ["#lg-tc4-label",  copy.tc4Label], ["#lg-tc4-value", copy.tc4Value],
      ["#lg-tc5-label",  copy.tc5Label], ["#lg-tc5-value", copy.tc5Value],
      ["#lg-tc6-label",  copy.tc6Label], ["#lg-tc6-value", copy.tc6Value],
      ["#lg-val-title",  copy.valTitle],
      ["#lg-val-desc",   copy.valDesc],
      ["#lg-vth-case",   copy.vthCase],
      ["#lg-vth-re",     copy.vthRe],
      ["#lg-vth-ref",    copy.vthRef],
      ["#lg-vth-status", copy.vthStatus],
      ["#lg-vc1-case",   copy.vc1Case],
      ["#lg-vc2-case",   copy.vc2Case],
      ["#lg-pass1",      copy.pass1],
      ["#lg-pass2",      copy.pass2],
      ["#lg-val-note",   copy.valNote],
      ["#lg-phase-title",copy.phaseTitle],
      ["#lg-p1",         copy.p1],
      ["#lg-p2",         copy.p2],
      ["#lg-p3",         copy.p3],
      ["#lg-p4",         copy.p4],
      ["#lg-p5",         copy.p5]
    ];
    map.forEach(([selector, text]) => {
      if (!text) return;
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    });
  }

  function _setF1PageCopy(lang) {
    const slug = (document.body?.getAttribute("data-project-slug") || "").trim();
    const pid  = (document.body?.getAttribute("data-project-id")   || "").trim();
    if (slug !== "f1predictor" && pid !== "4") return;

    const copy = {
      en: {
        kicker:    "Machine Learning \u00b7 Formula 1",
        repoBtn:   "View repo \u2197",
        ctxTitle:  "What it does",
        ctxText:
          "A machine learning pipeline that predicts Formula 1 podium probabilities (P1/P2/P3) for upcoming races, " +
          "trained on historical data spanning 2014\u20132024. " +
          "The system ingests qualifying results, driver and team history, circuit characteristics and live weather data, " +
          "then runs an XGBoost\u202f+\u202fPyTorch ensemble to generate calibrated podium probability estimates. " +
          "Results are delivered via a Streamlit dashboard.",
        pipeTitle: "Prediction pipeline",
        pipe1: "Data ingestion \u2014 Qualifying results (OpenF1), historical race outcomes 2014\u20132024 (FastF1), circuit data, and live weather (Open-Meteo).",
        pipe2: "Feature engineering \u2014 Driver form metrics, team performance trends, grid position advantage, and weather-adjusted pace estimates.",
        pipe3: "Ensemble inference \u2014 Three XGBoost binary classifiers (one per podium position) combined with a PyTorch MLP with driver and team embeddings, stacked via logistic regression.",
        pipe4: "Probability calibration \u2014 Isotonic regression post-processing for reliable probability outputs across all podium positions.",
        pipe5: "Dashboard delivery \u2014 Results served via a Streamlit web app with race-by-race probability breakdowns.",
        archTitle: "Model architecture",
        ac1Label: "XGBoost layer",  ac1Value: "3 binary classifiers (P1, P2, P3) trained independently on engineered features",
        ac2Label: "PyTorch layer",  ac2Value: "MLP with learnable driver and constructor embeddings \u2014 captures latent team/driver identity",
        ac3Label: "Stacking",       ac3Value: "Logistic regression meta-learner combines XGBoost and PyTorch outputs",
        ac4Label: "Calibration",    ac4Value: "Isotonic regression post-processing for well-calibrated probability estimates",
        dataTitle: "Data sources",
        ds1: "Historical race results, lap times and telemetry (2014\u20132024 seasons)",
        ds2: "Live qualifying data for upcoming races",
        ds3: "Circuit weather conditions \u2014 temperature, rain probability, wind speed",
        ds4: "Optional: Reddit sentiment analysis on driver and team news pre-race",
        evalTitle: "Evaluation",
        evalText:
          "Performance is assessed through leave-one-season-out cross-validation and a holdout set covering the 2023\u20132024 seasons (unseen during training). " +
          "Metrics include Brier score, log loss, ROC-AUC, winner accuracy and podium overlap."
      },
      fr: {
        kicker:    "Machine Learning \u00b7 Formule 1",
        repoBtn:   "Voir le d\u00e9p\u00f4t \u2197",
        ctxTitle:  "Ce que \u00e7a fait",
        ctxText:
          "Pipeline d\u2019apprentissage automatique qui pr\u00e9dit les probabilit\u00e9s de podium F1 (P1/P2/P3) pour les prochaines courses, " +
          "entra\u00een\u00e9 sur des donn\u00e9es historiques de 2014 \u00e0 2024. " +
          "Le syst\u00e8me int\u00e8gre les r\u00e9sultats des qualifications, l\u2019historique pilotes/\u00e9curies, les caract\u00e9ristiques des circuits et la m\u00e9t\u00e9o en direct, " +
          "puis ex\u00e9cute un ensemble XGBoost\u202f+\u202fPyTorch pour produire des probabilit\u00e9s de podium calibr\u00e9es. " +
          "Les r\u00e9sultats sont affich\u00e9s via un tableau de bord Streamlit.",
        pipeTitle: "Pipeline de pr\u00e9diction",
        pipe1: "Collecte des donn\u00e9es \u2014 Qualifications (OpenF1), r\u00e9sultats historiques 2014\u20132024 (FastF1), donn\u00e9es circuit, m\u00e9t\u00e9o en direct (Open-Meteo).",
        pipe2: "Ing\u00e9nierie de features \u2014 M\u00e9triques de forme pilote, tendances des \u00e9curies, avantage de position sur la grille et estimations de rythme ajust\u00e9es \u00e0 la m\u00e9t\u00e9o.",
        pipe3: "Inf\u00e9rence ensemble \u2014 Trois classifieurs binaires XGBoost (un par position de podium) combin\u00e9s avec un MLP PyTorch avec embeddings pilotes et \u00e9curies, empil\u00e9s par r\u00e9gression logistique.",
        pipe4: "Calibration des probabilit\u00e9s \u2014 Post-traitement par r\u00e9gression isotonique pour des estimations fiables.",
        pipe5: "Livraison tableau de bord \u2014 R\u00e9sultats affich\u00e9s via une application Streamlit avec d\u00e9tail course par course.",
        archTitle: "Architecture du mod\u00e8le",
        ac1Label: "Couche XGBoost",  ac1Value: "3 classifieurs binaires (P1, P2, P3) entra\u00een\u00e9s ind\u00e9pendamment sur des features ing\u00e9ni\u00e9r\u00e9es",
        ac2Label: "Couche PyTorch",  ac2Value: "MLP avec embeddings apprenables pilotes et \u00e9curies \u2014 capture l\u2019identit\u00e9 latente",
        ac3Label: "Empilement",      ac3Value: "M\u00e9ta-apprenant logistique combinant les sorties XGBoost et PyTorch",
        ac4Label: "Calibration",     ac4Value: "R\u00e9gression isotonique pour des probabilit\u00e9s bien calibr\u00e9es",
        dataTitle: "Sources de donn\u00e9es",
        ds1: "R\u00e9sultats historiques, temps au tour et t\u00e9l\u00e9m\u00e9trie (saisons 2014\u20132024)",
        ds2: "Donn\u00e9es de qualification en direct pour les prochaines courses",
        ds3: "Conditions m\u00e9t\u00e9o sur circuit \u2014 temp\u00e9rature, probabilit\u00e9 de pluie, vent",
        ds4: "Optionnel : analyse de sentiment Reddit sur les pilotes et \u00e9curies avant la course",
        evalTitle: "\u00c9valuation",
        evalText:
          "La performance est \u00e9valu\u00e9e par validation crois\u00e9e leave-one-season-out et un ensemble de test couvrant les saisons 2023\u20132024 (non vus pendant l\u2019entra\u00eenement). " +
          "Les m\u00e9triques incluent le Brier score, la log loss, le ROC-AUC, la pr\u00e9cision du gagnant et le chevauchement de podium."
      }
    }[lang] || {};

    const map = [
      ["#f1-kicker",     copy.kicker],
      ["#f1-repo-btn",   copy.repoBtn],
      ["#f1-ctx-title",  copy.ctxTitle],
      ["#f1-ctx-text",   copy.ctxText],
      ["#f1-pipe-title", copy.pipeTitle],
      ["#f1-pipe1",      copy.pipe1],
      ["#f1-pipe2",      copy.pipe2],
      ["#f1-pipe3",      copy.pipe3],
      ["#f1-pipe4",      copy.pipe4],
      ["#f1-pipe5",      copy.pipe5],
      ["#f1-arch-title", copy.archTitle],
      ["#f1-ac1-label",  copy.ac1Label], ["#f1-ac1-value", copy.ac1Value],
      ["#f1-ac2-label",  copy.ac2Label], ["#f1-ac2-value", copy.ac2Value],
      ["#f1-ac3-label",  copy.ac3Label], ["#f1-ac3-value", copy.ac3Value],
      ["#f1-ac4-label",  copy.ac4Label], ["#f1-ac4-value", copy.ac4Value],
      ["#f1-data-title", copy.dataTitle],
      ["#f1-ds1",        copy.ds1],
      ["#f1-ds2",        copy.ds2],
      ["#f1-ds3",        copy.ds3],
      ["#f1-ds4",        copy.ds4],
      ["#f1-eval-title", copy.evalTitle],
      ["#f1-eval-text",  copy.evalText]
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
    _setLgflowPageCopy(lang);
    _setF1PageCopy(lang);
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
  // Fix "All projects" link to carry lang=fr when applicable
  document.querySelectorAll("[data-ui='allProjects']").forEach(function(a) {
    if (lang === "fr") {
      var href = a.getAttribute("href") || "";
      if (!href.includes("lang=fr")) {
        a.setAttribute("href", href + (href.includes("?") ? "&" : "?") + "lang=fr");
      }
    }
  });
  _initFeaturedProjects(lang);
  _initProjectsIndex(lang);
  _initProjectPage(lang);
  _initSeeAlso(lang);
  _initBackToTop();
  _initReveal();
  _initConsent(lang);
})();
