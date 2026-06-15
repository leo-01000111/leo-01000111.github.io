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
        "Comparaison structurée du Tube RMPC et du PPO sur la stabilité, la précision, la robustesse et la charge de calcul — en conditions nominales et avec refus GNSS.",
    ),
    "lgflow": (
        "LG-FLOW : Solveur CFD 2D",
        "Solveur 2D incompressible de Navier-Stokes en C++20, méthode des volumes finis avec couplage SIMPLE — validé sur le cas de référence de Ghia et al.",
    ),
    "f1predictor": (
        "Prédicteur de Course F1",
        "Ensemble XGBoost + PyTorch prédisant les probabilités de podium F1 à partir des qualifications, de la météo et des données historiques — interface Streamlit.",
    ),
    "kaggle": (
        "Compétitions Kaggle",
        "Classements en direct sur des compétitions ML, mis à jour quotidiennement via GitHub Actions.",
    ),
}

P1 = {
    "proj-title": "Mémoire de licence : PPO vs MPC robuste sur un Roomba simulé",
    "proj-desc": "Comparaison structurée du Tube RMPC et du PPO sur la stabilité, la précision, la robustesse et la charge de calcul — en conditions nominales et avec refus GNSS.",
    "p1-pdf-btn": "Ouvrir le PDF du mémoire · 0,5 Mo",
    "p1-repo-btn": "Voir le dépôt",
    "p1-source": "Mémoire de licence — Université de Technologie de Varsovie, nov. 2025. Directeur : Prof. Marcin Żugaj, DSc, Ing.",
    "p1-action-title": "En action — course avec refus GNSS, environnement 044",
    "p1-action-desc": "Même environnement, mêmes conditions. Observez comment chaque contrôleur gère la zone de refus.",
    "p1-ctx-title": "De quoi parle cette thèse",
    "p1-ctx-text": "Titre complet : « Analyse comparative de l'apprentissage par renforcement et du contrôle prédictif robuste en conditions de refus GNSS sur une plateforme robotique mobile. » Un Roomba simulé navigue dans des environnements intérieurs encombrés, en suivant une trajectoire de référence tout en évitant les obstacles et une zone de refus GNSS locale. L'objectif de recherche était une comparaison structurée selon quatre dimensions : stabilité, précision, robustesse et charge de calcul — en conditions nominales et avec brouillage actif. Les deux contrôleurs ont été comparés sur 500 environnements identiques pour garantir une comparaison équitable et reproductible.",
    "p1-ctrl-title": "Les contrôleurs en un coup d'œil",
    "p1-ctrl-rmpc-name": "Tube Robust MPC",
    "p1-ctrl-rmpc-1": "Prédit les états futurs via un modèle dynamique explicite avec rejet de perturbations par LQR",
    "p1-ctrl-rmpc-2": "La formulation tube borne l'effet du bruit — contraintes d'évitement d'obstacles garanties",
    "p1-ctrl-rmpc-3": "Conservateur par construction ; taux de timeout de 10–15 % nécessitant une relaxation des contraintes en déploiement réel",
    "p1-ctrl-ppo-name": "Proximal Policy Optimisation (PPO)",
    "p1-ctrl-ppo-1": "Politique apprise de bout en bout par curriculum d'entraînement progressif — sans modèle explicite",
    "p1-ctrl-ppo-2": "Passage direct dans un réseau de neurones ; 63× plus rapide en ligne que RMPC",
    "p1-ctrl-ppo-3": "Taux de collision de 3–5 % en partie dû à un conflit de récompenses, pas nécessairement une limite fondamentale",
    "p1-exp-title": "L'expérience en chiffres",
    "p1-stat-1": "environnements évalués",
    "p1-stat-2": "contrôleurs comparés",
    "p1-stat-3": "conditions d'opération",
    "p1-stat-4": "taux de collision RMPC",
    "p1-safety-title": "Résultat de sécurité",
    "p1-safety-text": "RMPC n'a enregistré aucune collision, ni en conditions nominales ni avec refus GNSS. PPO a percuté des obstacles dans 3,1 % des courses nominales et 4,7 % avec refus GPS — conséquence directe de l'absence de contraintes formelles d'évitement.",
    "p1-charts-title": "Résultats visualisés",
    "p1-chart1-title": "Taux de succès",
    "p1-chart2-title": "Erreur transversale — plus bas = mieux",
    "p1-raw-title": "Résultats bruts (table de thèse, N = 500)",
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
    "p1-deg-title": "Refus GNSS : impact sur les performances",
    "p1-deg-m1": "Dégradation du suivi (nominal → refus)",
    "p1-deg-m2": "Cohérence en zone de refus (intérieur vs. extérieur)",
    "p1-deg-m3": "Dégradation du suivi (nominal → refus)",
    "p1-deg-m4": "Cohérence en zone de refus (intérieur vs. extérieur)",
    "p1-deg-d1": "XTE moyenne 0,266 → 0,325 m",
    "p1-deg-d2": "XTE_in 0,321 m ≈ XTE_out 0,328 m",
    "p1-deg-d3": "XTE moyenne 0,731 → 0,852 m",
    "p1-deg-d4": "XTE_in 0,210 m vs XTE_out 0,867 m — pic après le refus",
    "p1-deg-note": "P_deg-nom : erreur de suivi avec refus vs nominale. P_deg-InOut : erreur à l'intérieur de la zone de refus par rapport à l'extérieur. Le −0,95 % de RMPC indique une dégradation uniforme. Le −75,8 % de PPO révèle qu'il suit bien à l'intérieur de la zone mais accumule une grande erreur après — suggérant une dérive de position qui s'amplifie une fois le refus terminé.",
    "p1-setup-title": "Cadre de l'étude",
    "p1-setup-1": "Contrôleurs : Tube RMPC et PPO.",
    "p1-setup-2": "Taille du jeu d'évaluation : N = 500 environnements.",
    "p1-setup-3": "Mêmes mondes utilisés pour les deux contrôleurs et les deux configurations de refus.",
    "p1-setup-4": "Conditions : nominale et GNSS refusé.",
    "p1-key-title": "Définition de la mesure clé",
    "p1-key-text": "La qualité de suivi est mesurée par la Cross-Track Error (XTE), définie comme la distance euclidienne entre la position du robot et le point de référence le plus proche, avec progression monotone de l'index le long de la trajectoire.",
    "p1-work-title": "Coût de déploiement",
    "p1-work-note": "La vitesse de rollout mesure la rapidité avec laquelle chaque contrôleur émet des actions en fonctionnement. L'avantage de PPO (63× plus rapide) vient d'un passage direct dans un réseau de neurones, contre la résolution d'un problème d'optimisation en ligne à chaque pas de temps pour RMPC.",
    "p1-work-col-metric": "Mesure",
    "p1-work-col-rmpc": "Tube RMPC",
    "p1-work-col-ppo": "PPO",
    "p1-work-row-impl": "Temps d'implémentation [heures-homme]",
    "p1-work-row-train": "Durée d'entraînement/réglage [h]",
    "p1-work-row-speed": "Vitesse de rollout [actions/s]",
    "p1-verdict-title": "Verdict",
    "p1-v1-badge": "Sécurité & Prévisibilité",
    "p1-v1-text": "RMPC est le grand gagnant là où la sécurité est non-négociable. Zéro collision sur 1 000 courses et garanties formelles d'évitement font de lui le choix approprié pour les applications critiques. Point faible réel : un taux de timeout de 10–15 % — le solveur à horizon glissant ne trouve parfois pas de trajectoire faisable à temps, ce qui nécessiterait une relaxation des contraintes ou un contrôleur de secours en déploiement réel.",
    "p1-v2-badge": "Flexibilité & Vitesse en ligne",
    "p1-v2-text": "PPO égale ou dépasse RMPC sur le taux de succès brut et est 63× plus rapide en ligne. Résultat intra-contrôleur notable : la XTE de PPO est plus faible à l'intérieur de la zone de refus (0,21 m) qu'à l'extérieur (0,87 m) — il maintient la trajectoire correctement pendant le refus, mais accumule une dérive qui s'amplifie après le retour du GPS. Le taux de collision de 3–5 % est en partie un artefact de la forme de récompense — conflit entre suivi de trajectoire et évitement d'obstacles durant l'entraînement — et non nécessairement un plafond fondamental.",
    "p1-v3-badge": "À retenir honnêtement",
    "p1-v3-text": "Pas de gagnant universel — et l'aveu honnête de la soutenance : l'environnement de test était peut-être trop simple pour un verdict définitif. RMPC excelle quand une opération lente (~20 fps) est acceptable et que des garanties de sécurité sont requises. Les forces relatives de PPO en adaptabilité et rejet du bruit se manifesteraient davantage dans des environnements plus complexes avec des perturbations plus sévères. La thèse établit une base reproductible ; une comparaison définitive nécessiterait les deux contrôleurs au même niveau d'optimisation.",
}

