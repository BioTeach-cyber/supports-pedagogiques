(() => {
  const renderInline = (text, parent) => {
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      let node;
      if (token.startsWith('**')) {
        node = document.createElement('strong');
        node.textContent = token.slice(2, -2);
      } else if (token.startsWith('*')) {
        node = document.createElement('em');
        node.textContent = token.slice(1, -1);
      } else if (token.startsWith('`')) {
        node = document.createElement('code');
        node.textContent = token.slice(1, -1);
      } else {
        const [, label, target] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        let url;
        try {
          url = new URL(target, location.href);
        } catch {
          url = null;
        }
        if (url && ['http:', 'https:'].includes(url.protocol)) {
          node = document.createElement('a');
          node.href = url.href;
          node.rel = 'noopener noreferrer';
          node.textContent = label;
        } else {
          node = document.createTextNode(label);
        }
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
      const node = document.createElement('p');
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
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }
      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const node = document.createElement(`h${heading[1].length + 2}`);
        renderInline(heading[2], node);
        target.append(node);
        return;
      }
      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        flushList();
        const node = document.createElement('blockquote');
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
          list = document.createElement(type);
          listType = type;
        }
        const node = document.createElement('li');
        renderInline(item[2], node);
        list.append(node);
        return;
      }
      flushList();
      paragraph.push(trimmed);
    });
    flushParagraph();
    flushList();
  };

  document.querySelectorAll('[data-component="contexte-professionnel"]').forEach((component) => {
    const source = component.querySelector('script[type="text/markdown"]')?.textContent || '';
    const title = component.dataset.title || 'Contexte professionnel';
    const block = document.createElement('section');
    block.className = 'activity-section activity-context';
    block.dataset.activityBlock = 'contexte-professionnel';
    const heading = document.createElement('h2');
    heading.className = 'activity-section-title';
    heading.textContent = title;
    const body = document.createElement('div');
    body.className = 'activity-context-body';
    renderMarkdown(source, body);
    block.append(heading, body);
    component.replaceWith(block);
  });
})();
