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
 * Normalises text for duplicate detection: lowercase, replace all
 * punctuation/special characters with spaces, collapse whitespace.
 * This makes the comparison robust to quote styles, markdown symbols,
 * and minor formatting differences between overlapping chunks.
 */
function normaliseForDedup(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if [candidate] shares a distinctive phrase with any already-
 * selected chunk.
 *
 * Uses sliding 5-word windows on normalised text (step of 2 words).
 * 5-word windows are short enough to survive the slight boundary-snapping
 * offsets that chunking produces, while still being specific enough to avoid
 * false positives on common short phrases.
 *
 * Catches both adjacent overlap chunks AND the same sentence repeated in
 * multiple non-adjacent sections of the document.
 */
function isDuplicateContent(candidate, selected) {
  const normCandidate = normaliseForDedup(candidate.text);
  const words = normCandidate.split(' ');

  for (const existing of selected) {
    const normExisting = normaliseForDedup(existing.text);
    for (let i = 0; i <= words.length - 5; i += 2) {
      const phrase = words.slice(i, i + 5).join(' ');
      if (normExisting.includes(phrase)) return true;
    }
  }
  return false;
}

/**
 * Applies content deduplication and source capping to a pre-scored,
 * pre-sorted list of chunks.  Shared by both the in-memory and DB retrieval
 * paths so dedup is always applied regardless of which path is taken.
 *
 *  1. Source cap — at most MAX_PER_SOURCE chunks from any single source.
 *  2. Content dedup — skip if a 5-word normalised phrase already appears in
 *     a selected chunk (catches repeated sentences and overlapping windows).
 *
 * @param {Array<{id, source, text, score}>} scoredChunks  Pre-sorted high→low.
 * @param {number} [k]
 */
export function applyDedupAndCap(scoredChunks, k = TOP_K) {
  const selected      = [];
  const countBySource = {};

  for (const chunk of scoredChunks) {
    if (selected.length >= k) break;
    if (chunk.score < MIN_SIMILARITY) break;

    const sourceCount = countBySource[chunk.source] ?? 0;
    if (sourceCount >= MAX_PER_SOURCE) continue;
    if (isDuplicateContent(chunk, selected)) continue;

    selected.push(chunk);
    countBySource[chunk.source] = sourceCount + 1;
  }

  return selected;
}

export function retrieveTopK(queryVector, embeddedChunks, k = TOP_K) {
  return applyDedupAndCap(scoreAllChunks(queryVector, embeddedChunks), k);
}
