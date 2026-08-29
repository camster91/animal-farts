# PootBox Android store listing draft

Status: draft for review; not approved for Play Console submission.

## Release identity

- App name: PootBox
- Application ID: `com.ashbi.pootparty` (stable legacy identifier)
- Version: 1.0.0 (`versionCode` 3)
- Category: Family / Entertainment (final Play Console category to be confirmed)
- Privacy policy: `https://animals.ashbi.ca/privacy.html`
- Support: `hello@pootbox.app` (ownership and deliverability must be verified)

## Listing copy

Short description:

> Make a private family soundboard with animal noises, silly sounds, and your own recordings.

Full description:

> PootBox is a playful soundboard for families. Tap animal and silly sounds,
> record your own sound, and arrange favorites into easy-to-use pages. The app
> keeps its interface and built-in sounds available offline. Your recordings
> can sync securely so they survive reconnecting, and an adult can create a
> temporary code to share a chosen sound. PootBox has no ads, third-party
> analytics, public feed, follower system, or open messaging.

Release notes:

> First Android test release: offline soundboard, family recordings, durable
> sync, owner deletion, and private share codes.

## Data Safety working draft

This is an engineering inventory, not a completed Play Console declaration or
legal opinion. Review it against the exact signed artifact and current policy.

| Data | Purpose | Handling |
| --- | --- | --- |
| User audio | Core recording, sync, playback, optional code sharing | Sent over HTTPS to PootBox infrastructure; deletable by the originating device |
| Device-generated identifier | Associate uploads and owner deletion without an account | Sent over HTTPS; not an advertising identifier |
| Recording name, emoji, duration, timestamps | Operate the soundboard and sync | Stored locally and, for synced recordings, on PootBox infrastructure |
| Error diagnostics | Reliability | Self-hosted; message and stack length are limited, but final disclosure review is required |

No ads or third-party analytics are present. Public social features are disabled.
The final declaration must confirm retention, deletion, encryption, audience,
sharing, and collection semantics in Play Console.

## Store assets still required

- Phone screenshots from the release-candidate build, including recording,
  soundboard, offline state, and adult-supervised sharing.
- 512 x 512 store icon verified against the packaged icon.
- 1024 x 500 feature graphic.
- Optional tablet screenshots only if tablet support is claimed.
- Current privacy-policy screenshots and a verified support contact.

Do not fabricate screenshots or use child-identifying recordings in assets.

## Release gates

1. Obtain a current child-directed-app/privacy review and confirm target age,
   parental supervision, consent, retention, and share-code behavior.
2. Complete physical Android QA for microphone permission, record, reconnect,
   sync, playback, sharing, deletion, offline use, rotation, and process restart.
3. Validate the privacy URL and support mailbox externally.
4. Build and verify a signed release artifact; retain its checksum and mapping.
5. Review the Data Safety and content-rating answers in Play Console.
6. Get explicit approval immediately before uploading to an internal Play track.
7. Roll back by halting promotion and returning testers to the prior approved
   artifact; server rollback follows the immutable deployment runbook.
