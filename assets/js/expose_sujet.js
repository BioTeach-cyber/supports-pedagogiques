(() => {
  const ROOT = new URL('../../', document.currentScript.src);
  const pathSegments = decodeURIComponent(location.pathname).split('/').filter(Boolean);
  const coursesIndex = pathSegments.indexOf('cours');
  const courseId = coursesIndex >= 0 ? pathSegments[coursesIndex + 1] : document.body.dataset.course;
  const chapterId = pathSegments.slice(-3, -2)[0] || '';
  const content = document.getElementById('chapter-content') || document.getElementById('activity-content');

  const element = (tag, className, text) => {
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

  const assetUrl = (path) => new URL(path.replace(/^\.\//, ''), ROOT);

  const mountLottie = async (target, path, color) => {
    if (!target || !path || !window.lottie) return;
    try {
      const response = await fetch(assetUrl(path), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      window.lottie.loadAnimation({
        container: target,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: recolorLottie(await response.json(), color)
      });
    } catch {
      target.classList.add('lottie-error');
    }
  };

  const mountQrCode = () => {
    const small = document.getElementById('page-qr');
    const large = document.getElementById('page-qr-large');
    const dialog = document.getElementById('qr-dialog');
    if (window.QRCode && small && large) {
      new window.QRCode(small, { text: location.href, width: 64, height: 64, correctLevel: window.QRCode.CorrectLevel.M });
      new window.QRCode(large, { text: location.href, width: 280, height: 280, correctLevel: window.QRCode.CorrectLevel.M });
    }
    document.getElementById('qr-open')?.addEventListener('click', () => dialog?.showModal());
    document.getElementById('qr-close')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  };

  const renderInstructions = (exposes) => {
    const section = element('section', 'expose-subject-instructions detail-section');
    section.append(element('h2', 'section-title', 'Organisation de l’exposé'));

    const facts = element('ul', 'oral-facts');
    if (exposes.duree) {
      const item = element('li');
      item.append(element('strong', '', 'Durée : '), document.createTextNode(exposes.duree));
      facts.append(item);
    }
    if (exposes.date) {
      const item = element('li');
      item.append(element('strong', '', 'Date : '), document.createTextNode(exposes.date));
      facts.append(item);
    }
    if (facts.children.length) section.append(facts);

    const consignesGenerales = Array.isArray(exposes.consignesGenerales) ? exposes.consignesGenerales : [];
    if (consignesGenerales.length) {
      section.append(element('h3', 'instruction-section-title', 'Consignes générales'));
      const list = element('ul', 'objective-list');
      consignesGenerales.forEach((consigne) => {
        const item = element('li');
        if (consigne.titre) item.append(element('strong', '', `${consigne.titre} : `));
        item.append(document.createTextNode(consigne.texte || ''));
        list.append(item);
      });
      section.append(list);
    }

    const consignesSpecifiques = Array.isArray(exposes.consignesSpecifiques) ? exposes.consignesSpecifiques : [];
    if (consignesSpecifiques.length) {
      section.append(element('h3', 'instruction-section-title', 'Consignes spécifiques'));
      consignesSpecifiques.forEach((groupe) => {
        section.append(element('h4', 'instruction-group-title', groupe.titre || ''));
        const list = element('ul', 'objective-list');
        (Array.isArray(groupe.consigne) ? groupe.consigne : []).forEach((consigne) => {
          const item = element('li');
          if (consigne.titre) item.append(element('strong', '', `${consigne.titre} : `));
          item.append(document.createTextNode(consigne.texte || ''));
          list.append(item);
        });
        if (list.children.length) section.append(list);
      });
    }

    const autresConsignes = Array.isArray(exposes.consignes) ? exposes.consignes : [];
    if (autresConsignes.length) {
      section.append(element('h3', 'instruction-section-title', 'Consignes'));
      const list = element('ol', 'objective-list');
      autresConsignes.forEach((consigne) => list.append(element('li', '', consigne)));
      section.append(list);
    }

    return section;
  };

  const render = async () => {
    const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
    if (!response.ok) throw new Error('Le fichier de données du cours est introuvable.');
    const course = await response.json();
    const chapter = (course.chapitres || []).find((item) => item.id === chapterId);
    if (!chapter) throw new Error(`Aucun chapitre ne correspond au dossier « ${chapterId} ».`);

    const activities = chapter.activité || chapter.activites || [];
    const pathname = decodeURIComponent(location.pathname);
    const activity = activities.find((item) => item.page && pathname.endsWith(`/${item.page}`));
    if (!activity) throw new Error('Ce sujet est introuvable dans les données du cours.');

    const color = chapter.couleur || course.couleur || '#7fbc48';
    document.documentElement.style.setProperty('--course-color', color);
    document.getElementById('page-header')?.style.setProperty('--course-color', color);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);

    const title = activity.titre || 'Sujet de l’exposé';
    const heading = element('h2', 'expose-subject-title', title);
    heading.id = 'expose-subject-title';
    const pageHeading = document.getElementById('chapter-title') || document.getElementById('activity-title');
    if (pageHeading) pageHeading.textContent = title;
    document.title = `${title} — ${course.titre}`;
    const courseUrl = new URL(`cours/?cours=${encodeURIComponent(courseId)}`, ROOT).href;
    const courseLink = document.getElementById('course-link');
    const footerLink = document.getElementById('footer-link');
    if (courseLink) courseLink.href = courseUrl;
    if (footerLink) footerLink.href = new URL(chapter.page, new URL(`cours/${encodeURIComponent(courseId)}/`, ROOT)).href;
    await mountLottie(document.getElementById('course-lottie'), chapter.lottie || course.lottie, color);

    const subjectSection = element('section', 'expose-subject');
    subjectSection.setAttribute('aria-labelledby', 'expose-subject-title');
    const titleRow = element('div', 'expose-subject-title-row');
    const titleAnimation = element('span', 'expose-subject-title-lottie');
    titleAnimation.setAttribute('aria-hidden', 'true');
    titleRow.append(titleAnimation, heading);
    const groups = Array.isArray(activity.groupe) ? activity.groupe : activity.groupe ? [activity.groupe] : [];
    if (groups.length) titleRow.append(element('p', 'expose-subject-group', groups.join(' · ')));
    mountLottie(titleAnimation, activity.lottie, color);

    const figure = element('figure', 'expose-subject-figure');
    if (activity.image) {
      const image = document.createElement('img');
      image.src = new URL(activity.image, ROOT).href;
      image.alt = activity['image-alt'] || `Illustration du sujet : ${title}`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        figure.replaceChildren(element('p', 'expose-subject-image-fallback', 'La photo de ce sujet est momentanément indisponible.'));
      }, { once: true });
      figure.append(image);
    } else {
      figure.append(element('p', 'expose-subject-image-fallback', 'Photo du sujet à ajouter dans le champ « image » du cours.json.'));
    }

    const context = element('div', 'expose-subject-context');
    context.append(element('h3', '', 'Contexte de travail'));
    context.append(element('p', '', activity.contexte || 'Le contexte de travail est à compléter dans les données du cours.'));
    subjectSection.append(titleRow, figure, context);
    content.append(subjectSection);

    const exposeInstructions = renderInstructions(chapter.exposes || chapter.exposés || {});
    if (exposeInstructions.children.length > 1) content.append(exposeInstructions);

    const evaluation = element('div');
    evaluation.dataset.component = 'evaluation-projet';
    evaluation.dataset.title = 'Grille d’évaluation de l’exposé';
    content.append(evaluation);
    const evaluationScript = document.createElement('script');
    evaluationScript.src = new URL('assets/component/evaluation-projet.js', ROOT).href;
    document.body.append(evaluationScript);
  };

  mountQrCode();
  render().catch((error) => content.append(element('p', 'error-message', error.message)));
})();
