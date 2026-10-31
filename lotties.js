(() => {
  const lottiePaths = [
    'assets/lotties/3d-cube.json',
    'assets/lotties/activity.json',
    'assets/lotties/atome.json',
    'assets/lotties/broadcast.json',
    'assets/lotties/bubble-tea.json',
    'assets/lotties/car-speed.json',
    'assets/lotties/chat-bot.json',
    'assets/lotties/chemistry.json',
    'assets/lotties/Cladogramme.json',
    'assets/lotties/computer-learning.json',
    'assets/lotties/database.json',
    'assets/lotties/day-night.json',
    'assets/lotties/EG1-2nd-biologie-ecologie.json',
    'assets/lotties/embryon.json',
    'assets/lotties/Environnement.json',
    'assets/lotties/fin_sequence.json',
    'assets/lotties/flyer.json',
    'assets/lotties/game-manette.json',
    'assets/lotties/gas-mask.json',
    'assets/lotties/goutte-eau-tombant.json',
    'assets/lotties/green-energy.json',
    'assets/lotties/headphone-podcast.json',
    'assets/lotties/headphones.json',
    'assets/lotties/light-bulb.json',
    'assets/lotties/medicine.json',
    'assets/lotties/MG1-1re-biologie-ecologie.json',
    'assets/lotties/MG1-Tle-biologie-ecologie.json',
    'assets/lotties/Numbers/01.json',
    'assets/lotties/Numbers/02.json',
    'assets/lotties/Numbers/03.json',
    'assets/lotties/Numbers/04.json',
    'assets/lotties/Numbers/05.json',
    'assets/lotties/Numbers/06.json',
    'assets/lotties/Numbers/07.json',
    'assets/lotties/Numbers/08.json',
    'assets/lotties/Numbers/09.json',
    'assets/lotties/Numbers/10.json',
    'assets/lotties/ph.json',
    'assets/lotties/physique-chimie.json',
    'assets/lotties/power-socket.json',
    'assets/lotties/question_mark.json',
    'assets/lotties/renewable-energy.json',
    'assets/lotties/Reseau_trophic.json',
    'assets/lotties/run.json',
    'assets/lotties/systeme-solaire.json',
    'assets/lotties/video-player.json',
    'assets/lotties/voltmeter.json',
    'assets/lotties/wave-chart.json'
  ];

  const gallery = document.getElementById('gallery');
  const count = document.getElementById('count');
  const search = document.getElementById('search');
  const cards = [];

  const copyText = async (text, button, label) => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copié';
      window.setTimeout(() => { button.textContent = label; }, 1200);
    } catch {
      button.textContent = 'Copie impossible';
      window.setTimeout(() => { button.textContent = label; }, 1600);
    }
  };

  const createCard = (path) => {
    const name = path.split('/').pop().replace(/\.json$/i, '');
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.search = `${name} ${path}`.toLocaleLowerCase('fr');

    const preview = document.createElement('div');
    preview.className = 'preview';
    preview.setAttribute('aria-label', `Prévisualisation de ${name}`);

    const details = document.createElement('div');
    details.className = 'details';
    const title = document.createElement('h2');
    title.className = 'name';
    title.textContent = name;
    title.title = path;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.textContent = 'Copier le nom';
    nameButton.addEventListener('click', () => copyText(name, nameButton, 'Copier le nom'));
    const pathButton = document.createElement('button');
    pathButton.type = 'button';
    pathButton.textContent = 'Copier le chemin';
    pathButton.addEventListener('click', () => copyText(path, pathButton, 'Copier le chemin'));

    actions.append(nameButton, pathButton);
    details.append(title, actions);
    card.append(preview, details);
    cards.push(card);
    gallery.append(card);

    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((animationData) => {
        if (!window.lottie) throw new Error('Lecteur Lottie indisponible');
        window.lottie.loadAnimation({
          container: preview,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData
        }).addEventListener('data_failed', () => {
          preview.replaceChildren();
          preview.classList.add('error');
          preview.textContent = 'Animation invalide';
        });
      })
      .catch(() => {
        preview.replaceChildren();
        preview.classList.add('error');
        preview.textContent = 'Prévisualisation indisponible';
      });
  };

  lottiePaths.forEach(createCard);

  const filterCards = () => {
    const query = search.value.trim().toLocaleLowerCase('fr');
    let visible = 0;
    cards.forEach((card) => {
      const matches = card.dataset.search.includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    count.textContent = `${visible} animation${visible === 1 ? '' : 's'}`;
    const empty = gallery.querySelector('.empty');
    if (!visible && !empty) {
      const message = document.createElement('p');
      message.className = 'empty';
      message.textContent = 'Aucune animation trouvée.';
      gallery.append(message);
    } else if (visible && empty) {
      empty.remove();
    }
  };
  search.addEventListener('input', filterCards);
  filterCards();
})();
