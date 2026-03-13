import { AppRegistry, Text, TextInput, NativeModules, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';
import { logError, logEvent, logAppLaunch } from './src/services/errorLogger';

logAppLaunch();

logEvent('Diagnostic', `Platform: ${Platform.OS} ${Platform.Version}`);
const networkingModule = NativeModules.Networking;
logEvent('Diagnostic', `RCTNetworking module: ${networkingModule ? 'registered' : 'MISSING'}`, {
  moduleKeys: networkingModule ? Object.keys(networkingModule).join(', ') : 'N/A',
});

setTimeout(() => {
  const testUrl = 'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md';

  logEvent('Diagnostic', 'fetch() test starting (5s delay)', { url: testUrl });
  const t0 = Date.now();
  fetch(testUrl)
    .then(res => logEvent('Diagnostic', `fetch() returned HTTP ${res.status}`, { elapsedMs: Date.now() - t0, url: testUrl }))
    .catch(err => logError('Diagnostic', err, { elapsedMs: Date.now() - t0, errorName: err?.name, note: 'fetch() failed' }));

  logEvent('Diagnostic', 'XMLHttpRequest test starting (5s delay)', { url: testUrl });
  const t1 = Date.now();
  const xhr = new XMLHttpRequest();
  xhr.open('GET', testUrl);
  xhr.onload = () => logEvent('Diagnostic', `XHR returned HTTP ${xhr.status}`, { elapsedMs: Date.now() - t1, url: testUrl });
  xhr.onerror = () => logError('Diagnostic', `XHR error: ${xhr.statusText || 'unknown'}`, { elapsedMs: Date.now() - t1 });
  xhr.ontimeout = () => logError('Diagnostic', 'XHR timed out', { elapsedMs: Date.now() - t1 });
  xhr.timeout = 15000;
  xhr.send();
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