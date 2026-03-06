import { sanitizeTextForSpeech } from '../src/utils/sanitizeTextForSpeech';

describe('sanitizeTextForSpeech', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeTextForSpeech('')).toBe('');
    expect(sanitizeTextForSpeech(null)).toBe('');
    expect(sanitizeTextForSpeech(undefined)).toBe('');
  });

  it('expands common abbreviations', () => {
    expect(sanitizeTextForSpeech('e.g. apples')).toBe('for example apples');
    expect(sanitizeTextForSpeech('i.e. oranges')).toBe('that is oranges');
    expect(sanitizeTextForSpeech('etc.')).toBe('etcetera');
    expect(sanitizeTextForSpeech('vs. other')).toBe('versus other');
    expect(sanitizeTextForSpeech('approx. 5')).toBe('approximately 5');
    expect(sanitizeTextForSpeech('max. 10')).toBe('maximum 10');
    expect(sanitizeTextForSpeech('min. 1')).toBe('minimum 1');
    expect(sanitizeTextForSpeech('fig. 3')).toBe('figure 3');
    expect(sanitizeTextForSpeech('w/o it')).toBe('without it');
    expect(sanitizeTextForSpeech('w/ cheese')).toBe('with cheese');
  });

  it('replaces list-item prefixes with pause', () => {
    expect(sanitizeTextForSpeech('* item one')).toBe(', item one');
    expect(sanitizeTextForSpeech('- item two')).toBe(', item two');
  });

  it('strips Markdown symbols', () => {
    expect(sanitizeTextForSpeech('**bold**')).toBe('bold');
    expect(sanitizeTextForSpeech('_italic_')).toBe('italic');
    expect(sanitizeTextForSpeech('`code`')).toBe('code');
    expect(sanitizeTextForSpeech('## Heading')).toBe('Heading');
    expect(sanitizeTextForSpeech('~~strike~~')).toBe('strike');
  });

  it('strips emoji', () => {
    const result = sanitizeTextForSpeech('Hello 🎉 world');
    expect(result).not.toContain('🎉');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('collapses excess whitespace', () => {
    expect(sanitizeTextForSpeech('hello   world')).toBe('hello world');
  });

  it('handles combined Markdown and abbreviations', () => {
    const input = '**e.g.** use approx. 5 items';
    const result = sanitizeTextForSpeech(input);
    expect(result).toBe('for example use approximately 5 items');
  });
});
