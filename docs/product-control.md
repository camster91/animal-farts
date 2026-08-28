# PootBox product control

Last reconciled: 2026-08-28. Owner: Cameron Ashley. Status: **in progress**.

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

- The web PWA is deployed at `https://animals.ashbi.ca`; its public health,
  homepage, manifest, service worker, recording list, and one audio object were
  verified during the 2026-08-28 operations work.
- Normal builds expose Play and controlled, expiring share codes. Public social
  UI and server routes are disabled behind independent client/server flags.
- The product supports built-in sounds, microphone recording, local persistence,
  upload, controlled sharing, deletion, and offline shell/audio behavior.
- An IndexedDB operation queue with idempotent server mutations has been
  implemented for durable upload/delete reconciliation and is awaiting merge.
- Unit/integration coverage and a three-journey mobile Playwright suite exist.
- Production has trusted Traefik-managed ACME TLS, verified daily SQLite plus
  uploads backups, a rehearsed isolated restore, and a five-minute ops check.
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
| Production deployment | Available technically | Exact action-time approval required | Cameron |
| Alert destination | Missing | Supply an independent webhook/notification destination | Cameron |
| Physical iPhone/Android/kid QA | Missing | Run supervised matrix and provide signed results | Cameron |
| Android signing/Play Console | Missing | Secure keystore, account, internal-track access, and submission approval | Cameron |
| Customer interviews/pilot | Not started | Recruit consenting parents; never publish child identity/content | Cameron |

## Authoritative roadmap

1. **Release provenance (#37, in progress):** restore image publication, prove
   the immutable artifact, then request approval for production promotion.
2. **Child-safety boundary (#31, verified/merged):** confirm issue evidence and
   keep public social surfaces disabled.
3. **Durable data (#39, implemented; CI pending):** merge only after the exact
   head passes the independent Local CI gate.
4. **Core browser proof (#33, implemented locally):** reconcile, pass CI, merge,
   and preserve failure artifacts without production/child data.
5. **Operations/TLS (#34/#35, partially verified):** merge runbooks and scripts;
   add an independent alert path and rehearse 30/14/7-day paging.
6. **Documentation (#38, implemented locally):** land current API, history,
   privacy, deployment, and product-control authority.
7. **Maintainability (#40, implemented locally):** land tested recording and
   sharing interfaces after E2E protection.
8. **Physical/device and Android (#36/#32, externally blocked):** complete the
   signed physical QA record before internal-track or production submission.
9. **Pilot and commercial validation (proposed):** only after release gates,
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
missing independent paging, unavailable GitHub artifact publication, unsigned
Android release material, absent customer evidence, and single-host SQLite plus
uploads capacity. No “market-leading,” launch-ready, or customer-validated claim
is warranted while these remain.

## Work log

- 2026-08-28: reconciled deployed fixes into `main`; repaired and proved the
  independent Local CI profile; merged the conservative child-safety boundary;
  implemented durable recording sync, mobile E2E, operational recovery, current
  docs, Android release preparation, and sharing extraction on staged branches;
  enabled trusted ACME TLS, verified backup/restore, and installed ops checks.
- 2026-08-28: established the first dated competitor/policy evidence and the
  focused ad-free family-play hypothesis. Real customer validation remains open.
