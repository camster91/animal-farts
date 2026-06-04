// Local server for Animal Farts.
// Endpoints:
//   GET  /api/health             — health check
//   GET  /api/recordings         — list shared recordings
//   POST /api/recordings         — upload a new recording
//   POST /api/recordings/:id/upvote — toggle upvote
//   GET  /api/recordings/:id/audio — fetch audio
//   DELETE /api/recordings/:id   — delete (creator only)
//   GET  /api/me                 — get/create my user
//   GET  /api/users/:handle      — get public user profile
//   POST /api/users/:handle/follow — follow a user
//   DELETE /api/users/:handle/follow — unfollow
//   GET  /api/users/:handle/followers — list followers
//   GET  /api/users/:handle/following — list following
//   GET  /api/feed                — feed of friends + all
//   GET  /api/recordings/:id/comments — list comments
//   POST /api/recordings/:id/comments — add a comment
//   DELETE /api/comments/:id     — delete own comment
//   GET  /api/recordings/:id/reactions — aggregated reaction counts + mine
//   POST /api/recordings/:id/reactions — toggle {emoji} reaction (adult-only)
//
// Storage: SQLite for metadata, /server/uploads/ for audio files (webm/mp4).
// No real auth — device-id header is used to identify users, auto-creates
// a user record on first request. The user picks a "handle" (any string they
// want, no uniqueness check needed since it's local).
//
import express from "express";
import cors from "cors";
import multer from "multer";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5174;
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// SQLite DB
const db = new Database(path.join(__dirname, "farts.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    device_id TEXT NOT NULL,
    kid_name TEXT,
    filename TEXT NOT NULL,
    duration_sec REAL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at);
  CREATE INDEX IF NOT EXISTS idx_recordings_upvotes ON recordings(upvotes DESC);

  CREATE TABLE IF NOT EXISTS votes (
    recording_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (recording_id, device_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    device_id TEXT PRIMARY KEY,
    handle TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🐱',
    bio TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

  CREATE TABLE IF NOT EXISTS follows (
    follower_device_id TEXT NOT NULL,
    followee_device_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (follower_device_id, followee_device_id)
  );
  CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_device_id);

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comments_recording ON comments(recording_id, created_at);

  CREATE TABLE IF NOT EXISTS reactions (
    recording_id INTEGER NOT NULL,
    device_id    TEXT NOT NULL,
    emoji        TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (recording_id, device_id, emoji)
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_recording ON reactions(recording_id);

  CREATE TABLE IF NOT EXISTS share_codes (
    code         TEXT PRIMARY KEY,
    audio_url    TEXT NOT NULL,
    name         TEXT NOT NULL,
    emoji        TEXT NOT NULL DEFAULT '💨',
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_share_codes_created ON share_codes(created_at);
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" })); // for social endpoints (users, follows, comments)

// Serve uploaded audio files
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

// Serve the built client (dist/) as static assets — single-port deployment
const DIST_DIR = path.join(__dirname, "..", "dist");
app.use(express.static(DIST_DIR, { maxAge: "1h" }));

// SPA fallback: any non-API GET that didn't match a static file → index.html
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// Multer for audio uploads (memory or disk)
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    // Pick extension from mimetype
    let ext = "bin";
    if (file.mimetype.includes("webm")) ext = "webm";
    else if (file.mimetype.includes("mp4")) ext = "m4a";
    else if (file.mimetype.includes("mpeg") || file.mimetype.includes("mp3")) ext = "mp3";
    else if (file.mimetype.includes("wav")) ext = "wav";
    else if (file.mimetype.includes("ogg")) ext = "ogg";
    // Fallback to original filename ext
    if (ext === "bin" && file.originalname) {
      const m = file.originalname.match(/\.([a-z0-9]{2,4})$/i);
      if (m) ext = m[1].toLowerCase();
    }
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `${id}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new Error("Only audio files allowed"));
  },
});

// Health check
app.get("/api/health", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as n FROM recordings").get();
  res.json({ ok: true, recordings: count.n, uptime: process.uptime() });
});

// === Share codes (4-character) ===
// Anyone can mint a code for a public recording URL. Anyone with the
// code can fetch the audio. No accounts, no follows, no profiles.
// Codes are 4 uppercase letters/digits, easy to read aloud.

const SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusion

function generateShareCode() {
  // 32^4 = 1M combinations, plenty for a kids' toy
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += SHARE_ALPHABET[Math.floor(Math.random() * SHARE_ALPHABET.length)];
  }
  return s;
}

app.post("/api/share", (req, res) => {
  const { audioUrl, name, emoji } = req.body || {};
  if (typeof audioUrl !== "string" || !audioUrl) {
    return res.status(400).json({ error: "audioUrl is required" });
  }
  // The audioUrl must be a /uploads/... path on this server (not arbitrary)
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(audioUrl)) {
    return res.status(400).json({ error: "audioUrl must be a /uploads/... path" });
  }
  // Try up to 5 times to get a unique code (collision odds are tiny)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    try {
      db.prepare(
        "INSERT INTO share_codes (code, audio_url, name, emoji, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(code, audioUrl, String(name || "Shared sound").slice(0, 60), String(emoji || "💨").slice(0, 8), Date.now());
      return res.json({ code, audioUrl, name: name || "Shared sound", emoji: emoji || "💨" });
    } catch (err) {
      // PK collision — try again
      if (attempt === 4) return res.status(500).json({ error: "code collision, retry" });
    }
  }
});

app.get("/api/share/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().slice(0, 4);
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    return res.status(400).json({ error: "Invalid code format" });
  }
  const row = db.prepare("SELECT audio_url, name, emoji, created_at FROM share_codes WHERE code = ?").get(code);
  if (!row) return res.status(404).json({ error: "Code not found" });
  res.json({ code, audioUrl: row.audio_url, name: row.name, emoji: row.emoji, createdAt: row.created_at });
});

// List recordings (sorted by upvotes desc, then recency)
app.get("/api/recordings", (req, res) => {
  const deviceId = req.headers["x-device-id"] || "";
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT r.id, r.name, r.emoji, r.kid_name, r.duration_sec, r.upvotes, r.created_at, r.filename,
           (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
    FROM recordings r
    ORDER BY r.upvotes DESC, r.created_at DESC
    LIMIT ?
  `).all(deviceId, limit);
  res.json({
    recordings: rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      kidName: r.kid_name,
      durationSec: r.duration_sec,
      upvotes: r.upvotes,
      userVoted: r.user_voted > 0,
      createdAt: r.created_at,
      audioUrl: `/uploads/${r.filename}`,
    })),
  });
});

