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
 *  askTheRules(rulesMarkdown, expansionsMarkdown);
 *
 * Android-only: returns a no-op on iOS until Phase 4 (iOS support).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeVoiceAssistant from '../specs/NativeVoiceAssistant';
import { buildGameAssistantPrompt } from '../constants';

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
  const [messages, setMessages] = useState([]);

  // Prevents concurrent invocations of askTheRules.
  const isBusy = useRef(false);
  // Refs to the in-progress message ids so event callbacks can update them live.
  const activeUserMsgId = useRef(null);
  const activeAssistantMsgId = useRef(null);
  const msgCounter = useRef(0);

  const nextId = () => {
    msgCounter.current += 1;
    return `msg_${msgCounter.current}`;
  };

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

    // Live interim text — update partialSpeech and the in-progress user bubble.
    const partialSub = NativeVoiceAssistant.onSpeechPartialResults(({ value }) => {
      setPartialSpeech(value);
      const id = activeUserMsgId.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: value } : m)),
        );
      }
    });

    // Final recognised text — update bubble and partialSpeech.
    const finalSub = NativeVoiceAssistant.onSpeechFinalResults(({ value }) => {
      setPartialSpeech(value);
      const id = activeUserMsgId.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: value } : m)),
        );
      }
    });

    // Build fullAnswer chunk-by-chunk; also stream into the assistant bubble.
    const chunkSub = NativeVoiceAssistant.onAIChunkReceived(({ chunk }) => {
      setFullAnswer((prev) => prev + chunk);
      const id = activeAssistantMsgId.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m)),
        );
      }
    });

    // TTS queue fully drained — assistant has finished speaking, return to idle.
    const ttsDoneSub = NativeVoiceAssistant.onTTSFinished(() => {
      setIsThinking(false);
      isBusy.current = false;
    });

    return () => {
      partialSub?.remove();
      finalSub?.remove();
      chunkSub?.remove();
      ttsDoneSub?.remove();
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
    // If STT was still in progress the user bubble has no confirmed text — remove it.
    if (activeUserMsgId.current) {
      const staleId = activeUserMsgId.current;
      setMessages((prev) => prev.filter((m) => m.id !== staleId));
      activeUserMsgId.current = null;
    }
    activeAssistantMsgId.current = null;
    // Messages are intentionally NOT cleared here — conversation history is
    // preserved for the app lifecycle so the user can re-open the modal and
    // continue where they left off.
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
   * @param {string} rules       Raw Markdown from the Rules tab.
   * @param {string} expansions  Raw Markdown from the Expansions tab.
   */
  const askTheRules = useCallback(
    async (rules = '', expansions = '') => {
      if (isBusy.current) return;
      if (Platform.OS !== 'android') {
        setError(ERRORS.NOT_ANDROID);
        return;
      }

      isBusy.current = true;
      setError(null);
      setFullAnswer('');
      setPartialSpeech('');

      // Add a user bubble immediately — it updates live with partials as the user speaks.
      const userMsgId = nextId();
      activeUserMsgId.current = userMsgId;
      setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: '' }]);

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

        activeUserMsgId.current = null;

        if (!spokenQuestion?.trim()) {
          // No speech — remove the empty bubble from history.
          setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
          setError(ERRORS.NO_SPEECH);
          return;
        }

        // Ensure the bubble has the final confirmed text.
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, text: spokenQuestion } : m)),
        );

        // 4. Ask Gemini Nano ──────────────────────────────────────────────
        // fullAnswer builds up live via onAIChunkReceived events.
        // TTS starts sentence-by-sentence inside the native module.
        // isThinking stays true until onTTSFinished fires (queue fully drained).
        const assistantMsgId = nextId();
        activeAssistantMsgId.current = assistantMsgId;

        // Snapshot settled messages (cap at last 10 = ~5 exchanges) for history.
        // Must be read from state synchronously before the new assistant bubble is appended.
        const HISTORY_LIMIT = 10;
        const historySnapshot = messages
          .filter((m) => m.text?.trim())
          .slice(-HISTORY_LIMIT)
          .map((m) => ({ role: m.role, text: m.text }));

        setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', text: '' }]);

        // Build the complete prompt on the JS side — Kotlin receives a finished string.
        const fullPrompt = buildGameAssistantPrompt(rules, expansions, historySnapshot, spokenQuestion);

        setIsThinking(true);
        await NativeVoiceAssistant.askQuestion(fullPrompt);
        activeAssistantMsgId.current = null; // Streaming done; stop updating assistant bubble.
        // Do NOT clear isThinking here — onTTSFinished handles that once TTS is done.

      } catch (err) {
        // Ignore user-initiated cancellations — stopAssistant already resets state.
        if (err?.message !== 'Assistant stopped by user') {
          setError(err?.message ?? ERRORS.UNEXPECTED);
        }
        // On error, reset everything immediately (no TTS will fire).
        setIsListening(false);
        setIsThinking(false);
        isBusy.current = false;
      }
    },
    [requestMicPermission, messages],
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
    /** immediately stop inference + TTS, clear messages, and return to idle */
    stopAssistant,
    /** live conversation: [{id, role:'user'|'assistant', text}] */
    messages,
  };
}
