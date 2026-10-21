// assets/js/app.js
(() => {
  // app.js est dans assets/js/, donc la racine est deux niveaux au-dessus
  const RACINE = new URL('../../', document.currentScript.src);
  window.SITE = { RACINE, url: (chemin) => new URL(chemin, RACINE).href };

  const ajouterCSS = (chemin) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = SITE.url(chemin);
    document.head.appendChild(l);
  };

  const chargerJS = (chemin) => new Promise((ok, erreur) => {
    const s = document.createElement('script');
    s.src = SITE.url(chemin);
    s.onload = ok;
    s.onerror = () => erreur(new Error('Introuvable : ' + chemin));
    document.head.appendChild(s);
  });

  SITE.chargerJSON = async (chemin) => {
    const r = await fetch(SITE.url(chemin));
    if (!r.ok) throw new Error('JSON introuvable : ' + chemin);
    return r.json();
  };

  ajouterCSS('assets/css/theme.css');
  ajouterCSS('assets/css/base.css');

  (async () => {
    try {
      SITE.config = await SITE.chargerJSON('site.json');
      await chargerJS('assets/js/theme.js');
      await SITE.appliquerTheme();

      // Modules chargés selon le type de page
      const page = document.body.dataset.page;
      if (page === 'accueil') await chargerJS('assets/js/accueil.js');
      // Étapes suivantes : menu.js, briques.js, markdown.js...
    } catch (e) {
      console.error(e);
      document.body.insertAdjacentHTML('beforeend',
        `<p style="color:#b00;padding:1rem">Erreur de chargement : ${e.message}</p>`);
    }
  })();
})();