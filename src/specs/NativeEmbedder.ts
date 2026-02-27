import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * TurboModule spec for the on-device text embedder.
 *
 * Android: backed by MediaPipe TextEmbedder + Universal Sentence Encoder.
 * iOS:     stub — returns [] until iOS implementation is added.
 *
 * Codegen generates NativeEmbedderSpec.kt (Android) at build time.
 */
export interface Spec extends TurboModule {
  /**
   * Converts a text string into a normalized float embedding vector.
   * The returned array length is fixed at 100 (USE output dimension).
   * Returns an empty array on iOS (unimplemented) or on error.
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Warms up the embedder so the first real embedText() call has no
   * model-load latency.  Safe to call multiple times — no-op after first.
   */
  warmUp(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Embedder');
