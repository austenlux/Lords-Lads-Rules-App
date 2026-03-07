import { renderHook, act } from '@testing-library/react-native';
import { Platform, PermissionsAndroid } from 'react-native';

// Mock NativeVoiceAssistant before importing the hook.
const mockNativeModule = {
  checkModelStatus: jest.fn(),
  downloadModel: jest.fn(),
  getMicPermissionStatus: jest.fn(),
  getModelDebugInfo: jest.fn(),
  startListening: jest.fn(),
  stopListening: jest.fn(),
  askQuestion: jest.fn(),
  speak: jest.fn(),
  stopSpeaking: jest.fn(),
  stopAssistant: jest.fn(),
  getAvailableVoices: jest.fn(),
  setVoice: jest.fn(),
  setThinkingSoundEnabled: jest.fn(),
  markSpeechQueueComplete: jest.fn(),
  onSpeechPartialResults: jest.fn(() => ({ remove: jest.fn() })),
  onSpeechFinalResults: jest.fn(() => ({ remove: jest.fn() })),
  onAIChunkReceived: jest.fn(() => ({ remove: jest.fn() })),
  onDownloadProgress: jest.fn(() => ({ remove: jest.fn() })),
  onTTSFinished: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('../src/specs/NativeVoiceAssistantOptional', () => ({ __esModule: true, default: mockNativeModule }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/constants', () => ({
  buildGameAssistantPrompt: jest.fn(() => 'mock_prompt'),
}));

jest.mock('../src/utils/sanitizeTextForSpeech', () => ({
  sanitizeTextForSpeech: jest.fn((t) => t),
}));

const { useGameAssistant } = require('../src/hooks/useGameAssistant');

describe('useGameAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Platform.OS = 'android';
    mockNativeModule.checkModelStatus.mockResolvedValue('available');
    mockNativeModule.getAvailableVoices.mockResolvedValue(
      JSON.stringify({ voices: [], activeVoiceId: '' }),
    );
    PermissionsAndroid.check = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial state with all expected keys', () => {
    const { result } = renderHook(() => useGameAssistant());

    expect(result.current).toHaveProperty('isSupported');
    expect(result.current).toHaveProperty('isListening');
    expect(result.current).toHaveProperty('isThinking');
    expect(result.current).toHaveProperty('isActive');
    expect(result.current).toHaveProperty('partialSpeech');
    expect(result.current).toHaveProperty('fullAnswer');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('askTheRules');
    expect(result.current).toHaveProperty('stopAssistant');
    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('modelStatus');
    expect(result.current).toHaveProperty('micPermissionStatus');
    expect(result.current).toHaveProperty('availableVoices');
    expect(result.current).toHaveProperty('selectedVoiceId');
    expect(result.current).toHaveProperty('previewVoice');
    expect(result.current).toHaveProperty('downloadProgressBytes');
    expect(result.current).toHaveProperty('retryModelSetup');
    expect(result.current).toHaveProperty('modelDebugInfo');
    expect(result.current).toHaveProperty('isRetryingModelSetup');
    expect(result.current).toHaveProperty('retryModelSetupError');
  });

  it('sets isSupported=true when model is available (Android)', async () => {
    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(result.current.isSupported).toBe(true);
    expect(result.current.modelStatus).toBe('available');
  });

  it('sets isSupported=false when model is unavailable', async () => {
    mockNativeModule.checkModelStatus.mockResolvedValue('unavailable');

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(result.current.isSupported).toBe(false);
    expect(result.current.modelStatus).toBe('unavailable');
  });

  it('sets micPermissionStatus correctly on iOS via native module', async () => {
    Platform.OS = 'ios';
    mockNativeModule.getMicPermissionStatus.mockResolvedValue('granted');

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(mockNativeModule.getMicPermissionStatus).toHaveBeenCalled();
    expect(result.current.micPermissionStatus).toBe('granted');
  });

  it('sets micPermissionStatus to not_granted when iOS permission denied', async () => {
    Platform.OS = 'ios';
    mockNativeModule.getMicPermissionStatus.mockResolvedValue('denied');

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(mockNativeModule.getMicPermissionStatus).toHaveBeenCalled();
    expect(result.current.micPermissionStatus).toBe('not_granted');
  });

  it('sets micPermissionStatus to undetermined when iOS permission undetermined', async () => {
    Platform.OS = 'ios';
    mockNativeModule.getMicPermissionStatus.mockResolvedValue('undetermined');

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(mockNativeModule.getMicPermissionStatus).toHaveBeenCalled();
    expect(result.current.micPermissionStatus).toBe('undetermined');
  });

  it('subscribes to all native events on mount', () => {
    renderHook(() => useGameAssistant());

    expect(mockNativeModule.onSpeechPartialResults).toHaveBeenCalled();
    expect(mockNativeModule.onSpeechFinalResults).toHaveBeenCalled();
    expect(mockNativeModule.onAIChunkReceived).toHaveBeenCalled();
    expect(mockNativeModule.onTTSFinished).toHaveBeenCalled();
    expect(mockNativeModule.onDownloadProgress).toHaveBeenCalled();
  });

  it('stopAssistant calls native stopAssistant and resets state', async () => {
    const { result } = renderHook(() => useGameAssistant());

    act(() => {
      result.current.stopAssistant();
    });

    expect(mockNativeModule.stopAssistant).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
    expect(result.current.isThinking).toBe(false);
  });

  it('exposes modelDebugInfo null on Android', async () => {
    Platform.OS = 'android';
    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(result.current.modelDebugInfo).toBeNull();
  });

  it('exposes modelDebugInfo on iOS when getModelDebugInfo returns valid JSON', async () => {
    Platform.OS = 'ios';
    const debugPayload = { iosVersion: '18.0', modelAvailability: 'available' };
    mockNativeModule.getModelDebugInfo.mockResolvedValue(JSON.stringify(debugPayload));

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(mockNativeModule.getModelDebugInfo).toHaveBeenCalled();
    expect(result.current.modelDebugInfo).toEqual(debugPayload);
  });

  it('sets modelDebugInfo null on iOS when getModelDebugInfo rejects', async () => {
    Platform.OS = 'ios';
    mockNativeModule.getModelDebugInfo.mockRejectedValue(new Error('native error'));

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(result.current.modelDebugInfo).toBeNull();
  });

  it('retryModelSetup sets retryModelSetupError on failure and clears loading state', async () => {
    mockNativeModule.checkModelStatus.mockResolvedValue('unavailable');

    const { result } = renderHook(() => useGameAssistant());

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(result.current.isRetryingModelSetup).toBe(false);
    expect(result.current.retryModelSetupError).toBeNull();

    await act(async () => {
      await result.current.retryModelSetup();
    });

    expect(result.current.isRetryingModelSetup).toBe(false);
    expect(result.current.retryModelSetupError).toBe('Model not supported on this device');
  });
});
