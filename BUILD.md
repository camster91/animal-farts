# Android release build

PootBox ships its web bundle in a Capacitor Android wrapper. The stable
application ID is `com.ashbi.pootparty`; the store/display name is `PootBox`.
The current release metadata is version code `3`, version name `1.0.0`, minimum
SDK 24, and target/compile SDK 36.

## Supported toolchain

- Node 22 for Capacitor 8 commands (`npm ci`, build, and sync)
- JDK 21 for the current Android Gradle plugin
- Android SDK Platform 36 plus the build tools selected by Gradle
- the committed Gradle wrapper (`android/gradlew`)

Node 20 remains the web merge-gate runtime; use Node 22 for the Android release
pipeline because Capacitor CLI 8 requires it.

## Reproducible debug build

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew --no-daemon clean assembleDebug
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a
physical device with `adb install -r ...`. The app declares only Internet and
microphone permissions; microphone access is requested by Android when the
recording flow first needs it.

## Create and protect the release key

Key creation is an operator action. Run it once on a trusted workstation and
store the keystore plus passwords in two approved, access-controlled backup
locations. Losing this key prevents normal updates; exposing it compromises the
application identity.

```bash
keytool -genkeypair -v \
  -keystore pootbox-upload.jks \
  -alias pootbox-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

`*.jks`, `*.keystore`, `keystore.properties`, and `android/key.properties` are
ignored. Never commit, paste into an issue, or print the key or passwords.
Prefer Play App Signing with this file as the upload key.

## Signed App Bundle

Signing is configured only through process environment variables:

```bash
export POOTBOX_KEYSTORE_PATH=/absolute/private/path/pootbox-upload.jks
export POOTBOX_KEYSTORE_PASSWORD='from-secret-manager'
export POOTBOX_KEY_ALIAS=pootbox-upload
export POOTBOX_KEY_PASSWORD='from-secret-manager'

npm ci
npm run build
npx cap sync android
cd android
./gradlew --no-daemon clean bundleRelease
```

Gradle refuses release APK/AAB tasks unless all four signing variables are
present. Release builds enable code and resource shrinking. The AAB is
`android/app/build/outputs/bundle/release/app-release.aab`.

Verify without exposing secrets:

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
shasum -a 256 android/app/build/outputs/bundle/release/app-release.aab
```

Record the exact Git commit, version code/name, SHA-256, key alias, build tools,
and internal-track release ID in the private release record. Do not record
passwords or certificate private material.

## Store and QA gates

Before internal-track upload, complete `docs/physical-qa.md` against the exact
commit and AAB. Store listing copy, screenshots, content rating, privacy policy,
Data Safety answers, support contact, and release notes must describe the v1
Play-only boundary: microphone recording and server upload, device ownership ID,
30-day possession-based share codes, no ads/analytics, and dormant public social
features.

Internal-track upload and production-store submission are external changes.
They require action-time operator approval; building an AAB does not authorize
submission.

For rollback, retain the prior Play artifact and release record. Android store
updates cannot decrement `versionCode`; a corrective release must increment it
and preserve the same application ID and signing lineage.
