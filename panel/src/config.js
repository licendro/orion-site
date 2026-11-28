// Configuration du panneau : data/config.json (créé par « npm run setup », modifiable dans Réglages).
import fs from 'node:fs';
import path from 'node:path';

export const DATA = path.resolve(process.env.PANEL_DATA || new URL('../data', import.meta.url).pathname);
const FILE = path.join(DATA, 'config.json');

export const DEFAULTS = {
  port: 3030,
  host: '127.0.0.1',
  // Identifiants (remplis par npm run setup)
  auth: { user: 'admin', hash: '', salt: '', totp: '' },
  // Dossiers visibles dans l'onglet Fichiers (rien en dehors)
  roots: ['/root/orion'],
  // Fiche de chaque application pm2 : nom affiché, adresse à surveiller, commande de mise à jour, dossier de sauvegardes
  apps: {
    orion: { label: 'Orion Store (site)', url: 'http://127.0.0.1:3000/api/health', deploy: './deploy.sh', group: 'Orion' },
    'orion-bot': { label: 'Bot Discord Orion', url: '', deploy: '', group: 'Orion' },
  },
  backupsDir: '/root/orion/backups',
  // Alertes Discord
  alerts: { webhook: '', memoryPct: 90, systemMemPct: 90, diskPct: 85, dailyReport: true, reportHour: 9 },
};

let cache = null;
export function config() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* pas encore créé */ }
  cache = { ...DEFAULTS, ...saved, auth: { ...DEFAULTS.auth, ...saved.auth }, alerts: { ...DEFAULTS.alerts, ...saved.alerts }, apps: saved.apps || DEFAULTS.apps };
  return cache;
}
export function saveConfig(next) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  cache = null;
  return config();
}

// Journal des actions (qui a fait quoi, quand)
export function audit(action, detail = '') {
  fs.mkdirSync(DATA, { recursive: true });
  fs.appendFileSync(path.join(DATA, 'audit.log'), `${new Date().toISOString()}\t${action}\t${String(detail).replace(/\s+/g, ' ').slice(0, 300)}\n`);
}
export function readAudit(limit = 200) {
  try {
    return fs.readFileSync(path.join(DATA, 'audit.log'), 'utf8').trim().split('\n').slice(-limit).reverse()
      .map((l) => { const [at, action, detail] = l.split('\t'); return { at, action, detail }; });
  } catch { return []; }
}
