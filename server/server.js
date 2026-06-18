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
import multer from "multer";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5174;
// UPLOAD_DIR and DB_PATH are honored from the environment when set, so the
// Dockerfile's volume mount (and any local override) actually takes effect.
// The previous version hardcoded both to <repo>/server/* paths, which meant
// the container wrote to its own ephemeral filesystem instead of the
// mounted /app/data volume — recordings + DB disappeared on every restart.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "uploads");
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "farts.db");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ─── Audio upload hardening ─────────────────────────────────────────────────
// Only these extensions are allowed; anything else is rejected before the file
// is written. The previous mimetype-prefix allowlist ("audio/*") plus the
// fallback to the original filename's extension allowed a stored XSS via a
// .html or .svg upload (fileFilter passed, extension came from originalname).
const ALLOWED_AUDIO_EXTS = new Set(["webm", "m4a", "mp3", "wav", "ogg"]);
const ALLOWED_MIMETYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
]);

// ─── Content moderation (single source of truth) ────────────────────────────
// v73 (code review 2026-06-16 #8): the previous list was ASCII-only and
// trusted the client. Real-world abuse patterns:
//   - zero-width space (U+200B) between letters: "f u c k"
//   - diacritics that NFKD-normalize away: "fück" → "fuck"
//   - homoglyphs: "ｆuck" (fullwidth f), "fuсk" (Cyrillic с)
//   - digit/letter substitution: "f4ck", "5hit"
// The list itself is kid-safety focused, not a full profanity dump. We
// catch the common substitutions and let the rest through. The kid
// surface limits the blast radius; the right next move is a maintained
// wordlist (a kid-app one, not a 4chan one), not a regex zoo.
const BANNED_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "fag", "kike",
  "piss", "ass", "whore", "crack", "dick", "cock", "pussy", "twat",
];

// NFKD-normalize + strip combining marks + lowercase + collapse. This
// turns "f ü c k" / "f̶u̶c̶k̶" / "𝐟𝐮𝐜𝐤" into "fuck" before the
// substring check. Diacritic strip uses a Unicode property regex; the
// \p{Mn} class matches all "nonspacing mark" code points (U+0300-U+036F
// and others). NFKD first so "ﬁ" (U+FB01) decomposes to "fi".
function normalizeForModeration(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks
    .replace(/[\u200B-\u200F\uFEFF]/g, "") // zero-width chars
    .toLowerCase()
    .replace(/\s+/g, "");
}

function containsBannedWord(s) {
  const normalized = normalizeForModeration(s);
  if (!normalized) return false;
  return BANNED_WORDS.some((w) => normalized.includes(w));
}

// ─── Path-traversal-safe unlink ─────────────────────────────────────────────
function safeUnlink(filename) {
  // Resolve the target path and assert it stays inside UPLOAD_DIR. A row
  // whose `filename` was somehow "../server.js" used to unlink the source.
  const target = path.resolve(UPLOAD_DIR, filename);
  const root = path.resolve(UPLOAD_DIR) + path.sep;
  if (!target.startsWith(root) && target !== path.resolve(UPLOAD_DIR)) {
    throw new Error("refusing to unlink outside upload dir");
  }
  try {
    fs.unlinkSync(target);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

// SQLite DB
const db = new Database(DB_PATH);
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
// CORS: same-origin SPA, so no cross-origin headers needed. The previous
// `app.use(cors())` was a wildcard that let any third-party site hit the API
// with a custom x-device-id and exercise the full social graph + uploads.
app.use(express.json({ limit: "1mb" })); // for social endpoints (users, follows, comments)

// ─── Rate limiters (per IP) ─────────────────────────────────────────────────
// "trust proxy" is NOT enabled, so these count actual client IPs. The upload
// and share-code endpoints are the most abuse-prone.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120, // 2 req/sec sustained
  standardHeaders: true,
  legacyHeaders: false,
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6, // 1 upload per 10s
  standardHeaders: true,
  legacyHeaders: false,
});
const shareLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30, // share codes have 1M keyspace; 30/min still allows legit "type a friend's code" UX
  standardHeaders: true,
  legacyHeaders: false,
});
const shareMintLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
});
// v73 (code review 2026-06-16 #7): per-endpoint limits on the social
// surface. The general 120/min limiter counts every /api/* call, so
// a single kid's 200 follow + 200 react + 200 comment in a minute
// would burn the general budget for every other endpoint. Per-endpoint
// limiters let legitimate UX through while capping each action at
// a sane rate. The "trust proxy" is off (per the general limiter's
// comment), so these count actual client IPs.
const followLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // 20 follows/min — more than a kid will ever do, less than a botnet
  standardHeaders: true,
  legacyHeaders: false,
});
const reactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60, // 1 reaction/sec sustained — generous for the kid UX
  standardHeaders: true,
  legacyHeaders: false,
});
const commentDeleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30, // 1 delete/2s — covers "I typo'd a comment" UX
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply the general limiter only to the API. Audio file fetches and the
// SPA shell bypass the limiter so a service-worker pre-cache or a kid's
// first play can't be 429-throttled out of a legit request.
app.use("/api", generalLimiter);

