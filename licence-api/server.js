// API de licences Orion — point d'entrée (lancé par pm2, voir ecosystem.config.cjs).
import 'dotenv/config';
import { openDb } from './src/db.js';
import { buildApp, purge } from './src/app.js';
import { loadSigningKey, publicKeyHex } from './src/util.js';

loadSigningKey();
if ((process.env.ADMIN_TOKEN || '').length < 32) {
  console.error('ADMIN_TOKEN manquant ou trop court (32 caractères minimum) : openssl rand -hex 32');
  process.exit(1);
}

const db = openDb();
const app = buildApp({ db, logger: { level: process.env.LOG_LEVEL || 'warn' } });

// Purge RGPD (IP des journaux : 30 jours) au démarrage puis toutes les 6 h
const runPurge = () => { try { purge(db); } catch (e) { app.log.error(e); } };
runPurge();
setInterval(runPurge, 6 * 3600e3).unref();

const port = Number(process.env.PORT || 3020);
app.listen({ port, host: process.env.HOST || '127.0.0.1' }).then(() => {
  console.log(`API de licences Orion sur ${process.env.HOST || '127.0.0.1'}:${port} · clé publique ${publicKeyHex()}`);
});

// Arrêt propre (pm2 reload)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await app.close(); db.close(); process.exit(0); });
