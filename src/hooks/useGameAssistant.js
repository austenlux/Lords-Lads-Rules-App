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
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeVoiceAssistant from '../specs/NativeVoiceAssistant';
import { buildGameAssistantPrompt } from '../constants';
import { sanitizeTextForSpeech } from '../utils/sanitizeTextForSpeech';

const MODEL_POLL_INTERVAL_MS = 5000;
const MODEL_POLL_MAX_ATTEMPTS = 24; // 2 minutes total

const VOICE_STORAGE_KEY = '@lnl_voice_id';
const VOICE_PREVIEW_TEXT = 'This is a preview of the selected voice.';

// ─────────────────────────────────────────── Constants ──

/**
 * Minimum buffer size (chars) before we consider speaking at a phrase boundary
 * (, ; :). Keeps TTS chunks long enough to sound natural.
 */
const PHRASE_SPEAK_THRESHOLD = 40;

const ERRORS = {
  NOT_ANDROID:       'Voice assistant is Android-only for now.',
  MODEL_UNAVAILABLE: 'Gemini AI is not supported on this device.',
  MODEL_DOWNLOADING: 'AI model is still downloading. Please try again shortly.',
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
  // 'unknown' | 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'download_failed'
  const [modelStatus, setModelStatus] = useState('unknown');
  // 'unknown' | 'granted' | 'not_granted'
  const [micPermissionStatus, setMicPermissionStatus] = useState('unknown');
  const [downloadProgressBytes, setDownloadProgressBytes] = useState(0);

  // Prevents concurrent invocations of askTheRules.
  const isBusy = useRef(false);
  // Refs to the in-progress message ids so event callbacks can update them live.
  const activeUserMsgId = useRef(null);
  const activeAssistantMsgId = useRef(null);
  const msgCounter = useRef(0);
  // Accumulates streaming chunks until a sentence/phrase boundary is detected,
  // then speaks the segment sanitized. Mirrors the sentence-buffer logic that
  // previously lived in Kotlin's accumulateAndSpeak().
  const sentenceBufferRef = useRef('');

  const nextId = () => {
    msgCounter.current += 1;
    return `msg_${msgCounter.current}`;
  };

  // ── Background setup: model + mic permission (runs once on mount) ────────

  const runSetup = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    // Check mic permission without prompting.
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      setMicPermissionStatus(granted ? 'granted' : 'not_granted');
    } catch {
      setMicPermissionStatus('not_granted');
    }

    // Check model status and prepare silently.
    try {
      const status = await NativeVoiceAssistant.checkModelStatus();
      setModelStatus(status);

      if (status === 'available') {
        setIsSupported(true);
        return;
      }

      if (status === 'unavailable') {
        setIsSupported(false);
        return;
      }

      if (status === 'downloadable') {
        // Trigger download silently — FAB stays hidden until complete.
        setModelStatus('downloading');
        setDownloadProgressBytes(0);
        try {
          await NativeVoiceAssistant.downloadModel();
          setModelStatus('available');
          setIsSupported(true);
        } catch {
          setModelStatus('download_failed');
          setIsSupported(false);
        }
        return;
      }

      if (status === 'downloading') {
        // AICore is already downloading — poll until available.
        let attempts = 0;
        const poll = async () => {
          if (attempts >= MODEL_POLL_MAX_ATTEMPTS) {
            setModelStatus('download_failed');
            setIsSupported(false);
            return;
          }
          attempts += 1;
          await new Promise((r) => setTimeout(r, MODEL_POLL_INTERVAL_MS));
          try {
            const latest = await NativeVoiceAssistant.checkModelStatus();
            setModelStatus(latest);
            if (latest === 'available') {
              setIsSupported(true);
            } else if (latest === 'unavailable') {
              setIsSupported(false);
            } else {
              poll();
            }
          } catch {
            setModelStatus('download_failed');
            setIsSupported(false);
          }
        };
        poll();
      }
    } catch {
      setModelStatus('unavailable');
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    runSetup();
  }, [runSetup]);

  // Re-check mic permission when the app returns to foreground (e.g. after
  // the user grants it in Settings and switches back).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        setMicPermissionStatus(granted ? 'granted' : 'not_granted');
      } catch {
        setMicPermissionStatus('not_granted');
      }
    });
    return () => sub.remove();
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

    // Build fullAnswer chunk-by-chunk; stream into the assistant bubble;
    // and accumulate into the sentence buffer to drive TTS.
    const chunkSub = NativeVoiceAssistant.onAIChunkReceived(({ chunk }) => {
      // UI update — raw Markdown is preserved for display.
      setFullAnswer((prev) => prev + chunk);
      const id = activeAssistantMsgId.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m)),
        );
      }

      // TTS accumulation — mirrors Kotlin's accumulateAndSpeak().
      sentenceBufferRef.current += chunk;
      const text = sentenceBufferRef.current;

      // 1. Sentence boundary (. ! ?) — speak immediately.
      const sentenceEnd = text.search(/[.!?]/);
      if (sentenceEnd >= 0) {
        const sentence = text.substring(0, sentenceEnd + 1).trim();
        sentenceBufferRef.current = text.substring(sentenceEnd + 1);
        const cleaned = sanitizeTextForSpeech(sentence);
        if (cleaned) NativeVoiceAssistant.speak(cleaned);
        return;
      }

      // 2. Phrase boundary (, ; :) once enough text has built up — keeps TTS
      //    starting before the first full stop arrives.
      if (text.length >= PHRASE_SPEAK_THRESHOLD) {
        const phraseEnd = text.search(/[,;:]/);
        if (phraseEnd >= 0) {
          const phrase = text.substring(0, phraseEnd + 1).trim();
          sentenceBufferRef.current = text.substring(phraseEnd + 1);
          const cleaned = sanitizeTextForSpeech(phrase);
          if (cleaned) NativeVoiceAssistant.speak(cleaned);
        }
      }
    });

    // TTS queue fully drained — assistant has finished speaking, return to idle.
    const ttsDoneSub = NativeVoiceAssistant.onTTSFinished(() => {
      setIsThinking(false);
      isBusy.current = false;
    });

    // Download progress — update bytes counter so the debug UI can reflect it.
    const downloadProgressSub = NativeVoiceAssistant.onDownloadProgress(
      ({ bytesDownloaded }) => setDownloadProgressBytes(bytesDownloaded),
    );

    return () => {
      partialSub?.remove();
      finalSub?.remove();
      chunkSub?.remove();
      ttsDoneSub?.remove();
      downloadProgressSub?.remove();
    };
  }, []);

  // ── Kill switch ──────────────────────────────────────────────────────────

  /**
   * Immediately stops the assistant: cancels the Gemini Nano inference job,
   * kills TTS, and resets all active state so the FAB returns to idle.
   */
  const stopAssistant = useCallback(() => {
    if (Platform.OS !== 'android') return;
    NativeVoiceAssistant.stopAssistant();
    sentenceBufferRef.current = '';
    setIsThinking(false);
    setIsListening(false);
    isBusy.current = false;
    // If STT was still in progress the user bubble has no confirmed text — remove it.
    // Delay by 250ms so the modal's 200ms fade-out animation completes first,
    // preventing the bubble from visibly disappearing before the modal is hidden.
    if (activeUserMsgId.current) {
      const staleId = activeUserMsgId.current;
      activeUserMsgId.current = null;
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== staleId));
      }, 250);
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
      sentenceBufferRef.current = '';
      setError(null);
      setFullAnswer('');
      setPartialSpeech('');

      try {
        // 1. Listen ───────────────────────────────────────────────────────
        // Model is guaranteed available by the time the FAB is shown.
        // Permission is pre-checked by the FAB handler before this is called.
        // Permission is pre-checked by the FAB handler before askTheRules is
        // called, so by this point mic access is guaranteed.
        // Add the user bubble here — after all pre-checks pass — so it never
        // appears before the user is actually about to speak.
        const userMsgId = nextId();
        activeUserMsgId.current = userMsgId;
        setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: '' }]);
        // partialSpeech state updates live via onSpeechPartialResults events.
        setIsListening(true);
        const spokenQuestion = await NativeVoiceAssistant.startListening();
        setIsListening(false);

        activeUserMsgId.current = null;

        if (!spokenQuestion?.trim()) {
          // No speech — remove the empty bubble from history.
          setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
          setError(ERRORS.NO_SPEECH);
          isBusy.current = false;
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

        // Snapshot all settled messages before this turn — buildGameAssistantPrompt
        // applies the recency cap and sanitization internally.
        const historySnapshot = messages
          .filter((m) => m.text?.trim())
          .map((m) => ({ role: m.role, text: m.text }));

        setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', text: '' }]);

        // Build the complete prompt on the JS side — Kotlin receives a finished string.
        const fullPrompt = buildGameAssistantPrompt(
          rules,
          expansions,
          historySnapshot,
          spokenQuestion,
        );

        setIsThinking(true);
        await NativeVoiceAssistant.askQuestion(fullPrompt);
        activeAssistantMsgId.current = null; // Streaming done; stop updating assistant bubble.

        // Flush any text remaining in the sentence buffer after the stream ends.
        const remaining = sentenceBufferRef.current.trim();
        sentenceBufferRef.current = '';
        if (remaining) {
          const cleaned = sanitizeTextForSpeech(remaining);
          if (cleaned) NativeVoiceAssistant.speak(cleaned);
        }
        // Signal to native that no more speak() calls are coming for this turn,
        // so it can fire onTTSFinished once the TTS queue fully drains.
        NativeVoiceAssistant.markSpeechQueueComplete();
        // Do NOT clear isThinking here — onTTSFinished handles that once TTS is done.

      } catch (err) {
        const msg = err?.message ?? '';
        if (msg === 'Assistant stopped by user') {
          // User pressed X — stopAssistant already reset state, nothing to do.
        } else if (msg === 'speech_timeout' || msg === 'no_match') {
          // Android STT timed out waiting for speech (user was silent).
          // Treat as "nothing said" — remove the empty bubble, stay quiet.
          if (activeUserMsgId.current) {
            const staleId = activeUserMsgId.current;
            activeUserMsgId.current = null;
            setMessages((prev) => prev.filter((m) => m.id !== staleId));
          }
          setIsListening(false);
          setIsThinking(false);
          isBusy.current = false;
        } else {
          setError(msg || ERRORS.UNEXPECTED);
          setIsListening(false);
          setIsThinking(false);
          isBusy.current = false;
        }
      }
    },
    [messages],
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
    /** raw Gemini Nano model status for the debug panel */
    modelStatus,
    /** mic permission status for the debug panel: 'unknown'|'granted'|'not_granted' */
    micPermissionStatus,
    /** cumulative bytes downloaded during an active model download */
    downloadProgressBytes,
    /** re-runs the full model + mic setup flow; useful from the debug panel */
    retryModelSetup: runSetup,
  };
}
