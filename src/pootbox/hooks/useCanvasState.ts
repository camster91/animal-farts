import { useState, useEffect, useRef, useCallback } from "react";
import type { Page, BubbleState, Vec2 } from "../types";

// ─── Position spawner ────────────────────────────────────────────────────────

function spawnPositionsFor(bubbles: BubbleState[], w: number, h: number): Vec2[] {
  const positions: Vec2[] = [];
  for (const b of bubbles) {
    let attempts = 0;
    while (attempts < 50) {
      const x = b.radius + Math.random() * (w - b.radius * 2);
      const y = b.radius + Math.random() * (h - b.radius * 2 - 100);
      let ok = true;
      for (const p of positions) {
        const dx = x - p.x;
        const dy = y - p.y;
        if (dx * dx + dy * dy < (b.radius + 40) ** 2) { ok = false; break; }
      }
      if (ok) { positions.push({ x, y }); break; }
      attempts++;
    }
    if (attempts >= 50) {
      positions.push({
        x: b.radius + Math.random() * (w - b.radius * 2),
        y: b.radius + Math.random() * (h - b.radius * 2 - 100),
      });
    }
  }
  return positions;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseCanvasStateOptions {
  pages: Page[];
  activePageId: string | null;
  size: { w: number; h: number };
}

export interface UseCanvasStateResult {
  bubbles: BubbleState[];
  bubblesRef: React.MutableRefObject<BubbleState[]>;
  setBubbles: React.Dispatch<React.SetStateAction<BubbleState[]>>;
  pressedId: string | null;
  setPressedId: React.Dispatch<React.SetStateAction<string | null>>;
  showPlayedFor: string | null;
  setShowPlayedFor: React.Dispatch<React.SetStateAction<string | null>>;
  syncBubblesToActivePage: () => void;
  getBubbleById: (id: string) => BubbleState | undefined;
  markPressed: (id: string) => void;
  clearPressed: () => void;
  markPlayedFor: (id: string) => void;
  alreadyAddedKeys: Set<string>;
}

export function useCanvasState({
  pages,
  activePageId,
  size,
}: UseCanvasStateOptions): UseCanvasStateResult {
  const [bubbles, setBubbles] = useState<BubbleState[]>([]);
  const bubblesRef = useRef<BubbleState[]>([]);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [showPlayedFor, setShowPlayedFor] = useState<string | null>(null);

  // ── Sync bubblesRef when active page changes ──────────────────────────────

  const syncBubblesToActivePage = useCallback(() => {
    if (!activePageId || size.w === 0) return;
    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const needsSpawn = page.bubbles.every(b => b.pos.x === 0 && b.pos.y === 0);
    const positions = needsSpawn
      ? spawnPositionsFor(page.bubbles, size.w, size.h)
      : page.bubbles.map(b => b.pos);

    const synced = page.bubbles.map((b, i) => ({
      ...b,
      pos: positions[i] ?? b.pos,
      vel: { x: 0, y: 0 },
    }));

    // Write to the ref (physics source of truth). The state mirror
    // happens in the effect below so the ref→state setState call can
    // carry the lint-disable that documents why it's the right pattern
    // (the physics loop also writes to bubbles per-frame, so a
    // useMemo-derived bubbles would fight it).
    bubblesRef.current = synced;
  }, [activePageId, pages, size.w, size.h]);

  useEffect(() => {
    // Mirror the ref into React state once on mount + on page/size
    // change. The previous version only wrote the ref, so on the first
    // render after a sync the `bubbles` state was still `[]` — which
    // meant `alreadyAddedKeys` was empty and SoundLibrary would show
    // every built-in as not-yet-added, letting the kid double-add a
    // duplicate that the dedupe helper would then silently swallow
    // with an "Already on this page!" toast.
    syncBubblesToActivePage();
    setBubbles(bubblesRef.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [syncBubblesToActivePage]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getBubbleById = useCallback((id: string) => {
    return bubblesRef.current.find(b => b.id === id);
  }, []);

  const markPressed = useCallback((id: string) => {
    setPressedId(id);
  }, []);

  const clearPressed = useCallback(() => {
    setPressedId(null);
  }, []);

  const markPlayedFor = useCallback((id: string) => {
    setShowPlayedFor(id);
    setTimeout(() => setShowPlayedFor(null), 800);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const alreadyAddedKeys = new Set(bubbles.map(b => b.builtinKey).filter((k): k is string => !!k));

  return {
    bubbles,
    bubblesRef,
    setBubbles,
    pressedId,
    setPressedId,
    showPlayedFor,
    setShowPlayedFor,
    syncBubblesToActivePage,
    getBubbleById,
    markPressed,
    clearPressed,
    markPlayedFor,
    alreadyAddedKeys,
  };
}