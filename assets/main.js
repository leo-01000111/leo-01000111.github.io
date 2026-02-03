// year
    document.getElementById("year").textContent = new Date().getFullYear();

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
