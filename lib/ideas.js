import { db } from './db';

const BASE = `SELECT i.id, i.title, i.description, i.kind, i.status, i.note, i.author_name, i.thread_id, i.released_key, i.created_at, i.updated_at,
  p.name product, r.name released_name, r.key released_k,
  (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id AND v.value > 0) up,
  (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id AND v.value < 0) down
  FROM ideas i LEFT JOIN products p ON p.key = i.product_key LEFT JOIN products r ON r.key = i.released_key`;

export function listIdeas(userId) {
  const rows = db().prepare(`${BASE} ORDER BY i.id DESC LIMIT 400`).all();
  const mine = userId ? Object.fromEntries(db().prepare('SELECT idea_id, value FROM idea_votes WHERE discord_id = ?').all(userId).map((r) => [r.idea_id, r.value])) : {};
  return rows.map((x) => ({ ...x, score: x.up - x.down, my: mine[x.id] || 0 }));
}
export const ideasOf = (discordId) => db().prepare(`${BASE} WHERE i.author_id = ? ORDER BY i.id DESC LIMIT 30`).all(discordId);
