import { buildGameAssistantPrompt, GAME_ASSISTANT_SYSTEM_PROMPT } from '../src/constants';

describe('buildGameAssistantPrompt', () => {
  it('fills all placeholders with provided content', () => {
    const result = buildGameAssistantPrompt(
      '# Rules\nSome rules here.',
      '# Expansions\nSome expansions.',
      [{ role: 'user', text: 'What is the game?' }],
      'How do I win?',
    );

    expect(result).toContain('Some rules here.');
    expect(result).toContain('Some expansions.');
    expect(result).toContain('User: What is the game?');
    expect(result).toContain('How do I win?');
  });

  it('handles empty rules and expansions gracefully', () => {
    const result = buildGameAssistantPrompt('', '', [], 'Test question');

    expect(result).toContain('Not available.');
    expect(result).toContain('No previous conversation.');
    expect(result).toContain('Test question');
  });

  it('limits history to the most recent HISTORY_TURNS * 2 messages', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      text: `Message ${i}`,
    }));

    const result = buildGameAssistantPrompt('rules', 'exp', history, 'question');

    expect(result).toContain('Message 4');
    expect(result).toContain('Message 9');
    expect(result).not.toContain('Message 0');
    expect(result).not.toContain('Message 3');
  });

  it('strips < and > from user input to prevent prompt injection', () => {
    const result = buildGameAssistantPrompt(
      'rules',
      'expansions',
      [],
      '<script>alert("xss")</script>',
    );

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('scriptalert("xss")/script');
  });

  it('strips ToC sections from rulebook content', () => {
    const rulesWithToc = `# Game Title
## Table of Contents
- Rule 1
- Rule 2
## Actual Rules
Do things.`;

    const result = buildGameAssistantPrompt(rulesWithToc, '', [], 'test');
    expect(result).not.toContain('Table of Contents');
    expect(result).toContain('Actual Rules');
    expect(result).toContain('Do things.');
  });

  it('system prompt template contains required sections', () => {
    expect(GAME_ASSISTANT_SYSTEM_PROMPT).toContain('<role>');
    expect(GAME_ASSISTANT_SYSTEM_PROMPT).toContain('<rulebook_core>');
    expect(GAME_ASSISTANT_SYSTEM_PROMPT).toContain('<rulebook_expansions>');
    expect(GAME_ASSISTANT_SYSTEM_PROMPT).toContain('<conversation_history>');
    expect(GAME_ASSISTANT_SYSTEM_PROMPT).toContain('<latest_user_prompt>');
    expect(GAME_ASSISTANT_SYSTEM_PROMPT).toContain('<final_instruction>');
  });
});
