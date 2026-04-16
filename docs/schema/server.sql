PRAGMA foreign_keys = ON;

-- events
CREATE TABLE IF NOT EXISTS events (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,
  status INTEGER NOT NULL,
  finals INTEGER NOT NULL,
  divisions INTEGER NOT NULL,
  fields INTEGER NOT NULL DEFAULT 1,
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  region TEXT NOT NULL
);

-- users
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  hashed_password TEXT NOT NULL,
  salt TEXT,
  type INTEGER NOT NULL DEFAULT 0,
  real_name TEXT,
  used INTEGER NOT NULL DEFAULT 1,
  generic INTEGER NOT NULL DEFAULT 0
);

-- roles
CREATE TABLE IF NOT EXISTS roles (
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'ADMIN',
    'TSO',
    'HEAD_REFEREE',
    'REFEREE',
    'INSPECTOR',
    'LEAD_INSPECTOR',
    'JUDGE'
  )),
  event TEXT NOT NULL DEFAULT '*',
  PRIMARY KEY (username, role, event),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roles_username ON roles(username);
CREATE INDEX IF NOT EXISTS idx_roles_event ON roles(event);

-- config
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- event log
CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  event TEXT,
  info TEXT NOT NULL,
  extra TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_log_event ON event_log(event);

-- account_secrets
CREATE TABLE IF NOT EXISTS account_secrets (
  username TEXT NOT NULL,
  event TEXT NOT NULL,
  secret_encrypted TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (username, event),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_secrets_event ON account_secrets(event);

-- sync_clients
CREATE TABLE IF NOT EXISTS sync_clients (
  id TEXT PRIMARY KEY,
  event_code TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  last_used_at INTEGER,
  allowed_resources TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_clients_event_code ON sync_clients(event_code);
CREATE INDEX IF NOT EXISTS idx_sync_clients_active ON sync_clients(is_active);

-- sync_batches
CREATE TABLE IF NOT EXISTS sync_batches (
  id TEXT PRIMARY KEY,
  push_batch_id TEXT NOT NULL,
  change_set_id TEXT UNIQUE,
  client_id TEXT NOT NULL,
  event_code TEXT NOT NULL,
  status TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  raw_payload TEXT,
  warnings TEXT,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewer_id TEXT,
  review_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_batches_client ON sync_batches(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_batches_event ON sync_batches(event_code);
CREATE INDEX IF NOT EXISTS idx_sync_batches_status ON sync_batches(status);
CREATE INDEX IF NOT EXISTS idx_sync_batches_idempotency ON sync_batches(client_id, batch_id, payload_hash);

-- sync_change_sets
CREATE TABLE IF NOT EXISTS sync_change_sets (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  record_key TEXT NOT NULL,
  staged_data TEXT,
  applied_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_change_sets_batch ON sync_change_sets(batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_change_sets_resource ON sync_change_sets(resource_type);

-- sync_policies
CREATE TABLE IF NOT EXISTS sync_policies (
  event_code TEXT PRIMARY KEY,
  is_sync_enabled INTEGER NOT NULL DEFAULT 0,
  review_mode TEXT NOT NULL DEFAULT 'AUTO_ACCEPT',
  schedule_owner TEXT NOT NULL DEFAULT 'WEB',
  allowed_push_resources TEXT,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

-- sync_outbound_links
CREATE TABLE IF NOT EXISTS sync_outbound_links (
  event_code TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  bearer_secret TEXT NOT NULL,
  remote_event_key TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  allowed_push_resources TEXT,
  allowed_pull_resources TEXT,
  schedule_owner TEXT NOT NULL DEFAULT 'WEB',
  review_mode TEXT NOT NULL DEFAULT 'AUTO_ACCEPT',
  bootstrapped_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_outbound_links_event_code ON sync_outbound_links(event_code);

-- sync_outbound_batches
CREATE TABLE IF NOT EXISTS sync_outbound_batches (
  id TEXT PRIMARY KEY,
  event_code TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_attempt_at INTEGER,
  last_http_status INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbound_batches_event_batch_id
  ON sync_outbound_batches(event_code, batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_outbound_batches_status_next_attempt
  ON sync_outbound_batches(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_sync_outbound_batches_event_code
  ON sync_outbound_batches(event_code);

-- sync_outbound_attempts
CREATE TABLE IF NOT EXISTS sync_outbound_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outbound_batch_id TEXT NOT NULL,
  attempted_at INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_outbound_attempts_batch_id
  ON sync_outbound_attempts(outbound_batch_id);

-- sync_outbound_state
CREATE TABLE IF NOT EXISTS sync_outbound_state (
  event_code TEXT PRIMARY KEY,
  paused INTEGER NOT NULL DEFAULT 0,
  last_success_at INTEGER,
  last_attempt_at INTEGER,
  last_error TEXT,
  backoff_until INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_outbound_state_backoff_until
  ON sync_outbound_state(backoff_until);
