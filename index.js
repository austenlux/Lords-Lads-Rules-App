import { AppRegistry, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';
import { logError, logAppLaunch } from './src/services/errorLogger';

logAppLaunch();

const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  logError('Unhandled Exception', error, { fatal: !!isFatal });
  if (defaultHandler) defaultHandler(error, isFatal);
});

// Disable system font scaling so layout and line counts stay consistent across devices and OS text-size settings.
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;

// Register the app
function AppWithSafeArea() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}
AppRegistry.registerComponent('LordsandLadsRules', () => AppWithSafeArea);