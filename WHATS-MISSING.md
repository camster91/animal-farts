# What's missing — animal-farts, 2026-06-13

Verified against the live site (https://animals.ashbi.ca/) and the repo HEAD
at `08d562e` (v56-3). All paths probed with curl; client source audited
end-to-end; server endpoints enumerated from `server/server.js`.

## The big one: the social app exists on the server and nowhere else

`server/server.js` has 20+ social endpoints. The client app (`src/App.tsx`)
is literally:

```tsx
export default function App() {
  return <PootBox />;
}
```

No router, no `/profile`, no `/me`, no `/feed`, no `/community`. The server
endpoints:

| Endpoint | Server | Client calls it? |
|---|---|---|
| `POST /api/share` (mint 4-letter code) | ✓ | ✓ (ShareSheet) |
| `GET /api/share/:code` (lookup) | ✓ | ✓ (ShareSheet) |
| `GET /api/recordings` (list) | ✓ | ✗ — `/api/recordings` returns 1 test row, no UI shows it |
| `POST /api/recordings` (upload) | ✓ | ✗ — recordings stay local in IDB; never POSTed to the server |
| `POST /api/recordings/:id/upvote` | ✓ | ✗ — no upvote button anywhere |
| `GET /api/recordings/:id/comments` | ✓ | ✗ — no comment thread UI |
| `POST /api/recordings/:id/comments` | ✓ | ✗ — same |
| `DELETE /api/comments/:id` | ✓ | ✗ — same |
| `GET /api/recordings/:id/reactions` | ✓ | ✗ — no emoji reaction picker |
| `POST /api/recordings/:id/reactions` | ✓ | ✗ — same |
| `GET /api/feed` | ✓ | ✗ — no feed page |
| `GET /api/me` | ✓ | ✗ — no profile page |
| `GET /api/users/:handle` | ✓ | ✗ — no profile-by-handle page |
| `GET /api/users/:handle/recordings` | ✓ | ✗ — same |
| `GET /api/users/:handle/followers` | ✓ | ✗ — no followers list |
| `GET /api/users/:handle/following` | ✓ | ✗ — no following list |
| `POST /api/users/:handle/follow` | ✓ | ✗ — no follow button |
| `GET /api/users` (search) | ✓ | ✗ — no search UI |

Live curl confirms: `/api/feed` returns 200, `/api/users` returns 200,
`/profile` returns 200 (SPA catch-all), `/me` returns 200 (SPA catch-all),
`/u/test` returns 200. But every one of them is a dead page or anonymous
data — the x-device-id header is required for the social writes, and
no client code sends it.

`grep -rn 'x-device-id' src/` returns zero hits. The only client-side
device identity is the localStorage deviceId used for the local pair-sync
feature (v47-era), which never makes it to a header.

## Three concrete, addressable gaps

### 1. Recording sharing is half-built (server works, client doesn't push)

The kid records a sound → it lives in IDB → on reload it's gone (v56-5
flagged this). The server has `POST /api/recordings` ready with rate
limits and x-device-id auth. Wiring this end-to-end is:

- `useRecording.ts`: after `finalizeRecording`, POST the blob to
  `/api/recordings`, get back `{id, audioUrl: "/uploads/...webm"}`,
  store that in the bubble's `audioUrl` (replacing the blob: URL).
- `usePagesState.ts` or a new `useRecordingsSync` hook: on app boot,
  pull `/api/recordings`, dedup against the local IDB pool, offer
  "Restore 3 recordings from server" if any are missing.
- The share-code flow already POSTs to `/api/share` and reads back
  `/uploads/...webm` — that pipeline is end-to-end working, but it's
  not what `useRecording` does. Recordings vs share-codes are
  different (recording = a personal audio, share-code = a 4-letter
  pointer to an existing audio). Right now the share-code is the
  only way to publish.

Roughly 4-6 hours of work. The biggest user-facing impact: recordings
survive reload via the server's blob storage, and the kid can post a
sound to the server for a sibling to look up by code.

### 2. "The kid mashed all the noises at once" — single-voice policy needs a visible target

`audioManager.ts` already stops the previous sound before playing the
new one. The ⏹ button works. But the kid sees bubbles flying around
the screen; if they want to silence a specific one, they have to find
the ⏹ button. Plan.md called this v56-4 (tap-playing-bubble-to-stop):

- Track `currentlyPlayingId` in the audio manager (or use a ref
  passed via context)
- When a bubble is the currently-playing one, give it a visual
  "playing" state (pulsing border, scale-up, color shift)
- Tap the currently-playing bubble → stop the sound
- Tap any other bubble → single-voice policy (the existing flow)

Roughly 2-3 hours. Medium risk because the audio state needs to be
exposed to the canvas component (which currently doesn't know what's
playing).

### 3. No "share my page" UX — the share button exists but the result is opaque

Looking at the share-button → share-sheet flow:

- User taps 🔗 in the top bar → ShareSheet opens in "share" mode
- A 4-letter code appears (e.g. "QMSM")
- User taps "Copy code"
- ShareSheet says: "Anyone with this code can add 'Page name' to their pages"
- User dismisses the sheet

There's no:
- Confirmation toast when the code is copied
- A way to test the code (open the lookup tab and paste your own code)
- A way to know which codes you've already shared
- A "this code was looked up 3 times" feedback loop

Roughly 1-2 hours, isolated to ShareSheet.tsx + PootBox.tsx toast
plumbing. No server changes needed.

## Smaller items (worth listing, not worth doing alone)

- **No-emoji deduplication is by name only.** Two recordings with the
  same emoji and same audio will be stored as separate pages. The
  `addBubbleToPageDedup` checks `builtinKey` and `blobUrl`, so custom
  recordings only dedup on the exact blob URL. Identical-looking
  recordings from different sessions show up as two bubbles. The
  v47-era content-hash dedup was removed.
- **No "undo" for deletion.** Recording a sound, accidentally
  deleting it, and redoing requires re-recording. The UndoToast
  component exists (for combo end-of-chain) but isn't wired to
  deletions.
- **The audio share import loses audio on page reload** (v56-5).
  A shared bubble gets `blobUrl: data.audioUrl` from the server,
  which is a `/uploads/...webm` path — but the bubble template
  sets `sound: data.audioUrl` (the same path), not the fetched
  blob. If the kid reloads, the page rebuilds and the bubble
  has no actual audio. Fix: fetch the audio bytes, store as a
  real Blob in IDB.
- **No "delete this page" confirm.** `removePage` exists but
  the TopBar only enables it via long-press, with no confirm
  dialog. A kid can accidentally trash a page.
- **No kid mode / parent gate.** All of Settings is one big
  modal. No "tap-and-hold the 🐄 in the corner 3 times to enter
  parent mode" gating pattern. The v47-era `pootbox-parent-pin`
  code is gone.
- **First-run intro only shows on first load.** It dismisses
  forever in localStorage. No way to re-watch the tutorial.
- **No "this recording was added to your library" feedback.**
  When the kid records, the bubble appears on the canvas but
  there's no "🎤 Saved!" toast confirming the mic capture
  succeeded.

## What I would ship next, ranked

If you said "build the next thing," here's what I'd do:

1. **#1 above (recording → server push)** — biggest user-facing gap.
   The data is there on the server, the client just doesn't use it.
2. **#3 (share-code UX polish)** — small, isolated, high visible
   impact for the one user-facing flow that DOES exist.
3. **#2 (tap-playing-bubble)** — the "proper game" framing.
4. The v56-5 blobUrl fix as a small one-off.
5. The smaller items as a follow-up sweep.

Roughly 8-12 hours of work, 3-4 commits. The repo's been very stable
post-v53: 81/81 tests pass, build is clean, deploy is reliable, the
live site is healthy. Adding the social surface is a different kind of
work — a UX surface, not a bug fix. Worth scoping before committing to it.

If you want to pivot toward "ship the social surface," I'd want a
separate conversation about: what does the kid see? A feed? A
"recordings I made" tab? A "find other kids' sounds" page? Each of
those is a different product.
