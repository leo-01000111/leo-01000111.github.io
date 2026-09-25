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
  _initBackToTop();
})();
