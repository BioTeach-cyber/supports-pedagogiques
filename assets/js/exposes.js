(() => {
  const ROOT = new URL('../../', document.currentScript.src);
  const courseId = document.body.dataset.course;
  const folderId = decodeURIComponent(location.pathname.split('/').filter(Boolean).slice(-2, -1)[0]);
  const pageTitle = document.getElementById('chapter-title');
  const content = document.getElementById('chapter-content');
  const colorMeta = document.querySelector('meta[name="theme-color"]');
  const courseUrl = new URL(`cours/?cours=${encodeURIComponent(courseId)}`, ROOT).href;
  const courseBase = new URL(`cours/${encodeURIComponent(courseId)}/`, ROOT);

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const asArray = (value) => Array.isArray(value) ? value : (value ? [value] : []);

  const objectiveLabel = (objective) => typeof objective === 'string'
    ? objective
    : objective?.libelle || '';

  const labels = (list) => asArray(list).map(objectiveLabel).filter(Boolean);

  /* ---------- Lottie (identique au générateur de chapitre) ---------- */
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

  /* ---------- QR code (identique) ---------- */
  const createQrCode = () => {
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

  /* ---------- Blocs spécifiques aux exposés ---------- */
  const infoBlock = (exposes) => {
    const consignes = asArray(exposes.consignes);
    const consignesGenerales = asArray(exposes.consignesGenerales);
    const consignesSpecifiques = asArray(exposes.consignesSpecifiques);
    if (!exposes.duree && !exposes.date && !consignes.length && !consignesGenerales.length && !consignesSpecifiques.length) return null;

    const section = element('section', 'detail-section');
    section.append(element('h2', 'section-title', 'Organisation de l’exposé'));

    const facts = element('ul', 'oral-facts');
    if (exposes.duree) {
      const li = element('li');
      li.append(element('strong', '', 'Durée : '), document.createTextNode(exposes.duree));
      facts.append(li);
    }
    if (exposes.date) {
      const li = element('li');
      li.append(element('strong', '', 'Date : '), document.createTextNode(exposes.date));
      facts.append(li);
    }
    if (facts.children.length) section.append(facts);

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

    if (consignesSpecifiques.length) {
      section.append(element('h3', 'instruction-section-title', 'Consignes spécifiques'));
      consignesSpecifiques.forEach((groupe) => {
        section.append(element('h4', 'instruction-group-title', groupe.titre || ''));
        const list = element('ul', 'objective-list');
        asArray(groupe.consigne).forEach((consigne) => {
          const item = element('li');
          if (consigne.titre) item.append(element('strong', '', `${consigne.titre} : `));
          item.append(document.createTextNode(consigne.texte || ''));
          list.append(item);
        });
        if (list.children.length) section.append(list);
      });
    }

    if (consignes.length) {
      section.append(element('h3', 'subsection-title', 'Consignes'));
      const list = element('ol', 'objective-list');
      consignes.forEach((consigne) => list.append(element('li', '', consigne)));
      section.append(list);
    }
    return section;
  };

  const topicCard = (sujet, index, color) => {
    const card = element('article', 'activity-card topic-card');
    const icon = element('span', 'activity-lottie');
    icon.setAttribute('aria-hidden', 'true');

    const header = element('div', 'topic-header');
    header.append(icon, element('strong', '', sujet.titre || `Sujet ${index + 1}`));
    card.append(header);

    const groupe = asArray(sujet.groupe);
    if (groupe.length) card.append(element('p', 'topic-group', groupe.join(' · ')));

    if (sujet.page) {
      const link = element('a', 'topic-link', 'Ouvrir la fiche du sujet');
      link.href = new URL(sujet.page, courseBase).href;
      card.append(link);
    }

    mountLottie(icon, sujet.lottie, color);
    return card;
  };

  /* ---------- Rendu principal ---------- */
  const render = async () => {
    const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
    if (!response.ok) throw new Error('Le fichier de données du cours est introuvable.');
    const course = await response.json();
    const chapter = (course.chapitres || []).find((item) => item.id === folderId);
    if (!chapter) throw new Error(`Aucun chapitre ne correspond au dossier « ${folderId} ».`);

    const exposes = chapter.exposes || chapter.exposés || {};
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
      element('p', 'eyebrow', `Exposés oraux · Chapitre ${chapter.Periode || chapter.id} · ${(course.classes || []).join(' · ')}`),
      element('p', 'chapter-description', chapter.description || 'Description à compléter.')
    );

    const info = infoBlock(exposes);
    if (info) content.append(info);

    // Objectifs communs : affichés seulement s'ils existent
    const communs = labels(exposes.objectifs);
    if (communs.length) {
      const section = element('section', 'detail-section');
      section.append(element('h2', 'section-title', 'Objectifs communs à tous les exposés'));
      const list = element('ul', 'objective-list');
      communs.forEach((objectif) => list.append(element('li', '', objectif)));
      section.append(list);
      content.append(section);
    }

    // Sujets
    const sujets = asArray(exposes.sujets || chapter.activité || chapter.activites).filter((sujet) => sujet.statut !== 'inactif');
    const topicSection = element('section', 'detail-section');
    topicSection.append(element('h2', 'section-title', 'Sujets des exposés'));
    const grid = element('div', 'activity-grid topic-grid-list');
    sujets.forEach((sujet, index) => grid.append(topicCard(sujet, index, color)));
    if (!sujets.length) grid.append(element('p', 'empty-state', 'Aucun sujet n’est encore renseigné.'));
    topicSection.append(grid);
    content.append(topicSection);

  };

  createQrCode();
  render().catch((error) => content.append(element('p', 'error-message', error.message)));
})();