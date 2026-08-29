import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

describe("Android release contract", () => {
  it("keeps stable identity with finalized PootBox release metadata", () => {
    const gradle = read("android/app/build.gradle");
    const capacitor = read("capacitor.config.ts");
    const strings = read("android/app/src/main/res/values/strings.xml");
    assert.match(gradle, /applicationId "com\.ashbi\.pootparty"/);
    assert.match(gradle, /versionCode 3/);
    assert.match(gradle, /versionName "1\.0\.0"/);
    assert.match(capacitor, /appName: 'PootBox'/);
    assert.match(strings, /<string name="app_name">PootBox<\/string>/);
  });

  it("requires external signing secrets and optimized release output", () => {
    const gradle = read("android/app/build.gradle");
    for (const variable of [
      "POOTBOX_KEYSTORE_PATH",
      "POOTBOX_KEYSTORE_PASSWORD",
      "POOTBOX_KEY_ALIAS",
      "POOTBOX_KEY_PASSWORD",
    ]) {
      assert.match(gradle, new RegExp(variable));
    }
    assert.match(gradle, /requestedRelease && !releaseSigningReady/);
    assert.match(gradle, /minifyEnabled true/);
    assert.match(gradle, /shrinkResources true/);
  });

  it("does not allow OS backup or cleartext transport", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    assert.match(manifest, /android:allowBackup="false"/);
    assert.match(manifest, /android:usesCleartextTraffic="false"/);
    assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
    assert.match(manifest, /android\.permission\.INTERNET/);
  });
});
