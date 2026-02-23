import { AppRegistry, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

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