# Physical release-candidate QA

Create one private copy of this record per release candidate. Do not put a
child's name, voice recording, face, account identifiers, or other identifying
information in a public issue. Link only sanitized defects and conclusions.

## Candidate identity

- Git commit:
- GHCR image digest:
- web deployment record:
- Android version code/name:
- APK/AAB SHA-256:
- tester and date:
- go/no-go decision:

## Device matrix

Complete every row with device model, OS, browser/WebView version, installed
mode, result, and linked defect/retest evidence.

| Surface | Required target | Identity and result |
|---|---|---|
| iPhone | Current iOS Safari and installed PWA | |
| Android web | Current Chrome and installed PWA | |
| Android native | Physical device with signed/internal Capacitor build | |
| Desktop | Current Chrome | |

## Functional matrix

On every applicable surface verify:

- fresh install/launch and first-run guidance;
- built-in playback, rapid repeated taps, volume, and audio unlock;
- microphone allow, deny, understandable recovery, retry, recording, save, and
  playback after reload;
- eight-character share creation and import with adult supervision;
- offline launch/playback, offline recording queue, reconnect reconciliation,
  and update to a newer service worker/app build;
- deletion while online and offline, including visible retry state;
- external privacy/about links; and
- no public Friends, Me, discovery, comments, reactions, or recording listing.

## Layout and accessibility

Check portrait and landscape, 320px and 390px widths, bottom safe areas,
keyboard/modal behavior, touch targets, focus/labels, reduced motion, text
scaling, and horizontal overflow. Test a low-storage or quota failure and a
mid-upload network interruption; recovery guidance must say what remains local,
what is queued, and what the adult can do next.

## Supervised kid usability

Use `kid-test-sheet.md`. A supervising adult controls recording and sharing.
Capture only non-identifying observations needed to improve comprehension. Any
critical defect becomes a linked issue and must be retested on the same surface
before this record can say go.
