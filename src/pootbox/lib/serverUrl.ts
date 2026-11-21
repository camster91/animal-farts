export const PRODUCTION_SERVER_ORIGIN = "https://animals.ashbi.ca";

// Match @capacitor/core's getPlatformId / CapacitorCustomPlatform check without
// bundling the core library into the web entry.
type PlatformWindow = {
  androidBridge?: unknown;
  webkit?: { messageHandlers?: { bridge?: unknown } };
  CapacitorCustomPlatform?: { name?: string };
};

function isNativePlatform(
  win: PlatformWindow | undefined = typeof globalThis === "object" ? (globalThis as PlatformWindow) : undefined,
): boolean {
  if (!win) return false;
  const custom = win.CapacitorCustomPlatform?.name;
  if (custom) return custom !== "web";
  return Boolean(win.androidBridge || win.webkit?.messageHandlers?.bridge);
}

export function serverUrl(
  path: string,
  nativePlatform = isNativePlatform(),
  serverOrigin = PRODUCTION_SERVER_ORIGIN,
): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new TypeError("Server paths must be root-relative");
  }
  if (!nativePlatform) return path;
  const base = new URL(`${serverOrigin.replace(/\/$/, "")}/`);
  if (base.protocol !== "https:" || base.username || base.password) {
    throw new TypeError("Native server origin must be credential-free HTTPS");
  }
  const resolved = new URL(path, base);
  if (resolved.origin !== base.origin) throw new TypeError("Server path escaped its origin");
  return resolved.toString();
}
