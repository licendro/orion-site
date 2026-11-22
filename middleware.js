import { NextResponse } from 'next/server';

// Transmet le chemin demandé au layout (pour l'espace admin et la maintenance).
export function middleware(req) {
  const headers = new Headers(req.headers);
  headers.set('x-orion-path', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/|img/|uploads/|favicon|logo|banniere|api/).*)'] };
