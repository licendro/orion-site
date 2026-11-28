// Surveillance toutes les 30 s + alertes Discord (webhook) + récap quotidien.
import fs from 'node:fs';
import { config } from './config.js';
import { apps, intent, systemStats } from './system.js';

const state = { restarts: new Map(), status: new Map(), http: new Map(), alerts: new Map(), lastReport: null, history: [] };
export const events = []; // derniers évènements, affichés dans l'onglet Alertes

const COLORS = { danger: 0xef4444, warn: 0xf5a524, ok: 0x4ade80, info: 0x6eaaff };
const mb = (b) => `${Math.round(b / 1048576)} Mo`;

export async function send(title, text, level = 'danger', key = null, cooldownMs = 30 * 60e3) {
  if (key) {
    const last = state.alerts.get(key);
    if (last && Date.now() - last < cooldownMs) return false;
    state.alerts.set(key, Date.now());
  }
  events.unshift({ at: Date.now(), title, text, level });
  events.length = Math.min(events.length, 200);
  const url = config().alerts.webhook;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ username: 'Panneau VPS', embeds: [{ title, description: String(text).slice(0, 3900), color: COLORS[level] || COLORS.info, timestamp: new Date().toISOString() }] }),
    });
    return true;
  } catch { return false; }
}

function tail(file, lines = 15) {
  try {
    const st = fs.statSync(file);
    const fd = fs.openSync(file, 'r');
    const len = Math.min(st.size, 16384);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    return buf.toString('utf8').trim().split('\n').slice(-lines).join('\n');
  } catch { return ''; }
}

