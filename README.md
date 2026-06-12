# 🦨 Animal Farts

**The funniest PWA you'll install this year.** 12 animals. Real fart sounds. Pure chaos.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Price](https://img.shields.io/badge/Price-$0.99-brightgreen)](https://animal-farts.com)

---

## 📱 What Is This?

Animal Farts is a Progressive Web App that lets you tap on 12 different animals and hear them fart. Each animal has a real recorded sound, a hype meter tracks your total chaos, and the screen shakes after every blast. Runs fully offline. No ads. No data collection. Just farts.

---

## ✨ Features

- 🐴 **12 unique animals** — each with its own fart sound
- 🔊 **Real recorded sounds** — no cheap MIDI, just premium-grade flatulence
- 🎚️ **Hype Meter** — fills with every tap, tracks total carnage
- 📳 **Screen Shake** — feel every blast
- 🎹 **Web Audio API synth fallback** — works on devices that can't load audio files
- 📡 **Fully offline** — service worker caches everything, works in airplane mode
- 📲 **Installable** — add to your phone's home screen, runs fullscreen like a native app
- 🔒 **Zero data collection** — no analytics, no ads, no tracking, COPPA-compliant
- ♿ **Accessible** — VoiceOver labels, Reduce Motion support (disables shake), 44×44pt tap targets

---

## 🛠️ Tech Stack

| Layer          | Technology              |
|----------------|-------------------------|
| Framework      | Vite + React 18         |
| Styling        | Tailwind CSS            |
| Audio          | Web Audio API + recorded samples |
| Offline        | Service Worker          |
| Type           | PWA (`manifest.json`)   |
| Price          | $0.99 one-time purchase |

---

## 🚀 Quick Start

```bash
# Clone
git clone git@github.com:camster91/animal-farts.git
cd animal-farts

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📂 Project Structure

```
animal-farts/
├── public/
│   ├── sounds/           # 12 animal fart audio files (.mp3/.ogg)
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Service worker
│   └── icons/            # App icons (48 → 512px)
├── src/
│   ├── components/
│   │   ├── AnimalCard.jsx    # Single animal tile with sound + shake
│   │   ├── AnimalGrid.jsx    # Grid of all 12 animals
│   │   └── HypeMeter.jsx     # Fills up with each tap
│   ├── hooks/
│   │   └── useAudio.js       # Audio playback + synth fallback
│   ├── data/
│   │   └── animals.js        # Animal definitions (name, emoji, sound path)
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## 🧪 Testing Checklist

- [ ] All 12 animals play sound on tap
- [ ] Hype meter fills and resets correctly
- [ ] Screen shake triggers per tap
- [ ] Synth fallback works when audio files missing
- [ ] App works in airplane mode
- [ ] PWA installs and runs fullscreen on iOS + Android
- [ ] VoiceOver reads all animal buttons
- [ ] Reduce Motion disables screen shake
- [ ] No network requests in DevTools Network tab

---

## 🏪 App Store Links

- iOS: *(coming soon)*
- Android: *(coming soon)*
- Web: [animal-farts.com](https://animal-farts.com) *(coming soon)*

---

## 🔒 Privacy

This app collects **no data whatsoever**. No analytics. No cookies. No account required. Fully offline. See [privacy-policy.md](privacy-policy.md) for full details — COPPA-compliant by design.

---

## 📄 License

MIT — see [LICENSE](LICENSE) file.

---

## 🙋 Made By

[Cameron Bienaime](https://github.com/camster91) — solo indie dev, shipping silly software you genuinely want to open.

---

*Farts aren't funny. They're hilarious.*