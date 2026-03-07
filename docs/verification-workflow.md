# App verification workflow: install → launch → screenshot

The Tester (or assigned agent) must be able to verify the app on device/simulator without relying on the user to manually check. Use this workflow to build, install, launch, capture screenshots, and confirm UI state.

## Prerequisites

- Commit all changes before building (build stamps git commit; see `.cursor/rules/build-and-install.mdc`).
- From repo root: `npm run sync:build-info` then build/install for the target.

---

## iOS Simulator

1. **Build and install (release, no Metro):**
   ```bash
   npm run sync:build-info && npx react-native run-ios --mode Release --simulator "iPhone 16 Pro" --no-packager
   ```
   Or use: `npm run install:ios:release` (same effect).

2. **Launch** (if app is not already running after install):
   ```bash
   xcrun simctl launch booted com.lux.lnlrules
   ```
   Bundle ID: `com.lux.lnlrules` (see `ios/LordsandLadsRules.xcodeproj/project.pbxproj`).

3. **Screenshot:**
   ```bash
   xcrun simctl io booted screenshot /tmp/lnl-verify-$(date +%Y%m%d-%H%M%S).png
   ```
   Or a fixed path for automation: e.g. `screenshots/ios-more-debug.png`.

4. **Verify:** Open the screenshot and confirm the expected UI (e.g. More → Debug expanded, Voice Assistant expanded, "iOS Debug Info" section visible).

---

## iOS Physical device

1. **Build and install (release, no Metro):**
   ```bash
   npm run sync:build-info && npx react-native run-ios --device --mode Release --no-packager
   ```
   Select the connected device when prompted.

2. **Launch** (if needed):
   ```bash
   xcrun devicectl device process launch --device <UDID> com.lux.lnlrules
   ```
   Or launch from the device home screen after install.

3. **Screenshots:** Use Xcode → Window → Devices and Simulators → select device → take screenshot, or ask user to confirm UI state. Automated device screenshots require additional tooling (e.g. `idevicescreenshot` if libimobiledevice is installed).

4. **Verify:** Confirm the expected UI from screenshot or user confirmation.

---

## Android (emulator or device)

1. **Build and install:**
   ```bash
   npm run sync:build-info && npm run install:android:release
   ```

2. **Launch:**
   ```bash
   adb shell am start -n com.lux.lnlrules/.MainActivity
   ```
   Or: `npm run launch:android`

3. **Screenshot:**
   ```bash
   adb exec-out screencap -p > /tmp/lnl-android-$(date +%Y%m%d-%H%M%S).png
   ```

4. **Verify:** Open the screenshot and confirm the expected UI.

---

## Verification checklist (e.g. iOS Debug Info)

- [ ] App launches and stays running (no immediate crash).
- [ ] Navigate to More tab → scroll to Debug section.
- [ ] Debug section is expanded (on iOS, default-expanded).
- [ ] Voice Assistant subsection is expanded (on iOS, default-expanded).
- [ ] "iOS Debug Info" block is visible (iOS only) with content (loading, JSON, or error message).
- [ ] Screenshot(s) captured and attached to the verification report.

Report pass/fail with screenshot paths or inline evidence.
