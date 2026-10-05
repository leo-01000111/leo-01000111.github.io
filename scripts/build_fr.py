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

Run order: this script reads from the EN pages under projects/ and
overwrites fr/projects/{project1,lgflow,f1predictor,kaggle}.html wholesale,
including their ProjectCard "See also" markup. Always run this BEFORE
scripts/build_projects.py, never after — running it after would blow away
build_projects.py's French "See also" cards with English ones copied from
the EN source page.
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
        "Un modèle XGBoost prédit la position finale de chaque pilote à partir des qualifications, des essais libres, de la météo et de l'historique. Une simulation de Plackett-Luce en tire les probabilités de victoire et de podium.",
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
    "lg-ctx-text": "LG-FLOW est un solveur 2D de Navier-Stokes incompressible écrit en C++20. Il utilise la méthode des volumes finis (FVM) avec couplage pression-vitesse SIMPLE sur une grille colocalisée, avec une interpolation de Rhie-Chow aux faces. Il est validé sur le cas de la cavité entraînée de Ghia et al. (1982) à Re = 100. Il produit les résidus par itération, les profils de vitesse sur les axes médians, des instantanés VTK et les erreurs L2/L∞, et une interface SFML affiche les résidus et l'écoulement pendant le calcul. Un solveur sur maillage non structuré et un modèle de turbulence Spalart-Allmaras sont en cours.",
    "lg-tech-title": "Stack technique",
    "lg-tc1-label": "Langage", "lg-tc1-value": "C++20 (GCC 11+, Clang 14+, MSVC 19.29+)",
    "lg-tc2-label": "Méthode", "lg-tc2-value": "Volumes finis (FVM) · Couplage SIMPLE",
    "lg-tc3-label": "Bibliothèques", "lg-tc3-value": "Eigen3 (algèbre linéaire) · GoogleTest (tests unitaires)",
    "lg-tc4-label": "Build", "lg-tc4-value": "CMake 3.20+",
    "lg-tc5-label": "Convection", "lg-tc5-value": "Upwind · Différences centrées · CFL adaptatif",
    "lg-tc6-label": "Sorties", "lg-tc6-value": "Instantanés VTK · Profils de vitesse · Métriques L2/L∞ · Résidus CSV",
    "lg-val-title": "Validation : cavité entraînée de Ghia et al.",
    "lg-val-desc": "La référence est Ghia, Ghia & Shin (1982), le cas de référence standard pour l'écoulement incompressible 2D en cavité entraînée. Le cas Re = 100 est vérifié automatiquement : les erreurs L2 des profils de u et v sur les axes médians doivent rester sous des seuils fixés. Les erreurs L∞ sont aussi calculées et affichées.",
    "lg-vth-case": "Cas", "lg-vth-re": "Re", "lg-vth-ref": "Référence", "lg-vth-status": "Statut",
    "lg-vc1-case": "Cavité entraînée",
    "lg-pass1": "OK",
    "lg-val-note": "L'exécutable de validation renvoie le code 2 si une erreur dépasse son seuil, donc la CI peut l'utiliser directement. La même vérification tourne aussi comme test CTest.",
    "lg-phase-title": "Implémentation",
    "lg-p1": "Grille colocalisée avec interpolation de Rhie-Chow aux faces, qui évite le découplage pression-vitesse",
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
    "f1-ctx-text": "Un pipeline d'apprentissage automatique qui prédit le résultat d'une course de Formule 1 une fois les qualifications terminées. Il est entraîné sur les saisons depuis 2014. Les entrées sont les qualifications et les essais libres, l'historique des pilotes et des écuries, les caractéristiques des circuits et la prévision météo du jour de course. Un régresseur XGBoost prédit la position finale de chaque pilote, et une simulation de Plackett-Luce en tire les probabilités de victoire, de P2, de P3, de podium, de top 6 et de top 10. Un tableau de bord Streamlit les affiche course par course.",
    "f1-pipe-title": "Pipeline de prédiction",
    "f1-pipe1": "<strong>Collecte des données.</strong> Courses, qualifications, essais libres, arrêts aux stands et sprints depuis 2014 (FastF1), qualifications et essais en direct (OpenF1), météo (Open-Meteo).",
    "f1-pipe2": "<strong>Caractéristiques.</strong> 35 entrées : position sur la grille et écarts en qualification, rythme de la voiture et des essais, forme et classement Elo des pilotes, forme des écuries, historique du circuit, fiabilité et météo. Chacune n'utilise que les courses antérieures à celle qu'on prédit.",
    "f1-pipe3": "<strong>Modèle.</strong> Un seul régresseur XGBoost prédit la position finale de chaque pilote. Les saisons récentes pèsent plus à l'entraînement.",
    "f1-pipe4": "<strong>Simulation de course.</strong> Un échantillonneur de Plackett-Luce tire 10 000 ordres d'arrivée à partir des positions prédites, ce qui donne une probabilité pour chaque pilote et chaque position.",
    "f1-pipe5": "<strong>Tableau de bord.</strong> Une application Streamlit affiche les probabilités course par course.",
    "f1-arch-title": "Architecture du modèle",
    "f1-ac1-label": "Régresseur", "f1-ac1-value": "XGBoost avec une erreur absolue comme objectif, qui prédit la position finale (un abandon compte comme dernière place plus un)",
    "f1-ac2-label": "Pondération", "f1-ac2-value": "Poids de récence, de 0,65 pour la saison la plus ancienne à 1,35 pour la plus récente",
    "f1-ac3-label": "Probabilités", "f1-ac3-value": "Échantillonnage de Plackett-Luce (Gumbel-max, 10 000 tirages). Chaque ligne pilote et chaque colonne position somment à 1",
    "f1-ac4-label": "Archivé", "f1-ac4-value": "Un empilement antérieur de trois classifieurs XGBoost et d'un MLP PyTorch, combinés par régression logistique, a été essayé puis archivé",
    "f1-data-title": "Sources de données",
    "f1-ds1": "Courses, qualifications, essais libres, arrêts aux stands et sprints depuis la saison 2014",
    "f1-ds2": "Qualifications et essais en direct pendant les week-ends de course",
    "f1-ds3": "Météo sur le circuit : température, pluie, vent et humidité, archives et prévision du jour de course",
    "f1-eval-title": "Évaluation",
    "f1-eval-text": "Validation croisée leave-one-season-out, plus un jeu de test sur les deux saisons les plus récentes, mesuré avant que le modèle de production soit réentraîné sur presque toutes les données. Après chaque vraie course, la prédiction est comparée au résultat. Métriques : précision sur le vainqueur et sur le podium, Brier score sur P1, corrélation de Spearman, erreur moyenne de position et erreur de calibration attendue.",
    "proj-desc": "Un modèle XGBoost prédit la position finale de chaque pilote à partir des qualifications, des essais libres, de la météo et de l'historique. Une simulation de Plackett-Luce en tire les probabilités de victoire et de podium.",
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