// Upload a recording
app.post("/api/recordings", upload.single("audio"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file provided" });
    const { name, emoji, kidName, durationSec } = req.body;
    const deviceId = req.headers["x-device-id"] || (req.body && req.body.deviceId);
    if (!name || !deviceId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Missing name or deviceId" });
    }
    // Basic content moderation — block obvious bad words (extend as needed)
    const banned = ["fuck", "shit", "bitch", "cunt", "nigger", "fag", "kike"];
    const lowerName = (name + " " + (emoji || "")).toLowerCase();
    if (banned.some((w) => lowerName.includes(w))) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Name contains blocked words" });
    }
    const result = db.prepare(`
      INSERT INTO recordings (name, emoji, device_id, kid_name, filename, duration_sec, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(name).slice(0, 40),
      String(emoji || "💨").slice(0, 8),
      String(deviceId).slice(0, 64),
      kidName ? String(kidName).slice(0, 20) : null,
      req.file.filename,
      durationSec ? parseFloat(durationSec) : null,
      Date.now()
    );
    res.json({
      id: result.lastInsertRowid,
      name, emoji,
      kidName,
      durationSec: durationSec ? parseFloat(durationSec) : null,
      upvotes: 0,
      userVoted: false,
      audioUrl: `/uploads/${req.file.filename}`,
    });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Upvote (idempotent — toggles vote on/off per device)
app.post("/api/recordings/:id/upvote", (req, res) => {
  const id = parseInt(req.params.id);
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id header" });
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const existing = db.prepare("SELECT 1 FROM votes WHERE recording_id = ? AND device_id = ?").get(id, deviceId);
  if (existing) {
    // Toggle off
    db.prepare("DELETE FROM votes WHERE recording_id = ? AND device_id = ?").run(id, deviceId);
    db.prepare("UPDATE recordings SET upvotes = upvotes - 1 WHERE id = ?").run(id);
  } else {
    db.prepare("INSERT INTO votes (recording_id, device_id, created_at) VALUES (?, ?, ?)").run(id, deviceId, Date.now());
    db.prepare("UPDATE recordings SET upvotes = upvotes + 1 WHERE id = ?").run(id);
  }
  const updated = db.prepare("SELECT upvotes FROM recordings WHERE id = ?").get(id);
  res.json({ upvotes: updated?.upvotes ?? 0, userVoted: !existing });
});

// Delete (only by original creator's device id)
app.delete("/api/recordings/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id header" });
  const row = db.prepare("SELECT filename, device_id FROM recordings WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.device_id !== deviceId) return res.status(403).json({ error: "Not your recording" });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, row.filename)); } catch {}
  db.prepare("DELETE FROM votes WHERE recording_id = ?").run(id);
  db.prepare("DELETE FROM comments WHERE recording_id = ?").run(id);
  db.prepare("DELETE FROM recordings WHERE id = ?").run(id);
  res.json({ ok: true });
});

// === Social endpoints (users, follows, comments, feed) ===

function getOrCreateUser(deviceId) {
  let user = db.prepare("SELECT * FROM users WHERE device_id = ?").get(deviceId);
  if (!user) {
    const id = crypto.randomBytes(4).toString("hex");
    const handle = `guest_${id}`;
    const displayName = `Fart Fan ${id.slice(0, 3).toUpperCase()}`;
    const avatar = "🐱";
    db.prepare(`INSERT INTO users (device_id, handle, display_name, avatar, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(deviceId, handle, displayName, avatar, Date.now());
    user = db.prepare("SELECT * FROM users WHERE device_id = ?").get(deviceId);
  }
  return user;
}

function userToPublic(u, viewerDeviceId) {
  if (!u) return null;
  const followerCount = db.prepare("SELECT COUNT(*) as n FROM follows WHERE followee_device_id = ?").get(u.device_id).n;
  const followingCount = db.prepare("SELECT COUNT(*) as n FROM follows WHERE follower_device_id = ?").get(u.device_id).n;
  const recordingCount = db.prepare("SELECT COUNT(*) as n FROM recordings WHERE device_id = ?").get(u.device_id).n;
  const isFollowing = viewerDeviceId
    ? !!db.prepare("SELECT 1 FROM follows WHERE follower_device_id = ? AND followee_device_id = ?").get(viewerDeviceId, u.device_id)
    : false;
  return {
    handle: u.handle,
    displayName: u.display_name,
    avatar: u.avatar,
    bio: u.bio,
    createdAt: u.created_at,
    followerCount,
    followingCount,
    recordingCount,
    isFollowing,
    isMe: viewerDeviceId === u.device_id,
  };
}

// GET /api/me — get or create the current user
app.get("/api/me", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const u = getOrCreateUser(deviceId);
  res.json(userToPublic(u, deviceId));
});

