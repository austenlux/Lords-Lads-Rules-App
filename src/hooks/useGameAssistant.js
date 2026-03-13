/**
 * useGameAssistant
 *
 * Single source of truth for the voice-to-AI-to-voice loop.
 * Orchestrates: permission → STT → on-device AI inference (streaming) → TTS.
 *
 * Returned state
 * ──────────────
 *  isListening    true while the microphone is active and recording
 *  isThinking     true while the AI model is generating a response
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
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeVoiceAssistantOptional from '../specs/NativeVoiceAssistantOptional';
import { buildGameAssistantPrompt } from '../constants';
import { sanitizeTextForSpeech } from '../utils/sanitizeTextForSpeech';
import { logError, logEvent } from '../services/errorLogger';


const VOICE_STORAGE_KEY = '@lnl_voice_id';
const VOICE_PREVIEW_TEXT = 'This is a preview of the selected voice.';

const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

// ─────────────────────────────────────────── Constants ──

/**
 * Minimum buffer size (chars) before we consider speaking at a phrase boundary
 * (, ; :). Keeps TTS chunks long enough to sound natural.
 */
const PHRASE_SPEAK_THRESHOLD = 40;

const ERRORS = {
  MODEL_UNAVAILABLE: 'The AI model is not supported on this device.',
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
  /** iOS only: parsed getModelDebugInfo() result; null on Android or when missing/failed */
  const [modelDebugInfo, setModelDebugInfo] = useState(null);

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
    const native = NativeVoiceAssistantOptional;

    if (!native) {
      setModelStatus('unavailable');
      setIsSupported(false);
      return;
    }


    if (isIOS) {
      try {
        const status = await native.getMicPermissionStatus();
        if (status === 'granted') {
          setMicPermissionStatus('granted');
        } else if (status === 'denied') {
          setMicPermissionStatus('not_granted');
        } else if (status === 'undetermined') {
          setMicPermissionStatus('undetermined');
        } else {
          setMicPermissionStatus('unknown');
        }
      } catch {
        setMicPermissionStatus('unknown');
      }
    }

    if (isAndroid) {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        setMicPermissionStatus(granted ? 'granted' : 'not_granted');
      } catch {
        setMicPermissionStatus('not_granted');
      }
    }

    try {
      logEvent('AI Model', 'Checking model status...');
      const status = await native.checkModelStatus();
      logEvent('AI Model', `Status: ${status}`);
      setModelStatus(status);

      if (isIOS && typeof native.getModelDebugInfo === 'function') {
        try {
          const raw = await native.getModelDebugInfo();
          const parsed = (() => {
            try {
              return typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch {
              return null;
            }
          })();
          setModelDebugInfo(parsed && typeof parsed === 'object' ? parsed : null);
        } catch {
          setModelDebugInfo(null);
        }
      } else {
        setModelDebugInfo(null);
      }

      if (status === 'available') {
        setIsSupported(true);
        return;
      }

      setIsSupported(false);
    } catch (setupErr) {
      logError('AI Model Setup', setupErr || 'Setup failed', { phase: 'checkModelStatus' });
      setModelStatus('unavailable');
      setIsSupported(false);
    }
  }, []);

  const retryModelSetup = useCallback(() => runSetup(), [runSetup]);

  useEffect(() => {
    runSetup();
  }, [runSetup]);

  // Re-check mic permission when the app returns to foreground (e.g. after
  // the user grants it in Settings and switches back).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      if (isIOS) {
        const native = NativeVoiceAssistantOptional;
        if (!native) return;
        try {
          const status = await native.getMicPermissionStatus();
          if (status === 'granted') {
            setMicPermissionStatus('granted');
          } else if (status === 'denied') {
            setMicPermissionStatus('not_granted');
          } else if (status === 'undetermined') {
            setMicPermissionStatus('undetermined');
          } else {
            setMicPermissionStatus('unknown');
          }
        } catch {
          setMicPermissionStatus('unknown');
        }
      }

      if (isAndroid) {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          setMicPermissionStatus(granted ? 'granted' : 'not_granted');
        } catch {
          setMicPermissionStatus('not_granted');
        }
      }
    });
    return () => sub.remove();
  }, []);

  const requestMicPermission = useCallback(async () => {
    if (isIOS) {
      const native = NativeVoiceAssistantOptional;
      if (!native || typeof native.requestMicPermission !== 'function') return 'denied';
      try {
        const result = await native.requestMicPermission();
        setMicPermissionStatus(result === 'granted' ? 'granted' : 'not_granted');
        return result;
      } catch {
        return 'denied';
      }
    }
    if (isAndroid) {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setMicPermissionStatus(granted ? 'granted' : 'not_granted');
        return granted ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }
    return 'denied';
  }, []);

  // ── Voice list + persisted selection (loads once, after TTS is ready) ───

  useEffect(() => {
    const native = NativeVoiceAssistantOptional;
    if (!native) return;
    const load = async () => {
      try {
        const json = await native.getAvailableVoices();
        const { voices, activeVoiceId } = JSON.parse(json);
        setAvailableVoices(voices);

        const savedId = await AsyncStorage.getItem(VOICE_STORAGE_KEY);
        const effectiveId =
          savedId && voices.some((v) => v.id === savedId)
            ? savedId
            : activeVoiceId || null;

        if (effectiveId) {
          setSelectedVoiceId(effectiveId);
          native.setVoice(effectiveId);
        }
      } catch {
        // Silently ignore — voice selection is non-critical.
      }
    };
    const t = setTimeout(load, 1000);
    return () => clearTimeout(t);
  }, []);

  // ── Event subscriptions ──────────────────────────────────────────────────

  useEffect(() => {
    const native = NativeVoiceAssistantOptional;
    if (!native) return;
    const partialSub = native.onSpeechPartialResults(({ value }) => {
      setPartialSpeech(value);
      const id = activeUserMsgId.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: value } : m)),
        );
      }
    });

    const finalSub = native.onSpeechFinalResults(({ value }) => {
      setPartialSpeech(value);
      const id = activeUserMsgId.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: value } : m)),
        );
      }
    });

    const chunkSub = native.onAIChunkReceived(({ chunk }) => {
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
        if (cleaned) native.speak(cleaned);
        return;
      }

      if (text.length >= PHRASE_SPEAK_THRESHOLD) {
        const phraseEnd = text.search(/[,;:]/);
        if (phraseEnd >= 0) {
          const phrase = text.substring(0, phraseEnd + 1).trim();
          sentenceBufferRef.current = text.substring(phraseEnd + 1);
          const cleaned = sanitizeTextForSpeech(phrase);
          if (cleaned) native.speak(cleaned);
        }
      }
    });

    const ttsDoneSub = native.onTTSFinished(() => {
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

  // ── Kill switch ──────────────────────────────────────────────────────────

  /**
   * Immediately stops the assistant: cancels the active inference job,
   * kills TTS, and resets all active state so the FAB returns to idle.
   */
  const stopAssistant = useCallback(() => {
    const native = NativeVoiceAssistantOptional;
    if (!native) return;
    native.stopAssistant();
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
  }, []);

  // ── Voice preview ────────────────────────────────────────────────────────

  /**
   * Selects [voiceId], persists it, and speaks a short preview phrase
   * so the user can hear the voice immediately after tapping.
   */
  const previewVoice = useCallback(async (voiceId) => {
    const native = NativeVoiceAssistantOptional;
    if (!native) return;
    native.stopSpeaking();
    native.setVoice(voiceId);
    setSelectedVoiceId(voiceId);
    native.speak(VOICE_PREVIEW_TEXT);
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
      const native = NativeVoiceAssistantOptional;
      if (!native) return;
      if (isBusy.current) return;

      isBusy.current = true;
      sentenceBufferRef.current = '';
      setError(null);
      setFullAnswer('');
      setPartialSpeech('');

      try {
        const userMsgId = nextId();
        activeUserMsgId.current = userMsgId;
        setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: '' }]);
        setIsListening(true);
        logEvent('Voice', 'startListening called');
        const spokenQuestion = await native.startListening();
        logEvent('Voice', `startListening resolved: "${spokenQuestion?.substring(0, 50) ?? ''}"`);
        setIsListening(false);

        activeUserMsgId.current = null;

        if (!spokenQuestion?.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
          setError(ERRORS.NO_SPEECH);
          isBusy.current = false;
          return;
        }

        // Ensure the bubble has the final confirmed text.
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, text: spokenQuestion } : m)),
        );

        // 2. Ask the AI model ─────────────────────────────────────────────
        const assistantMsgId = nextId();
        activeAssistantMsgId.current = assistantMsgId;

        const historySnapshot = messages
          .filter((m) => m.text?.trim())
          .map((m) => ({ role: m.role, text: m.text }));

        setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', text: '' }]);

        const fullPrompt = buildGameAssistantPrompt(
          rules,
          expansions,
          historySnapshot,
          spokenQuestion,
        );

        setIsThinking(true);
        await native.askQuestion(fullPrompt);
        activeAssistantMsgId.current = null;

        const remaining = sentenceBufferRef.current.trim();
        sentenceBufferRef.current = '';
        if (remaining) {
          const cleaned = sanitizeTextForSpeech(remaining);
          if (cleaned) native.speak(cleaned);
        }
        native.markSpeechQueueComplete();

      } catch (err) {
        const msg = err?.message ?? '';
        const code = err?.code ?? '';
        logEvent('Voice', `Error: code=${code} msg=${msg}`);
        if (msg === 'Assistant stopped by user') {
          // User pressed X — stopAssistant already reset state, nothing to do.
        } else if (code === 'insufficient_permissions' || msg.includes('permission denied')) {
          setMicPermissionStatus('not_granted');
          if (activeUserMsgId.current) {
            const staleId = activeUserMsgId.current;
            activeUserMsgId.current = null;
            setMessages((prev) => prev.filter((m) => m.id !== staleId));
          }
          setIsListening(false);
          setIsThinking(false);
          isBusy.current = false;
        } else if (msg === 'speech_timeout' || msg === 'no_match') {
          if (activeUserMsgId.current) {
            const staleId = activeUserMsgId.current;
            activeUserMsgId.current = null;
            setMessages((prev) => prev.filter((m) => m.id !== staleId));
          }
          setIsListening(false);
          setIsThinking(false);
          isBusy.current = false;
        } else {
          logError('Voice Assistant', err, { phase: 'askTheRules' });
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
    /** true only if device supports on-device AI */
    isSupported,
    /** true while the microphone is active */
    isListening,
    /** true while the AI model is generating a response */
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
    /** raw model status for the debug panel */
    modelStatus,
    /** mic permission status for the debug panel: 'unknown'|'granted'|'not_granted' */
    micPermissionStatus,
    /** triggers the OS-level mic permission prompt; returns 'granted'|'denied' */
    requestMicPermission,
    /** re-runs the full model + mic setup flow; useful from the debug panel */
    retryModelSetup,
    /** iOS only: parsed getModelDebugInfo(); null on Android or when missing/failed */
    modelDebugInfo,
  };
}
