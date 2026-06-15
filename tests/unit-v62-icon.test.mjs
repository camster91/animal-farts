// Unit tests for the v62 app-icon + manifest invariants. These
// are pure-IO tests that pin the public/ folder's contract: the
// SVG has the right dimensions, all 7 PNG sizes exist, the manifest
// matches v62 naming, and the description matches the v61 card-grid
// product (not the v46-era "tap circles, hold to hatch" copy).

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = new URL('../public/', import.meta.url).pathname;

function listPngsMatching(re) {
  return readdirSync(PUBLIC)
    .filter(f => f.endsWith('.png') && re.test(f));
}

function readText(p) {
  return readFileSync(p, 'utf8');
}

describe('v62 app icon — public/ assets', () => {
  it('favicon.svg exists and is well-formed XML', () => {
    const svg = readText(join(PUBLIC, 'favicon.svg'));
    assert.ok(svg.startsWith('<svg'), 'favicon.svg should start with <svg');
    assert.ok(svg.includes('</svg>'), 'favicon.svg should have closing tag');
    assert.ok(svg.includes('viewBox="0 0 512 512"'),
      'favicon.svg should have a 512x512 viewBox');
    // The v62 design: amber gradient + three puffs + motion lines +
    // 2x2 grid hint in the corner. Sanity-check the markers so a
    // future redesign doesn't quietly drop the v62 visual.
    assert.ok(svg.includes('pootbox-puff') || svg.includes('radialGradient') || svg.includes('ellipse'),
      'favicon.svg should still have the puff illustration');
  });

  it('icon-maskable.svg is a copy of favicon.svg (same content)', () => {
    const a = readText(join(PUBLIC, 'favicon.svg'));
    const b = readText(join(PUBLIC, 'icon-maskable.svg'));
    assert.strictEqual(a, b,
      'icon-maskable.svg should be identical to favicon.svg in v62');
  });

  it('all required PNG icon sizes are present', () => {
    const required = ['icon-192.png', 'icon-384.png', 'icon-512.png', 'icon-1024.png',
                     'icon-maskable-192.png', 'icon-maskable-512.png',
                     'apple-touch-icon.png'];
    for (const f of required) {
      const path = join(PUBLIC, f);
      assert.ok(existsSync(path), `${f} should exist`);
      const sz = statSync(path).size;
      assert.ok(sz > 200,
        `${f} should be a real PNG (size > 200 bytes), got ${sz}`);
    }
  });

  it('apple-touch-icon.png is 180x180', () => {
    // We can\'t easily read PNG dims without an image lib, but the
    // filename + the manifest + the HTML meta link expect 180x180.
    // Cheap heuristic: the file size of a 180x180 amber-gradient
    // icon is in the 8-30KB range (the v62 design with filters +
    // gradients + 4 shapes is larger than the v46 placeholder).
    const sz = statSync(join(PUBLIC, 'apple-touch-icon.png')).size;
    assert.ok(sz > 8000 && sz < 35000,
      `apple-touch-icon.png should be 8-35KB, got ${sz}`);
  });
});

