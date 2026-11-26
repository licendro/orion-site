// Routes de l'API de licences Orion.
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { now } from './db.js';
import {
  alertDiscord, compareSemver, createLimiter, keyFingerprint, newLicenceKey, sign, signedMessage,
  tebexSignatureOk, validKeyFormat, validSemver,
} from './util.js';

const IP_COOLDOWN = 7 * 864e5;     // le client peut changer l'IP liée 1 fois tous les 7 jours
const MULTI_IP_WINDOW = 864e5;     // alerte si > 2 IP différentes en 24 h
const KINDS = ['ajout', 'correctif', 'amelioration'];

const MESSAGES = {
  valid: 'Licence valide.',
  unknown_key: 'Clé de licence inconnue. Vérifie la clé dans ton espace client (jdev-hub.fr/compte).',
  bad_format: 'Clé de licence mal écrite. Format attendu : ORN-XXXXX-XXXXX-XXXXX-XXXXX.',
  wrong_script: 'Cette clé ne correspond pas à ce script.',
  revoked: 'Licence révoquée (remboursement, litige ou non-respect des conditions). Contacte le support Orion.',
  suspended: 'Licence suspendue le temps d’un litige de paiement. Contacte le support Orion.',
  ip_mismatch: 'Cette licence est liée à un autre serveur. Change l’IP liée depuis ton espace client (jdev-hub.fr/compte).',
  rate_limited: 'Trop de vérifications : réessaie dans une minute.',
};

