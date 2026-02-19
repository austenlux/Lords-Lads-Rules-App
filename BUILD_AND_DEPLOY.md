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
| Build standalone iOS IPA    | Xcode: Product → Archive → Distribute App (or use `xcodebuild` as above) |

Release artifacts are fully self-contained and do not require React Native tooling to be running after install.