LG = {
    "proj-title": "LG-FLOW : Solveur CFD 2D",
    "proj-desc": "Solveur 2D incompressible de Navier-Stokes en C++20, méthode des volumes finis avec couplage SIMPLE — validé sur le cas de référence de Ghia et al.",
    "lg-kicker": "CFD · Simulation · C++",
    "lg-repo-btn": "Voir le dépôt ↗",
    "lg-ctx-title": "Présentation",
    "lg-ctx-text": "LG-FLOW est un solveur 2D incompressible de Navier-Stokes à visée pédagogique et de recherche, écrit en C++20. Il implémente la méthode des volumes finis (FVM) avec couplage pression-vitesse SIMPLE sur une grille décalée, et se valide sur le cas de référence de Ghia et al. (1982) en cavité entraînée pour Re = 100 et Re = 1000. Les sorties comprennent les résidus par itération, les profils de vitesse sur la ligne centrale, des instantanés VTK et les métriques d'erreur L2/L∞.",
    "lg-tech-title": "Stack technique",
    "lg-tc1-label": "Langage", "lg-tc1-value": "C++20 (GCC 11+, Clang 14+, MSVC 19.29+)",
    "lg-tc2-label": "Méthode", "lg-tc2-value": "Volumes finis (FVM) · Couplage SIMPLE",
    "lg-tc3-label": "Bibliothèques", "lg-tc3-value": "Eigen3 (algèbre linéaire) · GoogleTest (tests unitaires)",
    "lg-tc4-label": "Build", "lg-tc4-value": "CMake 3.20+",
    "lg-tc5-label": "Convection", "lg-tc5-value": "Upwind · Différences centrées · CFL adaptatif",
    "lg-tc6-label": "Sorties", "lg-tc6-value": "Instantanés VTK · Profils de vitesse · Métriques L2/L∞ · Résidus CSV",
    "lg-val-title": "Validation — cavité entraînée de Ghia et al.",
    "lg-val-desc": "Le solveur est comparé à Ghia, Ghia & Shin (1982), la référence canonique pour l'écoulement incompressible en cavité entraînée 2D. Les deux cas Re = 100 et Re = 1000 passent les seuils d'erreur L2/L∞ automatisés.",
    "lg-vth-case": "Cas", "lg-vth-re": "Re", "lg-vth-ref": "Référence", "lg-vth-status": "Statut",
    "lg-vc1-case": "Cavité entraînée", "lg-vc2-case": "Cavité entraînée",
    "lg-pass1": "OK", "lg-pass2": "OK",
    "lg-val-note": "La validation est automatisée : le solveur retourne un code non nul si une métrique dépasse la tolérance — compatible avec les pipelines CI.",
    "lg-phase-title": "Points clés d'implémentation",
    "lg-p1": "Grille décalée avec pression colloquée — évite le découplage pression-vitesse",
    "lg-p2": "Boucle de correction de pression SIMPLE avec multi-passes configurables",
    "lg-p3": "Discrétisation stencil-cohérente — même schéma d'interpolation partout",
    "lg-p4": "Suite de validation automatisée : pass/fail lisible par machine avec codes de sortie configurables",
    "lg-p5": "Export VTK pour post-traitement dans ParaView ou équivalent",
}

