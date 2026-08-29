import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const ci = await readFile(".github/workflows/ci.yml", "utf8");
const image = await readFile(".github/workflows/build-and-push.yml", "utf8");
const dependabot = await readFile(".github/dependabot.yml", "utf8");

describe("release workflow supply-chain contract", () => {
  it("pins every third-party action to an immutable commit", () => {
    const uses = [...`${ci}\n${image}`.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
    assert.ok(uses.length >= 8, "expected all release actions to be discovered");
    for (const action of uses) {
      assert.match(action, /^[^@]+@[0-9a-f]{40}$/, `${action} is not commit-pinned`);
    }
  });

  it("keeps action pins under automated update governance", () => {
    assert.match(dependabot, /package-ecosystem:\s*"github-actions"/);
    assert.match(dependabot, /interval:\s*"weekly"/);
  });

  it("runs the maintained test sets without obsolete hard-coded files", () => {
    assert.match(ci, /tests\/unit-\*\.test\.mjs/);
    assert.match(ci, /tests\/server-social-disabled\.test\.mjs/);
    assert.doesNotMatch(ci, /unit-upload-recording/);
    assert.doesNotMatch(ci, /continue-on-error/);
  });
});
