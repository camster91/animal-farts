import { useState } from "react";
import type { FC } from "react";
import type { BubbleState, BuiltInSound } from "../types";

interface CardGridProps {
  bubbles: BubbleState[];
  builtInSounds: BuiltInSound[];
  reducedMotion: boolean;
  playingBubbleId: string | null;
  customNames?: Map<string, string>;
  onTapBubble: (id: string, clientX: number, clientY: number) => void;
  onChangeSound: (bubbleId: string) => void;
  onRenameCard?: (bubbleId: string) => void;
  onAddCard: () => void;
  onDeleteCard?: (bubbleId: string) => void;
  onUpvoteBubble?: (bubbleId: string) => void;
  upvoteEligible?: Set<string>;
  reactions?: Map<string, { counts: Record<string, number>; mine: string[] }>;
  onReactBubble?: (bubbleId: string, emoji: string) => void;
  onOpenComments?: (bubbleId: string) => void;
}

type Category = "all" | "animal" | "fart" | "silly" | "custom";
const categories: { key: Category; label: string; emoji: string }[] = [
  { key: "all", label: "All sounds", emoji: "✦" },
  { key: "animal", label: "Animals", emoji: "🐻" },
  { key: "fart", label: "Farts", emoji: "💨" },
  { key: "silly", label: "Silly", emoji: "🤪" },
  { key: "custom", label: "My sounds", emoji: "🎙️" },
];
const PAGE_SIZE = 24;

