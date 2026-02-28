/**
 * RAGService
 *
 * Cross-platform Retrieval-Augmented Generation pipeline.
 *
 * Responsibilities:
 *  1. Chunk raw Markdown text into overlapping segments.
 *  2. Embed each chunk via NativeEmbedder (Android: MediaPipe USE; iOS: TBD).
 *  3. Store / retrieve chunk embeddings through VectorStore.
 *  4. Given a user query, return the top-k most relevant text chunks.
 *
 * This module is pure JS except for the NativeEmbedder call, keeping all
 * retrieval logic reusable when iOS is added.
 */

import { Platform } from 'react-native';
import NativeEmbedder from '../specs/NativeEmbedder';

// ── Chunking parameters ───────────────────────────────────────────────────────

const CHUNK_SIZE            = 800;  // larger chunks = more context per snippet
const CHUNK_OVERLAP         = 100;  // overlap between consecutive chunks
const TOP_K                 = 5;    // total chunks returned per query
const MAX_PER_SOURCE        = 3;    // cap per source so rules + expansions both get slots
const DEDUP_INDEX_DISTANCE  = 2;    // skip a chunk if a same-source chunk within ±N is already selected
export const MIN_SIMILARITY = 0.25; // chunks scoring below this are discarded

// ── Source identifiers ────────────────────────────────────────────────────────

export const SOURCE = {
  RULES:      'rules',
  EXPANSIONS: 'expansions',
};

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * Splits text into overlapping character-level chunks.
 * Tries to break at paragraph or sentence boundaries within a tolerance window
 * so chunks don't cut mid-sentence.
 *
 * @param {string} text
 * @param {string} source  SOURCE.RULES or SOURCE.EXPANSIONS
 * @returns {Array<{id: string, source: string, text: string}>}
 */
export function chunkText(text, source) {
  if (!text?.trim()) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    // Try to snap to a paragraph break (\n\n) or sentence end (. ! ?) within
    // a 100-char look-back window to avoid mid-sentence cuts.
    if (end < text.length) {
      const searchFrom = Math.max(end - 100, start + 1);
      const paraBreak  = text.lastIndexOf('\n\n', end);
      const sentBreak  = Math.max(
        text.lastIndexOf('. ', end),
        text.lastIndexOf('! ', end),
        text.lastIndexOf('? ', end),
      );
      const snap = paraBreak >= searchFrom ? paraBreak
                 : sentBreak >= searchFrom ? sentBreak + 1
                 : end;
      end = snap;
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        id: `${source}_${index++}`,
        source,
        text: chunkText,
      });
    }

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

// ── Embedding ─────────────────────────────────────────────────────────────────

/**
 * Embeds a single text string.
 * On iOS (NativeEmbedder not yet implemented) returns null.
 *
 * @param {string} text
 * @returns {Promise<number[] | null>}
 */
/**
 * Embeds a single text string.
 * Throws on failure so the caller can capture the real error message.
 * Returns null on iOS (NativeEmbedder not yet implemented).
 *
 * @param {string} text
 * @returns {Promise<number[] | null>}
 */
export async function embedText(text) {
  if (Platform.OS !== 'android') return null;
  // Intentionally NOT catching here — callers that need per-item resilience
  // (embedChunks) wrap each call individually; retrieve() captures the message.
  const vec = await NativeEmbedder.embedText(text);
  return vec?.length ? vec : null;
}

/**
 * Embeds an array of chunks, attaching a `vector` field to each.
 * Chunks that fail to embed are filtered out.
 *
 * @param {Array<{id, source, text}>} chunks
 * @returns {Promise<Array<{id, source, text, vector: number[]}>>}
 */
export async function embedChunks(chunks) {
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const vector = await embedText(chunk.text);
        return vector ? { ...chunk, vector } : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

/**
 * Dot product of two normalised vectors (equivalent to cosine similarity when
 * both are L2-normalised, which the MediaPipe embedder guarantees).
 */
function dotProduct(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/**
 * Given a query embedding and an array of embedded chunks, returns the top-k
 * chunks ranked by cosine similarity (highest first).
 *
 * @param {number[]}  queryVector
 * @param {Array<{id, source, text, vector}>} embeddedChunks
 * @param {number}    [k]  defaults to TOP_K
 * @returns {Array<{id, source, text, score: number}>}
 */
/**
 * Given a query embedding and an array of embedded chunks, returns the top-k
 * chunks ranked by cosine similarity (highest first), filtered to those that
 * score at or above MIN_SIMILARITY. Returns an empty array if nothing is
 * relevant enough — the caller should fall back to full-content prompting.
 *
 * @param {number[]}  queryVector
 * @param {Array<{id, source, text, vector}>} embeddedChunks
 * @param {number}    [k]  defaults to TOP_K
 * @returns {Array<{id, source, text, score: number}>}
 */
/**
 * Scores all chunks against the query vector and returns them sorted
 * highest-first. No threshold filtering — use this for diagnostics or
 * when you want to inspect raw scores before deciding what to keep.
 */
export function scoreAllChunks(queryVector, embeddedChunks) {
  return embeddedChunks
    .map((chunk) => ({
      id:     chunk.id,
      source: chunk.source,
      text:   chunk.text,
      score:  dotProduct(queryVector, chunk.vector),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Extracts the sequential index from a chunk ID like "expansions_42" → 42.
 * Used for proximity deduplication of overlapping chunks.
 */
function parseChunkIndex(id) {
  const n = parseInt(id?.split('_').pop(), 10);
  return isNaN(n) ? -1 : n;
}

/**
 * Retrieves top-k relevant chunks with two quality guards:
 *
 *  1. Deduplication — if a same-source chunk within ±DEDUP_INDEX_DISTANCE is
 *     already selected, skip it.  Adjacent chunks heavily overlap in text, so
 *     selecting them adds zero new information and just repeats one sentence.
 *
 *  2. Source cap — at most MAX_PER_SOURCE chunks from any single source so
 *     that rules and expansions can both contribute even when one source
 *     dominates the similarity scores.
 */
export function retrieveTopK(queryVector, embeddedChunks, k = TOP_K) {
  const allScored = scoreAllChunks(queryVector, embeddedChunks);
  const selected  = [];
  const countBySource = {};

  for (const chunk of allScored) {
    if (selected.length >= k) break;
    if (chunk.score < MIN_SIMILARITY) break;

    // 1. Source cap.
    const sourceCount = countBySource[chunk.source] ?? 0;
    if (sourceCount >= MAX_PER_SOURCE) continue;

    // 2. Dedup: skip if an already-selected chunk from the same source is
    //    within DEDUP_INDEX_DISTANCE positions (i.e. overlapping text window).
    const chunkIdx   = parseChunkIndex(chunk.id);
    const isDuplicate = selected.some((s) => {
      if (s.source !== chunk.source) return false;
      return Math.abs(parseChunkIndex(s.id) - chunkIdx) <= DEDUP_INDEX_DISTANCE;
    });
    if (isDuplicate) continue;

    selected.push(chunk);
    countBySource[chunk.source] = sourceCount + 1;
  }

  return selected;
}
