// PWA utilities: install prompt, share, push, online status.

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: InstallPromptEvent | null = null;

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa-installable"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installed"));
  });
}

export function isInstallAvailable(): boolean {
  return !!deferredPrompt;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return choice.outcome === "accepted";
  } catch {
    return false;
  }
}

export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function isInstalledPwa(): boolean {
  // iOS: window.navigator.standalone
  // Android/Desktop: display-mode: standalone
  const navAny = navigator as any;
  if (navAny.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches === true;
}

// Online/offline
export function watchOnlineStatus(cb: (online: boolean) => void): () => void {
  const update = () => cb(navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}

// Web Share API (with fallback to clipboard)
export type ShareData = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
};

export async function share(data: ShareData): Promise<"shared" | "copied" | "unsupported"> {
  if (navigator.canShare && navigator.canShare(data as any)) {
    try {
      await (navigator as any).share(data);
      return "shared";
    } catch (err: any) {
      if (err?.name === "AbortError") return "unsupported";
    }
  }
  // Fallback: copy to clipboard
  const text = [data.title, data.text, data.url].filter(Boolean).join("\n");
  if (text && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {}
  }
  return "unsupported";
}

// Push notification subscription
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    // Check existing
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    // VAPID key would go here in production. For now, return null if no key.
    const vapidKey = (window as any).__vapidPublicKey;
    if (!vapidKey) return null;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    return sub;
  } catch (err) {
    console.warn("[push] subscribe failed:", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

// Parse a launch action from the URL (used by PWA shortcuts)
export type LaunchAction =
  | { type: "surprise" }
  | { type: "record" }
  | { type: "challenge" }
  | { type: "share-target"; title: string; text: string; url: string; files: File[] }
  | null;

export function parseLaunchAction(): LaunchAction {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  if (action === "surprise") return { type: "surprise" };
  if (action === "record") return { type: "record" };
  if (action === "challenge") return { type: "challenge" };
  if (action === "share-target") {
    return {
      type: "share-target",
      title: params.get("title") || "",
      text: params.get("text") || "",
      url: params.get("url") || "",
      files: [], // file blobs come via POST; in the launched Web app we read the URL params
    };
  }
  return null;
}
