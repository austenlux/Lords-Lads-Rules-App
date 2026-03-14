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
 * Split markdown into semantic chunks by `##` and `###` headings.
 * Each chunk includes its heading hierarchy for context so the LLM knows
 * which section each snippet belongs to (e.g. "IV - Taking a Turn > IV.A - Flip").
 *
 * Sections without `###` sub-headings remain as single `##` chunks.
 *
 * @param {string} markdown  Raw markdown content.
 * @param {string} source    Label for the chunk source ('rules' | 'expansions').
 * @returns {Array<{ heading: string, content: string, source: string, parentSection: string, sectionName: string }>}
 */
function chunkMarkdown(markdown, source) {
  if (!markdown?.trim()) return [];

  const lines = markdown.split('\n');
  const chunks = [];
  let currentH1 = '';
  let currentH2 = '';
  let currentH3 = '';
  let currentLines = [];
  let currentHeading = '';

  const flush = () => {
    const body = currentLines.join('\n').trim();
    if (currentHeading && body) {
      let headingContext;
      if (currentH3 && currentH2) {
        headingContext = `${currentH2} > ${currentH3}`;
      } else if (currentH1 && currentH2) {
        headingContext = `${currentH1} > ${currentH2}`;
      } else {
        headingContext = currentHeading;
      }

      const sectionName = currentH3 || currentH2 || currentH1;
      const parentSection = currentH3 ? currentH2 : (currentH2 ? currentH1 : '');

      chunks.push({
        heading: headingContext,
        content: `${currentHeading}\n${body}`,
        source,
        sectionName,
        parentSection,
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const isH1 = /^# /.test(line) && !/^## /.test(line);
    const isH2 = /^## /.test(line) && !/^### /.test(line);
    const isH3 = /^### /.test(line) && !/^#### /.test(line);

    if (isH1) {
      flush();
      currentH1 = line.replace(/^# /, '').trim();
      currentH2 = '';
      currentH3 = '';
      currentHeading = line;
    } else if (isH2) {
      flush();
      currentH2 = line.replace(/^## /, '').trim();
      currentH3 = '';
      currentHeading = line;
    } else if (isH3) {
      flush();
      currentH3 = line.replace(/^### /, '').trim();
      currentHeading = line;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return chunks;
}

// ── Phase-Specific Cross-Reference ───────────────────────────────────────

const PHASE_KEYWORDS = [
  'flip', 'strike', 'drink', 'hammer test', 'demotions',
  'uprising', 'penalties', 'resetting nails', 'sparks',
];

/**
 * Extract the game-phase keyword from a section name, if it matches one of
 * the known phase headings. Returns null for non-phase sections.
 *
 * @param {string} sectionName  e.g. "IV.A - Flip" → "flip"
 * @returns {string|null}
 */
function extractPhaseKeyword(sectionName) {
  if (!sectionName) return null;
  const lower = sectionName.toLowerCase();
  return PHASE_KEYWORDS.find(phase => lower.includes(phase)) || null;
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

  // Build cross-references using only recognised game-phase keywords.
  const sectionPhases = chunks.map(c => extractPhaseKeyword(c.sectionName));

  for (let i = 0; i < chunks.length; i++) {
    const bodyLower = chunks[i].content.toLowerCase();
    const refs = [];
    for (let j = 0; j < chunks.length; j++) {
      if (i === j) continue;
      const phase = sectionPhases[j];
      if (phase && bodyLower.includes(phase)) {
        refs.push(chunks[j].sectionName);
      }
    }
    chunks[i].crossRefs = refs;
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
      crossRefs: c.crossRefs,
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
 * @param {number} [topK=8]  Number of chunks to retrieve.
 * @returns {Array<{ heading: string, content: string, source: string, score: number }>}
 */
export function retrieveRelevantChunks(index, query, topK = 8) {
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

  // Re-sort selected chunks by original document order so the LLM reads
  // rules in their natural sequence rather than by relevance score.
  selected.sort((a, b) => a.idx - b.idx);

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
      originalIndex: e.idx,
    })),
  });

  return selected.map(e => ({ ...e.chunk, score: e.score, originalIndex: e.idx }));
}

// ── Post-Retrieval Processing ─────────────────────────────────────────────

const MERGE_SIZE_CAP = 5000;
const CROSS_REF_BRIDGE = 'IMPORTANT: The following rules describe different consequences of the same game event. Include ALL consequences in your answer:\n\n';
const MAX_FINAL_CHUNKS = 3;
const MAX_CONTEXT_CHARS = 4000;

/**
 * Three-stage post-retrieval processing: smart filtering (top-3 + siblings +
 * cross-ref affinity), phase-specific cross-reference merging (no cascading),
 * and same-parent merging.
 *
 * @param {Array<{ heading, content, source, score, originalIndex, sectionName, parentSection, crossRefs }>} selectedChunks
 * @returns {{ chunks: Array, log: { filtered: Array, crossRefMerges: Array, parentMerges: Array, finalCount: number } }}
 */
export function filterAndMerge(selectedChunks) {
  if (!selectedChunks?.length) {
    return { chunks: [], log: { filtered: [], crossRefMerges: [], parentMerges: [], finalCount: 0 } };
  }

  const logData = { filtered: [], crossRefMerges: [], parentMerges: [], finalCount: 0 };

  // ── Stage 1: Smart Filtering ──────────────────────────────────────────
  // Keep: top-3 by score, siblings (same parentSection) of any top-3
  // chunk, and any chunk with a direct phase cross-ref to a top-3 chunk.
  const TOP_N = 3;
  const byScore = [...selectedChunks].sort((a, b) => b.score - a.score);
  const top3 = byScore.slice(0, TOP_N);
  const top3Indices = new Set(top3.map(c => c.originalIndex));
  const top3Parents = new Set(top3.map(c => c.parentSection).filter(Boolean));
  const top3Names = new Set(top3.map(c => c.sectionName));

  let survivors = [];
  for (const chunk of selectedChunks) {
    const isTop = top3Indices.has(chunk.originalIndex);
    const isSibling = chunk.parentSection && top3Parents.has(chunk.parentSection);
    const hasXrefToTop = chunk.crossRefs?.some(ref => top3Names.has(ref))
      || top3.some(t => t.crossRefs?.includes(chunk.sectionName));

    if (isTop || isSibling || hasXrefToTop) {
      survivors.push({ ...chunk });
    } else {
      logData.filtered.push({
        heading: chunk.heading,
        score: chunk.score,
        reason: 'No top-3 affinity (not top-3, no shared parent, no direct cross-ref)',
      });
    }
  }

  // ── Stage 2: Cross-Reference Merging (phase-specific, no cascading) ──
  // Sort by BM25 score descending so the highest-scored chunk claims its
  // cross-ref partner first, preventing lower-scored chunks from consuming
  // a partner that a higher-scored chunk needs.
  survivors.sort((a, b) => b.score - a.score);
  const mergedIndices = new Set();

  for (let i = 0; i < survivors.length; i++) {
    if (mergedIndices.has(i)) continue;
    for (let j = i + 1; j < survivors.length; j++) {
      if (mergedIndices.has(j)) continue;
      const a = survivors[i];
      const b = survivors[j];
      if (!a.crossRefs?.includes(b.sectionName) && !b.crossRefs?.includes(a.sectionName)) continue;

      const [first, second] = a.score <= b.score ? [a, b] : [b, a];
      const combined = `${CROSS_REF_BRIDGE}${first.content}\n\n${second.content}`;
      if (combined.length > MERGE_SIZE_CAP) continue;

      logData.crossRefMerges.push({
        from: [first.heading, second.heading],
        reason: 'Shared phase cross-reference',
      });

      survivors[i] = {
        heading: `${first.heading} + ${second.heading}`,
        content: combined,
        source: first.source,
        score: Math.max(first.score, second.score),
        originalIndex: Math.min(first.originalIndex, second.originalIndex),
        sectionName: `${first.sectionName} + ${second.sectionName}`,
        parentSection: first.parentSection || second.parentSection,
        crossRefs: [...(first.crossRefs || []), ...(second.crossRefs || [])],
        merged: true,
      };
      mergedIndices.add(j);
      break;
    }
  }

  survivors = survivors.filter((_, i) => !mergedIndices.has(i));

  // ── Stage 3: Same-Parent Merging ───────────────────────────────────────
  // Chunks already combined by cross-ref merge are excluded — they form
  // focused, high-signal pairs that same-parent merging would dilute.
  const parentGroups = new Map();
  const noParent = [];

  for (const chunk of survivors) {
    if (chunk.merged) {
      noParent.push(chunk);
    } else if (chunk.parentSection) {
      const key = chunk.parentSection;
      if (!parentGroups.has(key)) parentGroups.set(key, []);
      parentGroups.get(key).push(chunk);
    } else {
      noParent.push(chunk);
    }
  }

  const finalChunks = [...noParent];
  for (const [parent, group] of parentGroups) {
    if (group.length < 2) {
      finalChunks.push(...group);
      continue;
    }

    group.sort((a, b) => a.originalIndex - b.originalIndex);
    const combinedContent = group.map(c => c.content).join('\n\n');

    if (combinedContent.length <= MERGE_SIZE_CAP) {
      logData.parentMerges.push({
        parent,
        merged: group.map(c => c.heading),
      });
      finalChunks.push({
        heading: group.map(c => c.heading).join(' + '),
        content: combinedContent,
        source: group[0].source,
        score: Math.max(...group.map(c => c.score)),
        originalIndex: Math.min(...group.map(c => c.originalIndex)),
        sectionName: group.map(c => c.sectionName).join(' + '),
        parentSection: parent,
        crossRefs: group.flatMap(c => c.crossRefs || []),
        merged: true,
      });
    } else {
      // Exceeds size cap — keep only the highest-scoring sub-chunks within budget.
      group.sort((a, b) => b.score - a.score);
      let budget = MERGE_SIZE_CAP;
      const kept = [];
      for (const chunk of group) {
        if (chunk.content.length <= budget) {
          kept.push(chunk);
          budget -= chunk.content.length;
        }
      }
      if (kept.length >= 2) {
        kept.sort((a, b) => a.originalIndex - b.originalIndex);
        logData.parentMerges.push({ parent, merged: kept.map(c => c.heading) });
        finalChunks.push({
          heading: kept.map(c => c.heading).join(' + '),
          content: kept.map(c => c.content).join('\n\n'),
          source: kept[0].source,
          score: Math.max(...kept.map(c => c.score)),
          originalIndex: Math.min(...kept.map(c => c.originalIndex)),
          sectionName: kept.map(c => c.sectionName).join(' + '),
          parentSection: parent,
          crossRefs: kept.flatMap(c => c.crossRefs || []),
          merged: true,
        });
      } else {
        finalChunks.push(...kept.length ? kept : [group[0]]);
      }
    }
  }

  // ── Stage 4: Context Cap ────────────────────────────────────────────────
  // Keep at most MAX_FINAL_CHUNKS, sorted by highest score. If total context
  // still exceeds MAX_CONTEXT_CHARS, drop the lowest-scoring chunks.
  finalChunks.sort((a, b) => b.score - a.score);

  const cappedChunks = [];
  let totalChars = 0;
  const dropped = [];

  for (const chunk of finalChunks.slice(0, MAX_FINAL_CHUNKS)) {
    if (totalChars + chunk.content.length <= MAX_CONTEXT_CHARS || cappedChunks.length === 0) {
      cappedChunks.push(chunk);
      totalChars += chunk.content.length;
    } else {
      dropped.push({ heading: chunk.heading, score: chunk.score, reason: `Exceeds ${MAX_CONTEXT_CHARS} char context cap` });
    }
  }

  for (const chunk of finalChunks.slice(MAX_FINAL_CHUNKS)) {
    dropped.push({ heading: chunk.heading, score: chunk.score, reason: `Beyond top-${MAX_FINAL_CHUNKS} chunk cap` });
  }

  if (dropped.length) {
    logData.contextCapDropped = dropped;
  }

  cappedChunks.sort((a, b) => a.originalIndex - b.originalIndex);
  logData.finalCount = cappedChunks.length;

  return { chunks: cappedChunks, log: logData };
}

// ── Sentence-Level Extractive Compression ─────────────────────────────────

const SENTENCE_SPLIT_RE = /(?<=[a-z)])\. /;

/**
 * Compress each chunk by extracting only the sentences that overlap with the
 * user's query tokens. Headings are always preserved. When no body sentence
 * matches, the single highest-scoring sentence is kept as a fallback.
 *
 * @param {Array<{ heading, content, source, score, originalIndex }>} chunks
 * @param {string} query  Raw user question string.
 * @returns {{ chunks: Array, log: Array<{ heading, originalChars, extractedChars, sentenceCount, extractedCount, sentences }> }}
 */
export function extractRelevantSentences(chunks, query) {
  const queryTokens = new Set(tokenize(query));
  const compressedChunks = [];
  const extractionLog = [];

  for (const chunk of chunks) {
    let content = chunk.content;
    let hasBridge = false;

    if (content.startsWith(CROSS_REF_BRIDGE)) {
      hasBridge = true;
      content = content.slice(CROSS_REF_BRIDGE.length);
    }

    const paragraphs = content.split('\n\n');
    const processed = [];
    const allSentences = [];

    for (const rawPara of paragraphs) {
      const para = rawPara.trim();
      if (!para) continue;

      if (para.startsWith('#')) {
        processed.push({ isHeading: true, text: para });
        allSentences.push({ text: para, score: Infinity, kept: true });
        continue;
      }

      const sentenceTexts = para.split(SENTENCE_SPLIT_RE);
      const sentences = sentenceTexts.map(s => {
        const sentTokens = new Set(tokenize(s));
        let score = 0;
        for (const qt of queryTokens) {
          if (sentTokens.has(qt)) score++;
        }
        return { text: s, score, kept: score > 0 };
      });

      processed.push({ isHeading: false, sentences });
      allSentences.push(...sentences);
    }

    const nonHeadingSentences = allSentences.filter(s => s.score !== Infinity);
    const anyKept = nonHeadingSentences.some(s => s.kept);

    if (!anyKept && nonHeadingSentences.length > 0) {
      let best = nonHeadingSentences[0];
      for (const s of nonHeadingSentences) {
        if (s.score > best.score) best = s;
      }
      best.kept = true;
    }

    const outputParts = [];
    for (const p of processed) {
      if (p.isHeading) {
        outputParts.push(p.text);
      } else {
        const kept = p.sentences.filter(s => s.kept);
        if (kept.length > 0) {
          outputParts.push(kept.map(s => s.text).join('. '));
        }
      }
    }

    let extractedContent = outputParts.join('\n\n');
    if (hasBridge) {
      extractedContent = CROSS_REF_BRIDGE + extractedContent;
    }

    compressedChunks.push({ ...chunk, content: extractedContent });

    extractionLog.push({
      heading: chunk.heading,
      score: chunk.score,
      source: chunk.source,
      originalChars: chunk.content.length,
      extractedChars: extractedContent.length,
      extractedContent,
      sentenceCount: nonHeadingSentences.length,
      extractedCount: nonHeadingSentences.filter(s => s.kept).length,
      sentences: allSentences.map(s => ({
        text: s.text.substring(0, 80),
        score: s.score === Infinity ? '∞' : s.score,
        kept: s.kept,
      })),
    });
  }

  return { chunks: compressedChunks, log: extractionLog };
}
