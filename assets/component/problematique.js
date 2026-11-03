(() => {
  const mathElement = (name, text) => {
    const node = document.createElementNS('http://www.w3.org/1998/Math/MathML', name);
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const mathElementWithChildren = (name, ...children) => {
    const node = mathElement(name);
    node.append(...children);
    return node;
  };

  const parseMathGroup = (source, state) => {
    if (source[state.index] !== '{') return parseMathAtom(source, state);
    state.index += 1;
    return parseMathRow(source, state, true);
  };

  const parseMathAtom = (source, state) => {
    if (source[state.index] === '{') return parseMathGroup(source, state);
    if (source[state.index] === '\\') {
      state.index += 1;
      const command = source.slice(state.index).match(/^[a-zA-Z]+/)?.[0] || source[state.index] || '';
      state.index += command.length;
      const symbols = { times: '×', cdot: '·', div: '÷', approx: '≈', leq: '≤', geq: '≥' };
      if (command === 'frac') {
        return mathElementWithChildren('mfrac', parseMathGroup(source, state), parseMathGroup(source, state));
      }
      if (command === 'sqrt') return mathElementWithChildren('msqrt', parseMathGroup(source, state));
      if (command === 'text') return mathElement('mtext', readMathText(source, state));
      return mathElement(symbols[command] ? 'mo' : 'mi', symbols[command] || command || source[state.index - 1]);
    }
      if (source[state.index] === '}') {
        state.index += 1;
        return mathElement('mo', '}');
      }
    const rest = source.slice(state.index);
    const number = rest.match(/^\d+(?:[.,]\d+)?/)?.[0];
    const identifier = rest.match(/^[a-zA-Z]+/)?.[0];
    const token = number || identifier || source[state.index];
    state.index += token.length;
    return mathElement(number ? 'mn' : identifier ? 'mi' : 'mo', token);
  };

  const readMathText = (source, state) => {
    while (/\s/.test(source[state.index] || '')) state.index += 1;
    if (source[state.index] !== '{') return '';
    state.index += 1;
    const start = state.index;
    while (state.index < source.length && source[state.index] !== '}') state.index += 1;
    const text = source.slice(start, state.index);
    if (source[state.index] === '}') state.index += 1;
    return text;
  };

  const parseMathRow = (source, state, nested = false) => {
    const row = mathElement('mrow');
    while (state.index < source.length) {
      while (/\s/.test(source[state.index] || '')) state.index += 1;
      if (source[state.index] === '}') {
        if (nested) {
          state.index += 1;
          break;
        }
        row.append(mathElement('mo', source[state.index++]));
        continue;
      }
      let atom = parseMathAtom(source, state);
      while (source[state.index] === '^' || source[state.index] === '_') {
        const operator = source[state.index++];
        const script = parseMathGroup(source, state);
        const scripted = mathElement(operator === '^' ? 'msup' : 'msub');
        scripted.append(atom, script);
        atom = scripted;
      }
      row.append(atom);
    }
    return row;
  };

  const renderMath = (source, display = false) => {
    const math = mathElement('math');
    math.setAttribute('display', display ? 'block' : 'inline');
    math.append(parseMathRow(source, { index: 0 }));
    return math;
  };

  const renderInline = (text, parent) => {
    const pattern = /(\$[^$]+\$|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      let node;
      if (token.startsWith('$')) {
        node = renderMath(token.slice(1, -1));
      } else if (token.startsWith('**')) {
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
    const isTableDivider = (line) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
    const parseCells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    const skippedLines = new Set();
    lines.forEach((line, index) => {
      if (skippedLines.has(index)) return;
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }
      if (trimmed.startsWith('$$')) {
        flushParagraph();
        flushList();
        const formulaLines = [];
        const firstLine = trimmed.slice(2);
        const closesOnFirstLine = firstLine.includes('$$');
        if (closesOnFirstLine) {
          formulaLines.push(firstLine.slice(0, firstLine.indexOf('$$')));
        } else {
          if (firstLine) formulaLines.push(firstLine);
          let formulaLine = index + 1;
          while (formulaLine < lines.length && !lines[formulaLine].includes('$$')) {
            formulaLines.push(lines[formulaLine].trim());
            formulaLine += 1;
          }
          if (formulaLine < lines.length) {
            const lastLine = lines[formulaLine];
            formulaLines.push(lastLine.slice(0, lastLine.indexOf('$$')).trim());
            for (let skipped = index + 1; skipped <= formulaLine; skipped += 1) skippedLines.add(skipped);
          }
        }
        const formula = document.createElement('div');
        formula.className = 'activity-problem-formula';
        formula.append(renderMath(formulaLines.join(' '), true));
        target.append(formula);
        return;
      }
      if (trimmed.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
        flushParagraph();
        flushList();
        const table = document.createElement('table');
        table.className = 'activity-problem-table';
        const head = document.createElement('thead');
        const headerRow = document.createElement('tr');
        parseCells(trimmed).forEach((cell, cellIndex) => {
          const th = document.createElement('th');
          th.scope = 'col';
          if (lines[index + 1].includes(':')) {
            const dividerCell = parseCells(lines[index + 1])[cellIndex] || '';
            if (dividerCell.startsWith(':') && dividerCell.endsWith(':')) th.style.textAlign = 'center';
            else if (dividerCell.endsWith(':')) th.style.textAlign = 'right';
          }
          renderInline(cell, th);
          headerRow.append(th);
        });
        head.append(headerRow);
        table.append(head);
        const body = document.createElement('tbody');
        let rowIndex = index + 2;
        while (rowIndex < lines.length && lines[rowIndex].includes('|') && lines[rowIndex].trim()) {
          const row = document.createElement('tr');
          parseCells(lines[rowIndex]).forEach((cell) => {
            const td = document.createElement('td');
            renderInline(cell, td);
            row.append(td);
          });
          body.append(row);
          rowIndex += 1;
        }
        table.append(body);
        const wrapper = document.createElement('div');
        wrapper.className = 'activity-problem-table-wrap';
        wrapper.append(table);
        target.append(wrapper);
        for (let skipped = index + 1; skipped < rowIndex; skipped += 1) skippedLines.add(skipped);
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

  document.querySelectorAll('[data-component="problematique"]').forEach((component) => {
    const source = component.querySelector('script[type="text/markdown"]')?.textContent || '';
    const title = component.dataset.title || 'Problématique';
    const block = document.createElement('section');
    block.className = 'activity-section activity-problem';
    block.dataset.activityBlock = 'problematique';
    const heading = document.createElement('h2');
    heading.className = 'activity-section-title';
    heading.textContent = title;
    const body = document.createElement('div');
    body.className = 'activity-problem-body';
    renderMarkdown(source, body);
    block.append(heading, body);
    component.replaceWith(block);
  });
})();
