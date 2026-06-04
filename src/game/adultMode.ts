// Adult mode gate — currently a simple boolean stored in localStorage.
// The PIN gate is wired up separately in the parental tab. When
// adultMode is false, all social controls (reactions, posting) are
// hidden from the kid-facing UI.

const ADULT_KEY = "fart-adult-mode";
const PIN_KEY = "fart-parent-pin";
const DEFAULT_PIN = "1234";

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

// === Parent PIN ===
// Used to gate the adult-mode toggle. Stored in plain text in
// localStorage — fine for a kids' app where the threat model is "stop
// curious 5-year-olds", not "stop a determined attacker". The device
// owner is the parent.

export function getParentPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
}

export function setParentPin(pin: string): void {
  try {
    localStorage.setItem(PIN_KEY, pin);
  } catch {}
}

export function checkParentPin(input: string): boolean {
  return input === getParentPin();
}
