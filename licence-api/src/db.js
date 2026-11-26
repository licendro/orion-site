// Base SQLite de l'API de licences (mode WAL : lectures et écritures en parallèle, idéal pour un petit VPS).
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scripts (
  name TEXT PRIMARY KEY,               -- nom de la ressource FiveM (ex. orn_garage)
  title TEXT NOT NULL,                 -- nom affiché
  product_key TEXT,                    -- clé du produit sur le site
  tebex_ids TEXT DEFAULT '',           -- ids des packages Tebex qui donnent ce script (séparés par des virgules, packs compris)
  latest_version TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY,
  script TEXT NOT NULL REFERENCES scripts(name) ON DELETE CASCADE,
  version TEXT NOT NULL,               -- semver : 1.4.2
  kinds TEXT DEFAULT '',               -- ajout,correctif,amelioration
  notes TEXT DEFAULT '',               -- markdown
  created_at INTEGER NOT NULL,
  UNIQUE (script, version)
);

CREATE TABLE IF NOT EXISTS licences (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,            -- ORN-XXXXX-XXXXX-XXXXX-XXXXX
  script TEXT NOT NULL REFERENCES scripts(name),
  discord_id TEXT,                     -- client (lien avec le site)
  customer TEXT,                       -- pseudo Cfx.re ou nom affiché
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | revoked
  reason TEXT,
  ip TEXT,                             -- IP du serveur FiveM liée (liée au 1er démarrage)
  ip_changed_at INTEGER,
  tebex_tx TEXT,
  tebex_package TEXT,
  seq INTEGER DEFAULT 0,               -- n° d'exemplaire si quantité > 1
  source TEXT DEFAULT 'tebex',         -- tebex | manuel
  note TEXT,
  last_check_at INTEGER,
  last_version TEXT,
  alerted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (tebex_tx, tebex_package, script, seq)
);

CREATE TABLE IF NOT EXISTS verify_logs (
  id INTEGER PRIMARY KEY,
  licence_id INTEGER,
  key_fp TEXT,                          -- empreinte de la clé (jamais la clé en clair)
  script TEXT,
  version TEXT,
  ip TEXT,                              -- gardée 30 jours (RGPD)
  result TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,                   -- webhook, admin, alerte…
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lic_discord ON licences(discord_id);
CREATE INDEX IF NOT EXISTS idx_lic_tx ON licences(tebex_tx);
CREATE INDEX IF NOT EXISTS idx_logs_lic ON verify_logs(licence_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_time ON verify_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_versions ON versions(script, created_at);
`;

export function openDb(file = process.env.DB_PATH || './data/licences.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -8000'); // ~8 Mo de cache : léger
  db.exec(SCHEMA);
  return db;
}

export const now = () => Date.now();