F1 = {
    "proj-title": "Prédicteur de Course F1",
    "proj-desc": "Ensemble XGBoost + PyTorch prédisant les probabilités de podium F1 à partir des qualifications, de la météo et des données historiques — interface Streamlit.",
    "f1-kicker": "Machine Learning · Formule 1",
    "f1-repo-btn": "Voir le dépôt ↗",
    "f1-ctx-title": "Ce que ça fait",
    "f1-ctx-text": "Pipeline d'apprentissage automatique qui prédit les probabilités de podium F1 (P1/P2/P3) pour les prochaines courses, entraîné sur des données historiques de 2014 à 2024. Le système intègre les résultats des qualifications, l'historique pilotes/écuries, les caractéristiques des circuits et la météo en direct, puis exécute un ensemble XGBoost + PyTorch pour produire des probabilités de podium calibrées. Les résultats sont affichés via un tableau de bord Streamlit.",
    "f1-pipe-title": "Pipeline de prédiction",
    "f1-pipe1": "Collecte des données — Qualifications (OpenF1), résultats historiques 2014–2024 (FastF1), données circuit, météo en direct (Open-Meteo).",
    "f1-pipe2": "Ingénierie de features — Métriques de forme pilote, tendances des écuries, avantage de position sur la grille et estimations de rythme ajustées à la météo.",
    "f1-pipe3": "Inférence ensemble — Trois classifieurs binaires XGBoost (un par position de podium) combinés avec un MLP PyTorch avec embeddings pilotes et écuries, empilés par régression logistique.",
    "f1-pipe4": "Calibration des probabilités — Post-traitement par régression isotonique pour des estimations fiables.",
    "f1-pipe5": "Livraison tableau de bord — Résultats affichés via une application Streamlit avec détail course par course.",
    "f1-arch-title": "Architecture du modèle",
    "f1-ac1-label": "Couche XGBoost", "f1-ac1-value": "3 classifieurs binaires (P1, P2, P3) entraînés indépendamment sur des features ingéniérées",
    "f1-ac2-label": "Couche PyTorch", "f1-ac2-value": "MLP avec embeddings apprenables pilotes et écuries — capture l'identité latente",
    "f1-ac3-label": "Empilement", "f1-ac3-value": "Méta-apprenant logistique combinant les sorties XGBoost et PyTorch",
    "f1-ac4-label": "Calibration", "f1-ac4-value": "Régression isotonique pour des probabilités bien calibrées",
    "f1-data-title": "Sources de données",
    "f1-ds1": "Résultats historiques, temps au tour et télémétrie (saisons 2014–2024)",
    "f1-ds2": "Données de qualification en direct pour les prochaines courses",
    "f1-ds3": "Conditions météo sur circuit — température, probabilité de pluie, vent",
    "f1-ds4": "Optionnel : analyse de sentiment Reddit sur les pilotes et écuries avant la course",
    "f1-eval-title": "Évaluation",
    "f1-eval-text": "La performance est évaluée par validation croisée leave-one-season-out et un ensemble de test couvrant les saisons 2023–2024 (non vus pendant l'entraînement). Les métriques incluent le Brier score, la log loss, le ROC-AUC, la précision du gagnant et le chevauchement de podium.",
}

