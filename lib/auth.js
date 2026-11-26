import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';

export const SESSION_COOKIE = 'orion_session';
const SESSION_DAYS = 30;

export const adminIds = () => (process.env.ADMIN_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

// Rôles de l'admin : fondateur (.env ADMIN_DISCORD_IDS), admin et support (gérés dans Admin → Équipe).
export function getRole(user) {
  if (!user) return null;
  if (adminIds().includes(user.discord_id)) return 'owner';
  return db().prepare('SELECT role FROM admins WHERE discord_id = ?').get(user.discord_id)?.role || null;
}
export const isAdmin = (user) => !!getRole(user);

const SUPPORT = ['dashboard', 'orders', 'clients', 'quotes', 'bugs', 'ideas', 'journal', 'test'];
const ADMIN = [...SUPPORT, 'products', 'promotions', 'codes', 'updates', 'licences', 'ai', 'announcements', 'docs', 'maintenance'];
export const PERMS = { owner: [...ADMIN, 'settings', 'team'], admin: ADMIN, support: SUPPORT };
export const can = (role, perm) => !!role && PERMS[role]?.includes(perm);
export const ROLE_LABEL = { owner: 'Fondateur', admin: 'Admin', support: 'Support' };

export function createSession(userId) {
  const id = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db().prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expires);
  db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  return { id, expires };
}

export function destroySession(id) {
  if (id) db().prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

// Utilisateur connecté (ou null), lu depuis le cookie de session.
export function getUser() {
  const sid = cookies().get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = db().prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?`).get(sid, Date.now());
  return row || null;
}

export const avatarUrl = (u) =>
  u?.avatar ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png';

export const discordConfigured = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
