/**
 * physics.ts — extracted physics step for PootBox v46.
 *
 * Pure function: no React, no refs mutated outside the explicit refObj params.
 * Works on anything with { pos, vel, radius, mass }.
 */
import type { Vec2 } from "./types";

export interface PhysicsBody {
  id?: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  mass: number;
  // optional: user-interaction state
  lastTouchedAt?: number;
  lastReleasedAt?: number;
}

export interface PhysicsOptions {
  friction: number;
  wallBounce: number;
  collisionBounce: number;
  driftIntervalMs: number;
  driftForceMax: number;
  viewportWidth: number;
  viewportHeight: number;
  collisionAudioWindowMs: number;
}

export interface CollisionEvent {
  a: PhysicsBody;
  b: PhysicsBody;
  shouldPlaySound: boolean;
  reason?: "no-recent-touch" | "cooldown" | "released";
}

/**
 * One step of the physics tick. dt is in ms.
 * Returns the collisions that occurred this step.
 *
 * @param bodies         All physics bodies in the scene (mutated in-place)
 * @param options        Physics constants
 * @param now            performance.now() at frame start
 * @param deltaMs        Time since last frame (ms), capped at 50
 * @param lastDriftNudgeAtRef  Ref to last drift timestamp; updated in-place when drift fires
 * @param collisionCooldownRef  Ref to Map of pair-key → last-collision timestamp
 */
export function stepPhysics(
  bodies: PhysicsBody[],
  options: PhysicsOptions,
  now: number,
  deltaMs: number,
  lastDriftNudgeAtRef: { current: number },
  collisionCooldownRef: { current: Map<string, number> }
): CollisionEvent[] {
  const {
    friction,
    wallBounce,
    collisionBounce,
    driftIntervalMs,
    driftForceMax,
    viewportWidth: W,
    viewportHeight: H,
    collisionAudioWindowMs,
  } = options;

  const stepScale = deltaMs / 16.67;

  // 1. Integrate position + apply friction (skip dragged)
  for (const c of bodies) {
    if ((c as unknown as { id?: string }).id === undefined) {
      // no drag tracking on plain PhysicsBody — skip check
    }
    c.pos.x += c.vel.x * stepScale;
    c.pos.y += c.vel.y * stepScale;
    const damp = Math.pow(friction, stepScale);
    c.vel.x *= damp;
    c.vel.y *= damp;
    if (Math.abs(c.vel.x) < 0.05) c.vel.x = 0;
    if (Math.abs(c.vel.y) < 0.05) c.vel.y = 0;
  }

  // 2. Periodic drift nudge
  if (now - lastDriftNudgeAtRef.current > driftIntervalMs) {
    lastDriftNudgeAtRef.current = now;
    for (const c of bodies) {
      const ang = Math.random() * Math.PI * 2;
      const mag = driftForceMax * (0.5 + Math.random() * 0.5);
      c.vel.x += Math.cos(ang) * mag;
      c.vel.y += Math.sin(ang) * mag;
    }
  }

  // 3. Wall collisions
  for (const c of bodies) {
    if (c.pos.x - c.radius < 0) {
      c.pos.x = c.radius;
      c.vel.x = -c.vel.x * wallBounce;
    } else if (c.pos.x + c.radius > W) {
      c.pos.x = W - c.radius;
      c.vel.x = -c.vel.x * wallBounce;
    }
    if (c.pos.y - c.radius < 0) {
      c.pos.y = c.radius;
      c.vel.y = -c.vel.y * wallBounce;
    } else if (c.pos.y + c.radius > H) {
      c.pos.y = H - c.radius;
      c.vel.y = -c.vel.y * wallBounce;
    }
  }

  // 4. Circle-circle collisions + audio gate
  const collisions: CollisionEvent[] = [];

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + b.radius;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;

        // Positional correction (push apart)
        a.pos.x -= nx * overlap;
        a.pos.y -= ny * overlap;
        b.pos.x += nx * overlap;
        b.pos.y += ny * overlap;

        // Impulse exchange (only if approaching)
        const rvx = b.vel.x - a.vel.x;
        const rvy = b.vel.y - a.vel.y;
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal < 0) continue;

        const impulse = (velAlongNormal * (1 + collisionBounce)) / (1 / a.mass + 1 / b.mass);
        a.vel.x += (impulse / a.mass) * nx;
        a.vel.y += (impulse / a.mass) * ny;
        b.vel.x -= (impulse / b.mass) * nx;
        b.vel.y -= (impulse / b.mass) * ny;

        // Audio gate: user touched in last collisionAudioWindowMs AND not released in last 200ms
        const aTouched = now - (a.lastTouchedAt ?? -1) < collisionAudioWindowMs;
        const aReleased = now - (a.lastReleasedAt ?? -1) < 200;
        const aUser = aTouched && !aReleased;

        const bTouched = now - (b.lastTouchedAt ?? -1) < collisionAudioWindowMs;
        const bReleased = now - (b.lastReleasedAt ?? -1) < 200;
        const bUser = bTouched && !bReleased;

        const userDriven = aUser || bUser;

        // Per-pair cooldown
        const key = [a.id, b.id].sort().join("|");
        const lastCollision = collisionCooldownRef.current.get(key) ?? 0;
        const inCooldown = now - lastCollision < 250;

        let shouldPlaySound = false;
        let reason: CollisionEvent["reason"] | undefined;

        if (!userDriven) {
          reason = "no-recent-touch";
        } else if (inCooldown) {
          reason = "cooldown";
        } else if (aReleased && bReleased) {
          reason = "released";
        } else {
          shouldPlaySound = true;
          collisionCooldownRef.current.set(key, now);
        }

        collisions.push({ a, b, shouldPlaySound, reason });
      }
    }
  }

  return collisions;
}