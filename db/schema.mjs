// Schéma SQLite partagé par le site et le bot. Exécuté au démarrage des deux (idempotent).
export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Copie locale des packages Tebex + contenu enrichi (les champs non vides remplacent ceux de Tebex).
CREATE TABLE IF NOT EXISTS products (
  key TEXT PRIMARY KEY,
  tebex_id INTEGER,
  name TEXT NOT NULL,
  short TEXT,
  description TEXT,
  image TEXT,
  features TEXT,
  version TEXT,
  video TEXT,
  bundle TEXT,
  featured INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0,
  published INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0,
  announced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value REAL NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  starts_at TEXT,
  ends_at TEXT,
  banner TEXT,
  coupon TEXT,
  tebex_coupon_id TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  tebex_tx TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  discord_id TEXT,
  customer TEXT,
  email TEXT,
  total REAL,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  raw TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_key TEXT,
  name TEXT,
  price REAL
);

CREATE TABLE IF NOT EXISTS customer_channels (
  discord_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  error TEXT,
  run_after INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS changelogs (
  id INTEGER PRIMARY KEY,
  product_key TEXT NOT NULL,
  version TEXT NOT NULL,
  notes TEXT,
  author TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  discord TEXT,
  type TEXT,
  framework TEXT,
  budget TEXT,
  message TEXT,
  status TEXT DEFAULT 'nouveau',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  admin TEXT,
  action TEXT,
  target TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_after);
CREATE INDEX IF NOT EXISTS idx_orders_discord ON orders(discord_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`;
