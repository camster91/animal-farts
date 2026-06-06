// Poot Party — audio engine. v26.
// Refactored from fartEngine.ts (v25r) into a clean public API.
// Responsibilities: playback with auto-stop-on-tap, FX (pitch/speed/reverb),
// and MediaRecorder-based recording with iOS Safari fallback.

// === Public types ===

export interface RecordingResult {
  blob: Blob;
  duration: number; // seconds
  mimeType: string; // "audio/webm" or "audio/mp4"
}

export interface AudioEngine {
  play(soundUrl: string): Promise<void>;
  playRandom(sounds: string[]): string | null;
  stopAll(): void;
  setPitch(semitones: number): void;   // 0.5–2.0
  setSpeed(factor: number): void;     // 0.5–2.0
  setReverb(enabled: boolean): void;   // on/off
  record(opts?: { maxDurationMs?: number }): Promise<RecordingResult | null>;
  isRecording(): boolean;
}

// === Module-level FX state ===

let pitchRate = 1.0;     // 0.5x = deep, 2.0x = chipmunk
let speedFactor = 1.0;   // playback rate
let reverbEnabled = false;

// === Audio context (lazy, shared with Web Audio for reverb) ===

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    const C = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new C();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// === Echo impulse (shared, regenerated only when sample rate changes) ===

let echoImpulse: AudioBuffer | null = null;

function getEchoImpulse(ctx: AudioContext): AudioBuffer {
  if (echoImpulse && echoImpulse.sampleRate === ctx.sampleRate) return echoImpulse;
  const length = ctx.sampleRate * 1.2;
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  echoImpulse = buf;
  return buf;
}

// === Active audio element tracker ===

const activeElements = new Set<HTMLAudioElement>();

function trackActive(a: HTMLAudioElement) {
  activeElements.add(a);
  a.addEventListener("ended", () => activeElements.delete(a), { once: true });
  a.addEventListener("error", () => activeElements.delete(a), { once: true });
  window.setTimeout(() => activeElements.delete(a), 30000);
}

function stopActiveElements() {
  for (const a of activeElements) {
    try { a.pause(); } catch { /* ignore */ }
    try { a.currentTime = 0; } catch { /* ignore */ }
  }
  activeElements.clear();
}

// === Playback ===

function playDirect(src: string): Promise<void> {
  const a = new Audio(src);
  a.playbackRate = speedFactor;
  a.volume = 0.9;
  trackActive(a);
  return a.play().catch((err) => {
    console.warn("[engine] play failed:", err);
  });
}

async function playWithReverb(src: string): Promise<void> {
  try {
    const ctx = getCtx();
    const resp = await fetch(src);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const srcNode = ctx.createBufferSource();
    srcNode.buffer = audioBuf;
    srcNode.playbackRate.value = speedFactor;
    const convolver = ctx.createConvolver();
    convolver.buffer = getEchoImpulse(ctx);
    const dry = ctx.createGain();
    dry.gain.value = 0.4;
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    srcNode.connect(dry).connect(ctx.destination);
    srcNode.connect(convolver).connect(wet).connect(ctx.destination);
    srcNode.start();
    const durationMs = (audioBuf.duration / speedFactor + 0.5) * 1000;
    setTimeout(() => { try { srcNode.stop(); } catch { /* ignore */ } }, durationMs);
  } catch (err) {
    console.warn("[engine] reverb playback failed, falling back:", err);
    void playDirect(src);
  }
}

// === Recording state ===

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let autoStopTimer: number | null = null;
let recordingInProgress = false;

function detectMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/ogg",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

async function requestMicStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }
}

// === Engine factory (singleton) ===

let engineInstance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (engineInstance) return engineInstance;

  engineInstance = {
    async play(soundUrl: string): Promise<void> {
      stopActiveElements();
      if (reverbEnabled) {
        await playWithReverb(soundUrl);
      } else {
        await playDirect(soundUrl);
      }
    },

    playRandom(sounds: string[]): string | null {
      if (sounds.length === 0) return null;
      const url = sounds[Math.floor(Math.random() * sounds.length)];
      void this.play(url);
      return url;
    },

    stopAll(): void {
      stopActiveElements();
      if (audioCtx && audioCtx.state === "running") {
        audioCtx.suspend();
      }
    },

    setPitch(semitones: number): void {
      pitchRate = Math.max(0.5, Math.min(2.0, semitones));
      speedFactor = pitchRate;
    },

    setSpeed(factor: number): void {
      speedFactor = Math.max(0.5, Math.min(2.0, factor));
    },

    setReverb(enabled: boolean): void {
      reverbEnabled = enabled;
    },

    async record(opts?: { maxDurationMs?: number }): Promise<RecordingResult | null> {
      if (recordingInProgress) return null;

      const maxDurationMs = opts?.maxDurationMs ?? 3000;

      // iOS Safari note: testing on a real iOS device is required before
      // v26b ships. MediaRecorder support varies by iOS version:
      // - iOS 14.3+: WebM + Opus + MP4 + AAC are all supported
      // - iOS < 14.3: MediaRecorder may not exist at all — record() returns null
      if (typeof MediaRecorder === "undefined") return null;

      const stream = await requestMicStream();
      if (!stream) return null; // permission denied or not available

      recordingInProgress = true;
      activeStream = stream;
      chunks = [];

      const mime = detectMimeType();
      if (!mime) {
        stream.getTracks().forEach((t) => t.stop());
        recordingInProgress = false;
        return null;
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        recordingInProgress = false;
        return null;
      }

      activeRecorder = recorder;

      return new Promise<RecordingResult | null>((resolve) => {
        recorder.addEventListener("dataavailable", (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        });

        recorder.addEventListener("stop", () => {
          if (autoStopTimer) {
            window.clearTimeout(autoStopTimer);
            autoStopTimer = null;
          }
          const duration = (Date.now() - startedAt) / 1000;
          const blob = new Blob(chunks, { type: recorder.mimeType });
          if (activeStream) {
            activeStream.getTracks().forEach((t) => t.stop());
          }
          activeRecorder = null;
          activeStream = null;
          chunks = [];
          recordingInProgress = false;
          resolve({ blob, duration, mimeType: recorder.mimeType });
        });

        recorder.addEventListener("error", () => {
          if (activeStream) {
            activeStream.getTracks().forEach((t) => t.stop());
          }
          activeRecorder = null;
          activeStream = null;
          chunks = [];
          recordingInProgress = false;
          resolve(null);
        });

        startedAt = Date.now();
        recorder.start(100); // collect chunks every 100ms

        autoStopTimer = window.setTimeout(() => {
          if (activeRecorder && activeRecorder.state === "recording") {
            activeRecorder.stop();
          }
        }, maxDurationMs);
      });
    },

    isRecording(): boolean {
      return recordingInProgress;
    },
  };

  return engineInstance;
}
