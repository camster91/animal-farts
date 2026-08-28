# Current HTTP API

This document describes the production-default API in `server/server.js`.
The browser app and API must share one origin; uploaded audio is served from
that origin under `/uploads/`.

## Production boundary

Production exposes health, telemetry, recording upload/deletion, uploaded
audio, and controlled share codes. Public recording discovery, profiles,
follows, feeds, votes, comments, reactions, and user discovery return `404`
unless both the server and client social feature flags are deliberately enabled
for controlled regression testing. See `v1-child-safety-boundary.md`.

All `/api/*` responses are JSON. The general per-IP ceiling is 120 requests per
minute. Upload and share-code minting are limited to 6/minute; share-code lookup
is 30/minute. Endpoint-specific limits for dormant social writes are defined in
`server/server.js`. Uploaded audio and the SPA shell are outside the API rate
limiter.

## Identity and idempotency

Writes use `x-device-id`, a random 4-64 character identifier containing only
letters, digits, `_`, or `-`. It is an ownership credential, not an account,
and is never returned in public payloads. Upload and delete reconciliation may
also send `x-operation-id` (8-128 characters in the same safe character set);
repeating an operation returns the existing result instead of duplicating it.

## Production routes

| Method and path | Contract |
|---|---|
| `GET /api/health` | Returns `{ "ok": true }` after a SQLite ping. |
| `POST /api/errors` | Accepts sanitized client error fields; 30/minute telemetry limit. |
| `POST /api/feedback` | Accepts a non-empty sanitized `message`; 30/minute telemetry limit. |
| `POST /api/recordings` | Multipart field `audio` plus `name`, optional `emoji`, `kidName`, and `durationSec`; requires `x-device-id`. Returns the recording and `/uploads/<filename>` URL. |
| `DELETE /api/recordings/:id` | Requires the owning `x-device-id`; optional `x-operation-id`. Deletes metadata, audio, shares, and dependent social rows. |
| `POST /api/share` | Requires owner identity and `{ audioUrl, name, emoji }`. Returns an eight-character code. |
| `GET /api/share/:code` | Resolves a valid legacy four-character or current eight-character code. |
| `GET /uploads/:filename` | Serves validated audio with an `audio/*` content type and seven-day browser cache. |

Uploads accept WebM, MP4/M4A, MPEG/MP3, WAV, and Ogg audio up to the configured
Multer limit. The server checks filename/type and magic bytes, moderates names,
and caps each device at 40 retained recordings. Share codes expire after 30
days and are cleaned hourly. Delete-operation tombstones expire after 90 days.
Recordings otherwise remain until their owning device deletes them or an
operator applies a documented recovery/retention action.

## Dormant social routes

With `SOCIAL_FEATURES_ENABLED=1`, controlled tests additionally cover:

- `GET /api/recordings` with `limit`/`offset`, returning
  `{ recordings, nextOffset }`;
- vote, comment, and reaction routes below `/api/recordings/:id`;
- `GET|PATCH /api/me`;
- profile, follow, follower/following, and per-user recording routes below
  `/api/users`;
- `GET /api/feed`; and
- `GET /api/users` discovery.

These routes are maintained for regression coverage but are not an approved
public product surface. Enabling them in production requires the guardian,
moderation, reporting, blocking, deletion, retention, and abuse-response gates
listed in `v1-child-safety-boundary.md`.