// PATCH /api/me — update profile
app.patch("/api/me", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  getOrCreateUser(deviceId);
  const { displayName, avatar, bio, handle } = req.body || {};
  if (displayName) {
    if (String(displayName).length > 30) return res.status(400).json({ error: "Display name too long" });
    db.prepare("UPDATE users SET display_name = ? WHERE device_id = ?").run(String(displayName).slice(0, 30), deviceId);
  }
  if (avatar) {
    db.prepare("UPDATE users SET avatar = ? WHERE device_id = ?").run(String(avatar).slice(0, 8), deviceId);
  }
  if (bio !== undefined) {
    if (String(bio).length > 200) return res.status(400).json({ error: "Bio too long" });
    db.prepare("UPDATE users SET bio = ? WHERE device_id = ?").run(String(bio).slice(0, 200), deviceId);
  }
  if (handle) {
    const cleanHandle = String(handle).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    if (cleanHandle.length < 3) return res.status(400).json({ error: "Handle too short" });
    const existing = db.prepare("SELECT 1 FROM users WHERE handle = ? AND device_id != ?").get(cleanHandle, deviceId);
    if (existing) return res.status(409).json({ error: "Handle taken" });
    db.prepare("UPDATE users SET handle = ? WHERE device_id = ?").run(cleanHandle, deviceId);
  }
  const u = db.prepare("SELECT * FROM users WHERE device_id = ?").get(deviceId);
  res.json(userToPublic(u, deviceId));
});

// GET /api/users/:handle — public profile
app.get("/api/users/:handle", (req, res) => {
  const viewer = req.headers["x-device-id"];
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json(userToPublic(u, viewer));
});

