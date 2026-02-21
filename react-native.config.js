/**
 * React Native CLI config.
 * Provides Android projectConfig so "npx @react-native-community/cli config" output
 * includes project.android.packageName for Gradle autolinking (RN 0.76+).
 */
const path = require('path');
const androidConfig = require('@react-native-community/cli-config-android');

const root = path.resolve(__dirname);

module.exports = {
  platforms: {
    android: {
      projectConfig: (r) => androidConfig.projectConfig(r || root),
      dependencyConfig: androidConfig.dependencyConfig,
    },
  },
};
