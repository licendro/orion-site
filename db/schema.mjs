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

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY,
  discord_id TEXT NOT NULL,
  moderator_id TEXT,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grants (
  id INTEGER PRIMARY KEY,
  cfx_username TEXT NOT NULL,
  product_key TEXT,
  tebex_id INTEGER,
  note TEXT,
  by_discord TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  discord_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','support')),
  added_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS docs (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Guides',
  product_key TEXT,
  summary TEXT,
  body TEXT NOT NULL DEFAULT '',
  sort INTEGER DEFAULT 100,
  published INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  tebex_ref TEXT UNIQUE NOT NULL,
  discord_id TEXT,
  customer TEXT,
  product_key TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  discord_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','done','cancelled')),
  starts_at INTEGER,
  ends_at INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  channel_id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'ai',
  ai_turns INTEGER DEFAULT 0,
  last_activity INTEGER,
  reminded INTEGER DEFAULT 0,
  claimed_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Statistiques du support : une ligne par ticket (gardée après la fermeture)
CREATE TABLE IF NOT EXISTS ticket_stats (
  channel_id TEXT PRIMARY KEY,
  discord_id TEXT,
  type TEXT,
  priority TEXT DEFAULT 'normal',
  opened_at INTEGER,
  first_response_at INTEGER,
  first_response_by TEXT,        -- ia | equipe
  transferred_at INTEGER,
  staff_id TEXT,                 -- membre de l'équipe qui a traité le ticket
  closed_at INTEGER,
  resolved_by TEXT,              -- ia | equipe | client | inactif
  reason TEXT,
  ai_turns INTEGER DEFAULT 0,
  rating INTEGER,                -- note de 1 à 5 donnée par le client
  rated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ticket_stats_open ON ticket_stats(opened_at);

-- Réponses toutes faites de l'équipe (/reponse)
CREATE TABLE IF NOT EXISTS ticket_macros (
  name TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  uses INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Cerveau de l'IA : connaissances apprises des tickets, reliées entre elles
CREATE TABLE IF NOT EXISTS ai_memory (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'solution',   -- solution | faq | fait
  title TEXT NOT NULL,
  content TEXT NOT NULL,                   -- court (≤ 600 caractères) : ce qui est réinjecté à l'IA
  keywords TEXT DEFAULT '',                -- mots-clés séparés par des espaces (recherche)
  links TEXT DEFAULT '',                   -- ids des souvenirs liés (« lien logique »), séparés par des virgules
  status TEXT NOT NULL DEFAULT 'valide',   -- valide | a_verifier | archive
  source TEXT,                             -- equipe | ia_resolu | manuel
  uses INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_memory_status ON ai_memory(status);

-- Ce que l'IA retient d'un client (sa config de serveur…), pour ne pas tout redemander
CREATE TABLE IF NOT EXISTS ai_client_notes (
  discord_id TEXT PRIMARY KEY,
  notes TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bugs (
  id INTEGER PRIMARY KEY,
  product_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'genant',
  status TEXT NOT NULL DEFAULT 'nouveau',
  fixed_version TEXT,
  note TEXT,
  reporter_id TEXT,
  thread_id TEXT,
  ticket_channel_id TEXT,
  card_message_id TEXT,
  thread_message_id TEXT,
  duplicate_of INTEGER,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bug_followers (
  bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  PRIMARY KEY (bug_id, discord_id)
);

CREATE TABLE IF NOT EXISTS checkout_consents (
  id INTEGER PRIMARY KEY,
  basket TEXT,
  discord_id TEXT,
  cgv_version TEXT,
  items TEXT,
  waiver INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT DEFAULT 'script',
  product_key TEXT,
  status TEXT NOT NULL DEFAULT 'nouvelle',
  note TEXT,
  author_id TEXT,
  author_name TEXT,
  thread_id TEXT UNIQUE,
  card_message_id TEXT,
  released_key TEXT,
  source TEXT DEFAULT 'discord',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idea_votes (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idea_id, discord_id)
);

CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status, product_key);
CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(discord_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_after);
CREATE INDEX IF NOT EXISTS idx_orders_discord ON orders(discord_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`;

// Colonnes ajoutées après coup : appliquées une seule fois sur les bases existantes.
export const MIGRATIONS = [
  'ALTER TABLE products ADD COLUMN gallery TEXT',
  'ALTER TABLE products ADD COLUMN docs TEXT',
  "ALTER TABLE products ADD COLUMN kind TEXT DEFAULT 'single'",
  'ALTER TABLE quotes ADD COLUMN discord_id TEXT',
  'ALTER TABLE quotes ADD COLUMN channel_id TEXT',
  'ALTER TABLE changelogs ADD COLUMN kinds TEXT',
  'ALTER TABLE tickets ADD COLUMN ai_summary TEXT',
  'ALTER TABLE tickets ADD COLUMN ai_summary_n INTEGER DEFAULT 0',
  "ALTER TABLE tickets ADD COLUMN priority TEXT DEFAULT 'normal'",
];

export function migrate(d) {
  for (const sql of MIGRATIONS) {
    try { d.exec(sql); } catch { /* déjà appliquée */ }
  }
}
