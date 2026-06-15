// Unit tests for the v68 sync-caddy.py invariants. The
// Caddyfile corruption was the v66-v67 bug class (inserted
// blocks inside the global options block, accumulated stray
// '}' on re-runs, brace imbalance). v68 fixes all of that.
// These tests pin the v68 invariants on the .py file itself
// (not on the live host).

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const PY = new URL('../scripts/sync-caddy.py', import.meta.url).pathname;

describe('v68: sync-caddy.py robustness invariants', () => {
  it('rewrites the Caddyfile from a canonical template (not just appends)', () => {
    // The v66 bug was that re-running the script accumulated
    // duplicate blocks. v68 must REWRITE the file each run.
    // We assert by looking for the v68 docstring / structure.
    const src = readFileSync(PY, 'utf8');
    assert.ok(/canonical = """/.test(src),
      'should define a canonical template literal');
    assert.ok(/PATH\.write_text\(new\)/.test(src),
      'should call write_text with the full file (not append)');
  });

  it('validates with caddy before restarting', () => {
    // The safety net: caddy validate catches config errors at
    // sync time, not at the next request.
    const src = readFileSync(PY, 'utf8');
    assert.ok(/caddy["']?,? validate.*--config/.test(src) || /\[.*caddy.*validate.*\]/s.test(src),
      'should run caddy validate before restarting');
  });

  it('refuses to write on brace imbalance', () => {
    // The v66 bug truncated the file with stray '}' until it
    // was unparseable. v68 must check brace balance BEFORE
    // write_text and bail if imbalanced.
    const src = readFileSync(PY, 'utf8');
    assert.ok(/REFUSING.*brace/i.test(src),
      'should have a REFUSING-style guard on brace imbalance');
    // The order is: count braces → if imbalanced, sys.exit(1)
    // BEFORE write_text
    const braceCheckIdx = src.indexOf('REFUSING');
    const writeIdx = src.indexOf('PATH.write_text(new)');
    assert.ok(braceCheckIdx > 0 && braceCheckIdx < writeIdx,
      'brace check must happen before write_text');
  });

  it('contains the animals.ashbi.ca direct-to-container block', () => {
    const src = readFileSync(PY, 'utf8');
    assert.ok(/animals\.ashbi\.ca \{[\s\S]*?127\.0\.0\.1:3015/.test(src),
      'canonical template must include animals → 127.0.0.1:3015');
  });

  it('does NOT include the Traefik-via-:8880 hop', () => {
    // The v63 Traefik dependency was a single point of failure
    // (during the 2026-06-15 outage). v68 explicitly rolls it
    // back.
    const src = readFileSync(PY, 'utf8');
    assert.ok(!/127\.0\.0\.1:8880/.test(src),
      'v68 must not include any reference to Traefik :8880');
  });

  it('includes alinenasseh + artisan blocks (live sites)', () => {
    const src = readFileSync(PY, 'utf8');
    assert.ok(/alinenasseh\.com, www\.alinenasseh\.com \{/.test(src));
    assert.ok(/artisan\.ashbi\.ca \{/.test(src));
    assert.ok(/127\.0\.0\.1:8081/.test(src),
      'both alinenasseh + artisan go to 127.0.0.1:8081');
  });

  it('includes lull + lull-relay on Traefik :8443', () => {
    const src = readFileSync(PY, 'utf8');
    assert.ok(/lull\.ashbi\.ca \{[\s\S]*?127\.0\.0\.1:8443/.test(src));
    assert.ok(/lull-relay\.ashbi\.ca \{[\s\S]*?127\.0\.0\.1:8443/.test(src));
  });

  it('does NOT include a *.ashbi.ca wildcard block', () => {
    // The wildcard block triggered a ZeroSSL renewal loop
    // (Caddy had http-01 only, wildcards need DNS-01). v68
    // removes the wildcard block.
    const src = readFileSync(PY, 'utf8');
    assert.ok(!/\*\.ashbi\.ca,?\s*ashbi\.ca/.test(src),
      'v68 must not include the *.ashbi.ca wildcard block');
  });
});

describe('v68: idempotency of the canonical template', () => {
  // The canonical template is embedded in the .py file as a
  // triple-quoted string. We extract it and verify the brace
  // count is balanced.
  it('canonical template has balanced braces', () => {
    const src = readFileSync(PY, 'utf8');
    // extract the canonical template
    const match = src.match(/canonical = """([\s\S]*?)"""/);
    assert.ok(match, 'should have a canonical = """...""" block');
    const canonical = match[1];
    const open = (canonical.match(/{/g) || []).length;
    const close = (canonical.match(/}/g) || []).length;
    assert.strictEqual(open, close,
      `canonical template brace imbalance: open ${open}, close ${close}`);
  });

  it('canonical template references no 127.0.0.1:8880 (Traefik)', () => {
    const src = readFileSync(PY, 'utf8');
    const match = src.match(/canonical = """([\s\S]*?)"""/);
    assert.ok(match);
    const canonical = match[1];
    assert.ok(!/127\.0\.0\.1:8880/.test(canonical),
      'canonical template must not use Traefik :8880');
  });

  it('canonical template references no wildcard *.ashbi.ca block', () => {
    const src = readFileSync(PY, 'utf8');
    const match = src.match(/canonical = """([\s\S]*?)"""/);
    assert.ok(match);
    const canonical = match[1];
    assert.ok(!/\*\.ashbi\.ca/.test(canonical),
      'canonical template must not include the wildcard block');
  });
});
