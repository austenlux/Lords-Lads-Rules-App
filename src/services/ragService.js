/**
 * RAG (Retrieval-Augmented Generation) service for the game rules assistant.
 *
 * Chunks rulebook markdown by heading, builds an in-memory BM25 search index,
 * and retrieves the most relevant chunks for a given user query. The index is
 * rebuilt on each app launch after content fetch — no persistence needed.
 */

import { logEvent } from './errorLogger';
import { logIndexBuild, logRetrieval } from './ragLogger';

const LOG_SOURCE = 'RAG';

// ── BM25 tuning parameters ──────────────────────────────────────────────────

const BM25_K1 = 1.2;
const BM25_B = 0.3;

// ── Stopwords (common English words that add noise to keyword matching) ─────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'it',
  'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'they', 'them', 'their', 'this', 'that', 'these',
  'those', 'what', 'which', 'who', 'whom',
]);

// ── Tokenization ─────────────────────────────────────────────────────────────

function stem(word) {
  if (word.length <= 3) return word;
  return word.replace(/(ing|ed|s)$/, '');
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

// ── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Split markdown into semantic chunks by `##` headings.
 * Each chunk includes its heading hierarchy for context — if a `###` subsection
 * exists, its parent `##` heading is prepended so the LLM knows the context.
 *
 * @param {string} markdown  Raw markdown content.
 * @param {string} source    Label for the chunk source ('rules' | 'expansions').
 * @returns {Array<{ heading: string, content: string, source: string }>}
 */
function chunkMarkdown(markdown, source) {
  if (!markdown?.trim()) return [];

  const lines = markdown.split('\n');
  const chunks = [];
  let currentH1 = '';
  let currentH2 = '';
  let currentLines = [];
  let currentHeading = '';

  const flush = () => {
    const body = currentLines.join('\n').trim();
    if (currentHeading && body) {
      const headingContext = currentH1 && currentH2 && currentHeading === currentH2
        ? `${currentH1} > ${currentH2}`
        : currentHeading;
      chunks.push({
        heading: headingContext,
        content: `${currentHeading}\n${body}`,
        source,
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const isH1 = /^# /.test(line) && !/^## /.test(line);
    const isH2 = /^## /.test(line) && !/^### /.test(line);

    if (isH1) {
      flush();
      currentH1 = line.replace(/^# /, '').trim();
      currentH2 = '';
      currentHeading = line;
    } else if (isH2) {
      flush();
      currentH2 = line.replace(/^## /, '').trim();
      currentHeading = line;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return chunks;
}

// ── BM25 Index ───────────────────────────────────────────────────────────────

/**
 * Build an in-memory BM25 search index from rules and expansions markdown.
 *
 * @param {string} rulesMarkdown      Raw rules markdown.
 * @param {string} expansionsMarkdown Raw expansions markdown.
 * @returns {{ chunks: Array, idf: Map, avgDl: number, chunkTokens: Array, totalChunks: number }}
 */
export function buildIndex(rulesMarkdown, expansionsMarkdown) {
  const t0 = Date.now();

  const rulesChunks = chunkMarkdown(rulesMarkdown, 'rules');
  const expansionsChunks = chunkMarkdown(expansionsMarkdown, 'expansions');
  const chunks = [...rulesChunks, ...expansionsChunks];

  if (chunks.length === 0) {
    logEvent(LOG_SOURCE, 'Index built with 0 chunks (no content)');
    return { chunks: [], idf: new Map(), avgDl: 0, chunkTokens: [], totalChunks: 0 };
  }

  const chunkTokens = chunks.map(c => tokenize(c.content));
  const N = chunks.length;
  const avgDl = chunkTokens.reduce((sum, t) => sum + t.length, 0) / N;

  // Document frequency: how many chunks contain each term.
  const df = new Map();
  for (const tokens of chunkTokens) {
    const seen = new Set(tokens);
    for (const term of seen) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // IDF: inverse document frequency with smoothing.
  const idf = new Map();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));
  }

  const elapsed = Date.now() - t0;
  logEvent(LOG_SOURCE, `Index built: ${chunks.length} chunks in ${elapsed}ms`);

  logIndexBuild({
    totalChunks: chunks.length,
    buildTimeMs: elapsed,
    totalContentSize: chunks.reduce((sum, c) => sum + c.content.length, 0),
    chunks: chunks.map(c => ({
      heading: c.heading,
      source: c.source,
      charCount: c.content.length,
      wordCount: c.content.split(/\s+/).filter(Boolean).length,
      tokenEstimate: Math.ceil(c.content.length / 4),
    })),
  });

  return { chunks, idf, avgDl, chunkTokens, totalChunks: chunks.length };
}

// ── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Score and return the top-K most relevant chunks for a query.
 *
 * @param {{ chunks, idf, avgDl, chunkTokens, totalChunks }} index
 * @param {string} query     The user's question.
 * @param {number} [topK=5]  Number of chunks to retrieve.
 * @returns {Array<{ heading: string, content: string, source: string, score: number }>}
 */
export function retrieveRelevantChunks(index, query, topK = 5) {
  if (!index || !index.chunks.length || !query?.trim()) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const { chunks, idf, avgDl, chunkTokens } = index;
  const scores = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i++) {
    const docTokens = chunkTokens[i];
    const dl = docTokens.length;

    // Build term frequency map for this chunk.
    const tf = new Map();
    for (const t of docTokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }

    let score = 0;
    for (const qt of queryTokens) {
      const termIdf = idf.get(qt) || 0;
      const termTf = tf.get(qt) || 0;
      const numerator = termTf * (BM25_K1 + 1);
      const denominator = termTf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgDl));
      score += termIdf * (numerator / denominator);
    }
    scores[i] = score;
  }

  // Rank all chunks by score for logging, then select top-K with score > 0.
  const scoredWithIdx = chunks.map((chunk, i) => ({ chunk, score: scores[i], idx: i }));
  scoredWithIdx.sort((a, b) => b.score - a.score);

  const selected = scoredWithIdx.filter(e => e.score > 0).slice(0, topK);
  const selectedIdxSet = new Set(selected.map(e => e.idx));

  logRetrieval({
    question: query,
    keywords: queryTokens,
    topK,
    allScoredChunks: scoredWithIdx.map(e => ({
      heading: e.chunk.heading,
      score: e.score,
      selected: selectedIdxSet.has(e.idx),
      charCount: e.chunk.content.length,
      wordCount: e.chunk.content.split(/\s+/).filter(Boolean).length,
      source: e.chunk.source,
    })),
    selectedChunks: selected.map(e => ({
      heading: e.chunk.heading,
      content: e.chunk.content,
      score: e.score,
      source: e.chunk.source,
    })),
  });

  return selected.map(e => ({ ...e.chunk, score: e.score }));
}
