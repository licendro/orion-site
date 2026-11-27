// Sauvegarde nocturne de la base du site (data/orion.db), gardée 14 jours.
// Installée par deploy.sh : 15 4 * * * cd /root/orion && node scripts/backup.mjs >> backups/backup.log 2>&1

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dir = path.resolve(process.env.BACKUP_DIR || './backups');
const KEEP_DAYS = 14;
fs.mkdirSync(dir, { recursive: true });
const day = new Date().toISOString().slice(0, 10);

const targets = [['site', process.env.DATABASE_PATH || './data/orion.db']].filter(([, f]) => f && fs.existsSync(f));
for (const [name, file] of targets) {
  const dest = path.join(dir, `${name}-${day}.db`);
  const db = new Database(file, { readonly: true });
  await db.backup(dest); // copie cohérente même pendant que l'API ou le site écrivent (WAL)
  db.close();
  console.log(`${new Date().toISOString()} ✓ ${name} → ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} Ko)`);
}

// Rotation : on supprime ce qui a plus de 14 jours
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.db')) continue;
  const p = path.join(dir, f);
  if (Date.now() - fs.statSync(p).mtimeMs > KEEP_DAYS * 864e5) { fs.unlinkSync(p); console.log(`  supprimé : ${f}`); }
}
