// Ajoute automatiquement /supports-pedagogique devant un chemin
export function chemin(p = '') {
  if (/^https?:\/\//.test(p)) return p;          // lien externe : inchangé
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${p.replace(/^\//, '')}`;
}