KG = {
    "proj-title": "Compétitions Kaggle",
    "proj-desc": "Classements en direct sur des compétitions ML — rangs récupérés chaque jour depuis l'API Kaggle via GitHub Actions.",
    "kg-kicker": "Science des données · Compétitions",
    "kg-profile-btn": "Profil Kaggle ↗",
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
    # language toggle: move aria-current to FR
    html = html.replace('<a data-lang="en" aria-current="page" href="/projects/%s.html">EN</a>' % slug,
                        '<a data-lang="en" href="/projects/%s.html">EN</a>' % slug)
    html = html.replace('<a data-lang="fr" href="/fr/projects/%s.html">FR</a>' % slug,
                        '<a data-lang="fr" aria-current="page" href="/fr/projects/%s.html">FR</a>' % slug)
    # shared chrome text
    html = html.replace('href="#main">Skip to main content<', 'href="#main">Aller au contenu principal<')
    html = html.replace('<span>Aerospace / Mechanical Engineering</span>', '<span>Ingénierie aérospatiale / mécanique</span>')
    html = html.replace('data-ui="home" href="/">Home</a>', 'data-ui="home" href="/fr/">Accueil</a>')
    html = html.replace('data-ui="allProjects" href="/projects/">All projects</a>',
                        'data-ui="allProjects" href="/fr/projects/">Tous les projets</a>')
    # proj-back / proj-home inner text
    html = set_inner_by_id_attr(html, "proj-back", "Retour aux projets")
    html = set_inner_by_id_attr(html, "proj-home", "Accueil")
    # title block keys
    html = html.replace('aria-label="Drawing title block"', 'aria-label="Cartouche"')
    html = html.replace('<span class="tb-key">Drawn by</span>', '<span class="tb-key">Dessiné par</span>')
    html = html.replace('<span class="tb-key">Sheet</span>', '<span class="tb-key">Feuille</span>')
    html = html.replace('<span class="tb-key">Scale</span>', '<span class="tb-key">Échelle</span>')
    html = html.replace('<span class="tb-key">Rev</span>', '<span class="tb-key">Rév</span>')
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
