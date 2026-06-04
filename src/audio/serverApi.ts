// Client API wrapper for the local server.
// All endpoints go through /api/* — same origin (via Cloudflare tunnel) by
// default, but configurable for dev or future multi-host setups.

import type { CustomRecording } from "./fartEngine";

const DEVICE_ID_KEY = "fart-device-id";
// Generate or retrieve a stable per-device ID (persisted in localStorage)
function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  // Crypto.randomUUID where available, fallback to manual
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? (crypto as any).randomUUID()
    : "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

function getApiBase(): string {
  try {
    const v = localStorage.getItem("fart-api-base");
    if (v) return v.replace(/\/$/, "");
  } catch {}
  return ""; // same origin
}

type SharedRecording = {
  id: number;
  name: string;
  emoji: string;
  kidName: string | null;
  durationSec: number | null;
  upvotes: number;
  userVoted: boolean;
  createdAt: number;
  audioUrl: string;
};

async function jsonFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("x-device-id", getDeviceId());
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const r = await fetch(getApiBase() + path, { ...options, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || `${r.status} ${r.statusText}`);
  }
  return r.json();
}

export async function getHealth(): Promise<{ ok: boolean; recordings: number; uptime: number }> {
  return jsonFetch("/api/health");
}

export async function listRecordings(): Promise<{ recordings: SharedRecording[]; offline?: boolean }> {
  try {
    return await jsonFetch("/api/recordings");
  } catch (err) {
    console.warn("[api] listRecordings failed:", err);
    return { recordings: [], offline: true };
  }
}

export async function uploadRecording(opts: {
  blob: Blob;
  name: string;
  emoji: string;
  kidName?: string;
  durationSec?: number;
}): Promise<SharedRecording> {
  const form = new FormData();
  form.append("audio", opts.blob, "recording.webm");
  form.append("name", opts.name);
  form.append("emoji", opts.emoji);
  if (opts.kidName) form.append("kidName", opts.kidName);
  if (opts.durationSec != null) form.append("durationSec", String(opts.durationSec));
  return jsonFetch("/api/recordings", { method: "POST", body: form });
}

export async function toggleUpvote(id: number): Promise<{ upvotes: number; userVoted: boolean }> {
  return jsonFetch(`/api/recordings/${id}/upvote`, { method: "POST" });
}

export async function deleteSharedRecording(id: number): Promise<void> {
  await jsonFetch(`/api/recordings/${id}`, { method: "DELETE" });
}

// Convert a CustomRecording (Blob URL) into a SharedRecording upload
export async function uploadCustomRecording(rec: CustomRecording, kidName?: string): Promise<SharedRecording> {
  const resp = await fetch(rec.url);
  const blob = await resp.blob();
  return uploadRecording({
    blob,
    name: rec.name,
    emoji: rec.emoji,
    kidName,
    durationSec: undefined,
  });
}

// === Social API (users, follows, comments, feed) ===

type SocialUser = {
  handle: string;
  displayName: string;
  avatar: string;
  bio: string | null;
  createdAt: number;
  followerCount: number;
  followingCount: number;
  recordingCount: number;
  isFollowing: boolean;
  isMe: boolean;
};

type SocialComment = {
  id: number;
  body: string;
  createdAt: number;
  author: { handle: string; displayName: string; avatar: string };
};

type FeedRecording = SharedRecording & { author?: SocialUser };
type FeedGroup = { author: SocialUser; recordings: FeedRecording[] };

export async function getMe(): Promise<SocialUser> {
  return jsonFetch("/api/me");
}

export async function updateMe(patch: Partial<Pick<SocialUser, "displayName" | "avatar" | "bio" | "handle">>): Promise<SocialUser> {
  return jsonFetch("/api/me", { method: "PATCH", body: JSON.stringify(patch) });
}

export async function getUser(handle: string): Promise<SocialUser> {
  return jsonFetch(`/api/users/${encodeURIComponent(handle)}`);
}

export async function getUsers(): Promise<{ users: SocialUser[] }> {
  return jsonFetch("/api/users");
}

export async function toggleFollow(handle: string): Promise<{ following: boolean }> {
  return jsonFetch(`/api/users/${encodeURIComponent(handle)}/follow`, { method: "POST" });
}

export async function getFollowers(handle: string): Promise<{ users: SocialUser[] }> {
  return jsonFetch(`/api/users/${encodeURIComponent(handle)}/followers`);
}

export async function getFollowing(handle: string): Promise<{ users: SocialUser[] }> {
  return jsonFetch(`/api/users/${encodeURIComponent(handle)}/following`);
}

export async function getUserRecordings(handle: string): Promise<{ recordings: FeedRecording[] }> {
  return jsonFetch(`/api/users/${encodeURIComponent(handle)}/recordings`);
}

export async function getFeed(): Promise<{ groups: FeedGroup[]; offline?: boolean }> {
  try {
    return await jsonFetch("/api/feed");
  } catch (err) {
    console.warn("[api] getFeed failed:", err);
    return { groups: [], offline: true };
  }
}

export async function getComments(recordingId: number): Promise<{ comments: SocialComment[] }> {
  return jsonFetch(`/api/recordings/${recordingId}/comments`);
}

export async function addComment(recordingId: number, body: string): Promise<{ id: number; body: string; createdAt: number }> {
  return jsonFetch(`/api/recordings/${recordingId}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

export async function deleteComment(id: number): Promise<void> {
  await jsonFetch(`/api/comments/${id}`, { method: "DELETE" });
}

// === Reactions (emoji-only) ===
type Reactions = { counts: Record<string, number>; mine: string[] };

export async function getReactions(recordingId: number): Promise<Reactions> {
  try {
    return await jsonFetch<Reactions>(`/api/recordings/${recordingId}/reactions`);
  } catch (err) {
    console.warn("[api] getReactions failed:", err);
    return { counts: {}, mine: [] };
  }
}

export async function toggleReaction(recordingId: number, emoji: string): Promise<Reactions> {
  return jsonFetch<Reactions>(`/api/recordings/${recordingId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

// === Share codes (4 characters, no accounts) ===
// The actual "share" primitive for v23. Kid records a sound, gets a 4-char
// code, reads it to a friend. Friend types the code into the app, the
// sound gets added to their library. No accounts, no follow graph.

export type ShareCode = {
  code: string;
  audioUrl: string;
  name: string;
  emoji: string;
  createdAt?: number;
};

export async function mintShareCode(input: { audioUrl: string; name: string; emoji: string }): Promise<ShareCode> {
  return jsonFetch<ShareCode>("/api/share", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function lookupShareCode(code: string): Promise<ShareCode> {
  const clean = code.toUpperCase().trim().slice(0, 4);
  return jsonFetch<ShareCode>(`/api/share/${encodeURIComponent(clean)}`);
}
