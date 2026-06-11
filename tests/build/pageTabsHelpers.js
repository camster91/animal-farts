// Pure helpers for PageTabs — separated so lint doesn't complain about
// exporting non-components from a component file.
export function shouldTriggerLongPress(durationMs, movedPx) {
    return durationMs >= 800 && movedPx < 10;
}
export function trimName(name) {
    const trimmed = name.trim();
    if (trimmed.length === 0)
        return "Page";
    return trimmed.slice(0, 24);
}
