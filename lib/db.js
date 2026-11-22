import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA } from '../db/schema.mjs';

export const dbPath = () => process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'orion.db');

export function db() {
  if (!globalThis.__orionDb) {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const d = new Database(file);
    d.pragma('busy_timeout = 5000');
    d.exec(SCHEMA);
    globalThis.__orionDb = d;
  }
  return globalThis.__orionDb;
}

export function getSetting(key, fallback = null) {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

export function addJob(type, payload, delayMs = 0) {
  db().prepare('INSERT INTO jobs (type, payload, run_after) VALUES (?, ?, ?)').run(type, JSON.stringify(payload || {}), Date.now() + delayMs);
}

export function audit(admin, action, target, details) {
  db().prepare('INSERT INTO audit_logs (admin, action, target, details) VALUES (?, ?, ?, ?)')
    .run(admin || 'système', action, target || null, details == null ? null : typeof details === 'string' ? details : JSON.stringify(details));
}
