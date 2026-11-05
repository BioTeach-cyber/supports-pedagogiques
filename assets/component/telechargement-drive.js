(() => {
  const scriptUrl = document.currentScript.src;
  const ROOT = new URL('../../', scriptUrl);

  const createElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const resolveHttpUrl = (value) => {
    if (!value) return '';
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  const driveDownloadUrl = (value) => {
    const sharedUrl = resolveHttpUrl(value);
    if (!sharedUrl) return '';
    try {
      const url = new URL(sharedUrl);
      if (url.hostname !== 'drive.google.com') return '';
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
      if (!fileId) return sharedUrl;
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    } catch {
      return '';
    }
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

  const getThemeColor = async () => {
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--course-color').trim() || '#7fbc48';
    const courseId = document.body.dataset.course;
    const chapterId = decodeURIComponent(location.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || '');
    if (!courseId || !chapterId) return fallback;
    try {
      const response = await fetch(new URL(`cours/${encodeURIComponent(courseId)}/cours.json`, ROOT));
      if (!response.ok) return fallback;
      const course = await response.json();
      const chapter = (course.chapitres || []).find((item) => item.id === chapterId);
      return chapter?.couleur || course.couleur || fallback;
    } catch {
      return fallback;
    }
  };

  const mountLottie = async (target, path) => {
    if (!target || !path || !window.lottie) return;
    try {
      const [response, color] = await Promise.all([
        fetch(new URL(path, ROOT), { cache: 'no-store' }),
        getThemeColor()
      ]);
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
      target.classList.add('resource-download-lottie-fallback');
      target.textContent = '↓';
    }
  };

  document.querySelectorAll('[data-component="telechargement-drive"]').forEach((component) => {
    const section = createElement('section', 'resource-download-card');
    const title = component.dataset.title || 'Ressource à télécharger';
    const heading = createElement('h2', 'resource-download-title', title);
    const description = component.dataset.description
      ? createElement('p', 'resource-download-description', component.dataset.description)
      : null;
    const content = createElement('div', 'resource-download-content');
    const animation = createElement('span', 'resource-download-lottie');
    animation.setAttribute('aria-hidden', 'true');

    const downloadUrl = driveDownloadUrl(component.dataset.driveUrl);
    const resourceLinks = [...component.querySelectorAll(':scope > [data-resource-url]')]
      .map((resource) => ({
        url: resolveHttpUrl(resource.dataset.resourceUrl),
        label: resource.dataset.resourceLabel
      }))
      .filter((resource) => resource.url);
    if (!resourceLinks.length) {
      const resourceUrl = resolveHttpUrl(component.dataset.resourceUrl);
      if (resourceUrl) {
        resourceLinks.push({
          url: resourceUrl,
          label: component.dataset.resourceLabel
        });
      }
    }
    const actions = createElement('div', 'resource-download-actions');

    if (downloadUrl) {
      const downloadLink = createElement('a', 'resource-download-button', component.dataset.downloadLabel || 'Télécharger le fichier');
      downloadLink.href = downloadUrl;
      downloadLink.target = '_blank';
      downloadLink.rel = 'noopener noreferrer';
      actions.append(downloadLink);
    }

    resourceLinks.forEach((resource, index) => {
      const resourceLink = createElement('a', 'resource-download-resource-link', resource.label || `Consulter la ressource ${index + 1}`);
      resourceLink.href = resource.url;
      resourceLink.target = '_blank';
      resourceLink.rel = 'noopener noreferrer';
      actions.append(resourceLink);
    });

    if (!downloadUrl && !resourceLinks.length) {
      actions.append(createElement('p', 'resource-download-error', 'Les liens de cette ressource ne sont pas renseignés.'));
    }

    content.append(animation, actions);
    section.append(heading);
    if (description) section.append(description);
    section.append(content);
    component.replaceWith(section);
    mountLottie(animation, component.dataset.lottie || 'assets/lotties/database.json');
  });
})();
