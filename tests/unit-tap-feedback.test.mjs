// Unit tests for shouldPlayTapFeedback (G5 tap-squish animation gate).
// Run: npm test
//
// shouldPlayTapFeedback returns true only for a genuine tap:
//   - pointer-down to pointer-up < 250ms (fast, not a hold)
//   - pointer moved < 10px (not a drag/throw)

import { describe, it } from 'node:test';
import assert from 'node:assert';

// G5: Returns true for a genuine tap (< 250ms, moved < 10px), false for drag/hold.
function shouldPlayTapFeedback(pointerDownMs, pointerUpMs, movedPx) {
  const durationMs = pointerUpMs - pointerDownMs;
  return durationMs <= 250 && movedPx < 10;
}

describe('shouldPlayTapFeedback', () => {
  it('50ms + 0px = true (fast tap, no movement)', () => {
    assert.strictEqual(shouldPlayTapFeedback(0, 50, 0), true);
  });

  it('100ms + 5px = true (fast tap, tiny movement within threshold)', () => {
    assert.strictEqual(shouldPlayTapFeedback(0, 100, 5), true);
  });

  it('500ms + 0px = false (slow hold, not a tap)', () => {
    assert.strictEqual(shouldPlayTapFeedback(0, 500, 0), false);
  });

  it('50ms + 50px = false (fast but dragged beyond threshold)', () => {
    assert.strictEqual(shouldPlayTapFeedback(0, 50, 50), false);
  });

  it('250ms + 5px = true (exactly at duration boundary, within move threshold)', () => {
    assert.strictEqual(shouldPlayTapFeedback(0, 250, 5), true);
  });

  it('251ms + 5px = false (just over duration boundary)', () => {
    assert.strictEqual(shouldPlayTapFeedback(0, 251, 5), false);
  });
});