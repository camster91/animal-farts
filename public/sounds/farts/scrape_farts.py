#!/usr/bin/env python3
"""
Emoji Farts — Fart Sound Scraper + Synthesizer
Phase 1: Download from SoundBible (direct MP3, no JS needed)
Phase 2: Synthesize unique fart sounds using scipy (wave generation + ffmpeg encode)
Target: 100+ unique MP3s, all validated, descriptive filenames.
"""

import os
import re
import sys
import time
import random
import hashlib
import tempfile
import subprocess
import shutil
import urllib.request
import urllib.error
from collections import defaultdict

try:
    import numpy as np
    import scipy.io.wavfile as wavfile
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# ── Config ────────────────────────────────────────────────────────────────────
OUTPUT_DIR = "/Users/biancabienaime/projects/fart-animal-sounds/public/sounds/farts"
INDEX_FILE = os.path.join(OUTPUT_DIR, "INDEX.txt")

SOUNDBIBLE_TAGS = "https://soundbible.com/tags-fart.html"
SOUNDBIBLE_MP3  = "https://soundbible.com/mp3/"

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
]

# Flavor categories for synthesized sounds
FLAVORS = {
    "wet":      ["wet-squelch", "wet-splat", "wet-juicy", "wet-sloppy", "wet-mushy",
 "wet-squishy", "wet-dribble", "wet-gush", "wet-muddy", "wet-gooey"],
    "dry":      ["dry-pop", "dry-snaps", "dry-quick", "dry-short", "dry-crack",
                  "dry-tiny", "dry-micro", "dry-blast", "dry-pff", "dry-pffft"],
    "long":     ["long-sustained", "long-drawn-out", "long-slow", "long-airy",
                  "long-drone", "long-wind", "long-whoosh", "long-heavy", "long-deep", "long-growl"],
    "bubbly":   ["bubbly-rapid", "bubbly-machine-gun", "bubbly-brrt", "bubbly-popcorn",
                  "bubbly-tiny-bursts", "bubbly-chainped", "bubbly-staccato", "bubbly-rattle"],
    "squeaky":  ["squeaky-high", "squeaky-pitch", "squeaky-tight", "squeaky-peep",
                  "squeaky-squeal", "squeaky-whistle", "squeaky-reed", "squeaky-nose"],
    "echo":     ["echo-cathedral", "echo-reverb", "echo-hall", "echo-bathroom",
                  "echo-tunnel", "echo-distant", "echo-cave", "echo-room"],
    "reverb":   ["reverb-funny", "reverb-distant", "reverb-muffled", "reverb-underwater",
                  "reverb-faraway", "reverb-muffled-echo", "reverb-deep-hole"],
}

# State
seen_md5       = set()
seen_urls      = set()
seen_slugs     = set()
index_entries  = []
file_count     = 0
ua_index       = 0
flavor_counts  = defaultdict(int)

# ── Helpers ───────────────────────────────────────────────────────────────────
def get_ua():
    global ua_index
    ua = USER_AGENTS[ua_index % len(USER_AGENTS)]
    ua_index += 1
    return ua

def md5_of(data):
    return hashlib.md5(data).hexdigest()

def random_delay():
    time.sleep(random.uniform(0.3, 1.0))

def validate_mp3(data):
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.write(data)
    tmp.close()
    try:
        result = subprocess.run(
            ["file", "--mime-type", tmp.name],
            capture_output=True, text=True, timeout=5)
        mime = result.stdout.strip().split(":")[-1].strip()
        return "audio/mpeg" in mime or "audio/mp3" in mime
    except Exception:
        return False
    finally:
        os.unlink(tmp.name)

def save_mp3(data, slug, flavor, source_url):
    global file_count, seen_md5, seen_urls, index_entries

    digest = md5_of(data)
    if digest in seen_md5:
        return False

    if not validate_mp3(data):
        return False

    file_count += 1
    nn = f"{file_count:03d}"
    filename = f"{nn}-{slug}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(data)

    seen_md5.add(digest)
    seen_urls.add(source_url)
    index_entries.append((filename, slug, flavor, source_url))

    size_kb = len(data) / 1024
    print(f"    ✓ {filename} ({size_kb:.1f}KB)")
    return True

