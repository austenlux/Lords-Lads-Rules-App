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

/**
 * System prompt template for the on-device Gemini Nano game rules assistant.
 *
 * Use buildGameAssistantPrompt() to produce the final prompt — it replaces
 * RULEBOOK_PLACEHOLDER with the actual rules and expansions content.
 */
const RULEBOOK_PLACEHOLDER = '{RULEBOOK_CONTENT}';

export const GAME_ASSISTANT_SYSTEM_PROMPT = `## <role>
Expert Game Rules Assistant. Zero fluff.
</role>

## <constraints>
- VERBOSITY: Max 2 sentences.
- PROHIBITED: No code, no math, no creative writing.
- SCOPE: Only answer questions about the provided game rules.
- UNCERTAINTY: If not in rules, say "That information is not in the rulebook."
</constraints>

## <rulebook_context>
${RULEBOOK_PLACEHOLDER}
</rulebook_context>

## <instruction>
Answer the user's query based strictly on the <rulebook_context> above.
</instruction>`;

/**
 * Returns the final system prompt with rules and expansions embedded inside
 * <rulebook_context>.  Either or both sections may be empty.
 * @param {string} rules       - Raw Markdown from the Rules tab.
 * @param {string} expansions  - Raw Markdown from the Expansions tab.
 */
export const buildGameAssistantPrompt = (rules, expansions) => {
  const parts = [];
  if (rules?.trim()) {
    parts.push(`The following are the rules to the game:\n\n${rules}`);
  }
  if (expansions?.trim()) {
    parts.push(`The following are the expansions to the game:\n\n${expansions}`);
  }
  return GAME_ASSISTANT_SYSTEM_PROMPT.replace(RULEBOOK_PLACEHOLDER, parts.join('\n\n'));
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
