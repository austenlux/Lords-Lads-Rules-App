/**
 * Strips Markdown and other noise from text before it is sent to TTS,
 * so the engine reads it naturally without saying "asterisk" or "hash".
 *
 * Shared cross-platform utility — both Android and iOS native modules
 * receive already-sanitized text from the JS sentence accumulator, so
 * neither platform needs its own sanitization implementation.
 *
 * Rules applied in order:
 *  1. Expand common abbreviations before punctuation is stripped.
 *  2. Replace list-item prefixes (* / - at line start) with a pause marker.
 *  3. Strip Markdown symbols: ** * _ # ` ~~ and emoji.
 *  4. Collapse consecutive whitespace.
 */

// ── Precompiled regexes ───────────────────────────────────────────────────────

const RE_EG        = /\be\.g\./gi;
const RE_IE        = /\bi\.e\./gi;
const RE_ETC       = /\betc\./gi;
const RE_VS        = /\bvs\./gi;
const RE_APPROX    = /\bapprox\./gi;
const RE_MAX       = /\bmax\./gi;
const RE_MIN       = /\bmin\./gi;
const RE_FIG       = /\bfig\./gi;
const RE_WITHOUT   = /\bw\/o\b/gi;
const RE_WITH      = /\bw\//gi;

const RE_LIST_PREFIX = /^[*\-]\s+/gm;
const RE_MD_SYMBOLS  = /[*_`#~]/g;
const RE_EMOJI       = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
const RE_WHITESPACE  = /[ \t]{2,}/g;

// ─────────────────────────────────────────────────────────────────────────────

export function sanitizeTextForSpeech(text) {
  if (!text) return '';
  let s = text;

  // 1. Abbreviation expansion — must run before punctuation is stripped.
  s = s.replace(RE_EG,      'for example');
  s = s.replace(RE_IE,      'that is');
  s = s.replace(RE_ETC,     'etcetera');
  s = s.replace(RE_VS,      'versus');
  s = s.replace(RE_APPROX,  'approximately');
  s = s.replace(RE_MAX,     'maximum');
  s = s.replace(RE_MIN,     'minimum');
  s = s.replace(RE_FIG,     'figure');
  s = s.replace(RE_WITHOUT, 'without');
  s = s.replace(RE_WITH,    'with');

  // 2. List-item prefixes → pause so items are separated naturally.
  s = s.replace(RE_LIST_PREFIX, ', ');

  // 3. Strip Markdown symbols and emoji.
  s = s.replace(RE_MD_SYMBOLS, '');
  s = s.replace(RE_EMOJI,      '');

  // 4. Collapse excess whitespace.
  s = s.replace(RE_WHITESPACE, ' ').trim();

  return s;
}
