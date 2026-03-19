import { Database } from 'bun:sqlite'
import path from 'path'

let db: Database | null = null
let exexDb: Database | null = null

/** Whether the blob-exex external database is configured */
export function isExExMode(): boolean {
  return !!process.env.EXEX_DB_PATH
}

/** Local DB — always used for melodies + webauthn keys */
export function getDb(): Database {
  if (db) return db

  const dbPath = process.env.DB_PATH || path.join(import.meta.dir, 'blob_sonify.db')
  db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL')

  // In exex mode, local DB only needs melodies + webauthn tables
  // In standalone mode, it also needs blocks + blobs tables
  if (isExExMode()) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS melodies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blob_hash TEXT NOT NULL UNIQUE,
        notes_json TEXT NOT NULL,
        bpm INTEGER NOT NULL,
        scale TEXT NOT NULL,
        payer_address TEXT NOT NULL,
        tx_hash TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS webauthn_keys (
        credential_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_melodies_blob ON melodies(blob_hash);
    `)
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS blocks (
        block_number INTEGER PRIMARY KEY,
        block_timestamp INTEGER NOT NULL,
        blob_count INTEGER NOT NULL,
        blob_gas_price TEXT,
        excess_blob_gas TEXT
      );

      CREATE TABLE IF NOT EXISTS blobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_number INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        blob_hash TEXT NOT NULL,
        blob_index INTEGER NOT NULL,
        sender TEXT NOT NULL,
        FOREIGN KEY (block_number) REFERENCES blocks(block_number)
      );

      CREATE TABLE IF NOT EXISTS melodies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blob_hash TEXT NOT NULL UNIQUE,
        notes_json TEXT NOT NULL,
        bpm INTEGER NOT NULL,
        scale TEXT NOT NULL,
        payer_address TEXT NOT NULL,
        tx_hash TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS webauthn_keys (
        credential_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_blobs_block ON blobs(block_number);
      CREATE INDEX IF NOT EXISTS idx_blobs_hash ON blobs(blob_hash);
      CREATE INDEX IF NOT EXISTS idx_melodies_blob ON melodies(blob_hash);
    `)
  }

  return db
}

/** ExEx DB — read-only access to the blob-exex SQLite database */
export function getExExDb(): Database {
  if (exexDb) return exexDb

  const exexPath = process.env.EXEX_DB_PATH
  if (!exexPath) {
    throw new Error('EXEX_DB_PATH not set — cannot open exex database')
  }

  exexDb = new Database(exexPath, { readonly: true })
  return exexDb
}
