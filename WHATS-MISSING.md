# Current gaps — Animal Farts / PootBox

Updated 2026-08-11. This file supersedes the June 13, 2026 gap review, which described the app before the Friends / Me social surfaces and production-hardening work landed.

## Current product state

The app now has three top-level experiences: **Play**, **Friends**, and **Me**, plus public profiles opened from the Friends feed. Custom recordings, share codes, server-backed social APIs, offline PWA behavior, Android/Capacitor packaging, moderation, rate limiting, upload validation, and device-scoped write authorization are all implemented.

The old statement that "the social app exists on the server and nowhere else" is no longer true. Historical review documents should be treated as point-in-time references, not implementation instructions.

## Release priorities

### 1. Finish the July audit cleanup

The remaining audit work is intentionally small and release-focused:

- Accessible labels for Sound Library search, share-code lookup, and volume controls.
- Route-level code splitting for Play / Friends / profile surfaces to reduce mobile cold-start parsing.
- TypeScript strict mode across app, Node config, and test compilation.

These are being handled together in `chore/complete-open-audit-2026-08-11` and should only be considered complete after CI passes.

### 2. Keep the core play loop dominant

Animal Farts works best when the first interaction is immediate: open the app, tap a funny sound, hear it. Social/profile features should remain secondary and must not increase cold-start cost or make Play harder to reach.

### 3. Treat social features as a child-safety surface

Because the product is aimed at young children, any public sharing, profiles, comments, reactions, following, search, or discovery must be reviewed as a safety/privacy feature rather than ordinary social-app functionality. Prefer controlled sharing and family/friend codes over broader discovery when the same product goal can be met.

Before expanding the social surface, require an explicit product decision covering:

- who can discover whom;
- what information is public;
- whether comments are necessary at all;
- parent/guardian controls and reporting;
- retention/deletion of recordings and profile data;
- moderation and abuse-response expectations.

### 4. Reduce `PootBox.tsx` opportunistically, not via a risky rewrite

`PootBox.tsx` is still the main orchestration pressure point. Future feature work should extract cohesive concerns (modal coordination, sharing, recording orchestration, page state, audio/play state) into focused hooks/components as those areas are touched. Avoid a large refactor solely for line-count reduction unless tests and behavior coverage are expanded first.

### 5. Keep documentation and CI authoritative

When architecture or product surfaces change, update `README.md`, `AGENTS.md`, and this file in the same PR. Historical review files should be clearly dated. CI should run lint, tests, production build, and server syntax checks before merge.

## Definition of release-ready

A release candidate should have:

- CI green on the exact commit being merged;
- no unresolved Critical/High security findings;
- no known broken Play, recording, sharing, offline, Friends, or profile flows;
- accessible names for interactive controls;
- Android/PWA smoke testing for audio, microphone permission, offline reload, and bottom safe-area behavior;
- a documented decision before any meaningful expansion of public social/discovery features.
