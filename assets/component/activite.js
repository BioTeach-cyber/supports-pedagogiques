(() => {
  const scriptUrl = document.currentScript.src;
  const ROOT = new URL('../../', scriptUrl);
  const courseId = document.body.dataset.course;
  const content = document.getElementById('activity-content');
  const header = document.getElementById('page-header');
  const pageTitle = document.getElementById('activity-title');
  const colorMeta = document.querySelector('meta[name="theme-color"]');

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const activityLabel = (activity, index) => activity.titre || activity.id || `Activité ${index + 1}`;
  const objectiveLabel = (objective) => typeof objective === 'string' ? objective : objective?.libelle || '';
  const assetUrl = (path) => path ? new URL(path.replace(/^\.\//, ''), ROOT).href : '';
  const pageUrl = (courseRoot, path) => new URL(path, courseRoot).href;

  const recolorLottie = (data, color) => {
    const rgb = color.match(/[\da-f]{2}/gi).slice(0, 3).map((channel) => parseInt(channel, 16) / 255);
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
    const recolorColor = (value) => {
      if (Array.isArray(value)) {
        if ((value.length === 3 || value.length === 4) && value.every((channel) => typeof channel === 'number' && channel >= 0 && channel <= 1)) {
          const isBlack = Math.max(value[0], value[1], value[2]) < 0.02;
          return [...(isBlack ? [0, 0, 0] : rgb), value.length === 4 ? value[3] : 1];
        }
        return value.map(recolorColor);
      }
      if (!value || typeof value !== 'object') return value;
      return value;
    };
    return visit(JSON.parse(JSON.stringify(data)));
  };

  const mountLottie = async (container, path, color) => {
    if (!container || !path || !window.lottie) return;
    try {
      const response = await fetch(assetUrl(path), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      window.lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: recolorLottie(data, color)
      });
    } catch {
      container.classList.add('activity-lottie-fallback');
      container.textContent = container.dataset.number || '';
    }
  };

  const mountComponentLotties = (container, color) => {
    container.querySelectorAll('[data-lottie-src]').forEach((target) => {
      mountLottie(target, target.dataset.lottieSrc, color);
    });
  };

  const mountQrCode = () => {
    const small = document.getElementById('page-qr');
    const large = document.getElementById('page-qr-large');
    const dialog = document.getElementById('qr-dialog');
    if (window.QRCode && small && large) {
      new window.QRCode(small, { text: location.href, width: 64, height: 64 });
      new window.QRCode(large, { text: location.href, width: 280, height: 280 });
    }
    document.getElementById('qr-open')?.addEventListener('click', () => dialog?.showModal());
    document.getElementById('qr-close')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  };

  const section = (title, className = '') => {
    const node = element('section', `activity-section ${className}`.trim());
    node.append(element('h2', 'activity-section-title', title));
    return node;
  };

  const renderObjectives = (activity) => {
    const block = section('Objectifs pédagogiques', 'activity-objectives');
    const objectives = (activity['objectifs pédagogiques'] || activity.objectifs || []).map(objectiveLabel).filter(Boolean);
    if (objectives.length) {
      const list = element('ul', 'activity-objective-list');
      objectives.forEach((label) => list.append(element('li', '', label)));
      block.append(list);
    } else block.append(element('p', 'activity-empty', 'Les objectifs pédagogiques sont à compléter.'));
    return block;
  };

  const renderActivityNavigation = (activities, currentIndex, chapter, courseRoot, color) => {
    const nav = element('nav', 'activity-banner');
    nav.setAttribute('aria-label', 'Navigation des activités du chapitre');
    activities.forEach((activity, index) => {
      const link = element('a', 'activity-banner-link');
      const href = pageUrl(courseRoot, activity.page);
      link.href = href;
      link.setAttribute('aria-label', activityLabel(activity, index));
      if (index === currentIndex) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
      const icon = element('span', 'activity-banner-lottie');
      icon.setAttribute('aria-hidden', 'true');
      icon.dataset.number = String(index + 1);
      link.append(icon);
      nav.append(link);
      mountLottie(icon, activity.lottie, color);
    });
    const previous = activities[currentIndex - 1];
    const next = activities[currentIndex + 1];
    const controls = element('div', 'activity-navigation');
    const chapterHref = pageUrl(courseRoot, chapter.page);
    if (previous) {
      const link = element('a', 'activity-nav-link', '← Activité précédente');
      link.href = pageUrl(courseRoot, previous.page);
      controls.append(link);
    } else controls.append(element('span', 'activity-nav-link is-disabled', 'Début de la séquence'));
    const back = element('a', 'activity-nav-chapter', 'Retour au chapitre');
    back.href = chapterHref;
    controls.append(back);
    if (next) {
      const link = element('a', 'activity-nav-link activity-nav-next', 'Activité suivante →');
      link.href = pageUrl(courseRoot, next.page);
      controls.append(link);
    } else controls.append(element('span', 'activity-nav-link is-disabled', 'Fin de la séquence'));
    return { nav, controls };
  };

  const render = async () => {
    const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
    if (!response.ok) throw new Error('Le fichier de données du cours est introuvable.');
    const course = await response.json();
    const courseRoot = new URL(`cours/${encodeURIComponent(courseId)}/`, ROOT);
    const chapterId = decodeURIComponent(location.pathname.split('/').filter(Boolean).slice(-3, -2)[0] || '');
    const chapter = (course.chapitres || []).find((item) => item.id === chapterId);
    if (!chapter) throw new Error(`Aucun chapitre ne correspond au dossier « ${chapterId} ».`);
    const activities = chapter.activité || chapter.activites || [];
    const pathname = decodeURIComponent(location.pathname);
    const currentIndex = activities.findIndex((activity) => pathname.endsWith(`/${activity.page}`));
    if (currentIndex < 0) throw new Error('Cette activité est introuvable dans les données du cours.');

    const activity = activities[currentIndex];
    const color = chapter.couleur || course.couleur || '#b7b7b7';
    document.documentElement.style.setProperty('--course-color', color);
    header.style.setProperty('--course-color', color);
    colorMeta.content = color;
    pageTitle.textContent = activityLabel(activity, currentIndex);
    document.title = `${pageTitle.textContent} — ${course.titre}`;
    document.getElementById('course-link').href = new URL(`cours/?cours=${encodeURIComponent(courseId)}`, ROOT).href;
    document.getElementById('footer-link').href = pageUrl(courseRoot, chapter.page);
    await mountLottie(document.getElementById('course-lottie'), chapter.lottie || course.lottie, color);
    const navigation = renderActivityNavigation(activities, currentIndex, chapter, courseRoot, color);
    content.append(navigation.nav, navigation.controls);
    content.append(renderObjectives(activity));
    Array.from(content.querySelectorAll('[data-activity-block]')).forEach((block) => content.append(block));
    mountComponentLotties(content, color);
  };

  mountQrCode();
  render().catch((error) => content.append(element('p', 'error-message', error.message)));
})();
