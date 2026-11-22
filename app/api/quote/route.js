import { clientIp, json, rateLimited } from '../../../lib/http';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const TYPES = { 'sur-mesure': 'Script sur mesure', partenariat: 'Partenariat serveur', bot: 'Bot Discord', carte: 'Service à la carte' };
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
// Empêche les mentions @everyone / @here dans le message envoyé sur Discord.
const noPing = (s) => s.replace(/@/g, '@​');

export async function POST(req) {
  const hook = process.env.DISCORD_QUOTE_WEBHOOK;
  const ip = clientIp(req) || 'local';
  if (rateLimited(`quote:${ip}`, 3, 10 * 60e3)) return json({ error: 'Trop de demandes, réessayez dans quelques minutes.' }, 429);

  const b = await req.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // robot
  const discord = clean(b.discord, 40);
  const message = String(b.message || '').trim().slice(0, 2000);
  if (!discord || message.length < 20) return json({ error: 'Pseudo Discord et description (20 caractères minimum) requis.' }, 400);

  db().prepare('INSERT INTO quotes (discord, type, framework, budget, message) VALUES (?, ?, ?, ?, ?)')
    .run(discord, TYPES[b.type] ? b.type : 'other', clean(b.framework, 30), clean(b.budget, 30), message);
  if (!hook) return json({ ok: true });

  const payload = {
    username: 'Orion · Devis',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `Nouvelle demande · ${TYPES[b.type] || 'Autre'}`,
      color: 0xff7a2f,
      description: noPing(message),
      fields: [
        { name: 'Discord', value: noPing(discord), inline: true },
        { name: 'Framework', value: clean(b.framework, 30) || '—', inline: true },
        { name: 'Budget', value: clean(b.budget, 30) || '—', inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`Discord ${r.status}`);
    return json({ ok: true });
  } catch (e) {
    console.error('[quote]', e.message);
    return json({ error: 'Envoi impossible pour le moment, contactez-nous sur Discord.' }, 502);
  }
}
