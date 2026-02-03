// year
    (["year","y"].forEach(id=>{const el=document.getElementById(id); if(el) el.textContent = new Date().getFullYear();}));

    // smooth scroll (hotfix: only for real anchors like "#projects", not just "#")
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const id = (a.getAttribute("href") || "").trim();
        if (id.length <= 1) return; // allow normal behavior for "#"
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // subtle cursor glow in hero (hotfix: guard if reduced motion hides glow)
    const glow = document.getElementById("glow");
    const hero = document.querySelector(".hero");
    function moveGlow(e){
      if (!glow || !hero) return;
      const r = hero.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      glow.style.left = x + "px";
      glow.style.top = y + "px";
    }
    if (hero){
      hero.addEventListener("mousemove", moveGlow);
      hero.addEventListener("touchmove", (e) => {
        if (!e.touches?.[0]) return;
        moveGlow(e.touches[0]);
      }, { passive: true });
    }



    // site root helper (supports hosting under subpaths if needed)
    function _siteRoot(){
      const meta = document.querySelector('meta[name="site-root"]');
      let root = meta ? (meta.getAttribute("content") || "/") : "/";
      if (!root.startsWith("/")) root = "/" + root;
      if (!root.endsWith("/")) root = root + "/";
      return root;
    }
    function _joinRoot(path){
      const root = _siteRoot();
      // path may start with "/" or not
      path = (path || "").replace(/^\/+/, "");
      return root + path;
    }

    // Projects system (featured + listing + per-project pages)
    async function _fetchText(url){
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error("fetch failed: " + url);
      return await r.text();
    }
    async function _fetchJSON(url){
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error("fetch failed: " + url);
      return await r.json();
    }
    function _getLang(){
      const u = new URL(window.location.href);
      const qp = (u.searchParams.get("lang") || "").toLowerCase();
      if (qp === "fr") return "fr";
      const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
      if (htmlLang.startsWith("fr")) return "fr";
      return "en";
    }
    function _parseFeaturedIds(cfgText){
      // expected line: "Featured projects: 1 3 7"
      const m = cfgText.match(/featured\s+projects\s*:\s*([0-9\s]+)/i);
      if (!m) return [];
      return m[1].trim().split(/\s+/).map(x => parseInt(x, 10)).filter(n => Number.isFinite(n));
    }
    function _projectHref(id, lang){
      const q = (lang === "fr") ? "?lang=fr" : "";
      return `${_siteRoot()}projects/project${id}.html${q}`;
    }
    function _escapeHtml(s){
      return (s ?? "").toString()
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }
    function _renderProjectCard(p, lang, opts={}){
      const title = p?.title?.[lang] || p?.title?.en || "";
      const desc = p?.description?.[lang] || p?.description?.en || "";
      const tags = Array.isArray(p?.tags) ? p.tags : [];
      const thumb = p?.thumbnail || "";
      const href = _projectHref(p.id, lang);
      const openLabel = (lang === "fr") ? "Ouvrir" : "Open";
      const html = `
        <article class="proj">
          <div class="proj-top">
            <div class="proj-media">
              <a class="proj-thumb" href="${href}" aria-label="${openLabel}: ${_escapeHtml(title)}">
                <img src="${thumb}" alt="" loading="lazy" />
              </a>
              <div>
                <h3>${_escapeHtml(title)}</h3>
                <p>${_escapeHtml(desc)}</p>
              </div>
            </div>
            <a class="pill" href="${href}">${openLabel}</a>
          </div>
          <div class="meta">
            ${tags.map(t=>`<span class="chip">${_escapeHtml(t)}</span>`).join("")}
          </div>
        </article>
      `;
      return html;
    }

    async function _initFeaturedProjects(){
      const host = document.getElementById("featured-projects");
      if (!host) return;

      const lang = _getLang();
      try{
        const [cfgText, all] = await Promise.all([
          _fetchText(_joinRoot("config.txt")),
          _fetchJSON(_joinRoot("projects/projects.json"))
        ]);
        const featured = _parseFeaturedIds(cfgText);
        const byId = new Map((all || []).map(p => [p.id, p]));
        const list = featured.length ? featured.map(id => byId.get(id)).filter(Boolean) : (all || []).slice(0, 3);

        if (!list.length){
          host.innerHTML = `<div class="small">${lang==="fr" ? "Aucun projet n’est configuré." : "No projects configured."}</div>`;
          return;
        }
        host.innerHTML = list.map(p => _renderProjectCard(p, lang)).join("");
      }catch(e){
        host.innerHTML = `<div class="small">${lang==="fr" ? "Impossible de charger les projets." : "Could not load projects."}</div>`;
      }
    }

    async function _initProjectsIndex(){
      const grid = document.getElementById("projects-grid");
      if (!grid) return;

      const lang = _getLang();
      try{
        const all = await _fetchJSON(_joinRoot("projects/projects.json"));
        if (!Array.isArray(all) || !all.length){
          grid.innerHTML = `<div class="small">${lang==="fr" ? "Aucun projet pour l’instant." : "No projects yet."}</div>`;
          return;
        }
        grid.innerHTML = all.map(p => _renderProjectCard(p, lang)).join("");
      }catch(e){
        grid.innerHTML = `<div class="small">${lang==="fr" ? "Impossible de charger la liste des projets." : "Could not load the projects list."}</div>`;
      }
    }

    async function _initProjectPage(){
      const idRaw = document.body?.getAttribute("data-project-id");
      if (!idRaw || idRaw === "__ID__") return;
      const pid = parseInt(idRaw, 10);
      if (!Number.isFinite(pid)) return;

      const lang = _getLang();
      try{
        const all = await _fetchJSON(_joinRoot("projects/projects.json"));
        const p = (Array.isArray(all) ? all : []).find(x => x.id === pid);
        if (!p) return;

        const title = p?.title?.[lang] || p?.title?.en || `Project ${pid}`;
        const desc = p?.description?.[lang] || p?.description?.en || "";
        const thumb = p?.thumbnail || "";
        const tags = Array.isArray(p?.tags) ? p.tags : [];

        const h1 = document.getElementById("proj-title");
        const d  = document.getElementById("proj-desc");
        const img = document.getElementById("proj-thumb");
        const meta = document.getElementById("proj-tags");
        if (h1) h1.textContent = title;
        if (d)  d.textContent = desc;
        if (img && thumb) img.src = thumb;
        if (meta) meta.innerHTML = tags.map(t=>`<span class="chip">${_escapeHtml(t)}</span>`).join("");

        document.title = `${title} — Leon Górecki`;
      }catch(e){
        // silent
      }
    }

    _initFeaturedProjects();
    _initProjectsIndex();
    _initProjectPage();
