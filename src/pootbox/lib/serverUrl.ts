import { Capacitor } from "@capacitor/core";

export const PRODUCTION_SERVER_ORIGIN = "https://animals.ashbi.ca";

export function serverUrl(
  path: string,
  nativePlatform = Capacitor.isNativePlatform(),
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
