# v27 Test Plans

## Feature 1: Custom sound upload (parent)

### Setup
- `localStorage.clear()`, reload https://animals.ashbi.ca/?v=v27-test
- Create a kid profile (any emoji + name)
- Land in Farm scene
- Visit `/parent`, set PIN to `1234`
- Confirm premium is NOT yet purchased (no 🔓 badge should appear on the upload card)

### Test steps

#### Happy path
1. [ ] Open the Custom Sound Upload card in `/parent`
2. [ ] Tap "Upload" for the Cow thing
3. [ ] File picker opens with `accept="audio/mp3,audio/mpeg"` filter
4. [ ] Pick a valid MP3 file (under 5MB, e.g. 1MB test file)
5. [ ] Verify the file name appears in the card with a timestamp, e.g. "cow-sound.mp3 — uploaded just now"
6. [ ] Return to kid's screen, tap Cow
7. [ ] Verify the uploaded MP3 plays — not the default Cow sound
8. [ ] Verify the uploaded sound shows a playback indicator (waveform or spinning icon) while playing

#### Edge cases
9. [ ] Upload a 6MB file → friendly inline error appears: "File too large. Max 5MB." No upload proceeds.
10. [ ] Upload a .txt file → browser file picker rejects it (picker only shows audio/* MIME types)
11. [ ] Upload a valid MP3, hard-refresh the page (Cmd+Shift+R), return to kid's screen, tap Cow → uploaded sound still plays (IndexedDB persistence)
12. [ ] Create Profile A, upload a custom Cow sound, switch to Profile B, tap Cow → Profile B hears the default Cow sound (uploaded sounds are per-profile, not shared)
13. [ ] Upload a valid MP3, then tap "Remove" on that sound → card returns to empty state, Cow plays the default sound
14. [ ] Upload a sound for Cow, then upload a different sound for Cow → the new sound replaces the old one, timestamp updates

#### Failure modes
15. [ ] Upload a corrupted MP3 (binary garbage with .mp3 extension) → no crash, no playback, default sound plays silently or an error icon appears on the thing
16. [ ] Upload a valid MP3, go offline, tap Cow → kid sees a brief "offline" indicator or fallback to default sound (no white screen, no crash)
17. [ ] Upload a valid MP3, then open the same profile in a second tab → no conflict, both tabs show the uploaded sound

#### Premium gate
18. [ ] As a non-premium user, the Upload card shows a 🔒 padlock with "Premium" label
19. [ ] Tapping the upload button while non-premium shows a toast or modal: "Upgrade to Premium to upload custom sounds"
20. [ ] After premium is activated (mock Stripe), the 🔒 disappears and the upload UI is fully accessible

---

## Feature 2: Voice pitch shift (parent preview)

### Setup
- `localStorage.clear()`, reload https://animals.ashbi.ca/?v=v27-test
- Create a kid profile
- Long-press the Cow thing to record a 2–3 second "moo" (or use a pre-recorded blob if recording is unavailable in headless)
- Visit `/parent`, enter PIN `1234`
- Navigate to the Recordings list (or the Voice Effects card if recordings are shown there)

### Test steps

#### Happy path
1. [ ] Open the Voice Effects card or Recordings list in `/parent`
2. [ ] Locate the pitch-shift slider labelled "Pitch" with a range of –6 to +6 semitones
3. [ ] Drag the slider to +6 (highest pitch / squeak)
4. [ ] Tap "Preview" → audio plays at the +6 pitch-shifted rate (noticeably higher/faster)
5. [ ] Drag the slider to –6 (lowest pitch / monster voice)
6. [ ] Tap "Preview" → audio plays at the –6 pitch-shifted rate (noticeably lower/deeper)
7. [ ] Drag the slider back to 0 → audio plays at normal pitch
8. [ ] Verify the pitch value is displayed numerically next to the slider (e.g. "+3 semitones" or "3")
9. [ ] Change the pitch, tap Preview, change it again, tap Preview → each preview uses the current slider value

#### Edge cases
10. [ ] Set pitch to exactly0 → no pitch shift applied, normal playback
11. [ ] Set pitch to the minimum (–6), verify playback rate sounds correct (deepest possible)
12. [ ] Set pitch to the maximum (+6), verify playback rate sounds correct (highest possible)
13. [ ] Set pitch to a mid value (e.g. +3), refresh the page, return to the slider → value is NOT persisted (pitch is a live preview control, not stored)
14. [ ] If a recording exists, set pitch to +3, play the recording, then set pitch to –3, play again → the same recording plays at both pitches correctly

#### Failure modes
15. [ ] Set pitch to +6, tap Preview → audio plays without distortion or clipping artifacts
16. [ ] Set pitch to –6, tap Preview → audio plays without distortion or silence
17. [ ] While a pitch-shifted preview is playing, tap Preview again → the new preview starts, the old one stops (no overlapping audio)
18. [ ] Set pitch, tap Preview, then immediately close the card → no orphaned audio playing in the background

#### Premium gate
19. [ ] As a non-premium user, the pitch slider shows a 🔒 padlock and is disabled (not interactive)
20. [ ] Tapping the locked pitch slider shows a toast: "Premium feature — upgrade to unlock"
21. [ ] After premium is activated, the 🔒 disappears and the slider is fully interactive

---

## Feature 3: Premium tier card (parent)

### Setup
- `localStorage.clear()`, reload https://animals.ashbi.ca/?v=v27-test
- Visit `/parent`, set PIN to `1234`
- Confirm `premium: false` in localStorage (or confirm the mock Stripe UI shows "Not subscribed")

### Test steps

#### Happy path
1. [ ] Locate the Premium / Upgrade card in `/parent` dashboard
2. [ ] Verify the card displays the price: "$1.99/mo" or "$14.99/yr" (or both)
3. [ ] Verify the card shows the feature list: custom sound upload, pitch shift, extra profiles
4. [ ] Tap "Upgrade" or "Subscribe" button on the card
5. [ ] A Stripe Checkout overlay opens (or Lemon Squeezy overlay, depending on Cam's choice)
6. [ ] Complete the purchase flow in the overlay (use Stripe test card `4242 4242 4242 4242`)
7. [ ] After purchase, the overlay closes and the page returns to `/parent`
8. [ ] Verify `premium: true` is now set in localStorage
9. [ ] Verify the card updates to show "Premium ✦" or "Subscribed" state
10. [ ] Verify 🔒 badges disappear from the Custom Upload card and Pitch Shift slider

#### Edge cases
11. [ ] Open the upgrade flow, then click "Cancel" before entering payment details → overlay closes, premium remains `false`
12. [ ] Attempt to complete purchase with an expired test card → Stripe shows an error, premium remains `false`
13. [ ] Refresh the page after a successful purchase → premium remains `true` (persists across sessions)
14. [ ] Go to `/parent` in an incognito window (no premium) → the upgrade card still shows "Not subscribed"
15. [ ] If yearly and monthly plans are both shown, clicking "Monthly" shows monthly price, clicking "Yearly" shows yearly price

#### Failure modes
16. [ ] Webhook fails or is unreachable → premium flag is NOT flipped, user sees a friendly error: "Purchase pending — please try again in a moment"
17. [ ] Complete purchase, close tab before webhook fires → on next visit, premium flag is NOT set (webhook dependency); show a "Restore purchase" button on the card
18. [ ] Simulate a refund (Stripe refund API) → premium flag is flipped back to `false`, 🔒 badges reappear

#### Mock Stripe mode (if real Stripe is not yet configured)
19. [ ] If `stripeMock: true` in localStorage, the upgrade card shows a "Simulate Purchase" debug button
20. [ ] Tapping "Simulate Purchase" flips `premium: true` without opening any overlay
21. [ ] The mock mode button is hidden or labelled "(debug)" so it does not confuse real users
