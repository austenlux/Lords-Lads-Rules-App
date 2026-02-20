/**
 * App-wide constants: content URLs and cache keys.
 */

export const CONTENT_URL =
  'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md';
export const EXPANSIONS_URL =
  'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/expansions/README.md';
export const EXPANSIONS_BASE_URL =
  'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/expansions';
export const GITHUB_API_URL =
  'https://api.github.com/repos/seanKenkeremath/lords-and-lads/contents/expansions';

export const CACHE_KEYS = {
  RULES_MARKDOWN: '@cache_rules_markdown',
  EXPANSION_TEXTS: '@cache_expansion_texts',
  LAST_FETCH_DATE: '@cache_last_fetch_date',
};

/** Venmo username for "Buy me coffee" links (no @). */
export const VENMO_USERNAME = 'AustenLux';

/** Default memo for Venmo "what is this for?" (stump, nail, hammer). */
export const VENMO_DEFAULT_NOTE = '🪵🔩🔨';

/**
 * Builds a Venmo pay URL with optional memo for the "what is this for?" field.
 * @param {number} amount - Payment amount (e.g. 5 or 10.50)
 * @param {string} [note] - Optional memo; uses VENMO_DEFAULT_NOTE if omitted
 */
export const getVenmoPayUrl = (amount, note = VENMO_DEFAULT_NOTE) => {
  const base = `https://venmo.com/${encodeURIComponent(VENMO_USERNAME)}?txn=pay&amount=${amount}`;
  return note ? `${base}&note=${encodeURIComponent(note)}` : base;
};
