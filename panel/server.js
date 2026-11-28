// ============================================================================
//  Panneau de gestion du VPS (Orion)
//  Applications pm2 (démarrer, arrêter, mémoire, journaux, mises à jour), état du serveur,
//  explorateur de fichiers, alertes Discord. Écoute sur 127.0.0.1 : on y accède via Nginx + HTTPS.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Fastify from 'fastify';
import { audit, config, readAudit, saveConfig } from './src/config.js';
import { check, hashPassword, login, logout } from './src/auth.js';
import { action, apps, deploy, gitInfo, job, runningJobs, setMemory, systemStats } from './src/system.js';
import * as files from './src/files.js';
import { events, history, send, startMonitor } from './src/monitor.js';

const run = promisify(execFile);
const PUBLIC = new URL('./public/', import.meta.url).pathname;
const c0 = config();
if (!c0.auth.hash) { console.error('Panneau non configuré : lance d’abord « npm run setup ».'); process.exit(1); }

const app = Fastify({ trustProxy: '127.0.0.1', bodyLimit: 1024 * 1024 });
app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 100 * 1024 * 1024 }, (req, body, done) => done(null, body));

const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((x) => x.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const COOKIE = 'orion_panel';

// En-têtes de sécurité sur toutes les réponses
app.addHook('onSend', async (req, reply, payload) => {
  reply.header('X-Frame-Options', 'DENY').header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer')
    .header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
    .header('Cache-Control', 'no-store');
  return payload;
});

// Toute l'API (sauf la connexion) exige une session ; les actions exigent l'en-tête X-Panel (anti-CSRF)
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/api/') || req.url.startsWith('/api/login')) return;
  if (!check(cookies(req)[COOKIE])) return reply.code(401).send({ error: 'Session expirée, reconnecte-toi.' });
  if (req.method !== 'GET' && req.headers['x-panel'] !== '1') return reply.code(403).send({ error: 'Requête refusée' });
});

const fail = (reply, e, code = 400) => reply.code(code).send({ error: e.message || String(e) });

// ---------- Pages ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
app.get('/', (req, reply) => reply.type(TYPES['.html']).send(fs.readFileSync(path.join(PUBLIC, 'index.html'))));
app.get('/assets/:file', (req, reply) => {
  const f = path.join(PUBLIC, path.basename(req.params.file));
  if (!fs.existsSync(f)) return reply.code(404).send('');
  reply.type(TYPES[path.extname(f)] || 'application/octet-stream').send(fs.readFileSync(f));
});

