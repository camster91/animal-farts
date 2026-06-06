# v26 — Poot Party

## Brand
- **Name:** Poot Party
- **Mascot:** Smiling 💨 (the cloud emoji with eyes)
- **Color:** Gold #fbbf24 (the 💨 color) + sky blue + cream
- **Tagline:** "Make your own animal noises."

## Kid's screen (1 screen, no nav, no tabs, no settings)

**Core action:** the kid makes pins. Tap a default thing = play its sound. Long-press = record over it. Tap empty area = drop a new pin.

**Things (12 per scene):** each is positioned in the scene (x%, y%), big emoji (80-100px), tap target ≥ 44px, has 2-4 default sounds from the 388 pool.

**Recording:** long-press a thing → red pulse → record → release → thing now plays your sound. Recording cap: 3s.

**Pin drop:** tap an empty area of the scene → 💨 cloud appears → tap to record → place in scene. Sticks around.

**Floating 💨 button:** quick "drop a new pin here" — drops a cloud in the center.

**Scenes:** 4 hand-curated (Farm, Jungle, Ocean, Home). Swipe left/right.

## Operator (/parent)

5 cards in 2x2 grid: Recordings, Quiet hours, Profiles, Library, About.

## Free / Premium

**Free:** all 4 scenes, all 388 sounds, 1 profile, basic quiet hours, unlimited kid recordings.
**Premium ($14.99/yr):** 3 profiles, custom sound upload, per-profile limit, FX customization, featured sounds, priority support.

## Build

- v26a: brand + structure + 1-scene kid screen
- v26b: recording + pins + multi-sound
- v26c: 4 scenes + /parent + premium

## Removed from v25w2

- 4-tab bottom nav
- MySoundsPage, ExplorePage, ProfilePage
- 3 of 4 auto-generated catalogs (cluster, sound, soundPool — kept soundPool)
- Filter chips
- Adult mode, FX controls on kid screen
- Recording button, Stop button, Random button
- Server, profiles, API code
- Most of the current 245KB bundle
