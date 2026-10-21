async function afficherGrille(urlJson, idConteneur) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;

  try {
    const reponse = await fetch(urlJson);
    if (!reponse.ok) throw new Error('Impossible de charger la grille.');
    const data = await reponse.json();
    const entete = data.entete;
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

    const ajouterChamp = (ligne, titre, type, nom) => {
      const cellule = document.createElement('td');
      cellule.colSpan = 2;
      const label = document.createElement('label');
      label.textContent = titre;
      const champ = document.createElement('input');
      champ.type = type;
      champ.setAttribute('aria-label', titre);
      champ.name = nom;
      label.append(champ);
      cellule.append(label);
      ligne.append(cellule);
    };

    let ligne = tableEntete.insertRow();
    ajouterCellule(ligne, 'th', entete.examen, { colSpan: 4, scope: 'colgroup' });
    ligne = tableEntete.insertRow();
    const devoir = ajouterCellule(ligne, 'td', '', { colSpan: 4 });
    const titreDevoir = document.createElement('strong');
    titreDevoir.textContent = 'Devoir sur : ';
    devoir.append(titreDevoir, document.createTextNode(entete.titre));

    ligne = tableEntete.insertRow();
    ajouterChamp(ligne, 'Nom et prénom du candidat :', 'text', 'candidat');
    ajouterCellule(ligne, 'td', `Épreuve : ${entete.epreuve}`);
    ajouterCellule(ligne, 'td', `Session : ${entete.session}`);

    ligne = tableEntete.insertRow();
    ajouterChamp(ligne, 'Date :', 'date', 'date');
    ajouterCellule(ligne, 'td', `Établissement : ${entete.etablissement}`);
    ajouterCellule(ligne, 'td', `Coefficient : ${entete.coefficient}`);
    conteneur.replaceChildren(tableEntete);

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
    ['Évaluation', 'Appréciation'].forEach((titre) => {
      ajouterCellule(ligneTitres, 'th', titre, { scope: 'col' });
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

          const nomGroupe = `c${iCapacite}-k${iCritere}-i${iIndicateur}`;
          data.niveaux.forEach((niveau, iNiveau) => {
            const celluleNiveau = ligneDonnees.insertCell();
            celluleNiveau.className = 'niveau';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = nomGroupe;
            radio.value = niveau;
            radio.setAttribute('aria-label', `${niveau} — ${indicateur}`);
            radio.id = `${nomGroupe}-n${iNiveau}`;
            celluleNiveau.append(radio);
          });

          if (premiereLigne) {
            const celluleEvaluation = ligneDonnees.insertCell();
            celluleEvaluation.rowSpan = totalLignes;
            celluleEvaluation.className = 'evaluation';
            const selection = document.createElement('select');
            selection.setAttribute('aria-label', `Évaluation — ${capacite.code} ${capacite.intitule}`);
            ['', 'Validé', 'Non validé', 'NE'].forEach((valeur) => {
              const option = document.createElement('option');
              option.value = valeur;
              option.textContent = valeur || '—';
              selection.append(option);
            });
            celluleEvaluation.append(selection);

            const celluleAppreciation = ligneDonnees.insertCell();
            celluleAppreciation.rowSpan = totalLignes;
            celluleAppreciation.className = 'appreciation';
            const appreciation = document.createElement('textarea');
            appreciation.setAttribute('aria-label', `Appréciation — ${capacite.code} ${capacite.intitule}`);
            celluleAppreciation.append(appreciation);
            premiereLigne = false;
          }
        });
      });
    });
    conteneur.append(table);

    const pied = document.createElement('table');
    pied.className = 'pied';
    ligne = pied.insertRow();
    ajouterCellule(ligne, 'td', 'NE = Non évalué durant cette évaluation — Évaluation : validé ou non validé', { colSpan: 2 });
    ligne = pied.insertRow();
    const celluleAppreciation = ligne.insertCell();
    const labelAppreciation = document.createElement('label');
    labelAppreciation.textContent = 'Appréciation générale :';
    const appreciationGenerale = document.createElement('textarea');
    appreciationGenerale.setAttribute('aria-label', 'Appréciation générale');
    labelAppreciation.append(appreciationGenerale);
    celluleAppreciation.append(labelAppreciation);
    const celluleSignature = ligne.insertCell();
    celluleSignature.textContent = 'Signature de l’enseignant :';
    celluleSignature.className = 'signature';
    conteneur.append(pied);
  } catch (erreur) {
    conteneur.textContent = erreur.message;
  }
}