// ---------- Connexion ----------
app.post('/api/login', async (req, reply) => {
  const r = login(req.body || {}, req.ip);
  if (r.error) { audit('connexion.echec', req.ip); return fail(reply, r.error, 401); }
  audit('connexion', req.ip);
  reply.header('Set-Cookie', `${COOKIE}=${r.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
  return { ok: true };
});
app.post('/api/logout', async (req, reply) => {
  logout(cookies(req)[COOKIE]);
  reply.header('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return { ok: true };
});
app.get('/api/me', async () => ({ user: config().auth.user, twofa: !!config().auth.totp }));

// ---------- Vue d'ensemble ----------
app.get('/api/overview', async (req, reply) => {
  try {
    const [system, list] = await Promise.all([systemStats(), apps()]);
    return { system, apps: list, history: history(), jobs: runningJobs().map((j) => ({ id: j.id, name: j.name })) };
  } catch (e) { return fail(reply, e, 500); }
});

// ---------- Applications ----------
const findApp = async (name) => { const a = (await apps()).find((x) => x.name === name); if (!a) throw new Error('Application introuvable dans pm2'); return a; };

app.post('/api/apps/:name/:act', async (req, reply) => {
  try { await action(req.params.name, req.params.act); audit(`app.${req.params.act}`, req.params.name); return { ok: true }; } catch (e) { return fail(reply, e); }
});
app.post('/api/apps/:name/memory', async (req, reply) => {
  try {
    await setMemory(req.params.name, req.body?.mb);
    audit('app.memoire', `${req.params.name} → ${req.body?.mb} Mo`);
    return { ok: true };
  } catch (e) { return fail(reply, e); }
});
app.post('/api/apps/:name/deploy', async (req, reply) => {
  try {
    const j = await deploy(req.params.name);
    audit('app.mise_a_jour', req.params.name);
    return { id: j.id };
  } catch (e) { return fail(reply, e); }
});
app.get('/api/jobs/:id', async (req, reply) => {
  const j = job(req.params.id);
  return j ? { status: j.status, out: j.out, code: j.code, started: j.started, ended: j.ended, cmd: j.cmd } : fail(reply, new Error('Tâche introuvable'), 404);
});
app.get('/api/apps/:name/git', async (req, reply) => {
  try { const a = await findApp(req.params.name); return { git: await gitInfo(a.cwd) }; } catch (e) { return fail(reply, e); }
});

// Journaux : lecture de la fin du fichier, puis suite en direct à partir d'une position
app.get('/api/apps/:name/logs', async (req, reply) => {
  try {
    const a = await findApp(req.params.name);
    const file = req.query.type === 'err' ? a.errLog : a.outLog;
    if (!file || !fs.existsSync(file)) return { content: '', offset: 0, size: 0 };
    const size = fs.statSync(file).size;
    let start = req.query.offset != null ? Number(req.query.offset) : Math.max(0, size - 64 * 1024);
    if (start > size) start = 0; // fichier vidé entre-temps
    const len = Math.min(size - start, 256 * 1024);
    const buf = Buffer.alloc(len);
    if (len) { const fd = fs.openSync(file, 'r'); fs.readSync(fd, buf, 0, len, start); fs.closeSync(fd); }
    return { content: buf.toString('utf8'), offset: start + len, size, file };
  } catch (e) { return fail(reply, e); }
});
app.get('/api/apps/:name/logs/download', async (req, reply) => {
  try {
    const a = await findApp(req.params.name);
    const file = req.query.type === 'err' ? a.errLog : a.outLog;
    reply.header('Content-Disposition', `attachment; filename="${a.name}-${req.query.type === 'err' ? 'erreurs' : 'sortie'}.log"`).type('text/plain; charset=utf-8');
    return reply.send(fs.createReadStream(file));
  } catch (e) { return fail(reply, e); }
});
app.post('/api/apps/:name/logs/flush', async (req, reply) => {
  try { await findApp(req.params.name); await run(process.env.PM2_BIN || 'pm2', ['flush', req.params.name], { timeout: 20000 }); audit('app.journaux_vides', req.params.name); return { ok: true }; }
  catch (e) { return fail(reply, e); }
});

// ---------- Fichiers ----------
const safe = (fn) => async (req, reply) => { try { return await fn(req, reply); } catch (e) { return fail(reply, e); } };
app.get('/api/files/roots', safe(async () => ({ roots: files.roots() })));
app.get('/api/files', safe(async (req) => files.list(req.query.path || config().roots[0])));
app.get('/api/file', safe(async (req) => files.read(req.query.path)));
app.put('/api/file', safe(async (req) => { const m = files.write(req.body.path, req.body.content, req.body.mtime); audit('fichier.modifie', req.body.path); return { ok: true, mtime: m }; }));
app.post('/api/files/mkdir', safe(async (req) => { const d = files.mkdir(req.body.path); audit('fichier.dossier', d); return { ok: true, path: d }; }));
app.post('/api/files/rename', safe(async (req) => { const d = files.rename(req.body.path, req.body.name); audit('fichier.renomme', `${req.body.path} → ${d}`); return { ok: true, path: d }; }));
app.delete('/api/file', safe(async (req) => { const d = files.remove(req.query.path); audit('fichier.supprime', req.query.path); return { ok: true, trash: d }; }));
app.post('/api/files/upload', safe(async (req) => { const f = files.saveUpload(req.query.dir, req.query.name, req.body); audit('fichier.envoye', f); return { ok: true, path: f }; }));
app.get('/api/files/download', safe(async (req, reply) => {
  const f = files.resolveSafe(req.query.path);
  if (fs.statSync(f).isDirectory()) throw new Error('Télécharge les fichiers un par un');
  audit('fichier.telecharge', f);
  reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(f))}"`).type('application/octet-stream');
  return reply.send(fs.createReadStream(f));
}));
app.get('/api/trash', safe(async () => ({ items: files.trash() })));
app.post('/api/trash/restore', safe(async (req) => { const d = files.restore(req.body.name); audit('fichier.restaure', d); return { ok: true, path: d }; }));

