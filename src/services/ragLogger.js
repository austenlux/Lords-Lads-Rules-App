/**
 * In-memory RAG pipeline log for the current app lifecycle.
 * Captures index builds and every retrieval operation for debugging.
 * Cleared on each app launch — no cross-session persistence.
 * Supports real-time listener subscriptions for the Debug menu.
 */

let indexBuildLog = null;
let retrievalLogs = [];
let counter = 0;
const listeners = new Set();

function snapshot() {
  return { indexBuild: indexBuildLog, retrievals: [...retrievalLogs] };
}

function notifyListeners() {
  const s = snapshot();
  listeners.forEach(fn => fn(s));
}

/**
 * Subscribe to real-time RAG log updates.
 * @param {function} callback Called with { indexBuild, retrievals } on every change.
 * @returns {function} Unsubscribe function.
 */
export function onRagLogChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Record an index build event.
 * @param {{ totalChunks, buildTimeMs, totalContentSize, chunks: Array<{ heading, source, charCount, wordCount, tokenEstimate }> }} data
 */
export function logIndexBuild(data) {
  indexBuildLog = { timestamp: new Date().toLocaleString(), ...data };
  notifyListeners();
}

/**
 * Record a retrieval event.
 * @param {{ question, keywords, topK, allScoredChunks, selectedChunks }} data
 */
export function logRetrieval(data) {
  counter += 1;
  retrievalLogs.unshift({
    id: `ret_${counter}`,
    timestamp: new Date().toLocaleString(),
    ...data,
  });
  notifyListeners();
}

/**
 * Patch the most recent retrieval entry with additional data
 * (e.g. prompt length, total context chars computed after retrieval).
 * @param {object} data Fields to merge into the latest retrieval entry.
 */
export function updateLatestRetrieval(data) {
  if (retrievalLogs.length === 0) return;
  Object.assign(retrievalLogs[0], data);
  notifyListeners();
}

/** Return the full RAG log snapshot. */
export function getRagLog() {
  return snapshot();
}

/** Clear all RAG log data for this session. */
export function clearRagLog() {
  indexBuildLog = null;
  retrievalLogs = [];
  counter = 0;
  notifyListeners();
}

/**
 * Format the entire RAG log as a readable plain-text string for clipboard export.
 * @returns {string}
 */
export function formatRagLogAsText() {
  const lines = [];
  lines.push('=== RAG PIPELINE LOG ===');
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push('');

  // Index build section
  lines.push('──────────────────────────────────────');
  lines.push('INDEX BUILD');
  lines.push('──────────────────────────────────────');
  if (indexBuildLog) {
    lines.push(`Timestamp:      ${indexBuildLog.timestamp}`);
    lines.push(`Total chunks:   ${indexBuildLog.totalChunks}`);
    lines.push(`Build time:     ${indexBuildLog.buildTimeMs}ms`);
    lines.push(`Content size:   ${indexBuildLog.totalContentSize} chars`);
    lines.push('');
    lines.push('Chunks:');
    indexBuildLog.chunks.forEach((c, i) => {
      lines.push(`  [${String(i + 1).padStart(2)}] ${c.heading}`);
      lines.push(`       Source: ${c.source} | Chars: ${c.charCount} | Words: ${c.wordCount} | Tokens~: ${c.tokenEstimate}`);
    });
  } else {
    lines.push('No index build recorded.');
  }
  lines.push('');

  // Retrievals section
  if (retrievalLogs.length === 0) {
    lines.push('──────────────────────────────────────');
    lines.push('RETRIEVALS');
    lines.push('──────────────────────────────────────');
    lines.push('No retrievals recorded.');
  } else {
    retrievalLogs.slice().reverse().forEach((entry, ri) => {
      lines.push('──────────────────────────────────────');
      lines.push(`RETRIEVAL #${ri + 1}`);
      lines.push('──────────────────────────────────────');
      lines.push(`Timestamp:  ${entry.timestamp}`);
      if (entry.noIndex) {
        lines.push('⚠ RAG index was not ready — no chunks retrieved');
      }
      lines.push(`Question:   ${entry.question}`);
      lines.push(`Keywords:   ${entry.keywords?.join(', ') || 'none'}`);
      lines.push(`Top-K:      ${entry.topK}`);
      if (entry.totalContextChars != null) {
        lines.push(`Context →LLM: ${entry.totalContextChars} chars`);
      }
      if (entry.promptLength != null) {
        lines.push(`Prompt length: ${entry.promptLength} chars`);
      }
      lines.push('');

      lines.push('All chunks scored (sorted by BM25 score):');
      entry.allScoredChunks?.forEach((c, i) => {
        const tag = c.selected ? ' ★ SELECTED' : '';
        lines.push(`  [${String(i + 1).padStart(2)}] ${c.heading}${tag}`);
        lines.push(`       Score: ${c.score.toFixed(4)} | Source: ${c.source} | Chars: ${c.charCount} | Words: ${c.wordCount}`);
      });
      lines.push('');

      lines.push('Selected chunks sent to LLM:');
      entry.selectedChunks?.forEach((c, i) => {
        lines.push(`  ┌── Chunk ${i + 1}: ${c.heading} (score ${c.score.toFixed(4)}, ${c.source})`);
        c.content.split('\n').forEach(l => lines.push(`  │ ${l}`));
        lines.push('  └──');
        lines.push('');
      });

      lines.push('AI Response:');
      if (entry.aiResponse) {
        entry.aiResponse.split('\n').forEach(l => lines.push(`  ${l}`));
      } else {
        lines.push('  (no response recorded)');
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}
