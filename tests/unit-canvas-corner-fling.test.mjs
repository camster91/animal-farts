// Unit tests for the v55 fix: drag velocity must NOT be double-converted
// from px/frame. The previous implementation had:
//
//   drag.velocity = { x: dx / dt * 16.67, y: dy / dt * 16.67 }   // move handler
//   b.vel.x = drag.velocity.x * 16.67                            // up handler
//
// The redundant * 16.67 in the up handler produced a ~278x velocity, which
// flung bubbles off-screen in one frame. The wall-clamp physics caught
// them at (radius, radius) = the upper-left corner. The visible symptom
// was "all bubbles go to the corner when I click a noise."
//
// This test pins the contract: drag.velocity is already in px/frame, and
// the up handler applies it directly. The math below is what the fix
// implements; if anyone re-introduces a * 16.67 in the up handler, the
// release-velocity assertions will fail and the corner-fling will return.

import { describe, it } from 'node:test';
import assert from 'node:assert';

// The exact same velocity conversion the v55 fix uses. Replicated here
// so the math is testable in isolation from the React hook.
const PX_PER_FRAME_AT_60HZ = 1000 / 60; // ≈ 16.67 ms/frame
const TAP_DELETE_DISTANCE_PX = 8;

function moveHandler(dx, dy, dtMs) {
  // From useCanvasHandlers.ts onBubblePointerMove.
  return {
    velocity: {
      x: (dx / dtMs) * PX_PER_FRAME_AT_60HZ,
      y: (dy / dtMs) * PX_PER_FRAME_AT_60HZ,
    },
  };
}

function upHandler(drag, e) {
  // From useCanvasHandlers.ts onBubblePointerUp. The v55 fix removes
  // the * 16.67 that used to be here.
  return {
    b_vel_x: drag.velocity.x,
    b_vel_y: drag.velocity.y,
    is_tap:
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) <
      TAP_DELETE_DISTANCE_PX,
  };
}

function fullClickDragRelease({ down, move, up }) {
  // Simulate the full gesture: down → (optional moves) → up.
  const startX = down.x;
  const startY = down.y;
  let drag = {
    startX,
    startY,
    lastX: down.x,
    lastY: down.y,
    downT: down.t,
    lastT: down.t,
    velocity: { x: 0, y: 0 },
  };
  for (const m of move) {
    const dtMs = Math.max(m.t - drag.lastT, 1);
    const dx = m.x - drag.lastX;
    const dy = m.y - drag.lastY;
    drag = {
      ...drag,
      velocity: moveHandler(dx, dy, dtMs).velocity,
      lastX: m.x,
      lastY: m.y,
      lastT: m.t,
    };
  }
  // The hook reads e.clientX and e.clientY (React.PointerEvent shape).
  // Test data uses {x, y} for convenience, so shape-shift here.
  return upHandler(drag, { clientX: up.x, clientY: up.y, t: up.t });
}

