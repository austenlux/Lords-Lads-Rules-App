import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * TurboModule spec for the on-device Voice Assistant.
 * Codegen will generate the Android (NativeVoiceAssistantSpec) and iOS
 * counterparts from this interface at build time.
 *
 * All AI logic is Android-only for now; iOS stubs will be added in a later phase.
 */
export interface Spec extends TurboModule {
  /**
   * Checks whether Gemini Nano is available and downloaded on the device.
   * Resolves with a status string: 'available' | 'downloading' | 'unavailable' | 'not_implemented'
   */
  checkModelStatus(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('VoiceAssistant');
