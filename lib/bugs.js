import { db } from './db';
import { KNOWN } from '../db/bugs.mjs';

// Bugs connus (publics) : titre, script, statut. Jamais le nom du client ni la description.
export function knownBugs(productKey) {
  const q = KNOWN.map(() => '?').join(',');
  return db().prepare(`SELECT b.id, b.title, b.status, b.severity, b.fixed_version, b.product_key, b.updated_at, p.name product
    FROM bugs b LEFT JOIN products p ON p.key = b.product_key WHERE b.status IN (${q}) ${productKey ? 'AND b.product_key = ?' : ''}
    ORDER BY CASE b.severity WHEN 'critique' THEN 0 WHEN 'genant' THEN 1 ELSE 2 END, b.id DESC`).all(...KNOWN, ...(productKey ? [productKey] : []));
}
export function recentFixes(limit = 12) {
  return db().prepare(`SELECT b.id, b.title, b.fixed_version, b.updated_at, p.name product FROM bugs b LEFT JOIN products p ON p.key = b.product_key
    WHERE b.status = 'publie' ORDER BY b.updated_at DESC LIMIT ?`).all(limit);
}
// Bugs signalés ou suivis par un membre
export function bugsOf(discordId) {
  return db().prepare(`SELECT DISTINCT b.id, b.title, b.status, b.fixed_version, b.updated_at, p.name product FROM bugs b
    LEFT JOIN products p ON p.key = b.product_key LEFT JOIN bug_followers f ON f.bug_id = b.id
    WHERE b.reporter_id = ? OR f.discord_id = ? ORDER BY b.updated_at DESC LIMIT 30`).all(discordId, discordId);
}
