# PootBox product control

Last reconciled: 2026-09-01. Owner: Cameron Ashley. Status: **in progress**.

This is the durable product-level source of truth. GitHub issue #28 and its
linked child issues remain the implementation backlog. Current API, safety,
operations, and historical-document authority live in the documents linked
from the README.

## Charter and focused position

PootBox is an ad-free, offline-first soundboard for families with children
roughly ages 5–7. Its primary job is to turn quick taps and a family's own
recorded sounds into shared, silly play without public profiles, discovery,
feeds, chat, behavioural advertising, or an account requirement.

The initial customer is a parent or guardian looking for a playful activity a
young child can understand immediately and use on a shared phone or tablet.
The child is the primary user; the adult is the buyer, safety decision-maker,
and operator for sharing, external links, and store actions.

Proposed promise: **make your family's funniest soundboard in under a minute,
then keep playing anywhere—even offline.** This position is a hypothesis until
physical usability testing and a real family pilot validate it.

Deliberately deferred: public social discovery, profiles, follows, feeds,
comments, reactions, anonymous communication, ads, behavioural analytics, and
AI features. None improves the core family-play job enough to justify its
current child-safety, privacy, moderation, or operating cost.

## Current truth

### Verified facts

- The web PWA is deployed at `https://animals.ashbi.ca`. Production currently
  runs SSH-built image `camster91/animal-farts:ssh-7f8b0698fa93` from exact
  `main` commit `7f8b0698fa9306437c79779db66f529a3bdcaaa6`; health, homepage,
  manifest, service worker, the intentionally hidden public recording route,
  backup integrity, restored recording count, and restored audio playback were
  verified during the release.
- Normal builds expose Play and controlled, expiring share codes. Public social
  UI and server routes are disabled behind independent client/server flags.
- The product supports built-in sounds, microphone recording, local persistence,
  upload, controlled sharing, deletion, and offline shell/audio behavior.
- An IndexedDB operation queue with idempotent server mutations has been
  merged for durable upload/delete reconciliation after exact-head VPS CI.
- Unit/integration coverage and a five-journey mobile Playwright suite cover
  recording, persistence, controlled sharing, deletion, offline recovery,
  keyboard onboarding/update behavior, minimum touch targets, the Change sound
  library, and responsive card/control geometry.
- The build enforces measured bundle ceilings: 380 KiB raw / 115 KiB gzip for
  all JavaScript, 70 KiB gzip for the initial entry, and 5 KiB gzip for CSS.
- Production has trusted Traefik-managed ACME TLS, verified daily SQLite plus
  uploads backups, a rehearsed isolated restore, a five-minute ops check, and
  a Uptime Kuma health monitor connected to the active Mailgun destination.
  A controlled DOWN/UP notification rehearsal succeeded.
- There is no billing, advertising, third-party analytics, or AI provider in the
  product.

### Reasonable inferences

- The strongest credible wedge is not “the most fart sounds.” Established prank
  apps already compete on catalogue size, timers, motion triggers, and prank
  effects. PootBox can instead win a narrower family segment through custom
  recording, child-sized interaction, offline reliability, no ads, and a
  conservative sharing boundary.
- Parent trust is part of the product, not merely compliance documentation.
  Current child-focused sound apps prominently market no ads, offline play,
  parental gates, and minimal collection.
- A subscription is unlikely to match the product's current recurring value.
  A free pilot followed by a modest one-time purchase is the most coherent
  pricing hypothesis.

### Unknowns requiring evidence

- Whether children can discover, record, save, replay, share, and delete without
  adult coaching on supported physical devices.
- Which moments make parents return, recommend, or pay, and whether custom
  recording is meaningfully more valuable than a static sound catalogue.
- Real activation, retention, task-success, support burden, and willingness to
  pay. No customer-validation or product-market-fit claim is currently valid.
- Final target regions, store category/age declarations, legal assessment, and
  Play Console policy outcomes.

## Current market evidence

Research date: 2026-08-28. Store claims are developer-supplied unless the store
states otherwise.

