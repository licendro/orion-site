import { json, rateLimited } from '../../../lib/http';
import { addJob, db } from '../../../lib/db';
import { getUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
const clean = (v, n) => String(v || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);

// Proposer une idée depuis le site : connexion Discord obligatoire, le bot crée le post dans #suggestions.
export async function POST(req) {
  const user = await getUser();
  if (!user) return json({ error: 'Connecte-toi avec Discord pour proposer une idée.', login: true }, 401);
  if (rateLimited(`idea:${user.discord_id}`, 3, 24 * 3600e3)) return json({ error: '3 idées par jour maximum. Reviens demain !' }, 429);
  const b = await req.json().catch(() => ({}));
  const title = clean(b.title, 100).replace(/\n/g, ' ');
  if (title.length < 5) return json({ error: 'Décris ton idée en une phrase (5 caractères minimum).' }, 400);
  const kind = ['script', 'amelioration', 'autre'].includes(b.kind) ? b.kind : 'script';
  const product = kind === 'amelioration' && b.product ? db().prepare('SELECT key FROM products WHERE key = ?').get(String(b.product))?.key || null : null;
  const dup = db().prepare("SELECT id FROM ideas WHERE lower(title) = lower(?) AND status NOT IN ('refusee')").get(title);
  if (dup) return json({ error: `Cette idée existe déjà (idée n°${dup.id}) : vote pour elle !`, id: dup.id }, 409);
  const { lastInsertRowid } = db().prepare(`INSERT INTO ideas (title, description, kind, product_key, author_id, author_name, source) VALUES (?, ?, ?, ?, ?, ?, 'site')`)
    .run(title, clean(b.description, 1500) || null, kind, product, user.discord_id, user.username);
  const id = Number(lastInsertRowid);
  db().prepare('INSERT OR IGNORE INTO idea_votes (idea_id, discord_id, value) VALUES (?, ?, 1)').run(id, user.discord_id);
  addJob('idea.publish', { id });
  return json({ ok: true, id });
}
