// Adult mode gate — currently a simple boolean stored in localStorage.
// The PIN gate is wired up separately in the parental tab. When
// adultMode is false, all social controls (reactions, posting) are
// hidden from the kid-facing UI.

const ADULT_KEY = "fart-adult-mode";

export function isAdultMode(): boolean {
  try {
    return localStorage.getItem(ADULT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdultMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(ADULT_KEY, "1");
    else localStorage.removeItem(ADULT_KEY);
  } catch {}
}
