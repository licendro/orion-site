import { db } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { apiKey, processQueue } from '../../../../lib/testserver';

export const dynamic = 'force-dynamic';

// Liste des créneaux actifs : la ressource FiveM l'interroge pour déconnecter les créneaux terminés.
export async function GET(req) {
  if (req.headers.get('x-orion-key') !== apiKey()) return json({ error: 'clé' }, 401);
  processQueue();
  const rows = db().prepare("SELECT discord_id, ends_at FROM test_sessions WHERE status = 'active'").all();
  return json({ now: Date.now(), active: rows.map((r) => ({ discord: r.discord_id, endsAt: r.ends_at })) });
}
