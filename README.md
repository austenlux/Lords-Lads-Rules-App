# Lords & Lads Rules Mobile App

A React Native mobile application for displaying game rules.

## Installation

### Direct APK Installation
The latest release APK is available on the [Releases](https://github.com/austenlux/Lords-Lads-Rules-App/releases) page.

To install:
1. Visit the [Releases](https://github.com/austenlux/Lords-Lads-Rules-App/releases) page
2. Download the latest APK (e.g., `lords-and-lads-rules-1.0.0.apk`)
3. Transfer it to your Android device
4. Open the APK on your device to install

Note: If you're installing a debug build for testing, you'll need to enable "Install from Unknown Sources" in your Android settings.

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

## Building APKs

### Debug Build
To build a debug APK:

```bash
cd android && ./gradlew assembleDebug
```

The debug APK will be generated at `android/app/build/outputs/apk/debug/lords-and-lads-rules-debug.apk`

### Release Build
To build a release APK:

```bash
cd android && ./gradlew assembleRelease
```

The release APK will be generated at `android/app/build/outputs/apk/release/lords-and-lads-rules-[version].apk`

Note: Release builds are signed with our release keystore. For contributing developers, contact the maintainers for keystore access.

## Development

The app is built with:
- React Native 0.73.6
- React Native Markdown Display

## Project Structure

- `/android` - Android native code
- `/ios` - iOS native code
- `/App.js` - Main app component
- `/assets` - Images and other static assets
