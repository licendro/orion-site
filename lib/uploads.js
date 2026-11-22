import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dbPath } from './db';

export const uploadsDir = () => path.join(path.dirname(dbPath()), 'uploads');

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// Enregistre une image envoyée depuis l'admin. Renvoie son URL publique (/uploads/xxx.png) ou null.
export async function saveUpload(file) {
  if (!file || typeof file === 'string' || !file.size) return null;
  const ext = EXT[file.type];
  if (!ext) throw new Error('Image PNG, JPG, WEBP ou GIF uniquement.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo maximum).');
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir(), name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
