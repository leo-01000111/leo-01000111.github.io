// Every visible string, in French. The mascot is "Cédric" here; identifiers say `cedric`.
export const T = {
  title: "La ville de Cédric",
  close: "Fermer",
  back: "Retour",
  noWebGL: "Cette ville a besoin de WebGL2, que ce navigateur ne propose pas.",
  failed: "La ville n'a pas pu s'ouvrir.",
  soon: "Bientôt",
  enter: "Espace — entrer",
  panelSoon: "Ce lieu ouvrira bientôt.",
  loading: "Chargement de la ville…",
  places: {
    mairie: { name: "Hôtel de Ville", prompt: "Espace — entrer à l'Hôtel de Ville", sign: "HÔTEL DE VILLE", flavour: "Le tableau d'affichage attend ses premiers messages." },
    arcade: { name: "Salle d'arcade", prompt: "Espace — entrer dans la salle d'arcade", sign: "ARCADE", flavour: "Les bornes chauffent. Les premiers jeux arrivent." },
    karting: { name: "Karting", prompt: "Espace — entrer au karting", sign: "KARTING", flavour: "La piste est tracée. Les karts sont en réglage." },
    basile: { name: "Chez Basile", prompt: "Espace — monter chez Basile", sign: "CHEZ BASILE" },
    "basile-down": { name: "Ascenseur", prompt: "Espace — descendre" },
    // --- aerodrome ---
    aerodrome: { name: "Aérodrome", prompt: "Espace — décoller", sign: "AÉRODROME", flavour: "Un planeur attend en bout de piste." },
    // --- end aerodrome ---
    port: { name: "Le Port", prompt: "Espace — monter à bord", sign: "PORT", flavour: "Une petite vedette électrique attend au ponton." }, // --- port ---
    gare: { name: "Gare de Cédric-sur-Mer", prompt: "", sign: "GARE" },
  },
  // La gare: guichet, tableau des départs, quais. Les destinations sont décrites dans places/destinations.js.
  station: {
    name: "Gare de Cédric-sur-Mer", plate: "GARE DE CÉDRIC-SUR-MER", tillSign: "GUICHET", voieSign: "VOIE",
    promptBuy: "Espace — acheter un billet", promptBoard: "Espace — monter",
    till: {
      tag: "Guichet", title: "Acheter un billet", intro: "Les billets sont gratuits. Où voulez-vous aller ?",
      here: "vous êtes ici", hint: "↑ ↓ choisir · Entrée ou Espace : prendre le billet · Échap : fermer", close: "Fermer",
      listLabel: "Destinations",
    },
    bought: "Billet pris pour {dest}. Regardez le tableau des départs.",
    replaced: "Votre ancien billet est échangé.",
    ticket: { label: "Billet", voie: "Voie", depart: "Départ", free: "Gratuit", aria: "Billet pour {dest}, départ {time}, voie {voie}" },
    board: {
      title: "Départs", sub: "Gare de Cédric-sur-Mer", time: "Heure", dest: "Destination", voie: "Voie", note: "Remarque",
      onTime: "À l'heure", late: "Retard 5 min", yours: "Votre train", atPlatform: "À quai", yourVoie: "Votre train part voie {n}.",
    },
    hint: {
      readBoard: "Regardez le tableau des départs pour connaître votre voie.",
      wrongPlatform: "Votre train part voie {n}.",
      announced: "Votre train est annoncé…",
      arriving: "Le train entre en gare.",
    },
    notExist: "Cette destination n'existe pas encore… le train a fait demi-tour.",
    ticketUsed: "Le billet pour {dest} est utilisé.",
    dest: {
      "val-brume": { name: "Val-de-Brume", blurb: "Village de montagne, toits de lauze et fumée de cheminée." },
      "sables": { name: "Observatoire des Sables", blurb: "Un grand télescope posé dans le désert, loin de toute lumière." },
      "cormorans": { name: "Port-aux-Cormorans", blurb: "Le port d'une petite île, où le ferry arrive toujours à son heure." },
      "alba": { name: "Station Alba", blurb: "Un anneau tranquille au-dessus des nuages." },
      "lanternes": { name: "Forêt des Lanternes", blurb: "Un sentier d'arbres où pendent des lampions de papier." },
      "here": { name: "Cédric-sur-Mer", blurb: "La ville du bord de mer, au soleil couchant." },
    },
  },
  // --- aerodrome ---
  flight: {
    tag: "Aérodrome", title: "Vol en planeur",
    text: "Le planeur est prêt en bout de piste. Départ au treuil, puis vol libre au-dessus de la baie et de la ville.",
    takeoff: "Décoller", stay: "Rester au sol", panelHint: "Entrée pour décoller, Échap pour annuler",
    hud: { alt: "Altitude", speed: "Vitesse", vario: "Vario", m: "m", kmh: "km/h", ms: "m/s" },
    hint: [["W S", "piquer / cabrer"], ["A D", "incliner"], ["Maj", "aérofreins"], ["Espace", "atterrir"], ["Échap", "rentrer"]],
    hintLabel: "Commandes de vol",
    winch: "Treuil en route", release: "Câble largué",
    land: "Espace — atterrir", notYet: "Pas encore : alignez-vous sur la piste, plus bas.",
    landing: "Atterrissage assisté", landed: "Posé. Bonne promenade.",
    confirmTitle: "Rentrer à l'aérodrome ?", confirmText: "Cédric quitte le vol et retourne au hangar.",
    confirmYes: "Rentrer", confirmNo: "Continuer le vol",
    stall: "Décrochage", thermal: "Ascendance", back: "Retour au hangar",
  },
  // --- end aerodrome ---
  // Spoken lines when open(ctx) did not receive the friends' lines
  friends: {
    Basile: ["Bienvenue chez Basile.", "Le coucher de soleil est offert par la maison.", "Prends ton temps. La vue ne bouge pas."],
    Octave: ["Octave, enchanté.", "Ici, rien ne presse.", "Le soir, la promenade est plus calme."],
    Firmin: ["Moi, c'est Firmin !", "Tu as vu la grande crevette rose, là-haut ?", "Je fais le tour de la place. Encore un."],
  },
  bench: { son: "son", sonOn: "Activer le son", sonOff: "Couper le son" },
  streets: {
    front: "Front de mer", avenue: "Avenue du Tram", basse: "Rue Basse", haute: "Rue Haute",
    phare: "Rue du Phare", nord: "Rue Nord", sud: "Rue Sud", haut: "Rue du Haut", bas: "Rue du Bas",
  },
  phases: { golden: "Heure dorée", sunset: "Coucher de soleil", blue: "Heure bleue", night: "Nuit" },
  seasons: { autumn: "Automne", winter: "Hiver", spring: "Printemps", summer: "Été" },
  weather: {
    leaves: "Chute de feuilles", mist: "Brume légère", clear: "Ciel dégagé", snow: "Neige douce",
    stars: "Ciel clair et étoilé", petals: "Pétales au vent", shower: "Petite averse",
    rain: "Pluie chaude", fireflies: "Lucioles",
  },
  hud: {
    back: "← Retour", backLabel: "Retour à la page",
    soundOff: "Couper le son", soundOn: "Remettre le son", settings: "Réglages",
    minimap: "Mini-carte", mapOpen: "Ouvrir le plan",
    // [key, action]
    hint: [["W", "nager"], ["A D", "tourner"], ["S", "reculer"], ["M", "plan"], ["Échap", "quitter"]],
    hintLabel: "Commandes",
  },
  map: { title: "Plan de la ville", here: "vous êtes ici", north: "N", sun: "coucher", close: "M ou Échap pour fermer", closeBtn: "Fermer le plan" },
  panel: { close: "Fermer", hint: "Espace ou Échap pour fermer" },
  name: {
    title: "Comment t'appelles-tu ?", label: "Ton prénom", go: "C'est parti", skip: "Passer",
    note: "Ton prénom est envoyé à Léon, rien d'autre.", subject: "Cédric's city : nouveau joueur",
  },
  board: {
    title: "Panneau d'affichage", listLabel: "Mots épinglés", anonymous: "Anonyme",
    empty: "Le panneau est vide pour le moment. Le premier mot sera peut-être le vôtre.",
    name: "Nom (facultatif)", message: "Votre mot", send: "Épingler mon mot", sending: "Envoi…",
    soon: "Bientôt ouvert : on ne peut pas encore écrire ici.",
    thanks: "Merci ! Votre mot sera affiché après relecture.",
    error: "L'envoi n'a pas abouti. Votre texte est gardé : réessayez dans un instant.",
    needText: "Écrivez quelques mots d'abord.", wait: "Un instant avant d'envoyer un autre mot.",
    subject: "Panneau d'affichage : nouveau mot",
  },
  settings: {
    title: "Réglages", camera: "Caméra", cine: "Cinématique", follow: "Suivi", time: "Heure du soir",
    music: "Musique", ambience: "Ambiance", mute: "Son coupé", on: "oui", off: "non", close: "Fermer les réglages",
  },
  quality: { high: "haute", medium: "moyenne", low: "basse" },
  // --- karting ---
  kart: {
    tag: "Circuit", title: "Karting", menuLine: "Deux façons de rouler. La piste grimpe jusqu'à la colline.",
    race: "Course", raceSub: "3 tours contre 3 karts", free: "Tour libre", freeSub: "Un tour, sans adversaires",
    later: "Plus tard", escKey: "Échap", menuHint: "↑ ↓ pour choisir · Espace ou Entrée pour valider", panelHint: "↑ ↓ pour choisir · Espace ou Entrée pour valider",
    record: "Record", none: "—", lap: "Tour", sur: "sur", current: "Tour en cours", bestLabel: "Meilleur",
    speedUnit: "km/h", boost: "Turbo", go: "Partez !", mapLabel: "Plan du circuit",
    keys: [["W", "accélérer"], ["S", "freiner"], ["A D", "tourner"], ["Maj", "turbo"], ["Échap", "quitter"]],
    quitTitle: "Quitter la course ?", quitText: "Cédric reprendra à pied devant le karting.", quitYes: "Quitter", quitNo: "Continuer",
    endRace: "Course terminée", endFree: "Tour terminé", ord: ["1er", "2e", "3e", "4e"],
    total: "Temps total", bestLap: "Meilleur tour", newRecord: "Nouveau record !", standing: "Classement",
    replay: "Rejouer", back: "Retour en ville",
  },
  // --- end karting ---
  dev: { fps: "images/s", phase: "phase", weather: "météo", quality: "qualité", near: "lieu proche", pos: "position" },
  // --- port ---
  port: {
    tag: "Le Port", title: "La vedette de Cédric",
    text: "Une petite vedette électrique, amarrée au ponton. Le soleil se couche là-bas, au bout de l'eau.",
    cast: "Larguer les amarres", later: "Pas maintenant", hint: "Espace — larguer les amarres · Échap — rester à quai",
    keys: "W avancer · S reculer · A D barre · M plan",
    dock: "Espace — accoster", ask: "Rentrer au port ?", askKeys: "Échap — rentrer · une autre touche — rester en mer",
  },
};