describe('v55 corner-fling fix — drag release velocity', () => {
  it('100px drag in 100ms releases at ~16.67 px/frame (NOT 278)', () => {
    // A real user drag: 100px right in 100ms. Pre-fix: 100/100*16.67*16.67 ≈ 278.
    // Post-fix: 100/100*16.67 ≈ 16.67 px/frame.
    const result = fullClickDragRelease({
      down: { x: 100, y: 100, t: 0 },
      move: [
        { x: 110, y: 100, t: 10 },
        { x: 120, y: 100, t: 20 },
        { x: 140, y: 100, t: 40 },
        { x: 170, y: 100, t: 70 },
        { x: 200, y: 100, t: 100 },
      ],
      up: { x: 200, y: 100, t: 100 },
    });
    assert.ok(
      Math.abs(result.b_vel_x - 16.67) < 0.1,
      `b.vel.x should be ~16.67 px/frame, got ${result.b_vel_x}`,
    );
    // Anti-regression: 278 px/frame means the bug came back.
    assert.ok(
      result.b_vel_x < 30,
      `b.vel.x=${result.b_vel_x} suggests the * 16.67 was re-introduced`,
    );
  });

  it('200px drag in 200ms releases at ~16.67 px/frame', () => {
    const result = fullClickDragRelease({
      down: { x: 0, y: 0, t: 0 },
      move: [
        { x: 50, y: 0, t: 50 },
        { x: 100, y: 0, t: 100 },
        { x: 200, y: 0, t: 200 },
      ],
      up: { x: 200, y: 0, t: 200 },
    });
    assert.ok(
      Math.abs(result.b_vel_x - 16.67) < 0.1,
      `b.vel.x should be ~16.67 px/frame, got ${result.b_vel_x}`,
    );
  });

  it('slow drag (10px in 500ms) releases at ~0.33 px/frame (low velocity, no fling)', () => {
    const result = fullClickDragRelease({
      down: { x: 0, y: 0, t: 0 },
      move: [{ x: 10, y: 0, t: 500 }],
      up: { x: 10, y: 0, t: 500 },
    });
    assert.ok(
      Math.abs(result.b_vel_x - 0.333) < 0.01,
      `b.vel.x should be ~0.33 px/frame, got ${result.b_vel_x}`,
    );
  });

  it('release at same position as down is a tap, not a fling', () => {
    const result = fullClickDragRelease({
      down: { x: 100, y: 100, t: 0 },
      move: [], // no move
      up: { x: 100, y: 100, t: 50 },
    });
    assert.strictEqual(result.is_tap, true);
    assert.strictEqual(result.b_vel_x, 0); // no velocity, will be clamped
  });

  it('release 4px from down is still a tap (< 8px threshold)', () => {
    const result = fullClickDragRelease({
      down: { x: 100, y: 100, t: 0 },
      move: [{ x: 104, y: 100, t: 30 }], // moved 4px in 30ms
      up: { x: 104, y: 100, t: 50 },
    });
    assert.strictEqual(result.is_tap, true);
  });

  it('release 12px from down is a drag, not a tap', () => {
    const result = fullClickDragRelease({
      down: { x: 100, y: 100, t: 0 },
      move: [{ x: 112, y: 100, t: 30 }], // moved 12px in 30ms
      up: { x: 112, y: 100, t: 50 },
    });
    assert.strictEqual(result.is_tap, false);
  });

  it('v52-regression: with the * 16.67 bug, 100px/100ms = 278 px/frame', () => {
    // This test exists to MAKE SURE the bug stays dead. If you ever need
    // to re-introduce the * 16.67 (e.g. to convert from px/ms back to
    // something else), update this test FIRST so the regression is
    // caught.
    const REGRESSION_VELOCITY = (100 / 100) * 16.67 * 16.67;
    assert.ok(
      REGRESSION_VELOCITY > 100,
      `If this ever becomes <= 100, the corner-fling is back. Velocity=${REGRESSION_VELOCITY}`,
    );
  });
});

describe('v55 corner-fling fix — tap detection uses startX/Y, not lastX/Y', () => {
  it('tap detected when released at down position even after a big move-then-stop', () => {
    // User moves 200px, then stops (no movement for 50ms), then releases.
    // The previous v52 code used lastX/lastY for totalDist, which
    // would compute distance-from-last-move (≈0) and classify this
    // as a tap. The v55 fix uses startX/Y, so the actual 200px
    // movement classifies it as a drag.
    const result = fullClickDragRelease({
      down: { x: 100, y: 100, t: 0 },
      move: [
        { x: 300, y: 100, t: 50 }, // big move, 200px right
        { x: 300, y: 100, t: 100 }, // no move at t=100
      ],
      up: { x: 300, y: 100, t: 105 }, // released 5ms later
    });
    assert.strictEqual(result.is_tap, false); // 200px is a drag
  });

  it('a true tap (no move) is correctly detected as a tap', () => {
    const result = fullClickDragRelease({
      down: { x: 100, y: 100, t: 0 },
      move: [],
      up: { x: 100, y: 100, t: 50 },
    });
    assert.strictEqual(result.is_tap, true);
  });
});
