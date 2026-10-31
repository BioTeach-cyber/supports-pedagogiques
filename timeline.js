(() => {
  const categoryInfo = {
    cours: { label: 'Cours', color: '#4f8c55' },
    evaluations: { label: 'Évaluations', color: '#c94f58' },
    vacances: { label: 'Vacances', color: '#4287bd' },
    stages: { label: 'Stages', color: '#829a3c' },
    examens: { label: 'Examens', color: '#8053ad' }
  };
  const yearFilter = document.getElementById('year-filter');
  const courseFilter = document.getElementById('course-filter');
  const categoryFilter = document.getElementById('category-filter');
  const searchFilter = document.getElementById('search-filter');
  const timelineHost = document.getElementById('timeline');
  const timelineShell = timelineHost.parentElement;
  let timeline = null;
  const summary = document.getElementById('summary');
  const details = document.getElementById('details');
  const undatedSummary = document.getElementById('undated-summary');
  const undatedList = document.getElementById('undated-list');
  let events = [];
  let undated = [];

  const courseDataUrl = (courseId) => `cours/${courseId.split('/').map(encodeURIComponent).join('/')}/cours.json`;
  const pageUrl = (page, courseId) => {
    if (typeof page !== 'string' || !page.trim() || /^[a-z][a-z\d+.-]*:/i.test(page) || page.startsWith('//')) return null;
    const base = courseId ? `cours/${courseId.split('/').map(encodeURIComponent).join('/')}/` : './';
    const url = new URL(page.split('/').map(encodeURIComponent).join('/'), new URL(base, location.href));
    return url.origin === location.origin ? url.href : null;
  };
  const parseDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  };
  const formatDate = (date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const categoryFor = (type) => {
    const normalized = String(type || '').toLocaleLowerCase('fr');
    if (normalized.includes('evaluation') || normalized.includes('évaluation') || normalized.includes('activité') || normalized.includes('activite') || normalized.includes('séquence') || normalized.includes('sequence')) return 'evaluations';
    if (normalized.includes('chapitre') || normalized.includes('cours')) return 'cours';
    if (normalized.includes('stage')) return 'stages';
    if (normalized.includes('examen')) return 'examens';
    return 'vacances';
  };
  const schoolYearFromDate = (date) => date.getMonth() >= 8
    ? `${date.getFullYear()}-${date.getFullYear() + 1}`
    : `${date.getFullYear() - 1}-${date.getFullYear()}`;
  const pushEvent = (record, course, schoolYear, kind, index) => {
    const start = parseDate(record.start);
    const end = parseDate(record.end);
    const category = categoryFor(kind === 'chapter' ? 'chapitre' : kind === 'common' ? record.type : 'evaluation');
    const baseTitle = record.titre || record.id || (kind === 'chapter' ? `Chapitre ${index + 1}` : record.type || 'Événement');
    const title = kind === 'final' || kind === 'secondary' ? `${record.chapterTitle} — ${baseTitle}` : baseTitle;
    const sourceCourse = course?.titre || null;
    const id = [kind, sourceCourse || 'commun', schoolYear, index, record.id || baseTitle].join('|');
    if (!start) {
      undated.push({ id, title, category, sourceCourse, classes: record.classes || [], schoolYear, status: record.statut || course?.statut || '', common: kind === 'common', startValue: record.start, endValue: record.end });
      return;
    }
    events.push({
      id,
      title,
      category,
      type: record.type || (kind === 'chapter' ? 'Chapitre' : categoryInfo[category].label),
      course: sourceCourse,
      classes: record.classes || course?.classes || [],
      schoolYear: schoolYear || schoolYearFromDate(start),
      start,
      end: end && end >= start ? end : null,
      status: record.statut || (course?.statut ?? ''),
      description: record.description || '',
      page: record.page || '',
      url: record.url || '',
      urls: Array.isArray(record.urls) ? record.urls : typeof record.url === 'string' && record.url ? [record.url] : [],
      courseId: course?.id || null,
      path: kind === 'common' ? 'cours/dates-communes.json' : courseDataUrl(course.id)
    });
  };

  const loadData = async () => {
    const [catalogueResponse, commonResponse] = await Promise.all([
      fetch('cours/catalogue.json'),
      fetch('cours/dates-communes.json')
    ]);
    if (!catalogueResponse.ok || !commonResponse.ok) throw new Error('Impossible de charger le catalogue des cours ou les dates communes.');
    const catalogue = await catalogueResponse.json();
    const commonData = await commonResponse.json();
    const courseResults = await Promise.all((catalogue.cours || []).map(async (id) => {
      const response = await fetch(courseDataUrl(id));
      if (!response.ok) return null;
      return { id, data: await response.json() };
    }));
    const courses = courseResults.filter(Boolean);

    courses.forEach(({ id, data: course }) => {
      const years = Array.isArray(course.annees) && course.annees.length ? course.annees : [];
      (course.chapitres || []).forEach((chapter, chapterIndex) => {
        const chapterTitle = chapter.id || `Chapitre ${chapterIndex + 1}`;
        const yearsForEntry = years.length ? years : [parseDate(chapter.start) ? schoolYearFromDate(parseDate(chapter.start)) : ''];
        yearsForEntry.forEach((year) => {
          const context = { ...course, id, titre: course.titre || id };
          pushEvent({ ...chapter, chapterTitle }, context, year, 'chapter', chapterIndex);
          if (chapter.evaluationFinale) pushEvent({ ...chapter.evaluationFinale, chapterTitle }, context, year, 'final', `${chapterIndex}-final`);
          (chapter.evaluationsSecondaires || []).forEach((evaluation, evaluationIndex) => {
            pushEvent({ ...evaluation, chapterTitle }, context, year, 'secondary', `${chapterIndex}-${evaluationIndex}`);
          });
        });
      });
    });

    (commonData.evenements || []).forEach((event, index) => {
      if (Array.isArray(event.classes) && event.classes.length) {
        event.classes.forEach((className) => pushEvent({ ...event, id: `${event.id}-${className}` }, { id: className, titre: className }, event.annee || '', 'common', `${index}-${className}`));
      } else {
        pushEvent(event, null, event.annee || '', 'common', index);
      }
    });

    const years = [...new Set([...events.map((event) => event.schoolYear), ...undated.map((event) => event.schoolYear)].filter(Boolean))].sort();
    yearFilter.replaceChildren();
    const allYearsOption = document.createElement('option');
    allYearsOption.value = 'all';
    allYearsOption.textContent = 'Toutes les années';
    yearFilter.append(allYearsOption);
    years.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilter.append(option);
    });
    const currentYear = schoolYearFromDate(new Date());
    if (years.includes(currentYear)) yearFilter.value = currentYear;

    [...new Set(courses.map(({ id, data }) => data.titre || id))].sort((a, b) => a.localeCompare(b, 'fr')).forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      courseFilter.append(option);
    });
    render();
  };

  const renderDetails = (event) => {
    details.replaceChildren();
    details.style.setProperty('--category-color', categoryInfo[event.category].color);
    const heading = document.createElement('h2');
    heading.textContent = event.title;
    const category = document.createElement('p');
    category.textContent = `${categoryInfo[event.category].label}${event.type ? ` · ${event.type}` : ''}`;
    const dates = document.createElement('p');
    dates.textContent = event.end ? `Du ${formatDate(event.start)} au ${formatDate(event.end)}` : `Le ${formatDate(event.start)}`;
    details.append(heading, category, dates);
    if (event.course) {
      const course = document.createElement('p');
      course.textContent = `Cours : ${event.course}`;
      details.append(course);
    }
    if (event.classes?.length) {
      const classes = document.createElement('p');
      classes.textContent = `Classe(s) : ${event.classes.join(', ')}`;
      details.append(classes);
    }
    if (event.schoolYear) {
      const year = document.createElement('p');
      year.textContent = `Année scolaire : ${event.schoolYear}`;
      details.append(year);
    }
    if (event.status === 'inactif') {
      const status = document.createElement('p');
      status.textContent = 'Élément inactif dans les données.';
      details.append(status);
    }
    const path = document.createElement('p');
    path.textContent = `Source : ${event.path}`;
    details.append(path);
    if (event.description) {
      const description = document.createElement('p');
      description.textContent = event.description;
      details.append(description);
    }
    const href = pageUrl(event.page, event.courseId);
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = 'Ouvrir la page associée';
      link.className = 'page-link';
      details.append(link);
    }
    const externalUrls = [...new Set([event.url, ...event.urls].filter((url) => typeof url === 'string' && /^https:\/\//i.test(url)))];
    externalUrls.forEach((url, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = externalUrls.length > 1 ? `Ouvrir le lien associé ${index + 1}` : 'Ouvrir le lien associé';
      link.className = 'page-link';
      details.append(link);
    });
  };

  const matchesFilters = (event) => {
    const yearMatch = yearFilter.value === 'all' || event.schoolYear === yearFilter.value;
    const courseMatch = courseFilter.value === 'all' || event.course === courseFilter.value;
    const categoryMatch = categoryFilter.value === 'all' || event.category === categoryFilter.value;
    const search = searchFilter.value.trim().toLocaleLowerCase('fr');
    const searchMatch = !search || `${event.title} ${event.course || ''} ${event.type || ''}`.toLocaleLowerCase('fr').includes(search);
    return yearMatch && courseMatch && categoryMatch && searchMatch;
  };

  const render = () => {
    const visible = events.filter(matchesFilters).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title, 'fr'));
    const visibleUndated = undated.filter((event) => {
      const yearMatch = yearFilter.value === 'all' || !event.schoolYear || event.schoolYear === yearFilter.value;
      const courseMatch = courseFilter.value === 'all' || event.sourceCourse === courseFilter.value;
      const categoryMatch = categoryFilter.value === 'all' || event.category === categoryFilter.value;
      const search = searchFilter.value.trim().toLocaleLowerCase('fr');
      const searchMatch = !search || `${event.title} ${event.sourceCourse || ''}`.toLocaleLowerCase('fr').includes(search);
      return yearMatch && courseMatch && categoryMatch && searchMatch;
    });
    if (!visible.length) {
      timeline?.destroy();
      timeline = null;
      timelineHost.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Aucun événement daté ne correspond aux filtres.';
      timelineHost.append(empty);
    } else if (window.vis?.Timeline && window.vis?.DataSet) {
      if (timeline) timeline.destroy();
      timeline = null;
      timelineHost.replaceChildren();
      const groups = Object.keys(categoryInfo)
        .filter((category) => visible.some((event) => event.category === category))
        .map((category, order) => ({ id: category, content: categoryInfo[category].label, order: order + 1 }));
      const items = visible.map((event) => ({
        id: event.id,
        group: event.category,
        content: `${event.title}${event.course ? ` · ${event.course}` : ''}${event.status === 'inactif' ? ' · inactif' : ''}`,
        start: event.start,
        ...(event.end ? { end: event.end, type: 'range' } : { type: 'point' }),
        className: `timeline-item-${event.category}`,
        title: `${event.title} · ${formatDate(event.start)}${event.end ? ` – ${formatDate(event.end)}` : ''}`
      }));
      timeline = new window.vis.Timeline(timelineHost, new window.vis.DataSet(items), new window.vis.DataSet(groups), {
        locale: 'fr',
        height: '420px',
        min: new Date(Math.min(...visible.map((event) => new Date(Number(event.schoolYear.split('-')[0]), 8, 1).getTime()))),
        max: new Date(Math.max(...visible.map((event) => new Date(Number(event.schoolYear.split('-')[1]), 7, 31, 23, 59, 59, 999).getTime()))),
        zoomMin: 1000 * 60 * 60 * 24 * 7,
        zoomMax: 1000 * 60 * 60 * 24 * 365,
        moveable: true,
        zoomable: true,
        selectable: true,
        groupOrder: 'order',
        orientation: 'top'
      });
      timeline.on('select', ({ items: selectedItems }) => {
        const selected = visible.find((event) => event.id === selectedItems[0]);
        if (selected) renderDetails(selected);
      });
    } else {
      timelineHost.replaceChildren();
      const error = document.createElement('p');
      error.className = 'error';
      error.textContent = 'La bibliothèque vis-timeline n’a pas pu être chargée.';
      timelineHost.append(error);
    }

    undatedList.replaceChildren();
    visibleUndated.forEach((event) => {
      const item = document.createElement('li');
      item.textContent = event.title;
      const context = document.createElement('span');
      const fields = [categoryInfo[event.category].label, event.sourceCourse, event.schoolYear, event.status === 'inactif' ? 'Inactif' : 'Actif'].filter(Boolean);
      context.textContent = fields.join(' · ');
      item.append(context);
      undatedList.append(item);
    });
  };

  [yearFilter, courseFilter, categoryFilter].forEach((filter) => filter.addEventListener('change', render));
  searchFilter.addEventListener('input', render);
  loadData().catch((error) => {
    summary.textContent = 'Les données de cours n’ont pas pu être chargées.';
    timelineHost.replaceChildren();
    const message = document.createElement('p');
    message.className = 'error';
    message.textContent = error.message;
    timelineHost.append(message);
    undatedSummary.textContent = 'Indisponible.';
  });
})();
