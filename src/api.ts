// Backend API wrapper for Emoji Farts.
// Server: /server/server.js (Express + better-sqlite3 + multer).
//
// The "user" is identified by an x-device-id header. On first visit, we
// generate a device-id in localStorage and let the server auto-create
// the user. The user picks a handle later in the profile page.

const BASE = ""; // same origin (vite proxy in dev, nginx in prod)

let _deviceId: string | null = null;
export function getDeviceId(): string {
  if (_deviceId) return _deviceId;
  let id = localStorage.getItem("emoji-farts-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("emoji-farts-device-id", id);
  }
  _deviceId = id;
  return id;
}

async function req<T>(method: string, path: string, body?: any, audio?: Blob): Promise<T> {
  const headers: Record<string, string> = { "x-device-id": getDeviceId() };
  if (body && !audio) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers };
  if (body) {
    if (audio) {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append("audio", audio, "rec.webm");
      init.body = fd;
    } else {
      init.body = JSON.stringify(body);
    }
  }
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// === Types ===
export type User = {
  id: number;
  deviceId: string;
  handle: string | null;
  displayName: string | null;
  avatar: string;
  isAdult: boolean;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  recordingCount: number;
};

export type Recording = {
  id: number;
  name: string;
  emoji: string;
  kidName: string | null;
  durationSec: number | null;
  upvotes: number;
  userVoted: boolean;
  createdAt: number;
  deviceId: string;
  audioUrl: string;
  posterHandle: string | null;
  posterAvatar: string;
  posterName: string | null;
};

export type FeedEntry = Recording & {
  posterHandle: string | null;
  posterName: string | null;
  posterAvatar: string;
};

// === API methods ===

export const api = {
  // Profile
  getMe: () => req<User>("GET", "/api/me"),
  updateMe: (patch: { handle?: string; displayName?: string; avatar?: string; bio?: string; isAdult?: boolean }) =>
    req<User>("PATCH", "/api/me", patch),
  getUser: (handle: string) => req<User>("GET", `/api/users/${encodeURIComponent(handle)}`),

  // Recordings
  listMyRecordings: () => req<Recording[]>("GET", "/api/recordings?mine=1"),
  listUserRecordings: (handle: string) =>
    req<Recording[]>("GET", `/api/users/${encodeURIComponent(handle)}/recordings`),
  uploadRecording: (meta: { name: string; emoji: string; kidName?: string; durationSec: number; visibility?: "public" | "private" }, audio: Blob) =>
    req<Recording>("POST", "/api/recordings", { ...meta, visibility: meta.visibility || "public" }, audio),
  deleteRecording: (id: number) => req<{ ok: true }>("DELETE", `/api/recordings/${id}`),
  upvoteRecording: (id: number) => req<{ upvoted: boolean; upvotes: number }>("POST", `/api/recordings/${id}/upvote`),

  // Follow
  follow: (handle: string) => req<{ following: boolean }>("POST", `/api/users/${encodeURIComponent(handle)}/follow`),
  unfollow: (handle: string) => req<{ following: boolean }>("DELETE", `/api/users/${encodeURIComponent(handle)}/follow`),

  // Feed
  getFeed: (limit = 50) => req<FeedEntry[]>("GET", `/api/feed?limit=${limit}`),

  // List all users (for Explore's "discover people" panel)
  listUsers: () => req<User[]>("GET", "/api/users"),
};

// Audio URL helper — uploads are served from /uploads/<filename>.
export function audioUrl(filename: string): string {
  return `/uploads/${filename}`;
}