// Map of file extension → audio/* MIME type. Express's static middleware
// infers `video/webm` for .webm files (webm is registered as a video
// container in mime-db), which some audio tooling rejects. Override per
// extension so audio players see a sane Content-Type.
const AUDIO_MIME = {
  webm: "audio/webm",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

// Serve uploaded audio files
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "7d",
    setHeaders: (res, filePath) => {
      // Defense in depth: even if a non-audio file ever lands in /uploads
      // (regression of the fileFilter bypass), browsers must not sniff it.
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Override the extension-based MIME with an audio/* one.
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = AUDIO_MIME[ext];
      if (mime) res.setHeader("Content-Type", mime);
      // Audio responses are read by <audio> elements and service workers,
      // not executed by scripts — explicit no-CORS to keep a tight CSP story.
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    },
  }),
);

// Serve the built client (dist/) as static assets — single-port deployment
// sw.js is explicitly NOT cached (maxAge: 0) so the browser sees new versions
// on the next visit. Without this, the SW would serve stale code for an hour
// after each deploy and the new-version toast would never fire.
const DIST_DIR = path.join(__dirname, "..", "dist");
app.use(
  "/sw.js",
  express.static(path.join(DIST_DIR, "sw.js"), {
    maxAge: 0,
    etag: true,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    },
  }),
);
app.use(
  express.static(DIST_DIR, {
    maxAge: "1h",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// SPA fallback: any non-API GET that didn't match a static file → index.html
// (privacy.html and about.html are served by the dist/ static handler above.)
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// Multer for audio uploads (memory or disk)
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    // Resolve the extension from the *mimetype only* — never trust
    // `originalname` (it was a stored-XSS vector). If we don't recognize the
    // mimetype, reject the file in the fileFilter below; the only way to get
    // here with an unknown mimetype is if the fileFilter was bypassed.
    let ext = "";
    if (file.mimetype === "audio/webm") ext = "webm";
    else if (file.mimetype === "audio/mp4") ext = "m4a";
    else if (file.mimetype === "audio/mpeg" || file.mimetype === "audio/mp3") ext = "mp3";
    else if (
      file.mimetype === "audio/wav" ||
      file.mimetype === "audio/wave" ||
      file.mimetype === "audio/x-wav"
    )
      ext = "wav";
    else if (file.mimetype === "audio/ogg") ext = "ogg";
    if (!ALLOWED_AUDIO_EXTS.has(ext)) {
      cb(new Error("Only audio files allowed"));
      return;
    }
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `${id}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  fileFilter: (req, file, cb) => {
    // Strict mimetype allowlist (no more `audio/*` prefix). The filename
    // callback then re-validates the *resolved* extension. The two checks
    // together close the XSS vector where a .html file with `audio/x-foo`
    // mimetype used to land in /uploads as HTML.
    if (ALLOWED_MIMETYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only audio files allowed"));
  },
});

// Health check
app.get("/api/health", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as n FROM recordings").get();
  res.json({ ok: true, recordings: count.n, uptime: process.uptime() });
});

// v29: lightweight self-hosted error monitoring (10% sample, logs to stderr)
app.post("/api/errors", (req, res) => {
  const { message, stack, url, userAgent, profileId, ts } = req.body || {};
  // Log to server stderr — piped to the runbook's logging system
  console.error(`[client-error] ts=${ts} url=${url} profileId=${profileId} ua=${userAgent} msg=${message} stack=${stack}`);
  res.json({ ok: true });
});

// v30: user-facing feedback endpoint (report a problem from parent dashboard)
app.post("/api/feedback", (req, res) => {
  const { message, profileId, url, userAgent, ts } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  console.error(`[feedback] ts=${ts} profileId=${profileId} url=${url} ua=${userAgent} msg=${message.trim()}`);
  res.json({ ok: true });
});

// v72 (code review 2026-06-16 #2): every :id route uses parseInt, which
// returns NaN for non-numeric input. NaN is a valid SQL value (no
// FOREIGN KEY constraint on comments/reactions, so INSERTs succeed
// silently and create orphan rows). The shared helper below asserts
// the id is a positive integer so all 4 routes can reject bad input
// with a 400 before any DB work.
function parseIdParam(value) {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// === Share codes (4-character) ===
// Anyone can mint a code for a public recording URL. Anyone with the
// code can fetch the audio. No accounts, no follows, no profiles.
// Codes are 4 uppercase letters/digits, easy to read aloud.

const SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusion

function generateShareCode() {
  // 32^4 = 1M combinations. Use crypto-random for the per-char picks so the
  // sequence is unpredictable from observed outputs (the previous Math.random
  // implementation was brute-forceable without a rate limit).
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += SHARE_ALPHABET[crypto.randomInt(0, SHARE_ALPHABET.length)];
  }
  return s;
}

app.post("/api/share", shareMintLimiter, (req, res) => {
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
      // v73 (code review 2026-06-16 #11): only retry on PK collision.
      // The previous code caught any error and tried a new code, which
      // doesn't fix a different constraint (e.g. NOT NULL fail, file
      // permission). The 32^4 = 1M keyspace + 5 attempts means even a
      // PK collision is astronomically unlikely; the retry loop is a
      // belt-and-suspenders, not a real fix path. Bubble up non-PK
      // errors so they hit the general 500 path with their real
      // message.
      if (err && err.code === "SQLITE_CONSTRAINT_PRIMARYKEY" && attempt < 4) continue;
      console.error(`[share] insert failed on attempt ${attempt}: ${err && err.message}`);
      return res.status(500).json({ error: "code collision, retry" });
    }
  }
});

app.get("/api/share/:code", shareLookupLimiter, (req, res) => {
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
    SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename,
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
      durationSec: r.duration_sec,
      upvotes: r.upvotes,
      userVoted: r.user_voted > 0,
      createdAt: r.created_at,
      audioUrl: `/uploads/${r.filename}`,
    })),
  });
});

// Upload a recording
app.post("/api/recordings", uploadLimiter, (req, res, next) => {
  upload.single("audio")(req, res, (err) => {
    // Convert multer errors (including fileFilter rejections) into 4xx so
    // the client doesn't see a 500 + HTML stack trace when the file is the
    // wrong type. The HTML response is also why the XSS attempts looked
    // "almost worked" — they didn't, but the error page was HTML.
    if (err) {
      const msg = err.message || "Upload failed";
      const status = /file too large/i.test(msg) ? 413 : 400;
      return res.status(status).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file provided" });
    const { name, emoji, kidName, durationSec } = req.body;
    // Require the x-device-id header (consistent with every other write
    // endpoint). The previous fallback to req.body.deviceId was an extra
    // spoofing surface and inconsistent with the rest of the API.
    const deviceId = req.headers["x-device-id"];
    if (!name || !deviceId) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(400).json({ error: "Missing name or x-device-id" });
    }
    if (typeof name !== "string" || String(name).length > 40) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(400).json({ error: "Name must be a string up to 40 chars" });
    }
    // Content moderation (single source of truth in containsBannedWord).
    if (containsBannedWord(name) || containsBannedWord(emoji)) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(400).json({ error: "Name or emoji contains blocked words" });
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
    if (req.file) {
      try { safeUnlink(req.file.filename); } catch { /* ignore */ }
    }
    res.status(500).json({ error: "Upload failed" });
  }
});

