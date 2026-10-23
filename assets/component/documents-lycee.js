(() => {
  const createElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const resolveUrl = (value) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  const renderInline = (text, parent) => {
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      let node;
      if (token.startsWith('**')) {
        node = createElement('strong', '', token.slice(2, -2));
      } else if (token.startsWith('*')) {
        node = createElement('em', '', token.slice(1, -1));
      } else if (token.startsWith('`')) {
        node = createElement('code', '', token.slice(1, -1));
      } else {
        const [, label, target] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const href = resolveUrl(target);
        if (href) {
          node = createElement('a', '', label);
          node.href = href;
          node.rel = 'noopener noreferrer';
        } else node = document.createTextNode(label);
      }
      parent.append(node);
      cursor = match.index + token.length;
    }
    if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
  };

  const renderMarkdown = (source, target) => {
    const lines = source.trim().split(/\r?\n/);
    let paragraph = [];
    let list = null;
    let listType = '';
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const node = createElement('p');
      renderInline(paragraph.join(' '), node);
      target.append(node);
      paragraph = [];
    };
    const flushList = () => {
      if (!list) return;
      target.append(list);
      list = null;
      listType = '';
    };
    const isTableDivider = (line) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
    const skippedLines = new Set();
    lines.forEach((line, index) => {
      if (skippedLines.has(index)) return;
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }
      if (trimmed.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
        flushParagraph();
        flushList();
        const parseCells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
        const table = createElement('table', 'activity-document-table');
        const head = createElement('thead');
        const headerRow = createElement('tr');
        parseCells(trimmed).forEach((cell) => {
          const th = createElement('th');
          renderInline(cell, th);
          headerRow.append(th);
        });
        head.append(headerRow);
        table.append(head);
        const body = createElement('tbody');
        let rowIndex = index + 2;
        while (rowIndex < lines.length && lines[rowIndex].includes('|') && lines[rowIndex].trim()) {
          const row = createElement('tr');
          parseCells(lines[rowIndex]).forEach((cell) => {
            const td = createElement('td');
            renderInline(cell, td);
            row.append(td);
          });
          body.append(row);
          rowIndex += 1;
        }
        table.append(body);
        const wrapper = createElement('div', 'activity-document-table-wrap');
        wrapper.append(table);
        target.append(wrapper);
        for (let skipped = index + 1; skipped < rowIndex; skipped += 1) skippedLines.add(skipped);
        return;
      }
      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const node = createElement(`h${heading[1].length + 2}`);
        renderInline(heading[2], node);
        target.append(node);
        return;
      }
      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        flushList();
        const node = createElement('blockquote');
        renderInline(quote[1], node);
        target.append(node);
        return;
      }
      const item = trimmed.match(/^([-*]|\d+[.)])\s+(.+)$/);
      if (item) {
        flushParagraph();
        const type = /^\d/.test(item[1]) ? 'ol' : 'ul';
        if (listType !== type) flushList();
        if (!list) {
          list = createElement(type);
          listType = type;
        }
        const listItem = createElement('li');
        renderInline(item[2], listItem);
        list.append(listItem);
        return;
      }
      flushList();
      paragraph.push(trimmed);
    });
    flushParagraph();
    flushList();
  };

  const renderMarkdownSource = (source, className) => {
    const body = createElement('div', className);
    renderMarkdown(source, body);
    return body;
  };

  const externalVideoEmbedUrl = (src) => {
    try {
      const url = new URL(src);
      let videoId = '';
      if (url.hostname === 'youtu.be' || url.hostname.endsWith('.youtu.be')) videoId = url.pathname.split('/').filter(Boolean)[0] || '';
      else if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
        if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
        else if (['/embed/', '/shorts/', '/live/'].some((prefix) => url.pathname.startsWith(prefix))) videoId = url.pathname.split('/')[2] || '';
      } else if (url.hostname === 'youtube-nocookie.com' || url.hostname.endsWith('.youtube-nocookie.com')) {
        if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/')[2] || '';
      }
      if (/^[\w-]{11}$/.test(videoId)) return `https://www.youtube-nocookie.com/embed/${videoId}`;
      if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) {
        const videoMatch = url.pathname.match(/(?:video\/)?(\d+)/);
        if (videoMatch) {
          const embed = new URL(`https://player.vimeo.com/video/${videoMatch[1]}`);
          const hash = url.searchParams.get('h');
          if (hash) embed.searchParams.set('h', hash);
          return embed.href;
        }
      }
      return '';
    } catch {
      return '';
    }
  };

  const renderImageViewer = (src, documentNode) => {
    const viewer = createElement('figure', 'activity-image-viewer');
    const toolbar = createElement('div', 'activity-image-toolbar');
    const viewport = createElement('div', 'activity-image-viewport');
    const image = createElement('img', 'activity-document-media');
    image.src = src;
    image.alt = documentNode.dataset.alt || documentNode.dataset.title || 'Illustration du document';
    image.loading = 'lazy';
    const dialog = createElement('dialog', 'activity-image-dialog');
    dialog.setAttribute('aria-label', image.alt);
    const dialogToolbar = createElement('div', 'activity-image-toolbar');
    const dialogViewport = createElement('div', 'activity-image-viewport');
    const fullImage = createElement('img', 'activity-document-media');
    fullImage.src = src;
    fullImage.alt = image.alt;
    fullImage.loading = 'lazy';
    let zoom = 1;
    const zoomLabels = [];
    const setZoom = (nextZoom) => {
      zoom = Math.max(0.5, Math.min(3, nextZoom));
      [image, fullImage].forEach((target) => {
        target.style.width = `${zoom * 100}%`;
        target.style.maxWidth = 'none';
      });
      zoomLabels.forEach((label) => { label.textContent = `${Math.round(zoom * 100)} %`; });
    };
    const addZoomControls = (targetToolbar) => {
      const zoomOut = createElement('button', 'activity-image-control', '−');
      zoomOut.type = 'button';
      zoomOut.setAttribute('aria-label', 'Réduire l’image');
      zoomOut.addEventListener('click', () => setZoom(zoom - 0.25));
      const zoomLabel = createElement('span', 'activity-image-zoom-label', '100 %');
      zoomLabels.push(zoomLabel);
      const zoomIn = createElement('button', 'activity-image-control', '+');
      zoomIn.type = 'button';
      zoomIn.setAttribute('aria-label', 'Agrandir l’image');
      zoomIn.addEventListener('click', () => setZoom(zoom + 0.25));
      targetToolbar.append(zoomOut, zoomLabel, zoomIn);
    };
    addZoomControls(toolbar);
    const fullscreen = createElement('button', 'activity-image-control activity-image-fullscreen', 'Plein écran');
    fullscreen.type = 'button';
    fullscreen.addEventListener('click', () => dialog.showModal());
    toolbar.append(fullscreen);
    const close = createElement('button', 'activity-image-control activity-image-close', 'Fermer');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fermer le plein écran');
    close.addEventListener('click', () => dialog.close());
    addZoomControls(dialogToolbar);
    dialogToolbar.append(close);
    dialogViewport.append(fullImage);
    dialog.append(dialogToolbar, dialogViewport);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    viewport.append(image);
    viewer.append(toolbar, viewport, dialog);
    return viewer;
  };

  const podcastEmbedUrl = (src, customEmbedUrl) => {
    const custom = resolveUrl(customEmbedUrl);
    if (custom) return custom;
    try {
      const url = new URL(src);
      if (url.hostname === 'open.spotify.com' && /\/(episode|show|track)\//.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/(episode|show|track)\//, '/embed/$1/');
        return url.href;
      }
      if (url.hostname === 'podcasts.apple.com' && url.pathname.includes('/podcast/')) {
        url.hostname = 'embed.podcasts.apple.com';
        return url.href;
      }
      if (url.hostname === 'soundcloud.com' || url.hostname.endsWith('.soundcloud.com')) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}`;
      }
    } catch {
      return '';
    }
    return '';
  };

  const isDirectAudioFile = (src) => {
    try {
      return /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\.mp3)?$/i.test(new URL(src).pathname);
    } catch {
      return false;
    }
  };

  const isAudioPlatformUrl = (src) => {
    try {
      const url = new URL(src);
      return url.hostname === 'open.spotify.com'
        || url.hostname === 'podcasts.apple.com'
        || url.hostname.endsWith('.podcasts.apple.com')
        || url.hostname === 'soundcloud.com'
        || url.hostname.endsWith('.soundcloud.com');
    } catch {
      return false;
    }
  };

  const makeAudio = (src, documentNode) => {
    if (isDirectAudioFile(src)) {
      const audio = createElement('audio', 'activity-document-audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = src;
      return audio;
    }
    const embedUrl = podcastEmbedUrl(src, documentNode.dataset.embedUrl);
    if (!embedUrl && !isAudioPlatformUrl(src)) {
      const link = createElement('a', 'activity-document-link', documentNode.dataset.label || 'Écouter la ressource audio');
      link.href = src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    }
    const frame = createElement('iframe', 'activity-document-audio-embed');
    frame.src = embedUrl;
    frame.title = documentNode.dataset.title || 'Lecteur audio en ligne';
    frame.loading = 'lazy';
    frame.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
    return frame;
  };

  const makeMedia = (documentNode, type) => {
    const src = resolveUrl(documentNode.dataset.src || documentNode.dataset.url);
    if (!src) return createElement('p', 'activity-document-empty', 'La ressource média n’a pas encore été renseignée.');
    if (type === 'video') {
      const embedUrl = resolveUrl(documentNode.dataset.embedUrl) || externalVideoEmbedUrl(src);
      if (embedUrl) {
        const frame = createElement('iframe', 'activity-document-video-embed');
        frame.src = embedUrl;
        frame.title = documentNode.dataset.title || 'Vidéo YouTube';
        frame.loading = 'lazy';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.allowFullscreen = true;
        return frame;
      }
      const video = createElement('video', 'activity-document-media');
      video.controls = true;
      video.preload = 'metadata';
      video.src = src;
      const poster = resolveUrl(documentNode.dataset.poster);
      if (poster) video.poster = poster;
      return video;
    }
    if (type === 'audio') return makeAudio(src, documentNode);
    if (['image', 'image matricielle', 'image vectorielle', 'svg'].includes(type)) {
      return renderImageViewer(src, documentNode);
    }
    if (['application', 'app'].includes(type)) {
      const frame = createElement('iframe', 'activity-document-application');
      frame.src = src;
      frame.title = documentNode.dataset.title || 'Application pédagogique';
      frame.loading = 'lazy';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms');
      return frame;
    }
    const link = createElement('a', 'activity-document-link', documentNode.dataset.label || 'Ouvrir le document');
    link.href = src;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  };

  const renderDocument = (documentNode, index, panel) => {
    panel.replaceChildren();
    panel.setAttribute('aria-labelledby', `activity-document-tab-${index + 1}`);
    const title = documentNode.dataset.title || `Document ${String(index + 1).padStart(2, '0')}`;
    panel.append(createElement('h3', 'activity-document-title', title));
    const description = documentNode.dataset.description;
    if (description) panel.append(createElement('p', 'activity-document-description', description));
    const type = (documentNode.dataset.type || 'texte').toLowerCase();
    const content = documentNode.querySelector('[data-document-content]');
    const markdown = content?.textContent || '';
    if (type === 'texte' || type === 'tableau' || type === 'table') {
      panel.append(renderMarkdownSource(markdown, 'activity-document-text'));
      return;
    }
    if (type === 'video' || type === 'audio') {
      panel.append(makeMedia(documentNode, type));
      const transcript = documentNode.querySelector('[data-transcription]');
      if (transcript) {
        const details = createElement('details', 'activity-document-transcription');
        details.append(createElement('summary', '', transcript.dataset.title || 'Transcription'));
        details.append(renderMarkdownSource(transcript.textContent, 'activity-document-text'));
        panel.append(details);
      }
      return;
    }
    panel.append(makeMedia(documentNode, type));
    if (content) panel.append(renderMarkdownSource(markdown, 'activity-document-text'));
  };

  document.querySelectorAll('[data-component="documents-lycee"]').forEach((component) => {
    const section = createElement('section', 'activity-section activity-documents-lycee');
    section.dataset.activityBlock = 'documents-lycee';
    section.append(createElement('h2', 'activity-section-title', component.dataset.title || 'Documents lycée'));
    const documents = [...component.querySelectorAll(':scope > [data-document]')];
    if (!documents.length) {
      section.append(createElement('p', 'activity-document-empty', 'Aucun document n’a été ajouté.'));
    } else {
      const tabs = createElement('div', 'activity-document-tabs');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Documents de l’activité');
      const panel = createElement('div', 'activity-document-panel');
      panel.id = 'activity-document-active-panel';
      panel.setAttribute('role', 'tabpanel');
      documents.forEach((documentNode, index) => {
        const title = documentNode.dataset.title || `Document ${String(index + 1).padStart(2, '0')}`;
        const tab = createElement('button', 'activity-document-tab', String(index + 1).padStart(2, '0'));
        tab.type = 'button';
        tab.id = `activity-document-tab-${index + 1}`;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-label', title);
        tab.tabIndex = index === 0 ? 0 : -1;
        tab.addEventListener('click', () => {
          tabs.querySelectorAll('[role="tab"]').forEach((otherTab) => {
            otherTab.setAttribute('aria-selected', 'false');
            otherTab.tabIndex = -1;
          });
          tab.setAttribute('aria-selected', 'true');
          tab.tabIndex = 0;
          renderDocument(documentNode, index, panel);
        });
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const allTabs = [...tabs.querySelectorAll('[role="tab"]')];
          const targetIndex = event.key === 'Home' ? 0
            : event.key === 'End' ? allTabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + allTabs.length) % allTabs.length;
          allTabs[targetIndex].focus();
          allTabs[targetIndex].click();
        });
        tabs.append(tab);
      });
      renderDocument(documents[0], 0, panel);
      section.append(tabs, panel);
    }
    component.replaceWith(section);
  });
})();
