import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { siteUrl } from '../../../../lib/http';
import { discordConfigured } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Démarre la connexion Discord. ?next=/chemin pour revenir au bon endroit.
export async function GET(req) {
  if (!discordConfigured()) return NextResponse.redirect(`${siteUrl()}/?auth=off`);
  const state = crypto.randomBytes(16).toString('hex');
  const next = new URL(req.url).searchParams.get('next') || '/compte';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/compte';
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${siteUrl()}/api/auth/callback`,
    scope: 'identify guilds.join',
    state,
    prompt: 'none',
  });
  const res = NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`);
  const opts = { httpOnly: true, secure: siteUrl().startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 };
  res.cookies.set('orion_oauth_state', state, opts);
  res.cookies.set('orion_oauth_next', safeNext, opts);
  return res;
}
