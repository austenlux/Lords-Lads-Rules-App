/**
 * RAGService
 *
 * Cross-platform Retrieval-Augmented Generation pipeline using SQLite FTS5
 * (BM25 keyword search) instead of vector embeddings.
 *
 * FTS5 with porter stemming is more reliable than 100-dim semantic embeddings
 * for game rule lookup: users ask about specific game terms ("hammer", "spark",
 * "lord") that are better matched by exact/stemmed keyword search than by
 * cosine similarity on a general-purpose embedding model.
 *
 * Responsibilities:
 *  1. Chunk raw Markdown text into overlapping segments.
 *  2. Build a keyword query from the user's spoken question.
 *  3. Search the FTS5 index and return the top-k most relevant chunks.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE     = 800;
const CHUNK_OVERLAP  = 100;
const TOP_K          = 5;
const MAX_PER_SOURCE = 3;

// Minimum BM25 score to include a chunk. BM25 relevance is open-ended so we
// use a low floor just to exclude truly zero-match results.
export const MIN_SIMILARITY = 0.01;

export const SOURCE = {
  RULES:      'rules',
  EXPANSIONS: 'expansions',
};

// Stop words filtered out when building the FTS keyword query.
// Keeping question words in ensures only game-relevant terms drive the search.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of',
  'and', 'or', 'but', 'not', 'no', 'so', 'yet', 'if', 'as', 'by',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your',
  'he', 'she', 'they', 'them', 'their', 'its',
  'this', 'that', 'these', 'those',
  'what', 'when', 'where', 'who', 'which', 'why', 'how',
  'does', 'do', 'did', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'will', 'would', 'could', 'should', 'can', 'may',
  'get', 'got', 'go', 'goes', 'went',
  'tell', 'say', 'says', 'said', 'mean', 'means',
  'happen', 'happens', 'happening', 'happened',
  'know', 'need', 'want',
]);

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

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ id: `${source}_${index++}`, source, text: chunk });
    }

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

// ── Query builder ─────────────────────────────────────────────────────────────

/**
 * Converts a natural-language question into an FTS5 keyword query.
 * Removes stop words and short tokens; remaining words are joined with
 * implicit AND so all keywords must appear (FTS5 default).
 *
 * Falls back to an OR query (any keyword) if AND returns nothing.
 * Returns null if no usable keywords can be extracted.
 *
 * @param {string} question
 * @returns {string | null}
 */
export function buildFTSQuery(question) {
  if (!question?.trim()) return null;

  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return null;

  // FTS5 implicit AND: all keywords must appear in the chunk.
  // This is intentionally strict — precise co-occurrence is a strong
  // relevance signal for game rule queries (e.g. "drop hammer").
  // When AND yields no results, useRAG falls back to full-content
  // prompting which reliably gives correct answers.
  return words.join(' ');
}

// ── Deduplication & source cap ────────────────────────────────────────────────

function normaliseForDedup(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * Applies content deduplication and per-source capping to a pre-scored,
 * pre-sorted list of chunks.
 *
 * @param {Array<{id, source, text, score}>} scoredChunks  Sorted high→low.
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
