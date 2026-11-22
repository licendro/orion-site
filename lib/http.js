import { NextResponse } from 'next/server';

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export function clientIp(req) {
  // Nginx place l'IP réelle dans X-Real-IP ; sinon, la dernière entrée de X-Forwarded-For
  // est celle ajoutée par Nginx (les précédentes peuvent être inventées par le visiteur).
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',').pop().trim();
  return null;
}

// Limiteur simple en mémoire (suffisant pour un seul processus).
const hits = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

export const siteUrl = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
