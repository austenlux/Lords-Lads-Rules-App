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
 * Placeholders used inside GAME_ASSISTANT_SYSTEM_PROMPT.
 * Kept private — use buildGameAssistantPrompt() to produce the final prompt.
 */
const P = {
  RULES:      '{RULES_CONTENT}',
  EXPANSIONS: '{EXPANSIONS_CONTENT}',
  HISTORY:    '{CONVERSATION_HISTORY}',
  QUESTION:   '{CURRENT_QUESTION}',
};

/**
 * Full system prompt template for the on-device Gemini Nano game rules assistant.
 * All four placeholders are filled by buildGameAssistantPrompt().
 */
export const GAME_ASSISTANT_SYSTEM_PROMPT = `## <role>
Expert Game Rules Assistant.
- Provide short, direct, and factual answers.
- Zero conversational fluff.
- Only answer questions about the provided game rules or expansions.
- If not found, say: "That information is not in the rulebook."
</role>

## <rulebook_core>
${P.RULES}
</rulebook_core>

## <rulebook_expansions>
${P.EXPANSIONS}
</rulebook_expansions>

## <conversation_history>
${P.HISTORY}
</conversation_history>

## <latest_user_prompt>
${P.QUESTION}
</latest_user_prompt>

## <final_instruction>
Answer the <latest_user_prompt> based ONLY on the data in <rulebook_core> and <rulebook_expansions>. Refer to the <conversation_history> if the user is asking a follow-up question.
</final_instruction>`;

/**
 * Builds the complete, ready-to-send prompt for Gemini Nano.
 *
 * @param {string}   rules       Raw Markdown from the Rules tab.
 * @param {string}   expansions  Raw Markdown from the Expansions tab.
 * @param {Array}    history     Array of settled {role, text} message objects (most-recent last).
 * @param {string}   question    The user's current transcribed question.
 */
export const buildGameAssistantPrompt = (rules, expansions, history, question) => {
  const historyText = history?.length
    ? history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
    : 'No previous conversation.';

  return GAME_ASSISTANT_SYSTEM_PROMPT
    .replace(P.RULES,      rules?.trim()      || 'Not available.')
    .replace(P.EXPANSIONS, expansions?.trim() || 'Not available.')
    .replace(P.HISTORY,    historyText)
    .replace(P.QUESTION,   question);
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
