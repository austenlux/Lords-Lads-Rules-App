/**
 * RAGDebugStore
 *
 * Module-level singleton that records every RAG retrieval for the current
 * app lifecycle so the Debug menu can display and export the full session log.
 *
 * History resets when the JS runtime is killed (app killed), matching the
 * conversation lifecycle — no persistence across app restarts.
 */

let _results   = [];   // full session history, oldest first
let _listeners = [];   // (results: Array) => void

/**
 * Records a new RAG retrieval result and notifies subscribers.
 */
export function setLastRAGResult(result) {
  const entry = { ...result, timestamp: Date.now() };
  _results = [..._results, entry];
  _listeners.forEach((fn) => fn(_results));
}

/** Returns the full session history (oldest first). */
export function getAllRAGResults() {
  return _results;
}

/** Returns the most recent result, or null if none yet. */
export function getLastRAGResult() {
  return _results.length > 0 ? _results[_results.length - 1] : null;
}

/**
 * Subscribe to history updates.
 * Listener receives the full results array on every new entry.
 * Returns an unsubscribe function.
 */
export function subscribeToRAGDebug(listener) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
