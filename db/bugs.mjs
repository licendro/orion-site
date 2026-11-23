// Statuts du suivi de bugs, partagés par le site et le bot.
export const BUG_STATUS = {
  nouveau:  { label: 'Nouveau',                         emoji: '🆕', color: 0x9aa0ad, open: true },
  confirme: { label: 'Confirmé',                        emoji: '🔁', color: 0xf5a524, open: true },
  en_cours: { label: 'Correction en cours',             emoji: '🔧', color: 0x6eaaff, open: true },
  corrige:  { label: 'Corrigé, dans la prochaine mise à jour', emoji: '🧪', color: 0x86efac, open: true },
  publie:   { label: 'Corrigé et publié',               emoji: '✅', color: 0x4ade80, open: false },
  refuse:   { label: 'Pas un bug',                      emoji: 'ℹ️', color: 0x5c6270, open: false },
  doublon:  { label: 'Doublon',                         emoji: '📎', color: 0x5c6270, open: false },
};
export const BUG_SEVERITY = {
  critique: { label: 'Critique', emoji: '🔴' },
  genant:   { label: 'Gênant',   emoji: '🟠' },
  mineur:   { label: 'Mineur',   emoji: '🟢' },
};
export const bugLabel = (s, version) => s === 'publie' && version ? `Corrigé dans la v${version}` : BUG_STATUS[s]?.label || s;
// Statuts visibles publiquement comme « problème connu »
export const KNOWN = ['confirme', 'en_cours', 'corrige'];
