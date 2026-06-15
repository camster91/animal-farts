#!/usr/bin/env python3
"""Scan public/sounds/ and emit src/pootbox/constants.ts
with a BUILT_IN_SOUNDS array covering every .mp3 on disk.

Run before `vite build` (wired into the `build` npm script).
The scanner does:

  1. Walk public/sounds/ recursively
  2. For each .mp3, derive:
     - key:  file path slug, e.g. "farts/wet/001-3-fart-wet"
     - name: humanized file name, e.g. "Fart Wet"
     - emoji: by bucket + name keyword matching
     - bucket: "animal" | "instrument" | "silly" | "fart"
     - subBucket: empty | "bubbly" | "dry" | "echo" | "long" |
                 "squeaky" | "wet" (only set for farts)
     - file: "/sounds/{relative}"
  3. Sort: animals first, then instruments, then silly, then
     farts (alphabetic within each).
  4. Write src/pootbox/constants.ts with the BUILT_IN_SOUNDS
     array (preserving the rest of the file).

Emoji rules:
  - bucket "animal": emoji = the animal name's first emoji
    from a small map (cow, dog, cat, etc.). Falls back to 🐾.
  - bucket "instrument": emoji = 🎹/🎸/🥁/🔔/🎶/📯/🐝 based
    on file-name keyword.
  - bucket "silly": emoji = 💨/🤢/💋/💥/🎵/🔔 based on
    file-name keyword.
  - bucket "fart": emoji = 💨 by default; 💧 for wet,
    🫧 for bubbly, 🕳️ for echo, 💥 for the misc ones.

Run order: script runs at the start of the build. The rest
of the build picks up the freshly-written constants.ts.
Idempotent: re-running yields a stable diff (the file is
deterministically generated).
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOUNDS_DIR = ROOT / "public" / "sounds"
CONSTANTS = ROOT / "src" / "pootbox/constants.ts"

# Bucket categorization based on the file's parent directory.
# The directory layout is:
#   public/sounds/<name>.mp3                → top-level (animal)
#   public/sounds/extra/<name>.mp3           → also animal (the
#                                                 "extra/" dir
#                                                 contains misc
#                                                 animal sound
#                                                 bytes that
#                                                 were being
#                                                 used as
#                                                 instrument
#                                                 samples in
#                                                 v46; the file
#                                                 content is
#                                                 still animal
#                                                 audio, e.g.
#                                                 bee.mp3 is
#                                                 a bee sound)
#   public/sounds/farts/00x-<name>.mp3       → silly (these are
#                                                 non-fart misc
#                                                 sounds that
#                                                 happen to live
#                                                 in farts/)
#   public/sounds/farts/<sub>/<file>.mp3     → fart, sub=<sub>
#   public/sounds/v1/                        → ignored (legacy,
#                                                 duplicates of
#                                                 top-level)
def categorize(rel: Path) -> tuple[str, str]:
    parts = rel.parts
    if len(parts) == 1:
        # top-level .mp3
        return "animal", ""
    if parts[0] == "extra":
        return "animal", ""
    if parts[0] == "farts":
        if len(parts) == 2:
            # public/sounds/farts/00x-xyz.mp3 — flat-file silly
            return "silly", ""
        # public/sounds/farts/<sub>/<file>.mp3
        sub = parts[1]
        return "fart", sub
    if parts[0] == "v1":
        # legacy duplicates of top-level. Skip.
        return "", ""
    return "", ""


# Emoji lookup by name keyword (case-insensitive). First match
# wins. Order matters within each bucket.
ANIMAL_EMOJI = [
    ("cow", "🐄"),
    ("dog", "🐕"),
    ("cat", "🐈"),
    ("pig", "🐖"),
    ("duck", "🦆"),
    ("lion", "🦁"),
    ("frog", "🐸"),
    ("monkey", "🐒"),
    ("horse", "🐎"),
    ("elephant", "🐘"),
    ("rooster", "🐓"),
    ("bear", "🐻"),
    ("bird", "🐦"),
    ("bull", "🐂"),
    ("rabbit", "🐰"),
    ("snake", "🐍"),
    ("turtle", "🐢"),
    ("whale", "🐳"),
    ("bee", "🐝"),
    ("giraffe", "🦒"),
    ("goat", "🐐"),
    ("hippo", "🦛"),
    ("kangaroo", "🦘"),
    ("moose", "🦌"),
    ("owl", "🦉"),
    ("penguin", "🐧"),
    ("raccoon", "🦝"),
    ("rhino", "🦏"),
    ("seal", "🦭"),
    ("sheep", "🐑"),
    ("skunk", "🦨"),
    ("sloth", "🦥"),
    ("turkey", "🦃"),
    ("zebra", "🦓"),
    ("long", "🐾"),
]
INSTRUMENT_EMOJI = [
    ("piano", "🎹"),
    ("guitar", "🎸"),
    ("cymbal", "🟠"),
    ("horn", "📯"),
    ("flute", "🎶"),
    ("whistle", "🎵"),
    ("bell", "🔔"),
    ("bee", "🐝"),
    ("drum", "🥁"),
]
SILLY_EMOJI = [
    ("burp", "🤢"),
    ("kiss", "💋"),
    ("boom", "💥"),
    ("explosion", "💥"),
    ("toilet", "🚽"),
    ("groan", "😖"),
    ("whistle", "🎵"),
    ("bell", "🔔"),
]
FART_EMOJI = {
    "wet": "💧",
    "dry": "💨",
    "bubbly": "🫧",
    "squeaky": "🎈",
    "long": "🌀",
    "echo": "🕳️",
}


def pick_emoji(name: str, bucket: str) -> str:
    n = name.lower()
    if bucket == "animal":
        for kw, em in ANIMAL_EMOJI:
            if kw in n:
                return em
        return "🐾"
    if bucket == "instrument":
        for kw, em in INSTRUMENT_EMOJI:
            if kw in n:
                return em
        return "🎵"
    if bucket == "silly":
        for kw, em in SILLY_EMOJI:
            if kw in n:
                return em
        return "🎵"
    if bucket == "fart":
        # The name usually has the sub-bucket as a prefix word
        # e.g. "wet", "squeaky", "long". Look for the sub-bucket
        # keyword in the name.
        for kw, em in FART_EMOJI.items():
            if kw in n:
                return em
        return "💨"
    return "🔊"


# Strip the leading numeric prefix (e.g. "001-", "002-") and
# replace dashes/underscores with spaces. Title-case each
# word, but keep all-caps words like "DJ", "USA", "POOT" if
# they're already upper.
#
# We also strip the obvious "1fart" / "2fart" / "3fart" prefix
# tokens that appear in filenames like "001-3-fart-wet" or
# "004-fart-1477907970". Result for "001-3-fart-wet":
#   stem → "3 Fart Wet" (title-case)
#   strip leading digit-only word → "Fart Wet"
# Result for "004-fart-1477907970":
#   stem → "Fart 1477907970" (title-case)
#   strip "Fart 1477907970" because the suffix is all digits
#   → "Fart" (or empty)
# Result for "001-toilet-flush-clear-mike-koenig":
#   stem → "Toilet Flush Clear Mike Koenig"
#   (no stripping needed)
def humanize_name(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0]
    # Strip leading numeric prefix.
    stem = re.sub(r"^\d{2,4}-?", "", stem)
    # Replace separators with spaces.
    stem = stem.replace("-", " ").replace("_", " ")
    # Collapse whitespace.
    stem = re.sub(r"\s+", " ", stem).strip()
    # Title-case unless the word has a non-letter (e.g. "3-fart"
    # stays as "3-Fart") or the word is all-caps short.
    words = []
    for w in stem.split(" "):
        if not w:
            continue
        if any(c.isdigit() for c in w):
            words.append(w)
            continue
        if w.isupper() and len(w) <= 4:
            words.append(w)
            continue
        words.append(w[0].upper() + w[1:].lower())
    cleaned = " ".join(words) or "Sound"
    # If the name ends with a long digit string (filename
    # artifact like "1477907970"), drop it. These are
    # content-hash suffixes from the Freesound scraper.
    cleaned = re.sub(r"\s+\d{6,}$", "", cleaned)
    # Strip leading digit-only words (the "3" in
    # "3 Fart Wet").
    cleaned = re.sub(r"^\d+\s+", "", cleaned)
    return cleaned or "Sound"


# Build a unique key from the relative path. Same .mp3 in
# different subdirs gets a different key (so dedup works in
# BUILT_IN_SOUNDS). Underscores in the original filename are
# normalized to hyphens so the key is filesystem-safe and
# matches the regex used in unit-v70-sounds.test.mjs.
def make_key(rel: Path) -> str:
    parts = list(rel.parts)
    stem = parts[-1].rsplit(".", 1)[0]
    parts[-1] = stem
    return "-".join(parts).lower().replace(" ", "-").replace("_", "-")


# Stable key uniqueness: if the same key is generated twice
# (e.g. two files with the same name in different dirs), suffix
# with a counter.
def dedupe_keys(entries: list[dict]) -> list[dict]:
    seen: dict[str, int] = {}
    for e in entries:
        k = e["key"]
        if k in seen:
            seen[k] += 1
            e["key"] = f"{k}-{seen[k]}"
        else:
            seen[k] = 0
    return entries


# Order: animals alphabetic, then instruments, then silly,
# then farts (by subBucket alphabetic, then name alphabetic).
BUCKET_ORDER = {"animal": 0, "instrument": 1, "silly": 2, "fart": 3}


def sort_key(e: dict) -> tuple:
    return (
        BUCKET_ORDER.get(e["bucket"], 99),
        e["subBucket"],
        e["name"].lower(),
    )


def main() -> int:
    if not SOUNDS_DIR.exists():
        print(f"[scan-sounds] {SOUNDS_DIR} does not exist", file=sys.stderr)
        return 1

    # Walk and build entries
    entries: list[dict] = []
    for mp3 in sorted(SOUNDS_DIR.rglob("*.mp3")):
        rel = mp3.relative_to(SOUNDS_DIR)
        bucket, sub = categorize(rel)
        if not bucket:
            continue
        stem = mp3.stem
        name = humanize_name(stem)
        emoji = pick_emoji(name, bucket)
        # The .file path is /sounds/<rel-without-extension>.
        file_path = f"/sounds/{rel.as_posix()}"
        key = make_key(rel)
        entries.append({
            "key": key,
            "name": name,
            "emoji": emoji,
            "bucket": bucket,
            "subBucket": sub,
            "file": file_path,
        })

    entries = dedupe_keys(entries)
    entries.sort(key=sort_key)

    # Read the existing constants.ts to preserve the non-sound
    # constants. We replace only the BUILT_IN_SOUNDS block.
    src = CONSTANTS.read_text()

    # Find the BUILT_IN_SOUNDS block (start marker through the
    # closing `];` of the array).
    start_marker = "// --- Built-in sound library"
    end_marker = "];\n"
    start_idx = src.find(start_marker)
    if start_idx < 0:
        print(f"[scan-sounds] could not find '{start_marker}' in {CONSTANTS}", file=sys.stderr)
        return 1
    # Find the end of the array (the first `];` after start_idx
    # at column 0).
    end_idx = src.find(end_marker, start_idx)
    if end_idx < 0:
        print(f"[scan-sounds] could not find end of BUILT_IN_SOUNDS array", file=sys.stderr)
        return 1
    end_idx += len(end_marker)

    # Build the new block
    new_block_lines = [
        "// --- Built-in sound library (auto-generated by scripts/scan-sounds.py) ---",
        "// " + str(len(entries)) + " entries, scanned from public/sounds/ on " +
        # today
        "build.",
        "// Re-run the scanner to refresh after adding new files.",
        "",
        "export const BUILT_IN_SOUNDS: BuiltInSound[] = [",
    ]
    last_bucket = None
    last_sub = None
    for e in entries:
        # Section comments
        if e["bucket"] != last_bucket:
            new_block_lines.append(f"  // {e['bucket'].capitalize()}s ({len([x for x in entries if x['bucket'] == e['bucket']])})")
            last_bucket = e["bucket"]
            last_sub = None
        if e["subBucket"] and e["subBucket"] != last_sub:
            new_block_lines.append(f"  //   sub-bucket: {e['subBucket']}")
            last_sub = e["subBucket"]
        sub = f', subBucket: "{e["subBucket"]}"' if e["subBucket"] else ""
        new_block_lines.append(
            f'  {{ key: "{e["key"]}", emoji: "{e["emoji"]}", name: "{e["name"]}", '
            f'file: "{e["file"]}", bucket: "{e["bucket"]}"{sub} }},'
        )
    new_block_lines.append("];")
    new_block = "\n".join(new_block_lines) + "\n"

    # Splice: keep [0:start_idx] + new_block + [end_idx:]
    new_src = src[:start_idx] + new_block + src[end_idx:]
    CONSTANTS.write_text(new_src)

    # Print a one-liner summary
    bucket_counts: dict[str, int] = {}
    for e in entries:
        bucket_counts[e["bucket"]] = bucket_counts.get(e["bucket"], 0) + 1
    parts = ", ".join(f"{k}={v}" for k, v in sorted(bucket_counts.items()))
    print(f"[scan-sounds] wrote {len(entries)} entries to {CONSTANTS.relative_to(ROOT)} ({parts})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
