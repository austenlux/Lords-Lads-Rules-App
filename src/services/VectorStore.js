/**
 * SearchIndex
 *
 * Persistent on-device full-text search index backed by op-sqlite + FTS5.
 * Works identically on Android and iOS (fully cross-platform, no ML model).
 *
 * Schema:
 *   chunks(id TEXT PK, source TEXT, text TEXT)   — human-readable chunks
 *   chunks_fts  VIRTUAL (FTS5)                   — full-text search index
 *   meta(key TEXT PK, value TEXT)                — content hash + version
 *
 * The index is rebuilt only when the content hash changes, so subsequent
 * app launches skip ingestion if the rulebook hasn't been updated.
 */

import { open } from '@op-engineering/op-sqlite';

const DB_NAME       = 'rag_index.db';
const SCHEMA_VERSION = 'v3_fts5';

let db = null;
let dbInitPromise = null;

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Opens (or returns the cached) database connection.
 * Uses a promise guard so concurrent callers wait for a single init.
 */
function getDB() {
  if (db) return Promise.resolve(db);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const conn = open({ name: DB_NAME });

    await conn.executeAsync('PRAGMA journal_mode = WAL;');

    await conn.executeAsync(`
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Schema migration: wipe everything on version change.
    const versionResult = await conn.executeAsync(
      'SELECT value FROM meta WHERE key = ?;',
      ['schema_version'],
    );
    const storedVersion = versionResult.rows?.[0]?.value ?? null;

    if (storedVersion !== SCHEMA_VERSION) {
      await conn.executeAsync('DROP TABLE IF EXISTS chunks;');
      await conn.executeAsync('DROP TABLE IF EXISTS chunks_fts;');
      await conn.executeAsync("DELETE FROM meta WHERE key != 'schema_version';");
      await conn.executeAsync(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?);",
        [SCHEMA_VERSION],
      );
    }

    await conn.executeAsync(`
      CREATE TABLE IF NOT EXISTS chunks (
        id     TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        text   TEXT NOT NULL
      );
    `);

    // FTS5 virtual table with porter stemming for word-variant matching
    // (drop/dropping, hammer/hammers, lord/lords, etc.)
    await conn.executeAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        id    UNINDEXED,
        source UNINDEXED,
        text,
        tokenize='porter unicode61'
      );
    `);

    db = conn;
    return db;
  })();

  return dbInitPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the stored content hash matches [contentHash].
 */
export async function isIndexCurrent(contentHash) {
  const conn = await getDB();
  const result = await conn.executeAsync(
    'SELECT value FROM meta WHERE key = ?;',
    ['content_hash'],
  );
  return (result.rows?.[0]?.value ?? null) === contentHash;
}

/**
 * Returns the number of chunks currently in the index.
 */
export async function getChunkCount() {
  const conn = await getDB();
  const result = await conn.executeAsync('SELECT COUNT(*) as cnt FROM chunks;');
  return result.rows?.[0]?.cnt ?? 0;
}

/**
 * Clears the existing index and inserts new chunks.
 * @param {Array<{id, source, text}>} chunks  Plain text chunks (no vectors).
 * @param {string} contentHash
 */
export async function saveIndex(chunks, contentHash) {
  const conn = await getDB();

  await conn.executeAsync('DELETE FROM chunks;');
  await conn.executeAsync('DELETE FROM chunks_fts;');

  for (const chunk of chunks) {
    await conn.executeAsync(
      'INSERT INTO chunks (id, source, text) VALUES (?, ?, ?);',
      [chunk.id, chunk.source, chunk.text],
    );
    await conn.executeAsync(
      'INSERT INTO chunks_fts (id, source, text) VALUES (?, ?, ?);',
      [chunk.id, chunk.source, chunk.text],
    );
  }

  await conn.executeAsync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('content_hash', ?);",
    [contentHash],
  );
}

/**
 * Full-text searches the index for [ftsQuery] using BM25 ranking.
 * Returns up to [k] results ordered by relevance (most relevant first).
 *
 * @param {string} ftsQuery  Space-separated keywords (FTS5 implicit AND).
 * @param {number} [k=15]    Number of candidates to fetch before dedup.
 * @returns {Promise<Array<{id, source, text, score: number}>>}
 */
export async function queryFTS(ftsQuery, k = 15) {
  const conn = await getDB();

  // bm25() returns negative values — negate so higher = more relevant.
  const result = await conn.executeAsync(
    `SELECT id, source, text, -bm25(chunks_fts) AS score
     FROM chunks_fts
     WHERE text MATCH ?
     ORDER BY bm25(chunks_fts)
     LIMIT ?;`,
    [ftsQuery, k],
  );

  return result.rows ?? [];
}
