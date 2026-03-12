import { AppRegistry, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';
import { logError, logEvent, logAppLaunch } from './src/services/errorLogger';

logAppLaunch();

setTimeout(() => {
  const testUrl = 'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md';
  logEvent('Connectivity', 'Diagnostic fetch starting (5s delay)', { url: testUrl });
  const t0 = Date.now();
  fetch(testUrl)
    .then(res => {
      logEvent('Connectivity', `HTTP ${res.status} in ${Date.now() - t0}ms`, { url: testUrl });
    })
    .catch(err => {
      logError('Connectivity', err, { elapsedMs: Date.now() - t0, errorName: err?.name, url: testUrl });
    });
}, 5000);

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