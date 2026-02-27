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
  retrieveTopK,
  SOURCE,
} from '../services/RAGService';
import {
  isIndexCurrent,
  saveIndex,
  queryTopK,
} from '../services/VectorStore';

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
      // Skip if the persisted index is already up-to-date.
      if (await isIndexCurrent(contentHash)) {
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
  const retrieve = useCallback(async (query) => {
    if (Platform.OS !== 'android') return null;
    if (!query?.trim()) return null;

    try {
      const queryVector = await embedText(query);
      if (!queryVector) return null;

      let topChunks;

      // Fast path: use in-memory cache if available.
      if (embeddedChunksRef.current.length > 0) {
        topChunks = retrieveTopK(queryVector, embeddedChunksRef.current);
      } else {
        // Slow path: query SQLite-vec.
        topChunks = await queryTopK(queryVector);
      }

      if (!topChunks?.length) return null;

      const rulesChunks      = topChunks.filter((c) => c.source === SOURCE.RULES);
      const expansionChunks  = topChunks.filter((c) => c.source === SOURCE.EXPANSIONS);

      return {
        rulesContext:      rulesChunks.map((c) => c.text).join('\n\n'),
        expansionsContext: expansionChunks.map((c) => c.text).join('\n\n'),
      };
    } catch {
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