def fr_footer_html(pattern_id):
    # Clean footer (item 6 / round 5): copy left, a short link row right.
    # Keep in step with fix_footers.py's FR_ROW / the hand-maintained FR
    # pages under fr/ (index.html, projects/index.html, ...).
    return '''<footer class="site-footer" aria-label="Pied de page">
    <div role="separator"><svg class="hp-marking" width="100%%" height="28" aria-hidden="true" focusable="false"><defs><pattern id="%s" width="36" height="28" patternUnits="userSpaceOnUse"><rect class="edge" x="0.5" y="11.5" width="20" height="5" fill="currentColor" stroke-width="1"></rect></pattern></defs><rect x="0" y="0" width="100%%" height="28" fill="url(#%s)"></rect></svg></div>
    <div class="site-footer__row">
      <p class="site-footer__copy data">&copy; <span id="year">2026</span> Leon Górecki</p>
      <p class="site-footer__links data"><a href="mailto:leon.gorecki.fr@proton.me">E-mail</a> · <a href="https://github.com/leo-01000111" rel="noopener noreferrer" target="_blank">GitHub</a> · <a href="https://www.linkedin.com/in/leon-g%%C3%%B3recki-10a823352/" rel="noopener noreferrer" target="_blank">LinkedIn</a> · <a href="/cv-fr.pdf" rel="noopener noreferrer" target="_blank">CV</a></p>
    </div>
  </footer>''' % (pattern_id, pattern_id)


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
    # footer (marking + clean copy/links row)
    html = FOOTER_RE.sub(lambda m: fr_footer_html("hp-mk-fr-proj-%s" % slug), html, count=1)
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