async function tick() {
  const c = config();
  let list;
  try { list = await apps(); } catch (e) { return send('🔴 pm2 ne répond pas', `Impossible de lire l’état des applications : ${e.message}`, 'danger', 'pm2', 10 * 60e3); }

  for (const a of list) {
    // Redémarrage non demandé = plantage probable
    const prev = state.restarts.get(a.name);
    const recentIntent = Date.now() - (intent.restartedAt.get(a.name) || 0) < 90e3;
    if (prev != null && a.restarts > prev && !recentIntent) {
      const near = a.maxMemory && a.memory > a.maxMemory * 0.8;
      await send(`⚠️ ${a.label} a redémarré tout seul`,
        `${a.restarts - prev} redémarrage(s) depuis la dernière vérification${near ? ` — probablement la limite de mémoire (${mb(a.maxMemory)})` : ''}.\n\nDernières erreurs :\n\`\`\`\n${tail(a.errLog).slice(-1500) || '(aucune)'}\n\`\`\``, 'warn', `restart:${a.name}`, 10 * 60e3);
    }
    state.restarts.set(a.name, a.restarts);

    // Application arrêtée ou en erreur sans qu'on l'ait voulu
    const prevStatus = state.status.get(a.name);
    if (a.status !== 'online' && !intent.stopped.has(a.name) && prevStatus !== a.status) {
      await send(`🔴 ${a.label} est ${a.status === 'errored' ? 'en erreur' : 'arrêtée'}`, `Statut pm2 : **${a.status}**.\n\nDernières erreurs :\n\`\`\`\n${tail(a.errLog).slice(-1500) || '(aucune)'}\n\`\`\``, 'danger', `status:${a.name}`, 5 * 60e3);
    } else if (a.status === 'online' && prevStatus && prevStatus !== 'online') {
      await send(`🟢 ${a.label} fonctionne de nouveau`, 'L’application est revenue en ligne.', 'ok');
    }
    state.status.set(a.name, a.status);

    // Mémoire proche de la limite
    if (a.maxMemory && a.memory > a.maxMemory * (c.alerts.memoryPct / 100)) {
      await send(`🧠 ${a.label} : mémoire presque pleine`, `${mb(a.memory)} utilisés sur ${mb(a.maxMemory)} autorisés. pm2 la redémarrera si elle dépasse. Augmente sa mémoire dans le panneau si ça se répète.`, 'warn', `mem:${a.name}`, 60 * 60e3);
    }

    // Le site répond-il ? (2 échecs de suite avant d'alerter)
    if (a.url && a.status === 'online') {
      let ok = false, info = '';
      try { const r = await fetch(a.url, { signal: AbortSignal.timeout(8000), redirect: 'manual' }); ok = r.status < 500; info = `HTTP ${r.status}`; }
      catch (e) { info = e.name === 'TimeoutError' ? 'pas de réponse en 8 s' : e.message; }
      const fails = ok ? 0 : (state.http.get(a.name) || 0) + 1;
      if (fails === 2) await send(`🌐 ${a.label} ne répond plus`, `${a.url} : ${info}.`, 'danger', `http:${a.name}`, 15 * 60e3);
      if (ok && (state.http.get(a.name) || 0) >= 2) await send(`🌐 ${a.label} répond de nouveau`, `${a.url} : ${info}.`, 'ok');
      state.http.set(a.name, fails);
    }
  }
  // Applications disparues de pm2
  for (const name of state.status.keys()) if (!list.find((a) => a.name === name)) state.status.delete(name);

  // Système
  const s = await systemStats();
  state.history.push({ t: Date.now(), cpu: s.cpu, mem: Math.round((s.mem.used / s.mem.total) * 100) });
  state.history = state.history.filter((h) => Date.now() - h.t < 24 * 3600e3);
  const memPct = (s.mem.used / s.mem.total) * 100;
  if (memPct > c.alerts.systemMemPct) await send('🧠 Mémoire du VPS presque pleine', `${Math.round(memPct)} % utilisés (${mb(s.mem.used)} / ${mb(s.mem.total)}).${s.swap.total ? ` Swap : ${mb(s.swap.used)} / ${mb(s.swap.total)}.` : ' Pas de swap !'}`, 'warn', 'sysmem', 60 * 60e3);
  if (s.disk) {
    const dPct = (s.disk.used / s.disk.total) * 100;
    if (dPct > c.alerts.diskPct) await send('💽 Disque presque plein', `${Math.round(dPct)} % utilisés, ${mb(s.disk.free)} libres. Vide les journaux (onglet Applications → Vider) ou les vieilles sauvegardes.`, 'danger', 'disk', 6 * 3600e3);
  }
  if (s.load[0] > s.cpus * 2) await send('🔥 VPS très chargé', `Charge ${s.load[0].toFixed(1)} pour ${s.cpus} cœurs.`, 'warn', 'load', 60 * 60e3);
  if (s.backup && Date.now() - s.backup.at > 36 * 3600e3) await send('💾 Pas de sauvegarde récente', `Dernière sauvegarde : ${s.backup.name}, il y a ${Math.round((Date.now() - s.backup.at) / 3600e3)} h.`, 'warn', 'backup', 12 * 3600e3);

  // Récap quotidien
  const hourParis = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(new Date()));
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  if (c.alerts.dailyReport && hourParis === Number(c.alerts.reportHour) && state.lastReport !== day) {
    state.lastReport = day;
    await send('📊 Récap du VPS', [
      ...list.map((a) => `${a.status === 'online' ? '🟢' : '🔴'} **${a.label}** · ${mb(a.memory)}${a.maxMemory ? ` / ${mb(a.maxMemory)}` : ''} · ${a.restarts} redémarrage(s) au total`),
      '',
      `RAM ${Math.round(memPct)} % · Disque ${s.disk ? Math.round((s.disk.used / s.disk.total) * 100) : '?'} % · Charge ${s.load[0].toFixed(2)}`,
      s.backup ? `Sauvegarde : ${s.backup.name}` : 'Aucune sauvegarde trouvée',
    ].join('\n'), 'info');
  }
}

export const history = () => state.history;
export function startMonitor() {
  const loop = () => tick().catch((e) => console.error('[surveillance]', e.message));
  setTimeout(loop, 5000);
  setInterval(loop, 30e3).unref?.();
}
