# Poot Party v31 — Ship-readiness polish

## Why v31

Getting the web app to ship-ready for 1000 users and generating the App Store / Play Store screenshot assets needed to submit the native wrappers.

## Priority for v31 (in order)

1. **Band chain fix** — "🎵 Band!" banner is broken (doesn't show after 3 rapid taps). Real bug, blocks play experience.
2. **App Store / Play Store screenshots** — Without these we can't submit to either store. Need 6× iPhone 6.5" + 5.5" + iPad 12.9" in `public/store-assets/screenshots/`.
3. **Privacy policy at /privacy.html** — Required for App Store compliance. Must be linked from /parent.
4. **"Report a problem" in /parent** — Opens a modal, POSTs to /api/feedback. Gives parents a channel; collects structured feedback ahead of public launch.
5. **App version + "what's new" toast** — Version visible in /parent. "What's new" toast shows once on version change after first install.

## What we're NOT building in v31

- Real Stripe integration (6 env vars still pending from Cam)
- iOS device test (needs Cam's real iPhone)
- Social / share recordings with playback
- Cross-device sync
- i18n

## Success criteria for v31

- [ ] Band chain banner actually appears after 3 rapid taps (verify on real device)
- [ ] /parent has a "Report a problem" link → opens modal → POSTs to /api/feedback
- [ ] App version (1.0.0) is visible in /parent
- [ ] "What's new" toast shows on version change (after first install)
- [ ] Privacy policy is at /privacy.html and linked from /parent
- [ ] 6 iPhone 6.5" screenshots exist in public/store-assets/screenshots/
- [ ] 5.5" iPhone and iPad 12.9" screenshots also exist
- [ ] No console errors on any flow
- [ ] Bundle ≤ 285KB JS

## Open questions for Cam

1. Privacy policy email: should it be privacy@ashbi.ca or something else?
2. App Store name: "Poot Party!" or "PootParty" or "Poot Party - Animal Sounds"?
3. Should /parent PIN default to 1234 on first setup, or require the parent to set it explicitly?
4. Should we add a "delete all data" option in /parent for COPPA "right to be forgotten"?