// POST /api/users/:handle/follow — toggle follow
app.post("/api/users/:handle/follow", (req, res) => {
  const viewer = req.headers["x-device-id"];
  if (!viewer) return res.status(400).json({ error: "Missing x-device-id" });
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "User not found" });
  if (u.device_id === viewer) return res.status(400).json({ error: "Can't follow yourself" });
  const existing = db.prepare("SELECT 1 FROM follows WHERE follower_device_id = ? AND followee_device_id = ?").get(viewer, u.device_id);
  if (existing) {
    db.prepare("DELETE FROM follows WHERE follower_device_id = ? AND followee_device_id = ?").run(viewer, u.device_id);
    res.json({ following: false });
  } else {
    db.prepare("INSERT INTO follows (follower_device_id, followee_device_id, created_at) VALUES (?, ?, ?)").run(viewer, u.device_id, Date.now());
    res.json({ following: true });
  }
});

// GET /api/users/:handle/followers
app.get("/api/users/:handle/followers", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "Not found" });
  const rows = db.prepare(`
    SELECT users.* FROM follows
    JOIN users ON users.device_id = follows.follower_device_id
    WHERE follows.followee_device_id = ?
    ORDER BY follows.created_at DESC
    LIMIT 200
  `).all(u.device_id);
  res.json({ users: rows.map((r) => userToPublic(r, req.headers["x-device-id"])) });
});

// GET /api/users/:handle/following
app.get("/api/users/:handle/following", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "Not found" });
  const rows = db.prepare(`
    SELECT users.* FROM follows
    JOIN users ON users.device_id = follows.followee_device_id
    WHERE follows.follower_device_id = ?
    ORDER BY follows.created_at DESC
    LIMIT 200
  `).all(u.device_id);
  res.json({ users: rows.map((r) => userToPublic(r, req.headers["x-device-id"])) });
});

// GET /api/users/:handle/recordings — recordings by a user
app.get("/api/users/:handle/recordings", (req, res) => {
  const deviceId = req.headers["x-device-id"] || "";
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "Not found" });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT r.id, r.name, r.emoji, r.kid_name, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
           (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
    FROM recordings r
    WHERE r.device_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(deviceId, u.device_id, limit);
  res.json({
    recordings: rows.map((r) => ({
      id: r.id, name: r.name, emoji: r.emoji, kidName: r.kid_name,
      durationSec: r.duration_sec, upvotes: r.upvotes, userVoted: r.user_voted > 0,
      createdAt: r.created_at, audioUrl: `/uploads/${r.filename}`,
      author: userToPublic(u, deviceId),
    })),
  });
});

// GET /api/feed — recordings from people you follow + your own
app.get("/api/feed", (req, res) => {
  const deviceId = req.headers["x-device-id"] || "";
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  // Make sure the user exists
  if (deviceId) getOrCreateUser(deviceId);
  const rows = db.prepare(`
    SELECT r.id, r.name, r.emoji, r.kid_name, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
           (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
    FROM recordings r
    WHERE r.device_id = ?
       OR r.device_id IN (SELECT followee_device_id FROM follows WHERE follower_device_id = ?)
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(deviceId, deviceId, deviceId, limit);
  // Group by author for Instagram-style feed (one post per author with their most recent)
  const authorMap = new Map();
  for (const r of rows) {
    if (!authorMap.has(r.device_id)) {
      const u = db.prepare("SELECT * FROM users WHERE device_id = ?").get(r.device_id);
      authorMap.set(r.device_id, { author: userToPublic(u, deviceId), recordings: [] });
    }
    authorMap.get(r.device_id).recordings.push({
      id: r.id, name: r.name, emoji: r.emoji, kidName: r.kid_name,
      durationSec: r.duration_sec, upvotes: r.upvotes, userVoted: r.user_voted > 0,
      createdAt: r.created_at, audioUrl: `/uploads/${r.filename}`,
    });
  }
  res.json({ groups: Array.from(authorMap.values()) });
});

// GET /api/recordings/:id/comments
app.get("/api/recordings/:id/comments", (req, res) => {
  const id = parseInt(req.params.id);
  const rows = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.device_id, u.handle, u.display_name, u.avatar
    FROM comments c
    LEFT JOIN users u ON u.device_id = c.device_id
    WHERE c.recording_id = ?
    ORDER BY c.created_at ASC
    LIMIT 200
  `).all(id);
  res.json({ comments: rows.map((r) => ({
    id: r.id, body: r.body, createdAt: r.created_at,
    author: { handle: r.handle, displayName: r.display_name, avatar: r.avatar },
  })) });
});

