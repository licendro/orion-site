import { NextResponse } from 'next/server';
import { destroySession, SESSION_COOKIE } from '../../../../lib/auth';
import { siteUrl } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(`${siteUrl()}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
