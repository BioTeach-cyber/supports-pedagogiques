(() => {
  const { config } = SITE;

  document.querySelector('[data-titre]').textContent = config.titre;
  document.querySelector('[data-sous-titre]').textContent = config.sousTitre;
  document.title = config.titre;

  const grille = document.getElementById('sections');
  config.sections.forEach((section) => {
    const lien = document.createElement('a');
    lien.className = 'vignette theme';
    lien.href = SITE.url(section.lien);
    if (CSS.supports('color', section.couleur)) {
      lien.style.setProperty('--couleur-theme', section.couleur);
    }

    const visuel = document.createElement('div');
    visuel.className = 'vignette-visuel';
    visuel.setAttribute('aria-hidden', 'true');
    visuel.textContent = section.icone;

    const texte = document.createElement('div');
    texte.className = 'vignette-texte';

    const titre = document.createElement('h2');
    titre.textContent = section.titre;

    const description = document.createElement('p');
    description.textContent = section.description;

    texte.append(titre, description);
    lien.append(visuel, texte);
    grille.append(lien);
  });

  if (config.assistantIA?.url) {
    const url = new URL(config.assistantIA.url, SITE.RACINE);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      const lien = document.getElementById('lien-ia');
      lien.href = url.href;
      lien.textContent = 'Assistant IA : ' + config.assistantIA.titre;
      lien.hidden = false;
    }
  }
})();