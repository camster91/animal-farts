# Android Build (Capacitor)

## What was built

Capacitor wraps the PootBox web app as a native Android APK. The WebView now has `RECORD_AUDIO` permission, so `getUserMedia` works and the kid can record their own sound on Android.

## APK path

```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Install on Android device

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the device and open it directly.

## Dev workflow

```bash
# 1. Make a web change
npm run build

# 2. Sync to Android
npm run cap:sync

# 3. Open in Android Studio
npm run cap:open
# then click Run in Android Studio

# Or rebuild APK from command line (requires JDK 17+)
cd android && ./gradlew assembleDebug
```

## Build release APK

**TBD — requires a signing key.** Cam needs to set up a keystore first:

1. Generate a release keystore:
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias pootparty -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add to `android/app/build.gradle` (see Capacitor docs for `signingConfigs` block)
3. Run: `cd android && ./gradlew assembleRelease`

## Prerequisites for building

- **JDK 17+** — required to run Gradle. Install via https://adoptium.net/ or `brew install openjdk@17`
- **Android SDK** — install Android Studio or `sdkmanager` from command-line tools
- Set `JAVA_HOME` env var pointing to your JDK install

## Test on real device

The emulator mic does not work reliably. Test recording on a **real Android device**.

## Files added/modified

| File | Change |
|------|--------|
| `vite.config.ts` | `base: "./"` for relative asset paths in WebView |
| `capacitor.config.ts` | New — Android config with `allowMixedContent: false`, `cleartext: false` |
| `package.json` | Added `cap:sync`, `cap:build`, `cap:open` scripts |
| `android/` | New — full Capacitor Android project |
| `public/manifest.webmanifest` | Unchanged — still used by Chrome PWA |

## Permissions

`android.permission.RECORD_AUDIO` is declared in `AndroidManifest.xml`. The WebView will show the system mic permission dialog on first use.
