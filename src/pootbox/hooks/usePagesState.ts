// usePagesState.ts — extracted from PootBox.tsx in v52-2
// Owns: pages, activePageId, homeCategory, savePagesDebounced, page CRUD
// Exposes: { pages, activePageId, setActivePageId, homeCategory, setHomeCategory,
//           addPage, removePage, renamePage, saveAll, setPages, savePagesDebounced }

import { useState, useEffect, useRef, useCallback } from "react";
import type { Page } from "../types";
import { MAX_PAGES, DEFAULT_PAGE_EMOJI } from "../constants";
import {
  loadAllPages,
  savePage,
  deletePagePure,
  deleteBlob,
  deleteRecordingEmoji,
  createDefaultPage,
} from "../recordings";

export function usePagesState() {
  // ── State ────────────────────────────────────────────────────────────────

  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [homeCategory, setHomeCategory] = useState<string>(() => {
    // v61: default to "all" so the home page shows every built-in
    // sound. Legacy "animal" / "fart" / "silly" / "instrument"
    // values still work for users who set them in a prior version.
    try {
      const v = localStorage.getItem("pootbox-home-category-v1");
      return v || "all";
    } catch { return "all"; }
  });

  // ── Refs ─────────────────────────────────────────────────────────────────

  const saveDebounceRef = useRef<number | null>(null);

  // ── Load pages on mount ─────────────────────────────────────────────────

  useEffect(() => {
    void loadAllPages().then((loaded) => {
      if (loaded.length === 0) {
        const defaultPage = createDefaultPage(homeCategory);
        setPages([defaultPage]);
        setActivePageId("page:default");
        void savePage(defaultPage);
      } else {
        setPages(loaded);
        setActivePageId(loaded[0].id);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist homeCategory ─────────────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem("pootbox-home-category-v1", homeCategory); } catch { /* best-effort */ }
  }, [homeCategory]);

  // ── Debounced save ───────────────────────────────────────────────────────

  const savePagesDebounced = useCallback((pagesToSave: Page[]) => {
    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = window.setTimeout(() => {
      void savePage(pagesToSave.find(p => p.id === activePageId) ?? pagesToSave[0]);
    }, 500);
  }, [activePageId]);

  // ── Save all immediately ────────────────────────────────────────────────

  const saveAll = useCallback(async (pagesToSave: Page[]) => {
    for (const p of pagesToSave) {
      await savePage(p);
    }
  }, []);

  // ── Add page ────────────────────────────────────────────────────────────

  const addPage = useCallback(() => {
    if (pages.length >= MAX_PAGES) return;
    // When adding the first new page (only the default exists), seed it with homeCategory bubbles
    const seedBubbles = pages.length === 1
      ? createDefaultPage(homeCategory).bubbles
      : [];
    const newPage: Page = {
      id: `page:${Date.now()}`,
      name: "New Page",
      emoji: DEFAULT_PAGE_EMOJI,
      bubbles: seedBubbles,
      createdAt: Date.now(),
    };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
    void savePage(newPage);
  }, [pages.length, homeCategory]);

  // ── Remove page ─────────────────────────────────────────────────────────

  const removePage = useCallback(async (pageId: string) => {
    const { pages: updatedPages, removedBlobs } = deletePagePure(pages, pageId);
    if (updatedPages.length === pages.length) return; // nothing changed

    // Delete blobs for custom recordings on this page
    for (const blobId of removedBlobs) {
      await deleteBlob(blobId);
      deleteRecordingEmoji(blobId);
    }

    setPages(updatedPages);

    // Switch to another page if the deleted one was active
    if (activePageId === pageId) {
      const remaining = updatedPages.filter(p => p.id !== pageId);
      setActivePageId(remaining[0]?.id ?? null);
    }

    // Persist all remaining pages
    for (const p of updatedPages) {
      void savePage(p);
    }
  }, [pages, activePageId]);

  // ── Rename page ─────────────────────────────────────────────────────────

  const renamePage = useCallback((pageId: string, newName: string, newEmoji: string) => {
    setPages(prev => {
      const updated = prev.map(p =>
        p.id === pageId ? { ...p, name: newName, emoji: newEmoji } : p
      );
      const changed = updated.find(p => p.id === pageId);
      if (changed) void savePage(changed);
      return updated;
    });
  }, []);

  return {
    // State
    pages,
    activePageId,
    homeCategory,
    // Setters
    setPages,
    setActivePageId,
    setHomeCategory,
    // CRUD
    addPage,
    removePage,
    renamePage,
    // Persistence
    saveAll,
    savePagesDebounced,
  };
}