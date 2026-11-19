'use strict';
/* SQLite (node:sqlite, no packages). The tables are the same as v1, so an
   existing data/emdad.db keeps working; new columns/tables are added safely. */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DATA_DIR, SEED_DEMO } = require('./config');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'emdad.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 4000;

  CREATE TABLE IF NOT EXISTS centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT DEFAULT '',
    manager_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    scan_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    unit TEXT DEFAULT 'علبة',
    available_qty INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    max_per_order INTEGER DEFAULT 50,
    icon TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    badge_tone TEXT DEFAULT 'sage',
    is_visible INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    center_id INTEGER NOT NULL,
    center_name TEXT NOT NULL,
    center_branch TEXT DEFAULT '',
    manager_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 15,
    notes TEXT DEFAULT '',
    admin_note TEXT DEFAULT '',
    driver_name TEXT DEFAULT '',
    driver_phone TEXT DEFAULT '',
    eta_minutes INTEGER DEFAULT 0,
    stage_log TEXT DEFAULT '[]',
    total_items INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    supply_id INTEGER,
    supply_name TEXT NOT NULL,
    unit TEXT DEFAULT 'علبة',
    category TEXT DEFAULT '',
    quantity INTEGER NOT NULL,
    icon TEXT DEFAULT '',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS qr_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id INTEGER,
    scanned_at TEXT DEFAULT (datetime('now', 'localtime')),
    user_agent TEXT DEFAULT '',
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  /* v2 */
  CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_at INTEGER NOT NULL, ua TEXT DEFAULT '');
  CREATE INDEX IF NOT EXISTS ix_orders_center ON orders (center_id, id);
  CREATE INDEX IF NOT EXISTS ix_orders_status ON orders (status);
  CREATE INDEX IF NOT EXISTS ix_scans_at ON qr_scans (scanned_at);
  CREATE INDEX IF NOT EXISTS ix_items_order ON order_items (order_id);
`);

const SETTING_DEFAULTS = {
  brand_name: 'إمداد QR',
  brand_subtitle: 'توريدات المراكز بكود QR',
  public_base_url: '',
  sound_alerts: 'true',
  show_out_of_stock: 'true',
  public_directory: 'true'     // the general QR (/center) lists centers by name so a manager can pick his
};

function getSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) if (!r.key.startsWith('_')) out[r.key] = r.value;
  return out;
}
function setSetting(key, value) { db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value)); }
function getSecret(key) { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get('_' + key); return r ? r.value : null; }
function setSecret(key, value) { setSetting('_' + key, value); }

/* run a block inside one transaction */
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
}

if (SEED_DEMO && db.prepare('SELECT COUNT(*) AS c FROM centers').get().c === 0) {
  try { require('./seed').seedDemo(db); } catch (e) { console.error('[seed]', e.message); }
}

module.exports = { db, tx, getSettings, setSetting, getSecret, setSecret, SETTING_DEFAULTS };
