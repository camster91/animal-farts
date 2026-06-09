# PootBox kid test — observation sheet

**Date:** _____________  
**Kid tested:** _____________ (age: ___)  
**Device:** iPhone / iPad / Android / laptop  
**iOS / Chrome version:** _____________  
**Tester (you):** _____________  

## Setup (5 min)

1. Hard-refresh `https://animals.ashbi.ca` on the test device
2. Open the URL, hand the device to the kid. **Don't explain anything.** Don't say "tap a circle." Just hand it over.
3. Step back. Don't talk. Watch. Video-record the screen if you can (most useful single thing you can do).

The first 60 seconds tells you almost everything.

---

## What to look for (and what to write down)

### 1. The first 30 seconds (most important)

- [ ] Did they do something? (Tap, swipe, shake, do nothing)
- [ ] If nothing: how long until they gave up? ____ seconds
- [ ] If tapped: which emoji did they tap first? ________________
- [ ] Did they tap again? After how long? ____ seconds
- [ ] Did they look at the screen (engaged) or look at you (waiting for help)?

Write the **first word they said**, if any: ________________________________

### 2. The next 2 minutes

- [ ] Do they drag any circle? If yes, do they drop it on another circle or just release it?
- [ ] Do they tap rapidly? (Combo system fires at 2+ taps in 800ms — they don't need to know about it)
- [ ] Do they tap different circles or just the same one?
- [ ] Do they smile? When? What made them smile?
- [ ] Do they say "make it louder" or "do it again"?
- [ ] Do they try the + button? If yes, do they understand what it does?

### 3. The ＋ button (recording) — only if they get there

- [ ] Did they find the + button? (72px bottom-right — pretty big, but still hidden for 3-year-olds)
- [ ] If they tapped it, what happened? (mic permission prompt? recording UI? confusion?)
- [ ] If they recorded, did they play it back? Did they recognize their own voice?

### 4. How long did they stay engaged?

- [ ] They played for: ____ minutes ____ seconds
- [ ] What did they do at the end? Put the device down? Asked for another app? Asked for "more"?
- [ ] Did they ask to do it again later in the day?

### 5. What broke / what they got frustrated by

Watch for these specifically — they tell us what to fix next:

- [ ] Tapped a circle, no sound. (Audio bug. iOS audio prime may not have fired. Check the URL bar for 🔒.)
- [ ] Tried to drag a circle but it didn't move. (Touch-action: none issue. Browser-specific.)
- [ ] Got the "Microphone is blocked" banner. (Means permission was previously denied. Need to reset in Chrome settings.)
- [ ] Saw the onboarding overlay and didn't know what to do. (Means "Tap a circle!" isn't clear enough.)
- [ ] Hit the recording modal and got confused by the flow. (Modal click-outside-to-cancel? 4-step flow is too long?)
- [ ] Looked at the camera (looking for help, not understanding).
- [ ] Said "what do I do" within the first minute.

### 6. Their favorites

- [ ] Which animal did they tap the most? ________________
- [ ] Did they discover the drag-and-throw? If yes, what did they do with it? (Pile up? Throw at another? Just wave around?)
- [ ] Did they hit a combo and react? (×5 badge appears in top-right. Gold glow at ×5.)
- [ ] Did the confetti at 10 taps excite them? Or was it distracting?
- [ ] Did they try the hero circle (lion) in the center? Did the pulse help them know to tap it?

### 7. Their words (verbatim if possible)

Write down anything they said. Especially:
- The first word (if any)
- "I want to make it ___"
- "Why doesn't ___ work"
- "Can I ___"
- Any negative reactions ("boring", "stop", "no", or just putting the device down)

### 8. The parent's perspective (you)

After the test, answer these for yourself:

- [ ] Was the kid's first 30 seconds a win or a loss? _____________
- [ ] Did the app make them feel like a creator or a consumer? _____________
- [ ] What's the ONE thing to fix before showing it to another kid? _____________
- [ ] What's the ONE thing to keep that I'd be tempted to remove? _____________

---

## After the test

1. Save the screen recording if you got one (most useful artifact)
2. Fill out this sheet within an hour while it's fresh
3. Send me the answers — even just the first word and engagement duration
4. I'll write up what the test told us and what to change

---

## What I want to learn (and why)

| Question | Why it matters |
|---|---|
| Did they get past 30 seconds? | If no, the app is broken. The first impression is the only impression. |
| Did they discover drag? | The "throw into another circle = sound" is the unique mechanic. If they don't find it, we're just a static soundboard. |
| Did the recording flow work? | The 4-step flow is the thing I most doubt. Recording requires permission, modal click-outside, mic denied cases. If a kid taps +, gets confused, and gives up, we have a real bug. |
| Did the combo excite them? | I added combo / confetti in a vacuum. If a real kid finds it annoying, we cut it. |
| What broke? | Any single error they hit, we fix. |

---

## Optional: 5-min debrief (kid still in the room, or just after)

If they're still happy / engaged, ask:

1. "What's your favorite animal?" (Should match what they tapped most)
2. "Can you show me how to make a big noise?" (Tests if they understand throw-into-circle)
3. "Can you record your own sound?" (Tests the recording discoverability)
4. "What's the orange button?" (If they say "the ＋", they noticed it. If "I don't know", we have a discoverability problem.)

---

## What to send me

A 5-bullet summary is enough:

1. Age of kid
2. Engagement duration (did they last >2 min?)
3. The first word they said
4. What broke (if anything)
5. Your gut: ship it as-is, or cut more, or fix ___

I'll write the followup from there.
