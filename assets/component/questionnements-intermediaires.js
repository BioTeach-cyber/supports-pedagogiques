(() => {
  document.querySelectorAll('[data-component="questionnements-intermediaires"]').forEach((component) => {
    const source = component.querySelector('script[type="application/json"]')?.textContent || '[]';
    const section = document.createElement('section');
    section.className = 'activity-section activity-questionnements';
    section.dataset.activityBlock = 'questionnements-intermediaires';
    const heading = document.createElement('h2');
    heading.className = 'activity-section-title';
    heading.textContent = component.dataset.title || 'Questionnements intermédiaires';
    const list = document.createElement('ol');
    list.className = 'activity-question-list';
    try {
      const questions = JSON.parse(source);
      if (!Array.isArray(questions)) throw new TypeError('Le contenu attendu est un tableau JSON.');
      questions.forEach((entry, index) => {
        const question = typeof entry === 'string' ? entry : entry?.question;
        if (typeof question !== 'string' || !question.trim()) return;
        const item = document.createElement('li');
        item.className = 'activity-question-item';
        const icon = document.createElement('span');
        icon.className = 'activity-question-lottie';
        icon.dataset.lottieSrc = 'assets/lotties/question_mark.json';
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('p');
        text.className = 'activity-question-text';
        const prefix = document.createElement('strong');
        prefix.textContent = `Question ${String(index + 1).padStart(2, '0')} : `;
        text.append(prefix, document.createTextNode(question.trim()));
        item.append(icon, text);
        list.append(item);
      });
    } catch (error) {
      const message = document.createElement('p');
      message.className = 'error-message';
      message.textContent = `Questionnements intermédiaires : ${error.message}`;
      section.append(heading, message);
      component.replaceWith(section);
      return;
    }
    section.append(heading, list);
    component.replaceWith(section);
  });
})();
