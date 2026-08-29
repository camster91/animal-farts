import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

describe("authoritative documentation", () => {
  it("keeps the current product, API, privacy, operations, and history authority", () => {
    for (const path of [
      "docs/product-control.md",
      "docs/api.md",
      "docs/v1-child-safety-boundary.md",
      "docs/production-operations.md",
      "docs/history.md",
      "infra/traefik/README.md",
    ]) {
      assert.ok(existsSync(join(ROOT, path)), `missing ${path}`);
    }
  });

  it("labels every indexed plan/review as a historical snapshot", () => {
    const snapshots = [
      "PLAN.md",
      "REVIEW-2026-06-16.md",
      "FEATURE-REVIEW-2026-06-18.md",
      "docs/ship-to-public-plan.md",
      "docs/v3-plan.md",
      "docs/v26-plan.md",
      "docs/v27-plan.md",
      "docs/v27-test-plans.md",
      "docs/v28-plan.md",
      "docs/v31-plan.md",
      "docs/v46-plan.md",
      "docs/v47-plan.md",
      "docs/v48-plan.md",
      "docs/v49-plan.md",
      "docs/v50-plan.md",
      "docs/v52-refactor-plan.md",
    ];
    for (const path of snapshots) {
      assert.match(read(path).slice(0, 200), /Historical snapshot/, path);
    }
  });

  it("documents real upload paths and immutable deployment", () => {
    const api = read("docs/api.md");
    const readme = read("README.md");
    assert.match(api, /\/uploads\//);
    assert.doesNotMatch(api, /\/api\/recordings\/:id\/audio/);
    assert.match(readme, /never rebuilds source/);
    assert.doesNotMatch(readme, /builds the Docker image on the VPS/);
  });

  it("separates product evidence, hypotheses, metrics, access, and blockers", () => {
    const product = read("docs/product-control.md");
    for (const heading of [
      "## Current truth",
      "## Current market evidence",
      "## Pricing and economics hypothesis",
      "## Metrics and validation",
      "## Access and approval register",
      "## Authoritative roadmap",
      "## Decisions and risks",
      "## Work log",
    ]) {
      assert.ok(product.includes(heading), `missing ${heading}`);
    }
    assert.match(product, /not current results/i);
    assert.match(product, /No .market-leading,. launch-ready, or customer-validated claim/i);
  });
});
