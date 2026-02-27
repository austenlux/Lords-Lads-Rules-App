/**
 * useGameAssistant
 *
 * Single source of truth for the voice-to-AI-to-voice loop.
 * Orchestrates: permission → STT → Gemini Nano inference (streaming) → TTS.
 *
 * Returned state
 * ──────────────
 *  isListening    true while the microphone is active and recording
 *  isThinking     true while Gemini Nano is generating a response
 *  partialSpeech  live interim text from the speech recogniser
 *  fullAnswer     AI response, built up token-by-token as chunks arrive
 *  error          human-readable error string, or null when all is well
 *
 * Usage
 * ──────────────
 *  const { isListening, isThinking, partialSpeech, fullAnswer, error, askTheRules } =
 *    useGameAssistant();
 *
 *  // In a FAB press handler:
 *  askTheRules(rulesMarkdownString);
 *
 * Android-only: returns a no-op on iOS until Phase 4 (iOS support).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeVoiceAssistant from '../specs/NativeVoiceAssistant';

// Any status other than 'unavailable' means hardware + AICore support exists.
const SUPPORTED_STATUSES = new Set(['available', 'downloadable', 'downloading']);

const VOICE_STORAGE_KEY = '@lnl_voice_id';
const VOICE_PREVIEW_TEXT = 'This is a preview of the selected voice.';

// ─────────────────────────────────────────── Constants ──

const MIC_PERMISSION_RATIONALE = {
  title: 'Microphone Permission',
  message:
    'The Game Assistant needs microphone access to hear your questions about the rules.',
  buttonPositive: 'Allow',
  buttonNegative: 'Deny',
};

const ERRORS = {
  NOT_ANDROID:       'Voice assistant is Android-only for now.',
  MODEL_UNAVAILABLE: 'Gemini AI is not supported on this device.',
  MODEL_DOWNLOADING: 'AI model is still downloading. Please try again shortly.',
  MIC_DENIED:        'Microphone permission is required. Please allow it in Settings.',
  NO_SPEECH:         'No speech detected. Please try again.',
  UNEXPECTED:        'An unexpected error occurred. Please try again.',
};

// ─────────────────────────────────────────── Hook ──

export function useGameAssistant() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [partialSpeech, setPartialSpeech] = useState('');
  const [fullAnswer, setFullAnswer] = useState('');
  const [error, setError] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(null);

  // Prevents concurrent invocations of askTheRules.
  const isBusy = useRef(false);

  // ── Support check (runs once on mount) ──────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NativeVoiceAssistant.checkModelStatus()
      .then((status) => setIsSupported(SUPPORTED_STATUSES.has(status)))
      .catch(() => setIsSupported(false));
  }, []);

  // ── Voice list + persisted selection (loads once, after TTS is ready) ───

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const load = async () => {
      try {
        const json = await NativeVoiceAssistant.getAvailableVoices();
        const { voices, activeVoiceId } = JSON.parse(json);
        setAvailableVoices(voices);

        const savedId = await AsyncStorage.getItem(VOICE_STORAGE_KEY);
        // Prefer the user's saved choice; fall back to the engine's current voice.
        const effectiveId =
          savedId && voices.some((v) => v.id === savedId)
            ? savedId
            : activeVoiceId || null;

        if (effectiveId) {
          setSelectedVoiceId(effectiveId);
          NativeVoiceAssistant.setVoice(effectiveId);
        }
      } catch {
        // Silently ignore — voice selection is non-critical.
      }
    };
    // Give TTS a moment to initialize before enumerating voices.
    const t = setTimeout(load, 1000);
    return () => clearTimeout(t);
  }, []);

  // ── Event subscriptions ──────────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Live interim text while the user is still speaking.
    const partialSub = NativeVoiceAssistant.onSpeechPartialResults(({ value }) => {
      setPartialSpeech(value);
    });

    // Final recognised text — mirror into partialSpeech so the UI doesn't blank.
    const finalSub = NativeVoiceAssistant.onSpeechFinalResults(({ value }) => {
      setPartialSpeech(value);
    });

    // Build fullAnswer chunk-by-chunk for real-time streaming display.
    const chunkSub = NativeVoiceAssistant.onAIChunkReceived(({ chunk }) => {
      setFullAnswer((prev) => prev + chunk);
    });

    return () => {
      partialSub?.remove();
      finalSub?.remove();
      chunkSub?.remove();
    };
  }, []);

  // ── Permission ───────────────────────────────────────────────────────────

  /**
   * Requests RECORD_AUDIO at runtime.
   * Returns true if granted, false if denied or permanently denied.
   * Safe to call on every invocation — Android returns GRANTED immediately
   * if the permission was already accepted.
   */
  const requestMicPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        MIC_PERMISSION_RATIONALE,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  // ── Kill switch ──────────────────────────────────────────────────────────

  /**
   * Immediately stops the assistant: cancels the Gemini Nano inference job,
   * kills TTS, and resets all active state so the FAB returns to idle.
   */
  const stopAssistant = useCallback(() => {
    if (Platform.OS !== 'android') return;
    NativeVoiceAssistant.stopAssistant();
    setIsThinking(false);
    setIsListening(false);
    isBusy.current = false;
  }, []);

  // ── Voice preview ────────────────────────────────────────────────────────

  /**
   * Selects [voiceId], persists it, and speaks a short preview phrase
   * so the user can hear the voice immediately after tapping.
   */
  const previewVoice = useCallback(async (voiceId) => {
    if (Platform.OS !== 'android') return;
    NativeVoiceAssistant.stopSpeaking();
    NativeVoiceAssistant.setVoice(voiceId);
    setSelectedVoiceId(voiceId);
    NativeVoiceAssistant.speak(VOICE_PREVIEW_TEXT);
    try {
      await AsyncStorage.setItem(VOICE_STORAGE_KEY, voiceId);
    } catch {
      // Persist failure is non-critical.
    }
  }, []);

  // ── Main loop ────────────────────────────────────────────────────────────

  /**
   * Runs the full voice-to-AI-to-voice loop.
   *
   * @param {string} readmeContext  The rules markdown to use as AI context.
   *                                 Pass the string from useContent so Gemini
   *                                 Nano answers questions about *your* game.
   */
  const askTheRules = useCallback(
    async (readmeContext = '') => {
      if (isBusy.current) return;
      if (Platform.OS !== 'android') {
        setError(ERRORS.NOT_ANDROID);
        return;
      }

      isBusy.current = true;
      setError(null);
      setFullAnswer('');
      setPartialSpeech('');

      try {
        // 1. Verify Gemini Nano is ready ──────────────────────────────────
        const modelStatus = await NativeVoiceAssistant.checkModelStatus();

        if (modelStatus === 'unavailable') {
          setError(ERRORS.MODEL_UNAVAILABLE);
          return;
        }

        if (modelStatus === 'downloading') {
          setError(ERRORS.MODEL_DOWNLOADING);
          return;
        }

        if (modelStatus === 'downloadable') {
          // Trigger download and wait — this can take a while on first run.
          setError('Downloading AI model for the first time…');
          await NativeVoiceAssistant.downloadModel();
          setError(null);
        }

        // 2. Mic permission ───────────────────────────────────────────────
        const hasMic = await requestMicPermission();
        if (!hasMic) {
          setError(ERRORS.MIC_DENIED);
          return;
        }

        // 3. Listen ───────────────────────────────────────────────────────
        // partialSpeech state updates live via onSpeechPartialResults events.
        setIsListening(true);
        const spokenQuestion = await NativeVoiceAssistant.startListening();
        setIsListening(false);

        if (!spokenQuestion?.trim()) {
          setError(ERRORS.NO_SPEECH);
          return;
        }

        // 4. Ask Gemini Nano ──────────────────────────────────────────────
        // fullAnswer builds up live via onAIChunkReceived events.
        // TTS starts sentence-by-sentence inside the native module.
        setIsThinking(true);
        await NativeVoiceAssistant.askQuestion(spokenQuestion, readmeContext);
        setIsThinking(false);

      } catch (err) {
        // Ignore user-initiated cancellations — stopAssistant already resets state.
        if (err?.message !== 'Assistant stopped by user') {
          setError(err?.message ?? ERRORS.UNEXPECTED);
        }
        setIsListening(false);
        setIsThinking(false);
      } finally {
        isBusy.current = false;
      }
    },
    [requestMicPermission],
  );

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    /** true only if device hardware + AICore supports Gemini Nano */
    isSupported,
    /** true while the microphone is active */
    isListening,
    /** true while Gemini Nano is generating a response */
    isThinking,
    /** convenience: true when the assistant is doing anything */
    isActive: isListening || isThinking,
    /** live interim speech-to-text text */
    partialSpeech,
    /** full AI response, streamed in token-by-token */
    fullAnswer,
    /** human-readable error, or null */
    error,
    /** trigger the full voice loop with the rules markdown as context */
    askTheRules,
    /** expose so the UI can pre-check permission (e.g. on first render) */
    requestMicPermission,
    /** list of available offline TTS voices; empty on unsupported devices */
    availableVoices,
    /** currently selected voice id, or null for system default */
    selectedVoiceId,
    /** select a voice, persist it, and play a short preview phrase */
    previewVoice,
    /** immediately stop inference + TTS and return to idle */
    stopAssistant,
  };
}
