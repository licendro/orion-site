import { getSetting } from './db';
import { LEGAL_FIELDS } from '../content/legal';

// Infos légales : réglage de l'admin, sinon variable d'environnement.
export function getLegal() {
  const saved = getSetting('legal', {}) || {};
  const out = {};
  for (const [k, , , , env] of LEGAL_FIELDS) out[k] = String(saved[k] ?? process.env[env] ?? '').trim();
  out.brand ||= 'Orion Scripts';
  out.missing = LEGAL_FIELDS.filter(([k, , , req]) => req && !out[k]).map(([, label]) => label);
  return out;
}
// Valeur ou repère visible « à compléter »
export const v = (x) => x || '[à compléter]';
