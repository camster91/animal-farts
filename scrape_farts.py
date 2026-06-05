#!/usr/bin/env python3
"""
Fart Sound Scraper for MyInstants.com
Downloads 100+ unique fart MP3s with descriptive filenames.
"""

import os
import sys
import time
import random
import hashlib
import re
import json
from urllib.parse import urljoin, quote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import html.parser

WORK_DIR = "/Users/biancabienaime/projects/fart-animal-sounds/public/sounds/farts"
INDEX_FILE = os.path.join(WORK_DIR, "INDEX.txt")

# Rotating User-Agent strings to look like real browsers
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
]

# Flavor buckets with target counts
FLAVOR_BUCKETS = {
    "wet": {"count": 25, "keywords": ["wet", "squish", "squelsh", "squelch", "moist", "slimy"]},
    "dry": {"count": 20, "keywords": ["dry", "short", "quick", "brass", "sharp", "crisp"]},
    "long": {"count": 15, "keywords": ["long", "sustain", "extended", "duration", "prolong"]},
    "bubbly": {"count": 10, "keywords": ["bubble", "bubbly", "machine gun", "machine-gun", "pop", "gurgle"]},
    "squeaky": {"count": 10, "keywords": ["squeaky", "high pitch", "high-pitched", "mouse", "tiny"]},
    "echo": {"count": 10, "keywords": ["echo", "reverb", "hall", "cathedral", "cave", "room"]},
    "funny": {"count": 10, "keywords": ["funny", "dramatic", "meme", "weird", "strange", "tiktok", "donald duck"]},
}

# Search queries to try on MyInstants
SEARCH_QUERIES = [
    "fart",
    "wet fart",
    "dry fart", 
    "long fart",
    "squeaky fart",
    "fart with reverb",
    "fart echo",
    "bubble fart",
    "machine gun fart",
    "loud fart",
    "funny fart",
    "dramatic fart",
    "classic fart",
    "fart sound effect",
    "real fart",
    "big fart",
    "short fart",
    "fart with extra reverb",
    "toilet fart",
]

# In-memory state
seen_hashes = set()
downloaded = []  # list of (index, slug, url)
failed_urls = []
index_counter = 1


def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }


def fetch_url(url, timeout=15, retry=3):
    """Fetch a URL with rate limiting and stealth headers."""
    for attempt in range(retry):
        try:
            req = Request(url, headers=get_headers())
            response = urlopen(req, timeout=timeout)
            content = response.read()
            content_type = response.headers.get("Content-Type", "")
            return content, content_type
        except HTTPError as e:
            if e.code == 429:
                print(f"  [429] Rate limited, waiting 30s...")
                time.sleep(30)
            elif e.code in (403, 404):
                return None, f"HTTP {e.code}"
            else:
                print(f"  [HTTP {e.code}] {url}")
                if attempt < retry - 1:
                    time.sleep(2)
        except URLError as e:
            print(f"  [URL Error] {url}: {e}")
            if attempt < retry - 1:
                time.sleep(2)
        except Exception as e:
            print(f"  [Error] {url}: {e}")
            if attempt < retry - 1:
                time.sleep(2)
    return None, "failed"


def classify_flavors(name):
    """Return list of flavor tags for a sound based on its name."""
    name_lower = name.lower()
    matched = []
    for flavor, data in FLAVOR_BUCKETS.items():
        for kw in data["keywords"]:
            if kw in name_lower:
                matched.append(flavor)
                break
    return matched if matched else ["dry"]  # default to dry


def make_slug(name, flavor_hint=None):
    """Create a kebab-case slug from a sound name."""
    # Clean and simplify the name
    name = re.sub(r'[^\w\s-]', '', name.lower())
    name = re.sub(r'\s+', '-', name.strip())
    name = re.sub(r'-+', '-', name)
    # Remove common words that add no value
    stopwords = ['instant', 'sound', 'soundboard', 'sound-effect', 'sound-effect-button', 'mp3']
    parts = [p for p in name.split('-') if p not in stopwords and len(p) > 1]
    if not parts:
        parts = ['fart']
    slug = '-'.join(parts[:6])  # limit length
    if flavor_hint and flavor_hint not in slug:
        slug = f"{flavor_hint}-{slug}"
    return slug


def md5_of_data(data):
    return hashlib.md5(data).hexdigest()


def is_valid_mp3(data, path):
    """Check if data is a valid MP3 file of reasonable size."""
    if len(data) < 500:
        return False, "too small"
    if len(data) > 500 * 1024:
        return False, "too large"
    # Check for MP3 magic bytes
    if data[:3] == b'ID3':
        return True, "ok"
    if data[:2] in [b'\xff\xfb', b'\xff\xf3', b'\xff\xf2', b'\xff\xfa']:
        return True, "ok"
    return False, "not mp3"


