import type { Page } from "./types.js";

export interface SharedSound {
  code: string;
  audioUrl: string;
  name?: string;
  emoji?: string;
}

export interface OfflineShareLookup {
  __offline: true;
  code: string;
}

export type ShareLookupResult = SharedSound | OfflineShareLookup | null;

type FetchLike = typeof fetch;

export class ShareMintError extends Error {
  readonly kind: "no-recording" | "request" | "network";

  constructor(
    kind: "no-recording" | "request" | "network",
    message: string,
  ) {
    super(message);
    this.name = "ShareMintError";
    this.kind = kind;
  }
}

function aborted(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true ||
    (error instanceof DOMException && error.name === "AbortError");
}

export async function mintShareCode(options: {
  page: Page | undefined;
  deviceId: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<string> {
  const { page, deviceId, signal } = options;
  const shareable = page?.bubbles.find((bubble) =>
    typeof bubble.sound === "string" && bubble.sound.startsWith("/uploads/"),
  );
  if (!shareable) {
    throw new ShareMintError("no-recording", "Record a sound first to share it");
  }

  try {
    const response = await (options.fetchImpl ?? fetch)("/api/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-id": deviceId,
      },
      body: JSON.stringify({
        audioUrl: shareable.sound,
        name: page?.name ?? "Shared sound",
        emoji: shareable.emoji,
      }),
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new ShareMintError("request", body.error || "Share failed");
    }
    const body = await response.json() as { code?: unknown };
    if (typeof body.code !== "string" || body.code.length !== 8) {
      throw new ShareMintError("request", "Share server returned an invalid code");
    }
    return body.code;
  } catch (error) {
    if (error instanceof ShareMintError || aborted(error, signal)) throw error;
    throw new ShareMintError("network", "Share failed — are you online?");
  }
}

export async function lookupShareCode(options: {
  code: string;
  online: boolean;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<ShareLookupResult> {
  const code = options.code.toUpperCase();
  if (!options.online) return { __offline: true, code };
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `/api/share/${encodeURIComponent(code)}`,
      { signal: options.signal },
    );
    if (!response.ok) return null;
    return await response.json() as SharedSound;
  } catch (error) {
    if (aborted(error, options.signal)) throw error;
    return null;
  }
}

export function createSharedPage(data: SharedSound, now = Date.now()): Page {
  return {
    id: `page:share-${data.code}-${now}`,
    name: data.name || `Shared ${data.code}`,
    emoji: data.emoji || "🔗",
    bubbles: [{
      id: `b:shared:${data.code}:${now}`,
      type: "custom",
      emoji: data.emoji || "🔗",
      blobUrl: data.audioUrl,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 36,
      mass: 1,
      sound: data.audioUrl,
      lastTouchedAt: -1,
      lastReleasedAt: -1,
    }],
    createdAt: now,
  };
}
