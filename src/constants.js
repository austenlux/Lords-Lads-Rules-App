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
 * Cleans rulebook Markdown before embedding it in the system prompt:
 *  1. Removes the Table of Contents section (noise, no value for the LLM).
 *  2. Keeps Markdown heading hashes (## / ###) — they are critical context
 *     for RAG chunks so the model knows which section each snippet belongs to.
 *  3. Strips < and > characters that would corrupt the XML-style prompt tags.
 */
const sanitizeRulebookContent = (text) => {
  if (!text?.trim()) return '';

  return text
    // Remove the ToC block: from its header line to (not including) the next header.
    .replace(/^#{1,6}\s+(?:table\s+of\s+contents|contents)\s*\n[\s\S]*?(?=^#{1,6}\s)/gim, '')
    // Strip characters that conflict with XML-style prompt section tags.
    // Heading hashes are intentionally preserved for RAG context.
    .replace(/[<>]/g, '')
    .trim();
};

/**
 * Builds the complete, ready-to-send prompt for Gemini Nano.
 *
 * @param {string}   rules       Raw Markdown from the Rules tab.
 * @param {string}   expansions  Raw Markdown from the Expansions tab.
 * @param {Array}    history     Array of settled {role, text} message objects (most-recent last).
 *                               Only the last HISTORY_TURNS exchanges are included.
 * @param {string}   question    The user's current transcribed question.
 */
const HISTORY_TURNS = 3; // number of back-and-forth exchanges to keep (user+assistant = 1 turn)

export const buildGameAssistantPrompt = (rules, expansions, history, question) => {
  const recentHistory = history?.slice(-(HISTORY_TURNS * 2)) ?? [];
  const historyText = recentHistory.length
    ? recentHistory.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
    : 'No previous conversation.';

  return GAME_ASSISTANT_SYSTEM_PROMPT
    .replace(P.RULES,      sanitizeRulebookContent(rules)      || 'Not available.')
    .replace(P.EXPANSIONS, sanitizeRulebookContent(expansions) || 'Not available.')
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