// POST /api/recordings/:id/comments
app.post("/api/recordings/:id/comments", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseInt(req.params.id);
  const body = (req.body && req.body.body || "").toString().trim();
  if (!body) return res.status(400).json({ error: "Empty comment" });
  if (body.length > 280) return res.status(400).json({ error: "Comment too long (max 280)" });
  // Same banned words as recording names
  const banned = ["fuck", "shit", "bitch", "cunt", "nigger", "fag", "kike"];
  if (banned.some((w) => body.toLowerCase().includes(w))) {
    return res.status(400).json({ error: "Comment contains blocked words" });
  }
  getOrCreateUser(deviceId);
  const r = db.prepare(`INSERT INTO comments (recording_id, device_id, body, created_at) VALUES (?, ?, ?, ?)`)
    .run(id, deviceId, body, Date.now());
  res.json({ id: r.lastInsertRowid, body, createdAt: Date.now() });
});

// DELETE /api/comments/:id
app.delete("/api/comments/:id", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseInt(req.params.id);
  const c = db.prepare("SELECT device_id FROM comments WHERE id = ?").get(id);
  if (!c) return res.status(404).json({ error: "Not found" });
  if (c.device_id !== deviceId) return res.status(403).json({ error: "Not your comment" });
  db.prepare("DELETE FROM comments WHERE id = ?").run(id);
  res.json({ ok: true });
});

// Allowed reaction emoji set. Keep small and kid-safe by default; the
// client uses only these three.
const REACTION_EMOJIS = new Set(["👍", "😂", "💀"]);

function sanitizeEmoji(s) {
  // Strip whitespace + ZWJ joiners we don't support; require an exact
  // match against the allowed set to avoid weird codepoints.
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  return REACTION_EMOJIS.has(trimmed) ? trimmed : null;
}

// GET /api/recordings/:id/reactions — { counts: {emoji:n}, mine: [emoji] }
app.get("/api/recordings/:id/reactions", (req, res) => {
  const id = parseInt(req.params.id);
  const deviceId = req.headers["x-device-id"];
  const rows = db.prepare(
    "SELECT emoji, COUNT(*) AS n FROM reactions WHERE recording_id = ? GROUP BY emoji"
  ).all(id);
  const counts = {};
  for (const r of rows) counts[r.emoji] = r.n;
  const mineRows = deviceId
    ? db.prepare("SELECT emoji FROM reactions WHERE recording_id = ? AND device_id = ?").all(id, deviceId)
    : [];
  res.json({ counts, mine: mineRows.map((r) => r.emoji) });
});

// POST /api/recordings/:id/reactions — toggle { emoji }
app.post("/api/recordings/:id/reactions", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseInt(req.params.id);
  const emoji = sanitizeEmoji(req.body && req.body.emoji);
  if (!emoji) return res.status(400).json({ error: "Invalid emoji" });
  const exists = db.prepare(
    "SELECT 1 FROM reactions WHERE recording_id = ? AND device_id = ? AND emoji = ?"
  ).get(id, deviceId, emoji);
  if (exists) {
    db.prepare(
      "DELETE FROM reactions WHERE recording_id = ? AND device_id = ? AND emoji = ?"
    ).run(id, deviceId, emoji);
  } else {
    db.prepare(
      "INSERT INTO reactions (recording_id, device_id, emoji, created_at) VALUES (?, ?, ?, ?)"
    ).run(id, deviceId, emoji, Date.now());
  }
  // Re-aggregate and return the same shape as GET
  const rows = db.prepare(
    "SELECT emoji, COUNT(*) AS n FROM reactions WHERE recording_id = ? GROUP BY emoji"
  ).all(id);
  const counts = {};
  for (const r of rows) counts[r.emoji] = r.n;
  const mineRows = db.prepare(
    "SELECT emoji FROM reactions WHERE recording_id = ? AND device_id = ?"
  ).all(id, deviceId);
  res.json({ counts, mine: mineRows.map((r) => r.emoji), added: !exists });
});

// GET /api/users — list all users (for discover)
app.get("/api/users", (req, res) => {
  const viewer = req.headers["x-device-id"] || "";
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ?").all(limit);
  res.json({ users: rows.map((u) => userToPublic(u, viewer)) });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`💥 Animal Farts server running on http://localhost:${PORT}`);
});