export function buildApp({ db, logger = false }) {
  const app = Fastify({
    logger,
    trustProxy: '127.0.0.1',      // l'IP réelle vient de Nginx (X-Forwarded-For), jamais du client
    bodyLimit: 512 * 1024,
  });
  const limited = createLimiter();
  const site = () => (process.env.PUBLIC_SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
  const changelogUrl = (script) => `${site()}/changelog/${encodeURIComponent(script)}`;
  const event = (kind, detail) => db.prepare('INSERT INTO events (kind, detail, created_at) VALUES (?, ?, ?)').run(kind, typeof detail === 'string' ? detail : JSON.stringify(detail), now());

  // Corps brut conservé pour vérifier la signature des webhooks Tebex
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body;
    try { done(null, body ? JSON.parse(body) : {}); } catch { const e = new Error('JSON invalide'); e.statusCode = 400; done(e); }
  });

  // ---------- Santé ----------
  app.get('/v1/health', async () => ({ ok: true, time: now() }));

  // ---------- Vérification d'une licence (appelée par orn_lib au démarrage des scripts) ----------
  app.post('/v1/verify', async (req, reply) => {
    const ip = req.ip;
    const b = req.body || {};
    const key = String(b.cle || b.key || '').trim().toUpperCase();
    const script = String(b.script || '').trim().slice(0, 64);
    const version = String(b.version || '').trim().slice(0, 32);
    const nonce = String(b.nonce || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 64);
    const keyFp = keyFingerprint(key);
    const sc = script ? db.prepare('SELECT * FROM scripts WHERE name = ?').get(script) : null;
    const latest = sc?.latest_version || '';

    // Réponse toujours signée : le serveur FiveM refuse tout ce qui n'a pas une signature valide
    const respond = (code, extra = {}) => {
      const ts = Math.floor(now() / 1000);
      const status = code === 'valid' ? 'valid' : `invalid:${code}`;
      const sig = sign(signedMessage({ nonce, ts, script, status, latest, keyFp }));
      const update = latest && version && validSemver(version) && compareSemver(latest, version) > 0;
      return {
        valid: code === 'valid', code, status, message: MESSAGES[code] || code,
        latest: latest || null, update: !!update, changelog: sc ? changelogUrl(script) : null,
        nonce, ts, key_fp: keyFp, sig, ...extra,
      };
    };
    const log = (licenceId, result) => db.prepare('INSERT INTO verify_logs (licence_id, key_fp, script, version, ip, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(licenceId, keyFp, script, version, ip, result, now());

    if (!nonce || nonce.length < 8 || !script) return reply.code(400).send({ error: 'Champs requis : cle, script, version, nonce' });
    if (limited(`ip:${ip}`, 30, 60e3) || limited(`key:${keyFp}`, 10, 60e3)) {
      log(null, 'rate_limited');
      return reply.code(429).send(respond('rate_limited'));
    }
    if (!validKeyFormat(key)) { log(null, 'bad_format'); return respond('bad_format'); }

    const lic = db.prepare('SELECT * FROM licences WHERE key = ?').get(key);
    if (!lic) { log(null, 'unknown_key'); return respond('unknown_key'); }
    if (lic.script !== script) { log(lic.id, 'wrong_script'); return respond('wrong_script'); }
    if (lic.status === 'revoked') { log(lic.id, 'revoked'); return respond('revoked'); }
    if (lic.status === 'suspended') { log(lic.id, 'suspended'); return respond('suspended'); }

    // Liaison à l'IP : la première vérification lie la licence à ce serveur
    if (!lic.ip) db.prepare('UPDATE licences SET ip = ?, updated_at = ? WHERE id = ?').run(ip, now(), lic.id);
    const ok = !lic.ip || lic.ip === ip;
    log(lic.id, ok ? 'valid' : 'ip_mismatch');
    if (ok) db.prepare('UPDATE licences SET last_check_at = ?, last_version = ? WHERE id = ?').run(now(), version || null, lic.id);

    // Alerte : clé utilisée depuis plus de 2 IP en 24 h (partage ou leak probable)
    const ips = db.prepare('SELECT COUNT(DISTINCT ip) n FROM verify_logs WHERE licence_id = ? AND created_at > ?').get(lic.id, now() - MULTI_IP_WINDOW).n;
    if (ips > 2 && (!lic.alerted_at || now() - lic.alerted_at > MULTI_IP_WINDOW)) {
      db.prepare('UPDATE licences SET alerted_at = ? WHERE id = ?').run(now(), lic.id);
      event('alerte.multi_ip', { licence: lic.id, ips });
      alertDiscord('🔑 Licence utilisée depuis plusieurs IP',
        `Licence **#${lic.id}** (${lic.script}${lic.customer ? `, ${lic.customer}` : ''}${lic.discord_id ? `, <@${lic.discord_id}>` : ''}) : **${ips} IP différentes** en 24 h.\nPartage ou fuite probable. Admin → Licences pour voir les journaux et révoquer si besoin.`);
    }
    return respond(ok ? 'valid' : 'ip_mismatch');
  });

  // ---------- Changelog public ----------
  const versionRow = (v) => ({ version: v.version, date: v.created_at, kinds: v.kinds ? v.kinds.split(',').filter(Boolean) : [], notes: v.notes });
  app.get('/v1/changelog', async (req, reply) => {
    if (limited(`cl:${req.ip}`, 120, 60e3)) return reply.code(429).send({ error: 'rate_limited' });
    const scripts = db.prepare('SELECT name, title, product_key, latest_version FROM scripts ORDER BY title').all();
    const recent = db.prepare('SELECT * FROM versions ORDER BY created_at DESC LIMIT 60').all();
    return {
      scripts: scripts.map((s) => ({ name: s.name, title: s.title, product_key: s.product_key, latest: s.latest_version })),
      recent: recent.map((v) => ({ script: v.script, ...versionRow(v) })),
    };
  });
  app.get('/v1/changelog/:script', async (req, reply) => {
    if (limited(`cl:${req.ip}`, 120, 60e3)) return reply.code(429).send({ error: 'rate_limited' });
    const s = db.prepare('SELECT name, title, product_key, latest_version FROM scripts WHERE name = ?').get(req.params.script);
    if (!s) return reply.code(404).send({ error: 'Script inconnu' });
    // Triées par numéro de version (la plus récente en haut), même si une ancienne a été ajoutée après coup
    const versions = db.prepare('SELECT * FROM versions WHERE script = ?').all(s.name).sort((a, b) => compareSemver(b.version, a.version));
    return { script: { name: s.name, title: s.title, product_key: s.product_key, latest: s.latest_version }, versions: versions.map(versionRow) };
  });

  // ---------- Webhook Tebex (direct, ou transféré tel quel par le site) ----------
  app.post('/v1/webhooks/tebex', async (req, reply) => {
    const raw = req.rawBody || '';
    if (!tebexSignatureOk(raw, req.headers['x-signature'])) {
      event('webhook.signature_invalide', req.ip);
      return reply.code(403).send({ error: 'signature' });
    }
    const body = req.body || {};
    if (body.type === 'validation.webhook') return { id: body.id };
    const s = body.subject || {};
    const tx = s.transaction_id;
    if (!tx) return { ok: true };

    switch (body.type) {
      case 'payment.completed': {
        const custom = typeof s.custom === 'string' ? safeJson(s.custom) : s.custom || {};
        const discordId = custom?.discord_id ? String(custom.discord_id) : null;
        const customer = s.customer?.username?.username || null;
        const created = createFromPayment({ tx, products: s.products || [], discordId, customer });
        event('webhook.paiement', { tx, licences: created.length });
        return { ok: true, created: created.length };
      }
      case 'payment.refunded':
      case 'payment.dispute.lost':
        setStatusByTx(tx, 'revoked', body.type === 'payment.refunded' ? 'Remboursement' : 'Litige perdu (chargeback)');
        return { ok: true };
      case 'payment.dispute.opened':
        setStatusByTx(tx, 'suspended', 'Litige de paiement ouvert', ['active']);
        return { ok: true };
      case 'payment.dispute.won':
      case 'payment.dispute.closed':
        setStatusByTx(tx, 'active', null, ['suspended']);
        return { ok: true };
      default:
        return { ok: true };
    }
  });

  // Crée les licences d'un paiement (idempotent : un webhook rejoué ne crée rien en double)
  function createFromPayment({ tx, products, discordId, customer }) {
    const scripts = db.prepare('SELECT name, title, tebex_ids FROM scripts').all();
    const out = [];
    const ins = db.prepare(`INSERT OR IGNORE INTO licences (key, script, discord_id, customer, tebex_tx, tebex_package, seq, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'tebex', ?, ?)`);
    db.transaction(() => {
      for (const p of products) {
        const pid = String(p.id);
        const pname = String(p.name || '').toLowerCase();
        // Scripts donnés par ce package : par id (packs compris), sinon par nom
        let targets = scripts.filter((sc) => sc.tebex_ids.split(',').map((x) => x.trim()).includes(pid));
        if (!targets.length) targets = scripts.filter((sc) => sc.name.toLowerCase() === pname || sc.title.toLowerCase() === pname);
        for (const sc of targets) {
          for (let q = 0; q < Math.max(1, Number(p.quantity) || 1); q++) {
            const r = ins.run(newLicenceKey(), sc.name, discordId, customer, tx, pid, q, now(), now());
            if (r.changes) out.push({ id: Number(r.lastInsertRowid), script: sc.name });
          }
        }
      }
    })();
    return out;
  }
  function setStatusByTx(tx, status, reason, onlyFrom = null) {
    const where = onlyFrom ? ` AND status IN (${onlyFrom.map(() => '?').join(',')})` : '';
    const r = db.prepare(`UPDATE licences SET status = ?, reason = ?, updated_at = ? WHERE tebex_tx = ?${where}`).run(status, reason, now(), tx, ...(onlyFrom || []));
    event('webhook.statut', { tx, status, n: r.changes });
    if (r.changes && status !== 'active') alertDiscord('🔒 Licences bloquées', `${r.changes} licence(s) de la transaction ${tx} : **${status === 'revoked' ? 'révoquées' : 'suspendues'}** (${reason}).`);
  }

  // ---------- Administration (appelée par le site uniquement, jeton secret) ----------
  app.register(async (admin) => {
    admin.addHook('onRequest', async (req, reply) => {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const expected = process.env.ADMIN_TOKEN || '';
      const ok = expected.length >= 32 && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
      if (!ok) return reply.code(401).send({ error: 'Non autorisé' });
    });

    const pub = (l) => ({
      id: l.id, key: l.key, script: l.script, title: l.title, discord_id: l.discord_id, customer: l.customer, status: l.status, reason: l.reason,
      ip: l.ip, ip_changed_at: l.ip_changed_at, next_ip_change: l.ip_changed_at ? l.ip_changed_at + IP_COOLDOWN : null,
      source: l.source, note: l.note, tebex_tx: l.tebex_tx, last_check_at: l.last_check_at, last_version: l.last_version,
      latest: l.latest_version, created_at: l.created_at,
    });

    admin.get('/licences', async (req) => {
      const q = req.query || {};
      const where = [], args = [];
      if (q.discord) { where.push('l.discord_id = ?'); args.push(String(q.discord)); }
      if (q.script) { where.push('l.script = ?'); args.push(String(q.script)); }
      if (q.status) { where.push('l.status = ?'); args.push(String(q.status)); }
      if (q.q) { where.push('(l.key LIKE ? OR l.customer LIKE ? OR l.discord_id = ? OR l.tebex_tx = ?)'); args.push(`%${q.q}%`, `%${q.q}%`, String(q.q), String(q.q)); }
      const rows = db.prepare(`SELECT l.*, s.title, s.latest_version FROM licences l LEFT JOIN scripts s ON s.name = l.script
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY l.id DESC LIMIT ${Math.min(Number(q.limit) || 200, 500)}`).all(...args);
      return { licences: rows.map(pub) };
    });

    admin.post('/licences', async (req, reply) => {
      const b = req.body || {};
      const sc = db.prepare('SELECT name FROM scripts WHERE name = ?').get(String(b.script || ''));
      if (!sc) return reply.code(400).send({ error: 'Script inconnu : ajoute-le d’abord.' });
      const key = newLicenceKey();
      const r = db.prepare(`INSERT INTO licences (key, script, discord_id, customer, source, note, seq, tebex_tx, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'manuel', ?, 0, ?, ?, ?)`).run(key, sc.name, b.discord_id ? String(b.discord_id).replace(/\D/g, '') || null : null,
        b.customer ? String(b.customer).slice(0, 80) : null, b.note ? String(b.note).slice(0, 300) : null, `manuel-${crypto.randomUUID()}`, now(), now());
      event('admin.licence_creee', { id: Number(r.lastInsertRowid), by: b.by || null });
      return { licence: pub(db.prepare('SELECT l.*, s.title, s.latest_version FROM licences l LEFT JOIN scripts s ON s.name = l.script WHERE l.id = ?').get(r.lastInsertRowid)) };
    });

    admin.post('/licences/:id/status', async (req, reply) => {
      const status = String(req.body?.status || '');
      if (!['active', 'suspended', 'revoked'].includes(status)) return reply.code(400).send({ error: 'Statut invalide' });
      const r = db.prepare('UPDATE licences SET status = ?, reason = ?, updated_at = ? WHERE id = ?').run(status, req.body?.reason ? String(req.body.reason).slice(0, 200) : null, now(), Number(req.params.id));
      if (!r.changes) return reply.code(404).send({ error: 'Licence introuvable' });
      event('admin.statut', { id: Number(req.params.id), status, by: req.body?.by || null });
      return { ok: true };
    });

    // Changer l'IP liée. by=client : 1 fois tous les 7 jours, et seulement sur ses propres licences.
    admin.post('/licences/:id/ip', async (req, reply) => {
      const b = req.body || {};
      const l = db.prepare('SELECT * FROM licences WHERE id = ?').get(Number(req.params.id));
      if (!l) return reply.code(404).send({ error: 'Licence introuvable' });
      const ip = b.ip ? String(b.ip).trim() : null;
      if (ip && !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return reply.code(400).send({ error: 'Adresse IP invalide' });
      if (b.by === 'client') {
        if (!b.discord_id || l.discord_id !== String(b.discord_id)) return reply.code(403).send({ error: 'Cette licence n’est pas à toi.' });
        if (l.ip_changed_at && now() - l.ip_changed_at < IP_COOLDOWN) {
          return reply.code(429).send({ error: 'Tu as déjà changé l’IP cette semaine.', next: l.ip_changed_at + IP_COOLDOWN });
        }
      }
      db.prepare('UPDATE licences SET ip = ?, ip_changed_at = ?, alerted_at = NULL, updated_at = ? WHERE id = ?')
        .run(ip, b.by === 'client' ? now() : l.ip_changed_at, now(), l.id);
      event('licence.ip', { id: l.id, by: b.by || 'admin' });
      return { ok: true, ip, next_ip_change: b.by === 'client' ? now() + IP_COOLDOWN : l.ip_changed_at ? l.ip_changed_at + IP_COOLDOWN : null };
    });

    admin.get('/licences/:id/logs', async (req) => ({
      logs: db.prepare('SELECT script, version, ip, result, created_at FROM verify_logs WHERE licence_id = ? ORDER BY id DESC LIMIT 100').all(Number(req.params.id)),
    }));

    // Scripts
    admin.get('/scripts', async () => ({
      scripts: db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM licences l WHERE l.script = s.name AND l.status = 'active') active_licences
        FROM scripts s ORDER BY s.title`).all(),
    }));
    admin.post('/scripts', async (req, reply) => {
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!/^[a-zA-Z0-9_-]{2,64}$/.test(name)) return reply.code(400).send({ error: 'Nom de ressource invalide (lettres, chiffres, _ et -).' });
      const title = String(b.title || name).trim().slice(0, 80);
      const ids = String(b.tebex_ids || '').split(/[\s,;]+/).filter((x) => /^\d+$/.test(x)).join(',');
      db.prepare(`INSERT INTO scripts (name, title, product_key, tebex_ids, created_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET title = excluded.title, product_key = excluded.product_key, tebex_ids = excluded.tebex_ids`)
        .run(name, title, b.product_key ? String(b.product_key).slice(0, 80) : null, ids, now());
      event('admin.script', { name, by: b.by || null });
      return { ok: true };
    });

    // Publier une version : met à jour la « dernière version » si elle est plus récente
    admin.post('/versions', async (req, reply) => {
      const b = req.body || {};
      const sc = db.prepare('SELECT * FROM scripts WHERE name = ?').get(String(b.script || ''));
      if (!sc) return reply.code(400).send({ error: 'Script inconnu' });
      const version = String(b.version || '').trim().replace(/^v/i, '');
      if (!validSemver(version)) return reply.code(400).send({ error: 'Version invalide : utilise le format 1.4.2' });
      const kinds = (Array.isArray(b.kinds) ? b.kinds : String(b.kinds || '').split(',')).map((k) => String(k).trim()).filter((k) => KINDS.includes(k));
      try {
        db.prepare('INSERT INTO versions (script, version, kinds, notes, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(sc.name, version, kinds.join(','), String(b.notes || '').slice(0, 20000), Number(b.created_at) || now());
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) return reply.code(409).send({ error: `La version ${version} existe déjà pour ${sc.title}.` });
        throw e;
      }
      if (!sc.latest_version || compareSemver(version, sc.latest_version) > 0) db.prepare('UPDATE scripts SET latest_version = ? WHERE name = ?').run(version, sc.name);
      event('admin.version', { script: sc.name, version, by: b.by || null });
      return { ok: true, latest: db.prepare('SELECT latest_version FROM scripts WHERE name = ?').get(sc.name).latest_version, changelog: changelogUrl(sc.name) };
    });

    admin.get('/stats', async () => ({
      licences: db.prepare("SELECT status, COUNT(*) n FROM licences GROUP BY status").all(),
      checks_24h: db.prepare('SELECT result, COUNT(*) n FROM verify_logs WHERE created_at > ? GROUP BY result').all(now() - 864e5),
      events: db.prepare('SELECT kind, detail, created_at FROM events ORDER BY id DESC LIMIT 30').all(),
    }));

    // RGPD : un membre supprime son compte sur le site → on détache ses licences (elles restent valables)
    admin.post('/forget/:discord', async (req) => {
      const r = db.prepare('UPDATE licences SET discord_id = NULL, customer = NULL, updated_at = ? WHERE discord_id = ?').run(now(), String(req.params.discord));
      return { ok: true, n: r.changes };
    });
  }, { prefix: '/v1/admin' });

  app.setErrorHandler((err, req, reply) => {
    req.log?.error?.(err);
    reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).send({ error: err.statusCode && err.statusCode < 500 ? err.message : 'Erreur interne' });
  });

  return app;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

// Purge RGPD : IP des journaux gardées 30 jours, évènements 1 an
export function purge(db) {
  const a = db.prepare('DELETE FROM verify_logs WHERE created_at < ?').run(now() - 30 * 864e5).changes;
  const b = db.prepare('DELETE FROM events WHERE created_at < ?').run(now() - 365 * 864e5).changes;
  return { logs: a, events: b };
}