def download_one(url):
    global seen_urls
    if url in seen_urls:
        return None

    headers = {
        "User-Agent": get_ua(),
        "Referer": url.rsplit("/", 1)[0] + "/",
        "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            size = len(data)
    except Exception as e:
        print(f"    [fail] {e}")
        return None

    if size < 500 or size > 2_500_000:
        print(f"    [size reject] {size}B")
        return None

    return data

# ── Phase 1: SoundBible ────────────────────────────────────────────────────────
def scrape_soundbible():
    print("\n[*] Scraping SoundBible tag page…")
    req = urllib.request.Request(
        SOUNDBIBLE_TAGS,
        headers={"User-Agent": get_ua(), "Accept-Language": "en-US,en;q=0.9"}
    )
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [fail] {e}")
        return []

    pattern = re.compile(r'data-source="mp3/([^"]+\.mp3)"')
    filenames = pattern.findall(html)
    urls = [SOUNDBIBLE_MP3 + f for f in filenames]
    print(f"  found {len(urls)} MP3 references")
    return urls

def guess_flavor(slug):
    slug_lower = slug.lower()
    for kw in ["wet", "squish", "splat", "juicy", "sloppy", "gooey", "mushy"]:
        if kw in slug_lower:
            return "wet"
    for kw in ["long", "sustained", "drawn", "drone", "heavy"]:
        if kw in slug_lower:
            return "long"
    for kw in ["bubbly", "machine", "brrt", "rapid", "popcorn", "rattle"]:
        if kw in slug_lower:
            return "bubbly"
    for kw in ["squeaky", "peep", "whistle", "reed"]:
        if kw in slug_lower:
            return "squeaky"
    for kw in ["echo", "cathedral", "hall", "bathroom", "tunnel", "cave"]:
        if kw in slug_lower:
            return "echo"
    for kw in ["reverb", "distant", "muffled", "underwater", "faraway"]:
        if kw in slug_lower:
            return "reverb"
    return "dry"

def make_slug_from_url(url):
    fname = url.split("/")[-1]
    name = fname.replace(".mp3", "").replace("-SoundBible.com-", " ").replace("_", " ").replace("-", " ")
    slug = re.sub(r"[^\w\s-]", "", name).strip().lower()
    slug = re.sub(r"[\s]+", "-", slug)[:50]
    # Preserve "fart" in slug — the sound name contains it for indexing purposes
    if "fart" in name.lower() and "fart" not in slug:
        slug = slug + "-fart"
    return slug

def ensure_unique_slug(slug, url):
    """Return a unique slug by appending a short hash if needed."""
    global seen_slugs
    if slug not in seen_slugs:
        seen_slugs.add(slug)
        return slug
    # Slug collision — append a short suffix
    short_hash = hashlib.md5(url.encode()).hexdigest()[:6]
    slug = f"{slug}-{short_hash}"
    seen_slugs.add(slug)
    return slug

# ── Phase 2: Synthesize fart sounds ───────────────────────────────────────────
def synthesize_fart(slug, flavor, duration=1.0, sample_rate=44100):
    """
    Generate a fart-like sound using numpy/scipy.
    Returns raw PCM data as numpy array (int16).
    """
    n = int(duration * sample_rate)
    t = np.linspace(0, duration, n, dtype=np.float64)

    if flavor == "dry":
        # Short, sharp pop: fundamental +2nd harmonic, quick decay
        f0 = random.uniform(90, 140)
        env = np.exp(-t * random.uniform(12, 20))
        wave = env * (np.sin(2 * np.pi * f0 * t) +
                      0.4 * np.sin(2 * np.pi * f0 * 2 * t) +
                      0.1 * np.sin(2 * np.pi * f0 * 3 * t))
        wave = wave * 0.85

    elif flavor == "wet":
        # Wet/squishy: low freq + bandlimited noise, slow decay
        f0 = random.uniform(60, 110)
        env = np.exp(-t * random.uniform(3, 6))
        noise = np.random.randn(n) * 0.3
        # Low-pass filter the noise
        from scipy.signal import butter, filtfilt
        b, a = butter(4,200 / (sample_rate / 2), btype='low')
        noise_lp = filtfilt(b, a, noise)
        wave = env * (0.7 * np.sin(2 * np.pi * f0 * t) +
                      0.3 * np.sin(2 * np.pi * f0 * 2 * t) +
                      0.2 * noise_lp)
        wave = wave * 0.8

    elif flavor == "long":
        # Long sustained: slow attack, steady sustain, slow decay
        f0 = random.uniform(70, 120)
        attack = random.uniform(0.05, 0.2)
        decay = random.uniform(1.5, 3.0)
        env = np.ones(n)
        attack_n = min(int(attack * sample_rate), n)
        decay_n  = min(int(decay  * sample_rate), n)
        env[:attack_n] = np.linspace(0, 1, attack_n)
        env[-decay_n:] = np.linspace(1, 0, decay_n)
        wave = env * (np.sin(2 * np.pi * f0 * t) +
                      0.3 * np.sin(2 * np.pi * f0 * 2 * t) +
                      0.1 * np.sin(2 * np.pi * f0 * 0.5 * t))
        wave = wave * 0.8

    elif flavor == "bubbly":
        # Machine-gun / rapid bubbly: series of short pops
        wave = np.zeros(n)
        n_pops = random.randint(4, 12)
        for _ in range(n_pops):
            pop_start = random.randint(int(0.05 * n), int(0.85 * n))
            pop_dur   = random.randint(int(0.01 * n), int(0.04 * n))
            pop_f0    = random.uniform(100, 200)
            pop_env   = np.exp(-np.linspace(0, 1, pop_dur) * 15)
            pop_t = np.linspace(0, 1, pop_dur)
            pop_wave  = pop_env * (np.sin(2 * np.pi * pop_f0 * pop_t) +
                                   0.3 * np.sin(2 * np.pi * pop_f0 * 2 * pop_t))
            end = min(pop_start + pop_dur, n)
            wave[pop_start:end] += pop_wave[:end - pop_start]
        wave = wave * 0.75

    elif flavor == "squeaky":
        # High-pitched squeaky: high fundamental, sharp
        f0 = random.uniform(400, 900)
        env = np.exp(-t * random.uniform(15, 25))
        wave = env * (np.sin(2 * np.pi * f0 * t) +
                      0.2 * np.sin(2 * np.pi * f0 * 2 * t))
        wave = wave * 0.7

    elif flavor == "echo":
        # Echo/reverb: long decay with multiple reflections
        f0 = random.uniform(80, 130)
        env = np.exp(-t * 2.5)
        base = env * np.sin(2 * np.pi * f0 * t)
        # Add delayed copies for echo
        delays = [0.15, 0.3, 0.55, 0.9, 1.4]
        amps = [1.0,  0.6,  0.35, 0.2, 0.1]
        wave = base.copy()
        for d, a in zip(delays, amps):
            d_samp = min(int(d * sample_rate), n)
            if d_samp < n:
                chunk = base[:n - d_samp] * a
                wave[d_samp:] += chunk[:n - d_samp]
        wave = wave * 0.75

    elif flavor == "reverb":
        # Funny/distant: heavily filtered, muffled, very reverb
        f0 = random.uniform(60, 100)
        env = np.exp(-t * 1.5)
        from scipy.signal import butter, filtfilt
        base = env * np.sin(2 * np.pi * f0 * t)
        b, a = butter(3, 300 / (sample_rate / 2), btype='low')
        wave = filtfilt(b, a, base)
        # Add hall-like reverb
        delays = [0.2, 0.5, 1.0, 1.8]
        amps = [0.5, 0.3, 0.15, 0.08]
        for d, a in zip(delays, amps):
            d_samp = min(int(d * sample_rate), n)
            if d_samp < n:
                chunk = wave[:n - d_samp] * a
                wave[d_samp:] += chunk[:n - d_samp]
        wave = wave * 0.7

    else:
        # Fallback: generic low-frequency pop
        f0 = random.uniform(80, 130)
        env = np.exp(-t * 10)
        wave = env * np.sin(2 * np.pi * f0 * t) * 0.8

    # Normalize
    peak = np.abs(wave).max()
    if peak > 0:
        wave = wave / peak * 0.92

    return (wave * 32767).astype(np.int16)

def synthesize_and_save(slug, flavor, duration=1.0):
    """Synthesize a fart sound and save as MP3 via ffmpeg."""
    global file_count, seen_md5, index_entries

    # Generate WAV
    samples = synthesize_fart(slug, flavor, duration=duration)

    # Write temp WAV
    tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    wavfile.write(tmp_wav.name, 44100, samples)
    tmp_wav.close()

    # Encode to MP3 via ffmpeg
    tmp_mp3 = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp_mp3.close()
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_wav.name,
 "-codec:a", "libmp3lame", "-b:a", "128k",
             "-q:a", "2", tmp_mp3.name],
            capture_output=True, timeout=30, check=True
        )
        with open(tmp_mp3.name, "rb") as f:
            data = f.read()
    except Exception as e:
        print(f"    [ffmpeg fail] {e}")
        return False
    finally:
        os.unlink(tmp_wav.name)
        os.unlink(tmp_mp3.name)

    if len(data) < 500:
        return False

    slug = ensure_unique_slug(slug, "synthesized")
    digest = md5_of(data)
    if digest in seen_md5:
        return False

    file_count += 1
    nn = f"{file_count:03d}"
    filename = f"{nn}-{slug}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(data)

    seen_md5.add(digest)
    index_entries.append((filename, slug, flavor, "synthesized"))

    size_kb = len(data) / 1024
    print(f"    ✓ {filename} ({size_kb:.1f}KB)")
    return True

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    global file_count, flavor_counts

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("Emoji Farts — Fart Sound Scraper + Synthesizer")
    print("=" * 60)

    # ── Phase 1: Download from SoundBible ────────────────────────────────────
    sound_urls = scrape_soundbible()
    sound_urls = list(set(sound_urls))

    downloaded = 0
    for url in sound_urls:
        if file_count >= 120:
            break
        random_delay()
        data = download_one(url)
        if data is None:
            continue
        slug = make_slug_from_url(url)
        slug = ensure_unique_slug(slug, url)
        flavor = guess_flavor(slug)
        if save_mp3(data, slug, flavor, url):
            downloaded += 1
            flavor_counts[flavor] += 1

    print(f"\n[*] SoundBible phase done: {downloaded} files saved")

    # ── Phase 2: Synthesize to fill remaining slots ───────────────────────────
    target = 100
    needed = max(0, target - file_count)
    print(f"\n[*] Synthesizing {needed} more sounds to reach {target}…")

    if not HAS_SCIPY:
        print("[!] scipy not available — skipping synthesis")
        needed = 0

    # Build a list of (slug, flavor, duration) for synthesis
    synth_items = []
    for flavor, slugs in FLAVORS.items():
        for slug in slugs:
            if flavor == "long":
                duration = random.uniform(2.0, 4.0)
            elif flavor == "bubbly":
                duration = random.uniform(0.8, 1.5)
            elif flavor == "squeaky":
                duration = random.uniform(0.15, 0.4)
            elif flavor == "echo":
                duration = random.uniform(2.0, 4.0)
            elif flavor == "reverb":
                duration = random.uniform(1.5, 3.5)
            elif flavor == "wet":
                duration = random.uniform(0.8, 2.0)
            else:
                duration = random.uniform(0.2, 0.6)
            synth_items.append((slug, flavor, duration))

    random.shuffle(synth_items)

    for slug, flavor, duration in synth_items:
        if file_count >= target + 10:
            break
        if synthesize_and_save(slug, flavor, duration=duration):
            flavor_counts[flavor] += 1

    # ── Write INDEX.txt ───────────────────────────────────────────────────────
    print(f"\n[*] Writing INDEX.txt ({len(index_entries)} entries)…")
    with open(INDEX_FILE, "w") as idx:
        for filename, slug, flavor, source_url in index_entries:
            idx.write(f"{filename}\t{flavor}\t{source_url}\n")

    # ── Summary ───────────────────────────────────────────────────────────────
    mp3s = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".mp3")]
    total_bytes = sum(os.path.getsize(os.path.join(OUTPUT_DIR, f)) for f in mp3s)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  MP3 files saved : {len(mp3s)}")
    print(f"  Total size     : {total_bytes / 1024 / 1024:.2f} MB")
    print("\n  Flavor breakdown:")
    for flv, cnt in sorted(flavor_counts.items()):
        print(f"    {flv:<16}: {cnt}")
    print("\n  Sample files:")
    for f in sorted(mp3s)[:10]:
        sz = os.path.getsize(os.path.join(OUTPUT_DIR, f))
        print(f"    {f} ({sz/1024:.1f}KB)")

if __name__ == "__main__":
    main()
