# Lords & Lads Rules Mobile App

A React Native mobile application for displaying game rules.

## Installation

The latest release builds (APK for Android and IPA for iOS) are available on the [Releases](https://github.com/austenlux/Lords-Lads-Rules-App/releases) page.

### Android Installation
1. Download the latest APK file (e.g., `lords-and-lads-rules-1.0.0.apk`) from the Releases page
2. Transfer it to your Android device
3. Open the APK on your device to install
4. If needed, enable "Install from Unknown Sources" in your Android settings

### iOS Installation
Due to Apple's restrictions, iOS builds cannot be freely distributed like Android APKs. To install the iOS version:

1. Contact the maintainers with your device's UDID
2. Wait for a new build that includes your device in the provisioning profile
3. Once your device is registered, download the IPA file from the Releases page
4. Install using AltStore, Sideloadly, or Apple Configurator 2

To find your UDID:
1. Connect your iOS device to a Mac
2. Open Finder
3. Select your device
4. Click on the device name to reveal the UDID

### Development Setup

Prerequisites:
- Node.js (v18 or newer)
- npm (v9 or newer)
- Android Studio and Android SDK for Android development
- Xcode 15+ (for iOS development, Mac only)
- CocoaPods (for iOS development)
- A running Android emulator or physical device
- iOS Simulator or physical iOS device (for iOS development)

Steps:
1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. For iOS development, install CocoaPods dependencies:
```bash
cd ios && pod install && cd ..
```

## Running the App

Start the Metro bundler:
```bash
npm start
```

Then in the Metro bundler interface:
- Press `a` to run on Android
- Press `i` to run on iOS (Mac only)

### Running on iOS
To run the app on iOS:

1. Open `ios/LordsandLadsRules.xcworkspace` in Xcode
2. Select your target device/simulator
3. Build and run (⌘R)

Or use the command line:
```bash
npx react-native run-ios
```

## Building

### Android APK

#### Debug Build
To build a debug APK:

```bash
cd android && ./gradlew assembleDebug
```

The debug APK will be generated at `android/app/build/outputs/apk/debug/lords-and-lads-rules-debug.apk`

#### Release Build
To build a release APK:

```bash
cd android && ./gradlew assembleRelease
```

The release APK will be generated at `android/app/build/outputs/apk/release/lords-and-lads-rules-[version].apk`

Note: Release builds are signed with our release keystore. For contributing developers, contact the maintainers for keystore access.

### iOS Build
To build and install the iOS app:

1. Open `ios/LordsandLadsRules.xcworkspace` in Xcode
2. Select your target device
3. Select Product > Build
4. Run on your device

Note: Running on physical iOS devices requires appropriate development certificates and provisioning profiles.

## Development

The app is built with:
- React Native 0.73.6
- React Native Markdown Display
- CocoaPods (iOS dependency management)

## Project Structure

- `/android` - Android native code
- `/ios` - iOS native code and Xcode project
  - `LordsandLadsRules.xcworkspace` - Main Xcode workspace
  - `Podfile` - iOS dependencies
  - `LordsandLadsRules` - iOS app source
- `/App.js` - Main app component
- `/assets` - Images and other static assets

## iOS Requirements
- iOS 15.1 or later
- iPhone, iPad, and iPod touch (arm64)

## Building Release Versions

### Android APK
To build a signed release APK:

```bash
cd android && ./gradlew assembleRelease
```

The release APK will be generated at `android/app/build/outputs/apk/release/lords-and-lads-rules-[version].apk`

Note: Release builds require the keystore file and credentials. Contact the maintainers for access.

### iOS IPA
To build a signed release IPA:

1. Open `ios/LordsandLadsRules.xcworkspace` in Xcode
2. Select "Any iOS Device" as the build target
3. Select Product > Archive
4. In the Organizer window, click "Distribute App"
5. Choose "Development" distribution
6. Generate and download the IPA file

Note: Building IPAs requires appropriate development certificates and provisioning profiles.
