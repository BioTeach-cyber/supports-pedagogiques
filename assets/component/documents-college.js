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

  const lotties = {
    video: 'assets/lotties/video-player.json',
    '3d': 'assets/lotties/3d-cube.json',
    'modèle 3d': 'assets/lotties/3d-cube.json',
    'modele 3d': 'assets/lotties/3d-cube.json',
    'modèle-3d': 'assets/lotties/3d-cube.json',
    'modele-3d': 'assets/lotties/3d-cube.json',
    'ia externe': 'assets/lotties/chat-bot.json',
    'ia-externe': 'assets/lotties/chat-bot.json',
    ia: 'assets/lotties/chat-bot.json',
    podcast: 'assets/lotties/headphone-podcast.json',
    audio: 'assets/lotties/headphone-podcast.json',
    jeu: 'assets/lotties/game-manette.json'
  };

  const videoEmbedUrl = (src) => {
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
        const match = url.pathname.match(/(?:video\/)?(\d+)/);
        if (match) return `https://player.vimeo.com/video/${match[1]}`;
      }
    } catch {
      return '';
    }
    return '';
  };

  const audioEmbedUrl = (src, customEmbedUrl) => {
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

  const renderContent = (documentNode, panel, tabId) => {
    panel.setAttribute('aria-labelledby', tabId);
    const type = (documentNode.dataset.type || 'texte').trim().toLowerCase();
    const title = documentNode.dataset.title || 'Document';
    const src = resolveUrl(documentNode.dataset.src || documentNode.dataset.url);
    const content = documentNode.querySelector('[data-document-content]');
    const transcript = documentNode.querySelector('[data-transcription]');
    panel.replaceChildren();
    panel.append(createElement('h3', 'activity-document-title', title));
    if (documentNode.dataset.description) {
      panel.append(createElement('p', 'activity-document-description', documentNode.dataset.description));
    }

    if (type === 'texte' || type === 'tableau' || type === 'table') {
      const text = createElement('div', 'activity-document-text');
      (content?.textContent || '').trim().split(/\r?\n\s*\r?\n/).filter(Boolean).forEach((paragraph) => {
        text.append(createElement('p', '', paragraph.trim()));
      });
      panel.append(text);
    } else if (type === 'video' && src) {
      const embedUrl = resolveUrl(documentNode.dataset.embedUrl) || videoEmbedUrl(src);
      if (embedUrl) {
        const frame = createElement('iframe', 'activity-document-video-embed');
        frame.src = embedUrl;
        frame.title = title;
        frame.loading = 'lazy';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.allowFullscreen = true;
        panel.append(frame);
      } else {
        const video = createElement('video', 'activity-document-media');
        video.controls = true;
        video.preload = 'metadata';
        video.src = src;
        const poster = resolveUrl(documentNode.dataset.poster);
        if (poster) video.poster = poster;
        panel.append(video);
      }
    } else if (['podcast', 'audio'].includes(type) && src) {
      const embedUrl = audioEmbedUrl(src, documentNode.dataset.embedUrl);
      if (isDirectAudioFile(src)) {
        const audio = createElement('audio', 'activity-document-audio');
        audio.controls = true;
        audio.preload = 'metadata';
        audio.src = src;
        panel.append(audio);
      } else if (embedUrl) {
        const frame = createElement('iframe', 'activity-document-audio-embed');
        frame.src = embedUrl;
        frame.title = title;
        frame.loading = 'lazy';
        frame.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
        panel.append(frame);
      } else {
        const link = createElement('a', 'activity-document-link', documentNode.dataset.label || 'Écouter la ressource audio');
        link.href = src;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        panel.append(link);
      }
    } else if (['3d', 'modèle 3d', 'modele 3d', 'modèle-3d', 'modele-3d', 'ia', 'ia externe', 'ia-externe', 'jeu', 'application', 'app'].includes(type) && src) {
      const frame = createElement('iframe', 'activity-document-application');
      frame.src = src;
      frame.title = title;
      frame.loading = 'lazy';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms');
      frame.allowFullscreen = true;
      panel.append(frame);
    } else if (src) {
      const link = createElement('a', 'activity-document-link', documentNode.dataset.label || 'Ouvrir la ressource');
      link.href = src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      panel.append(link);
    } else {
      panel.append(createElement('p', 'activity-document-empty', 'La ressource n’a pas encore été renseignée.'));
    }

    if (transcript) {
      const details = createElement('details', 'activity-document-transcription');
      details.append(createElement('summary', '', transcript.dataset.title || 'Transcription'));
      details.append(createElement('p', 'activity-document-text', transcript.textContent.trim()));
      panel.append(details);
    }
    if (content && !['texte', 'tableau', 'table'].includes(type)) {
      panel.append(createElement('div', 'activity-document-text', content.textContent.trim()));
    }
  };

  document.querySelectorAll('[data-component="documents-college"]').forEach((component) => {
    const section = createElement('section', 'activity-section activity-documents-college');
    section.dataset.activityBlock = 'documents-college';
    section.append(createElement('h2', 'activity-section-title', component.dataset.title || 'Documents collège'));
    const documents = [...component.querySelectorAll(':scope > [data-document]')];
    if (!documents.length) {
      section.append(createElement('p', 'activity-document-empty', 'Aucun document n’a été ajouté.'));
    } else {
      const tabs = createElement('div', 'activity-document-tabs activity-document-tabs-college');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Ressources de l’activité');
      const panel = createElement('div', 'activity-document-panel');
      panel.id = `activity-document-college-panel-${Math.random().toString(36).slice(2)}`;
      panel.setAttribute('role', 'tabpanel');
      documents.forEach((documentNode, index) => {
        const title = documentNode.dataset.title || `Document ${index + 1}`;
        const type = (documentNode.dataset.type || '').trim().toLowerCase();
        const tab = createElement('div', 'activity-document-tab activity-document-tab-college');
        tab.id = `${panel.id}-tab-${index + 1}`;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-label', title);
        tab.tabIndex = index === 0 ? 0 : -1;
        const icon = createElement('span', 'activity-document-tab-lottie');
        icon.setAttribute('aria-hidden', 'true');
        if (lotties[type]) icon.dataset.lottieSrc = lotties[type];
        else icon.textContent = title;
        tab.append(icon);
        tab.append(createElement('span', 'activity-document-tab-label', title));
        const activate = () => {
          tabs.querySelectorAll('[role="tab"]').forEach((otherTab) => {
            otherTab.setAttribute('aria-selected', 'false');
            otherTab.tabIndex = -1;
          });
          tab.setAttribute('aria-selected', 'true');
          tab.tabIndex = 0;
          renderContent(documentNode, panel, tab.id);
        };
        tab.addEventListener('click', activate);
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          const allTabs = [...tabs.querySelectorAll('[role="tab"]')];
          if (event.key === 'Enter' || event.key === ' ') {
            activate();
            return;
          }
          const targetIndex = event.key === 'Home' ? 0
            : event.key === 'End' ? allTabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + allTabs.length) % allTabs.length;
          allTabs[targetIndex].focus();
          allTabs[targetIndex].click();
        });
        tabs.append(tab);
      });
      renderContent(documents[0], panel, `${panel.id}-tab-1`);
      section.append(tabs, panel);
    }
    component.replaceWith(section);
  });
})();
