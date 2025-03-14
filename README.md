# Lords and Lads Rules App

A React Native mobile app that provides an interactive, navigable version of the Lords and Lads game rules.

## Quick Install

Pre-built app packages are available in the `artifacts` directory:

- Android: Download `artifacts/android/lords-and-lads-rules.apk`
  - Enable "Install from Unknown Sources" in your device settings
  - Open the downloaded APK to install

- iOS: Download `artifacts/ios/lords-and-lads-rules.ipa`
  - Use TestFlight or your provisioning profile to install
  - Note: iOS installation requires signing with your Apple Developer account

## Features

- Interactive table of contents with quick navigation
- Collapsible sections and subsections
- Smooth scrolling to selected sections
- Dark mode UI optimized for readability
- Maintains original markdown formatting
- Offline access to rules

## Development

### Prerequisites

1. Install development tools:
```bash
# Install Node.js dependencies
npm install

# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas login
eas build:configure
```

2. Platform-specific setup:
- iOS:
  - Install Xcode
  - `xcode-select --install`
  - Set up your Apple Developer account
- Android:
  - Install Android Studio
  - Set up the Android SDK
  - Set ANDROID_HOME environment variable

### Building the Apps

```bash
# Build Android APK (outputs to artifacts/android/)
npm run build:android

# Build iOS IPA (outputs to artifacts/ios/)
npm run build:ios

# Build both platforms
npm run build
```

The built apps will be automatically copied to the `artifacts` directory.

### Development Mode

1. Start the development server:
```bash
npm start
```

2. Run on your device:
- iOS: Press 'i' in the terminal
- Android: Press 'a' in the terminal

## Technology

- React Native
- Expo
- React Native Markdown Display
- EAS Build

## License

This app is a companion to the Lords and Lads game. Game rules content is owned by its respective creators.