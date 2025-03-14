# Lords & Lads Rules Mobile App

A React Native mobile application for displaying and managing game rules.

## Installation

### Direct APK Installation
The debug APK is available in the `/releases` directory as `lnl-rules-debug.apk`

To install:
1. Download the APK from the `/releases` directory
2. Transfer it to your Android device
3. Open the APK on your device to install

### Development Setup

Prerequisites:
- Node.js (v18 or newer)
- npm (v9 or newer)
- Android Studio and Android SDK for Android development
- Xcode (for iOS development, Mac only)
- A running Android emulator or physical device

Steps:
1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running the App

Start the Metro bundler:
```bash
npm start
```

Then in the Metro bundler interface:
- Press `a` to run on Android
- Press `i` to run on iOS (Mac only)

## Building APK

To generate a new debug APK in the `/releases` directory:

```bash
cd android && ./gradlew assembleDebug
```

The APK will be automatically copied to the `/releases` directory at the project root.

## Development

The app is built with:
- React Native 0.73.6
- TypeScript
- React Native Markdown Display for rule content

## Project Structure

- `/android` - Android native code
- `/ios` - iOS native code
- `/App.js` - Main app component
- `/components` - React components
- `/assets` - Images and other static assets
- `/releases` - Generated APK file

## Troubleshooting

If you encounter the "address already in use" error:
1. The start script will automatically attempt to kill any existing Metro instances
2. If issues persist, manually kill the process:
```bash
killall -9 node
```

Then try running `npm start` again.

## Features

- Interactive table of contents with quick navigation
- Collapsible sections and subsections
- Smooth scrolling to selected sections
- Dark mode UI optimized for readability
- Maintains original markdown formatting
- Offline access to rules

## Technology

- React Native
- React Native Markdown Display

## License

This app is a companion to the Lords and Lads game. Game rules content is owned by its respective creators.