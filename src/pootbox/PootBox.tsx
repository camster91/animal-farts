// PootBox — v46 multi-page sound toy.
// Rewritten from scratch to consume the v46 architecture:
// multi-page tabs, random bubble spawn, library picker, and recording flow.
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { Page, BubbleState, Ripple, BuiltInSound } from "./types";
import {
  BUILT_IN_SOUNDS,
  MAX_PAGES,
} from "./constants";
import {
  addBubbleToPageDedup,
  removeBubbleFromPage,
  generateShareCode,
  deleteBlob,
  deleteRecordingEmoji,
  createDefaultPage,
  savePage,
} from "./recordings";
import { playSingle, stopAllSounds } from "./audioManager";
import { useSettings } from "./hooks/useSettings";
import { useToast } from "./hooks/useToast";
import { useModalState } from "./hooks/useModalState";
import { usePagesState } from "./hooks/usePagesState";
import { useCanvasState } from "./hooks/useCanvasState";
import { useCanvasHandlers } from "./hooks/useCanvasHandlers";
import { usePhysicsLoop, useSoundPlaying } from "./hooks/usePhysicsLoop";
import { useRecording } from "./hooks/useRecording";
import SettingsModal from "./SettingsModal";
import BubbleCanvas from "./components/BubbleCanvas";
import CanvasEffects from "./components/CanvasEffects";
import TopBar from "./components/TopBar";
import AddSoundMenu from "./components/AddSoundMenu";
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
  const {
    pages, activePageId, homeCategory,
    setPages, setActivePageId, setHomeCategory,
    addPage, removePage, renamePage,
    savePagesDebounced,
  } = usePagesState();

  // Bubbles on active page (extracted to useCanvasState hook)
  const {
    bubbles, bubblesRef, setBubbles,
    pressedId,
    showPlayedFor, setShowPlayedFor,
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
  const {
    showLibrary,
    showSettings,
    showVolume,
    showShare,
    showAddMenu,
    showFirstRun,
    setShowLibrary,
    setShowSettings,
    setShowVolume,
    setShowShare,
    setShowAddMenu,
    setShowFirstRun,
  } = useModalState();

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

  const [soundPlaying, setSoundPlaying] = useSoundPlaying();

  // ── Physics loop + visual effects (extracted to usePhysicsLoop) ─────────
  const {
    ripples, setRipples, sparks, comboBurst, confettiBurst, confettiParticles,
    triggerComboBurst, triggerConfetti,
  } = usePhysicsLoop({
    bubblesRef,
    setBubbles,
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

  const onPickBuiltIn = useCallback(async (sound: BuiltInSound) => {
    if (!activePageId) return;
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
    const { pages: updatedPages, added } = addBubbleToPageDedup(pages, activePageId, bubble);
    if (!added) {
      showToast("Already on this page!");
      return;
    }
    setPages(updatedPages);
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
  const playFromBubble = useCallback((b: BubbleState, volume: number) => {
    try { navigator.vibrate(20); } catch { /* ignore */ }
    playSingle(b.sound, volume);
  }, []);

  // Tap handler: orquestrates ripple + sound + combo + lifetime + onboarding dismiss
  const handleBubbleTap = useCallback((id: string, clientX: number, clientY: number) => {
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) return;
    const now = performance.now();
    b.lastTouchedAt = now;

    playFromBubble(b, settingsRef.current.volume);
    spawnRipple(clientX, clientY);
    setShowPlayedFor(id);
    setTimeout(() => setShowPlayedFor(null), 800);

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

  // The 7 pointer event handlers (extracted to useCanvasHandlers)
  const {
    onBubblePointerDown,
    onBubblePointerMove,
    onBubblePointerUp,
    onBubblePointerCancel,
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

      {/* Bubble canvas */}
      <BubbleCanvas
        bubbles={bubbles}
        pressedId={pressedId}
        reducedMotion={settings.reducedMotion}
        showPlayedFor={showPlayedFor}
        onBubblePointerDown={onBubblePointerDown}
        onBubblePointerMove={onBubblePointerMove}
        onBubblePointerUp={onBubblePointerUp}
        onBubblePointerCancel={onBubblePointerCancel}
      />

      {/* Empty page hint */}
      {activePageId && pages.find(p => p.id === activePageId)?.bubbles.length === 0 && (
        <EmptyPageHint show={true} />
      )}

      {/* Page tabs */}
      <TopBar
        pages={pages}
        activePageId={activePageId ?? ""}
        onSelectPage={setActivePageId}
        onAddPage={addPage}
        onRenamePage={renamePage}
        onDeletePage={removePage}
        canDelete={pages.length > 1}
        volume={settings.volume}
        onVolumeClick={() => setShowVolume(true)}
        onShareClick={() => setShowShare("share")}
        onAddSoundClick={() => setShowAddMenu(true)}
      />

      {/* Home category chips — only on the default page */}
      {activePageId === "page:default" && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 150,
            background: "rgba(254, 243, 199, 0.95)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: "8px 16px",
            overflowX: "auto",
            whiteSpace: "nowrap",
            maxWidth: "100vw",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              gap: 8,
            }}
          >
            {[
              { label: "Animals", value: "animal" },
              { label: "Farts", value: "fart" },
              { label: "Silly", value: "silly" },
              { label: "Instruments", value: "instrument" },
            ].map(({ label, value }) => {
              const isActive = homeCategory === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    setHomeCategory(value);
                    // Sync default page bubbles immediately (no effect needed)
                    setPages(prev => {
                      const idx = prev.findIndex(p => p.id === "page:default");
                      if (idx === -1) return prev;
                      const updated = createDefaultPage(value);
                      const next = [...prev];
                      next[idx] = { ...updated, id: "page:default", createdAt: prev[idx].createdAt };
                      void savePage(next[idx]);
                      return next;
                    });
                  }}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    borderRadius: 16,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "Fredoka, system-ui, sans-serif",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    border: isActive ? "none" : "1px solid #E5E0D5",
                    background: isActive ? "#F59E0B" : "transparent",
                    color: isActive ? "#FFFFFF" : "#3D2C1E",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Add sound menu */}
      <AddSoundMenu
        onRecord={() => void startRecording()}
        onPickFromLibrary={() => setShowLibrary(true)}
        onAddNewPage={addPage}
        onOpenSettings={() => setShowSettings(true)}
        pagesCount={pages.length}
        maxPages={MAX_PAGES}
        show={showAddMenu}
        onShowChange={setShowAddMenu}
      />

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

      {/* Sound library */}
      {showLibrary && (
        <SoundLibrary
          builtInSounds={BUILT_IN_SOUNDS}
          alreadyAddedKeys={alreadyAddedKeys}
          onPick={onPickBuiltIn}
          onClose={() => setShowLibrary(false)}
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