// ---------- Alertes, journal, réglages ----------
app.get('/api/alerts', async () => ({ events, webhook: !!config().alerts.webhook }));
app.post('/api/alerts/test', async () => ({ sent: await send('✅ Test du panneau', 'Les alertes du panneau VPS arrivent bien ici.', 'ok') }));
app.get('/api/audit', async () => ({ items: readAudit() }));

app.get('/api/settings', async () => {
  const c = config();
  return { roots: c.roots, apps: c.apps, backupsDir: c.backupsDir, alerts: { ...c.alerts, webhook: c.alerts.webhook ? '••••••' + c.alerts.webhook.slice(-6) : '' } };
});
app.put('/api/settings', safe(async (req) => {
  const b = req.body || {};
  const c = config();
  const roots = (Array.isArray(b.roots) ? b.roots : []).map((r) => String(r).trim()).filter((r) => r.startsWith('/') && r !== '/');
  if (!roots.length) throw new Error('Ajoute au moins un dossier (chemin absolu, pas « / »).');
  const appsMeta = {};
  for (const [name, m] of Object.entries(b.apps || {})) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(name)) continue;
    appsMeta[name] = { label: String(m.label || name).slice(0, 60), url: String(m.url || '').slice(0, 300), deploy: String(m.deploy || '').slice(0, 500), group: String(m.group || 'Autres').slice(0, 40) };
  }
  const a = b.alerts || {};
  const webhook = a.webhook && !String(a.webhook).startsWith('••') ? String(a.webhook).trim() : c.alerts.webhook;
  if (webhook && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhook)) throw new Error('Le webhook doit être une adresse Discord (https://discord.com/api/webhooks/…).');
  saveConfig({ ...c, roots, apps: appsMeta, backupsDir: String(b.backupsDir || c.backupsDir), alerts: {
    webhook, memoryPct: Number(a.memoryPct) || 90, systemMemPct: Number(a.systemMemPct) || 90, diskPct: Number(a.diskPct) || 85,
    dailyReport: !!a.dailyReport, reportHour: Math.min(23, Math.max(0, Number(a.reportHour) || 9)),
  } });
  audit('reglages', 'modifiés');
  return { ok: true };
}));
app.post('/api/password', safe(async (req) => {
  const { current, next } = req.body || {};
  const c = config();
  const cur = hashPassword(current, c.auth.salt);
  if (cur.hash !== c.auth.hash) throw new Error('Mot de passe actuel incorrect');
  if (String(next || '').length < 12) throw new Error('12 caractères minimum');
  saveConfig({ ...c, auth: { ...c.auth, ...hashPassword(next) } });
  audit('mot_de_passe', 'changé');
  return { ok: true };
}));

app.setErrorHandler((err, req, reply) => reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).send({ error: err.statusCode < 500 ? err.message : 'Erreur interne' }));

setInterval(files.purgeTrash, 6 * 3600e3).unref();
startMonitor();
const { port, host } = config();
app.listen({ port: Number(process.env.PORT || port), host: process.env.HOST || host }).then(() => console.log(`Panneau VPS sur http://${process.env.HOST || host}:${process.env.PORT || port}`));
