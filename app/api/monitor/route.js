import fs from 'node:fs';
import { db, getSetting, setSetting, dbPath } from '../../../lib/db';
import { getCatalog } from '../../../lib/catalog';
import { tebexEnabled } from '../../../lib/tebex';
import { json } from '../../../lib/http';
import { raise, resolve } from '../../../lib/alerts';
import { processQueue } from '../../../lib/testserver';

export const dynamic = 'force-dynamic';

// Appelé toutes les 2 minutes par le cron du VPS (installé par deploy.sh). Vérifie que tout tourne.
export async function GET() {
  const report = {};
  processQueue(); // fait avancer la file du serveur de test

  // 1. Bot Discord vivant ?
  const beat = getSetting('bot_heartbeat', 0);
  report.bot = Date.now() - beat < 3 * 60e3;
  if (!report.bot) await raise('bot', 'Bot Discord hors ligne', `Dernier signe de vie : ${beat ? new Date(beat).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : 'jamais'}.\nSur le VPS : \`pm2 logs orion-bot --lines 40\` puis \`pm2 restart orion-bot\`.`, 'critical');
  else await resolve('bot', 'Bot Discord de retour en ligne');

  // 2. Tebex joignable ?
  if (tebexEnabled()) {
    const { mode } = await getCatalog();
    report.tebex = mode === 'tebex';
    if (!report.tebex) await raise('tebex', 'Tebex injoignable', 'Le catalogue ne se charge plus : la boutique affiche un message d’erreur et les paiements sont bloqués. Vérifie le statut de Tebex et la clé TEBEX_PUBLIC_TOKEN.', 'critical');
    else await resolve('tebex', 'Tebex de nouveau joignable');
  }

  // 3. Nouvelles tâches du bot en échec
  const lastJob = getSetting('alerts_last_job_error', 0);
  const failed = db().prepare("SELECT id, type, error FROM jobs WHERE status = 'error' AND id > ? ORDER BY id").all(lastJob);
  report.failedJobs = failed.length;
  if (failed.length) {
    await raise(`jobs-${failed.at(-1).id}`, `${failed.length} tâche(s) du bot en échec`, failed.slice(0, 8).map((j) => `• #${j.id} ${j.type} : ${String(j.error).slice(0, 160)}`).join('\n') + '\n\nAdmin → Journal pour les relancer.');
    setSetting('alerts_last_job_error', failed.at(-1).id);
  }

  // 4. Webhooks Tebex avec une fausse signature (tentatives de fraude)
  const bad = db().prepare("SELECT COUNT(*) n FROM audit_logs WHERE action = 'tebex.signature_invalide' AND created_at >= datetime('now', '-15 minutes')").get().n;
  report.badSignatures = bad;
  if (bad >= 3) await raise('signatures', 'Webhooks Tebex suspects', `${bad} requêtes avec une signature invalide en 15 min sur /api/webhooks/tebex. Elles ont été refusées. Si ce n’est pas toi, quelqu’un essaie de simuler des paiements.`, 'critical');
  else await resolve('signatures', 'Plus de webhooks suspects');

  // 5. Achats qui attendent un client absent du Discord depuis plus d'1 h
  const waiting = db().prepare("SELECT COUNT(*) n FROM jobs WHERE status = 'waiting' AND created_at <= datetime('now', '-1 hour')").get().n;
  report.waiting = waiting;
  if (waiting) await raise('waiting', 'Achats en attente', `${waiting} achat(s) attendent depuis plus d’1 h que le client rejoigne le Discord (rôle et salon non donnés).`, 'warning');
  else await resolve('waiting', 'Plus d’achat en attente');

  // 6. Espace disque
  try {
    const st = fs.statfsSync(dbPath());
    const used = 1 - st.bavail / st.blocks;
    report.disk = Math.round(used * 100);
    if (used > 0.9) await raise('disk', 'Disque du VPS presque plein', `${report.disk} % utilisé. Libère de la place (logs PM2 : \`pm2 flush\`).`, 'critical');
    else await resolve('disk', 'Espace disque revenu à la normale');
  } catch { /* statfs indisponible */ }

  // 7. Maintenance oubliée ?
  const since = getSetting('maintenance_since', 0);
  if (getSetting('maintenance', false) && since && Date.now() - since > 12 * 3600e3) await raise('maintenance', 'Maintenance active depuis plus de 12 h', 'Le site public est toujours fermé. Admin → Maintenance pour le rouvrir.', 'warning');
  else await resolve('maintenance', 'Maintenance terminée');

  setSetting('monitor_last', Date.now());
  return json({ ok: true, ...report });
}
