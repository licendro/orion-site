// Idées de scripts proposées par les joueurs : statuts partagés par le site et le bot.
export const IDEA_STATUS = {
  nouvelle: { label: 'Nouvelle',             emoji: '💡', color: 0x9aa0ad, open: true },
  etude:    { label: 'À l’étude',            emoji: '🔎', color: 0xf5a524, open: true },
  prevue:   { label: 'Prévue',               emoji: '📅', color: 0x6eaaff, open: true },
  dev:      { label: 'En développement',     emoji: '🛠️', color: 0x6eaaff, open: true },
  sortie:   { label: 'Disponible',           emoji: '🚀', color: 0x4ade80, open: false },
  refusee:  { label: 'Pas retenue',          emoji: '❌', color: 0x5c6270, open: false },
};
export const IDEA_KIND = {
  script: { label: 'Nouveau script', emoji: '💡', tag: 'Nouveau script' },
  amelioration: { label: 'Amélioration d’un script', emoji: '🛠️', tag: 'Amélioration' },
  autre: { label: 'Site / Discord / autre', emoji: '🌐', tag: 'Site' },
};
// Tag du forum #suggestions selon le statut
export const IDEA_TAG = { etude: 'En attente', prevue: 'Acceptée', dev: 'Acceptée', sortie: 'Réalisée', refusee: 'Refusée' };
