// deviceId.ts — get-or-create a stable per-device identifier for social
// endpoints that require x-device-id. The lull relay (camster91/lull)
// has the same pattern (see src/relay.ts: getOrCreateDeviceId).
//
// Critical: the *getter* `getDeviceId()` must not write to localStorage.
// The first write happens inside `getOrCreateDeviceId()` when an API
// helper actually sends the id over the wire. This avoids a class of
// bug where a fresh install's getDeviceId() call (during read-only state
// restoration) would create the key on first mount and then Reset would
// not actually wipe the device identity.
//
// Storage: `pootbox:device-id` (namespaced with the app prefix so we
// don't collide with lull's `lull:device-id` or other Ashbi subdomains).

const STORAGE_KEY = "pootbox:device-id";

// In-memory cache so we don't re-read localStorage on every call.
// Cached for the lifetime of the JS context (one page load). A new
// tab starts fresh from localStorage.
let cached: string | null = null;

function uuid(): string {
  // RFC 4122 v4. We don't need cryptographic strength — the device
  // id is a server-side anti-abuse signal, not a security boundary.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readFromStorage(): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

function writeToStorage(id: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // ignore — QuotaExceededError etc. The in-memory cache still
    // works for the current session.
  }
}

/** Read-only: returns the cached device id, or null if none yet.
 *  Does NOT write to storage. Safe to call during read-only paths. */
export function getDeviceId(): string | null {
  if (cached !== null) return cached;
  cached = readFromStorage();
  return cached;
}

/** Lazy: returns the cached device id, creating + persisting one if
 *  needed. Call this from API helpers that actually send the id over
 *  the wire — never from getDeviceId() / read paths. */
export function getOrCreateDeviceId(): string {
  if (cached !== null) return cached;
  const existing = readFromStorage();
  if (existing) {
    cached = existing;
    return existing;
  }
  const fresh = uuid();
  writeToStorage(fresh);
  cached = fresh;
  return fresh;
}
