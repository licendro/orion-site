import { json, rateLimited } from '../../../../lib/http';
import { addJob, db } from '../../../../lib/db';
import { getUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Vote 👍 (1) / 👎 (-1). Re-voter pareil retire le vote. Le bot met à jour la carte Discord.
export async function POST(req) {
  const user = await getUser();
  if (!user) return json({ error: 'Connecte-toi avec Discord pour voter.', login: true }, 401);
  if (rateLimited(`vote:${user.discord_id}`, 60, 10 * 60e3)) return json({ error: 'Doucement 🙂' }, 429);
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  const value = b.value === -1 ? -1 : 1;
  const idea = db().prepare('SELECT status FROM ideas WHERE id = ?').get(id);
  if (!idea) return json({ error: 'Idée introuvable.' }, 404);
  if (['sortie', 'refusee'].includes(idea.status)) return json({ error: 'Les votes sont fermés pour cette idée.' }, 400);
  const cur = db().prepare('SELECT value FROM idea_votes WHERE idea_id = ? AND discord_id = ?').get(id, user.discord_id);
  if (cur?.value === value) db().prepare('DELETE FROM idea_votes WHERE idea_id = ? AND discord_id = ?').run(id, user.discord_id);
  else db().prepare('INSERT INTO idea_votes (idea_id, discord_id, value) VALUES (?, ?, ?) ON CONFLICT(idea_id, discord_id) DO UPDATE SET value = excluded.value').run(id, user.discord_id, value);
  // Une seule mise à jour de la carte en attente par idée
  if (!db().prepare("SELECT 1 FROM jobs WHERE type = 'idea.refresh' AND status = 'pending' AND payload = ?").get(JSON.stringify({ id }))) addJob('idea.refresh', { id });
  const c = db().prepare('SELECT SUM(value > 0) up, SUM(value < 0) down FROM idea_votes WHERE idea_id = ?').get(id);
  return json({ ok: true, up: c.up || 0, down: c.down || 0, my: cur?.value === value ? 0 : value });
}
