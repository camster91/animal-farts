// CommentsSheet.tsx — v78: bottom-sheet for viewing + posting
// comments on an uploaded recording. Triggered by the 💬 button
// in the CardGrid action bar (only on uploaded custom recordings
// with a known server id). Self-contained: handles its own
// fetching, posting, and deleting. Reports its own state to
// the parent via the onCountChange callback so the card's
// comment-count badge stays in sync.
//
// Server endpoints used:
//   GET    /api/recordings/:id/comments
//   POST   /api/recordings/:id/comments (body: {body: string})
//   DELETE /api/comments/:id            (auth: x-device-id must
//                                       match the comment's author)
//
// Note: the GET response doesn't include a `mine` flag (unlike
// reactions) — we identify own comments by tracking the IDs
// we've posted in client memory. This avoids requiring every
// comment to be joined through the user table.

import { useState, useEffect, useRef, type FC } from "react";
import { getOrCreateDeviceId } from "../lib/deviceId";

interface Comment {
  id: number;
  body: string;
  createdAt: number;
  author?: { handle: string | null; displayName: string | null; avatar: string | null };
}

interface CommentsSheetProps {
  show: boolean;
  /** Server-assigned numeric recording id. */
  recordingId: number;
  /** Display name shown in the header so the kid knows which sound
   *  they're commenting on. */
  recordingName: string;
  onClose: () => void;
  /** Called whenever the comment list changes length. PootBox
   *  uses this to keep a per-bubble count in sync (e.g. for a
   *  future 💬 badge on the card). */
  onCountChange?: (count: number) => void;
}

const MAX_BODY_LENGTH = 280;

function formatRelative(ms: number): string {
  const dt = Date.now() - ms;
  if (dt < 60_000) return "just now";
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)}m ago`;
  if (dt < 86_400_000) return `${Math.floor(dt / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

const CommentsSheet: FC<CommentsSheetProps> = ({
  show,
  recordingId,
  recordingName,
  onClose,
  onCountChange,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myCommentIds, setMyCommentIds] = useState<Set<number>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch comments when the sheet opens or the recording changes.
  useEffect(() => {
    if (!show || !recordingId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetch(`/api/recordings/${recordingId}/comments`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list: Comment[] = data.comments ?? [];
        setComments(list);
        onCountChange?.(list.length);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load comments — are you online?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [show, recordingId, onCountChange]);

  // Auto-focus the textarea on open.
  useEffect(() => {
    if (show) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [show]);

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setError(null);
    try {
      const r = await fetch(`/api/recordings/${recordingId}/comments`, {
        method: "POST",
        headers: {
          "x-device-id": getOrCreateDeviceId(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        setError(errBody.error || `HTTP ${r.status}`);
        return;
      }
      const data = await r.json();
      // Optimistic append with placeholder author (the server
      // response is {id, body, createdAt} — no author). The next
      // sheet open will re-fetch and pick up the joined author.
      const newComment: Comment = {
        id: data.id,
        body: data.body,
        createdAt: data.createdAt,
      };
      setComments((prev) => [...prev, newComment]);
      setMyCommentIds((prev) => new Set(prev).add(data.id));
      setBody("");
      onCountChange?.(comments.length + 1);
    } catch {
      setError("Couldn't post comment — are you online?");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const r = await fetch(`/api/comments/${id}`, {
        method: "DELETE",
        headers: { "x-device-id": getOrCreateDeviceId() },
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        setError(errBody.error || `HTTP ${r.status}`);
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
      setMyCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onCountChange?.(comments.length - 1);
    } catch {
      setError("Couldn't delete — are you online?");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={`Comments on ${recordingName}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          background: "white",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "16px 0 0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -16px 48px rgba(0,0,0,0.25)",
          fontFamily: "Fredoka, system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0 16px 12px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#3D2C1E",
            }}
          >
            Comments · {recordingName}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close comments"
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              border: "none",
              background: "rgba(0,0,0,0.06)",
              color: "#3D2C1E",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Comment list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 16px",
            minHeight: 200,
          }}
        >
          {loading && (
            <div style={{ color: "#92705A", fontSize: 14, textAlign: "center", padding: 20 }}>
              Loading…
            </div>
          )}
          {!loading && error && (
            <div style={{ color: "#BE185D", fontSize: 14, padding: 12 }}>{error}</div>
          )}
          {!loading && !error && comments.length === 0 && (
            <div style={{ color: "#92705A", fontSize: 14, textAlign: "center", padding: 20 }}>
              No comments yet. Be the first!
            </div>
          )}
          {!loading && comments.map((c) => {
            const mine = myCommentIds.has(c.id);
            return (
              <div
                key={c.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#3D2C1E",
                    }}
                  >
                    {c.author?.displayName || c.author?.handle || "Someone"}
                    {mine && (
                      <span
                        style={{
                          marginLeft: 6,
                          padding: "1px 6px",
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#B45309",
                          background: "rgba(245,158,11,0.18)",
                          borderRadius: 6,
                        }}
                      >
                        you
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: "#92705A" }}>
                    {formatRelative(c.createdAt)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: "#3D2C1E",
                      lineHeight: 1.3,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {c.body}
                  </span>
                  {mine && confirmDeleteId === c.id && (
                    <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button
                        onClick={() => handleDelete(c.id)}
                        aria-label="Confirm delete comment"
                        style={{
                          appearance: "none",
                          border: "none",
                          background: "#BE185D",
                          color: "white",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="Cancel delete"
                        style={{
                          appearance: "none",
                          border: "none",
                          background: "transparent",
                          color: "#92705A",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        cancel
                      </button>
                    </span>
                  )}
                  {mine && confirmDeleteId !== c.id && (
                    <button
                      onClick={() => setConfirmDeleteId(c.id)}
                      aria-label="Delete comment"
                      style={{
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: "#BE185D",
                        fontSize: 11,
                        cursor: "pointer",
                        padding: 2,
                      }}
                    >
                      delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            padding: 12,
            background: "rgba(245,158,11,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
            placeholder="Say something nice…"
            rows={2}
            disabled={posting}
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.10)",
              padding: "8px 10px",
              fontFamily: "inherit",
              fontSize: 14,
              color: "#3D2C1E",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter to post.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                handlePost();
              }
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: "#92705A" }}>
              {body.length}/{MAX_BODY_LENGTH}
            </span>
            <button
              onClick={handlePost}
              disabled={!body.trim() || posting}
              style={{
                appearance: "none",
                border: "none",
                background: body.trim() && !posting ? "#F59E0B" : "rgba(0,0,0,0.15)",
                color: "white",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                padding: "8px 18px",
                borderRadius: 12,
                cursor: body.trim() && !posting ? "pointer" : "default",
              }}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsSheet;