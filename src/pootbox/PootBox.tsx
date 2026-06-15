// PootBox — v46 multi-page sound toy.
// Rewritten from scratch to consume the v46 architecture:
// multi-page tabs, random bubble spawn, library picker, and recording flow.
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { Page, BubbleState, Ripple, BuiltInSound } from "./types";
import {
  BUILT_IN_SOUNDS,
} from "./constants";
import {
  addBubbleToPageDedup,
  removeBubbleFromPage,
  generateShareCode,
  deleteBlob,
  deleteRecordingEmoji,
  savePage,
} from "./recordings";
import { playSingle, stopAllSounds, getCurrentBubbleId } from "./audioManager";
import { useSettings } from "./hooks/useSettings";
import { useToast } from "./hooks/useToast";
import { useModalState } from "./hooks/useModalState";
import { usePagesState } from "./hooks/usePagesState";
import { useCanvasState } from "./hooks/useCanvasState";
import { useCanvasHandlers } from "./hooks/useCanvasHandlers";
import { usePhysicsLoop, useSoundPlaying } from "./hooks/usePhysicsLoop";
import { useRecording } from "./hooks/useRecording";
import SettingsModal from "./SettingsModal";
import CardGrid from "./components/CardGrid";
import CanvasEffects from "./components/CanvasEffects";
import RecordSheet from "./components/RecordSheet";
import SoundLibrary from "./components/SoundLibrary";
import EmptyPageHint from "./components/EmptyPageHint";
import FirstRunIntro from "./components/FirstRunIntro";
import ShareSheet from "./components/ShareSheet";
import VolumeSlider from "./components/VolumeSlider";
import InstallPrompt from "./components/InstallPrompt";
import UpdatePrompt from "./components/UpdatePrompt";
import FooterBar from "./components/FooterBar";

// ─── Main component ─────────────────────────────────────────────────────────

