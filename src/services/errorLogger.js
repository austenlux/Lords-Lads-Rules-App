/**
 * In-memory event log for the current app lifecycle.
 * Cleared on every launch — no cross-session persistence.
 * Supports real-time listener subscriptions for the Debug menu.
 */

const MAX_ENTRIES = 100;

let entries = [];
const listeners = new Set();

function notifyListeners() {
  const snapshot = [...entries];
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Subscribe to real-time event log updates.
 * @param {function} callback - Called with the latest entries array on every change.
 * @returns {function} Unsubscribe function.
 */
export function onEventLogChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}


/**
 * Log the app launch as the first event in this session.
 */
export function logAppLaunch() {
  entries = [];
  const entry = {
    ts: new Date().toLocaleString(),
    type: 'info',
    source: 'App',
    message: 'New session started',
  };
  entries.push(entry);
  notifyListeners();
}

/**
 * Log a non-error event.
 * @param {string} level - 'info' | 'success'
 * @param {string} source - Component/service name
 * @param {string} message - Human-readable description
 * @param {object} [meta] - Optional metadata
 */
export function logEvent(source, message, meta = {}) {
  const isSuccess = /success|complete|available|fetched|returned HTTP 2/i.test(message);
  const entry = {
    ts: new Date().toLocaleString(),
    type: isSuccess ? 'success' : 'info',
    source,
    message,
    ...meta,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  notifyListeners();
}

/**
 * Log an error with context.
 * @param {string} source - Where the error occurred (e.g. 'fetchRules', 'AI Model Download')
 * @param {string|Error} error - The error message or Error object
 * @param {object} [meta] - Optional metadata (url, status, phase, etc.)
 */
export function logError(source, error, meta = {}) {
  const entry = {
    ts: new Date().toLocaleString(),
    type: 'error',
    source,
    message: error instanceof Error ? error.message : String(error),
    ...meta,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  notifyListeners();
}

/**
 * Retrieve all event entries (newest first, except App Launch which stays at the end).
 * @returns {Array}
 */
export function getEventLog() {
  return [...entries];
}


/**
 * Clear all entries for this session.
 */
export function clearEventLog() {
  entries = [];
  notifyListeners();
}


/**
 * Format the entire event log as plain text for clipboard export.
 */
export function formatEventLogAsText() {
  if (entries.length === 0) return 'No events recorded.';
  return entries.map((e) => {
    const type = (e.type || 'info').toUpperCase();
    const parts = [`[${type}] ${e.ts}`, `Source: ${e.source}`, `Message: ${e.message}`];
    if (e.elapsedMs != null) parts.push(`Elapsed: ${e.elapsedMs}ms`);
    if (e.url != null) parts.push(`URL: ${e.url}`);
    if (e.errorName && e.errorName !== 'Error') parts.push(`Error: ${e.errorName}`);
    return parts.join('\n');
  }).join('\n\n---\n\n');
}
