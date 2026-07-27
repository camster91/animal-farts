// kidSafeError.ts — map raw backend / HTTP errors to kid-friendly copy.
// Never surface stack traces, header names, or SQL/internal messages in the UI.

const EXACT: Record<string, string> = {
  "Handle taken": "That name is taken — try another!",
  "Handle too short": "Pick a longer username (at least 3 letters).",
  "Comment contains blocked words": "Oops — that comment has words we don't allow.",
  "Name or emoji contains blocked words": "Oops — that name isn't allowed.",
  "Display name contains blocked words": "Oops — that name isn't allowed.",
  "Bio contains blocked words": "Oops — that bio isn't allowed.",
  "Handle contains blocked words": "Oops — that username isn't allowed.",
  "Empty comment": "Type something first!",
  "Comment too long (max 280)": "That comment is a bit too long.",
  "Display name too long": "That name is a bit too long.",
  "Bio too long": "That bio is a bit too long.",
  "Not your recording": "You can only change your own sounds.",
  "Not your comment": "You can only delete your own comments.",
  "Not found": "We couldn't find that.",
  "Code not found": "That code wasn't found — double-check it!",
  "Invalid code format": "Codes are 4 or 8 letters and numbers.",
  "message is required": "Please write a short message first.",
};

const FALLBACK = "Something went wrong. Try again!";

export function kidSafeError(raw: unknown, fallback: string = FALLBACK): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return fallback;
  if (EXACT[s]) return EXACT[s];
  if (/blocked words/i.test(s)) return "Oops — that has words we don't allow.";
  if (/too long/i.test(s)) return "That's a bit too long — try a shorter one.";
  if (/too short/i.test(s)) return "That's a bit too short — try a longer one.";
  if (/rate limit|too many/i.test(s)) return "Whoa, slow down a second and try again!";
  if (/file too large/i.test(s)) return "That recording is too big. Try a shorter one!";
  if (/only audio/i.test(s) || /not a valid/i.test(s)) return "That file isn't a sound we can use.";
  if (/quota|limit.*recording/i.test(s)) return "You've saved lots of sounds! Delete an old one to add more.";
  // Hide internals / auth plumbing / HTTP codes
  if (/x-device-id|Missing|Invalid id|SQLITE|Internal|ECONN|stack|HTTP \d+/i.test(s)) {
    return fallback;
  }
  // Short, printable, already-friendly server messages
  if (s.length <= 72 && !/[<>{}]/.test(s) && !/\.(js|ts|sql)\b/i.test(s)) {
    return s;
  }
  return fallback;
}
