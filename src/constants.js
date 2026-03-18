/**
 * App-wide constants: content URLs, cache keys, and theme colors.
 */

export const ACCENT_COLOR = '#7B8C9E';
export const ACCENT_GLOW  = 'rgba(123, 140, 158, 0.3)';

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
  RULES_LAST_SYNCED: '@cache_rules_last_synced',
  EXPANSIONS_LAST_SYNCED: '@cache_expansions_last_synced',
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
- Answers must be 1-3 sentences maximum. No exceptions.
- If a topic has many sub-rules, pick the 1-2 most important points and summarize. Never enumerate every item.
- Zero conversational fluff.
- Never reference section numbers, rule numbers, or where in the rulebook something appears.
- Only answer questions about the provided game rules or expansions.
- NEVER invent, assume, or add rules, penalties, or information not explicitly written in the provided text.
- When multiple rules apply, you must mention ALL of them, not just the first match.
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
Answer the <latest_user_prompt> based ONLY on the data in <rulebook_core> and <rulebook_expansions>. Refer to the <conversation_history> if the user is asking a follow-up question. Keep the answer to 1-3 sentences — summarize, do not list every rule. If multiple rules apply, include all of them. If the exact answer is not explicitly stated in the provided text, say "That information is not in the rulebook." NEVER make up rules or penalties.
</final_instruction>`;

/**
 * Strips characters that could break the XML-style prompt tag structure.
 * Applied to all user-controlled input (question, history) before prompt insertion.
 */
// Strips < and > to prevent corruption of XML-style prompt section tags.
const stripAngleBrackets = (text) => text.replace(/[<>]/g, '');

const sanitizeUserInput = (text) => {
  if (!text?.trim()) return '';
  return stripAngleBrackets(text).trim();
};

/**
 * Cleans rulebook Markdown before embedding it in the system prompt:
 *  1. Removes the Table of Contents section (noise, no value for the LLM).
 *  2. Keeps Markdown heading hashes (## / ###) — they are critical context
 *     for RAG chunks so the model knows which section each snippet belongs to.
 *  3. Strips < and > characters that would corrupt the XML-style prompt tags.
 */
const sanitizeRulebookContent = (text) => {
  if (!text?.trim()) return '';

  return stripAngleBrackets(
    text
      // Remove the ToC block: from its header line to (not including) the next header.
      .replace(/^#{1,6}\s+(?:table\s+of\s+contents|contents)\s*\n[\s\S]*?(?=^#{1,6}\s)/gim, '')
      // Remove the top-level title heading (# Title) — not useful context for the LLM.
      .replace(/^#\s+.+$/m, '')
      // Remove image tags — the model can't process images and they waste tokens.
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Strip HTML entities (e.g. &amp; → &).
      .replace(/&amp;/g, '&')
  ).trim();
};

/**
 * Builds the complete, ready-to-send prompt for Gemini Nano using
 * RAG-retrieved chunks instead of the full rulebook.
 *
 * @param {Array<{ content: string, source: string }>} retrievedChunks
 *   Chunks returned by ragService.retrieveRelevantChunks().
 * @param {Array}  history   Array of settled {role, text} message objects (most-recent last).
 * @param {string} question  The user's current transcribed question.
 */
const HISTORY_TURNS = 3;

export const buildGameAssistantPrompt = (retrievedChunks, history, question) => {
  const recentHistory = history?.slice(-(HISTORY_TURNS * 2)) ?? [];
  const historyText = recentHistory.length
    ? recentHistory.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeUserInput(m.text)}`).join('\n')
    : 'No previous conversation.';

  const rulesChunks = retrievedChunks
    .filter(c => c.source === 'rules')
    .map(c => sanitizeRulebookContent(c.content));
  const expansionsChunks = retrievedChunks
    .filter(c => c.source === 'expansions')
    .map(c => sanitizeRulebookContent(c.content));

  const rulesContent = rulesChunks.length > 0 ? rulesChunks.join('\n\n') : 'Not available.';
  const expansionsContent = expansionsChunks.length > 0 ? expansionsChunks.join('\n\n') : 'Not available.';

  return GAME_ASSISTANT_SYSTEM_PROMPT
    .replace(P.RULES,      rulesContent)
    .replace(P.EXPANSIONS, expansionsContent)
    .replace(P.HISTORY,    historyText)
    .replace(P.QUESTION,   sanitizeUserInput(question));
};

// ─────────────────────────────────────── Gemini Cloud Prompt ──

/**
 * System prompt for the cloud Gemini model.
 * Richer than the on-device prompt because Gemini can synthesise multiple rules.
 */
export const GEMINI_SYSTEM_PROMPT =
  'You are a rules assistant for a drinking game called Lords & Lads. ' +
  'Answer questions using ONLY the provided rules context. Be concise but complete — ' +
  'if multiple rules apply to the question, include ALL of them. ' +
  'Never reference section numbers or citations. ' +
  'If the rules don\'t cover the question, say so.';

/**
 * Builds the full-context prompt for the Gemini cloud API.
 * Sends the complete rulebook + expansions instead of RAG chunks — Gemini's
 * 1M-token context window makes this trivially small (~5,400 tokens).
 *
 * @param {string} rawRules       Full rules markdown.
 * @param {string} rawExpansions  Full expansions markdown.
 * @param {Array}  history        Settled {role, text} messages (most-recent last).
 * @param {string} question       Current user question.
 */
export const buildGeminiFullContextPrompt = (rawRules, rawExpansions, history, question) => {
  const rules = sanitizeRulebookContent(rawRules || '') || 'Not available.';
  const expansions = sanitizeRulebookContent(rawExpansions || '') || 'Not available.';

  const recentHistory = history?.slice(-(HISTORY_TURNS * 2)) ?? [];
  const historyText = recentHistory.length
    ? recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeUserInput(m.text)}`).join('\n')
    : '';

  const parts = [
    GEMINI_SYSTEM_PROMPT,
    '',
    `Here are the complete game rules:\n${rules}`,
    '',
    `Here are the expansion rules:\n${expansions}`,
  ];
  if (historyText) {
    parts.push('', `Conversation so far:\n${historyText}`);
  }
  parts.push('', `Current question: ${sanitizeUserInput(question)}`);

  return parts.join('\n');
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
