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
const STATS_KEY = "fart-stats-v1";
const ACHIEVEMENTS_KEY = "fart-achievements-v1";
const STICKER_BOARD_KEY = "fart-sticker-board-v1";
const DAILY_KEY = "fart-daily-v1";
const PARENTAL_KEY = "fart-parental-v1";
const SOUND_PACKS_KEY = "fart-sound-packs-v1";
const COMBO_HISTORY_KEY = "fart-combo-history-v1";
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
  // Also delete kid's stats + achievements
  const stats = loadAllStats();
  delete stats[id];
  saveAllStats(stats);
  const ach = loadAchievements();
  delete ach[id];
  saveAchievements(ach);
}

// === Stats (per kid) ===
type AllStats = Record<string, KidStats>;

export function loadAllStats(): AllStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export function saveAllStats(s: AllStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

export function getStats(kidId: string): KidStats {
  const all = loadAllStats();
  return all[kidId] || {
    totalTaps: 0,
    uniqueAnimalsTried: 0,
    recordings: 0,
    combosPlayed: 0,
    bathroomFarts: 0,
    longestRecordingSec: 0,
    consecutiveDays: 0,
    lastPlayedDate: "",
  };
}

export function updateStats(kidId: string, updater: (s: KidStats) => KidStats) {
  const all = loadAllStats();
  const current = all[kidId] || getStats(kidId);
  const updated = updater(current);
  // Track consecutive days
  const today = new Date().toISOString().slice(0, 10);
  if (updated.lastPlayedDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (updated.lastPlayedDate === yesterday) {
      updated.consecutiveDays = (updated.consecutiveDays || 0) + 1;
    } else if (updated.lastPlayedDate) {
      updated.consecutiveDays = 1;
    } else {
      updated.consecutiveDays = 1;
    }
    updated.lastPlayedDate = today;
  }
  all[kidId] = updated;
  saveAllStats(all);
  return updated;
}

export function trackAnimalTried(kidId: string, animalId: string) {
  // Per-kid set of animals tried
  const key = `fart-animals-tried-${kidId}`;
  const raw = localStorage.getItem(key);
  const tried: string[] = raw ? JSON.parse(raw) : [];
  if (!tried.includes(animalId)) {
    tried.push(animalId);
    localStorage.setItem(key, JSON.stringify(tried));
    updateStats(kidId, (s) => ({ ...s, uniqueAnimalsTried: tried.length }));
  } else {
    // Just bump tap count
    updateStats(kidId, (s) => ({ ...s, totalTaps: s.totalTaps + 1 }));
  }
}

export function getAnimalsTried(kidId: string): string[] {
  const key = `fart-animals-tried-${kidId}`;
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

// === Achievements ===
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-fart", name: "First Toot", description: "Play your first sound", emoji: "🎉", predicate: (s) => s.totalTaps >= 1 },
  { id: "fart-10", name: "Getting Started", description: "Play 10 sounds", emoji: "⭐", predicate: (s) => s.totalTaps >= 10 },
  { id: "fart-50", name: "Veteran", description: "Play 50 sounds", emoji: "🌟", predicate: (s) => s.totalTaps >= 50 },
  { id: "fart-200", name: "Legend", description: "Play 200 sounds", emoji: "👑", predicate: (s) => s.totalTaps >= 200 },
  { id: "all-animals", name: "Zoo Master", description: "Try every animal", emoji: "🦁", predicate: (s) => s.uniqueAnimalsTried >= 18 },
  { id: "first-recording", name: "Voice Star", description: "Make your first recording", emoji: "🎤", predicate: (s) => s.recordings >= 1 },
  { id: "recordings-5", name: "Producer", description: "Record 5 farts", emoji: "🎙️", predicate: (s) => s.recordings >= 5 },
  { id: "recordings-15", name: "Sound Master", description: "Record 15 farts", emoji: "💿", predicate: (s) => s.recordings >= 15 },
  { id: "first-combo", name: "Combo Starter", description: "Play your first combo", emoji: "💥", predicate: (s) => s.combosPlayed >= 1 },
  { id: "combos-10", name: "Combo King", description: "Play 10 combos", emoji: "👊", predicate: (s) => s.combosPlayed >= 10 },
  { id: "bathroom-once", name: "Plumber", description: "Try Bathroom mode", emoji: "🚿", predicate: (s) => s.bathroomFarts >= 1 },
  { id: "bathroom-25", name: "Echo Chamber", description: "Use Bathroom mode 25 times", emoji: "🛁", predicate: (s) => s.bathroomFarts >= 25 },
  { id: "long-rec", name: "Long Toot", description: "Record a 5+ second sound", emoji: "📏", predicate: (s) => s.longestRecordingSec >= 5 },
  { id: "streak-3", name: "Three-peat", description: "Play 3 days in a row", emoji: "🔥", predicate: (s) => s.consecutiveDays >= 3 },
  { id: "streak-7", name: "Weekly Winner", description: "Play 7 days in a row", emoji: "🏆", predicate: (s) => s.consecutiveDays >= 7 },
];

type AllAchievements = Record<string, string[]>; // kidId -> achievement ids

export function loadAchievements(): AllAchievements {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export function saveAchievements(a: AllAchievements) {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(a));
}

export function getUnlockedAchievements(kidId: string): string[] {
  const all = loadAchievements();
  return all[kidId] || [];
}

// Check & unlock new achievements for a kid, returns the newly unlocked ones
export function checkAchievements(kidId: string): Achievement[] {
  const stats = getStats(kidId);
  const unlocked = new Set(getUnlockedAchievements(kidId));
  const newlyUnlocked: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.predicate(stats)) {
      newlyUnlocked.push(ach);
      unlocked.add(ach.id);
    }
  }
  if (newlyUnlocked.length > 0) {
    const all = loadAchievements();
    all[kidId] = Array.from(unlocked);
    saveAchievements(all);
  }
  return newlyUnlocked;
}

