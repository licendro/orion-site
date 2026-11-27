// Historique des versions des scripts (table changelogs du site) : page /changelog, fiche script, patch notes.
import { db } from './db';

export const KIND_LABEL = { ajout: 'Ajout', correctif: 'Correctif', amelioration: 'Amélioration' };

// Badges devinés depuis les lignes des notes si non cochés (+ ajout, ~ amélioration, - / fix correctif)
export function guessKinds(notes) {
  const k = new Set();
  for (const l of String(notes || '').split('\n').map((x) => x.trim())) {
    if (/^\+/.test(l) || /^ajout/i.test(l)) k.add('ajout');
    else if (/^~/.test(l) || /^am[ée]lior/i.test(l)) k.add('amelioration');
    else if (/^-/.test(l) || /^(fix|correct)/i.test(l)) k.add('correctif');
  }
  return [...k];
}

const cmp = (a, b) => {
  const pa = String(a).replace(/^v/i, '').split(/[.-]/).map(Number), pb = String(b).replace(/^v/i, '').split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
};
const row = (r) => ({
  script: r.product_key, version: String(r.version).replace(/^v/i, ''),
  date: Date.parse(String(r.created_at).replace(' ', 'T') + 'Z'),
  kinds: r.kinds ? r.kinds.split(',').filter(Boolean) : guessKinds(r.notes), notes: r.notes,
});

export function changelogAll() {
  const rows = db().prepare('SELECT c.*, p.name FROM changelogs c JOIN products p ON p.key = c.product_key WHERE p.hidden = 0 ORDER BY c.id DESC').all();
  const scripts = new Map();
  for (const r of rows) {
    const s = scripts.get(r.product_key);
    if (!s || cmp(r.version, s.latest) > 0) scripts.set(r.product_key, { name: r.product_key, title: r.name, latest: String(r.version).replace(/^v/i, '') });
  }
  return { scripts: [...scripts.values()].sort((a, b) => a.title.localeCompare(b.title)), recent: rows.slice(0, 60).map(row) };
}

export function changelogOf(key) {
  const p = db().prepare('SELECT key, name FROM products WHERE key = ? AND hidden = 0').get(key);
  if (!p) return null;
  const versions = db().prepare('SELECT * FROM changelogs WHERE product_key = ?').all(key).map(row).sort((a, b) => cmp(b.version, a.version));
  return { script: { name: p.key, title: p.name, product_key: p.key, latest: versions[0]?.version || null }, versions };
}
