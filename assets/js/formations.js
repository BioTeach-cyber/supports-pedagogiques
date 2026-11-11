(() => {
  const ROOT = new URL('../../', document.currentScript.src);
  const content = document.getElementById('page-content');

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const formatDate = (value) => {
    if (!value) return '';
    const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    const options = /^\d{4}-\d{2}$/.test(value)
      ? { month: 'long', year: 'numeric' }
      : { dateStyle: 'long' };
    return new Intl.DateTimeFormat('fr-FR', options).format(date);
  };

  const renderFormations = async () => {
    try {
      const response = await fetch(new URL('formations/formations.json', ROOT));
      if (!response.ok) throw new Error('Le catalogue des formations est introuvable.');
      const data = await response.json();
      const formations = Array.isArray(data) ? data : data.formations;
      if (!Array.isArray(formations)) throw new Error('Le catalogue des formations est invalide.');

      const intro = element('p', 'intro', 'Retrouvez ici les supports et ressources des formations. Les informations sont structurées pour permettre l’ajout de filtres par date, commanditaire ou type.');
      const grid = element('div', 'formation-grid');
      formations
        .filter((formation) => formation.statut !== 'inactif')
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .forEach((formation) => {
          if (!formation.titre || !formation.lien) return;
          const card = element('a', 'formation-card');
          card.href = new URL(formation.lien, ROOT).href;
          card.setAttribute('aria-label', `${formation.titre}${formation.commanditaire ? ` — ${formation.commanditaire}` : ''}`);
          card.style.setProperty('--formation-color', formation.couleur || '#6a4c93');

          const visual = element('span', 'formation-card-visual');
          visual.setAttribute('aria-hidden', 'true');
          if (formation.image) {
            const image = element('img');
            image.src = new URL(formation.image, ROOT).href;
            image.alt = '';
            visual.append(image);
          } else {
            visual.append(element('span', 'formation-monogram', formation.sigle || 'Formation'));
          }

          const details = element('span', 'formation-card-text');
          details.append(element('h2', '', formation.titre));
          const meta = element('span', 'formation-meta');
          [formation.commanditaire, formatDate(formation.date), formation.type].filter(Boolean).forEach((value) => meta.append(element('span', '', value)));
          if (meta.childElementCount) details.append(meta);
          if (formation.description) details.append(element('span', 'formation-description', formation.description));
          card.append(visual, details);
          grid.append(card);
        });

      content.replaceChildren(intro);
      if (!grid.childElementCount) content.append(element('p', 'empty-state', 'Aucun support de formation n’est encore référencé.'));
      else content.append(grid);
    } catch (error) {
      content.replaceChildren(element('p', 'error-state', error.message || 'Les formations n’ont pas pu être chargées.'));
    }
  };

  renderFormations();
})();
