// Première configuration du panneau : identifiant, mot de passe, code à 6 chiffres (2FA), applications détectées.
//   npm run setup
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { config, saveConfig } from '../src/config.js';
import { hashPassword, newTotpSecret, totpAt } from '../src/auth.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q) => new Promise((r) => rl.question(q, r));
// Saisie masquée du mot de passe
const askHidden = (q) => new Promise((resolve) => {
  const write = rl._writeToOutput;
  rl._writeToOutput = (s) => { if (s.includes(q)) write.call(rl, s); else write.call(rl, s.replace(/[^\r\n]/g, '•')); };
  rl.question(q, (a) => { rl._writeToOutput = write; process.stdout.write('\n'); resolve(a); });
});

const c = config();
console.log('\n=== Panneau VPS Orion : configuration ===\n');
const user = (await ask(`Identifiant [${c.auth.user}] : `)).trim() || c.auth.user;
let pass = '';
while (pass.length < 12) {
  pass = await askHidden('Mot de passe (12 caractères minimum) : ');
  if (pass.length < 12) console.log('Trop court.');
  else if ((await askHidden('Confirme le mot de passe : ')) !== pass) { console.log('Les deux ne correspondent pas.'); pass = ''; }
}

const secret = newTotpSecret();
console.log('\n— Double authentification —');
console.log('Ouvre ton appli d’authentification (Google Authenticator, Aegis, 2FAS…) → Ajouter → Saisir une clé :');
console.log(`  Nom : Panneau VPS Orion\n  Clé : ${secret.match(/.{1,4}/g).join(' ')}\n`);
let ok = false;
for (let i = 0; i < 3 && !ok; i++) {
  const code = (await ask('Code à 6 chiffres affiché par l’appli : ')).replace(/\s/g, '');
  ok = [-1, 0, 1].some((d) => totpAt(secret, Date.now() + d * 30000) === code);
  if (!ok) console.log('Code incorrect, réessaie.');
}
if (!ok) { console.log('2FA non validée : relance « npm run setup ».'); process.exit(1); }

// Applications déjà présentes dans pm2
const appsMeta = { ...c.apps };
try {
  const out = execFileSync('pm2', ['jlist']).toString();
  const list = JSON.parse(out.slice(out.indexOf('[')));
  for (const p of list) if (!appsMeta[p.name]) appsMeta[p.name] = { label: p.name, url: '', deploy: '', group: 'Autres' };
  console.log(`\nApplications trouvées dans pm2 : ${list.map((p) => p.name).join(', ') || 'aucune'}`);
} catch { console.log('\n(pm2 introuvable : les applications seront ajoutées plus tard.)'); }

const webhook = (await ask('\nWebhook Discord pour les alertes (Entrée pour plus tard) : ')).trim();
saveConfig({ ...c, apps: appsMeta, auth: { user, ...hashPassword(pass), totp: secret }, alerts: { ...c.alerts, webhook: webhook || c.alerts.webhook } });
console.log('\n✓ Panneau configuré. Lance-le : pm2 start ecosystem.config.cjs && pm2 save\n');
rl.close();
