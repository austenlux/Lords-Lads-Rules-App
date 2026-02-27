import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * TurboModule spec for the on-device Voice Assistant.
 * Codegen generates the Android (NativeVoiceAssistantSpec) and iOS
 * counterparts from this interface at build time.
 *
 * All AI logic is Android-only for now; iOS stubs will be added in a later phase.
 */
export interface Spec extends TurboModule {
  /**
   * Checks whether Gemini Nano is available and downloaded on the device.
   * Resolves with: 'available' | 'downloadable' | 'downloading' | 'unavailable'
   */
  checkModelStatus(): Promise<string>;

  /**
   * Triggers a Gemini Nano model download (only call when checkModelStatus returns 'downloadable').
   * Resolves with 'completed' when the download finishes, rejects on failure.
   * Download progress events will be emitted via DeviceEventEmitter in a later phase.
   */
  downloadModel(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('VoiceAssistant');
