(() => {
  const ROOT = new URL('../../', document.currentScript.src);

  const createElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const normalize = (value) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const resourceUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('../assets/')) return new URL(path.slice(3), ROOT).href;
    return new URL(path, ROOT).href;
  };

  const mountThemeVisual = async (container, theme) => {
    if (!theme?.lottie || !window.lottie) return;
    try {
      const response = await fetch(resourceUrl(theme.lottie));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const animationData = await response.json();
      container.replaceChildren();
      window.lottie.loadAnimation({ container, renderer: 'svg', loop: true, autoplay: true, animationData });
    } catch {
      container.classList.add('activity-exercise-theme-visual-fallback');
    }
  };

  const renderThemeVisual = (theme, label) => {
    const visual = createElement('span', 'activity-exercise-theme-visual', label.slice(0, 2).toUpperCase());
    visual.setAttribute('aria-hidden', 'true');
    if (theme?.lottie) {
      mountThemeVisual(visual, theme);
    } else if (theme?.logo) {
      const image = createElement('img', 'activity-exercise-theme-logo');
      image.src = resourceUrl(theme.logo);
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        visual.textContent = label.slice(0, 2).toUpperCase();
      }, { once: true });
      visual.replaceChildren(image);
    }
    return visual;
  };

  const render = async (component) => {
    const section = createElement('section', 'activity-section activity-exercise-library');
    section.dataset.activityBlock = 'bibliotheque-exercice';
    section.append(createElement('h2', 'activity-section-title', component.dataset.title || 'Exercices personnalisés'));
    component.replaceWith(section);

    const courseId = document.body.dataset.course;
    const pathParts = decodeURIComponent(location.pathname).split('/').filter(Boolean);
    const chapterName = pathParts[pathParts.length - 3] || '';
    const activityName = pathParts[pathParts.length - 1] || '';
    const chapterMatch = chapterName.match(/chapitre\s*(\d+)/i);
    const activityMatch = activityName.match(/activit[eé](?:_|-| )*(\d+)/i);
    if (!courseId || !chapterMatch || !activityMatch) {
      section.append(createElement('p', 'activity-exercise-library-empty', 'Impossible d’identifier le cours, le chapitre ou l’activité depuis cette page.'));
      return;
    }

    const libraryUrl = new URL(`cours/${encodeURIComponent(courseId)}/bibliotheque-exercice/`, ROOT);
    const chapterId = `chap${Number(chapterMatch[1])}`;
    const activityId = `activite${Number(activityMatch[1])}`;
    const [themesResponse, exercisesResponse] = await Promise.all([
      fetch(new URL('Ph-Ch_exo-themes.json', libraryUrl)),
      fetch(new URL(`Ph-Ch_exo-${chapterId}-${activityId}.json`, libraryUrl))
    ]);
    if (!themesResponse.ok) throw new Error('Le fichier Ph-Ch_exo-themes.json est introuvable.');
    const themeData = await themesResponse.json();
    const themeByName = new Map((themeData.themes || []).map((theme) => [normalize(theme.nom), theme]));
    const categoryById = new Map((themeData.categories || []).map((category) => [category.id, category]));

    if (!exercisesResponse.ok) {
      section.append(createElement('p', 'activity-exercise-library-empty', `Aucun fichier d’exercices n’est disponible pour ${chapterId}, ${activityId}.`));
      return;
    }

    const exerciseData = await exercisesResponse.json();
    const exercises = Array.isArray(exerciseData.exercices) ? exerciseData.exercices : [];
    if (!exercises.length) {
      section.append(createElement('p', 'activity-exercise-library-empty', 'Aucun exercice n’est disponible pour cette activité.'));
      return;
    }

    const filters = createElement('div', 'activity-exercise-filters');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Filtrer les exercices par catégorie');
    const exerciseList = createElement('div', 'activity-exercise-list');
    let activeCategory = null;
    const filterButtons = [];

    const renderExercises = () => {
      exerciseList.replaceChildren();
      if (!activeCategory) {
        exerciseList.append(createElement('p', 'activity-exercise-library-empty', 'Choisissez une catégorie pour afficher les exercices.'));
        return;
      }
      const visibleExercises = exercises.filter((exercise) => {
        const theme = themeByName.get(normalize(exercise.themeId));
        return (theme?.tags || []).includes(activeCategory);
      });
      if (!visibleExercises.length) {
        exerciseList.append(createElement('p', 'activity-exercise-library-empty', 'Aucun exercice dans cette catégorie.'));
        return;
      }
      visibleExercises.forEach((exercise) => {
        const card = createElement('article', 'activity-exercise-card');
        const theme = themeByName.get(normalize(exercise.themeId));
        const tile = createElement('div', 'activity-exercise-tile');
        tile.append(renderThemeVisual(theme, exercise.themeId || 'Exercice'));
        tile.append(createElement('p', 'activity-exercise-theme', exercise.themeId || 'Thème'));
        tile.append(createElement('h3', 'activity-exercise-title', exercise.titre || 'Exercice'));
        const more = createElement('button', 'activity-exercise-more', 'Voir +');
        more.type = 'button';
        more.setAttribute('aria-expanded', 'false');
        const details = createElement('div', 'activity-exercise-details');
        details.hidden = true;
        if (exercise.enonce) details.append(createElement('p', 'activity-exercise-statement', exercise.enonce));
        if (exercise.question) details.append(createElement('p', 'activity-exercise-question', exercise.question));
        if (exercise.reponse) {
          const answer = createElement('details', 'activity-exercise-answer');
          answer.append(createElement('summary', '', 'Voir la correction'), createElement('p', '', exercise.reponse));
          details.append(answer);
        }
        more.addEventListener('click', () => {
          const expanded = more.getAttribute('aria-expanded') === 'true';
          more.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          more.textContent = expanded ? 'Voir +' : 'Voir moins';
          details.hidden = expanded;
        });
        tile.append(more);
        card.append(tile, details);
        exerciseList.append(card);
      });
    };

    const addFilter = (id, label) => {
      const button = createElement('button', 'activity-exercise-filter', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', activeCategory === id ? 'true' : 'false');
      button.addEventListener('click', () => {
        activeCategory = activeCategory === id ? null : id;
        filterButtons.forEach((filter) => filter.setAttribute('aria-pressed', filter.dataset.category === activeCategory ? 'true' : 'false'));
        renderExercises();
      });
      button.dataset.category = id;
      filterButtons.push(button);
      filters.append(button);
    };

    (themeData.categories || []).forEach((category) => addFilter(category.id, category.nom));
    renderExercises();
    section.append(filters, exerciseList);
  };

  [...document.querySelectorAll('[data-component="bibliotheque-exercice"]')].forEach((component, index) => {
    render(component).catch((error) => {
      const section = document.querySelectorAll('[data-activity-block="bibliotheque-exercice"]')[index];
      if (section) section.append(createElement('p', 'activity-exercise-library-empty', error.message));
    });
  });
})();
