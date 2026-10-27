const recolorerLottie = (data, color) => {
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
          if (Array.isArray(frame.s)) next.s = recolorerCouleur(frame.s);
          if (Array.isArray(frame.e)) next.e = recolorerCouleur(frame.e);
          return next;
        });
      } else {
        result.k = recolorerCouleur(value.k);
      }
      return result;
    }
    for (const [key, item] of Object.entries(value)) {
      if (key === 'c' && item && typeof item === 'object' && 'k' in item) {
        value[key] = { ...item, k: recolorerCouleur(item.k) };
      } else {
        value[key] = visit(item);
      }
    }
    return value;
  };
  const recolorerCouleur = (value) => {
    if (Array.isArray(value)) {
      if ((value.length === 3 || value.length === 4) && value.every((channel) => typeof channel === 'number' && channel >= 0 && channel <= 1)) {
        const isBlack = Math.max(value[0], value[1], value[2]) < 0.02;
        return [...(isBlack ? [0, 0, 0] : rgb), value.length === 4 ? value[3] : 1];
      }
      return value.map(recolorerCouleur);
    }
    if (!value || typeof value !== 'object') return value;
    return value;
  };
  return visit(JSON.parse(JSON.stringify(data)));
};

async function afficherGrille(urlJson, idConteneur) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;

  try {
    let couleur = '#7fbc48';
    let typeEvaluation = '';
    let categorieEvaluation = '';
    let animationEvaluation = '';
    let racineCours;
    const { course, chapter } = document.body.dataset;
    if (course && chapter) {
      try {
        const racine = new URL('../../../../', document.baseURI);
        racineCours = racine;
        const reponseCours = await fetch(new URL(`cours/${encodeURIComponent(course)}/cours.json`, racine));
        if (reponseCours.ok) {
          const donneesCours = await reponseCours.json();
          const donneesChapitre = (donneesCours.chapitres || []).find((item) => item.id === chapter);
          const cheminEvaluation = decodeURIComponent(new URL(location.href).pathname);
          const evaluationFinale = donneesChapitre?.evaluationFinale;
          const evaluationSecondaire = (donneesChapitre?.evaluationsSecondaires || []).find((item) => item.page && cheminEvaluation.endsWith(item.page));
          const estEvaluationFinale = Boolean(evaluationFinale?.page && cheminEvaluation.endsWith(evaluationFinale.page));
          const evaluation = estEvaluationFinale ? evaluationFinale : evaluationSecondaire;
          typeEvaluation = evaluation?.type || (estEvaluationFinale ? 'Fin de séquence' : '');
          animationEvaluation = evaluation?.lottie || '';
          categorieEvaluation = estEvaluationFinale ? 'Évaluation finale' : 'Évaluation secondaire';
          couleur = donneesChapitre?.couleur || donneesCours.couleur || couleur;
          document.documentElement.style.setProperty('--grille-color', couleur);
          document.querySelector('meta[name="theme-color"]')?.setAttribute('content', couleur);
          document.getElementById('page-header')?.style.setProperty('--course-color', couleur);
          document.getElementById('chapter-title').textContent = donneesChapitre?.titre || donneesCours.titre;
          document.title = `${donneesChapitre?.titre || 'Évaluation'} — ${donneesCours.titre}`;
          const courseUrl = new URL(`cours/?cours=${encodeURIComponent(course)}`, racine).href;
          document.getElementById('course-link').href = courseUrl;
          document.getElementById('footer-link').href = courseUrl;
          const logo = document.getElementById('course-lottie');
          const animationPath = donneesChapitre?.lottie || donneesCours.lottie;
          if (logo && animationPath && window.lottie) {
            const reponseAnimation = await fetch(new URL(animationPath, racine));
            if (reponseAnimation.ok) {
              window.lottie.loadAnimation({
                container: logo,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: recolorerLottie(await reponseAnimation.json(), couleur)
              });
            }
          }
        }
      } catch {}
    }
    document.documentElement.style.setProperty('--grille-color', couleur);

    const qrOpen = document.getElementById('qr-open');
    const qrDialog = document.getElementById('qr-dialog');
    const qrSmall = document.getElementById('page-qr');
    const qrLarge = document.getElementById('page-qr-large');
    if (window.QRCode && qrSmall && qrLarge) {
      new window.QRCode(qrSmall, { text: location.href, width: 64, height: 64, correctLevel: window.QRCode.CorrectLevel.M });
      new window.QRCode(qrLarge, { text: location.href, width: 280, height: 280, correctLevel: window.QRCode.CorrectLevel.M });
    }
    qrOpen?.addEventListener('click', () => qrDialog?.showModal());
    document.getElementById('qr-close')?.addEventListener('click', () => qrDialog?.close());
    qrDialog?.addEventListener('click', (event) => {
      if (event.target === qrDialog) qrDialog.close();
    });

    const reponse = await fetch(urlJson);
    if (!reponse.ok) throw new Error('Impossible de charger la grille.');
    const data = await reponse.json();
    const entete = data.entete;
    const titreLigne = document.createElement('div');
    titreLigne.className = 'grille-title-row';
    const titrePage = document.createElement('h1');
    titrePage.className = 'grille-title';
    titrePage.textContent = 'Grille d’évaluation';
    titreLigne.append(titrePage);

    if (typeEvaluation) {
      const badgeEvaluation = document.createElement('p');
      badgeEvaluation.className = 'evaluation-type';
      badgeEvaluation.textContent = categorieEvaluation === 'Évaluation secondaire'
        ? `${categorieEvaluation} : ${typeEvaluation}`
        : typeEvaluation;
      badgeEvaluation.setAttribute('aria-label', categorieEvaluation);
      titreLigne.append(badgeEvaluation);
    }
    if (animationEvaluation && window.lottie) {
      const animation = document.createElement('span');
      animation.className = 'evaluation-lottie';
      animation.setAttribute('aria-hidden', 'true');
      titreLigne.append(animation);
      try {
        const reponseAnimation = await fetch(new URL(animationEvaluation, racineCours));
        if (reponseAnimation.ok) {
          window.lottie.loadAnimation({
            container: animation,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: recolorerLottie(await reponseAnimation.json(), couleur)
          });
        }
      } catch {}
    }
    conteneur.append(titreLigne);

    const tableEntete = document.createElement('table');
    tableEntete.className = 'entete';

    const ajouterCellule = (ligne, balise, texte, options = {}) => {
      const cellule = document.createElement(balise);
      cellule.textContent = texte;
      if (options.colSpan) cellule.colSpan = options.colSpan;
      if (options.rowSpan) cellule.rowSpan = options.rowSpan;
      if (options.className) cellule.className = options.className;
      if (options.scope) cellule.scope = options.scope;
      ligne.append(cellule);
      return cellule;
    };

    let ligne = tableEntete.insertRow();
    ajouterCellule(ligne, 'th', entete.examen, { colSpan: 4, scope: 'colgroup' });
    ligne = tableEntete.insertRow();
    const devoir = ajouterCellule(ligne, 'td', '', { colSpan: 4 });
    const titreDevoir = document.createElement('strong');
    titreDevoir.textContent = 'Devoir sur : ';
    devoir.append(titreDevoir, document.createTextNode(entete.titre));

    ligne = tableEntete.insertRow();
    ajouterCellule(ligne, 'td', `Module : ${entete.epreuve}`, { colSpan: 2 });
    ajouterCellule(ligne, 'td', `Année scolaire : ${entete.session}`, { colSpan: 2 });

    ligne = tableEntete.insertRow();
    ajouterCellule(ligne, 'td', `Établissement : ${entete.etablissement}`, { colSpan: 2 });
    ajouterCellule(ligne, 'td', `Coefficient : ${entete.coefficient}`, { colSpan: 2 });
    conteneur.append(tableEntete);

    const table = document.createElement('table');
    table.className = 'grille';
    const thead = table.createTHead();
    const ligneTitres = thead.insertRow();
    ['Capacité', 'Critères', 'Indicateurs'].forEach((titre) => {
      ajouterCellule(ligneTitres, 'th', titre, { scope: 'col' });
    });
    data.niveaux.forEach((niveau) => {
      ajouterCellule(ligneTitres, 'th', niveau, { className: 'niveau', scope: 'col' });
    });

    const tbody = table.createTBody();
    data.capacites.forEach((capacite, iCapacite) => {
      const totalLignes = capacite.criteres.reduce((total, critere) => total + critere.indicateurs.length, 0);
      let premiereLigne = true;

      capacite.criteres.forEach((critere, iCritere) => {
        critere.indicateurs.forEach((indicateur, iIndicateur) => {
          const ligneDonnees = tbody.insertRow();
          if (premiereLigne) {
            const celluleCapacite = ajouterCellule(ligneDonnees, 'th', `${capacite.code} — ${capacite.intitule}`, {
              rowSpan: totalLignes,
              className: 'capacite',
              scope: 'rowgroup'
            });
            celluleCapacite.setAttribute('aria-label', `${capacite.code} : ${capacite.intitule}`);
          }
          if (iIndicateur === 0) {
            ajouterCellule(ligneDonnees, 'th', critere.intitule, {
              rowSpan: critere.indicateurs.length,
              className: 'critere',
              scope: 'rowgroup'
            });
          }
          ajouterCellule(ligneDonnees, 'td', indicateur, { className: 'indicateur' });

          data.niveaux.forEach(() => {
            ajouterCellule(ligneDonnees, 'td', '', { className: 'niveau' });
          });
          premiereLigne = false;
        });
      });
    });
    const cadreGrille = document.createElement('div');
    cadreGrille.className = 'grille-scroll';
    cadreGrille.append(table);
    conteneur.append(cadreGrille);

    const pied = document.createElement('table');
    pied.className = 'pied';
    ligne = pied.insertRow();
    ajouterCellule(ligne, 'td', 'Grille construite par M. APREMONT.', { colSpan: 2 });
    conteneur.append(pied);
  } catch (erreur) {
    conteneur.textContent = erreur.message;
  }
}