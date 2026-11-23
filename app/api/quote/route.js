import { clientIp, json, rateLimited } from '../../../lib/http';
import { addJob, db } from '../../../lib/db';
import { getUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

const TYPES = { 'sur-mesure': 'Script sur mesure', partenariat: 'Partenariat serveur', bot: 'Bot Discord', carte: 'Service à la carte' };
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

// Demande de devis : réservée aux membres connectés avec Discord.
// Le bot ouvre ensuite un ticket privé avec la personne dedans.
export async function POST(req) {
  const user = await getUser();
  if (!user) return json({ error: 'Connectez-vous avec Discord pour demander un devis.', login: true }, 401);
  const ip = clientIp(req) || 'local';
  if (rateLimited(`quote:${user.discord_id}`, 3, 30 * 60e3) || rateLimited(`quote-ip:${ip}`, 5, 30 * 60e3)) {
    return json({ error: 'Trop de demandes, réessayez dans quelques minutes.' }, 429);
  }

  const b = await req.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // robot
  const message = String(b.message || '').trim().slice(0, 2000);
  if (message.length < 20) return json({ error: 'Décrivez votre besoin en quelques phrases (20 caractères minimum).' }, 400);

  const { lastInsertRowid } = db().prepare('INSERT INTO quotes (discord, discord_id, type, framework, budget, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.username, user.discord_id, TYPES[b.type] ? b.type : 'other', clean(b.framework, 30), clean(b.budget, 30), message);
  addJob('quote.ticket', { quote_id: Number(lastInsertRowid) });
  return json({ ok: true });
}
