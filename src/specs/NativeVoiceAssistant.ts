import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
// EventEmitter must be imported as a bare identifier — codegen detects it by name,
// and CodegenTypes.EventEmitter (a TSQualifiedName) is not recognized.
import type {EventEmitter} from 'react-native/Libraries/Types/CodegenTypes';

// ─────────────────────────────────────────── Event payload types ──

/** Partial or final speech recognition result. */
export type SpeechResult = {value: string};

/** A single streamed text chunk from Gemini Nano inference. */
export type AIChunk = {chunk: string};

// ─────────────────────────────────────────────────────── Spec ──

/**
 * TurboModule spec for the on-device Voice Assistant.
 * Codegen generates NativeVoiceAssistantSpec.kt (Android) from this file at build time.
 *
 * Android-only for now — iOS stubs will be added in a later phase.
 */
export interface Spec extends TurboModule {
  // ── Model lifecycle ──────────────────────────────────────────────────────

  /** Checks Gemini Nano status: 'available' | 'downloadable' | 'downloading' | 'unavailable' */
  checkModelStatus(): Promise<string>;

  /** Triggers Gemini Nano download. Resolves 'completed' or rejects on failure. */
  downloadModel(): Promise<string>;

  // ── Speech recognition (STT) ─────────────────────────────────────────────

  /**
   * Starts on-device speech recognition.
   * Resolves with the final recognised text when the user stops speaking.
   * Partial results arrive via onSpeechPartialResults events.
   */
  startListening(): Promise<string>;

  /** Stops an in-progress recognition session. The final result still fires via onResults. */
  stopListening(): void;

  // ── Inference ────────────────────────────────────────────────────────────

  /**
   * Streams a question to Gemini Nano with the provided context (e.g. README text).
   * Each chunk arrives via onAIChunkReceived; TTS begins sentence-by-sentence immediately.
   * Resolves with the full concatenated response when streaming is complete.
   */
  askQuestion(question: string, context: string): Promise<string>;

  // ── Text-to-speech (TTS) ─────────────────────────────────────────────────

  /**
   * Speaks the given text via Android TextToSpeech.
   * Uses QUEUE_ADD so consecutive calls build a spoken queue.
   * Requests audio focus (ducks music) automatically.
   */
  speak(text: string): void;

  /** Immediately stops any in-progress TTS playback. */
  stopSpeaking(): void;

  // ── Voice selection ───────────────────────────────────────────────────────

  /**
   * Returns a JSON-encoded array of available TTS voices.
   * Each element: { id: string, name: string, language: string }
   * Only includes English, offline (network-free) voices.
   */
  getAvailableVoices(): Promise<string>;

  /**
   * Selects the TTS voice for all subsequent speak() calls.
   * @param voiceId  The id returned by getAvailableVoices().
   */
  setVoice(voiceId: string): void;

  // ── Events ───────────────────────────────────────────────────────────────

  /** Fired repeatedly with interim STT results while the user is still speaking. */
  readonly onSpeechPartialResults: EventEmitter<SpeechResult>;

  /** Fired once with the final STT result after the user stops speaking. */
  readonly onSpeechFinalResults: EventEmitter<SpeechResult>;

  /** Fired for each streamed text chunk from Gemini Nano during askQuestion(). */
  readonly onAIChunkReceived: EventEmitter<AIChunk>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('VoiceAssistant');
