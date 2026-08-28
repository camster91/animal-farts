# PootBox v1 child-safety and privacy boundary

Status: approved implementation default for v1, 2026-08-28.

## Decision

PootBox v1 ships as a sound toy with controlled, possession-based sharing. It does not ship public discovery or a social network.

Enabled by default:

- built-in sound play and offline PWA use;
- local microphone recording after an explicit user action;
- server upload for recording durability, limited to 40 recordings per device;
- owner-authorized deletion using the device identifier;
- eight-character share codes that expire after 30 days.

Disabled by default:

- Friends feed and public recording directory;
- public profiles and user discovery;
- follows, follower/following lists, and public profile recordings;
- upvotes, emoji reactions, and comments.

The dormant social implementation may only be enabled in a controlled test environment with both `VITE_SOCIAL_FEATURES_ENABLED=true` at frontend build time and `SOCIAL_FEATURES_ENABLED=1` at server runtime. Production images default the server flag to `0`; ordinary frontend builds omit the social navigation and actions.

## Data flow

| Data | Source | Local storage | Server storage or logging | Disclosure | Retention and deletion |
| --- | --- | --- | --- | --- | --- |
| Random device identifier | Generated on first use | `localStorage` | Recording ownership and any dormant profile/social rows | Never returned as a public profile field | Remains until browser data and associated server rows are deleted |
| Pages, settings, names, recording blobs | Play and recording flows | IndexedDB and `localStorage` | Pages/settings are not uploaded | Device only | Removed by app actions or clearing browser data |
| Recorded audio and metadata | Explicit microphone recording | IndexedDB/local URL | SQLite metadata plus a file under `UPLOAD_DIR` | Audio path is returned to its device and to holders of a valid share code | Owner deletion is supported; durable offline reconciliation is tracked in #39 |
| Share code | Explicit Share action | Transient UI state | SQLite code, audio path, name, emoji, timestamp | Anyone possessing the code can resolve it | Automatically expires after 30 days |
| Client error/feedback fields | Runtime error or explicit feedback | None | Sanitized server logs may contain message, stack, URL, user agent, timestamp, and legacy profile ID | Operators only | Governed by the production log-retention policy in #34 |
| Dormant profile/social rows | Earlier or controlled-test builds | Device identifier | SQLite users, follows, votes, reactions, comments | Not exposed while the v1 social gate is off | Must be covered by the deletion/retention work in #31/#39 before any public re-enable |

The application has no advertising SDK and does not sell data. The default v1 build does not provide analytics. Uploaded files are same-origin and use random filenames, but a valid upload URL or share code grants playback access; they are not an authentication boundary.

## Parent and consent expectations

Recording and sharing are actions an adult should supervise. PootBox does not currently implement a verified guardian account, age verification, or verifiable parental-consent workflow. Therefore public social features cannot be enabled for v1. The onboarding and privacy notice must say that recordings upload when online and that share-code recipients can play shared audio.

## Moderation, reporting, and takedown

The server validates audio type and size, filters blocked words from names and dormant text surfaces, rate-limits mutations, and authorizes recording deletion by device identifier. These controls are defense in depth, not a substitute for guardian consent or human abuse operations.

Before any public social re-enable, the product requires:

1. guardian controls and an explicit consent model;
2. in-product report and block controls;
3. a named human review and emergency takedown path;
4. tested deletion of SQLite rows and audio files, including offline retries;
5. approved retention periods for uploads, profiles, comments, reactions, and logs;
6. a field-level review of every public API response;
7. updated privacy and app-store disclosures plus appropriate policy/legal review.

## Verification

`tests/server-social-disabled.test.mjs` starts the real server with the production-default gate and proves that social endpoints return 404 while health, recording ownership routes, and share-code lookup remain reachable. The normal server integration suite explicitly enables the dormant implementation to preserve regression coverage without changing the production default.
