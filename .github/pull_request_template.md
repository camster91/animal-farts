## Purpose

Describe the bounded change and the current product-control/backlog authority it serves.

## Scope

- In scope:
- Out of scope:
- Product/issue source:
- Child-safety/privacy surfaces affected:

## Exact-head verification

Record only checks that actually ran on this head/artifact.

- [ ] Root + server locked dependencies installed
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:e2e` when the affected flow requires browser/release coverage
- [ ] Exact-head CI status inspected
- [ ] Production/container/release gate inspected when relevant

Evidence/results:

## Web / PWA / accessibility QA

When UI or runtime behaviour is affected:

- [ ] Mobile (~390 px)
- [ ] Tablet (~768 px)
- [ ] Desktop (~1440 px)
- [ ] Touch targets and control geometry
- [ ] Keyboard/focus/accessibility basics
- [ ] Recording/microphone permission and error flow where relevant
- [ ] Controlled sharing/delete/offline/recovery where relevant
- [ ] PWA/service-worker update behaviour where relevant
- [ ] Console/regression check

Physical-device evidence obtained:

## Child safety, privacy, and data integrity

- [ ] Public social/discovery surfaces remain disabled unless explicitly approved with the required safeguards.
- [ ] No ads, behavioural tracking, AI, or child-facing purchase prompt was introduced without an explicit current product decision.
- [ ] No real child/family recordings, device data, share codes, credentials, or private production data were added to code/evidence.
- [ ] Recording retention/deletion/sharing boundaries remain intact where applicable.
- [ ] Required safety tests, bundle ceilings, CI, backup/restore, or smoke gates were not weakened merely to obtain green status.

## Deployment / rollback boundary

Production changed: **No unless separately and explicitly approved.**

- Image/artifact impact:
- Backup/restore impact:
- Previous known-good artifact:
- Rollback evidence:
- Monitoring impact:
- Store/legal/pilot dependencies:

## Handoff

Use the repository status model:

1. Completed and verified
2. Completed but awaiting verification
3. In progress
4. Blocked
5. Awaiting client or teammate
6. Next action

Remaining risks/blockers:

Next action / approval gate:
