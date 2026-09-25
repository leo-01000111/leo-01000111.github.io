#!/usr/bin/env python3
"""
One-shot authoring aid: generate the static French project pages under
fr/projects/ from the already-redesigned English pages in projects/.

French copy for project1 / lgflow / f1predictor comes from the translation
decks that used to live in assets/main.js; kaggle's hero is translated here
and its live board renders French on its own from <html lang="fr">.

This is NOT a deploy step — it is run once (or when an English page changes)
to (re)materialise the hand-maintained French pages. Output is plain static
HTML committed to the repo.
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "projects")
OUT = os.path.join(ROOT, "fr", "projects")
os.makedirs(OUT, exist_ok=True)

# FR title / description per slug (from projects/projects.json)
JSON_FR = {
    "project1": (
        "Mémoire de licence : PPO vs MPC robuste sur un Roomba simulé",
        "Tube RMPC et PPO comparés sur un robot simulé, avec et sans GNSS. Les critères sont la stabilité, la précision de suivi, la robustesse et le coût de calcul.",
    ),
    "lgflow": (
        "LG-FLOW : Solveur CFD 2D",
        "Solveur 2D de Navier-Stokes incompressible en C++20, par volumes finis avec couplage SIMPLE. Validé sur le cas de la cavité entraînée de Ghia et al.",
    ),
    "f1predictor": (
        "Prédicteur de Course F1",
        "Ensemble XGBoost et PyTorch qui prédit les probabilités de podium en F1 à partir des qualifications, de la météo et des données historiques.",
    ),
    "kaggle": (
        "Compétitions Kaggle",
        "Classements en direct sur des compétitions ML, mis à jour quotidiennement via GitHub Actions.",
    ),
}

P1 = {
    "proj-title": "Mémoire de licence : PPO vs MPC robuste sur un Roomba simulé",
    "proj-desc": "Tube RMPC et PPO comparés sur un robot simulé, avec et sans GNSS. Les critères sont la stabilité, la précision de suivi, la robustesse et le coût de calcul.",
    "p1-pdf-btn": '<span>Ouvrir le PDF du mémoire · 0,5 Mo</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>',
    "p1-repo-btn": '<span>Voir le dépôt</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>',
    "p1-source": "Mémoire de licence, Université de Technologie de Varsovie, novembre 2025. Directeur : Prof. Marcin Żugaj, DSc, Ing.",
    "p1-action-title": "Course avec refus GNSS, environnement 044",
    "p1-action-desc": "Les deux contrôleurs roulent dans le même environnement, dans les mêmes conditions.",
    "p1-ctx-title": "Le sujet du mémoire",
    "p1-ctx-text": "Titre complet : « Analyse comparative de l'apprentissage par renforcement et du contrôle prédictif robuste en conditions de refus GNSS sur une plateforme robotique mobile. » Un Roomba simulé suit une trajectoire de référence jusqu'à un but, dans des pièces encombrées. Il doit éviter les obstacles et traverser une zone où le GNSS est brouillé. Le mémoire compare deux contrôleurs sur la stabilité, la précision, la robustesse et le coût de calcul. Les deux contrôleurs roulent dans les mêmes 500 environnements.",
    "p1-ctrl-title": "Les deux contrôleurs",
    "p1-ctrl-rmpc-name": "Tube Robust MPC",
    "p1-ctrl-rmpc-1": "Prédit les états futurs avec un modèle dynamique explicite. Un terme LQR rejette les perturbations.",
    "p1-ctrl-rmpc-2": "Le tube borne l'effet du bruit. Les contraintes dures d'évitement d'obstacles sont garanties.",
    "p1-ctrl-rmpc-3": "Conservateur. Timeout dans 10–15 % des courses, donc un déploiement réel demande de relâcher les contraintes ou un contrôleur de secours.",
    "p1-ctrl-ppo-name": "Proximal Policy Optimisation (PPO)",
    "p1-ctrl-ppo-1": "Apprend sa politique de bout en bout, avec un entraînement par curriculum en plusieurs étapes. Il n'a pas de modèle explicite du système.",
    "p1-ctrl-ppo-2": "Un passage dans un réseau de neurones par action. 63× plus rapide en ligne que RMPC.",
    "p1-ctrl-ppo-3": "Collisions dans 3–5 % des courses. Une partie vient d'un conflit entre les récompenses de suivi et d'évitement.",
    "p1-exp-title": "L'expérience en chiffres",
    "p1-stat-1": "environnements évalués",
    "p1-stat-2": "contrôleurs comparés",
    "p1-stat-3": "conditions d'opération",
    "p1-stat-4": "taux de collision RMPC",
    "p1-safety-title": "Sécurité",
    "p1-safety-text": "RMPC n'a eu aucune collision, avec ou sans GNSS. PPO a eu des collisions dans 3,1 % des courses nominales et 4,7 % des courses avec refus, car il n'a pas de contraintes dures d'évitement.",
    "p1-charts-title": "Résultats",
    "p1-chart1-title": "Taux de succès",
    "p1-chart2-title": "Erreur transversale (plus bas = mieux)",
    "p1-raw-title": "Résultats complets (table du mémoire, N = 500)",
    "p1-col-metric": "Mesure",
    "p1-col-rmpc-nom": "RMPC (nominal)",
    "p1-col-ppo-nom": "PPO (nominal)",
    "p1-col-rmpc-den": "RMPC (refus)",
    "p1-col-ppo-den": "PPO (refus)",
    "p1-row-success": "Succès [%]",
    "p1-row-collision": "Collision [%]",
    "p1-row-timeout": "Timeout [%]",
    "p1-row-xtemean": "XTE_nom / XTE_mean [m]",
    "p1-row-xtein": "XTE_in [m]",
    "p1-row-xteout": "XTE_out [m]",
    "p1-deg-title": "Effet du refus GNSS",
    "p1-deg-m1": "Dégradation du suivi (nominal → refus)",
    "p1-deg-m2": "Intérieur vs extérieur de la zone de refus",
    "p1-deg-m3": "Dégradation du suivi (nominal → refus)",
    "p1-deg-m4": "Intérieur vs extérieur de la zone de refus",
    "p1-deg-d1": "XTE moyenne 0,266 → 0,325 m",
    "p1-deg-d2": "XTE_in 0,321 m ≈ XTE_out 0,328 m",
    "p1-deg-d3": "XTE moyenne 0,731 → 0,852 m",
    "p1-deg-d4": "XTE_in 0,210 m vs XTE_out 0,867 m, pic après le refus",
    "p1-deg-note": "P_deg-nom compare l'erreur de suivi avec et sans refus. P_deg-InOut compare l'erreur à l'intérieur et à l'extérieur de la zone de refus. Le −0,95 % de RMPC signifie que son erreur est à peu près la même partout. Le −75,8 % de PPO signifie qu'il suit bien dans la zone et perd en précision après. Cela suggère une dérive de position qui s'accumule après la fin du refus.",
    "p1-setup-title": "Cadre de l'étude",
    "p1-setup-1": "Contrôleurs : Tube RMPC et PPO.",
    "p1-setup-2": "500 environnements d'évaluation.",
    "p1-setup-3": "Les deux contrôleurs et les deux conditions utilisent les mêmes environnements.",
    "p1-setup-4": "Conditions : nominale et avec refus GNSS.",
    "p1-key-title": "Mesure du suivi",
    "p1-key-text": "La qualité du suivi est mesurée par l'erreur transversale (XTE) : la distance euclidienne entre le robot et le point de référence le plus proche. L'index du point ne peut qu'avancer le long de la trajectoire.",
    "p1-work-title": "Coût de déploiement",
    "p1-work-note": "La vitesse de rollout est le nombre d'actions par seconde de chaque contrôleur. PPO a besoin d'un passage dans un réseau de neurones par action. RMPC résout un problème d'optimisation à chaque pas de temps, donc PPO est 63× plus rapide.",
    "p1-work-col-metric": "Mesure",
    "p1-work-col-rmpc": "Tube RMPC",
    "p1-work-col-ppo": "PPO",
    "p1-work-row-impl": "Temps d'implémentation [heures-homme]",
    "p1-work-row-train": "Durée d'entraînement/réglage [h]",
    "p1-work-row-speed": "Vitesse de rollout [actions/s]",
    "p1-verdict-title": "Verdict",
    "p1-v1-badge": "Sécurité et prévisibilité",
    "p1-v1-text": "RMPC convient aux applications critiques. Il n'a eu aucune collision sur 1 000 courses et garantit ses contraintes d'évitement. Son point faible est un taux de timeout de 10–15 % : le solveur ne trouve parfois pas de trajectoire faisable à temps. Un déploiement réel demanderait de relâcher les contraintes ou un contrôleur de secours.",
    "p1-v2-badge": "Flexibilité et vitesse en ligne",
    "p1-v2-text": "PPO égale ou dépasse RMPC sur le taux de succès et est 63× plus rapide en ligne. Son erreur est plus faible dans la zone de refus (0,21 m) qu'à l'extérieur (0,87 m). Il tient la trajectoire pendant le refus, puis dérive après le retour du GNSS. Le taux de collision de 3–5 % vient en partie de la forme des récompenses, car suivi et évitement se contredisaient pendant l'entraînement. Ce n'est peut-être pas une limite de la méthode.",
    "p1-v3-badge": "À retenir",
    "p1-v3-text": "Aucun contrôleur ne gagne partout. RMPC convient quand environ 20 fps suffisent et que des garanties de sécurité sont nécessaires. L'adaptabilité de PPO et son rejet du bruit compteraient sans doute plus dans des environnements plus durs, avec des perturbations plus fortes. L'environnement de test était peut-être trop simple pour un verdict tout à fait équitable, un point soulevé à la soutenance. Le mémoire fournit une base reproductible. Une comparaison définitive demanderait deux contrôleurs optimisés au même niveau.",
}

LG = {
    "proj-title": "LG-FLOW : Solveur CFD 2D",
    "proj-desc": "Solveur 2D de Navier-Stokes incompressible en C++20, par volumes finis avec couplage SIMPLE. Validé sur le cas de la cavité entraînée de Ghia et al.",
    "lg-kicker": "CFD · Simulation · C++",
    "lg-repo-btn": '<span>Voir le dépôt</span>' + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>',
    "lg-ctx-title": "Présentation",
    "lg-ctx-text": "LG-FLOW est un solveur 2D de Navier-Stokes incompressible écrit en C++20. Il utilise la méthode des volumes finis (FVM) avec couplage pression-vitesse SIMPLE sur une grille décalée. Il est validé sur le cas de la cavité entraînée de Ghia et al. (1982), pour Re = 100 et Re = 1000. Il produit les résidus par itération, les profils de vitesse sur les axes médians, des instantanés VTK et les erreurs L2/L∞.",
    "lg-tech-title": "Stack technique",
    "lg-tc1-label": "Langage", "lg-tc1-value": "C++20 (GCC 11+, Clang 14+, MSVC 19.29+)",
    "lg-tc2-label": "Méthode", "lg-tc2-value": "Volumes finis (FVM) · Couplage SIMPLE",
    "lg-tc3-label": "Bibliothèques", "lg-tc3-value": "Eigen3 (algèbre linéaire) · GoogleTest (tests unitaires)",
    "lg-tc4-label": "Build", "lg-tc4-value": "CMake 3.20+",
    "lg-tc5-label": "Convection", "lg-tc5-value": "Upwind · Différences centrées · CFL adaptatif",
    "lg-tc6-label": "Sorties", "lg-tc6-value": "Instantanés VTK · Profils de vitesse · Métriques L2/L∞ · Résidus CSV",
    "lg-val-title": "Validation : cavité entraînée de Ghia et al.",
    "lg-val-desc": "La référence est Ghia, Ghia & Shin (1982), le cas de référence standard pour l'écoulement incompressible 2D en cavité entraînée. Les deux cas, Re = 100 et Re = 1000, passent les seuils d'erreur L2 et L∞ automatisés.",
    "lg-vth-case": "Cas", "lg-vth-re": "Re", "lg-vth-ref": "Référence", "lg-vth-status": "Statut",
    "lg-vc1-case": "Cavité entraînée", "lg-vc2-case": "Cavité entraînée",
    "lg-pass1": "OK", "lg-pass2": "OK",
    "lg-val-note": "La vérification est automatique. Le solveur renvoie un code non nul si une métrique dépasse la tolérance, donc la CI peut l'utiliser directement.",
    "lg-phase-title": "Implémentation",
    "lg-p1": "Grille décalée avec pression colloquée, qui évite le découplage pression-vitesse",
    "lg-p2": "Boucle de correction de pression SIMPLE, nombre de passes configurable",
    "lg-p3": "Stencils cohérents : un seul schéma d'interpolation partout",
    "lg-p4": "Validation automatisée avec codes de sortie réussite/échec",
    "lg-p5": "Export VTK pour le post-traitement dans ParaView",
}

F1 = {
    "proj-title": "Prédicteur de Course F1",
    "f1-kicker": "Machine Learning · Formule 1",
    "f1-repo-btn": '<span>Voir le dépôt</span>' + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>',
    "f1-ctx-title": "Ce que ça fait",
    "f1-ctx-text": "Un pipeline d'apprentissage automatique qui prédit les probabilités de podium en Formule 1 (P1, P2, P3) pour les prochaines courses. Il est entraîné sur les données 2014–2024. Les entrées sont les qualifications, l'historique des pilotes et des écuries, les caractéristiques des circuits et la météo en direct. Un ensemble XGBoost et PyTorch produit des probabilités calibrées, affichées dans un tableau de bord Streamlit.",
    "f1-pipe-title": "Pipeline de prédiction",
    "f1-pipe1": "<strong>Collecte des données.</strong> Qualifications (OpenF1), résultats 2014–2024 (FastF1), données des circuits et météo en direct (Open-Meteo).",
    "f1-pipe2": "<strong>Caractéristiques.</strong> Forme des pilotes, tendances des écuries, position sur la grille et rythme ajusté à la météo.",
    "f1-pipe3": "<strong>Ensemble.</strong> Trois classifieurs binaires XGBoost, un par position de podium, plus un MLP PyTorch avec des embeddings de pilotes et d'écuries. Une régression logistique combine leurs sorties.",
    "f1-pipe4": "<strong>Calibration.</strong> La régression isotonique rend les probabilités fiables pour chaque position.",
    "f1-pipe5": "<strong>Tableau de bord.</strong> Une application Streamlit affiche les probabilités course par course.",
    "f1-arch-title": "Architecture du modèle",
    "f1-ac1-label": "Couche XGBoost", "f1-ac1-value": "Trois classifieurs binaires (P1, P2, P3), chacun entraîné séparément sur les caractéristiques construites",
    "f1-ac2-label": "Couche PyTorch", "f1-ac2-value": "MLP avec des embeddings appris pour les pilotes et les écuries, qui capturent leur identité",
    "f1-ac3-label": "Empilement", "f1-ac3-value": "Une régression logistique combine les sorties XGBoost et PyTorch",
    "f1-ac4-label": "Calibration", "f1-ac4-value": "La régression isotonique calibre les probabilités finales",
    "f1-data-title": "Sources de données",
    "f1-ds1": "Résultats historiques, temps au tour et télémétrie (saisons 2014–2024)",
    "f1-ds2": "Données de qualification en direct pour les prochaines courses",
    "f1-ds3": "Météo sur le circuit : température, probabilité de pluie, vent",
    "f1-eval-title": "Évaluation",
    "f1-eval-text": "Validation croisée leave-one-season-out, plus un jeu de test 2023–2024 non utilisé à l'entraînement. Métriques : Brier score, log loss, ROC-AUC, précision sur le vainqueur et recouvrement du podium.",
    "proj-desc": "Ensemble XGBoost et PyTorch qui prédit les probabilités de podium en F1 à partir des qualifications, de la météo et des données historiques.",
}

KG = {
    "proj-title": "Compétitions Kaggle",
    "proj-desc": "Classements en direct sur des compétitions ML. Les rangs sont récupérés chaque jour depuis l'API Kaggle via GitHub Actions.",
    "kg-kicker": "Science des données · Compétitions",
    "kg-profile-btn": '<span class="btn-label">Profil Kaggle</span>' + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>',
}

PAGES = {"project1": P1, "lgflow": LG, "f1predictor": F1, "kaggle": KG}


def esc(s):
    return s.replace("&", "&amp;")


def set_by_id(html, mapping):
    for _id, text in mapping.items():
        pat = re.compile(r'(<(\w+)([^>]*\sid="%s")[^>]*>)(.*?)(</\2>)' % re.escape(_id), re.S)
        new, n = pat.subn(lambda m: m.group(1) + esc(text) + m.group(5), html, count=1)
        if n == 0:
            print("   WARN: id not found:", _id)
        html = new
    return html


def set_inner_by_id_attr(html, _id, text):
    # for elements where id may carry other attrs; replaces inner leaf text
    pat = re.compile(r'(<(\w+)[^>]*\bid="%s"[^>]*>)(.*?)(</\2>)' % re.escape(_id), re.S)
    return pat.sub(lambda m: m.group(1) + esc(text) + m.group(4), html, count=1)


ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>'
ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(180 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>'
ARROW_D = ARROW_R.replace('rotate(0', 'rotate(90')

HEADER_RE = re.compile(r'<header class="site-header">.*?</header>', re.S)
FOOTER_RE = re.compile(r'<footer class="site-footer"[^>]*>.*?</footer>', re.S)
SHEET_RE = re.compile(r'<p class="site-footer__text data">Drawn by Leon Górecki · Sheet (.*?) · Scale NTS', re.S)


# Short location-panel name per project, for the header SignArray (FR).
FR_SHORT_NAME = {
    "project1": "Mémoire",
    "lgflow": "LG-FLOW",
    "f1predictor": "Prédicteur F1",
    "kaggle": "Kaggle",
}


def fr_header_html(slug):
    en_href = "/projects/%s.html" % slug
    fr_href = "/fr/projects/%s.html" % slug
    name = FR_SHORT_NAME.get(slug, slug)
    # On a detail page, Home and the projects list both sit "behind" you:
    # left arrow, left of the location panel (components.md's SignArray
    # ordering rule). The location panel is the current project, not
    # "Projets" — that's now a direction sign pointing back to the list.
    # Skills/Contact are dropped here (home-page-only anchors) so the array
    # stays to 3 panels and doesn't wrap past two rows at 375px.
    return '''<header class="site-header">
    <div class="header-inner">
      <nav class="hp-signarray" aria-label="Site">
        <a class="hp-sign hp-sign--direction hp-sign--sm" data-ui="home" href="/fr/">%s<span>Accueil</span></a>
        <a class="hp-sign hp-sign--direction hp-sign--sm" href="/fr/projects/">%s<span>Projets</span></a>
        <span class="hp-sign hp-sign--location hp-sign--sm" aria-current="page"><span>%s</span></span>
      </nav>
      <div class="header-tools">
        <div class="hp-lang" role="group" aria-label="Thème" data-theme-toggle hidden><button type="button" data-set-theme="light" aria-pressed="false">Jour</button><button type="button" data-set-theme="dark" aria-pressed="false">Nuit</button></div>
        <div class="hp-lang" role="group" aria-label="Language">
          <a data-lang="en" href="%s" hreflang="en" lang="en">EN</a>
          <a data-lang="fr" aria-current="page" href="%s" hreflang="fr" lang="fr">FR</a>
        </div>
      </div>
    </div>
  </header>''' % (ARROW_L, ARROW_L, name, en_href, fr_href)


def fr_footer_html(sheet_name, pattern_id):
    return '''<footer class="site-footer" aria-label="Cartouche">
    <div role="separator"><svg class="hp-marking" width="100%%" height="28" aria-hidden="true" focusable="false"><defs><pattern id="%s" width="36" height="28" patternUnits="userSpaceOnUse"><rect class="edge" x="0.5" y="11.5" width="20" height="5" fill="currentColor" stroke-width="1"></rect></pattern></defs><rect x="0" y="0" width="100%%" height="28" fill="url(#%s)"></rect></svg></div>
    <p class="site-footer__text data">Dessiné par Leon Górecki · Feuille %s · Échelle NTS · Contact <a href="mailto:leon.gorecki.fr@proton.me">leon.gorecki.fr@proton.me</a> · Rév 2026-06-15 · © <span id="year"></span> Górecki</p>
  </footer>''' % (pattern_id, pattern_id, sheet_name)


def generic(html, slug, title_fr, desc_fr):
    html = html.replace('<html lang="en">', '<html lang="fr">')
    html = re.sub(r'<title>.*?</title>', '<title>%s - Leon Górecki</title>' % esc(title_fr), html, flags=re.S)
    html = re.sub(r'(<meta name="description" content=")[^"]*(")',
                  lambda m: m.group(1) + esc(desc_fr) + m.group(2), html, count=1)
    html = re.sub(r'(<meta property="og:title" content=")[^"]*(")',
                  lambda m: m.group(1) + esc(title_fr) + " - Leon Górecki" + m.group(2), html, count=1)
    html = re.sub(r'(<meta property="og:description" content=")[^"]*(")',
                  lambda m: m.group(1) + esc(desc_fr) + m.group(2), html, count=1)
    # canonical + og:url -> /fr/projects/
    can = 'https://www.leongorecki.eu/projects/%s.html' % slug
    frc = 'https://www.leongorecki.eu/fr/projects/%s.html' % slug
    html = html.replace('<link rel="canonical" href="%s" />' % can,
                        '<link rel="canonical" href="%s" />' % frc)
    html = html.replace('<meta property="og:url" content="%s" />' % can,
                        '<meta property="og:url" content="%s" />\n  <meta property="og:locale" content="fr_FR" />' % frc)
    # skip link
    html = html.replace('href="#main">Skip to main content<', 'href="#main">Aller au contenu principal<')
    # header (SignArray + LangSwitch), fully re-rendered in French
    html = HEADER_RE.sub(lambda m: fr_header_html(slug), html, count=1)
    # footer (marking + mono text), keeping the sheet name the EN page carried
    m = SHEET_RE.search(html)
    sheet_name = m.group(1) if m else slug.upper()
    html = FOOTER_RE.sub(lambda m: fr_footer_html(sheet_name, "hp-mk-fr-proj-%s" % slug), html, count=1)
    # proj-back / proj-home inner text
    html = set_inner_by_id_attr(html, "proj-back", ARROW_L + "<span>Retour aux projets</span>")
    html = set_inner_by_id_attr(html, "proj-home", ARROW_L + "<span>Accueil</span>")
    return html


for slug, mapping in PAGES.items():
    src = os.path.join(SRC, slug + ".html")
    html = open(src, encoding="utf-8-sig").read()
    title_fr, desc_fr = JSON_FR[slug]
    html = generic(html, slug, title_fr, desc_fr)
    html = set_by_id(html, mapping)
    out = os.path.join(OUT, slug + ".html")
    open(out, "w", encoding="utf-8", newline="").write(html)
    print("wrote", os.path.relpath(out, ROOT))