def save_mp3(data, index, slug, url):
    """Save MP3 to disk if not duplicate."""
    global index_counter
    
    file_hash = md5_of_data(data)
    if file_hash in seen_hashes:
        print(f"  [SKIP] Duplicate MD5 for {slug}")
        return False
    
    seen_hashes.add(file_hash)
    
    filename = f"{index:03d}-{slug}.mp3"
    filepath = os.path.join(WORK_DIR, filename)
    
    with open(filepath, 'wb') as f:
        f.write(data)
    
    downloaded.append((index, slug, url))
    print(f"  [OK] {filename} ({len(data)} bytes)")
    return True


def extract_mp3_urls_from_search_page(html_content, base_url="https://www.myinstants.com"):
    """Extract MP3 URLs and names from a search results page HTML."""
    # MyInstants stores sound data in a JavaScript variable or data attributes
    # Look for patterns like: /media/sounds/filename.mp3
    mp3_urls = []
    
    # Pattern 1: Direct MP3 URLs in the page
    mp3_pattern = re.compile(r'["\'](/media/sounds/[^"\']+\.mp3)["\']')
    mp3_matches = mp3_pattern.findall(html_content)
    
    # Pattern 2: JSON data embedded in page
    json_pattern = re.compile(r'"soundUrl"\s*:\s*"([^"]+\.mp3)"')
    json_matches = json_pattern.findall(html_content)
    
    # Pattern 3: data attributes
    data_pattern = re.compile(r'data-sound-url="([^"]+\.mp3)"', re.IGNORECASE)
    data_matches = data_pattern.findall(html_content)
    
    all_urls = set()
    for m in mp3_matches + json_matches + data_matches:
        if m.startswith('/'):
            m = base_url + m
        all_urls.add(m)
    
    return list(all_urls)


def extract_sounds_from_page(html_content, base_url="https://www.myinstants.com"):
    """Extract sound entries (name, URL) from a MyInstants page."""
    sounds = []
    
    # Look for the JSON data that MyInstants embeds
    # Pattern: data contains "instant" objects with id, name, soundUrl, etc.
    json_pattern = re.compile(r'Instant\s*\(\s*(\{[^}]+\})', re.MULTILINE)
    json_matches = json_pattern.findall(html_content)
    
    # Try to find MP3 URLs directly  
    mp3_urls = extract_mp3_urls_from_search_page(html_content, base_url)
    
    # Look for sound page links and names
    link_pattern = re.compile(r'href="(/en/instant/[^"]+)"[^>]*>([^<]+)<')
    link_matches = link_pattern.findall(html_content)
    
    return mp3_urls, link_matches


def scrape_search_page(query, page=1):
    """Scrape a MyInstants search results page."""
    global index_counter
    
    if page == 1:
        url = f"https://www.myinstants.com/en/search/?name={quote(query)}"
    else:
        url = f"https://www.myinstants.com/en/search/?name={quote(query)}&page={page}"
    
    print(f"\n[SEARCH] '{query}' page {page}")
    html, ctype = fetch_url(url)
    
    if html is None:
        print(f"  [FAIL] Could not fetch search page")
        return [], False
    
    # Try to decode as text
    try:
        html_text = html.decode('utf-8', errors='replace')
    except:
        html_text = str(html)
    
    # Get MP3 URLs found on this page
    mp3_urls, link_matches = extract_sounds_from_page(html_text)
    
    print(f"  Found {len(mp3_urls)} MP3 URLs")
    
    # Download each MP3
    downloaded_this_page = 0
    for mp3_url in mp3_urls:
        if downloaded_this_page >= 5:  # limit per query to get variety
            break
        
        # Try to get the page that links to this MP3 to get the name
        sound_page_url = mp3_url.replace('/media/sounds/', '/en/instant/')
        # Try to guess name from URL
        name_from_url = mp3_url.split('/')[-1].replace('.mp3', '').replace('-', ' ')
        
        # Actually fetch the sound page for better metadata
        sound_html, _ = fetch_url(sound_page_url)
        name = name_from_url
        
        if sound_html:
            try:
                sound_text = sound_html.decode('utf-8', errors='replace')
            except:
                sound_text = str(sound_html)
            
            # Extract title from page
            title_match = re.search(r'<title>([^|]+)', sound_text)
            if title_match:
                name = title_match.group(1).strip()
            
            # Try to find MP3 URL on the page (to get the proper URL)
            page_mp3s = extract_mp3_urls_from_search_page(sound_text)
            if page_mp3s:
                mp3_url = page_mp3s[0]
        
        # Classify the sound
        flavors = classify_flavors(name)
        flavor_hint = flavors[0] if flavors else "fart"
        
        # Make slug
        slug = make_slug(name, flavor_hint)
        
        # Add index prefix to ensure uniqueness in final filename
        index_suffix = index_counter
        
        # Download the MP3
        print(f"  [DOWN] {mp3_url}")
        data, ctype = fetch_url(mp3_url)
        
        if data:
            valid, reason = is_valid_mp3(data, mp3_url)
            if valid:
                if save_mp3(data, index_counter, slug, sound_page_url if 'myinstants.com' in sound_page_url else mp3_url):
                    index_counter += 1
                    downloaded_this_page += 1
                    time.sleep(0.5)  # rate limit
            else:
                print(f"    [INVALID] {reason}")
        else:
            print(f"    [FAIL] Could not download")
        
        time.sleep(0.5)
    
    has_more = len(mp3_urls) >= 5
    return mp3_urls, has_more


