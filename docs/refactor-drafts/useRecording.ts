// useRecording.ts — extracted from PootBox.tsx in v52-4
// Owns: recPhase, pendingBlob, pendingUrl, recordingMs, micPermState, micDenied,
//       mediaRecorderRef, mediaChunksRef, mediaStreamRef, recordingTimerRef,
//       recordingStartRef, unlockAudio, startRecording, stopRecording,
//       cancelRecording, finalizeRecording

import { useState, useRef, useCallback, useEffect } from "react";
import type { BubbleState } from "../types";
import { addBubbleToPageDedup, saveBlob, saveRecordingEmoji } from "../recordings";

export type RecPhase = "idle" | "recording" | "picking";

export interface UseRecordingParams {
  maxRecordingMs?: number;  // default 6000
  onBubbleAdded?: (b: BubbleState) => void;
  onError?: (error: string) => void;
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
  finalizeRecording: (emoji: string, pages: import("../types").Page[], activePageId: string | null, showToast: (msg: string) => void) => Promise<void>;
  redoRecording: () => Promise<void>;
  unlockAudio: () => void;
}

const DEFAULT_MAX_RECORDING_MS = 6000;

export function useRecording(params: UseRecordingParams = {}): UseRecordingResult {
  const { maxRecordingMs = DEFAULT_MAX_RECORDING_MS, onBubbleAdded, onError } = params;

  // ── State ────────────────────────────────────────────────────────────────
  const [recPhase, setRecPhase] = useState<RecPhase>("idle");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [micPermState, setMicPermState] = useState<"prompt" | "denied" | "granted" | "unsupported">("prompt");
  const [micDenied, setMicDenied] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef(0);
  const audioUnlockedRef = useRef(false);

  // ── unlockAudio ──────────────────────────────────────────────────────────
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const silent = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      silent.volume = 0;
      void silent.play().catch(() => { audioUnlockedRef.current = false; });
      audioUnlockedRef.current = true;
    } catch { audioUnlockedRef.current = false; }
  }, []);

  // ── Mic permission pre-check ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then(p => {
      if (cancelled) return;
      const initialState = p.state as typeof micPermState;
      queueMicrotask(() => {
        if (cancelled) return;
        setMicPermState(initialState);
        if (initialState === "denied") setMicDenied(true);
      });
      p.addEventListener("change", () => {
        if (cancelled) return;
        const ns = p.state as typeof micPermState;
        setMicPermState(ns);
        setMicDenied(ns === "denied");
      });
    }).catch(() => { /* Firefox doesn't support query */ });
    return () => { cancelled = true; };
  }, []);

  // ── startRecording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current) return;
    if (micPermState === "denied") { setMicDenied(true); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicDenied(true);
      setRecPhase("idle");
      onError?.("mic-denied");
      return;
    }
    mediaStreamRef.current = stream;
    setMicDenied(false);
    unlockAudio();
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaChunksRef.current = [];
    rec.ondataavailable = e => { if (e.data?.size > 0) mediaChunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(mediaChunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (mediaChunksRef.current.length === 0 || blob.size === 0) { setRecPhase("idle"); return; }
      const url = URL.createObjectURL(blob);
      setPendingBlob(blob);
      setPendingUrl(url);
      setRecPhase("picking");
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
    };
    rec.start();
    mediaRecorderRef.current = rec;
    recordingStartRef.current = performance.now();
    setRecordingMs(0);
    setRecPhase("recording");
    recordingTimerRef.current = window.setInterval(() => {
      const ms = performance.now() - recordingStartRef.current;
      setRecordingMs(ms);
      if (ms >= maxRecordingMs && mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      }
    }, 50);
  }, [micPermState, unlockAudio, maxRecordingMs, onError]);

  // ── stopRecording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  // ── cancelRecording ─────────────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingBlob(null);
    setPendingUrl(null);
    setRecordingMs(0);
    setRecPhase("idle");
  }, [pendingUrl]);

  // ── finalizeRecording ───────────────────────────────────────────────────
  const finalizeRecording = useCallback(async (
    emoji: string,
    pages: import("../types").Page[],
    activePageId: string | null,
    showToast: (msg: string) => void,
  ) => {
    if (!pendingBlob || !pendingUrl || !activePageId) return;
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
    await saveBlob(id, pendingBlob);
    saveRecordingEmoji(id, emoji);
    const { added } = addBubbleToPageDedup(pages, activePageId, bubble);
    if (!added) {
      showToast("Already on this page!");
    } else {
      onBubbleAdded?.(bubble);
    }
    setPendingBlob(null);
    setPendingUrl(null);
    setRecPhase("idle");
  }, [pendingBlob, pendingUrl, onBubbleAdded]);

  // ── redoRecording ─────────────────────────────────────────────────────
  const redoRecording = useCallback(async () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingUrl(null);
    setPendingBlob(null);
    setRecordingMs(0);
    await startRecording();
  }, [pendingUrl, startRecording]);

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
    redoRecording,
    unlockAudio,
  };
}
