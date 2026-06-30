import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Single SQLite file, easy to volume-mount and back up (plan: DB durability).
const DATA_DIR = process.env.PROXLINK_DATA_DIR || join(process.cwd(), 'data');
const DB_PATH = process.env.PROXLINK_DB_PATH || join(DATA_DIR, 'proxlink.db');

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  migrate(database);
  _db = database;
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hosts (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      base_url        TEXT NOT NULL,
      token_id        TEXT NOT NULL,
      enc_secret      TEXT NOT NULL,
      tls_fingerprint TEXT,
      verify_tls      INTEGER NOT NULL DEFAULT 1,
      sort            INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      ts     INTEGER NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT
    );
  `);
}

// ── meta helpers ─────────────────────────────────────────────────────────────
export function getMeta(key: string): string | null {
  const row = db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setMeta(key: string, value: string): void {
  db()
    .prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}

// ── hosts ────────────────────────────────────────────────────────────────────
export interface HostRow {
  id: string;
  name: string;
  base_url: string;
  token_id: string;
  enc_secret: string;
  tls_fingerprint: string | null;
  verify_tls: number;
  sort: number;
  created_at: number;
}

export function listHosts(): HostRow[] {
  return db()
    .prepare('SELECT * FROM hosts ORDER BY sort ASC, created_at ASC')
    .all() as HostRow[];
}

export function getHost(id: string): HostRow | undefined {
  return db().prepare('SELECT * FROM hosts WHERE id = ?').get(id) as HostRow | undefined;
}

export function insertHost(h: HostRow): void {
  db()
    .prepare(
      `INSERT INTO hosts (id, name, base_url, token_id, enc_secret, tls_fingerprint, verify_tls, sort, created_at)
       VALUES (@id, @name, @base_url, @token_id, @enc_secret, @tls_fingerprint, @verify_tls, @sort, @created_at)`,
    )
    .run(h);
}

export function deleteHost(id: string): void {
  db().prepare('DELETE FROM hosts WHERE id = ?').run(id);
}

export function updateHostSecret(id: string, encSecret: string): void {
  db().prepare('UPDATE hosts SET enc_secret = ? WHERE id = ?').run(encSecret, id);
}

// ── audit log (secrets never written here) ───────────────────────────────────
export function audit(action: string, target?: string, detail?: string): void {
  db()
    .prepare('INSERT INTO audit (ts, action, target, detail) VALUES (?, ?, ?, ?)')
    .run(Date.now(), action, target ?? null, detail ?? null);
}

export function recentAudit(limit = 100): Array<{
  id: number;
  ts: number;
  action: string;
  target: string | null;
  detail: string | null;
}> {
  return db()
    .prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?')
    .all(limit) as any;
}
