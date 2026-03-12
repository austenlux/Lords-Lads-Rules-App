/**
 * Lightweight error logger that persists recent errors to AsyncStorage
 * and exposes them for the Debug menu.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lnl_error_log';
const MAX_ENTRIES = 50;

let cachedEntries = null;

/**
 * Log an error with context.
 * @param {string} source - Where the error occurred (e.g. 'fetchRules', 'fetchExpansions')
 * @param {string|Error} error - The error message or Error object
 * @param {object} [meta] - Optional metadata (url, status, etc.)
 */
export async function logError(source, error, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    source,
    message: error instanceof Error ? error.message : String(error),
    ...meta,
  };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    cachedEntries = entries;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (_) {}
}

/**
 * Retrieve all stored error entries (newest first).
 * @returns {Promise<Array>}
 */
export async function getErrorLog() {
  if (cachedEntries) return cachedEntries;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedEntries = raw ? JSON.parse(raw) : [];
    return cachedEntries;
  } catch (_) {
    return [];
  }
}

/**
 * Clear all stored error entries.
 */
export async function clearErrorLog() {
  cachedEntries = [];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}
