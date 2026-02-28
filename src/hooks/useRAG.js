/**
 * useRAG
 *
 * React hook that orchestrates the FTS5-based retrieval pipeline:
 *   1. Ingest (chunk → persist to FTS5 index) when content changes.
 *   2. Retrieve top-k relevant chunks for a given query via BM25 keyword search.
 *
 * Fully cross-platform — no native embedding model required.
 * Falls back to null (full-content prompting) on error or empty results.
 */

import { useState, useCallback } from 'react';
import {
  chunkText,
  buildFTSQuery,
  applyDedupAndCap,
  SOURCE,
} from '../services/RAGService';
import {
  isIndexCurrent,
  saveIndex,
  getChunkCount,
  queryFTS,
} from '../services/VectorStore';
import { setLastRAGResult } from '../services/RAGDebugStore';

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return String(hash);
}

export function useRAG() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [isReady, setIsReady]       = useState(false);
  const [indexError, setIndexError] = useState(null);

  // ── Ingestion ─────────────────────────────────────────────────────────────

  /**
   * Chunks [rules] and [expansions] and saves them to the FTS5 index.
   * Skips re-ingestion if the content hash matches the persisted index.
   */
  const ingest = useCallback(async (rules, expansions) => {
    const combined = (rules ?? '') + (expansions ?? '');
    if (!combined.trim()) return;

    const contentHash = hashString(combined);

    try {
      const hashCurrent = await isIndexCurrent(contentHash);
      const chunkCount  = hashCurrent ? await getChunkCount() : 0;
      if (hashCurrent && chunkCount > 0) {
        setIsReady(true);
        return;
      }

      setIsIndexing(true);
      setIndexError(null);

      const allChunks = [
        ...chunkText(rules,      SOURCE.RULES),
        ...chunkText(expansions, SOURCE.EXPANSIONS),
      ];

      await saveIndex(allChunks, contentHash);
      setIsReady(true);
    } catch (err) {
      setIndexError(err?.message ?? 'Indexing failed');
      setIsReady(true);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Retrieves the top-k most relevant chunks for [query] using FTS5 BM25 search.
   *
   * Returns { rulesContext, expansionsContext } or null (fall back to full content).
   */
  const retrieve = useCallback(async (query, fullPromptForDebug = '') => {
    if (!query?.trim()) return null;

    const t0 = Date.now();

    try {
      const ftsQuery = buildFTSQuery(query);

      if (!ftsQuery) {
        setLastRAGResult({
          query, chunks: [], rawTopScores: [], usedRAG: false,
          status: 'no_keywords', promptSnippet: '', elapsedMs: Date.now() - t0,
        });
        return null;
      }

      // AND search: all keywords must appear in the chunk. High precision.
      // If AND returns nothing, fall back to full-content prompting — full
      // content gives reliable answers and is better than low-quality OR hits.
      const dbRows = await queryFTS(ftsQuery, 15);

      const elapsedMs = Date.now() - t0;

      const rawTopScores = dbRows.slice(0, 5).map((r) => ({
        source:  r.source,
        score:   r.score,
        preview: r.text?.slice(0, 80) ?? '',
      }));

      if (!dbRows.length) {
        setLastRAGResult({
          query, chunks: [], rawTopScores: [], usedRAG: false,
          status: 'no_and_match', promptSnippet: fullPromptForDebug.slice(0, 800),
          elapsedMs,
        });
        return null;
      }

      const topChunks = applyDedupAndCap(dbRows);

      if (!topChunks?.length) {
        setLastRAGResult({
          query, chunks: [], rawTopScores, usedRAG: false,
          status: 'dedup_filtered', promptSnippet: fullPromptForDebug.slice(0, 800),
          elapsedMs,
        });
        return null;
      }

      const rulesChunks     = topChunks.filter((c) => c.source === SOURCE.RULES);
      const expansionChunks = topChunks.filter((c) => c.source === SOURCE.EXPANSIONS);

      setLastRAGResult({
        query, chunks: topChunks, rawTopScores, usedRAG: true,
        status: 'ok', promptSnippet: fullPromptForDebug.slice(0, 800),
        elapsedMs,
      });

      return {
        rulesContext:      rulesChunks.map((c) => c.text).join('\n\n'),
        expansionsContext: expansionChunks.map((c) => c.text).join('\n\n'),
      };
    } catch (err) {
      setLastRAGResult({
        query, chunks: [], rawTopScores: [], usedRAG: false,
        status: `error: ${err?.message ?? 'unknown'}`,
        promptSnippet: '', elapsedMs: Date.now() - t0,
      });
      return null;
    }
  }, []);

  // warmUp is a no-op now (no embedding model to load) but kept so
  // App.js doesn't need to change.
  const warmUp = useCallback(async () => {}, []);

  return { isIndexing, isReady, indexError, warmUp, ingest, retrieve };
}