export default function PootBox() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Pages state (extracted to usePagesState hook)
  // v65: homeCategory + setHomeCategory no longer surfaced in
  // the visible chrome (the home-category chips were removed in
  // v65). usePagesState still owns them internally for the
  // SoundLibrary → usePagesState → createDefaultPage wiring.
  const {
    pages, activePageId,
    setPages, setActivePageId,
    savePagesDebounced,
  } = usePagesState();

  // Bubbles on active page (extracted to useCanvasState hook)
  // v61: the card grid only needs `bubbles` + `alreadyAddedKeys` from
  // the canvas-state slice. `bubblesRef` is still used by the
  // physics loop + the onCollisionSound callback in
  // usePhysicsLoop. `pressedId` + `showPlayedFor` +
  // `setShowPlayedFor` were physics-canvas-only and are now unused.
  const {
    bubbles,
    bubblesRef,
    alreadyAddedKeys,
  } = useCanvasState({ pages, activePageId, size });

  // Sheets / modals
  // Settings (extracted to useSettings hook)
  const { settings, settingsRef, setSettings, setVolume } = useSettings();

  // Recording (extracted to useRecording hook)
  const {
    recPhase, recordingMs, micDenied, micPermState,
    startRecording, stopRecording, cancelRecording,
    finalizeRecording,
  } = useRecording({
    onBubbleAdded: (bubble) => {
      if (!activePageId) return;
      const { pages: updatedPages, added } = addBubbleToPageDedup(pages, activePageId, bubble);
      if (!added) {
        showToast("Already on this page!");
        return;
      }
      setPages(updatedPages);
    },
    // v60: confirm the recording saved. Fires AFTER the local IDB
    // write succeeds; failure path returns early inside the hook.
    onSaved: (bubble) => {
      showToast(`${bubble.emoji} Saved!`);
    },
    onUploadComplete: (bubbleId, serverAudioUrl) => {
      // The fire-and-forget server upload succeeded. Swap the bubble's
      // blobUrl + sound from the dead blob: URL to the server-issued
      // /uploads/... path so the recording survives a page reload
      // (closes the v56-5 gap for this recording). The local IDB
      // copy is still there as a fallback if the server file is
      // ever moved/deleted.
      if (!activePageId) return;
      setPages((prev) => prev.map((p) => {
        if (p.id !== activePageId) return p;
        return {
          ...p,
          bubbles: p.bubbles.map((b) =>
            b.id === bubbleId
              ? { ...b, blobUrl: serverAudioUrl, sound: serverAudioUrl }
              : b
          ),
        };
      }));
      // The pages state will be saved to IDB by the existing pages-state
      // auto-save effect (bubbles changes trigger a save). On next page
      // load, the bubble renders with the server URL, not the dead
      // blob: URL.
    },
    onError: (msg) => { showToast(msg); },
  });

  // Audio state
  // Audio state (soundPlaying is set by useSoundPlaying below)

  // Combo count (drives the badge in the render block)
  const [comboCount, setComboCount] = useState(0);

  // Combo + confetti (driven by the tap handler below) — these states are
  // owned by usePhysicsLoop; PootBox just renders them.


  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !(localStorage.getItem("pootbox-onboarded-v1") || localStorage.getItem("pootbox-onboarded-v2"));
    } catch { return true; }
  });

  // Toast (extracted to useToast hook)
  const { toastMessage, showToast } = useToast();

  // Lookup input prefill — set when the user taps the "self-test"
  // link in share mode. The key on the <ShareSheet> below is
  // derived from this so a re-mount reads the new initial value.
  const [lookupPrefill, setLookupPrefill] = useState("");

  // Modal/sheet open state (extracted to useModalState hook)
  // v61: removed showAddMenu / setShowAddMenu (the AddSoundMenu
  // FAB is gone; the + Add sound card in the grid opens the
  // SoundLibrary instead). Removed showShare setter is still
  // used for the share-modal.
  const {
    showLibrary,
    showSettings,
    showVolume,
    showShare,
    showFirstRun,
    setShowLibrary,
    setShowSettings,
    setShowVolume,
    setShowShare,
    setShowFirstRun,
  } = useModalState();

  // v61: which bubble the user is changing the sound of.
  // null = "Add" mode (no target — picker creates a new card).
  // string = "Change" mode (picker mutates this bubble's sound).
  const [changingBubbleId, setChangingBubbleId] = useState<string | null>(null);

  // Refs (only the ones still used by PootBox: shake detection, drag, ripple IDs,
  // tap tracking, last-played-circle). The physics loop owns rafRef, lastFrameRef,
  // lastDriftNudgeAtRef, collisionCooldownRef, sparkIdRef — they live in usePhysicsLoop now.)
  const lastShakeAtRef = useRef(0);
  const shakeCountRef = useRef(0);
  const shakeWindowTimerRef = useRef<number | null>(null);
  const blankHoldTimer = useRef<number | null>(null);
  const rippleIdRef = useRef(0);
  const lifetimeTapsRef = useRef(0);
  const comboCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const comboResetTimerRef = useRef<number | null>(null);

  // Toast helper
  // (no longer needed — useToast hook provides showToast)

  // ── Measure canvas ─────────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Shake detection ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (mag > 18) {
        const now = Date.now();
        if (now - lastShakeAtRef.current > 1000) {
          shakeCountRef.current = 0;
          lastShakeAtRef.current = now;
        }
        shakeCountRef.current++;
        lastShakeAtRef.current = now;
        if (shakeWindowTimerRef.current) window.clearTimeout(shakeWindowTimerRef.current);
        shakeWindowTimerRef.current = window.setTimeout(() => { shakeCountRef.current = 0; }, 2000);
        if (shakeCountRef.current >= 3) {
          stopAllSounds();
          setSoundPlaying(false);
          showToast("🛑 Shaken!");
          setShowSettings(true);
          shakeCountRef.current = 0;
          // Nudge all bubbles
          for (const b of bubblesRef.current) {
            b.vel.x += (Math.random() - 0.5) * 5;
            b.vel.y += (Math.random() - 0.5) * 5;
            b.lastTouchedAt = now;
          }
        }
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
    // setSoundPlaying and showToast are stable (useState setter), so
    // an empty deps array is intentional — the handler captures the
    // latest refs but doesn't need to auto-update when they change.
  }, []);

  // ── Sound playing poll (extracted to useSoundPlaying) ─────────────────
  // v59: also reads the currently-playing bubble id (3rd tuple element)
  // so BubbleCanvas can render a pulse on the bubble that is live.
  const [soundPlaying, setSoundPlaying, currentBubbleId] = useSoundPlaying();

  // ── Physics loop + visual effects (extracted to usePhysicsLoop) ─────────
  // v61: the physics loop is now JUST for visual effects
  // (ripples, sparks, combo bursts, confetti). The physics
  // step itself is a no-op — bubbles don't move in the card
  // grid. setBubbles is passed as a no-op since the loop
  // expects to trigger re-renders after collision, but
  // collisions don't happen in the grid.
  const noopSetBubbles = useCallback((_b: BubbleState[]) => { /* no-op */ }, []);
  const {
    ripples, setRipples, sparks, comboBurst, confettiBurst, confettiParticles,
    triggerComboBurst, triggerConfetti,
  } = usePhysicsLoop({
    bubblesRef,
    setBubbles: noopSetBubbles,
    size,
    settingsRef,
    onCollisionSound: (b, vol) => {
      // Play the more-recently-touched bubble's sound (the one the user was holding)
      const other = bubblesRef.current.find(x => x.id !== b.id);
      if (other && other.lastTouchedAt > b.lastTouchedAt) {
        playSingle(other.sound, vol);
      } else {
        playSingle(b.sound, vol);
      }
    },
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (comboResetTimerRef.current) window.clearTimeout(comboResetTimerRef.current);
      if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
      if (shakeWindowTimerRef.current) window.clearTimeout(shakeWindowTimerRef.current);
    };
  }, []);

  // ── Add built-in sound to page ────────────────────────────────────────
  //
  // v61 unified: works for both "Add" mode (targetBubbleId is
  // undefined → create a new bubble) and "Change" mode (targetBubbleId
  // is set → swap the bubble's sound + emoji + builtinKey in place).
  // The dedup check is skipped in "Change" mode since you're picking
  // a different sound for an existing card.

  const onPickBuiltIn = useCallback(async (sound: BuiltInSound, targetBubbleId?: string) => {
    if (!activePageId) return;

    if (targetBubbleId) {
      // Change mode: mutate the existing bubble in place.
      setPages((prev) => prev.map((p) => {
        if (p.id !== activePageId) return p;
        return {
          ...p,
          bubbles: p.bubbles.map((b) =>
            b.id === targetBubbleId
              ? { ...b, type: "built-in", emoji: sound.emoji, builtinKey: sound.key, sound: sound.file }
              : b
          ),
        };
      }));
      setShowLibrary(false);
      return;
    }

    // Add mode: create a new bubble. Use a stable id so the same
    // sound can be added twice on the same page (the original
    // addBubbleToPageDedup was strict; for the kid-facing flow,
    // duplicates are fine).
    const bubble: BubbleState = {
      id: `b:built-in:${sound.key}:${Date.now()}`,
      type: "built-in",
      emoji: sound.emoji,
      builtinKey: sound.key,
      sound: sound.file,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 36,
      mass: 1,
      lastTouchedAt: -1,
      lastReleasedAt: -1,
    };
    setPages((prev) => prev.map((p) => {
      if (p.id !== activePageId) return p;
      return { ...p, bubbles: [...p.bubbles, bubble] };
    }));
    setShowLibrary(false);
  }, [activePageId, pages, showToast]);

  // ── Remove bubble ─────────────────────────────────────────────────────

  const onRemoveBubble = useCallback(async (id: string) => {
    if (!activePageId) return;
    if (id.startsWith("b:custom:")) {
      const b = bubbles.find(x => x.id === id);
      if (b?.blobUrl) URL.revokeObjectURL(b.blobUrl);
      await deleteBlob(id);
      deleteRecordingEmoji(id);
    }
    const updated = await removeBubbleFromPage(activePageId, id);
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, [activePageId, bubbles]);

  // ── Canvas pointer handlers + drag + 5s long-press (extracted to useCanvasHandlers) ──

  // Spawn ripple (effect-only helper, stays in PootBox because it only touches
  // local ripples state — not a "handler" responsibility)
  const spawnRipple = useCallback((x: number, y: number, color = "rgba(255,255,255,0.5)") => {
    const id = ++rippleIdRef.current;
    setRipples((prev: Ripple[]) => [...prev, { id, x, y, color }]);
    setTimeout(() => setRipples((prev: Ripple[]) => prev.filter((r: Ripple) => r.id !== id)), 700);
  }, []);

  // Play a sound from a bubble. The single-voice policy in audioManager.ts
  // already stops the previous sound before playing the new one, so we
  // don't need a per-bubble debounce — kids can spam the same emoji
  // and each tap feels instant.
  //
  // v59: passes bubble.id so audioManager can track which bubble is
  // currently playing (used by the canvas to show a pulse state, and
  // by the tap handler to detect "tap the playing bubble" → stop
  // instead of restart).
  const playFromBubble = useCallback((b: BubbleState, volume: number) => {
    try { navigator.vibrate(20); } catch { /* ignore */ }
    playSingle(b.sound, volume, b.id);
  }, []);

  // Tap handler: orquestrates ripple + sound + combo + lifetime + onboarding dismiss
  // v59: if the tapped bubble is the currently-playing one, stop the
  // sound instead of restarting it. Lets the kid silence a specific
  // bubble without finding the ⏹ button.
  const handleBubbleTap = useCallback((id: string, clientX: number, clientY: number) => {
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) return;
    const now = performance.now();
    b.lastTouchedAt = now;

    if (getCurrentBubbleId() === id) {
      // Tapping the playing bubble = stop it. The ripple still
      // fires so the kid gets the tactile confirmation. v61:
      // the card's amber ring + pulse (driven by playingBubbleId
      // from useSoundPlaying) is the playing-state indicator;
      // the old ♪-badge is gone.
      stopAllSounds();
      setSoundPlaying(false);
      spawnRipple(clientX, clientY);
      return;
    }

    playFromBubble(b, settingsRef.current.volume);
    spawnRipple(clientX, clientY);

    // Combo (decay after 800ms idle)
    let newCombo: number;
    if (now - lastTapAtRef.current < 800) {
      newCombo = comboCountRef.current + 1;
    } else {
      newCombo = 1;
    }
    setComboCount(newCombo);
    comboCountRef.current = newCombo;
    lastTapAtRef.current = now;
    if (comboResetTimerRef.current) window.clearTimeout(comboResetTimerRef.current);
    comboResetTimerRef.current = window.setTimeout(() => {
      comboCountRef.current = 0;
    }, 800);

    // Combo burst at every 5th
    if (newCombo % 5 === 0) triggerComboBurst(clientX, clientY, newCombo);

    // Lifetime taps → confetti every 10
    const newLifetime = lifetimeTapsRef.current + 1;
    lifetimeTapsRef.current = newLifetime;
    if (newLifetime % 10 === 0) triggerConfetti();

    // Dismiss onboarding on first tap
    if (showOnboarding) {
      setShowOnboarding(false);
      try { localStorage.setItem("pootbox-onboarded-v2", "1"); } catch { /* ignore */ }
    }
  }, [playFromBubble, spawnRipple, showOnboarding, triggerComboBurst, triggerConfetti]);

  // v61: only the blank-canvas pointer handlers are still used
  // (5-second long-press to open settings, retained as a parent
  // affordance). The bubble pointer handlers (down/move/up/cancel)
  // are dead — the CardGrid uses onClick + onChangeSound instead
  // and there's no per-bubble drag.
  const {
    onBlankPointerDown,
    onBlankPointerMove,
    onBlankPointerUp,
  } = useCanvasHandlers({
    canvasRef,
    bubblesRef,
    activePageId,
    setPages,
    onRemoveBubble,
    savePagesDebounced,
    onBubbleTap: handleBubbleTap,
    onSettingsOpen: () => setShowSettings(true),
  });

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
        touchAction: "none",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        overflow: "hidden",
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
      onPointerDown={onBlankPointerDown}
      onPointerMove={onBlankPointerMove}
      onPointerUp={onBlankPointerUp}
      onPointerCancel={onBlankPointerUp}
    >
      <FirstRunIntro
        show={showFirstRun}
        onDone={() => {
          localStorage.setItem("pootbox-firstrun-done", "1");
          setShowFirstRun(false);
        }}
      />

      {/* Card grid — v61 "simple" mode. Replaces the physics canvas
          with a static grid. Each card is a tap-to-play button; a
          small pencil button opens the sound picker; a + card at
          the end of the grid opens the picker to add a new sound. */}
      <CardGrid
        bubbles={bubbles}
        builtInSounds={BUILT_IN_SOUNDS}
        reducedMotion={settings.reducedMotion}
        playingBubbleId={currentBubbleId}
        onTapBubble={handleBubbleTap}
        onChangeSound={(id) => {
          setChangingBubbleId(id);
          setShowLibrary(true);
        }}
        onAddCard={() => {
          setChangingBubbleId(null);
          setShowLibrary(true);
        }}
        onDeleteCard={async (id) => {
          // v61: delete a custom card. The original onRemoveBubble
          // also revokes the blob: URL; for v61 share-imported
          // bubbles (b:shared:*) we just leave the blobUrl alone.
          if (!activePageId) return;
          if (id.startsWith("b:custom:")) {
            const b = bubbles.find(x => x.id === id);
            if (b?.blobUrl?.startsWith("blob:")) URL.revokeObjectURL(b.blobUrl);
            try { await deleteBlob(id); } catch { /* ignore */ }
            try { deleteRecordingEmoji(id); } catch { /* ignore */ }
          }
          const updated = await removeBubbleFromPage(activePageId, id);
          setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
          showToast("Card removed");
        }}
      />

      {/* Empty page hint */}
      {activePageId && pages.find(p => p.id === activePageId)?.bubbles.length === 0 && (
        <EmptyPageHint show={true} />
      )}

      {/* v61: top bar = a single settings gear + a small "💨" title.
          No page tabs (v61 is single-page). No FAB (the + Add
          sound card at the end of the grid is the entry point).
          The ShareSheet is reached from the settings modal. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "rgba(254, 243, 199, 0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 200,
          borderBottom: "1px solid rgba(61,44,30,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Fredoka, system-ui, sans-serif",
            fontSize: "1.05rem",
            fontWeight: 700,
            color: "#3D2C1E",
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>💨</span>
          <span>PootBox</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowShare("share")}
            aria-label="Share"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(61,44,30,0.75)",
              border: "none",
              cursor: "pointer",
              color: "white",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            🔗
          </button>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(61,44,30,0.75)",
              border: "none",
              cursor: "pointer",
              color: "white",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* v62: home-category chips removed. The v61 default page
          shows all 30 built-in sounds, so the kid sees every
          card at once. The v46-era chip filter (Animals / Farts
          / Silly / Instruments) made sense when the home page
          had only 12 animals and the kid wanted to filter down.
          With 30 cards in a responsive grid, the chip filter
          was dead weight that ALSO overlapped the top of the
          first row of cards (chips were at top:56-88, grid
          started at top:72). Removing the chips:
            - clears the layout collision
            - keeps the "simple and fun" v62 surface uncluttered
            - the kid can still pick a specific bucket by using
              the SoundLibrary modal (which has a chip filter at
              the top)
          usePagesState still owns homeCategory + setHomeCategory
          for the SoundLibrary → usePagesState → createDefaultPage
          wiring; homeCategory is just no longer surfaced as a
          visible UI control. */}

      {/* Volume slider popover */}
      <VolumeSlider
        show={showVolume}
        volume={settings.volume}
        onChange={(v) => {
          setVolume(v);
          setShowVolume(false);
        }}
        position={{ top: 64, left: window.innerWidth - 320 }}
      />

      {/* Share sheet */}
      {(showShare === "share" || showShare === "lookup") && (
        <ShareSheet
          // key combines mode + lookupPrefill so any change
          // (mode flip, self-test, normal close+reopen with new
          // prefill) remounts the sheet with fresh useState.
          key={`${showShare}|${lookupPrefill}`}
          mode={showShare === "share" ? "share" : "lookup"}
          pageName={pages.find(p => p.id === activePageId)?.name ?? "Untitled"}
          onClose={() => {
            setShowShare("none");
            setLookupPrefill(""); // clear the prefill so the next
              // open in lookup mode doesn't show a stale code
          }}
          onGenerateCode={async () => generateShareCode()}
          lookupPrefill={lookupPrefill}
          onCopyCode={(c) => {
            try { void navigator.clipboard?.writeText(c); } catch { /* ignore */ }
            // Confirm the copy to the user. The clipboard write is
            // best-effort (iOS Safari blocks it without a user
            // gesture, some browsers require a permission prompt)
            // — the toast fires regardless so the user knows we tried.
            showToast("Copied to clipboard ✓");
          }}
          onSelfTest={(code) => {
            // Switch the sheet to lookup mode and pre-fill the input
            // with the same code. The ShareSheet internal state holds
            // the input value; we re-mount via the key prop below so
            // the new lookupPrefill is read by useState's initializer.
            setShowShare("lookup");
            setLookupPrefill(code);
          }}
          onLookupCode={async (code) => {
            if (!navigator.onLine) return { __offline: true, code };
            try {
              const r = await fetch(`/api/share/${code}`);
              if (!r.ok) return null;
              return await r.json();
            } catch { return null; }
          }}
          onAddAsPage={(data) => {
            const newPage: Page = {
              id: `page:share-${data.code}-${Date.now()}`,
              name: data.name || `Shared ${data.code}`,
              emoji: data.emoji || "🔗",
              bubbles: [{
                id: `b:shared:${data.code}:${Date.now()}`,
                type: "custom",
                emoji: data.emoji || "🔗",
                blobUrl: data.audioUrl,
                pos: { x: 0, y: 0 },
                vel: { x: 0, y: 0 },
                radius: 36,
                mass: 1,
                sound: data.audioUrl,
                lastTouchedAt: -1,
                lastReleasedAt: -1,
              }],
              createdAt: Date.now(),
            };
            setPages((prev) => [...prev, newPage]);
            setActivePageId(newPage.id);
            void savePage(newPage);
            setShowShare("none");
          }}
        />
      )}

      {/* v61: AddSoundMenu removed. The + Add sound card in the
          grid opens the SoundLibrary, which has a "Record your
          own" CTA at the top. The RecordSheet still renders
          when recPhase !== "idle". */}

      {/* Visual-only effects layer (ripples, sparks, combo, confetti).
          The stop button and mic-denied banner stay inline below because
          they need setSoundPlaying and recPhase from the parent. */}
      <CanvasEffects
        ripples={ripples}
        sparks={sparks}
        comboBurst={comboBurst}
        confettiBurst={confettiBurst}
        confettiParticles={confettiParticles}
        comboCount={comboCount}
      />

      {/* Stop button */}
      {soundPlaying && (
        <button
          onClick={() => { stopAllSounds(); setSoundPlaying(false); }}
          aria-label="Stop all sounds"
          style={{
            position: "fixed",
            bottom: "calc(20px + env(safe-area-inset-bottom))",
            right: 20,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(255,82,82,0.95)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 16px rgba(255,82,82,0.35)",
            fontSize: "1.4rem",
            lineHeight: 1,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            color: "white",
            zIndex: 50,
            animation: "pootbox-pulse-stop 1s ease-in-out infinite",
          }}
        >
          ⏹
        </button>
      )}

      {/* Mic denied banner */}
      {micDenied && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            right: 16,
            background: "rgba(255,82,82,0.95)",
            color: "white",
            borderRadius: 16,
            padding: "12px 16px",
            zIndex: 150,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ flex: 1 }}>
            {micPermState === "denied"
              ? "Microphone blocked. Tap the lock 🔒 in the address bar → Site settings → Allow."
              : "Microphone access denied. Tap + again to allow."}
          </span>
          <button
            onClick={() => { void startRecording(); }}
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.15)",
              color: "white",
              borderRadius: 10,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Recording sheet */}
      {recPhase === "recording" || recPhase === "picking" ? (
        <RecordSheet
          recPhase={recPhase}
          recordingMs={recordingMs}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          onPickEmoji={finalizeRecording}
          onRedo={async () => {
            cancelRecording();
            await startRecording();
          }}
        />
      ) : null}

      {/* Sound library — v61: same modal, two modes (Add vs Change).
          The 'alreadyAddedKeys' grey-out is suppressed in Change mode
          so the kid can pick the same sound (no-op) or any other.
          Also handles the "Record your own" CTA in the modal
          header — closes the picker and starts mic capture. */}
      {showLibrary && (
        <SoundLibrary
          builtInSounds={BUILT_IN_SOUNDS}
          alreadyAddedKeys={changingBubbleId ? new Set<string>() : alreadyAddedKeys}
          onPick={(sound) => {
            onPickBuiltIn(sound, changingBubbleId ?? undefined);
            setChangingBubbleId(null);
          }}
          onRecord={() => {
            setShowLibrary(false);
            setChangingBubbleId(null);
            void startRecording();
          }}
          onClose={() => {
            setShowLibrary(false);
            setChangingBubbleId(null);
          }}
        />
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={s => setSettings(s)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Stop button */}

      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: "10px 20px",
          borderRadius: 24,
          zIndex: 1000,
          fontFamily: "Fredoka, system-ui, sans-serif",
          fontSize: "0.95rem",
        }}>
          {toastMessage}
        </div>
      )}

      <FooterBar
        installBanner={<InstallPrompt />}
        updateBanner={<UpdatePrompt />}
      />

      <style>{`
        @keyframes pootbox-ripple {
          0% { width: 0; height: 0; opacity: 0.8; }
          100% { width: 200px; height: 200px; opacity: 0; }
        }
        @keyframes pootbox-spark {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.3); opacity: 0; }
        }
        @keyframes pootbox-pulse-stop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        /* v59: brief scale-up on tap. The "180ms ease-out" is a quick
           pop, not a sustained animation. */
        @keyframes pootbox-bubble-tap {
          0% { transform: scale(0.92); }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        /* v59: continuous pulse on the currently-playing bubble.
           The amber ring + this 1.2s scale loop makes it obvious
           which bubble is "live" without occluding the emoji. */
        @keyframes pootbox-bubble-playing {
          0%, 100% { transform: scale(1.06); }
          50% { transform: scale(1.14); }
        }
        /* v62: continuous pulse on the currently-playing card in
           the new CardGrid view. Same intent as
           pootbox-bubble-playing (above) but tuned for the
           card-grid layout — scale slightly less aggressively
           (1.05 vs 1.14) and start from a more neutral 1.0
           baseline so the card doesn't "grow" off its grid
           cell. Suppressed under reduced-motion. */
        @keyframes pootbox-card-playing {
          0%, 100% { transform: scale(1.05); }
          50%      { transform: scale(1.12); }
        }
        @keyframes pootbox-combo-star {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.4) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes pootbox-confetti {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 200px)) scale(0.6) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
