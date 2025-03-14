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

### Building the Apps

```bash
# Install dependencies
npm install

# Build Android APK
npm run build:android

# Build iOS IPA
npm run build:ios
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

## License

This app is a companion to the Lords and Lads game. Game rules content is owned by its respective creators.