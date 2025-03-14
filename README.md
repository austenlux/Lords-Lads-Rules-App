# Lords & Lads Rules Mobile App

A React Native mobile application for displaying game rules.

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
npm run build:android
```

This command will:
1. Create necessary asset directories
2. Bundle the JavaScript code
3. Build the debug APK
4. Copy it to the `/releases` directory

The resulting APK will work on any Android device without needing the Metro development server.

## Development

The app is built with:
- React Native 0.73.6
- React Native Markdown Display

## Project Structure

- `/android` - Android native code
- `/ios` - iOS native code
- `/App.js` - Main app component
- `/components` - React components
- `/assets` - Images and other static assets
- `/releases` - Generated app artifacts
