#!/usr/bin/env python3
"""Composite Poot Party store screenshots from existing scene JPEGs."""
from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors
GOLD      = (251, 191, 36)    # #fbbf24
CREAM     = (254, 243, 199)   # #fef3c7
CHARCOAL  = (31, 41, 55)      # #1f2937
SKY_BLUE  = (56, 189, 248)    # #38bdf8
WHITE     = (255, 255, 255)
PINK      = (253, 164, 175)   # #fda4af

# Scene JPEG base path
SCENES_DIR = '/Users/biancabienaime/projects/fart-animal-sounds/public/scenes'
OUT_DIR    = '/Users/biancabienaime/projects/fart-animal-sounds/public/store-assets/screenshots'

SCENES = [
  { 'name': 'farm',     'title': 'Farm',     'tagline': 'Moo! Baa! Oink!',           'feature': '12 barnyard sounds to tap' },
  { 'name': 'jungle',  'title': 'Jungle',   'tagline': 'Rawr! Screech! Trumpet!',    'feature': '12 wild jungle sounds' },
  { 'name': 'ocean',   'title': 'Ocean',    'tagline': 'Splash! Bubble! Whooo!',     'feature': '12 ocean sounds' },
  { 'name': 'city',    'title': 'City',     'tagline': 'Beep! Vroom! Honk!',         'feature': '12 city sounds' },
  { 'name': 'bedroom', 'title': 'Bedroom',   'tagline': 'Squeak! Rustle! Zzz!',       'feature': '12 bedroom sounds' },
  { 'name': 'bathroom','title': 'Bathroom', 'tagline': 'Flush! Drip! Squirt!',       'feature': '12 bathroom sounds' },
]

SIZES = [
  { 'label': 'iphone-65',      'w': 1290, 'h': 2796 },
  { 'label': 'iphone-55',      'w': 1242, 'h': 2208 },
  { 'label': 'ipad-pro',       'w': 2048, 'h': 2732 },
  { 'label': 'play-phone',     'w': 1080, 'h': 1920 },
]

def load_font(size, bold=False):
    """Try to load Fredoka, fall back to system sans."""
    font_paths = [
        ('/Users/biancabienaime/projects/fart-animal-sounds/public/fonts/Fredoka-Bold.ttf', True),
        ('/Users/biancabienaime/projects/fart-animal-sounds/public/fonts/Fredoka-Regular.ttf', False),
        ('/System/Library/Fonts/Arial Unicode.ttf', False),
    ]
    for fp, is_bold in font_paths:
        if os.path.exists(fp) and ('bold' in fp.lower()) == is_bold:
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()

def composite_screenshot(scene, size):
    w, h = size['w'], size['h']
    out = Image.new('RGB', (w, h), GOLD)

    # Load scene JPEG — fit to width, center vertically
    jpg_path = os.path.join(SCENES_DIR, f"{scene['name']}.jpg")
    scene_img = Image.open(jpg_path)
    jw, jh   = scene_img.size

    # Scene window: top30%..75% of screen (portrait crop of landscape scene)
    scene_top = int(h * 0.22)
    scene_bottom = int(h * 0.78)
    scene_h = scene_bottom - scene_top
    scene_w      = int(scene_h * jw / jh)
    if scene_w > w:
        scene_w = w
        scene_h = int(scene_w * jh / jw)
    scene_left = (w - scene_w) // 2

    # Resize scene to fit
    scene_scaled = scene_img.resize((scene_w, scene_h), Image.LANCZOS)

    # Rounded rect mask
    mask = Image.new('L', (scene_w, scene_h), 0)
    mask_draw = ImageDraw.Draw(mask)
    r = int(scene_h * 0.06)
    mask_draw.rounded_rectangle((0, 0, scene_w, scene_h), radius=r, fill=255)
    mask_scaled = mask.resize(scene_scaled.size, Image.LANCZOS)

    # Paste scene into output
    out.paste(scene_scaled, (scene_left, scene_top), mask_scaled)

    # ── Top overlay: title bar ──────────────────────────────────────────
    title_h = int(h * 0.16)
    title_grad = Image.new('RGBA', (w, title_h), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(title_grad)
    for y in range(title_h):
        alpha = int(180 * (1 - y / title_h))
        grad_draw.line([(0, y), (w, y)], fill=(30, 20, 0, alpha))
    out.paste(Image.alpha_composite(
        Image.new('RGBA', (w, title_h), (254, 243, 199, 200)),
        title_grad,
 ), (0, 0))

    # Title text
    title_font  = load_font(int(h * 0.055), bold=True)
    tagline_font = load_font(int(h * 0.028), bold=False)

    # 💨 emoji + "Poot Party" centered
    title_text  = f"💨  Poot Party"
    title_bbox = title_font.getbbox(title_text)
    title_x = (w - (title_bbox[2] - title_bbox[0])) // 2
    title_y = int(h * 0.025)
    ImageDraw.Draw(out).text((title_x, title_y), title_text, font=title_font, fill=CHARCOAL)

    # Tagline
    tag_bbox = tagline_font.getbbox(scene['tagline'])
    tag_x = (w - (tag_bbox[2] - tag_bbox[0])) // 2
    tag_y = title_y + int(h * 0.065)
    ImageDraw.Draw(out).text((tag_x, tag_y), scene['tagline'], font=tagline_font, fill=CHARCOAL)

    # ── Bottom overlay: feature bar ──────────────────────────────────────
    feat_h = int(h * 0.10)
    feat_y  = h - feat_h
    feat_grad = Image.new('RGBA', (w, feat_h), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(feat_grad)
    for y in range(feat_h):
        alpha = int(200 * (y / feat_h))
        fg_draw.line([(0, y), (w, y)], fill=(30, 20, 0, alpha))
    feat_bg = Image.alpha_composite(
        Image.new('RGBA', (w, feat_h), (*CREAM, 220)),
        feat_grad,
    )
    out.paste(feat_bg, (0, feat_y), feat_bg)

    # Feature text
    feat_font = load_font(int(h * 0.032), bold=True)
    feat_text = scene['feature']
    fb = feat_font.getbbox(feat_text)
    fx = (w - (fb[2] - fb[0])) // 2
    fy = feat_y + (feat_h - (fb[3] - fb[1])) // 2
    ImageDraw.Draw(out).text((fx, fy), feat_text, font=feat_font, fill=CHARCOAL)

    # Store badge (top-right corner)
    badge_text = '💨'
    badge_font = load_font(int(h * 0.05))
    badge_x = w - int(w * 0.12)
    badge_y = int(h * 0.03)
    ImageDraw.Draw(out).text((badge_x, badge_y), badge_text, font=badge_font, fill=WHITE)

    return out

os.makedirs(OUT_DIR, exist_ok=True)

for scene in SCENES:
    print(f"\nCompositing {scene['title']}...")
    for size in SIZES:
        img = composite_screenshot(scene, size)
        fname = f"{scene['name']}-{size['label']}.png"
        img.save(os.path.join(OUT_DIR, fname), 'PNG')
        print(f"  ✓ {fname} ({size['w']}x{size['h']})")

print('\nDone!')
