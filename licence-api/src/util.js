// Outils : signature Ed25519, clés de licence, semver, limiteur de débit, alertes Discord.
import crypto from 'node:crypto';

// ---------- Signature des réponses ----------
// Message signé (texte, une valeur par ligne) : le module Lua le reconstruit à l'identique.
//   orion-licence-v1 \n nonce \n horodatage \n script \n statut \n dernière version \n empreinte de la clé
export function signedMessage({ nonce, ts, script, status, latest, keyFp }) {
  return ['orion-licence-v1', nonce, String(ts), script, status, latest || '', keyFp].join('\n');
}

let privateKey = null;
export function loadSigningKey(b64 = process.env.SIGNING_KEY) {
  if (!b64) throw new Error('SIGNING_KEY manquante : lance « npm run keygen » et colle la clé privée dans .env');
  privateKey = crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' });
  return privateKey;
}
export function publicKeyHex(key = privateKey) {
  const jwk = crypto.createPublicKey(key).export({ format: 'jwk' });
  return Buffer.from(jwk.x, 'base64url').toString('hex');
}
export const sign = (message) => crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex');

// Empreinte d'une clé : 16 premiers caractères hex du SHA-512 (le module Lua calcule la même chose)
export const keyFingerprint = (key) => crypto.createHash('sha512').update(String(key), 'utf8').digest('hex').slice(0, 16);

// ---------- Clés de licence ----------
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I pour éviter les confusions
export function newLicenceKey() {
  const bytes = crypto.randomBytes(20);
  let s = '';
  for (let i = 0; i < 20; i++) s += ALPHA[bytes[i] % ALPHA.length];
  return `ORN-${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10, 15)}-${s.slice(15, 20)}`;
}
export const validKeyFormat = (k) => /^ORN-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(String(k || ''));

// ---------- Versions (semver simple : 1.2.3, 1.2, 1.2.3-beta) ----------
export const validSemver = (v) => /^\d+\.\d+(\.\d+)?(-[0-9A-Za-z.-]+)?$/.test(String(v || ''));
export function compareSemver(a, b) {
  const pa = String(a).split('-')[0].split('.').map(Number);
  const pb = String(b).split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  const ra = String(a).includes('-'), rb = String(b).includes('-'); // 1.0.0-beta < 1.0.0
  return ra === rb ? 0 : ra ? -1 : 1;
}

// ---------- Limiteur de débit en mémoire (fenêtre glissante simple) ----------
export function createLimiter() {
  const hits = new Map();
  setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (v.reset < t) hits.delete(k); }, 60e3).unref();
  return (key, max, windowMs) => {
    const t = Date.now();
    let e = hits.get(key);
    if (!e || e.reset < t) { e = { n: 0, reset: t + windowMs }; hits.set(key, e); }
    e.n++;
    return e.n > max;
  };
}

// ---------- Alertes Discord (webhook du salon #alertes) ----------
export async function alertDiscord(title, text) {
  const url = process.env.DISCORD_ALERT_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Orion · Licences', embeds: [{ title, description: String(text).slice(0, 3900), color: 0xff7a2f, timestamp: new Date().toISOString() }] }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* le webhook ne doit jamais bloquer l'API */ }
}

// Signature d'un webhook Tebex : HMAC-SHA256(secret, SHA256(corps brut))
export function tebexSignatureOk(raw, header, secret = process.env.TEBEX_WEBHOOK_SECRET) {
  if (!secret || !header) return false;
  const bodyHash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  const expected = crypto.createHmac('sha256', secret).update(bodyHash).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
