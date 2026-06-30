# 💥 Animal Farts

A PWA for kids (5-7) — tap a sound tile, hear the sound. 30 built-in sounds across animal/fart/silly/instrument buckets, custom mic recording, page sharing via 4-character codes, combo + confetti feedback, fully offline-capable.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Build

```bash
npm run build
npm run preview
```

## Deploy

The `dist/` folder is a static bundle. The deploy script (`scripts/deploy-vps.sh`) bundles the source, builds the Docker image on the VPS (the Mac has no docker), and swaps in the new container with `camster91/animal-farts:<sha>`.

## Stack

- React 19 + TypeScript
- Vite 8
- HTMLAudioElement (real samples) — synth fallback if a sample fails to load
- PWA with service worker
- Express + better-sqlite3 + multer (server, containerized)
- All UI is inline-styled (no Tailwind despite the package being installed)

## Audio

- **Primary:** 30 built-in sounds spanning animal (12), fart (6, with wet/dry/bubbly/squeaky/long/echo sub-buckets), silly (6), and instrument (6) categories. Sources include [MyInstants](https://www.myinstants.com) (CC-licensed user uploads) and a v70 scan that auto-discovers any new `.mp3` dropped into `public/sounds/`.
- **Fallback:** Web Audio API synth per animal — kicks in automatically if a sample fails to load
- **Custom:** the mic-capture flow uploads the kid's recording to `/api/recordings` and stores the blob URL locally in IndexedDB so recordings survive a reload
- iOS Safari audio unlock on first tap (muted-play warmup)

## Files

- `src/pootbox/PootBox.tsx` — main UI orchestrator (988 lines, 15 components + 7 hooks)
- `src/pootbox/components/CardGrid.tsx` — the v61 kid-facing card grid (replaced the v52 physics canvas)
- `src/pootbox/components/SoundLibrary.tsx` — sound picker (376 sounds via v70 auto-discover, default 30 visible with Show-all toggle)
- `src/pootbox/audioManager.ts` — single-voice audio policy (any new play stops the previous)
- `src/audio/soundPool.ts` — auto-generated sound path pool
- `src/audio/primeAudio.ts` — first-tap iOS Safari audio unlock
- `src/pootbox/lib/uploadRecording.ts` — fire-and-forget POST to `/api/recordings`
- `src/pootbox/lib/deviceId.ts` — per-device UUID stored in localStorage (used for v74 server-side identification)
- `server/server.js` — Express + SQLite server, 22 endpoints
- `scripts/scan-sounds.py` — auto-discovery scan that regenerates `src/pootbox/constants.ts`'s `BUILT_IN_SOUNDS` array
- `public/sw.js` — service worker for offline-first precache (shell + Fredoka fonts)
- `public/sounds/*.mp3` — the sound library

## Features

- v25k–v70: physics canvas with bubbles that react to touches (deprecated; see FEATURE-REVIEW-2026-06-18.md)
- v61: CardGrid — simple card-based grid, no physics
- v67: FirstRunIntro — first-launch onboarding modal
- v69: RecordSheet + RenameModal — record custom sounds, rename cards
- v70: scan-sounds auto-discovery (376 .mp3 files generate 30 curated `BUILT_IN_SOUNDS`)
- v71: SoundLibrary caps the default visible tile count at 30 with a Show-all toggle
- v75: scanner-drift regression test (constants.ts must match what scan-sounds.py produces)
- v76: ShareSheet wired to the server (`/api/share` mints, `/api/share/:code` looks up); CardGrid delete calls `DELETE /api/recordings/:id` (no more orphan uploads)

## License

MIT.
