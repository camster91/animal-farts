import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const deploy = readFileSync(join(ROOT, "scripts", "deploy-vps.sh"), "utf8");
const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf8");

describe("immutable deployment contract", () => {
  it("rejects every dirty checkout and requires a commit on origin/main", () => {
    assert.match(deploy, /git status --porcelain --untracked-files=normal/);
    assert.match(deploy, /git merge-base --is-ancestor "\$FULL_SHA" origin\/main/);
  });

  it("pulls and verifies a commit-addressed artifact without rebuilding", () => {
    assert.match(deploy, /main-\$\{SHORT_SHA\}/);
    assert.match(deploy, /docker pull "\$IMAGE"/);
    assert.match(deploy, /org\.opencontainers\.image\.revision/);
    assert.match(deploy, /NEW_REVISION.*FULL_SHA/s);
    assert.match(deploy, /NEW_DIGEST.*@sha256:/s);
    assert.doesNotMatch(deploy, /docker build/);
    assert.doesNotMatch(deploy, /tar -x/);
  });

  it("requires backup, restore rehearsal, rollback, smoke, and a release record", () => {
    assert.match(deploy, /animal-farts-backup/);
    assert.match(deploy, /animal-farts-restore-rehearsal/);
    assert.match(deploy, /rollback\(\)/);
    assert.match(deploy, /PREVIOUS_IMAGE_ID/);
    assert.match(deploy, /BACKUP_ARCHIVE/);
    assert.match(deploy, /\/api\/health/);
    assert.match(deploy, /manifest\.webmanifest/);
    assert.match(deploy, /sw\.js/);
    assert.match(deploy, /grep -q 'const CACHE = '/);
    assert.match(deploy, /--retry-all-errors/);
    assert.doesNotMatch(deploy, /grep -q 'CACHE_NAME'/);
    assert.match(deploy, /wait_for_container_health/);
    assert.match(deploy, /container did not become healthy within 45 seconds/);
    assert.match(deploy, /animal-farts-ops-check/);
  });

  it("uses lockfile-driven installs in both Docker stages", () => {
    const installs = dockerfile.match(/npm ci/g) ?? [];
    assert.strictEqual(installs.length, 2);
    assert.doesNotMatch(dockerfile, /npm install/);
  });
});
