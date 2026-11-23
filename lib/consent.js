// Consentement aux traceurs optionnels (CNIL) : vidéos YouTube et code créateur conservé 30 jours.
// Le choix (accord comme refus) est gardé 6 mois, puis redemandé.
export const CONSENT_KEY = 'orion-consent-v1';
export const CONSENT_DAYS = 182;

export function getConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    if (!c || Date.now() - c.t > CONSENT_DAYS * 864e5) return null;
    return c;
  } catch { return null; }
}
export function setConsent(choices) {
  const c = { youtube: !!choices.youtube, ref: !!choices.ref, t: Date.now() };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(c)); } catch { /* stockage indisponible */ }
  // Retrait du consentement : on efface ce qui en dépendait
  if (!c.ref) { try { localStorage.removeItem('orion-ref-v1'); } catch { /* rien */ } }
  window.dispatchEvent(new CustomEvent('orion:consent', { detail: c }));
  return c;
}
export const allowed = (k) => !!getConsent()?.[k];
