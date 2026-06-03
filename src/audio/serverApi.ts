// Client API wrapper for the local server.
// All endpoints go through /api/* — same origin (via Cloudflare tunnel) by
// default, but configurable for dev or future multi-host setups.

import type { CustomRecording } from "./fartEngine";

const DEVICE_ID_KEY = "fart-device-id";
const API_BASE_KEY = "fart-api-base";

// Generate or retrieve a stable per-device ID (persisted in localStorage)
export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  // Crypto.randomUUID where available, fallback to manual
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? (crypto as any).randomUUID()
    : "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getApiBase(): string {
  try {
    const v = localStorage.getItem(API_BASE_KEY);
    if (v) return v.replace(/\/$/, "");
  } catch {}
  return ""; // same origin
}

export function setApiBase(url: string) {
  try { localStorage.setItem(API_BASE_KEY, url.replace(/\/$/, "")); } catch {}
}

export type SharedRecording = {
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
