// === F1 model vs market: betting calculator ===
// Data: the "market" block of /projects/f1-predictions.json (scripts/export_site_json.py
// in the F1-Predictor repo): per race, the published model probabilities next to the
// Kalshi win/podium prices after qualifying and at the start, plus the result.
// Replays the season with a flat stake on every driver the model rates above the price.
(function() {
  var DATA_URL = "/projects/f1-predictions.json?t=" + Date.now();
  var STAKE = 10;

  var copy = {
    en: {
      title: "Model vs market",
      intro: "Could you have beaten the betting market with this model? The calculator replays the season against Kalshi, a US prediction exchange, and puts €10 on every front-runner the model rates higher than the price.",
      market: "Market", win: "Winner", podium: "Podium",
      when: "Odds taken", whenPred: "After qualifying", whenStart: "At lights out",
      top: "Drivers considered", top1: "Favourite", top3: "Top 3", top6: "Top 6",
      topHelp: "The model is built to find the podium: its numbers for the front of the grid are meaningful, the rest of the field's are not. Only the model's top drivers in each race are ever bet on.",
      margin: "Bookmaker margin",
      marginHelp: "Kalshi's prices already add up to 10-15% more than 100% across the field. A bookmaker takes its own cut on top: the price you pay is the Kalshi price plus this margin. 0% is Kalshi's mid price with no fees.",
      edge: "Minimum edge",
      edgeHelp: "Bet only when the model's probability beats the price you pay by at least this many percentage points. 5 pts means a 35% chance against a 30% price.",
      profit: "profit", roi: "return on stake", bets: "bets won",
      strategies: "Strategies", strategy: "Strategy", nBets: "Bets", won: "Won", pl: "Profit", roiShort: "Return",
      sValue: "Model above the price", sModel: "Model's favourite every race", sMarket: "Market favourite every race",
      chart: "Cumulative profit by round",
      score: "Who forecast better",
      scoreText: function(m, k, b, n) { return "Log loss, lower is better: model " + m + ", market " + k + ". The model was closer in " + b + " of " + n + " races."; },
      scoreNote: "Market prices rescaled to sum to 100% (winner) or 300% (podium) before scoring.",
      betsList: "Every bet",
      atOdds: "at", lost: "lost", none: "No bets with these settings.",
      warnTitle: "Not betting advice",
      warn: "This is a model-evaluation tool. One season is a small sample: a single long-shot win can turn the totals around, and past results say little about the next race. Kalshi is not open to most of Europe, and bookmakers limit accounts that keep winning. Gambling can be addictive and is for adults only (18+).",
      help: "If gambling is causing problems for you or someone close to you:",
      helpLines: [
        ["Gambling Therapy", "free online support in any language", "https://www.gamblingtherapy.org"],
        ["France: Joueurs Info Service", "09 74 75 13 13", "https://www.joueurs-info-service.fr"],
        ["Poland: Telefon Zaufania Uzależnień Behawioralnych", "801 889 880", null],
        ["UK: National Gambling Helpline", "0808 8020 133", "https://www.gamcare.org.uk"],
        ["Other countries", "findahelpline.com", "https://findahelpline.com/topics/gambling"]
      ],
      error: "Could not load the market data."
    },
    fr: {
      title: "Modèle contre marché",
      intro: "Aurait-on pu battre le marché des paris avec ce modèle ? Le calculateur rejoue la saison face à Kalshi, une bourse de prédiction américaine, et mise 10 € sur chaque pilote de tête que le modèle juge plus probable que son prix.",
      market: "Marché", win: "Vainqueur", podium: "Podium",
      when: "Cotes prises", whenPred: "Après les qualifications", whenStart: "Au départ",
      top: "Pilotes retenus", top1: "Favori", top3: "Top 3", top6: "Top 6",
      topHelp: "Le modèle est conçu pour trouver le podium : ses chiffres pour l'avant de la grille ont du sens, ceux du reste du plateau non. Seuls les premiers pilotes du modèle sont joués à chaque course.",
      margin: "Marge du bookmaker",
      marginHelp: "Les prix de Kalshi dépassent déjà 100 % de 10 à 15 % sur l'ensemble du plateau. Un bookmaker prend sa propre marge en plus : le prix payé est celui de Kalshi plus cette marge. 0 % correspond au prix médian de Kalshi, sans frais.",
      edge: "Avantage minimum",
      edgeHelp: "Ne miser que si la probabilité du modèle dépasse le prix payé d'au moins ce nombre de points. 5 pts : 35 % de chances contre un prix de 30 %.",
      profit: "gain", roi: "rendement de la mise", bets: "paris gagnés",
      strategies: "Stratégies", strategy: "Stratégie", nBets: "Paris", won: "Gagnés", pl: "Gain", roiShort: "Rendement",
      sValue: "Modèle au-dessus du prix", sModel: "Favori du modèle à chaque course", sMarket: "Favori du marché à chaque course",
      chart: "Gain cumulé par manche",
      score: "Qui a le mieux prédit",
      scoreText: function(m, k, b, n) { return "Perte logarithmique, plus bas = mieux : modèle " + m + ", marché " + k + ". Le modèle a été plus proche dans " + b + " courses sur " + n + "."; },
      scoreNote: "Prix du marché ramenés à 100 % (vainqueur) ou 300 % (podium) avant le calcul.",
      betsList: "Tous les paris",
      atOdds: "à", lost: "perdu", none: "Aucun pari avec ces réglages.",
      warnTitle: "Pas un conseil de paris",
      warn: "C'est un outil d'évaluation du modèle. Une saison est un petit échantillon : une seule victoire d'outsider peut renverser le total, et les résultats passés disent peu de la prochaine course. Kalshi n'est pas ouvert dans la plupart des pays européens, et les bookmakers limitent les comptes gagnants. Les jeux d'argent peuvent créer une dépendance et sont interdits aux mineurs (18+).",
      help: "Si le jeu vous pose problème, à vous ou à un proche :",
      helpLines: [
        ["France : Joueurs Info Service", "09 74 75 13 13", "https://www.joueurs-info-service.fr"],
        ["Gambling Therapy", "aide en ligne gratuite, toutes langues", "https://www.gamblingtherapy.org"],
        ["Pologne : Telefon Zaufania Uzależnień Behawioralnych", "801 889 880", null],
        ["Royaume-Uni : National Gambling Helpline", "0808 8020 133", "https://www.gamcare.org.uk"],
        ["Autres pays", "findahelpline.com", "https://findahelpline.com/topics/gambling"]
      ],
      error: "Impossible de charger les données du marché."
    }
  };

  function getLang() {
    var q = new URLSearchParams(window.location.search).get("lang") || "";
    if (q.toLowerCase() === "fr") return "fr";
    return (document.documentElement.getAttribute("lang") || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function num(v, digits, lang) {
    var s = v.toFixed(digits);
    return lang === "fr" ? s.replace(".", ",") : s;
  }

  function money(v, lang) {
    var s = (v < 0 ? "−" : v > 0 ? "+" : "") + "€" + num(Math.abs(v), 0, lang);
    return lang === "fr" ? s.replace("€", "") + " €" : s;
  }

  function pctStr(v, lang) { return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v) * 100, 0, lang) + "%"; }

  // The price paid for a contract that pays 1 if the driver wins (or makes the podium)
  function cost(d, s) {
    var q = d[s.market];
    var p = q ? q[s.when] : null;
    if (p == null || p <= 0) return null;
    return Math.min(p * (1 + s.margin), 0.99);
  }

  function prob(d, s) { return s.market === "win" ? d.p_win : d.p_podium; }
  function hit(d, s) { return s.market === "win" ? d.won : d.on_podium; }

  // One strategy over the season: pick(drivers) -> drivers to back
  function simulate(races, s, pick) {
    var out = { bets: [], n: 0, wins: 0, staked: 0, profit: 0, curve: [] };
    races.forEach(function(r) {
      var priced = r.drivers.filter(function(d) { return cost(d, s) != null; });
      pick(priced).forEach(function(d) {
        var c = cost(d, s), h = hit(d, s);
        var pl = h ? STAKE / c - STAKE : -STAKE;
        out.n++; out.wins += h ? 1 : 0; out.staked += STAKE; out.profit += pl;
        out.bets.push({ round: r.round, location: r.location, driver: d.driver, p: prob(d, s), c: c, hit: h, pl: pl });
      });
      out.curve.push(out.profit);
    });
    return out;
  }

  function strategies(races, s) {
    function top(key) {
      return function(ds) {
        var best = null;
        ds.forEach(function(d) { if (!best || key(d) > key(best)) best = d; });
        return best ? [best] : [];
      };
    }
    return {
      // Only the model's top s.top drivers: its probabilities further back are not meaningful
      value: simulate(races, s, function(ds) {
        return ds.slice().sort(function(a, b) { return prob(b, s) - prob(a, s); }).slice(0, s.top)
          .filter(function(d) { return prob(d, s) - cost(d, s) >= s.edge; });
      }),
      model: simulate(races, s, top(function(d) { return prob(d, s); })),
      market: simulate(races, s, top(function(d) { return d[s.market][s.when]; }))
    };
  }

  // Log loss of the model and of the de-vigged market on the chosen market
  function forecastScore(races, s) {
    var total = s.market === "win" ? 1 : 3, m = 0, k = 0, better = 0, n = 0;
    function ll(p, y) { p = Math.min(Math.max(p, 1e-4), 1 - 1e-4); return -(y ? Math.log(p) : Math.log(1 - p)); }
    races.forEach(function(r) {
      var ds = r.drivers.filter(function(d) { return d[s.market] && d[s.market][s.when] != null; });
      var sum = ds.reduce(function(a, d) { return a + d[s.market][s.when]; }, 0);
      if (!ds.length || !sum) return;
      var rm = 0, rk = 0;
      ds.forEach(function(d) {
        var y = hit(d, s), pk = d[s.market][s.when] * total / sum;
        if (s.market === "win") { if (y) { rm += ll(d.p_win, 1); rk += ll(pk, 1); } }
        else { rm += ll(d.p_podium, y) / ds.length; rk += ll(pk, y) / ds.length; }
      });
      m += rm; k += rk; n++; if (rm < rk) better++;
    });
    return n ? { model: m / n, market: k / n, better: better, n: n } : null;
  }

  function chart(races, res, c) {
    // Drawn at the container's width so the 10px labels stay 10px on phones
    var box = document.getElementById("f1-market");
    var W = Math.max(300, Math.min(640, (box && box.clientWidth) || 640)), H = W < 480 ? 170 : 200, P = { l: 40, r: 8, t: 10, b: 22 };
    var series = [["value", "f1-mk-line--value"], ["model", "f1-mk-line--model"], ["market", "f1-mk-line--market"]];
    var all = [0];
    series.forEach(function(sr) { all = all.concat(res[sr[0]].curve); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (hi - lo < 20) { hi += 10; lo -= 10; }
    var n = races.length;
    function x(i) { return P.l + (n > 1 ? i / (n - 1) : 0.5) * (W - P.l - P.r); }
    function y(v) { return P.t + (hi - v) / (hi - lo) * (H - P.t - P.b); }
    var h = '<svg class="f1-mk-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escHtml(c.chart) + '">';
    h += '<line class="f1-mk-zero" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    [hi, 0, lo].forEach(function(v) {
      h += '<text class="f1-mk-ax" x="' + (P.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)) + '</text>';
    });
    races.forEach(function(r, i) {
      if (n <= 12 || i % 2 === 0 || i === n - 1)
        h += '<text class="f1-mk-ax" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + r.round + '</text>';
    });
    series.forEach(function(sr) {
      var pts = res[sr[0]].curve.map(function(v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); });
      h += '<polyline class="f1-mk-line ' + sr[1] + '" points="' + pts.join(" ") + '"/>';
    });
    return h + '</svg>';
  }

  function render(root, data, lang, s) {
    var c = copy[lang] || copy.en;
    var races = (data.market || []).filter(function(r) { return r.drivers && r.drivers.length; });
    var res = strategies(races, s);
    var v = res.value;
    var cls = function(x) { return x > 0 ? "is-up" : x < 0 ? "is-down" : ""; };

    var h = '<div class="f1-stats" aria-live="polite">' +
      '<div class="f1-stat"><span class="f1-stat__v ' + cls(v.profit) + '">' + escHtml(money(v.profit, lang)) + '</span><span class="f1-stat__l">' + c.profit + '</span></div>' +
      '<div class="f1-stat"><span class="f1-stat__v ' + cls(v.profit) + '">' + (v.staked ? escHtml(pctStr(v.profit / v.staked, lang)) : "–") + '</span><span class="f1-stat__l">' + c.roi + '</span></div>' +
      '<div class="f1-stat"><span class="f1-stat__v">' + v.wins + '<small>/' + v.n + '</small></span><span class="f1-stat__l">' + c.bets + '</span></div></div>';

    h += '<table class="f1-grid__t f1-mk-table"><caption class="sr-only">' + c.strategies + '</caption><thead><tr>' +
      '<th scope="col">' + c.strategy + '</th><th scope="col">' + c.nBets + '</th><th scope="col">' + c.won + '</th><th scope="col">' + c.pl + '</th><th scope="col">' + c.roiShort + '</th></tr></thead><tbody>';
    [["value", c.sValue], ["model", c.sModel], ["market", c.sMarket]].forEach(function(row) {
      var r = res[row[0]];
      h += '<tr><td><i class="f1-mk-key f1-mk-key--' + row[0] + '" aria-hidden="true"></i>' + row[1] + '</td><td>' + r.n + '</td><td>' + r.wins + '</td>' +
        '<td class="' + cls(r.profit) + '">' + escHtml(money(r.profit, lang)) + '</td>' +
        '<td class="' + cls(r.profit) + '">' + (r.staked ? escHtml(pctStr(r.profit / r.staked, lang)) : "–") + '</td></tr>';
    });
    h += '</tbody></table>';

    if (races.length) {
      h += '<p class="f1-mk-sub">' + c.chart + '</p>' + chart(races, res, c);
    }

    var sc = forecastScore(races, s);
    if (sc) {
      h += '<p class="f1-mk-sub">' + c.score + '</p><p class="f1-live__meta">' +
        escHtml(c.scoreText(num(sc.model, 3, lang), num(sc.market, 3, lang), sc.better, sc.n)) + '</p>' +
        '<p class="f1-live__meta">' + c.scoreNote + '</p>';
    }

    h += '<details class="f1-grid f1-mk-bets"><summary>' + c.betsList + ' (' + v.n + ')</summary>';
    if (!v.bets.length) h += '<p class="f1-live__meta">' + c.none + '</p>';
    else {
      h += '<table class="f1-grid__t"><tbody>';
      v.bets.forEach(function(b) {
        h += '<tr><td>R' + b.round + '</td><td>' + escHtml(b.driver) + '</td>' +
          '<td>' + num(b.p * 100, 0, lang) + '% / ' + num(b.c * 100, 0, lang) + '%</td>' +
          '<td>' + c.atOdds + ' ' + num(1 / b.c, 2, lang) + '</td>' +
          '<td class="' + cls(b.pl) + '">' + escHtml(money(b.pl, lang)) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</details>';

    root.querySelector("[data-mk-out]").innerHTML = h;
  }

  function controls(c, s) {
    function group(key, label, opts, help) {
      var h = '<div class="f1-mk-ctl' + (help ? ' f1-mk-ctl--wide' : '') + '"><span class="f1-stat__l" id="f1-mk-' + key + '">' + label + '</span><div class="hp-lang" role="group" aria-labelledby="f1-mk-' + key + '">';
      opts.forEach(function(o) {
        h += '<button type="button" data-mk-' + key + '="' + o[0] + '" aria-pressed="' + (String(s[key]) === String(o[0])) + '">' + o[1] + '</button>';
      });
      return h + '</div>' + (help ? '<p class="f1-mk-help">' + help + '</p>' : '') + '</div>';
    }
    function slider(key, label, help, max, step) {
      var val = Math.round(s[key] * 100);
      return '<div class="f1-mk-ctl f1-mk-ctl--range"><label class="f1-stat__l" for="f1-mk-' + key + '">' + label +
        ' <output data-mk-out-' + key + '>' + val + UNITS[key] + '</output></label>' +
        '<input type="range" id="f1-mk-' + key + '" data-mk-range="' + key + '" min="0" max="' + max + '" step="' + step + '" value="' + val + '" aria-describedby="f1-mk-' + key + '-help" />' +
        '<p class="f1-mk-help" id="f1-mk-' + key + '-help">' + help + '</p></div>';
    }
    return '<div class="f1-mk-ctls">' +
      group("market", c.market, [["win", c.win], ["podium", c.podium]]) +
      group("when", c.when, [[0, c.whenPred], [1, c.whenStart]]) +
      group("top", c.top, [[1, c.top1], [3, c.top3], [6, c.top6]], c.topHelp) +
      slider("margin", c.margin, c.marginHelp, 30, 1) +
      slider("edge", c.edge, c.edgeHelp, 20, 1) + '</div>';
  }

  function warning(c) {
    var h = '<aside class="f1-mk-warn" aria-label="' + escHtml(c.warnTitle) + '"><p><strong>' + c.warnTitle + '.</strong> ' + c.warn + '</p><p>' + c.help + '</p><ul>';
    c.helpLines.forEach(function(l) {
      var v = l[2] ? '<a href="' + l[2] + '" target="_blank" rel="noopener noreferrer">' + escHtml(l[1]) + '</a>' : escHtml(l[1]);
      h += '<li><span>' + escHtml(l[0]) + '</span> ' + v + '</li>';
    });
    return h + '</ul></aside>';
  }

  var root = document.getElementById("f1-market");
  if (!root) return;
  var lang = getLang();
  var c = copy[lang] || copy.en;
  var title = document.getElementById("f1-market-title");
  if (title) title.textContent = c.title;
  // edge is in probability points (0.05 = 5 pts), margin a fraction of the price
  var s = { market: "win", when: 0, top: 6, margin: 0.05, edge: 0.05 };
  var UNITS = { margin: "%", edge: " pts" };

  fetch(DATA_URL)
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data) {
      if (!data.market || !data.market.length) { root.closest("section").hidden = true; return; }
      root.innerHTML = '<p class="f1-mk-intro">' + c.intro + '</p>' + warning(c) + controls(c, s) + '<div data-mk-out></div>';
      root.addEventListener("click", function(e) {
        var b = e.target.closest("button[data-mk-market], button[data-mk-when], button[data-mk-top]");
        if (!b) return;
        var key = b.hasAttribute("data-mk-market") ? "market" : b.hasAttribute("data-mk-when") ? "when" : "top";
        var val = b.getAttribute("data-mk-" + key);
        s[key] = key === "market" ? val : Number(val);
        b.parentNode.querySelectorAll("button").forEach(function(x) { x.setAttribute("aria-pressed", String(x === b)); });
        render(root, data, lang, s);
      });
      root.addEventListener("input", function(e) {
        var key = e.target.getAttribute("data-mk-range");
        if (!key) return;
        s[key] = Number(e.target.value) / 100;
        root.querySelector("[data-mk-out-" + key + "]").textContent = e.target.value + UNITS[key];
        render(root, data, lang, s);
      });
      render(root, data, lang, s);
    })
    .catch(function() { root.innerHTML = '<p class="small">' + c.error + '</p>'; });
})();
