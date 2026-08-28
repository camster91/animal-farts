// useRecording.ts — extracted from PootBox.tsx in v52-4
// Owns: recPhase, pendingBlob, pendingUrl, recordingMs, micPermState, micDenied,
//       mediaRecorderRef, mediaChunksRef, mediaStreamRef, recordingTimerRef,
//       recordingStartRef, unlockAudio, startRecording, stopRecording,
//       cancelRecording, finalizeRecording

import { useState, useRef, useCallback, useEffect } from "react";
import type { BubbleState } from "../types";
import { saveBlob, saveRecordingEmoji } from "../recordings";
import { enqueueUpload, processSyncQueue, type SyncStatus } from "../syncQueue";

export type RecPhase = "idle" | "recording" | "picking";

export interface UseRecordingParams {
  maxRecordingMs?: number;  // default 6000
  /** Called when finalizeRecording adds a new bubble to the active page */
  onBubbleAdded?: (bubble: BubbleState) => void;
  /** Called AFTER the local IDB save succeeds + the bubble is
   *  on the canvas. v60: lets the parent show a "🎤 Saved!" toast
   *  so the kid knows the mic capture worked. Wired to showToast. */
  onSaved?: (bubble: BubbleState) => void;
  /** Called when the fire-and-forget server upload of a recorded
   *  blob completes successfully. The parent can use this to swap
   *  the bubble's blobUrl + sound from the dead blob: URL to the
   *  server-issued /uploads/... path so the recording survives a
   *  page reload. If omitted, the local IDB blob remains the
   *  source of truth and the recording still plays for the current
   *  session (it just won't survive reload). */
  // v76: serverRecordingId added so PootBox can DELETE the server
  // recording when the kid removes the bubble (closes the orphan
  // upload row that accumulates every time a recording is uploaded
  // and then deleted client-side).
  onUploadComplete?: (bubbleId: string, serverAudioUrl: string, serverRecordingId: number) => void;
  onDeleteComplete?: (bubbleId: string) => void;
  onSyncStatus?: (bubbleId: string, status: SyncStatus | "synced" | "deleted", message?: string) => void;
  /** Called on recording errors (mic denied, getUserMedia failed, etc.) */
  onError?: (msg: string) => void;
}

export interface UseRecordingResult {
  recPhase: RecPhase;
  recordingMs: number;
  micDenied: boolean;
  micPermState: "prompt" | "denied" | "granted" | "unsupported";
  pendingBlob: Blob | null;
  pendingUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  /** Build the bubble from the pending blob + emoji, save to IDB, call onBubbleAdded */
  finalizeRecording: (emoji: string) => Promise<void>;
  syncNow: () => Promise<void>;
  /** iOS Safari: empty audio.play() to unlock the AudioContext. Call from a user gesture. */
  unlockAudio: () => void;
}

const DEFAULT_MAX_RECORDING_MS = 6000;

