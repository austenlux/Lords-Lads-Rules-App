# Build and deploy: standalone app artifacts

Release builds **bundle the full JavaScript and assets inside the app**. No Metro, no dev server, no cable—the app runs 100% offline after install.

---

## Android: standalone APK

### Build the release APK

From the project root:

```bash
npm run build:android
```

Or:

```bash
cd android && ./gradlew assembleRelease
```

- **Output:** `android/app/build/outputs/apk/release/lords-and-lads-rules-<versionName>.apk` (e.g. `lords-and-lads-rules-1.4.0.apk`).
- **Signing:** Uses `android/app/release.keystore` (configured in `android/app/build.gradle`). Keep this keystore safe; you need it for all future updates.

### Install the APK on a device

**Always use the release-signed build.** `npm run install:android:release` and `npm run build:android` both use `release.keystore` (see `android/app/build.gradle`). If install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the device has an app signed with a different key. Common cases: (1) an old debug build was installed; (2) the app was installed from the Play Store—Google re-signs with the Play signing key, so a local release APK (signed with your upload key) is treated as a different app. Uninstall the existing app once, then install the local release APK.

**Option A – Build and install in one step (device connected via USB):**

```bash
npm run install:android:release
```

**Option B – Install an APK you already built:**

```bash
adb install android/app/build/outputs/apk/release/lords-and-lads-rules-1.4.0.apk
```

**Option C – Copy APK to the device** (e.g. via cloud, email, or USB file copy), then open it on the device and install. No computer or `adb` required after the file is on the device.

The installed app does **not** need Metro or any dev tooling. It works offline and after unplugging the phone.

---

## iOS: standalone app on simulator (no Metro)

Build and run the **Release** app on the iOS simulator. All JavaScript is bundled inside the app; no dev server is used or required.

From the project root:

```bash
npm run install:ios:release
```

Or with an explicit simulator and no packager:

```bash
npx react-native run-ios --mode Release --simulator "iPhone 16 Pro" --no-packager
```

The app that launches is the same kind of artifact you’d ship to the store (bundled JS, no Metro). Use this to test the final build on the simulator.

---

## iOS: standalone IPA (macOS only)

1. **Open the workspace in Xcode:**

   ```bash
   open ios/LordsandLadsRules.xcworkspace
   ```

2. **Select the “Any iOS Device (arm64)” (or a connected device) as destination**—not a simulator.

3. **Create an archive:** Menu **Product → Archive**.

4. **Export the IPA:** In the Organizer window, select the archive → **Distribute App** → choose **Ad Hoc** (devices) or **App Store** → follow the steps. You’ll need an Apple Developer team and correct signing.

5. **Optional – CLI (for automation):**  
   Ensure `ios/exportOptions.plist` has your `teamID` and the right `method` (e.g. `app-store` or `ad-hoc`). Then:

   ```bash
   cd ios
   xcodebuild -workspace LordsandLadsRules.xcworkspace -scheme LordsandLadsRules -configuration Release -archivePath build/LordsandLadsRules.xcarchive archive
   xcodebuild -exportArchive -archivePath build/LordsandLadsRules.xcarchive -exportPath build/ -exportOptionsPlist exportOptions.plist
   ```

   The IPA will be under `ios/build/`. Install via TestFlight, Ad Hoc, or App Store. No Metro or dev server is required at run time.

---

## Summary

| Goal                         | Command / action |
|-----------------------------|------------------|
| Build standalone Android APK | `npm run build:android` |
| Build + install APK (USB)   | `npm run install:android:release` |
| Build + run standalone iOS on simulator | `npm run install:ios:release` |
| Build standalone iOS IPA    | Xcode: Product → Archive → Distribute App (or use `xcodebuild` as above) |

Release artifacts are fully self-contained and do not require React Native tooling to be running after install.
