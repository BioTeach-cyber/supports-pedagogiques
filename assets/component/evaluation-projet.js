(() => {
  const scriptUrl = document.currentScript.src;
  const ROOT = new URL('../../', scriptUrl);
  const pathSegments = decodeURIComponent(location.pathname).split('/').filter(Boolean);
  const courseId = document.body.dataset.course || pathSegments[pathSegments.indexOf('cours') + 1] || '';
  const courseFolderIndex = pathSegments.indexOf(courseId);
  const chapterId = pathSegments[courseFolderIndex + 1] || pathSegments.slice(-3, -2)[0] || '';

  const createElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const recolorLottie = (data, color) => {
    const rgb = color.match(/[\da-f]{2}/gi).slice(0, 3).map((channel) => parseInt(channel, 16) / 255);
    const recolorColor = (value) => {
      if (Array.isArray(value)) {
        if ((value.length === 3 || value.length === 4) && value.every((channel) => typeof channel === 'number' && channel >= 0 && channel <= 1)) {
          const isBlack = Math.max(value[0], value[1], value[2]) < 0.02;
          return [...(isBlack ? [0, 0, 0] : rgb), value.length === 4 ? value[3] : 1];
        }
        return value.map(recolorColor);
      }
      return value;
    };
    const visit = (value) => {
      if (Array.isArray(value)) return value.map(visit);
      if (!value || typeof value !== 'object') return value;
      if (Array.isArray(value.k)) {
        const result = { ...value };
        if (value.a === 1) {
          result.k = value.k.map((frame) => {
            if (!frame || typeof frame !== 'object') return frame;
            const next = { ...frame };
            if (Array.isArray(frame.s)) next.s = recolorColor(frame.s);
            if (Array.isArray(frame.e)) next.e = recolorColor(frame.e);
            return next;
          });
        } else {
          result.k = recolorColor(value.k);
        }
        return result;
      }
      for (const [key, item] of Object.entries(value)) {
        if (key === 'c' && item && typeof item === 'object' && 'k' in item) {
          value[key] = { ...item, k: recolorColor(item.k) };
        } else {
          value[key] = visit(item);
        }
      }
      return value;
    };
    return visit(JSON.parse(JSON.stringify(data)));
  };

  const mountLottie = async (target, path, color) => {
    if (!target || !path || !window.lottie) return;
    try {
      const response = await fetch(new URL(path, ROOT), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const animationData = await response.json();
      window.lottie.loadAnimation({
        container: target,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: recolorLottie(animationData, color)
      });
    } catch {
      target.classList.add('evaluation-project-lottie-fallback');
      target.textContent = '↗';
    }
  };

  const render = async (component) => {
    const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
    if (!response.ok) throw new Error('Le fichier de données du cours est introuvable.');
    const course = await response.json();
    const chapter = (course.chapitres || []).find((item) => item.id === chapterId);
    if (!chapter) throw new Error(`Aucun chapitre ne correspond au dossier « ${chapterId} ».`);

    const isExpose = chapter.type?.toLowerCase() === 'exposes';
    const secondaryEvaluations = (chapter.evaluationsSecondaires || []).filter((item) =>
      item.statut === 'actif' && item.page
    );
    const evaluation = isExpose
      ? secondaryEvaluations.find((item) => item.type?.toLowerCase() === 'oral')
      : secondaryEvaluations.find((item) => ['projet', 'oral'].includes(item.type?.toLowerCase()))
        || (chapter.evaluationFinale?.statut === 'actif' && chapter.evaluationFinale.page ? chapter.evaluationFinale : null);
    const color = chapter.couleur || course.couleur || '#7fbc48';
    const section = createElement('section', 'evaluation-project-section');

    if (!evaluation) {
      section.append(createElement('p', 'evaluation-project-error', 'Aucune évaluation de type projet active n’est renseignée pour ce chapitre.'));
      component.replaceWith(section);
      return;
    }

    const card = createElement('div', 'evaluation-project-card');
    const content = createElement('div', 'evaluation-project-content');
    const visual = createElement('div', 'evaluation-project-visual');
    const heading = createElement('h2', 'evaluation-project-heading', component.dataset.title || 'Grille d’évaluation');
    const link = createElement('a', 'evaluation-project-button', component.dataset.buttonLabel || 'Ouvrir la grille d’évaluation');
    link.href = new URL(evaluation.page, new URL(`cours/${encodeURIComponent(courseId)}/`, ROOT)).href;
    link.setAttribute('aria-label', 'Ouvrir la grille d’évaluation');
    const animation = createElement('span', 'evaluation-project-lottie');
    animation.setAttribute('aria-hidden', 'true');
    content.append(link);
    visual.append(heading, animation);
    card.append(content, visual);
    section.append(card);
    component.replaceWith(section);
    mountLottie(animation, evaluation.lottie || 'assets/lotties/project.json', color);
  };

  document.querySelectorAll('[data-component="evaluation-projet"]').forEach((component) => {
    render(component).catch((error) => {
      const section = createElement('section', 'evaluation-project-section');
      section.append(createElement('p', 'evaluation-project-error', error.message));
      component.replaceWith(section);
    });
  });
})();
