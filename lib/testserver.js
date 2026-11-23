// Serveur de test : places limitées, file d'attente et créneaux de durée fixe.
import crypto from 'node:crypto';
import { addJob, db, getSetting, setSetting } from './db';

export function testConfig() {
  return {
    enabled: getSetting('test_enabled', false),
    connect: getSetting('test_connect', ''),     // ex. cfx.re/join/abcd12 ou 123.45.67.89:30120
    query: getSetting('test_query', ''),         // ex. http://123.45.67.89:30120 (pour lire le nombre de joueurs)
    slots: Number(getSetting('test_slots', 4)),  // places réservées aux tests en même temps
    minutes: Number(getSetting('test_minutes', 30)),
    clientsOnly: getSetting('test_clients_only', false),
  };
}

export function apiKey() {
  let k = getSetting('test_api_key', '');
  if (!k) { k = crypto.randomBytes(24).toString('hex'); setSetting('test_api_key', k); }
  return k;
}
export const rotateApiKey = () => { const k = crypto.randomBytes(24).toString('hex'); setSetting('test_api_key', k); return k; };

// Termine les créneaux écoulés et fait entrer les suivants de la file.
export function processQueue() {
  const d = db();
  const now = Date.now();
  const { slots, minutes, enabled } = testConfig();
  d.prepare("UPDATE test_sessions SET status = 'done' WHERE status = 'active' AND ends_at <= ?").run(now);
  if (!enabled) return;
  const active = d.prepare("SELECT COUNT(*) n FROM test_sessions WHERE status = 'active'").get().n;
  const free = Math.max(0, slots - active);
  if (!free) return;
  const next = d.prepare("SELECT * FROM test_sessions WHERE status = 'waiting' ORDER BY id LIMIT ?").all(free);
  for (const s of next) {
    d.prepare("UPDATE test_sessions SET status = 'active', starts_at = ?, ends_at = ? WHERE id = ?").run(now, now + minutes * 60e3, s.id);
    addJob('test.ready', { discord_id: s.discord_id, minutes, connect: testConfig().connect });
  }
}

export function sessionOf(discordId) {
  return db().prepare("SELECT * FROM test_sessions WHERE discord_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1").get(discordId) || null;
}

export function queuePosition(session) {
  if (!session || session.status !== 'waiting') return 0;
  return db().prepare("SELECT COUNT(*) n FROM test_sessions WHERE status = 'waiting' AND id <= ?").get(session.id).n;
}

export function counts() {
  const r = db().prepare("SELECT SUM(status = 'active') active, SUM(status = 'waiting') waiting FROM test_sessions").get();
  return { active: r.active || 0, waiting: r.waiting || 0 };
}

// État public du serveur FiveM (joueurs connectés / places) via son adresse HTTP
export async function serverStatus() {
  const { query } = testConfig();
  if (!query) return null;
  try {
    const base = query.replace(/\/+$/, '');
    const res = await fetch(`${base}/dynamic.json`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { online: false };
    const j = await res.json();
    return { online: true, players: Number(j.clients) || 0, max: Number(j.sv_maxclients) || 0, name: j.hostname || '' };
  } catch {
    return { online: false };
  }
}

export const connectUrl = (connect) => {
  if (!connect) return null;
  if (/^https?:\/\//.test(connect)) return connect;
  if (connect.startsWith('cfx.re/join/')) return `https://${connect}`;
  return `fivem://connect/${connect}`;
};
