PRAGMA foreign_keys = ON;

-- events
CREATE TABLE IF NOT EXISTS events (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,
  status INTEGER NOT NULL,
  finals INTEGER NOT NULL,
  divisions INTEGER NOT NULL,
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
