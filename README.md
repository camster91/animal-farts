# 💥 Animal Farts

A PWA for kids (5-7) — tap an animal, hear a real fart sound. 12 animals, hype meter, random + combo buttons, screen shake, poof particles, fully offline-capable.

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

The `dist/` folder is a static bundle. Drop it on Coolify, Netlify, GitHub Pages, or any static host.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Web Audio API (synth fallback)
- HTMLAudioElement (real samples)
- PWA with service worker

## Audio

- **Primary:** 12 real human fart recordings from [MyInstants](https://www.myinstants.com) (CC-licensed user uploads), normalized to -16 LUFS, trimmed, slight per-animal pitch shift
- **Fallback:** Web Audio API synth per animal — kicks in automatically if a sample fails to load
- iOS Safari audio unlock on first tap (muted-play warmup)

## Files

- `src/audio/fartEngine.ts` — primary audio engine (real samples + health tracking)
- `src/audio/fartSynth.ts` — Web Audio synth fallback
- `src/App.tsx` — UI
- `public/sounds/*.mp3` — the 12 samples

## License

MIT.
