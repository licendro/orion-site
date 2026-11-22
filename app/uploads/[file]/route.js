import fs from 'node:fs';
import path from 'node:path';
import { uploadsDir } from '../../../lib/uploads';

export const dynamic = 'force-dynamic';

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// Sert les images envoyées depuis l'admin (stockées hors du dossier du site, gardées entre deux mises à jour).
export async function GET(_req, { params }) {
  const name = String(params.file || '');
  if (!/^[a-z0-9_-]+\.(png|jpe?g|webp|gif)$/i.test(name)) return new Response('Not found', { status: 404 });
  const file = path.join(uploadsDir(), name);
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { 'Content-Type': TYPES[path.extname(name).toLowerCase()], 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