describe('v62 manifest — public/manifest.webmanifest', () => {
  it('name and short_name are PootBox, not the v46 Poot Party', () => {
    const m = JSON.parse(readText(join(PUBLIC, 'manifest.webmanifest')));
    assert.strictEqual(m.name, '💨 PootBox',
      'manifest.name should be "💨 PootBox"');
    assert.strictEqual(m.short_name, 'PootBox',
      'manifest.short_name should be "PootBox"');
  });

  it('description matches the v61 card-grid product (no v46 copy)', () => {
    const m = JSON.parse(readText(join(PUBLIC, 'manifest.webmanifest')));
    // The v46 description was: "Make your own animal noises. 4
    // illustrated scenes, 48 tappable things, record your own."
    // v61+ is: "Tap an animal card to hear its sound. Change any
    // card's sound from a list or record your own."
    assert.ok(!m.description.includes('illustrated'),
      'description should not reference the v46 "illustrated scenes"');
    assert.ok(!m.description.includes('hatch'),
      'description should not reference the v46 "hold to hatch"');
    assert.ok(m.description.toLowerCase().includes('card') ||
              m.description.toLowerCase().includes('tap'),
      'description should describe the v61 card-grid flow');
  });

  it('no dead "Parent dashboard" shortcut', () => {
    // v47 had a /parent route that was removed in v53. The
    // manifest shortcut pointing at it was a v47 leftover. v62
    // should NOT have it.
    const m = JSON.parse(readText(join(PUBLIC, 'manifest.webmanifest')));
    const shortcutNames = (m.shortcuts || []).map(s => s.name);
    assert.ok(!shortcutNames.includes('Parent dashboard'),
      'manifest should not have a "Parent dashboard" shortcut (route removed in v53)');
    assert.ok(!shortcutNames.includes('Parents'),
      'manifest should not have a "Parents" shortcut');
  });

  it('icons array includes favicon.svg and the required PNGs', () => {
    const m = JSON.parse(readText(join(PUBLIC, 'manifest.webmanifest')));
    const sources = m.icons.map(i => i.src);
    assert.ok(sources.includes('/favicon.svg'),
      'manifest should reference /favicon.svg as an icon');
    assert.ok(sources.some(s => s.includes('192')),
      'manifest should reference a 192x192 icon');
    assert.ok(sources.some(s => s.includes('512')),
      'manifest should reference a 512x512 icon');
    // Maskable variants — Android adaptive icons
    const maskable = m.icons.filter(i => i.purpose === 'maskable');
    assert.ok(maskable.length >= 2,
      'manifest should have at least 2 maskable icons (192, 512)');
  });

  it('theme_color is amber, background_color is amber, categories are kids+entertainment', () => {
    const m = JSON.parse(readText(join(PUBLIC, 'manifest.webmanifest')));
    assert.strictEqual(m.theme_color, '#fbbf24',
      'theme_color should be the amber #fbbf24');
    assert.strictEqual(m.background_color, '#fbbf24');
    assert.ok(m.categories.includes('kids'),
      'categories should include "kids"');
    assert.ok(m.categories.includes('entertainment'),
      'categories should include "entertainment"');
  });
});

describe('v62 index.html — meta + icon link invariants', () => {
  it('description matches v61 (not v46 "Tap circles, hold to hatch")', () => {
    const html = readText(new URL('../index.html', import.meta.url).pathname);
    assert.ok(!html.includes('Tap circles, hold to hatch'),
      'description should not be the v46 copy');
    assert.ok(html.includes('Tap an animal card') || html.includes('card-grid'),
      'description should reference the v61 card grid');
  });

  it('apple-touch-icon link is absolute (not relative)', () => {
    const html = readText(new URL('../index.html', import.meta.url).pathname);
    // iOS ignores relative apple-touch-icon links. The link must
    // start with "/" (root-relative) or be a full URL.
    const m = html.match(/<link rel="apple-touch-icon"[^>]+href="([^"]+)"/);
    assert.ok(m, 'index.html should have an apple-touch-icon link');
    assert.ok(m[1].startsWith('/') || m[1].startsWith('http'),
      `apple-touch-icon href should be absolute, got: ${m[1]}`);
  });

  it('icon-512 link is absolute', () => {
    const html = readText(new URL('../index.html', import.meta.url).pathname);
    const m = html.match(/<link rel="icon"[^>]+sizes="512x512"[^>]+href="([^"]+)"/);
    assert.ok(m, 'index.html should have a 512x512 icon link');
    assert.ok(m[1].startsWith('/') || m[1].startsWith('http'),
      `icon-512 href should be absolute, got: ${m[1]}`);
  });

  it('manifest link is absolute', () => {
    const html = readText(new URL('../index.html', import.meta.url).pathname);
    const m = html.match(/<link rel="manifest"[^>]+href="([^"]+)"/);
    assert.ok(m, 'index.html should have a manifest link');
    assert.ok(m[1].startsWith('/') || m[1].startsWith('http'),
      `manifest href should be absolute, got: ${m[1]}`);
  });
});