export function useRecording(params: UseRecordingParams = {}): UseRecordingResult {
  const {
    maxRecordingMs = DEFAULT_MAX_RECORDING_MS,
    onBubbleAdded,
    onSaved,
    onUploadComplete,
    onDeleteComplete,
    onSyncStatus,
    onError,
  } = params;

  const syncCallbacksRef = useRef({ onUploadComplete, onDeleteComplete, onSyncStatus });
  useEffect(() => {
    syncCallbacksRef.current = { onUploadComplete, onDeleteComplete, onSyncStatus };
  }, [onDeleteComplete, onSyncStatus, onUploadComplete]);
  const drainSyncQueue = useCallback(() => processSyncQueue({
    onStatus: (...args) => syncCallbacksRef.current.onSyncStatus?.(...args),
    onUploadComplete: (bubbleId, recording) => {
      syncCallbacksRef.current.onUploadComplete?.(bubbleId, recording.audioUrl, recording.id);
    },
    onDeleteComplete: (bubbleId) => syncCallbacksRef.current.onDeleteComplete?.(bubbleId),
  }), []);

  useEffect(() => {
    void drainSyncQueue();
    const onOnline = () => { void drainSyncQueue(); };
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => { void drainSyncQueue(); }, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [drainSyncQueue]);

  // ── State ────────────────────────────────────────────────────────────────
  const [recPhase, setRecPhase] = useState<RecPhase>("idle");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  // micPermState + micDenied are declared further down with deferred
  // initializers (they need to read navigator.permissions at init time
  // without setting state in an effect).

  // ── Refs ────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const recordingStartRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);

  // ── Track permission state ─────────────────────────────────────────────
  // We use a "deferred" initial state: if the browser doesn't expose
  // navigator.permissions, we set 'unsupported' synchronously in the
  // initializer (which is NOT an effect, so the lint rule about cascading
  // renders doesn't trip). The effect then only handles the supported case.
  const [micPermState, setMicPermState] = useState<"prompt" | "denied" | "granted" | "unsupported">(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return "unsupported";
    return "prompt"; // optimistic default; effect refines to actual state
  });
  const [micDenied, setMicDenied] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!status) return;
      setMicPermState(status.state as "prompt" | "denied" | "granted");
      setMicDenied(status.state === "denied");
    };
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((p) => {
        if (cancelled) return;
        status = p;
        setMicPermState(p.state as "prompt" | "denied" | "granted");
        setMicDenied(p.state === "denied");
        p.addEventListener("change", onChange);
      })
      .catch(() => {
        if (cancelled) return;
        setMicPermState("unsupported");
      });
    return () => {
      cancelled = true;
      if (status) status.removeEventListener("change", onChange);
    };
  }, []);

  // Tear down mic/recorder/timers if the host unmounts mid-recording
  // (App.tsx swaps tabs and unmounts <PootBox />).
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (autoStopTimeoutRef.current) {
        window.clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        try {
          if (mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
          }
        } catch { /* ignore */ }
        mediaRecorderRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (pendingUrlRef.current) {
        URL.revokeObjectURL(pendingUrlRef.current);
        pendingUrlRef.current = null;
      }
    };
  }, []);

  // ── Unlock audio (iOS Safari) ──────────────────────────────────────────
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const a = new Audio();
      a.play().then(() => {}).catch(() => {});
      audioUnlockedRef.current = true;
    } catch { /* noop */ }
  }, []);

  // ── Start recording ────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    unlockAudio();
    setMicDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        pendingUrlRef.current = url;
        setPendingBlob(blob);
        setPendingUrl(url);
        setRecPhase("picking");
        // Cleanup stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
          window.clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
      };
      recordingStartRef.current = performance.now();
      setRecordingMs(0);
      recorder.start();
      setRecPhase("recording");
      // Tick the recording timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingMs(Math.round(performance.now() - recordingStartRef.current));
      }, 100);
      // Auto-stop at maxRecordingMs
      if (autoStopTimeoutRef.current) {
        window.clearTimeout(autoStopTimeoutRef.current);
      }
      autoStopTimeoutRef.current = window.setTimeout(() => {
        autoStopTimeoutRef.current = null;
        if (recorder.state === "recording") recorder.stop();
      }, maxRecordingMs);
    } catch {
      setMicDenied(true);
      setRecPhase("idle");
      onError?.("Microphone blocked. Tap the lock 🔒 in the address bar → Site settings → Allow.");
    }
  }, [maxRecordingMs, onError, unlockAudio]);

  // ── Stop recording (user tapped Stop) ─────────────────────────────────
  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Cancel and reset ──────────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    pendingUrlRef.current = null;
    setPendingBlob(null);
    setPendingUrl(null);
    setRecordingMs(0);
    setRecPhase("idle");
  }, [pendingUrl]);

  // ── Finalize: build the bubble + save to IDB + add to page ───────────
  const finalizeRecording = useCallback(
    async (emoji: string) => {
      if (!pendingBlob || !pendingUrl) return;
      const id = `b:custom:${Date.now()}`;
      const bubble: BubbleState = {
        id,
        type: "custom",
        emoji,
        blobUrl: pendingUrl,
        sound: pendingUrl,
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        radius: 36,
        mass: 1,
        lastTouchedAt: -1,
        lastReleasedAt: -1,
      };
      try {
        await saveBlob(id, pendingBlob);
        saveRecordingEmoji(id, emoji);
      } catch {
        onError?.("Couldn't save recording");
        return; // v60: don't add a half-saved bubble to the canvas
      }
      // Notify parent — it owns pages/activePageId and will add the bubble
      onBubbleAdded?.(bubble);
      // v60: show a "saved" toast so the kid knows the mic capture
      // succeeded. Fires only on the successful-save path; an
      // onError above prevents reaching here on save failure.
      onSaved?.(bubble);
      // Persist the upload intent and blob before attempting the network.
      // The queue survives reload/offline periods and retries with the same
      // operation id, allowing the server to deduplicate every attempt.
      const durationSec = recordingMs / 1000;
      try {
        await enqueueUpload({
          bubbleId: id,
          blob: pendingBlob,
          name: bubble.id,
          emoji,
          durationSec,
        });
        onSyncStatus?.(id, "pending");
        void drainSyncQueue();
      } catch {
        onError?.("Saved here, but couldn't queue online backup");
      }
      // Reset pending state but do NOT revoke pendingUrl here — the
      // bubble still plays from that blob: URL until onUploadComplete
      // swaps it to /uploads/... (parent revokes the old blob: URL).
      pendingUrlRef.current = null;
      setPendingBlob(null);
      setPendingUrl(null);
      setRecPhase("idle");
    },
    [pendingBlob, pendingUrl, recordingMs, onBubbleAdded, onSaved, onSyncStatus, onError, drainSyncQueue]
  );

  return {
    recPhase,
    recordingMs,
    micDenied,
    micPermState,
    pendingBlob,
    pendingUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    finalizeRecording,
    syncNow: drainSyncQueue,
    unlockAudio,
  };
}
