/**
 * useRAG
 *
 * React hook that orchestrates the full RAG pipeline:
 *   1. Ingest (chunk → embed → persist) when content changes.
 *   2. Retrieve top-k relevant chunks for a given query.
 *
 * Cross-platform: works on Android (MediaPipe embedder) and iOS
 * (once NativeEmbedder is implemented for iOS).
 *
 * On platforms where embedding is unavailable (or fails), the hook
 * falls back gracefully: retrieve() returns null so the caller can
 * fall back to full-content prompting.
 */

import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NativeEmbedder from '../specs/NativeEmbedder';
import {
  chunkText,
  embedChunks,
  embedText,
  scoreAllChunks,
  retrieveTopK,
  applyDedupAndCap,
  MIN_SIMILARITY,
  SOURCE,
} from '../services/RAGService';
import {
  isIndexCurrent,
  saveIndex,
  queryTopK,
  getChunkCount,
} from '../services/VectorStore';
import { setLastRAGResult } from '../services/RAGDebugStore';

// djb2 hash — must match the one in VectorStore.js
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

  // In-memory cache of embedded chunks — used as a fast path so we don't
  // need a DB round-trip on every query once the index is warm.
  const embeddedChunksRef = useRef([]);

  // ── Warm up embedder on first use ─────────────────────────────────────────

  const warmUp = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await NativeEmbedder.warmUp();
    } catch {
      // Non-fatal — embedText will attempt to load the model on demand.
    }
  }, []);

  // ── Ingestion ─────────────────────────────────────────────────────────────

  /**
   * Ingests [rules] and [expansions] into the vector index.
   * Skips re-ingestion if the content hash matches the persisted index.
   *
   * @param {string} rules
   * @param {string} expansions
   */
  const ingest = useCallback(async (rules, expansions) => {
    if (Platform.OS !== 'android') {
      // iOS: mark ready so the caller can fall back to full-content prompting.
      setIsReady(true);
      return;
    }

    const combined = (rules ?? '') + (expansions ?? '');
    if (!combined.trim()) return;

    const contentHash = hashString(combined);

    try {
      // Skip only if the hash matches AND the DB actually has chunks.
      // A previous failed ingestion can save the hash but leave 0 chunks,
      // which would cause every query to fall back forever.
      const hashCurrent = await isIndexCurrent(contentHash);
      const chunkCount  = hashCurrent ? await getChunkCount() : 0;
      if (hashCurrent && chunkCount > 0) {
        setIsReady(true);
        return;
      }

      setIsIndexing(true);
      setIndexError(null);

      // 1. Chunk both sources.
      const rulesChunks      = chunkText(rules,      SOURCE.RULES);
      const expansionChunks  = chunkText(expansions, SOURCE.EXPANSIONS);
      const allChunks        = [...rulesChunks, ...expansionChunks];

      // 2. Embed all chunks (calls NativeEmbedder per chunk).
      const embedded = await embedChunks(allChunks);

      // 3. Persist to SQLite-vec and cache in memory.
      await saveIndex(embedded, contentHash);
      embeddedChunksRef.current = embedded;

      setIsReady(true);
    } catch (err) {
      setIndexError(err?.message ?? 'Indexing failed');
      // Even on error, mark ready so the caller can fall back gracefully.
      setIsReady(true);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Retrieves the top-k most relevant text chunks for [query].
   *
   * Returns an object with:
   *   rulesContext      {string}  relevant rules snippets, joined
   *   expansionsContext {string}  relevant expansions snippets, joined
   *
   * Returns null if RAG is not available (iOS, not yet indexed, or error),
   * so the caller can fall back to full-content prompting.
   *
   * @param {string} query
   * @returns {Promise<{rulesContext: string, expansionsContext: string} | null>}
   */
  const retrieve = useCallback(async (query, fullPromptForDebug = '') => {
    if (Platform.OS !== 'android') return null;
    if (!query?.trim()) return null;

    const t0 = Date.now();

    try {
      const queryVector = await embedText(query);

      if (!queryVector) {
        // Embedder failed — record so the debug panel shows the failure.
        setLastRAGResult({
          query,
          chunks: [],
          usedRAG: false,
          status: 'embedder_failed',
          promptSnippet: '',
          elapsedMs: Date.now() - t0,
        });
        return null;
      }

      let topChunks;
      let rawTopScores = []; // pre-filter scores for diagnostics

      // Fast path: use in-memory cache if available.
      if (embeddedChunksRef.current.length > 0) {
        const allScored = scoreAllChunks(queryVector, embeddedChunksRef.current);
        // Capture top-5 raw scores for the debug panel (before threshold).
        rawTopScores = allScored.slice(0, 5).map((c) => ({
          source: c.source,
          score:  c.score,
          preview: c.text.slice(0, 80),
        }));
        topChunks = allScored
          .filter((c) => c.score >= MIN_SIMILARITY)
          .slice(0, 5);
      } else {
        // Slow path: query SQLite-vec.  Fetch more rows than needed so that
        // dedup + source-cap have enough candidates to fill k slots after
        // eliminating near-duplicate chunks.
        // sqlite-vec returns `distance` (lower = more similar); normalise to
        // `score` = 1 − distance for a consistent 0-1 scale.
        const dbRows = await queryTopK(queryVector, 30);
        const normalised = (dbRows ?? [])
          .map((r) => ({ ...r, score: r.score ?? (1 - (r.distance ?? 1)) }))
          .sort((a, b) => b.score - a.score);

        rawTopScores = normalised.slice(0, 5).map((c) => ({
          source:  c.source,
          score:   c.score,
          preview: c.text?.slice(0, 80) ?? '',
        }));
        // Apply the same dedup + source-cap as the in-memory path.
        topChunks = applyDedupAndCap(normalised);
      }

      const elapsedMs = Date.now() - t0;

      // Fall back if fewer than 2 unique chunks survived dedup+threshold.
      // A single chunk gives the model almost no context; full content is
      // more useful than one isolated snippet.
      if (!topChunks?.length || topChunks.length < 2) {
        setLastRAGResult({
          query,
          chunks: [],
          rawTopScores,
          usedRAG: false,
          status: 'below_threshold',
          promptSnippet: fullPromptForDebug.slice(0, 800),
          elapsedMs,
        });
        return null;
      }

      const rulesChunks     = topChunks.filter((c) => c.source === SOURCE.RULES);
      const expansionChunks = topChunks.filter((c) => c.source === SOURCE.EXPANSIONS);

      setLastRAGResult({
        query,
        chunks: topChunks,
        rawTopScores,
        usedRAG: true,
        status: 'ok',
        promptSnippet: fullPromptForDebug.slice(0, 800),
        elapsedMs,
      });

      return {
        rulesContext:      rulesChunks.map((c) => c.text).join('\n\n'),
        expansionsContext: expansionChunks.map((c) => c.text).join('\n\n'),
      };
    } catch (err) {
      setLastRAGResult({
        query,
        chunks: [],
        usedRAG: false,
        status: `error: ${err?.message ?? 'unknown'}`,
        promptSnippet: '',
        elapsedMs: Date.now() - t0,
      });
      return null;
    }
  }, []);

  return {
    /** true while the index is being built */
    isIndexing,
    /** true once the index is ready (or graceful fallback is in effect) */
    isReady,
    /** non-null if indexing failed (app still functions via fallback) */
    indexError,
    warmUp,
    ingest,
    retrieve,
  };
}