| Alternative | Current evidence | Implication for PootBox |
| --- | --- | --- |
| [iFart on Google Play](https://play.google.com/store/apps/details?id=com.ifartllc.ifart) | 1M+ downloads, 4.8 stars, 35 free sounds, $0.99 packs, timers/motion/share/record features, no ads | Brand and prank breadth are established; avoid a catalogue arms race. |
| [Air Horn Prank & Fart Sounds](https://apps.apple.com/us/app/air-horn-prank-fart-sounds/id1522694328) | 12K ratings, 4.6 stars, 80+ effects, free with purchases | Large general-prank catalogues have reach but are not focused family tools. |
| [Animal Sounds: Kids Quiz Game](https://apps.apple.com/us/app/animal-sounds-kids-quiz-game/id1273614378) | Ad-free, offline, 75+ animals, on-device voice recording, quizzes and badges | Safe on-device recording is a direct substitute; controlled family sharing and sillier creative play must earn differentiation. |
| [Animal Sounds: Baby Games](https://apps.apple.com/us/app/animal-sounds-baby-games/id6544782755) | No ads/external links, parental gate, offline; listed purchases include $2.99 monthly and $19.99 yearly | Parent trust is table stakes; subscription pricing exists but is not evidence it suits PootBox. |
| [Animal Sounds App Kids](https://apps.apple.com/us/app/animal-sounds-app-kids/id1163621519) | Simple no-ad toddler soundboard; listed at $0.59 | One-time low-price competition supports testing a modest non-subscription purchase. |

[Google Play's Families policy](https://support.google.com/googleplay/android-developer/answer/9893335)
requires accurate child-audience and data declarations. Apps with social
features must give adults controls, require adult action before children
exchange personal information, and disclose microphone/device data practices.
[Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/)
apply additional Kids Category, parental-gate, privacy, and user-generated
content requirements. Store submission remains subject to owner and appropriate
legal/policy review; this document is not legal approval.

## Pricing and economics hypothesis

Status: **proposed**, not approved.

- Web pilot: free, no ads, no behavioural tracking, with a deliberately small
  invited family cohort.
- Android after validation: test a one-time **US$2.99 family unlock**, with no
  subscription and no child-facing purchase prompt. Final regional pricing is
  an owner decision made in Play Console.
- Controlled sharing should remain bounded by short retention and abuse limits;
  do not promise unlimited cloud storage.
- Before monetization, measure hosting/storage/bandwidth per active family,
  payment/store fees, moderation/support time, backup growth, and gross margin.
- Decision rule: do not add a subscription until recurring content or service
  produces demonstrated recurring value. Do not add ads to a child-directed
  experience.

## Metrics and validation

Privacy-minimal pilot metrics, collected only after the event schema and consent
boundary are approved:

| Metric | Definition | Initial decision threshold |
| --- | --- | --- |
| Activation | New family plays a built-in sound and saves one recording in the first session | At least 70% in a supervised 10-family pilot |
| Time to first laugh/value | Launch to first successful sound playback | Median under 15 seconds |
| Core-task success | Child records, saves, replays, and deletes without intervention | At least 8/10 supervised sessions |
| Share success | Adult mints a code and a second device imports it | At least 9/10 attempts |
| Reliability | Crash-free sessions and successful queued reconciliation | 99.5% crash-free; 99% eventual sync within 24 hours when connectivity returns |
| Retention hypothesis | Families returning in week two | At least 4/10 pilot families before broader acquisition work |
| Parent trust | Parent rates safety/privacy explanation clear and acceptable | At least 9/10, with no unresolved critical concern |

These are launch-learning thresholds, not current results. Avoid persistent
child identifiers or raw child-entered content in analytics. Operational health
and aggregate product learning must remain separate from recordings and names.

## Access and approval register

| Capability | Current state | Approval or blocker | Owner |
| --- | --- | --- | --- |
| Repository and PRs | Available | Routine code/PR work authorized | Agent |
| Local/VPS validation | Available | Read-only checks and reversible preparation authorized | Agent |
| GitHub-hosted Actions | Blocked | Account payment/spending limit prevents runners from starting | Cameron |
| GHCR publication | Blocked outside Actions | Package-write credential not available locally/VPS | Cameron |
| Production deployment | Current release complete; next release unapproved | Production is at `7f8b0698`; obtain action-time approval before promoting later merged work | Cameron |
| Alert destination | Configured and rehearsed | Uptime Kuma monitor 29 checks `/api/health`; maintain the active Mailgun destination | Agent |
| Physical iPhone/Android/kid QA | Missing | Run supervised matrix and provide signed results | Cameron |
| Android signing/Play Console | Missing | Secure keystore, account, internal-track access, and submission approval | Cameron |
| Customer interviews/pilot | Not started | Recruit consenting parents; never publish child identity/content | Cameron |

## Authoritative roadmap

1. **Release provenance (#37, released through approved SSH path):** immutable
   pull-only tooling remains available, while the billing-blocked hosted image
   path was bypassed for this release using an exact-commit VPS build. Production
   runs `7f8b0698`; the deployment record and rollback image are retained.
2. **Child-safety boundary (#31, verified/merged):** confirm issue evidence and
   keep public social surfaces disabled.
3. **Durable data (#39, verified/merged):** exact PR #44 head `252dbdd`
   passed the independent VPS Local CI gate and merged as `371bbaf`.
4. **Core browser proof (#33, verified/merged):** exact PR #45 head `f2b8857`
   passed the independent VPS Local CI gate and merged as `211f0eb` with the
   four core Playwright journeys in the release gate.
5. **Operations/TLS (#34/#35, verified/closed):** trusted TLS, backup/restore,
   strict ops checks, independent Uptime Kuma monitoring, and controlled
   DOWN/UP notification delivery are proven.
6. **Documentation (#38, verified/closed):** current API, history, privacy,
   deployment, and product-control authority are merged.
7. **Maintainability (#40, verified/closed):** tested recording and sharing
   interfaces are merged behind E2E protection.
8. **Responsive feature review (PR #60, merged/pending release):** the Change
   control no longer overlaps labels at the tested mobile/tablet widths. Exact
   head `63ba52b` passed Ashbi CI and all five remote Chromium journeys. This is
   merged as `21abd448` but is not yet in production.
9. **Physical/device and Android (#36/#32, externally blocked):** native API and
   uploaded-audio routing, constrained WebView CORS, store metadata, security
   diff review, and debug APK assembly are verified. Complete the signed
   physical QA record, release signing, and Play policy review before an
   internal-track or production submission.
10. **Pilot and commercial validation (proposed):** only after release gates,
   recruit a small consenting family cohort and measure the hypotheses above.

## Decisions and risks

- **2026-08-28 — v1 social boundary:** ship Play plus controlled codes; keep
  profiles, discovery, feed, comments, reactions, and follows dormant. Reverse
  only after adult controls, moderation, reporting/blocking, retention, policy,
  and real safety review are complete.
- **2026-08-28 — positioning hypothesis:** prioritize family-created silly play
  and parent trust over catalogue size or public social growth. Review after the
  physical pilot.
- **2026-08-28 — monetization hypothesis:** no ads; free pilot; evaluate a
  one-time Android purchase after willingness-to-pay evidence. Pricing changes
  require owner approval.

Top residual risks are child audio/privacy, an untested physical-device journey,
unavailable GitHub artifact publication, unsigned Android release material,
absent customer evidence, and single-host SQLite plus uploads capacity. The
latest responsive fix is merged but unreleased. No “market-leading,”
launch-ready, or customer-validated claim is warranted while these remain.

## Work log

- 2026-09-01: merged the responsive card/control correction in PR #60 after
  exact-head Ashbi CI and a five-journey remote mobile/tablet Chromium run. The
  run verified recording, persistence, share/import/delete, deterministic
  offline playback and reconnect, keyboard onboarding/update behavior, touch
  targets, Change-library interaction, and non-overlapping geometry. Production
  remains on the earlier approved `7f8b0698` release pending new approval.
- 2026-08-29: promoted exact `main` commit `7f8b0698` by the approved SSH build
  path, retained immutable current/rollback image IDs and a dated deployment
  record, rehearsed the fresh backup with eight recordings and audio playback,
  and passed post-release health/TLS/capacity/restart checks. Uptime Kuma monitor
  29 and its Mailgun destination then passed a controlled DOWN/UP rehearsal;
  issues #34 and #35 were closed.

- 2026-08-28: reconciled deployed fixes into `main`; repaired and proved the
  independent Local CI profile; merged the conservative child-safety boundary;
  implemented durable recording sync, mobile E2E, operational recovery, current
  docs, Android release preparation, and sharing extraction on staged branches;
  enabled trusted ACME TLS, verified backup/restore, and installed ops checks.
- 2026-08-28: fixed packaged Android routing for API and uploaded-audio access,
  added a strict Capacitor-origin CORS contract, repaired cross-origin native
  audio playback, passed 247 application tests plus three mobile E2E journeys,
  completed a security diff review with no reportable findings, and assembled a
  debug APK on JDK 21. Physical device QA and signed release approval remain
  open.
- 2026-08-28: established the first dated competitor/policy evidence and the
  focused ad-free family-play hypothesis. Real customer validation remains open.
- 2026-08-28: merged immutable deployment tooling in PR #48 without deploying
  production; reconciled PR #44 onto current `main`; replaced a statistically
  flaky random-code assertion; and verified its exact head with lint plus 229
  tests. Hosted Actions remain blocked by account billing and Local CI still
  needs its reviewed profile activated at a safe worker restart window.
- 2026-08-28: expanded the core PWA suite to four journeys covering deterministic
  offline audio, reconnect recovery, keyboard focus/onboarding, and update-prompt
  behavior; exact commit `67f34f8` passed lint, all 229 unit/integration tests,
  and five consecutive Playwright runs (20/20 scenarios).
- 2026-08-28: repaired the production operations contract so a high Docker
  restart count now fails instead of merely being reported. The updated script
  passed its unit contract and a read-only production execution at 72% disk,
  3% inode use, 89 certificate days, zero restarts, current backup, and healthy
  public/container health. External paging remains unconfigured.
- 2026-08-28: added a production bundle regression gate. The verified core
  build uses 346.5 KiB raw / 98.6 KiB gzip JavaScript, a 62.0 KiB gzip entry,
  and 3.5 KiB gzip CSS; all 231 tests and four E2E journeys passed.
- 2026-08-28: pinned every GitHub release-workflow action to its current
  upstream immutable commit, added weekly GitHub Actions Dependabot governance,
  and added a contract that rejects floating actions, obsolete hard-coded test
  paths, and non-blocking release checks. YAML parsing, lint, and all 234 core
  tests passed; hosted execution remains billing-blocked.
- 2026-08-28: activated the reviewed Ashbi VPS CI profile, then exact-head
  checks passed and PRs #44, #45, #46, and #49 merged in dependency order.
  Issues #39 and #33 closed from merged evidence. Cameron approved production
  deployment for the completed exact-head release stack; no production
  promotion has occurred yet.
- 2026-08-28: on the staged Android stack before that E2E expansion, passed 247
  application tests, three mobile E2E journeys, a no-findings security diff
  scan, and JDK 21 debug APK assembly. No physical device was connected, so
  device QA remains open; the reconciled stack must be revalidated.
- 2026-08-28: the reconciled staged Android stack passed lint, all 247
  application tests, all four mobile E2E journeys, Capacitor sync, and JDK 21
  debug APK assembly. The APK SHA-256 is
  `9a15b5c64accdacb6fcab64bc2a914cc2c6c63f48d0fffe0923af242aaf699d3`.
  The earlier Android security diff scan had no reportable findings. No physical
  device was connected, so device QA remains open.
- 2026-08-28: a fresh detached checkout of the staged Android commit completed
  root and server `npm ci`, lint, all 247 application tests, and all four E2E
  journeys. The clean install exposed a moderate `xcode -> uuid@7` advisory in
  the Capacitor CLI toolchain; the Android branch now overrides it with the
  compatible patched `uuid@11.1.1`, after which `npm audit` reports zero known
  vulnerabilities and Capacitor sync plus the JDK 21 debug build still pass.
- 2026-08-28: after reconciling the operations and bundle-budget contracts, the
  exact staged Android stack passed lint, all 251 application tests, and all
  four E2E journeys. These additions affect tests, scripts, and documentation;
  the previously assembled application bundle and APK remain unchanged.
- 2026-08-28: the final staged workflow-pinning reconciliation at `4c91ec7`
  passed lint, all 254 application tests, the focused CI/operations/performance
  contracts, and an npm audit with zero known vulnerabilities. Application
  assets remain unchanged from the four-journey E2E and Android build evidence.
