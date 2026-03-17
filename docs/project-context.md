# Project Context — Lords and Lads Rules App

Read this file before starting any work. It describes the current state of the project, its tech stack, architecture, and conventions.

## Product Overview

A mobile companion app for the "Lords and Lads" tabletop game. Displays game rules and expansion content (fetched from GitHub as Markdown), includes game-specific tools (calculators), and features an on-device AI voice assistant powered by Gemini Nano that answers questions about the rules.

## Tech Stack

| Layer | Technology | Source of truth for version |
|---|---|---|
| Framework | React Native | `package.json` → `react-native` |
| JS Runtime | Hermes | Default for the installed RN version |
| React | React | `package.json` → `react` |
| Language (shared) | JavaScript (`.js`) with one TypeScript TurboModule spec (`.ts`) | — |
| Language (Android native) | Kotlin | `android/build.gradle` → `kotlinVersion` |
| Language (iOS native) | Swift | — |
| Package manager | npm | `package-lock.json` |
| Bundler | Metro | `metro.config.js` |

## Platform Targets

| Platform | Source of truth for min version | Build tool | Artifact |
|---|---|---|---|
| Android | `android/build.gradle` → `minSdkVersion` | Gradle (`android/app/build.gradle`) | Signed release APK |
| iOS | `ios/Podfile` → `platform :ios` | Xcode / CocoaPods (`ios/Podfile`) | Simulator release build (IPA via Xcode archive) |

## Dependencies

For exact versions, always read `package.json` (JS deps) and `android/app/build.gradle` (native-only deps). Do not rely on the summaries below for version accuracy.

### Production (JS — see `package.json`)
- `@op-engineering/op-sqlite` — SQLite with FTS5 and sqlite-vec extensions
- `@react-native-async-storage/async-storage` — key-value persistence
- `react-native-fs` — file system access
- `react-native-markdown-display` — Markdown rendering
- `react-native-pager-view` — swipeable tab views (Android; iOS uses horizontal ScrollView)
- `react-native-safe-area-context` — safe area insets
- `react-native-svg` — SVG icon rendering

### Dev (JS — see `package.json` devDependencies)
- `jest` / `babel-jest` — test runner (configured but no tests written yet)
- `eslint` / `prettier` — linting and formatting
- `patch-package` — patches for `react-native`, `react-native-svg`, `markdown-it`
- `react-native-svg-transformer` — import `.svg` files as React components

### Native-only (Android — see `android/app/build.gradle` dependencies block)
- ML Kit GenAI Prompt API — Gemini Nano on-device inference
- Kotlin Coroutines — async support for native modules
- Android `SpeechRecognizer` (SDK, no extra dep) — on-device speech-to-text
- Android `TextToSpeech` (SDK, no extra dep) — text-to-speech

## Project Structure

```
/
├── App.js                          # Root component — splash, tab navigation, voice assistant
├── index.js                        # Entry point, SafeAreaProvider, font scaling disabled
├── package.json
├── metro.config.js                 # SVG transformer config
├── react-native.config.js
├── .svgrrc.js                      # SVG transform options
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── CollapsibleSection.js
│   │   ├── EmptySearchResults.js
│   │   ├── HighlightedMarkdown.js
│   │   ├── NoWifiIcon.js
│   │   ├── Section.js
│   │   ├── TitleSection.js
│   │   ├── VoiceAssistantFAB.js
│   │   ├── VoiceAssistantModal.js
│   │   └── index.js
│   ├── screens/                    # Screen-level components
│   │   ├── ContentScreen.js
│   │   ├── MoreScreen.js
│   │   ├── ToolsScreen.js
│   │   └── index.js
│   ├── hooks/
│   │   ├── useContent.js           # Content fetching, caching, search, section state
│   │   └── useGameAssistant.js     # Voice assistant state machine
│   ├── services/
│   │   └── contentService.js       # GitHub fetch, cache, markdown parsing
│   ├── utils/
│   │   ├── sanitizeTextForSpeech.js
│   │   └── searchUtils.js
│   ├── specs/
│   │   └── NativeVoiceAssistant.ts # TurboModule spec (codegen)
│   ├── styles/
│   │   ├── appStyles.js            # Main StyleSheet
│   │   ├── markdownStyles.js
│   │   └── index.js
│   ├── constants.js                # URLs, cache keys, AI prompt template, Venmo utils
│   └── buildInfo.js                # Auto-generated at build time (gitignored)
├── android/
│   ├── app/build.gradle            # Android build config, signing, ML Kit dep
│   ├── build.gradle                # Root Gradle config (SDK versions, Kotlin version)
│   └── app/src/main/java/com/lux/lnlrules/
│       ├── MainActivity.kt
│       ├── MainApplication.kt
│       ├── voiceassistant/         # Native module: Gemini Nano + STT + TTS
│       │   ├── VoiceAssistantModule.kt
│       │   ├── VoiceAssistantPackage.kt
│       │   └── ThinkingSoundPlayer.kt
│       └── embedder/               # Native module: text embedding (unused/WIP)
├── ios/
│   ├── Podfile                     # CocoaPods config
│   └── LordsandLadsRules/
│       ├── AppDelegate.swift
│       ├── Info.plist
│       ├── LaunchScreen.storyboard
│       └── PrivacyInfo.xcprivacy
├── assets/                         # Images, icons, audio files
├── patches/                        # patch-package patches (markdown-it, react-native, react-native-svg)
├── scripts/
│   └── generateBuildInfo.js        # Stamps git commit + version into src/buildInfo.js
└── .cursor/
    ├── rules/                      # Project-level Cursor rules
    └── agents/                     # Agent definitions (this ecosystem)
```

