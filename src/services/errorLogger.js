/**
 * Lightweight error logger that persists recent errors to AsyncStorage
 * and exposes them for the Debug menu with real-time listener support.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lnl_error_log';
const MAX_ENTRIES = 50;

let cachedEntries = null;
const listeners = new Set();

function notifyListeners() {
  const snapshot = cachedEntries ? [...cachedEntries] : [];
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Subscribe to real-time error log updates.
 * @param {function} callback - Called with the latest entries array on every change.
 * @returns {function} Unsubscribe function.
 */
export function onErrorLogChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Insert a lifecycle divider into the log to mark a new app launch.
 */
export async function logAppLaunch() {
  const entry = {
    ts: new Date().toLocaleString(),
    source: '── App Launch ──',
    message: 'New session started',
    isDivider: true,
  };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    cachedEntries = entries;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    notifyListeners();
  } catch (_) {}
}

/**
 * Log an error with context.
 * @param {string} source - Where the error occurred (e.g. 'fetchRules', 'AI Model Download')
 * @param {string|Error} error - The error message or Error object
 * @param {object} [meta] - Optional metadata (url, status, phase, etc.)
 */
export async function logError(source, error, meta = {}) {
  const entry = {
    ts: new Date().toLocaleString(),
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
    notifyListeners();
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
  notifyListeners();
}
