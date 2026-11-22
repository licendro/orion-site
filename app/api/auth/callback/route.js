import { NextResponse } from 'next/server';
import { db, audit } from '../../../../lib/db';
import { createSession, SESSION_COOKIE } from '../../../../lib/auth';
import { siteUrl } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

const API = 'https://discord.com/api/v10';

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = req.cookies.get('orion_oauth_state')?.value;
  const next = req.cookies.get('orion_oauth_next')?.value || '/compte';
  const fail = (why) => NextResponse.redirect(`${siteUrl()}/?auth=${why}`);
  if (!code || !state || state !== saved) return fail('error');

  try {
    // 1. Échange du code contre un jeton
    const tokenRes = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${siteUrl()}/api/auth/callback`,
      }),
      cache: 'no-store',
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(token.error_description || 'token');

    // 2. Profil Discord
    const meRes = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store' });
    const me = await meRes.json();
    if (!meRes.ok || !me.id) throw new Error('profil');

    // 3. Ajout automatique au serveur Discord Orion (pour recevoir rôle et salon après achat)
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_GUILD_ID) {
      await fetch(`${API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${me.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token.access_token }),
        cache: 'no-store',
      }).catch(() => {});
    }

    // 4. Compte local + session
    const d = db();
    d.prepare(`INSERT INTO users (discord_id, username, avatar, last_login) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, last_login = CURRENT_TIMESTAMP`)
      .run(me.id, me.global_name || me.username, me.avatar || null);
    const user = d.prepare('SELECT id FROM users WHERE discord_id = ?').get(me.id);
    // Rattache les commandes passées avant la première connexion
    d.prepare('UPDATE orders SET user_id = ? WHERE discord_id = ? AND user_id IS NULL').run(user.id, me.id);
    const s = createSession(user.id);

    const res = NextResponse.redirect(`${siteUrl()}${next}`);
    res.cookies.set(SESSION_COOKIE, s.id, { httpOnly: true, secure: siteUrl().startsWith('https'), sameSite: 'lax', path: '/', expires: new Date(s.expires) });
    res.cookies.delete('orion_oauth_state');
    res.cookies.delete('orion_oauth_next');
    return res;
  } catch (e) {
    console.error('[auth]', e.message);
    audit(null, 'auth.erreur', null, e.message);
    return fail('error');
  }
}
