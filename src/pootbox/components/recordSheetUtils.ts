// 12 animal quick-pick emoji (same as default page)
export const QUICK_PICKS = ["🐄", "🐕", "🐈", "🐖", "🦆", "🦁", "🐸", "🐒", "🐎", "🐘", "🐓", "🐻"];

// 30+ random emoji — distinct from the 12 above
const RANDOM_POOL = [
  "🌈", "⭐", "🎈", "🎵", "🌟", "🐳", "🦄", "🍕", "🎪", "🐙", "🦋",
  "🌸", "🍦", "🎁", "🚀", "🌙", "🎨", "🎭", "🎬", "🎻", "🏖️", "🦜",
  "🐬", "🦩", "🐆", "🦔", "🦒", "🦦", "🐋", "🦈", "🪼",
];

export function pickRandomEmoji(exclude: string[] = []): string {
  const pool = RANDOM_POOL.filter(e => !exclude.includes(e));
  return pool[Math.floor(Math.random() * pool.length)];
}