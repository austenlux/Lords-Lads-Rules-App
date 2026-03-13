/**
 * LLM-powered rules summarization service.
 *
 * Splits markdown content into heading-based sections, sends each section
 * through an on-device LLM for compression, and caches the concatenated
 * result keyed by a SHA-256 content hash for invalidation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from 'js-sha256';
import { CACHE_KEYS } from '../constants';
import { logEvent, logError } from './errorLogger';

const LOG_SOURCE = 'SummaryService';

/**
 * Prompt template sent to the on-device LLM for each section.
 * The `{SECTION_CONTENT}` placeholder is replaced at call time.
 */
const SUMMARIZATION_PROMPT = `You are a rules compression engine. Summarize the following game rules section.

INSTRUCTIONS:
- Make the summary as SHORT as possible
- Preserve ALL actual rules, mechanics, numbers, conditions, and outcomes
- Preserve markdown headings exactly (## and ### structure must remain intact)
- Strip fluff, examples, flavor text, and verbose explanations
- Do NOT strip markdown formatting
- The summary must be self-contained

SECTION TO SUMMARIZE:
{SECTION_CONTENT}

COMPRESSED SUMMARY:`;

// ── Cache key helpers ────────────────────────────────────────────────────────

const SUMMARY_KEY = {
  rules: CACHE_KEYS.RULES_SUMMARY,
  expansions: CACHE_KEYS.EXPANSIONS_SUMMARY,
};

const HASH_KEY = {
  rules: CACHE_KEYS.RULES_SUMMARY_HASH,
  expansions: CACHE_KEYS.EXPANSIONS_SUMMARY_HASH,
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hex digest of the given string.
 * @param {string} content
 * @returns {string} 64-char hex hash
 */
export function computeContentHash(content) {
  return sha256(content);
}

/**
 * Split markdown into heading-delimited sections.
 *
 * Splits on `# ` and `## ` headings. Subsections (`### `) stay grouped
 * with their parent `## ` section. Returns an array of `{ heading, body }`.
 *
 * @param {string} markdown
 * @returns {Array<{ heading: string, body: string }>}
 */
export function splitIntoSections(markdown) {
  if (!markdown?.trim()) return [];

  const lines = markdown.split('\n');
  const sections = [];
  let currentHeading = null;
  let currentLines = [];

  const flush = () => {
    if (currentHeading !== null) {
      sections.push({
        heading: currentHeading,
        body: currentLines.join('\n').trim(),
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const isH1 = line.startsWith('# ') && !line.startsWith('## ');
    const isH2 = line.startsWith('## ') && !line.startsWith('### ');

    if (isH1 || isH2) {
      flush();
      currentHeading = line;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Read a previously cached summary from AsyncStorage.
 *
 * @param {'rules'|'expansions'} type
 * @returns {Promise<{ summary: string, hash: string } | null>}
 */
export async function getCachedSummary(type) {
  const [summary, hash] = await Promise.all([
    AsyncStorage.getItem(SUMMARY_KEY[type]),
    AsyncStorage.getItem(HASH_KEY[type]),
  ]);

  if (summary && hash) return { summary, hash };
  return null;
}

/**
 * Generate LLM-compressed summaries for the given markdown content.
 *
 * Checks a SHA-256 content hash against the cached value and returns the
 * cached summary on a match. Otherwise, splits the content into sections,
 * summarizes each sequentially via `askFn`, caches the result, and returns it.
 *
 * @param {string}   content     Raw markdown string
 * @param {function} askFn       `(prompt: string) => Promise<string>` — sends prompt to LLM
 * @param {'rules'|'expansions'} type  Determines cache keys and log labels
 * @param {function} onProgress  `(current: number, total: number, sectionName: string) => void`
 * @returns {Promise<{ summary: string, originalSize: number, summarySize: number, sectionCount: number }>}
 */
export async function generateSummaries(content, askFn, type, onProgress) {
  const originalSize = content.length;
  const hash = computeContentHash(content);

  const cachedHash = await AsyncStorage.getItem(HASH_KEY[type]);
  if (cachedHash === hash) {
    const cachedSummary = await AsyncStorage.getItem(SUMMARY_KEY[type]);
    if (cachedSummary) {
      logEvent(LOG_SOURCE, 'Summary cache hit', { type });
      return {
        summary: cachedSummary,
        originalSize,
        summarySize: cachedSummary.length,
        sectionCount: 0,
      };
    }
  }

  const sections = splitIntoSections(content);
  const sectionCount = sections.length;
  logEvent(LOG_SOURCE, 'Summary generation started', { type, sectionCount });
  const t0 = Date.now();

  const summaryParts = [];

  for (let i = 0; i < sections.length; i++) {
    const { heading, body } = sections[i];
    const sectionContent = `${heading}\n${body}`;
    const prompt = SUMMARIZATION_PROMPT.replace('{SECTION_CONTENT}', sectionContent);

    try {
      const result = await askFn(prompt);
      summaryParts.push(result);

      logEvent(LOG_SOURCE, 'Section summarized', {
        type,
        section: heading,
        originalSize: sectionContent.length,
        summarySize: result.length,
      });
    } catch (err) {
      logError(LOG_SOURCE, err, { type, section: heading, phase: 'summarizeSection' });
      summaryParts.push(sectionContent);
    }

    onProgress?.(i + 1, sectionCount, heading);
  }

  const summary = summaryParts.join('\n\n');
  const summarySize = summary.length;
  const elapsedMs = Date.now() - t0;
  const reductionPercent = originalSize > 0
    ? Math.round((1 - summarySize / originalSize) * 100)
    : 0;

  await AsyncStorage.removeItem(SUMMARY_KEY[type]);
  await AsyncStorage.removeItem(HASH_KEY[type]);
  await AsyncStorage.setItem(SUMMARY_KEY[type], summary);
  await AsyncStorage.setItem(HASH_KEY[type], hash);

  logEvent(LOG_SOURCE, 'Summary generation complete', {
    type,
    originalSize,
    summarySize,
    reductionPercent,
    elapsedMs,
  });

  return { summary, originalSize, summarySize, sectionCount };
}
