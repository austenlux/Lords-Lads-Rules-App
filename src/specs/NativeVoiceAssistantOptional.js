/**
 * Optional Voice Assistant native module.
 * Uses get() so the app does not throw when the module is missing (e.g. iOS before link).
 * useGameAssistant imports this and guards all native calls when null.
 */
import { TurboModuleRegistry } from 'react-native';

export default TurboModuleRegistry.get('VoiceAssistant');
