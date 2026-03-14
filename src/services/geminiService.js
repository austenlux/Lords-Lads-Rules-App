/**
 * Gemini API service — cloud-based LLM for the voice assistant.
 *
 * Makes direct API calls to Google's Gemini generative language endpoint.
 * Used as the primary LLM when online; the on-device model is the offline fallback.
 */

import { GEMINI_API_KEY } from '../buildInfo';

export const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * @returns {boolean} Whether a Gemini API key is configured.
 */
export function isGeminiConfigured() {
  return typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.length > 0;
}

/**
 * Call the Gemini API with a combined prompt (system + context + question).
 *
 * @param {string} prompt  Fully assembled prompt text (system prompt + context + question).
 * @returns {Promise<string>} The model's text response.
 * @throws {Error} On network failure, timeout, rate limit, or empty response.
 */
export async function askGemini(prompt) {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded (429)');
    }

    if (!response.ok) {
      throw new Error(`Gemini API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Gemini request timed out (${REQUEST_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
