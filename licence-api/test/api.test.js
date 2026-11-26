// Tests de l'API : node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { openDb } from '../src/db.js';
import { buildApp } from '../src/app.js';
import { loadSigningKey, signedMessage } from '../src/util.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
process.env.SIGNING_KEY = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
process.env.ADMIN_TOKEN = 'x'.repeat(40);
process.env.TEBEX_WEBHOOK_SECRET = 'secret';
loadSigningKey();
const db = openDb(':memory:');
const app = buildApp({ db });
const auth = { authorization: `Bearer ${'x'.repeat(40)}` };
const tebexSig = (raw) => crypto.createHmac('sha256', 'secret').update(crypto.createHash('sha256').update(raw).digest('hex')).digest('hex');
const verifySig = (r) => crypto.verify(null, Buffer.from(signedMessage({ nonce: r.nonce, ts: r.ts, script: 'orn_garage', status: r.status, latest: r.latest, keyFp: r.key_fp })), publicKey, Buffer.from(r.sig, 'hex'));
const verify = (key, ip = '1.1.1.1', version = '1.0.0') => app.inject({ method: 'POST', url: '/v1/verify', remoteAddress: ip, payload: { cle: key, script: 'orn_garage', version, nonce: crypto.randomBytes(8).toString('hex') } }).then((r) => r.json());

test('parcours complet', async () => {
  let r = await app.inject({ method: 'POST', url: '/v1/admin/scripts', headers: auth, payload: { name: 'orn_garage', title: 'orn_garage', tebex_ids: '123, 999' } });
  assert.equal(r.statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/admin/scripts', payload: { name: 'x' } })).statusCode, 401);
  r = await app.inject({ method: 'POST', url: '/v1/admin/versions', headers: auth, payload: { script: 'orn_garage', version: '1.2.0', kinds: ['ajout', 'correctif'], notes: '- fix' } });
  assert.equal(r.json().latest, '1.2.0');
  await app.inject({ method: 'POST', url: '/v1/admin/versions', headers: auth, payload: { script: 'orn_garage', version: '1.1.0', notes: 'vieux' } });
  assert.equal(db.prepare('SELECT latest_version v FROM scripts').get().v, '1.2.0');

  // Webhook Tebex signé → licence créée, rejouer ne duplique pas
  const raw = JSON.stringify({ type: 'payment.completed', subject: { transaction_id: 'tbx-1', custom: { discord_id: '42' }, customer: { username: { username: 'julien' } }, products: [{ id: 123, name: 'orn_garage', quantity: 1 }] } });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/webhooks/tebex', headers: { 'content-type': 'application/json', 'x-signature': 'bad' }, payload: raw })).statusCode, 403);
  for (let i = 0; i < 2; i++) await app.inject({ method: 'POST', url: '/v1/webhooks/tebex', headers: { 'content-type': 'application/json', 'x-signature': tebexSig(raw) }, payload: raw });
  const lic = db.prepare('SELECT * FROM licences').all();
  assert.equal(lic.length, 1);
  assert.equal(lic[0].discord_id, '42');

  // Vérification : valide + signature correcte + mise à jour signalée
  let v = await verify(lic[0].key);
  assert.equal(v.valid, true); assert.equal(v.update, true); assert.ok(verifySig(v));
  assert.equal(db.prepare('SELECT ip FROM licences').get().ip, '1.1.1.1');
  // Autre IP → refus signé
  v = await verify(lic[0].key, '2.2.2.2');
  assert.equal(v.code, 'ip_mismatch'); assert.ok(verifySig(v));
  await verify(lic[0].key, '3.3.3.3');
  assert.ok(db.prepare("SELECT 1 FROM events WHERE kind = 'alerte.multi_ip'").get());
  // Réponse falsifiée → signature invalide
  assert.equal(verifySig({ ...v, status: 'valid' }), false);

  // Client change l'IP (1 fois / 7 j)
  r = await app.inject({ method: 'POST', url: `/v1/admin/licences/${lic[0].id}/ip`, headers: auth, payload: { ip: null, by: 'client', discord_id: '42' } });
  assert.equal(r.statusCode, 200);
  r = await app.inject({ method: 'POST', url: `/v1/admin/licences/${lic[0].id}/ip`, headers: auth, payload: { ip: null, by: 'client', discord_id: '42' } });
  assert.equal(r.statusCode, 429);
  r = await app.inject({ method: 'POST', url: `/v1/admin/licences/${lic[0].id}/ip`, headers: auth, payload: { by: 'client', discord_id: '7' } });
  assert.equal(r.statusCode, 403);
  assert.equal((await verify(lic[0].key, '2.2.2.2')).valid, true);

  // Remboursement → révoquée
  const ref = JSON.stringify({ type: 'payment.refunded', subject: { transaction_id: 'tbx-1' } });
  await app.inject({ method: 'POST', url: '/v1/webhooks/tebex', headers: { 'content-type': 'application/json', 'x-signature': tebexSig(ref) }, payload: ref });
  assert.equal((await verify(lic[0].key, '2.2.2.2')).code, 'revoked');

  // Changelog public
  const cl = (await app.inject({ url: '/v1/changelog/orn_garage' })).json();
  assert.equal(cl.versions[0].version, '1.2.0'); assert.deepEqual(cl.versions[0].kinds, ['ajout', 'correctif']);
  // Clé inconnue / mauvais format
  assert.equal((await verify('ORN-AAAAA-AAAAA-AAAAA-AAAAA')).code, 'unknown_key');
  assert.equal((await verify('nimporte')).code, 'bad_format');
});