const CardGrid: FC<CardGridProps> = ({
  bubbles, builtInSounds, reducedMotion, playingBubbleId, customNames,
  onTapBubble, onChangeSound, onRenameCard, onAddCard, onDeleteCard,
  onUpvoteBubble, upvoteEligible, reactions, onReactBubble, onOpenComments,
}) => {
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const metadata = new Map(builtInSounds.map(sound => [sound.key, sound]));
  const label = (bubble: BubbleState) => bubble.type === "custom"
    ? customNames?.get(bubble.id) || "My Sound"
    : metadata.get(bubble.builtinKey || "")?.name || "Sound";
  const matches = bubbles.filter(bubble => {
    const bucket = bubble.type === "custom" ? "custom" : metadata.get(bubble.builtinKey || "")?.bucket;
    return (category === "all" || category === bucket) && label(bubble).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  // Personal recordings always remain visible on the unfiltered board, including
  // a newly recorded sound. Browsing never changes or removes stored cards.
  const personal = matches.filter(bubble => bubble.type === "custom");
  const builtInMatches = matches.filter(bubble => bubble.type !== "custom");
  const groups = ["animal", "fart", "silly"].map(bucket => builtInMatches.filter(bubble =>
    (metadata.get(bubble.builtinKey || "")?.bucket || "silly") === bucket));
  const builtIn = category === "all"
    ? Array.from({ length: Math.max(0, ...groups.map(group => group.length)) }, (_, index) =>
      groups.flatMap(group => group[index] ? [group[index]] : [])).flat()
    : builtInMatches;
  const visible = [...personal, ...builtIn.slice(0, visibleCount)];
  const remaining = Math.max(0, builtIn.length - visibleCount);

  const addSound = () => {
    setCategory("all"); setQuery(""); setVisibleCount(PAGE_SIZE);
    onAddCard();
  };

  return (
    <main className={`pb-board${reducedMotion ? " reduce-motion" : ""}`} aria-labelledby="soundboard-title">
      <div className="pb-board-inner">
        <div className="pb-board-heading">
          <div>
            <p className="pb-eyebrow">A little tap. A lot of silly.</p>
            <h1 id="soundboard-title">Let's make some noise.</h1>
            <p className="pb-board-hint">Pick a sound to play. Tap it again to stop.</p>
          </div>
          <button type="button" className="pb-add-sound" onClick={addSound} aria-label="Add a new sound card" data-add-card>
            <span aria-hidden="true">＋</span> Add sound
          </button>
        </div>

        <div className="pb-board-tools">
          <div className="pb-categories" role="group" aria-label="Sound categories">
            {categories.map(item => (
              <button key={item.key} type="button" aria-pressed={category === item.key}
                onClick={() => { setCategory(item.key); setVisibleCount(PAGE_SIZE); }}>
                <span aria-hidden="true">{item.emoji}</span> {item.label}
              </button>
            ))}
          </div>
          <div className="pb-board-search-row">
            <label className="pb-board-search">
              <span aria-hidden="true">⌕</span>
              <span className="pb-sr-only">Find a sound</span>
              <input type="search" placeholder="Find a sound…" value={query}
                onChange={event => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} />
            </label>
            <button type="button" className="pb-edit-toggle" aria-pressed={editing} onClick={() => setEditing(!editing)}>
              {editing ? "✓ Done" : "Edit sounds"}
            </button>
          </div>
        </div>

        <div className="pb-board-caption">
          <p role="status">{matches.length === 0 ? "No sounds found" : `${visible.length} of ${matches.length} sounds`}</p>
          <span>{editing ? "Choose a card to change its sound" : "Made for little giggles"}</span>
        </div>

        <div className="pb-sound-grid" aria-label="Sound cards">
          {visible.map(bubble => {
            const name = label(bubble);
            const isCustom = bubble.type === "custom";
            const isPlaying = playingBubbleId === bubble.id;
            const bucket = isCustom ? "custom" : metadata.get(bubble.builtinKey || "")?.bucket || "silly";
            const hasActions = editing || isCustom;
            return (
              <div key={bubble.id} className={`pootbox-card pb-sound-${bucket}${isPlaying ? " is-playing" : ""}`}
                data-bubble-id={bubble.id}>
                <button type="button" className="pb-card-play" aria-pressed={isPlaying}
                  aria-label={`${name} — tap to play${isPlaying ? " (playing — tap to stop)" : ""}`}
                  onClick={event => {
                    try { navigator.vibrate(20); } catch { /* optional haptics */ }
                    onTapBubble(bubble.id, event.clientX, event.clientY);
                  }}>
                  <span className="pb-card-emoji" aria-hidden="true">{bubble.emoji}</span>
                  <span className="pb-card-name" data-card-label>{name}</span>
                  <span className="pb-card-state" aria-hidden="true">{isPlaying ? "■ Playing" : isCustom ? "Your recording" : "▶ Tap to play"}</span>
                </button>
                {hasActions && (
                  <div className="pb-card-actions" data-card-actions>
                    {isCustom && onRenameCard && <button type="button" onClick={() => onRenameCard(bubble.id)} aria-label={`Rename ${name}`}>Rename</button>}
                    {editing && <button type="button" onClick={() => onChangeSound(bubble.id)} aria-label={`Change ${name} sound`}>Change</button>}
                    {isCustom && onDeleteCard && <button type="button" className="pb-card-delete" onClick={() => onDeleteCard(bubble.id)} aria-label={`Delete ${name}`}>Remove</button>}
                  </div>
                )}
                {upvoteEligible?.has(bubble.id) && (
                  <div className="pb-card-actions">
                    {onUpvoteBubble && <button type="button" onClick={() => onUpvoteBubble(bubble.id)} aria-label={`Upvote ${name}`}>👍</button>}
                    {onReactBubble && ["👍", "😂", "💀"].map(emoji => <button key={emoji} type="button"
                      aria-label={`React ${emoji} on ${name}`} aria-pressed={reactions?.get(bubble.id)?.mine.includes(emoji) || false}
                      onClick={() => onReactBubble(bubble.id, emoji)}>{emoji} {reactions?.get(bubble.id)?.counts[emoji] || ""}</button>)}
                    {onOpenComments && <button type="button" onClick={() => onOpenComments(bubble.id)} aria-label={`Comments on ${name}`}>💬</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {matches.length === 0 && <div className="pb-board-empty">
          <span aria-hidden="true">{category === "custom" ? "🎙️" : "🔎"}</span>
          <h2>{category === "custom" && !query ? "Make it your own" : "No giggles found. Yet."}</h2>
          <p>{category === "custom" && !query ? "Add a sound and record something silly." : "Try another name or choose a different category."}</p>
          <button type="button" className="pb-edit-toggle" onClick={() => { setQuery(""); setCategory("all"); }}>See all sounds</button>
        </div>}
        {remaining > 0 && <button type="button" className="pb-show-more" onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, remaining)} more sounds <span aria-hidden="true">↓</span>
        </button>}
      </div>
    </main>
  );
};
export default CardGrid;
