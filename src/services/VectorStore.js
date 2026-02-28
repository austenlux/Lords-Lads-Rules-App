/**
 * VectorStore
 *
 * Persistent on-device vector index backed by op-sqlite + sqlite-vec.
 * Works identically on Android and iOS (fully cross-platform).
 *
 * Schema:
 *   chunks(id TEXT PK, source TEXT, text TEXT)          — human-readable chunks
 *   chunk_vectors(chunk_id TEXT PK, vector BLOB)        — raw float32 embedding
 *   meta(key TEXT PK, value TEXT)                       — content hash tracking
 *
 * The index is rebuilt only when the content hash changes, so subsequent
 * app launches skip ingestion if the rulebook hasn't been updated.
 */

import { open } from '@op-engineering/op-sqlite';

const DB_NAME = 'rag_index.db';
const EMBEDDING_DIM = 100; // Universal Sentence Encoder output dimension

let db = null;

// ── Initialisation ────────────────────────────────────────────────────────────

async function getDB() {
  if (db) return db;
  db = open({ name: DB_NAME });
  await db.executeAsync('PRAGMA journal_mode = WAL;');
  await db.executeAsync(`
    CREATE TABLE IF NOT EXISTS chunks (
      id     TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      text   TEXT NOT NULL
    );
  `);
  await db.executeAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
      chunk_id TEXT PRIMARY KEY,
      vector   FLOAT[${EMBEDDING_DIM}]
    );
  `);
  await db.executeAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

// ── Hash ──────────────────────────────────────────────────────────────────────

/**
 * Cheap djb2 string hash — used to detect when content has changed so we
 * can skip re-ingestion on subsequent launches.
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return String(hash);
}

// ── Read / write helpers ──────────────────────────────────────────────────────

async function getMeta(key) {
  const conn = await getDB();
  const result = await conn.executeAsync(
    'SELECT value FROM meta WHERE key = ?;',
    [key],
  );
  return result.rows?.[0]?.value ?? null;
}

async function setMeta(key, value) {
  const conn = await getDB();
  await conn.executeAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);',
    [key, value],
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the stored content hash matches [contentHash], meaning
 * the index is up-to-date and ingestion can be skipped.
 */
export async function isIndexCurrent(contentHash) {
  const stored = await getMeta('content_hash');
  return stored === contentHash;
}

/**
 * Clears all existing chunks and vectors, then inserts [embeddedChunks].
 * Records [contentHash] so subsequent launches can skip re-ingestion.
 *
 * @param {Array<{id, source, text, vector: number[]}>} embeddedChunks
 * @param {string} contentHash
 */
export async function saveIndex(embeddedChunks, contentHash) {
  const conn = await getDB();

  // Wipe stale data.
  await conn.executeAsync('DELETE FROM chunks;');
  await conn.executeAsync('DELETE FROM chunk_vectors;');

  for (const chunk of embeddedChunks) {
    await conn.executeAsync(
      'INSERT INTO chunks (id, source, text) VALUES (?, ?, ?);',
      [chunk.id, chunk.source, chunk.text],
    );

    // sqlite-vec stores float32 vectors as packed binary blobs.
    const blob = float32ArrayToBlob(new Float32Array(chunk.vector));
    await conn.executeAsync(
      'INSERT INTO chunk_vectors (chunk_id, vector) VALUES (?, ?);',
      [chunk.id, blob],
    );
  }

  await setMeta('content_hash', contentHash);
}

/**
 * Queries the vector index for the top-k chunks most similar to
 * [queryVector].  Returns lightweight objects: {id, source, text, distance}.
 *
 * @param {number[]} queryVector
 * @param {number}   [k=3]
 * @returns {Promise<Array<{id, source, text, distance: number}>>}
 */
export async function queryTopK(queryVector, k = 3) {
  const conn = await getDB();
  const blob = float32ArrayToBlob(new Float32Array(queryVector));

  const result = await conn.executeAsync(
    `SELECT c.id, c.source, c.text, v.distance
     FROM chunk_vectors v
     JOIN chunks c ON c.id = v.chunk_id
     WHERE v.vector MATCH ?
       AND k = ?
     ORDER BY v.distance;`,
    [blob, k],
  );

  return result.rows ?? [];
}

/**
 * Returns all stored chunks (used for in-memory fallback retrieval).
 * @returns {Promise<Array<{id, source, text}>>}
 */
export async function getAllChunks() {
  const conn = await getDB();
  const result = await conn.executeAsync('SELECT id, source, text FROM chunks;');
  return result.rows ?? [];
}

/**
 * Returns the number of chunks currently stored in the index.
 * Used to detect a "hash matches but index is empty" state that occurs
 * when a previous ingestion run failed after saving the hash.
 */
export async function getChunkCount() {
  const conn = await getDB();
  const result = await conn.executeAsync('SELECT COUNT(*) as cnt FROM chunks;');
  return result.rows?.[0]?.cnt ?? 0;
}

// ── Binary helpers ────────────────────────────────────────────────────────────

/**
 * Returns the underlying ArrayBuffer of a Float32Array for use as a SQLite
 * blob parameter.  op-sqlite requires a raw ArrayBuffer — not a typed-array
 * view — when binding binary values to query parameters.
 * sqlite-vec reads the blob as packed IEEE-754 float32 little-endian bytes.
 */
function float32ArrayToBlob(float32Array) {
  // Slice to get an owned copy of just the relevant bytes (handles the case
  // where float32Array is a view into a larger shared buffer).
  return float32Array.buffer.slice(
    float32Array.byteOffset,
    float32Array.byteOffset + float32Array.byteLength,
  );
}
