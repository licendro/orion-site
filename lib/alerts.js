import fs from 'node:fs';
import path from 'node:path';
import { getSetting, setSetting } from './db';

// Webhook du salon 🚨 alertes : .env DISCORD_ALERT_WEBHOOK, sinon celui créé par le setup du bot.
function webhook() {
  if (process.env.DISCORD_ALERT_WEBHOOK) return process.env.DISCORD_ALERT_WEBHOOK;
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'discord', 'config.json'), 'utf8')).alertWebhook || null;
  } catch { return null; }
}

const COLORS = { critical: 0xe5484d, warning: 0xff7a2f, ok: 0x4ade80, info: 0x6eaaff };

async function post(level, title, text) {
  const url = webhook();
  if (!url) return false;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Orion · Alertes', allowed_mentions: { parse: [] },
      embeds: [{ title, description: String(text || '').slice(0, 3800), color: COLORS[level] || COLORS.info, timestamp: new Date().toISOString() }],
    }),
  }).catch(() => null);
  return !!res?.ok;
}

// Alerte avec mémoire : un problème n'est signalé qu'une fois (rappel toutes les 6 h s'il dure), puis « résolu ».
export async function raise(key, title, text, level = 'warning') {
  const state = getSetting('alerts', {});
  const cur = state[key];
  if (cur?.active && Date.now() - cur.at < 6 * 3600e3) return;
  if (await post(level, `${level === 'critical' ? '🔴' : '🟠'} ${title}`, text)) {
    state[key] = { active: true, at: Date.now(), since: cur?.since || Date.now() };
    setSetting('alerts', state);
  }
}

export async function resolve(key, title) {
  const state = getSetting('alerts', {});
  if (!state[key]?.active) return;
  const mins = Math.round((Date.now() - state[key].since) / 60e3);
  await post('ok', `✅ Résolu : ${title}`, `Le problème a duré environ ${mins} min.`);
  delete state[key];
  setSetting('alerts', state);
}

// Événement ponctuel (pas d'état « résolu »), limité à 1 envoi par clé toutes les 15 min.
export async function notify(key, title, text, level = 'warning') {
  const last = getSetting('alerts_once', {});
  if (last[key] && Date.now() - last[key] < 15 * 60e3) return;
  if (await post(level, `${level === 'critical' ? '🔴' : '🟠'} ${title}`, text)) {
    last[key] = Date.now();
    setSetting('alerts_once', last);
  }
}
