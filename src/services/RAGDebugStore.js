/**
 * RAGDebugStore
 *
 * Module-level singleton that records the last RAG retrieval so the
 * Debug menu in the About tab can display it without prop-drilling.
 *
 * Not a React hook — just plain JS get/set so it can be written from
 * useRAG (deep in the hook tree) and read from AboutScreen (sibling tree).
 */

let _lastResult = null;
let _listeners  = [];

/**
 * Called by useRAG after every retrieve() call.
 * @param {{
 *   query:       string,
 *   chunks:      Array<{id, source, text, score}>,
 *   usedRAG:     boolean,   // false = fell back to full content
 *   promptSnippet: string,  // first 800 chars of the final prompt sent to LLM
 *   elapsedMs:   number,
 * }} result
 */
export function setLastRAGResult(result) {
  _lastResult = { ...result, timestamp: Date.now() };
  _listeners.forEach((fn) => fn(_lastResult));
}

/** Returns the most recent RAG debug snapshot (or null). */
export function getLastRAGResult() {
  return _lastResult;
}

/**
 * Subscribe to result updates. Returns an unsubscribe function.
 * @param {(result) => void} listener
 */
export function subscribeToRAGDebug(listener) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
