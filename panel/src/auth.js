// Connexion : mot de passe (scrypt) + code à 6 chiffres d'une appli d'authentification (TOTP, RFC 6238).
import crypto from 'node:crypto';
import { config } from './config.js';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
}
function passwordOk(password) {
  const { hash, salt } = config().auth;
  if (!hash || !salt) return false;
  const a = Buffer.from(crypto.scryptSync(String(password), salt, 64).toString('hex'));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ----- TOTP (Google Authenticator, Aegis, 2FAS…) -----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '', out = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function b32decode(s) {
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, '0'); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export function totpAt(secret, t = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const usedCodes = new Map(); // un code ne sert qu'une fois
function totpOk(code) {
  const secret = config().auth.totp;
  if (!secret) return true; // 2FA non activée (déconseillé)
  code = String(code || '').replace(/\s/g, '');
  for (const d of [-1, 0, 1]) {
    if (totpAt(secret, Date.now() + d * 30000) === code) {
      if (usedCodes.has(code)) return false;
      usedCodes.set(code, Date.now());
      for (const [k, v] of usedCodes) if (Date.now() - v > 120e3) usedCodes.delete(k);
      return true;
    }
  }
  return false;
}

// ----- Sessions (en mémoire : un redémarrage du panneau déconnecte) -----
const sessions = new Map();
const SESSION_MS = 12 * 3600e3;
const attempts = new Map();

export function login({ user, password, code }, ip) {
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return { error: `Trop d’essais. Réessaie dans ${Math.ceil((a.until - Date.now()) / 60000)} min.` };
  const ok = user === config().auth.user && passwordOk(password) && totpOk(code);
  if (!ok) {
    a.n++;
    if (a.n >= 5) { a.until = Date.now() + 15 * 60e3; a.n = 0; }
    attempts.set(ip, a);
    return { error: 'Identifiants ou code incorrects.' };
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ip, until: Date.now() + SESSION_MS });
  return { token };
}
export function check(token) {
  const s = token && sessions.get(token);
  if (!s || s.until < Date.now()) { if (s) sessions.delete(token); return false; }
  s.until = Date.now() + SESSION_MS; // prolongée tant que tu l'utilises
  return true;
}
export const logout = (token) => sessions.delete(token);
