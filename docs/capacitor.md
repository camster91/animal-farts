# Capacitor Android — Technical Notes

## Why Capacitor

Android Chrome installs the web app as a PWA, but Chrome-generated PWAs do not include `RECORD_AUDIO` in the app manifest. This means `getUserMedia` fails silently — the kid can't record.

Capacitor packages the web app into a WebView with a proper `AndroidManifest.xml` that declares `RECORD_AUDIO`, so the system permission dialog appears and the mic works.

## What Capacitor does

1. Wraps the `dist/` web bundle in a native Android WebView
2. Copies `dist/` → `android/app/src/main/assets/public/`
3. Generates a native Android project under `android/`
4. Capacitor reads `public/manifest.webmanifest` for splash screen config

## Capacitor config (`capacitor.config.ts`)

```ts
const config: CapacitorConfig = {
  appId: 'com.ashbi.pootparty',
  appName: 'Poot Party',
  webDir: 'dist',
  android: {
    allowMixedContent: false,  // HTTPS only
  },
  server: {
    url: undefined,            // Use bundled assets (offline)
    cleartext: false,          // HTTPS only
  },
};
```

## RECORD_AUDIO permission

Added to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

The WebView shows the system mic dialog on first use. Our `Permissions API` pre-check in `PootBox.tsx` still works the same way — it shows the "mic denied" banner if the user has already denied the permission in the app settings.

## Vite base path

`vite.config.ts` has `base: "./"` so all asset paths are relative. This is required for the WebView to load assets correctly from the filesystem (Capacitor's bundled assets don't use a server).

## Web app behavior in WebView

The same bundle works in both:
- Chrome PWA (existing)
- Capacitor WebView (new)

No code changes to `PootBox.tsx` were needed. The WebView's `getUserMedia`, `Permissions API`, `IndexedDB`, and `localStorage` all work identically to Chrome.

## NPM scripts

| Script | What it does |
|--------|-------------|
| `npm run cap:sync` | Copy `dist/` → Android assets |
| `npm run cap:build` | `npm run build && cap sync android` |
| `npm run cap:open` | Open Android Studio |

## Rebuild checklist

After any web change:
1. `npm run cap:build` — builds web app + syncs to Android
2. `cd android && ./gradlew assembleDebug` — builds APK (requires JDK 17+)
3. `adb install android/app/build/outputs/apk/debug/app-debug.apk` — installs on device

## Testing on real device

The Android emulator mic does not work. **Real device required** to test recording.

## Release signing (TBD)

Cam needs to set up a keystore. Until then, only debug builds are possible.

## Files

- `capacitor.config.ts` — Capacitor config (source of truth)
- `android/app/src/main/assets/capacitor.config.json` — generated copy
- `android/app/src/main/assets/public/` — the web bundle
- `android/app/src/main/AndroidManifest.xml` — permissions