## Architecture Notes

- **No formal state management library** — state is managed via React hooks (`useState`, `useEffect`, `useRef`) and lifted to `App.js`
- **No navigation library** — tab navigation is manual via `PagerView` (Android) and horizontal `ScrollView` (iOS)
- **Content is fetched from GitHub** — rules and expansion Markdown files are pulled at runtime, cached in AsyncStorage, and parsed into collapsible section trees
- **AI voice assistant is Android-only** — uses a Kotlin TurboModule (New Architecture) for Gemini Nano inference, on-device STT, and TTS. iOS has no voice assistant implementation yet.
- **TurboModule (New Architecture)** — the native bridge uses React Native's TurboModule system with a TypeScript codegen spec at `src/specs/NativeVoiceAssistant.ts`
- **Font scaling disabled globally** — `allowFontScaling = false` set in `index.js` for consistent layout

## Styling

- **Dark theme** — background `#121212`, primary accent `#BB86FC`, text `#E1E1E1`
- **StyleSheet-based** — all styles in `src/styles/appStyles.js` using React Native `StyleSheet.create()`
- **No theme system or design tokens** — colors and spacing are hardcoded in the StyleSheet
- **Platform-conditional styles** — `Platform.OS` checks for iOS vs Android differences (e.g., tab height, logo size, header padding)

## Build & Deploy

- **Build info stamping:** `npm run sync:build-info` runs `scripts/generateBuildInfo.js` which captures git commit hash, version, and timestamp into `src/buildInfo.js`. This runs automatically as part of `npm run build:android`.
- **IMPORTANT:** Always commit before building — the build stamps the current HEAD commit hash. Building before committing embeds the wrong (previous) hash.
- **Android build:** `npm run build:android` → signed release APK
- **Android install:** `npm run install:android:release` → builds + installs via USB
- **iOS simulator:** `npm run install:ios:release` → release build on iPhone 16 Pro simulator
- **APK naming:** `lords-and-lads-rules-<versionName>.apk`
- **Signing:** Release signing via `android/keystore.properties` (gitignored)
- **Patches:** `postinstall` runs `patch-package` to apply patches in `patches/`

## App Identity

- **Package name (Android):** `com.lux.lnlrules` (see `android/app/build.gradle` → `namespace`)
- **Bundle ID (iOS):** `LordsandLadsRules` (see `ios/Podfile` → `project`)
- **App name:** Lords and Lads Rules
- **Version:** See `package.json` → `version` and `android/app/build.gradle` → `versionCode` / `versionName`

## Test Infrastructure

- **Jest** is configured in `package.json` (`npm test`) but **no tests have been written yet**
- **No E2E framework** is currently installed (no Maestro, no Detox)
- **No component testing** setup (no React Native Testing Library)
- The test infrastructure will need to be set up from scratch

## UI Regression Checklist

Run on iOS (and Android where parity is expected) for any UI or layout change. Report pass/fail for each:

- **Background logo:** Is the centered background logo and semi-transparent overlay visible behind content on all tabs (Rules, Expansions, Tools, More)? On Android: confirm no regression.
- **Tools screen layout:** Do Tools tab sections (Nail Calculator, Game Stat Tracker, etc.) use full-width layout — not centered in a narrow strip, squished, or cut off? Compare to More tab section layout. On Android: confirm no regression.
- **Nail buttons (More screen):** Are all six nail icon images visible on the "Buy me some nails" buttons ($1, $5, $20, $50, $100, $250) on the More screen? On Android: confirm no regression.

---

## Known Gaps / Tech Debt

- Voice assistant is Android-only — iOS native module is stubbed but not implemented
- No formal design token system — colors/spacing hardcoded
- No automated test suite of any kind
- App.js is a 600+ line monolith — needs decomposition
- No navigation library — manual tab switching
- Font scaling disabled globally — accessibility concern
