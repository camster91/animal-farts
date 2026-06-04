// Persistent game state — localStorage backed.
// Kids, achievements, stickers, leaderboards, daily challenge.

export type Kid = {
  id: string;
  name: string;
  avatar: string; // emoji
  color: string; // tailwind gradient
  createdAt: number;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  // Predicate evaluated against the current kid's stats.
  // Returns true if unlocked.
  predicate: (stats: KidStats) => boolean;
};

export type KidStats = {
  totalTaps: number;
  uniqueAnimalsTried: number;
  recordings: number;
  combosPlayed: number;
  bathroomFarts: number;
  longestRecordingSec: number;
  consecutiveDays: number;
  lastPlayedDate: string; // YYYY-MM-DD
};

export type DailyChallenge = {
  date: string; // YYYY-MM-DD
  prompt: string;
  metric: "longestRecording" | "mostTaps" | "mostCombos" | "mostUniqueAnimals";
};

const PROFILES_KEY = "fart-profiles-v1";
const ACTIVE_KID_KEY = "fart-active-kid-v1";
const PARENTAL_KEY = "fart-parental-v1";
const TODAY_RECORDINGS_KEY = "fart-today-recordings-v1";

const AVATAR_CHOICES: { emoji: string; color: string }[] = [
  { emoji: "🐱", color: "from-pink-300 to-pink-500" },
  { emoji: "🐶", color: "from-amber-300 to-amber-500" },
  { emoji: "🐰", color: "from-pink-200 to-pink-400" },
  { emoji: "🐻", color: "from-amber-700 to-amber-900" },
  { emoji: "🐼", color: "from-slate-200 to-slate-400" },
  { emoji: "🦊", color: "from-orange-400 to-red-500" },
  { emoji: "🐯", color: "from-yellow-400 to-orange-500" },
  { emoji: "🦁", color: "from-yellow-300 to-amber-500" },
  { emoji: "🐸", color: "from-green-300 to-green-500" },
  { emoji: "🐵", color: "from-lime-300 to-lime-500" },
  { emoji: "🦄", color: "from-fuchsia-300 to-purple-500" },
  { emoji: "🐲", color: "from-emerald-400 to-green-700" },
];

export function getAvatarChoices() {
  return AVATAR_CHOICES;
}

// === Kid profiles ===
export function loadProfiles(): Kid[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveProfiles(profiles: Kid[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveKidId(): string | null {
  return localStorage.getItem(ACTIVE_KID_KEY);
}

export function setActiveKidId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KID_KEY, id);
  else localStorage.removeItem(ACTIVE_KID_KEY);
}

export function createKid(name: string, avatar: string, color: string): Kid {
  const profiles = loadProfiles();
  const id = `kid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const kid: Kid = { id, name, avatar, color, createdAt: Date.now() };
  profiles.push(kid);
  saveProfiles(profiles);
  return kid;
}

export function deleteKid(id: string) {
  const profiles = loadProfiles().filter((k) => k.id !== id);
  saveProfiles(profiles);
  if (getActiveKidId() === id) {
    setActiveKidId(profiles[0]?.id || null);
  }
  try { localStorage.removeItem("fart-stats"); } catch {}
}

// === Stats (per kid) ===

export function updateStats(kidId: string, updater: (s: ReturnType<typeof defaultStats>) => ReturnType<typeof defaultStats>) {
  const KEY = 'fart-stats';
  let all: Record<string, any> = {};
  try { const raw = localStorage.getItem(KEY); if (raw) all = JSON.parse(raw); } catch {}
  const current = all[kidId] || { ...defaultStats() };
  const updated = updater(current);
  const today = new Date().toISOString().slice(0, 10);
  if (updated.lastPlayedDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    updated.consecutiveDays = updated.lastPlayedDate === yesterday
      ? (updated.consecutiveDays || 0) + 1
      : 1;
    updated.lastPlayedDate = today;
  }
  all[kidId] = updated;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  return updated;
}
function defaultStats() {
  return {
    totalTaps: 0,
    uniqueAnimalsTried: 0,
    recordings: 0,
    combosPlayed: 0,
    bathroomFarts: 0,
    longestRecordingSec: 0,
    consecutiveDays: 0,
    lastPlayedDate: null as string | null,
    animalsTried: [] as string[],
  };
}
// === Parental controls ===
export type ParentalSettings = {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number; // 0-23
  dailyRecordingLimit: number; // 0 = unlimited
  mute: boolean;
};

const DEFAULT_PARENTAL: ParentalSettings = {
  enabled: false,
  startHour: 8,
  endHour: 19,
  dailyRecordingLimit: 20,
  mute: false,
};

export function loadParentalSettings(): ParentalSettings {
  try {
    const raw = localStorage.getItem(PARENTAL_KEY);
    if (!raw) return DEFAULT_PARENTAL;
    return { ...DEFAULT_PARENTAL, ...JSON.parse(raw) };
  } catch { return DEFAULT_PARENTAL; }
}

export function saveParentalSettings(s: ParentalSettings) {
  localStorage.setItem(PARENTAL_KEY, JSON.stringify(s));
}

export function isPlayTimeAllowed(s: ParentalSettings): boolean {
  if (!s.enabled) return true;
  const hour = new Date().getHours();
  if (s.startHour <= s.endHour) {
    return hour >= s.startHour && hour < s.endHour;
  }
  // Wraps midnight (e.g. 19-8 = evening/night)
  return hour >= s.startHour || hour < s.endHour;
}

// === Daily recording counter (for parental limit) ===
export function getTodayRecordingsCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(`${TODAY_RECORDINGS_KEY}-${today}`);
  return parseInt(raw || "0", 10);
}

export function incrementTodayRecordings(): number {
  const today = new Date().toISOString().slice(0, 10);
  const current = getTodayRecordingsCount();
  const next = current + 1;
  localStorage.setItem(`${TODAY_RECORDINGS_KEY}-${today}`, String(next));
  return next;
}

// === Sound combos detection ===
// A "combo" is a sequence of 3+ animal taps within 3 seconds
export function getComboName(animalIds: string[]): string {
  // Generate a fun combo name from 3 animal ids
  const names: Record<string, string> = {
    cow: "Cow", dog: "Dog", cat: "Cat", bird: "Bird", horse: "Horse",
    pig: "Pig", duck: "Duck", elephant: "Elephant", monkey: "Monkey",
    snake: "Snake", lion: "Lion", frog: "Frog", bull: "Bull", rabbit: "Rabbit",
    bear: "Bear", rooster: "Rooster", turtle: "Turtle", whale: "Whale",
  };
  if (animalIds.length < 2) return "Tap 2+ animals for a combo!";
  if (animalIds.length === 2) return `${names[animalIds[0]]} + ${names[animalIds[1]]} Surprise`;
  if (animalIds.length === 3) return `${names[animalIds[0]]}-${names[animalIds[1]]}-${names[animalIds[2]]} Tornado`;
  return `${animalIds.length}-Animal Stampede!`;
}