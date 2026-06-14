// uploadRecording.ts — fire-and-forget upload of a recorded audio Blob
// to the server's POST /api/recordings endpoint. On success returns
// the server-issued {id, audioUrl, ...} so the caller can swap the
// bubble's blob: URL for the canonical /uploads/... path. On failure
// (offline, server 5xx, rate-limit) the caller should keep the local
// IDB blob as the source of truth — the recording still plays, just
// not from the server.
//
// Why fire-and-forget: the kid's mic capture + IDB save is the
// critical path. The server push is a nice-to-have for the v56-5
// blobUrl-persistence gap. Failing the upload MUST NOT fail the
// recording.
//
// Why we use FormData: the server's multer middleware expects
// multipart/form-data with the file under the "audio" field and
// name/emoji/kidName/durationSec as siblings. JSON won't work.
//
// Why we don't read the upload response on the render path: the
// recording flow already called onBubbleAdded() with the local bubble.
// The server push is async and may complete seconds later (or never,
// if offline). When it does, we mutate the bubble in-place to swap
// blobUrl + sound from the blob: URL to the /uploads/... path. The
// bubble's ID stays the same so the on-disk IDB reference is still
// valid (and the next time the page is rebuilt, the blobUrl in IDB
// points to the server-issued /uploads/... URL — survives reloads).

import { getOrCreateDeviceId } from "./deviceId";

export interface UploadedRecording {
  id: number;
  name: string;
  emoji: string;
  audioUrl: string; // always a /uploads/... path on success
  durationSec: number | null;
}

export interface UploadError {
  ok: false;
  status: number;
  error: string;
  offline: boolean;
}

export type UploadResult =
  | { ok: true; recording: UploadedRecording }
  | UploadError;

interface UploadOpts {
  blob: Blob;
  name: string;
  emoji: string;
  kidName?: string;
  durationSec?: number;
  /** Called when the upload succeeds. The caller uses the audioUrl
   *  to swap the bubble's blobUrl + sound. */
  onSuccess: (rec: UploadedRecording) => void;
  /** Called when the upload fails. The caller logs / shows a
   *  toast / ignores. The local recording is unaffected. */
  onError?: (err: UploadError) => void;
  /** Optional AbortSignal to cancel the upload (e.g. on app
   *  unmount). */
  signal?: AbortSignal;
}

/** POST a recorded blob to the server. Fire-and-forget — does not
 *  throw. The onSuccess / onError callbacks deliver the result.
 *  The function returns immediately; the fetch is in flight. */
export function uploadRecording(opts: UploadOpts): void {
  const { blob, name, emoji, kidName, durationSec, onSuccess, onError, signal } = opts;
  const deviceId = getOrCreateDeviceId();

  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  form.append("name", name);
  form.append("emoji", emoji);
  if (kidName) form.append("kidName", kidName);
  if (durationSec !== undefined) form.append("durationSec", String(durationSec));

  fetch("/api/recordings", {
    method: "POST",
    headers: {
      // Don't set Content-Type — let the browser set multipart/form-data
      // with the correct boundary. Setting it manually breaks the body.
      "x-device-id": deviceId,
    },
    body: form,
    signal,
  })
    .then(async (r) => {
      const text = await r.text();
      if (!r.ok) {
        let error = "Upload failed";
        try {
          const j = JSON.parse(text);
          if (j && typeof j.error === "string") error = j.error;
        } catch {
          // non-JSON error body
        }
        onError?.({
          ok: false,
          status: r.status,
          error,
          offline: r.status === 0 || r.status === 502 || r.status === 503 || r.status === 504,
        });
        return;
      }
      try {
        const j = JSON.parse(text);
        if (j && typeof j.audioUrl === "string" && typeof j.id === "number") {
          onSuccess({
            id: j.id,
            name: j.name || name,
            emoji: j.emoji || emoji,
            audioUrl: j.audioUrl,
            durationSec: typeof j.durationSec === "number" ? j.durationSec : durationSec ?? null,
          });
        } else {
          onError?.({ ok: false, status: 200, error: "Malformed response", offline: false });
        }
      } catch {
        onError?.({ ok: false, status: 200, error: "Malformed JSON", offline: false });
      }
    })
    .catch((e) => {
      // Network failure (offline, CORS, abort). Treat as offline if the
      // error name suggests so; otherwise a generic upload-failed.
      const isAbort = e && typeof e === "object" && "name" in e && e.name === "AbortError";
      if (isAbort) return; // Caller cancelled; no error needed
      onError?.({
        ok: false,
        status: 0,
        error: e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Network error",
        offline: true,
      });
    });
}
