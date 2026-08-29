import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const check = await readFile("infra/ops/animal-farts-ops-check", "utf8");
const runbook = await readFile("docs/production-operations.md", "utf8");

describe("production operations contract", () => {
  it("fails on restart-loop evidence instead of only reading the counter", () => {
    assert.match(check, /ANIMAL_FARTS_MAX_RESTARTS:-2/);
    assert.match(check, /restart_count > MAX_RESTARTS/);
    assert.match(check, /container restarted/);
  });

  it("documents health, capacity, certificate, backup, and paging ownership", () => {
    assert.match(check, /api\/health/);
    assert.match(check, /disk_used < 80/);
    assert.match(check, /inode_used < 80/);
    assert.match(check, /days_left >= 30/);
    assert.match(check, /no successful backup/);
    assert.match(runbook, /Uptime Kuma push monitor owned by Cameron/);
    assert.match(runbook, /ANIMAL_FARTS_MAX_RESTARTS/);
  });
});