// Upvote (idempotent — toggles vote on/off per device)
app.post("/api/recordings/:id/upvote", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id header" });

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
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id header" });
  const row = db.prepare("SELECT filename, device_id FROM recordings WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.device_id !== deviceId) return res.status(403).json({ error: "Not your recording" });
  // v73 (code review 2026-06-16 #10): safeUnlink throws on path-traversal
  // (a row whose filename resolves outside UPLOAD_DIR) but the route
  // had no try/catch, so a malicious row would 500. Wrap it; ENOENT
  // (file already deleted) is fine to ignore, anything else surfaces
  // as a 500 with a logged error so we can fix the data.
  try {
    safeUnlink(row.filename);
  } catch (err) {
    if (err && err.message && err.message.startsWith("refusing to unlink")) {
      console.error(`[delete] path-traversal attempt on recording ${id}: ${row.filename}`);
      return res.status(500).json({ error: "Internal error" });
    }
    throw err;
  }
  db.prepare("DELETE FROM votes WHERE recording_id = ?").run(id);
  db.prepare("DELETE FROM comments WHERE recording_id = ?").run(id);
  db.prepare("DELETE FROM reactions WHERE recording_id = ?").run(id);
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
  // v73 (code review 2026-06-16 #9): explicit typeof guards per field.
  // The previous code did `String(displayName).slice(0, 30)` which
  // happily turns an array into a comma-joined literal ("f,u,c,k").
  // The full skill's footgun #3 (Zod schema defined and never wired)
  // is the principled fix; the typeof guards are the minimum that
  // doesn't add a new dependency.
  const { displayName, avatar, bio, handle } = req.body || {};
  if (displayName !== undefined) {
    if (typeof displayName !== "string") return res.status(400).json({ error: "displayName must be a string" });
    if (displayName.length > 30) return res.status(400).json({ error: "Display name too long" });
    db.prepare("UPDATE users SET display_name = ? WHERE device_id = ?").run(displayName.slice(0, 30), deviceId);
  }
  if (avatar !== undefined) {
    if (typeof avatar !== "string") return res.status(400).json({ error: "avatar must be a string" });
    db.prepare("UPDATE users SET avatar = ? WHERE device_id = ?").run(avatar.slice(0, 8), deviceId);
  }
  if (bio !== undefined) {
    if (typeof bio !== "string") return res.status(400).json({ error: "bio must be a string" });
    if (bio.length > 200) return res.status(400).json({ error: "Bio too long" });
    db.prepare("UPDATE users SET bio = ? WHERE device_id = ?").run(bio.slice(0, 200), deviceId);
  }
  if (handle !== undefined) {
    if (typeof handle !== "string") return res.status(400).json({ error: "handle must be a string" });
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
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
app.post("/api/users/:handle/follow", followLimiter, (req, res) => {
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
    SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
           (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
    FROM recordings r
    WHERE r.device_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(deviceId, u.device_id, limit);
  res.json({
    recordings: rows.map((r) => ({
      id: r.id, name: r.name, emoji: r.emoji,
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
    SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
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
      id: r.id, name: r.name, emoji: r.emoji,
      durationSec: r.duration_sec, upvotes: r.upvotes, userVoted: r.user_voted > 0,
      createdAt: r.created_at, audioUrl: `/uploads/${r.filename}`,
    });
  }
  res.json({ groups: Array.from(authorMap.values()) });
});

// GET /api/recordings/:id/comments
app.get("/api/recordings/:id/comments", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
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
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const body = (req.body && req.body.body || "").toString().trim();
  if (!body) return res.status(400).json({ error: "Empty comment" });
  if (body.length > 280) return res.status(400).json({ error: "Comment too long (max 280)" });
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "Comment contains blocked words" });
  }
  getOrCreateUser(deviceId);
  const r = db.prepare(`INSERT INTO comments (recording_id, device_id, body, created_at) VALUES (?, ?, ?, ?)`)
    .run(id, deviceId, body, Date.now());
  res.json({ id: r.lastInsertRowid, body, createdAt: Date.now() });
});

// DELETE /api/comments/:id
app.delete("/api/comments/:id", commentDeleteLimiter, (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
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
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
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
app.post("/api/recordings/:id/reactions", reactionLimiter, (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
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

app.listen(PORT, "0.0.0.0")
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[server] port ${PORT} is already in use. Exiting.`);
      process.exit(1);
    }
    throw err;
  })
  .on("listening", () => {
    console.log(`💥 Animal Farts server running on http://localhost:${PORT}`);
  });
