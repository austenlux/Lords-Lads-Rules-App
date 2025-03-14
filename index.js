import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register the app with the exact same name as in MainActivity.java
AppRegistry.registerComponent(appName, () => App);