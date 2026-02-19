/**
 * Search and text utilities: query normalization, match highlighting, HTML entity decoding.
 */

/**
 * Normalize search query: trim and coerce to string so no caller can pass
 * leading/trailing space and break matching or produce invalid markdown.
 */
export function normalizeSearchQuery(query) {
  return (typeof query === 'string' ? query : '').trim();
}

/**
 * Highlight every occurrence of the query in the text using markdown ** for bold.
 * Uses normalized (trimmed) query and wraps the trimmed match in ** so we never
 * produce "**word **". Matches that include trailing/leading space in the source
 * are still found; we wrap the trimmed match so markdown renders correctly.
 */
export function highlightMatches(text, query) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery || normalizedQuery.length < 2 || !text || typeof text !== 'string') {
    return text;
  }

  const escapedForRegex = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedForRegex, 'gi');

  return text.replace(regex, (match) => {
    const safeMatch = typeof match === 'string' ? match : String(match);
    return '**' + safeMatch.trim() + '**';
  });
}

/**
 * Decode common HTML entities in text for display.
 */
export function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}
