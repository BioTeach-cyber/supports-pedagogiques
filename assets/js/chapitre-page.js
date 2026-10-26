(() => {
  const ROOT = new URL('../../', document.currentScript.src);
  const courseId = document.body.dataset.course;
  const folderId = decodeURIComponent(location.pathname.split('/').filter(Boolean).slice(-2, -1)[0]);
  const pageTitle = document.getElementById('chapter-title');
  const content = document.getElementById('chapter-content');
  const colorMeta = document.querySelector('meta[name="theme-color"]');
  const courseUrl = new URL(`cours/?cours=${encodeURIComponent(courseId)}`, ROOT).href;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const objectiveLabel = (objective) => typeof objective === 'string'
    ? objective
    : objective?.libelle || '';

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

  const mountLottie = async (target, path, color) => {
    if (!target || !path || !window.lottie) return;
    try {
      const response = await fetch(new URL(path, ROOT), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      window.lottie.loadAnimation({
        container: target,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: recolorLottie(data, color)
      });
    } catch (error) {
      target.classList.add('lottie-error');
      target.title = `Animation indisponible : ${path} (${error.message})`;
    }
  };

  const createQrCode = () => {
    const small = document.getElementById('page-qr');
    const large = document.getElementById('page-qr-large');
    const dialog = document.getElementById('qr-dialog');
    if (window.QRCode && small && large) {
      new window.QRCode(small, {
        text: location.href,
        width: 64,
        height: 64,
        correctLevel: window.QRCode.CorrectLevel.M
      });
      new window.QRCode(large, {
        text: location.href,
        width: 280,
        height: 280,
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
    document.getElementById('qr-open')?.addEventListener('click', () => dialog?.showModal());
    document.getElementById('qr-close')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  };

  const render = async () => {
    const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
    if (!response.ok) throw new Error('Le fichier de données du cours est introuvable.');
    const course = await response.json();
    const chapter = (course.chapitres || []).find((item) => item.id === folderId);
    if (!chapter) throw new Error(`Aucun chapitre ne correspond au dossier « ${folderId} ».`);

    const color = chapter.couleur || course.couleur || '#7fbc48';
    document.documentElement.style.setProperty('--course-color', color);
    document.getElementById('page-header').style.setProperty('--course-color', color);
    colorMeta.content = color;
    pageTitle.textContent = chapter.titre;
    document.title = `${chapter.titre} — ${course.titre}`;
    document.getElementById('course-link').href = courseUrl;
    document.getElementById('back-link').href = courseUrl;
    document.getElementById('footer-link').href = courseUrl;
    mountLottie(document.getElementById('course-lottie'), chapter.lottie || course.lottie, color);

    content.append(
      element('p', 'eyebrow', `Chapitre ${chapter.Periode || chapter.id} · ${(course.classes || []).join(' · ')}`),
      element('p', 'chapter-description', chapter.description || 'Description à compléter.')
    );

    const activities = chapter.activité || chapter.activites || [];
    const objectives = [...new Set(activities.flatMap((activity) =>
      (activity['objectifs pédagogiques'] || activity.objectifs || []).map(objectiveLabel).filter(Boolean)
    ))];
    const objectiveSection = element('section', 'detail-section');
    objectiveSection.append(element('h2', 'section-title', 'Objectifs pédagogiques'));
    if (objectives.length) {
      const list = element('ul', 'objective-list');
      objectives.forEach((objective) => list.append(element('li', '', objective)));
      objectiveSection.append(list);
    } else {
      objectiveSection.append(element('p', 'empty-state', 'Les objectifs pédagogiques sont à compléter.'));
    }
    content.append(objectiveSection);

    const activitySection = element('section', 'detail-section');
    activitySection.append(element('h2', 'section-title', 'Activités du chapitre'));
    const activityGrid = element('div', 'activity-grid');
    activities.forEach((activity, index) => {
      const activityId = activity.id || `activite-${index + 1}`;
      const activityFile = `Activité_${String(index + 1).padStart(2, '0')}.html`;
      const card = element('a', 'activity-card');
      card.href = new URL(`${encodeURIComponent(folderId)}/cours/${encodeURIComponent(activityFile)}`, new URL(`cours/${encodeURIComponent(courseId)}/`, ROOT)).href;
      const icon = element('span', 'activity-lottie');
      icon.setAttribute('aria-hidden', 'true');
      card.append(icon, element('strong', '', activity.titre || activityId));
      activityGrid.append(card);
      mountLottie(icon, activity.lottie, color);
    });
    if (!activities.length) activityGrid.append(element('p', 'empty-state', 'Aucune activité n’est encore renseignée.'));
    activitySection.append(activityGrid);
    content.append(activitySection);
  };

  createQrCode();
  render().catch((error) => content.append(element('p', 'error-message', error.message)));
})();