// === Sticker board ===
// Each achievement unlocks 1 sticker that can be placed on the board.
export type PlacedSticker = {
  id: string;        // unique
  achievementId: string;
  x: number;         // 0-100 (% of board width)
  y: number;         // 0-100 (% of board height)
  rotation: number;  // degrees
};

export function loadStickerBoard(kidId: string): PlacedSticker[] {
  try {
    const raw = localStorage.getItem(`${STICKER_BOARD_KEY}-${kidId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveStickerBoard(kidId: string, board: PlacedSticker[]) {
  localStorage.setItem(`${STICKER_BOARD_KEY}-${kidId}`, JSON.stringify(board));
}

export function addSticker(kidId: string, achievementId: string): PlacedSticker {
  const board = loadStickerBoard(kidId);
  const sticker: PlacedSticker = {
    id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    achievementId,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    rotation: -15 + Math.random() * 30,
  };
  board.push(sticker);
  saveStickerBoard(kidId, board);
  return sticker;
}

export function moveSticker(kidId: string, stickerId: string, x: number, y: number) {
  const board = loadStickerBoard(kidId);
  const s = board.find((s) => s.id === stickerId);
  if (s) {
    s.x = x;
    s.y = y;
    saveStickerBoard(kidId, board);
  }
}

export function removeSticker(kidId: string, stickerId: string) {
  const board = loadStickerBoard(kidId).filter((s) => s.id !== stickerId);
  saveStickerBoard(kidId, board);
}

// === Sound packs ===
// Packs are themed collections of sounds. Unlocked by hitting milestones.
export type SoundPack = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  animalIds: string[];
  unlockAchievementId: string;
};

export const SOUND_PACKS: SoundPack[] = [
  { id: "starter", name: "Starter Pack", emoji: "🎁", description: "The basics", animalIds: ["cow", "dog", "cat", "bird", "pig", "duck"], unlockAchievementId: "first-fart" },
  { id: "farm", name: "Farm Friends", emoji: "🌾", description: "All the farm animals", animalIds: ["cow", "pig", "duck", "rooster", "horse", "bull"], unlockAchievementId: "fart-10" },
  { id: "jungle", name: "Wild Jungle", emoji: "🌴", description: "Predators and prey", animalIds: ["lion", "elephant", "monkey", "snake", "bear", "tiger" /* not in library but referenced */], unlockAchievementId: "all-animals" },
  { id: "bathroom", name: "Bathroom Echo", emoji: "🚿", description: "Sounds that echo", animalIds: ["frog", "turtle", "whale", "rabbit"], unlockAchievementId: "bathroom-once" },
  { id: "creator", name: "Creator Pack", emoji: "🎤", description: "All about recording", animalIds: ["monkey", "rooster", "rabbit", "frog"], unlockAchievementId: "recordings-5" },
  { id: "legendary", name: "Legendary Toots", emoji: "👑", description: "For true legends", animalIds: ["elephant", "whale", "lion", "bear"], unlockAchievementId: "fart-200" },
];

export function getUnlockedPacks(kidId: string): SoundPack[] {
  const unlocked = new Set(getUnlockedAchievements(kidId));
  return SOUND_PACKS.filter((p) => unlocked.has(p.unlockAchievementId));
}

export function getSelectedPack(kidId: string): string | null {
  return localStorage.getItem(`${SOUND_PACKS_KEY}-${kidId}`);
}

export function setSelectedPack(kidId: string, packId: string | null) {
  if (packId) localStorage.setItem(`${SOUND_PACKS_KEY}-${kidId}`, packId);
  else localStorage.removeItem(`${SOUND_PACKS_KEY}-${kidId}`);
}

// === Daily challenge ===
const CHALLENGE_PROMPTS = [
  { prompt: "Make the LONGEST cow fart today!", metric: "longestRecording" as const },
  { prompt: "Tap the most animal sounds today!", metric: "mostTaps" as const },
  { prompt: "Play the most combos today!", metric: "mostCombos" as const },
  { prompt: "Try the most DIFFERENT animals today!", metric: "mostUniqueAnimals" as const },
];

export function getTodayChallenge(): DailyChallenge {
  const today = new Date().toISOString().slice(0, 10);
  // Hash day-of-year to a stable prompt
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const prompt = CHALLENGE_PROMPTS[dayOfYear % CHALLENGE_PROMPTS.length];
  return { date: today, ...prompt };
}

export function getTodayProgress(kidId: string, metric: DailyChallenge["metric"]): number {
  const key = `${DAILY_KEY}-${kidId}-${new Date().toISOString().slice(0, 10)}-${metric}`;
  return parseInt(localStorage.getItem(key) || "0", 10);
}

export function setTodayProgress(kidId: string, metric: DailyChallenge["metric"], value: number) {
  const key = `${DAILY_KEY}-${kidId}-${new Date().toISOString().slice(0, 10)}-${metric}`;
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  if (value > current) localStorage.setItem(key, String(value));
}

// === Combo history (sound combos the user built) ===
export function loadComboHistory(kidId: string): { combo: string; createdAt: number }[] {
  try {
    const raw = localStorage.getItem(`${COMBO_HISTORY_KEY}-${kidId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveComboHistory(kidId: string, combos: { combo: string; createdAt: number }[]) {
  localStorage.setItem(`${COMBO_HISTORY_KEY}-${kidId}`, JSON.stringify(combos.slice(-50))); // keep last 50
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
export function detectComboFromHistory(kidId: string): string | null {
  const history = loadComboHistory(kidId);
  if (history.length === 0) return null;
  // Last combo
  return history[history.length - 1].combo;
}

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

// === Animal emoji map for combo history display ===
export const ANIMAL_NAMES: Record<string, string> = {
  cow: "Cow", dog: "Dog", cat: "Cat", bird: "Bird", horse: "Horse",
  pig: "Pig", duck: "Duck", elephant: "Elephant", monkey: "Monkey",
  snake: "Snake", lion: "Lion", frog: "Frog", bull: "Bull", rabbit: "Rabbit",
  bear: "Bear", rooster: "Rooster", turtle: "Turtle", whale: "Whale",
};
