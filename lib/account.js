import { addJob, audit, db } from './db';

// Droit d'accès et de portabilité : tout ce que le site sait sur un membre
export function exportData(user) {
  const d = db();
  const id = user.discord_id;
  const orders = d.prepare('SELECT id, tebex_tx, total, currency, status, created_at FROM orders WHERE user_id = ? OR discord_id = ?').all(user.id, id);
  const items = orders.length ? d.prepare(`SELECT order_id, product_key, name, price FROM order_items WHERE order_id IN (${orders.map(() => '?').join(',')})`).all(...orders.map((o) => o.id)) : [];
  return {
    exporte_le: new Date().toISOString(),
    compte: { discord_id: id, pseudo: user.username, avatar: user.avatar, cree_le: user.created_at, derniere_connexion: user.last_login },
    commandes: orders.map((o) => ({ ...o, produits: items.filter((i) => i.order_id === o.id) })),
    acceptations_cgv: d.prepare('SELECT cgv_version, items, waiver, created_at FROM checkout_consents WHERE discord_id = ?').all(id),
    abonnements: d.prepare('SELECT name, status, created_at, updated_at FROM subscriptions WHERE discord_id = ?').all(id),
    devis: d.prepare('SELECT type, framework, budget, message, status, created_at FROM quotes WHERE discord_id = ?').all(id),
    idees: d.prepare('SELECT id, title, description, status, created_at FROM ideas WHERE author_id = ?').all(id),
    votes: d.prepare('SELECT idea_id, value, created_at FROM idea_votes WHERE discord_id = ?').all(id),
    bugs_signales: d.prepare('SELECT id, title, status, created_at FROM bugs WHERE reporter_id = ?').all(id),
    bugs_suivis: d.prepare('SELECT bug_id FROM bug_followers WHERE discord_id = ?').all(id),
    serveur_de_test: d.prepare('SELECT status, starts_at, ends_at, created_at FROM test_sessions WHERE discord_id = ?').all(id),
    avertissements: d.prepare('SELECT reason, created_at FROM warnings WHERE discord_id = ?').all(id),
    note: 'Les messages de tickets et de Discord sont hébergés par Discord : demandez-nous leur copie par ticket si besoin.',
  };
}

// Droit à l'effacement. Les commandes restent (obligation comptable) mais sont détachées du compte.
export function deleteAccount(user) {
  const d = db();
  const id = user.discord_id;
  d.transaction(() => {
    d.prepare('UPDATE orders SET user_id = NULL, discord_id = NULL WHERE user_id = ? OR discord_id = ?').run(user.id, id);
    d.prepare('UPDATE checkout_consents SET discord_id = NULL WHERE discord_id = ?').run(id);
    d.prepare('UPDATE subscriptions SET discord_id = NULL WHERE discord_id = ?').run(id);
    d.prepare('DELETE FROM quotes WHERE discord_id = ?').run(id);
    d.prepare("UPDATE ideas SET author_id = NULL, author_name = 'Ancien membre' WHERE author_id = ?").run(id);
    d.prepare('DELETE FROM idea_votes WHERE discord_id = ?').run(id);
    d.prepare('UPDATE bugs SET reporter_id = NULL WHERE reporter_id = ?').run(id);
    d.prepare('DELETE FROM bug_followers WHERE discord_id = ?').run(id);
    d.prepare('DELETE FROM test_sessions WHERE discord_id = ?').run(id);
    d.prepare('DELETE FROM warnings WHERE discord_id = ?').run(id);
    d.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    d.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  })();
  addJob('account.deleted', { discord_id: id });
  audit('membre', 'compte.supprimé', null, null); // aucune donnée personnelle dans le journal
}

// Durées de conservation (lancé une fois par jour par /api/monitor)
export function purgeOld() {
  const d = db();
  const r = {};
  const run = (k, sql) => { r[k] = d.prepare(sql).run().changes; };
  run('sessions', `DELETE FROM sessions WHERE expires_at < ${Date.now()}`);
  run('comptes_inactifs', `DELETE FROM users WHERE COALESCE(last_login, created_at) < datetime('now', '-3 years')
    AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id OR o.discord_id = users.discord_id)`);
  run('details_tebex', "UPDATE orders SET raw = NULL WHERE raw IS NOT NULL AND created_at < datetime('now', '-1 year')");
  run('devis', "DELETE FROM quotes WHERE created_at < datetime('now', '-3 years')");
  run('preuves_cgv', "DELETE FROM checkout_consents WHERE created_at < datetime('now', '-5 years')");
  run('journal', "DELETE FROM audit_logs WHERE created_at < datetime('now', '-1 year')");
  run('taches', "DELETE FROM jobs WHERE status IN ('done','error') AND created_at < datetime('now', '-90 days')");
  run('essais', "DELETE FROM test_sessions WHERE created_at < datetime('now', '-1 year')");
  run('avertissements', "DELETE FROM warnings WHERE created_at < datetime('now', '-1 year')");
  return r;
}