def main():
    global index_counter
    
    print("=" * 60)
    print("Fart Sound Scraper - MyInstants Edition")
    print("=" * 60)
    
    os.makedirs(WORK_DIR, exist_ok=True)
    
    total_needed = 100
    target_per_flavor = {k: v["count"] for k, v in FLAVOR_BUCKETS.items()}
    
    collected_by_flavor = {k: 0 for k in FLAVOR_BUCKETS}
    
    # Track which queries we've exhausted
    query_pages_tried = {}
    
    for query in SEARCH_QUERIES:
        if index_counter > total_needed + 20:  # get a few extras
            break
        
        pages_tried = query_pages_tried.get(query, 0)
        has_more = True
        
        while has_more and pages_tried < 3 and index_counter <= total_needed + 30:
            mp3_urls, more = scrape_search_page(query, page=pages_tried + 1)
            pages_tried += 1
            query_pages_tried[query] = pages_tried
            has_more = more and len(mp3_urls) > 0
            
            if not mp3_urls:
                break
            
            time.sleep(1)  # pause between pages
        
        time.sleep(0.5)
    
    # Now try direct sound page URLs we know about
    known_sounds = [
        ("fart", "https://www.myinstants.com/en/instant/fart/"),
        ("fart-meme-sound", "https://www.myinstants.com/en/instant/fart-meme-sound-46799/"),
        ("long-brain-fart", "https://www.myinstants.com/en/instant/long-brain-fart-60967/"),
        ("fart-button", "https://www.myinstants.com/en/instant/fart-button/"),
        ("fart-with-reverb", "https://www.myinstants.com/en/instant/fart-with-reverb-17715/"),
        ("fart-with-extra-reverb", "https://www.myinstants.com/en/instant/fart-with-extra-reverb-63068/"),
        ("tiktok-fart-sound", "https://www.myinstants.com/en/instant/tiktok-fart-sound-63644/"),
        ("fart-meme-sound-better", "https://www.myinstants.com/en/instant/fart-meme-sound-better-and-louder-32265/"),
        ("dramatic-fart", "https://www.myinstants.com/en/instant/dramatic-fart-28417/"),
        ("classic-fart-sound", "https://www.myinstants.com/en/instant/classic-fart-sound-39129/"),
        ("loud-fart", "https://www.myinstants.com/en/instant/loud-fart/"),
        ("dramatic-fart-sound", "https://www.myinstants.com/en/instant/dramatic-fart-sound-3168/"),
    ]
    
    print("\n[DIRECT] Scraping known sound pages...")
    for slug, url in known_sounds:
        if index_counter > total_needed + 10:
            break
        
        print(f"\n[DIRECT] {slug}")
        html, ctype = fetch_url(url)
        
        if html is None:
            print(f"  [FAIL] Could not fetch")
            continue
        
        try:
            text = html.decode('utf-8', errors='replace')
        except:
            text = str(html)
        
        mp3_urls = extract_mp3_urls_from_search_page(text)
        
        if mp3_urls:
            mp3_url = mp3_urls[0]
            print(f"  [MP3] {mp3_url}")
            
            data, _ = fetch_url(mp3_url)
            if data:
                valid, reason = is_valid_mp3(data, mp3_url)
                if valid:
                    save_mp3(data, index_counter, slug, url)
                    index_counter += 1
                else:
                    print(f"  [INVALID] {reason}")
        
        time.sleep(0.5)
    
    # Write INDEX.txt
    print(f"\n[INDEX] Writing {len(downloaded)} entries to {INDEX_FILE}")
    with open(INDEX_FILE, 'w') as f:
        for idx, slug, url in downloaded:
            f.write(f"{idx:03d}\t{slug}\t{url}\n")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total downloaded: {len(downloaded)}")
    print(f"Failed URLs: {len(failed_urls)}")
    
    if downloaded:
        sizes = [os.path.getsize(os.path.join(WORK_DIR, f"{idx:03d}-{slug}.mp3")) 
                 for idx, slug, _ in downloaded]
        print(f"Size range: {min(sizes)/1024:.1f}KB - {max(sizes)/1024:.1f}KB")
        print(f"Average size: {sum(sizes)/len(sizes)/1024:.1f}KB")


if __name__ == "__main__":
    main()