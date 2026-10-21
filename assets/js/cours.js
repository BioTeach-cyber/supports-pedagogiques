(() => {
  const ROOT = new URL('../../', document.currentScript.src);
  const params = new URLSearchParams(location.search);
  const content = document.getElementById('page-content');
  const header = document.getElementById('page-header');
  const pageTitle = document.getElementById('page-title');
  const currentYear = new Date().getFullYear();
  const schoolYear = new Date().getMonth() >= 8
    ? `${currentYear}-${currentYear + 1}`
    : `${currentYear - 1}-${currentYear}`;

  const assetUrl = (path) => {
    if (!path) return '';
    const normalized = path
      .replace(/^\.\//, '')
      .replace(/^\/Images\/Lotties\//i, 'assets/lotties/')
      .replace(/^\/Images\/Numbers\//i, 'assets/lotties/Numbers/')
      .replace(/^lottie\//, 'assets/lotties/');
    return new URL(normalized, ROOT).href;
  };

  const courseDataUrl = (courseId, path) => {
    const courseRoot = new URL(`cours/${encodeURIComponent(courseId)}/`, ROOT);
    const normalizedPath = path.startsWith('cours/') ? path.slice('cours/'.length) : path;
    const normalizedCoursePath = normalizedPath.startsWith(`${courseId}/`)
      ? normalizedPath.slice(`${courseId}/`.length)
      : normalizedPath;
    return new URL(normalizedCoursePath, courseRoot).href;
  };

  const chapterPageUrl = (courseId, chapter) => chapter.page
    ? courseDataUrl(courseId, chapter.page)
    : courseUrl(courseId, chapter.id);

  const courseUrl = (courseId, chapterId, activityId) => {
    const url = new URL('cours/', ROOT);
    url.searchParams.set('cours', courseId);
    if (chapterId) url.searchParams.set('chapitre', chapterId);
    if (activityId) url.searchParams.set('activite', activityId);
    return url.href;
  };

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const objectiveLabel = (objective) => typeof objective === 'string'
    ? objective
    : objective?.libelle || '';

  const setTheme = (course) => {
    const color = course?.couleur || '#7fbc48';
    document.documentElement.style.setProperty('--course-color', color);
    header.style.setProperty('--course-color', color);
    document.querySelector('meta[name="theme-color"]').content = color;
    return color;
  };

  const recolorLottie = (animationData, color) => {
    const hex = color.replace('#', '');
    const themeRgb = hex.match(/[\da-f]{2}/gi).slice(0, 3).map((part) => parseInt(part, 16) / 255);
    const blackRgb = [0, 0, 0];
    const isColor = (value) => Array.isArray(value)
      && (value.length === 3 || value.length === 4)
      && value.every((part) => typeof part === 'number' && part >= 0 && part <= 1);
    const recolorChannels = (channels) => {
      const isBlack = Math.max(channels[0], channels[1], channels[2]) < 0.02;
      return [...(isBlack ? blackRgb : themeRgb), channels.length === 4 ? channels[3] : 1];
    };
    const recolorGradient = (gradient) => {
      const result = [...gradient];
      const stops = Math.floor(result[0]);
      for (let stop = 0; stop < stops; stop += 1) {
        const offset = 1 + stop * 4;
        if (offset + 3 >= result.length) break;
        const channels = result.slice(offset + 1, offset + 4);
        const isBlack = Math.max(...channels) < 0.02;
        result.splice(offset + 1, 3, ...(isBlack ? blackRgb : themeRgb));
      }
      return result;
    };
    const recolorColor = (value) => {
      if (isColor(value)) return recolorChannels(value);
      if (Array.isArray(value)) {
        if (typeof value[0] === 'number' && value[0] > 1 && value.length >= 5) return recolorGradient(value);
        return value.map((item) => recolorColor(item));
      }
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
      return value;
    };

    const visit = (value, colorControl = false) => {
      if (Array.isArray(value)) return value.map((item) => visit(item, colorControl));
      if (!value || typeof value !== 'object') return value;
      const isColorControl = colorControl || value.mn === 'ADBE Color Control' || value.mn === 'ADBE Color Control-0001';
      for (const [key, item] of Object.entries(value)) {
        if (key === 'c' && item && typeof item === 'object' && 'k' in item) {
          value[key] = { ...item, k: recolorColor(item.k) };
        } else if (key === 'sc' && typeof item === 'string' && /^#[\da-f]{6}$/i.test(item)) {
          value[key] = item.toLowerCase() === '#000000' ? '#000000' : color;
        } else if (key === 'v' && isColorControl && item && typeof item === 'object' && 'k' in item) {
          value[key] = { ...item, k: recolorColor(item.k) };
        } else {
          value[key] = visit(item, isColorControl);
        }
      }
      return value;
    };

    return visit(JSON.parse(JSON.stringify(animationData)));
  };

  const mountLottie = async (container, path, color, loop = true) => {
    const lottiePlayer = window.lottie || globalThis.lottie || globalThis.bodymovin;
    if (!container || !path) return;
    if (!lottiePlayer) {
      container.textContent = 'Lecteur Lottie indisponible';
      return;
    }

    const showError = (error) => {
      container.replaceChildren();
      container.classList.add('lottie-error');
      container.textContent = 'Animation indisponible';
      container.title = `${path} : ${error.message || error}`;
    };

    const play = (animationData, fallbackData = null) => {
      let animation;
      try {
        animation = lottiePlayer.loadAnimation({
          container,
          renderer: 'svg',
          loop,
          autoplay: true,
          animationData
        });
      } catch (error) {
        if (fallbackData) return play(fallbackData);
        showError(error);
        return null;
      }
      animation.addEventListener('data_failed', () => {
        if (fallbackData) {
          animation.destroy();
          container.replaceChildren();
          play(fallbackData);
        } else {
          showError(new Error('Le lecteur n’a pas pu interpréter le fichier.'));
        }
      });
      animation.addEventListener('DOMLoaded', () => container.classList.remove('lottie-error'));
      return animation;
    };

    try {
      const url = assetUrl(path);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Chargement HTTP ${response.status} pour ${url}`);
      const body = await response.text();
      if (!body.trim()) throw new Error(`Réponse vide depuis ${url}`);
      let original;
      try {
        original = JSON.parse(body);
      } catch (error) {
        throw new Error(`JSON invalide depuis ${url} : ${error.message}`);
      }
      const recolored = recolorLottie(original, color);
      return play(recolored, original);
    } catch (error) {
      showError(error);
      console.error(`Échec de chargement Lottie : ${path}`, error);
    }
  };

  const createQrCode = () => {
    const target = document.getElementById('page-qr');
    const enlargedTarget = document.getElementById('page-qr-large');
    const openButton = document.getElementById('qr-open');
    const dialog = document.getElementById('qr-dialog');
    const closeButton = document.getElementById('qr-close');
    const QrConstructor = window.QRCode || globalThis.QRCode;
    if (target && QrConstructor) {
      try {
        new QrConstructor(target, {
          text: location.href,
          width: 64,
          height: 64,
          colorDark: '#202a35',
          colorLight: '#ffffff',
          correctLevel: QrConstructor.CorrectLevel.M
        });
        new QrConstructor(enlargedTarget, {
          text: location.href,
          width: 280,
          height: 280,
          colorDark: '#202a35',
          colorLight: '#ffffff',
          correctLevel: QrConstructor.CorrectLevel.M
        });
      } catch {
        target.textContent = 'QR indisponible';
        return;
      }
    } else if (target) {
      target.textContent = 'QR indisponible';
      return;
    }

    openButton?.addEventListener('click', () => dialog?.showModal());
    closeButton?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  };

  const renderCourseList = async () => {
    pageTitle.textContent = 'Cours';
    document.title = 'Cours — Mes ressources pédagogiques';
    setTheme();
    const response = await fetch(new URL('cours/catalogue.json', ROOT));
    if (!response.ok) throw new Error('Le catalogue des cours est introuvable.');
    const catalogue = await response.json();
    const year = schoolYear;
    content.append(element('p', 'eyebrow', `Année scolaire ${year}`), element('h2', 'section-title', 'Cours de l’année en cours'));
    const grid = element('div', 'course-grid');
    let logoMounted = false;

    for (const courseId of catalogue.cours || []) {
      try {
        const courseResponse = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
        if (!courseResponse.ok) continue;
        const course = await courseResponse.json();
        if (Array.isArray(course.annees) && !course.annees.includes(year)) continue;
        const card = element('a', 'course-card');
        card.href = courseUrl(courseId);
        card.setAttribute('aria-label', `${(course.classes || []).join(' ')} — ${course.titre}`);
        card.style.setProperty('--course-color', course.couleur || '#7fbc48');
        const visual = element('span', 'course-card-lottie');
        visual.setAttribute('aria-hidden', 'true');
        const cardText = element('span', 'course-card-text');
        cardText.append(element('span', 'course-class', (course.classes || []).join(' · ')), element('strong', '', course.titre));
        card.append(visual, cardText);
        grid.append(card);
        mountLottie(visual, course.lottie, course.couleur || '#7fbc48');
        if (!logoMounted) {
          mountLottie(document.getElementById('brand-animation'), course.lottie, course.couleur || '#7fbc48');
          logoMounted = true;
        }
      } catch {
        continue;
      }
    }
    if (!grid.childElementCount) content.append(element('p', 'empty-state', 'Aucun cours n’est publié pour cette année scolaire.'));
    else content.append(grid);
  };

  const renderNetwork = async (course, courseId) => {
    const color = setTheme(course);
    pageTitle.textContent = course.titre;
    document.title = `${course.titre} — Mes ressources pédagogiques`;
    await mountLottie(document.getElementById('brand-animation'), course.lottie, color);
    const networkSection = element('section', 'network-shell course-network-shell');
    networkSection.setAttribute('aria-label', `Réseau du cours ${course.titre}`);
    const networkHost = element('div', 'course-network');
    networkHost.setAttribute('role', 'img');
    networkHost.setAttribute('aria-label', `Nœud central représentant le cours ${course.titre}.`);
    const overlay = element('div', 'network-lotties');
    overlay.setAttribute('aria-hidden', 'true');
    networkSection.append(networkHost, overlay);
    content.append(networkSection);

    const visNetwork = window.vis?.Network || window.Network || globalThis.Network;
    const visDataSet = window.vis?.DataSet || window.DataSet || globalThis.DataSet;
    if (!visNetwork || !visDataSet) {
      networkHost.hidden = true;
      content.append(element('p', 'empty-state', 'Le réseau interactif n’a pas pu être chargé.'));
      return;
    }

    const rootId = 'course-root';
    const chapters = course.chapitres || [];
    const chapterNodeId = (chapter) => `chapter-${chapter.id}`;
    const activityNodeId = (chapter, index) => `activity-${chapter.id}-${index}`;
    const evaluationNodeId = (chapter, kind, index) => `evaluation-${chapter.id}-${kind}-${index}`;
    const evaluationItems = chapters.flatMap((chapter) => [
      ...(chapter.evaluationsSecondaires || []).map((evaluation, index) => ({ chapter, evaluation, kind: 'secondary', index })),
      ...(chapter.evaluationFinale ? [{ chapter, evaluation: chapter.evaluationFinale, kind: 'final', index: 0 }] : [])
    ]);
    const transparentNode = (id, title, level) => ({
      id,
      label: '',
      title,
      shape: 'circle',
      size: level === 0 ? 145 : level === 1 ? 95 : 62,
      color: { background: 'rgba(255,255,255,0)', border: 'rgba(255,255,255,0)' },
      borderWidth: 0,
      fixed: false,
      physics: true
    });
    const activityNodes = chapters.flatMap((chapter) =>
      (chapter.activité || chapter.activites || []).map((activity, index) => ({ chapter, activity, index }))
    );
    const nodes = new visDataSet([
      transparentNode(rootId, course.titre, 0),
      ...chapters.map((chapter) => transparentNode(chapterNodeId(chapter), chapter.id, 1)),
      ...activityNodes.map(({ chapter, activity, index }) => transparentNode(
        activityNodeId(chapter, index),
        activity.titre || `Activité ${index + 1}`,
        2
      )),
      ...evaluationItems.map(({ chapter, evaluation, kind, index }) => ({
        ...transparentNode(
          evaluationNodeId(chapter, kind, index),
          evaluation.type || (kind === 'final' ? 'Évaluation finale' : 'Évaluation secondaire'),
          2
        ),
        size: 68,
        borderWidth: 2,
        color: { background: '#ffffff', border: color },
        shapeProperties: { borderDashes: [6, 5] },
        url: evaluation.component ? courseDataUrl(courseId, evaluation.component) : undefined
      }))
    ]);
    const edges = new visDataSet([
      ...chapters.map((chapter) => ({
        from: rootId,
        to: chapterNodeId(chapter),
        color: { color: `${color}99`, highlight: color },
        width: 2
      })),
      ...activityNodes.map(({ chapter, index }) => ({
        from: chapterNodeId(chapter),
        to: activityNodeId(chapter, index),
        color: { color: `${color}77`, highlight: color },
        width: 1.5
      })),
      ...evaluationItems.map(({ chapter, kind, index }) => ({
        from: chapterNodeId(chapter),
        to: evaluationNodeId(chapter, kind, index),
        color: { color: `${color}99`, highlight: color },
        width: 1.5,
        dashes: [6, 5]
      }))
    ]);
    const instance = new visNetwork(networkHost, { nodes, edges }, {
      autoResize: true,
      interaction: { dragNodes: true, dragView: true, zoomView: true, selectable: true },
      nodes: { chosen: false, font: { size: 16, face: 'Arial', color: '#263445' } },
      edges: {
        smooth: { type: 'continuous' },
        length: 460,
        physics: true
      },
      physics: {
        enabled: true,
        barnesHut: { gravitationalConstant: -18000, centralGravity: 0.08, springLength: 460, springConstant: 0.008, damping: 0.45, avoidOverlap: 1 },
        stabilization: { enabled: true, iterations: 1000, updateInterval: 25, fit: true }
      }
    });

    const rootIcon = element('span', 'network-node-lottie course-root-lottie');
    rootIcon.style.setProperty('--node-color', color);
    overlay.append(rootIcon);
    const chapterIcons = chapters.map((chapter) => {
      const wrapper = element('span', 'chapter-node-overlay');
      wrapper.setAttribute('data-node-id', chapterNodeId(chapter));
      const icon = element('span', 'network-node-lottie chapter-node-lottie');
      icon.style.setProperty('--node-color', color);
      const label = element('span', 'chapter-node-label', chapter.id);
      wrapper.append(icon, label);
      overlay.append(wrapper);
      mountLottie(icon, chapter.lottie, color);
      return { chapter, wrapper };
    });
    const activityIcons = activityNodes.map(({ chapter, activity, index }) => {
      const icon = element('span', 'network-node-lottie activity-node-lottie');
      icon.setAttribute('data-node-id', activityNodeId(chapter, index));
      icon.setAttribute('aria-label', activity.titre || `Activité ${index + 1}`);
      overlay.append(icon);
      mountLottie(icon, activity.lottie, color);
      return { chapter, activity, index, icon };
    });
    const evaluationIcons = evaluationItems.map(({ chapter, evaluation, kind, index }) => {
      const wrapper = element('span', 'evaluation-node-overlay');
      wrapper.style.setProperty('--node-color', color);
      wrapper.setAttribute('data-node-id', evaluationNodeId(chapter, kind, index));
      wrapper.setAttribute('role', 'img');
      const evaluationType = evaluation.type || (kind === 'final' ? 'Évaluation finale' : 'Évaluation secondaire');
      wrapper.setAttribute('aria-label', evaluationType);
      wrapper.title = evaluationType;
      const icon = element('span', 'network-node-lottie evaluation-node-lottie');
      icon.style.setProperty('--node-color', color);
      const label = element('span', 'evaluation-node-label', evaluationType);
      wrapper.append(icon, label);
      overlay.append(wrapper);
      mountLottie(icon, evaluation.lottie, color);
      return { chapter, evaluation, kind, index, wrapper };
    });
    await mountLottie(rootIcon, course.lottie, color);
    const updateOverlay = () => {
      const positions = instance.getPositions([
        rootId,
        ...chapters.map(chapterNodeId),
        ...activityNodes.map(({ chapter, index }) => activityNodeId(chapter, index)),
        ...evaluationItems.map(({ chapter, kind, index }) => evaluationNodeId(chapter, kind, index))
      ]);
      const rootPosition = positions[rootId];
      if (rootPosition) {
        const point = instance.canvasToDOM(rootPosition);
        rootIcon.style.left = `${point.x}px`;
        rootIcon.style.top = `${point.y}px`;
      }
      chapterIcons.forEach(({ chapter, wrapper }) => {
        const position = positions[chapterNodeId(chapter)];
        if (!position) return;
        const point = instance.canvasToDOM(position);
        wrapper.style.left = `${point.x}px`;
        wrapper.style.top = `${point.y}px`;
      });
      activityIcons.forEach(({ chapter, index, icon }) => {
        const position = positions[activityNodeId(chapter, index)];
        if (!position) return;
        const point = instance.canvasToDOM(position);
        icon.style.left = `${point.x}px`;
        icon.style.top = `${point.y}px`;
      });
      evaluationIcons.forEach(({ chapter, kind, index, wrapper }) => {
        const position = positions[evaluationNodeId(chapter, kind, index)];
        if (!position) return;
        const point = instance.canvasToDOM(position);
        wrapper.style.left = `${point.x}px`;
        wrapper.style.top = `${point.y}px`;
      });
    };
    instance.on('afterDrawing', updateOverlay);
    instance.once('stabilized', () => {
      instance.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
      updateOverlay();
    });
    instance.on('click', (event) => {
      const id = event.nodes[0];
      if (!id) return;
      const chapter = chapters.find((item) => chapterNodeId(item) === id);
      if (chapter) {
        location.href = chapterPageUrl(courseId, chapter);
        return;
      }
      const activity = activityNodes.find((item) => activityNodeId(item.chapter, item.index) === id);
      if (activity) {
        location.href = courseUrl(courseId, activity.chapter.id, activity.activity.id || `activite-${activity.index + 1}`);
        return;
      }
      const evaluation = evaluationItems.find((item) => evaluationNodeId(item.chapter, item.kind, item.index) === id);
      if (evaluation?.evaluation.component) location.href = courseDataUrl(courseId, evaluation.evaluation.component);
    });
    requestAnimationFrame(updateOverlay);
  };

  const renderActivity = async (course, courseId, chapter, activity, index) => {
    const color = setTheme(course);
    pageTitle.textContent = activity.titre;
    document.title = `${activity.titre} — ${course.titre}`;
    await mountLottie(document.getElementById('brand-animation'), activity.lottie, color);
    const back = element('a', 'back-link', `← ${chapter.titre}`);
    back.href = courseUrl(courseId, chapter.id);
    content.append(back, element('p', 'eyebrow', `${course.titre} · ${chapter.titre}`));
    const navigation = element('nav', 'activity-navigation');
    navigation.setAttribute('aria-label', 'Navigation entre les activités');
    const siblings = chapter.activité || chapter.activites || [];
    if (siblings[index - 1]) {
      const previous = element('a', 'secondary-button', '← Activité précédente');
      previous.href = courseUrl(courseId, chapter.id, siblings[index - 1].id || `activite-${index}`);
      navigation.append(previous);
    } else navigation.append(element('span', 'secondary-button disabled', 'Première activité'));
    if (siblings[index + 1]) {
      const next = element('a', 'primary-button', 'Activité suivante →');
      next.href = courseUrl(courseId, chapter.id, siblings[index + 1].id || `activite-${index + 2}`);
      navigation.append(next);
    } else navigation.append(element('span', 'secondary-button disabled', 'Dernière activité'));
    content.append(navigation);

    const objectives = (activity['objectifs pédagogiques'] || activity.objectifs || []).map(objectiveLabel).filter(Boolean);
    const objectiveSection = element('section', 'detail-section');
    objectiveSection.append(element('h2', 'section-title', 'Objectifs pédagogiques'));
    if (objectives.length) {
      const list = element('ul', 'objective-list');
      objectives.forEach((objective) => list.append(element('li', '', objectiveLabel(objective))));
      objectiveSection.append(list);
    } else objectiveSection.append(element('p', 'empty-state', 'Les objectifs pédagogiques sont à compléter.'));
    content.append(objectiveSection);

    const sections = [
      ['Problématique', activity.problematique || activity.problématique],
      ['Questionnements intermédiaires', activity.questionnements || activity['questionnements intermédiaires']],
      ['Contenu', activity.contenu]
    ];
    sections.forEach(([title, value]) => {
      if (!value) return;
      const section = element('section', 'detail-section');
      section.append(element('h2', 'section-title', title));
      section.append(element('p', 'chapter-description', Array.isArray(value) ? value.join('\n') : value));
      content.append(section);
    });
    if (!activity.contenu && !activity.problematique && !activity.problématique) {
      content.append(element('p', 'empty-state', 'La page titre est prête ; les ressources de cette activité restent à ajouter.'));
    }
  };

  const start = async () => {
    createQrCode();
    const courseId = params.get('cours');
    if (!courseId) {
      await renderCourseList();
      return;
    }
    const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
    if (!response.ok) throw new Error('Ce cours est introuvable dans le catalogue.');
    const course = await response.json();
    const chapterId = params.get('chapitre');
    if (!chapterId) {
      await renderNetwork(course, courseId);
      return;
    }
    const chapter = (course.chapitres || []).find((item) => item.id === chapterId);
    if (!chapter) throw new Error('Ce chapitre est introuvable.');
    const activityId = params.get('activite');
    if (!activityId) {
      location.replace(chapterPageUrl(courseId, chapter));
      return;
    }
    const activities = chapter.activité || chapter.activites || [];
    const index = activities.findIndex((item, position) => (item.id || `activite-${position + 1}`) === activityId);
    if (index < 0) throw new Error('Cette activité est introuvable.');
    await renderActivity(course, courseId, chapter, activities[index], index);
  };

  start().catch((error) => {
    content.replaceChildren(element('p', 'error-message', error.message));
  });
})();
