/* FlipBoard — "Currently improving" split-flap display (home page only).
   Reads the JSON <script id="flip-data"> block that build_projects.py writes
   next to the board (a slug -> {short, href} map for every project, plus
   the build-time flip.json list as a fallback), then fetches the live
   /projects/flip.json so an edit to that file take effect without a
   rebuild. Picks the day's project (Europe/Paris calendar date, same for
   every visitor), rebuilds the tile grid to the widest string the board
   will ever show, and animates into place once per page load when the
   board scrolls into view. */
(function () {
  "use strict";

  var board = document.querySelector("[data-flip-board]");
  if (!board) return;
  var dataEl = document.getElementById("flip-data");
  if (!dataEl) return;

  var DATA;
  try {
    DATA = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  var LINE1 = DATA.line1 || "";
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The flap's mechanical alphabet: blank first (a real flap's rest state),
  // then the characters this board will ever need to cycle through.
  var ALPHABET =
    " ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÉÈÊËÎÏÔÙÛÜŸÇ0123456789.:-'";

  function shortFor(slug) {
    var p = DATA.projects && DATA.projects[slug];
    return (p && p.short) || slug;
  }

  function hrefFor(slug) {
    var p = DATA.projects && DATA.projects[slug];
    return (p && p.href) || null;
  }

  // Paris calendar date -> a day number (days since 1970-01-01, computed in
  // UTC from the y/m/d parts) -> pick list[dayNumber % list.length]. Every
  // visitor on the same Paris calendar day sees the same project.
  function daySlug(list) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    var y, m, d;
    parts.forEach(function (p) {
      if (p.type === "year") y = +p.value;
      if (p.type === "month") m = +p.value;
      if (p.type === "day") d = +p.value;
    });
    var dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    var idx = ((dayNumber % list.length) + list.length) % list.length;
    return list[idx];
  }

  function buildTiles(line, text, cols) {
    line.innerHTML = "";
    var chars = text.toUpperCase().split("");
    for (var i = 0; i < cols; i++) {
      var ch = chars[i] || "";
      var tile = document.createElement("span");
      tile.className = "hp-flip__tile";
      var face = document.createElement("span");
      face.className = "hp-flip__face";
      face.textContent = reduceMotion ? ch : "";
      var flap = document.createElement("span");
      flap.className = "hp-flip__flap";
      flap.setAttribute("aria-hidden", "true");
      line.appendChild(tile);
      tile.appendChild(face);
      tile.appendChild(flap);
      tile._target = ch;
    }
  }

  // Flip one tile through a few intermediate characters before landing on
  // its target, staggered by a small per-tile delay so the row ripples
  // left to right like a real board.
  function animateLine(line, onDone) {
    var tiles = Array.prototype.slice.call(line.children);
    var stepMs = 150,
      gapMs = 40,
      stagger = 18,
      steps = 3;
    var maxEnd = 0;

    tiles.forEach(function (tile, i) {
      var target = tile._target;
      var face = tile.querySelector(".hp-flip__face");
      var flap = tile.querySelector(".hp-flip__flap");
      var ti = ALPHABET.indexOf(target);
      var seq;
      if (ti < 0) {
        seq = [target];
      } else {
        seq = [];
        for (var s = steps; s >= 1; s--) {
          seq.push(ALPHABET[(ti - s + ALPHABET.length * 2) % ALPHABET.length]);
        }
        seq.push(target);
      }
      var t0 = i * stagger;
      seq.forEach(function (ch, si) {
        var start = t0 + si * (stepMs + gapMs);
        setTimeout(function () {
          flap.textContent = face.textContent;
          flap.classList.remove("is-flipping");
          void flap.offsetWidth; // restart the CSS animation
          flap.classList.add("is-flipping");
          setTimeout(function () {
            face.textContent = ch;
            flap.classList.remove("is-flipping");
          }, stepMs);
        }, start);
        var end = start + stepMs;
        if (end > maxEnd) maxEnd = end;
      });
    });

    setTimeout(onDone, maxEnd + 20);
  }

  function start(list) {
    if (!list || !list.length) return;
    var slug = daySlug(list);
    var short = shortFor(slug);
    var href = hrefFor(slug);
    if (href) board.setAttribute("href", href);
    board.setAttribute("aria-label", LINE1.replace(/ /g, " ") + " " + short);

    var maxShort = 0;
    list.forEach(function (s) {
      maxShort = Math.max(maxShort, shortFor(s).length);
    });
    var cols = Math.max(LINE1.length, maxShort);
    board.style.setProperty("--flip-cols", cols);

    var line1 = board.querySelector('[data-flip-line="0"]');
    var line2 = board.querySelector('[data-flip-line="1"]');
    if (!line1 || !line2) return;
    buildTiles(line1, LINE1, cols);
    buildTiles(line2, short, cols);

    if (reduceMotion) return; // final text already set by buildTiles above

    var run = function () {
      animateLine(line1, function () {
        setTimeout(function () {
          animateLine(line2, function () {});
        }, 500);
      });
    };

    if (!("IntersectionObserver" in window)) {
      run();
      return;
    }
    var observed = false;
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !observed) {
            observed = true;
            obs.disconnect(); // once per page load: no re-flip on scroll-away/back
            run();
          }
        });
      },
      { threshold: 0.5 }
    );
    obs.observe(board);
  }

  var buildTimeList =
    (DATA.list && DATA.list.length && DATA.list) || null;

  fetch("/projects/flip.json")
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (j) {
      var list =
        j && Array.isArray(j["flip-through-projects"]) && j["flip-through-projects"].length
          ? j["flip-through-projects"]
          : buildTimeList;
      start(list);
    })
    .catch(function () {
      start(buildTimeList);
    });
})();
