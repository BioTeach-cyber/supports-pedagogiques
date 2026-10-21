// assets/js/theme.js
SITE.appliquerTheme = async () => {
  const couleur = await trouverCouleur();
  document.documentElement.style.setProperty('--couleur-theme', couleur);

  // Informe les iframes enfants (applications) de la couleur active
  SITE.couleurTheme = couleur;
};

async function trouverCouleur() {
  const { config } = SITE;
  const d = document.body.dataset;

  // 1. Paramètre d'adresse (?theme=2a9d8f)
  const param = new URLSearchParams(location.search).get('theme');
  if (param && /^#?[0-9a-f]{3,8}$/i.test(param)) {
    return '#' + param.replace('#', '');
  }

  // 2. Couleur forcée sur la page
  if (d.couleur) return d.couleur;

  // 3. Élément d'une partie (cours, application...)
  if (d.cours) {
    const cours = await SITE.chargerCours(d.cours);
    SITE.cours = cours;                       // gardé pour menu, réseau, etc.
    return SITE.couleurDe(cours, d.chapitre, d.seance);
}

  // 4. Couleur de la section
  if (d.section) {
    const s = config.sections.find((s) => s.id === d.section);
    if (s?.couleur) return s.couleur;
  }

  // 5. Couleur par défaut
  return config.couleurParDefaut;
}