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
// Auth: x-device-id identifies the caller. It is a bearer secret — never
// returned in public user payloads. Prefer signed sessions for a stronger
// boundary; until then, do not leak device_id via /api/users|/api/feed|/api/me.
//
import express from "express";
import multer from "multer";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { containsBannedWord } from "./moderation.js";
import { verifyAudioMagic } from "./audioMagic.js";

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

// ─── Content moderation ─────────────────────────────────────────────────────
// The banned-word matcher lives in ./moderation.js (single source of truth,
// dependency-free so the unit tests can import the same code the server runs).
// It uses two-tier matching: substring for "strong" tokens and word-boundary
// for short tokens that are legitimate substrings of innocent words (so
// "brass"/"cockatoo"/"cracker" are no longer false-positives).

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
  CREATE INDEX IF NOT EXISTS idx_recordings_device_id ON recordings(device_id, created_at DESC);

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

  CREATE TABLE IF NOT EXISTS recording_deletions (
    device_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    recording_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (device_id, operation_id)
  );
  CREATE INDEX IF NOT EXISTS idx_recording_deletions_created ON recording_deletions(created_at);
`);

// v1 durable-sync migration. Nullable keeps existing rows valid; new queued
// uploads provide a stable operation id that is unique per device.
const recordingColumns = db.prepare("PRAGMA table_info(recordings)").all();
if (!recordingColumns.some((column) => column.name === "client_operation_id")) {
  db.exec("ALTER TABLE recordings ADD COLUMN client_operation_id TEXT");
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_device_operation
  ON recordings(device_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL
`);

// Enforce unique handles. Older DBs may have duplicates from a race on
// PATCH /api/me; rename extras before creating the unique index.
(function migrateUniqueHandles() {
  const dupes = db.prepare(`
    SELECT handle FROM users GROUP BY handle HAVING COUNT(*) > 1
  `).all();
  for (const { handle } of dupes) {
    const rows = db.prepare(
      "SELECT device_id FROM users WHERE handle = ? ORDER BY created_at ASC"
    ).all(handle);
    for (let i = 1; i < rows.length; i++) {
      const suffix = crypto.randomBytes(2).toString("hex");
      const next = `${String(handle).slice(0, 15)}_${suffix}`.slice(0, 20);
      db.prepare("UPDATE users SET handle = ? WHERE device_id = ?")
        .run(next, rows[i].device_id);
    }
  }
  db.exec("DROP INDEX IF EXISTS idx_users_handle");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle)");
})();

const app = express();
// CORS: same-origin SPA, so no cross-origin headers needed. The previous
// `app.use(cors())` was a wildcard that let any third-party site hit the API
// with a custom x-device-id and exercise the full social graph + uploads.
app.use(express.json({ limit: "1mb" })); // for social endpoints (users, follows, comments)

// Baseline security headers for every response (API + static + SPA).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "microphone=(self), camera=(), geolocation=(), payment=()",
  );
  // API responses are JSON only — lock down any accidental HTML embedding.
  if (req.path.startsWith("/api")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  }
  next();
});

// Production sits behind Traefik → docker. Without trust proxy, every client
// shares one rate-limit bucket (the proxy's IP). Trust one hop so
// X-Forwarded-For from the edge is used.
app.set("trust proxy", 1);

// ─── Rate limiters (per IP) ─────────────────────────────────────────────────
// makeLimiter centralizes the shared options. Setting RATE_LIMIT_DISABLED=1
// raises every ceiling to effectively unlimited — used ONLY by the integration
// test, which fires many uploads at one server instance and would otherwise
// exhaust the tight upload budget. It defaults off, so production is unchanged.
// We raise the limit rather than `skip` so the RateLimit-* headers the test
// asserts on are still emitted. `fixed` limiters keep their real cap even in
// test mode (a test asserts the share-lookup header reports 30).
const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === "1";
// Public social/discovery is outside the approved v1 child-safety boundary.
// It is opt-in for controlled testing only; production defaults to private
// play, durable uploads/deletes, and possession-based share codes.
const SOCIAL_FEATURES_ENABLED = process.env.SOCIAL_FEATURES_ENABLED === "1";
if (RATE_LIMIT_DISABLED && process.env.NODE_ENV === "production") {
  // Integration tests intentionally set both. Never enable this on a
  // real production deploy — it raises every abuse ceiling to ~1M/min.
  console.warn("[server] WARNING: RATE_LIMIT_DISABLED=1 with NODE_ENV=production — abuse limits are effectively off");
}
function makeLimiter(limit, { fixed = false } = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: RATE_LIMIT_DISABLED && !fixed ? 1_000_000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
  });
}
const generalLimiter = makeLimiter(120); // 2 req/sec sustained
const uploadLimiter = makeLimiter(6); // 1 upload per 10s
const shareLookupLimiter = makeLimiter(30, { fixed: true }); // allows "type a friend's code" UX
const shareMintLimiter = makeLimiter(6);
// v73 (code review 2026-06-16 #7): per-endpoint limits on the social
// surface. The general 120/min limiter counts every /api/* call, so
// a single kid's 200 follow + 200 react + 200 comment in a minute
// would burn the general budget for every other endpoint. Per-endpoint
// limiters let legitimate UX through while capping each action at
// a sane rate.
const followLimiter = makeLimiter(20); // more than a kid will ever do, less than a botnet
const reactionLimiter = makeLimiter(60); // 1 reaction/sec sustained — generous for the kid UX
const commentDeleteLimiter = makeLimiter(30); // 1 delete/2s — covers "I typo'd a comment" UX
const commentCreateLimiter = makeLimiter(20); // comment spam cap
const upvoteLimiter = makeLimiter(30); // toggle spam cap
// Telemetry (client error reports + feedback) writes straight to the server
// log. Cap it tighter than the general limiter so a broken client loop or an
// abuser can't flood the log (the client posts 100% of errors).
const telemetryLimiter = makeLimiter(30);
// Apply the general limiter only to the API. Audio file fetches and the
// SPA shell bypass the limiter so a service-worker pre-cache or a kid's
// first play can't be 429-throttled out of a legit request.
app.use("/api", generalLimiter);

function isDisabledSocialRoute(req) {
  const p = req.path;
  if (p === "/api/recordings" && req.method === "GET") return true;
  if (/^\/api\/recordings\/[^/]+\/(upvote|comments|reactions)$/.test(p)) return true;
  if (/^\/api\/comments\/[^/]+$/.test(p)) return true;
  if (p === "/api/me" || p === "/api/feed" || p === "/api/users") return true;
  if (p.startsWith("/api/users/")) return true;
  return false;
}

app.use((req, res, next) => {
  if (!SOCIAL_FEATURES_ENABLED && isDisabledSocialRoute(req)) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

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

// Health check — keep it cheap (Docker probes this every 30s). No COUNT(*) /
// uptime leakage on the public path.
app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  } catch (err) {
    console.error("[health] db ping failed:", err && err.message);
    res.status(503).json({ ok: false });
  }
});

// Retention: share codes expire after 30 days. Orphan codes without a live
// upload also get cleaned. Runs once at boot and hourly.
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DELETION_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_RECORDINGS_PER_DEVICE = 40;
function cleanupExpiredShareCodes() {
  try {
    const cutoff = Date.now() - SHARE_TTL_MS;
    const expired = db.prepare("DELETE FROM share_codes WHERE created_at < ?").run(cutoff);
    if (expired.changes > 0) {
      console.log(`[retention] deleted ${expired.changes} expired share codes`);
    }
    db.prepare("DELETE FROM recording_deletions WHERE created_at < ?")
      .run(Date.now() - DELETION_TOMBSTONE_TTL_MS);
  } catch (err) {
    console.error("[retention] share cleanup failed:", err && err.message);
  }
}
cleanupExpiredShareCodes();
setInterval(cleanupExpiredShareCodes, 60 * 60 * 1000).unref();

// v29: lightweight self-hosted error monitoring (logs to stderr). All
// user-supplied fields are run through sanitizeLogValue so a crafted payload
// can't inject extra log lines.
app.post("/api/errors", telemetryLimiter, (req, res) => {
  const { message, stack, url, userAgent, profileId, ts } = req.body || {};
  console.error(
    `[client-error] ts=${sanitizeLogValue(ts, 32)} url=${sanitizeLogValue(url, 200)} ` +
    `profileId=${sanitizeLogValue(profileId, 64)} ua=${sanitizeLogValue(userAgent, 200)} ` +
    `msg=${sanitizeLogValue(message)} stack=${sanitizeLogValue(stack, 1000)}`,
  );
  res.json({ ok: true });
});

// v30: user-facing feedback endpoint (report a problem from parent dashboard)
app.post("/api/feedback", telemetryLimiter, (req, res) => {
  const { message, profileId, url, userAgent, ts } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  console.error(
    `[feedback] ts=${sanitizeLogValue(ts, 32)} profileId=${sanitizeLogValue(profileId, 64)} ` +
    `url=${sanitizeLogValue(url, 200)} ua=${sanitizeLogValue(userAgent, 200)} ` +
    `msg=${sanitizeLogValue(message.trim())}`,
  );
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

// Cap + charset-check the device identity header. Spoofed headers used to
// be stored unbounded; reject garbage early so votes/comments can't bloat.
function parseDeviceId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(id)) return null;
  return id;
}

function parseOperationId(value) {
  if (value === undefined) return null;
  if (typeof value !== "string") return false;
  const id = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(id)) return false;
  return id;
}

// Cursor pagination: opaque "createdAt:id" token for created_at DESC lists.
function encodeCursor(createdAt, id) {
  return `${createdAt}:${id}`;
}
function parseCursor(raw) {
  if (typeof raw !== "string" || !raw) return null;
  const m = /^(\d+):(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const createdAt = Number(m[1]);
  const id = Number(m[2]);
  if (!Number.isFinite(createdAt) || !Number.isInteger(id) || id <= 0) return null;
  return { createdAt, id };
}
function parseLimit(raw, fallback = 50, max = 100) {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

// Existence check for the write endpoints that reference a recording.
// There is no FOREIGN KEY on votes/comments/reactions, so a valid-but-
// nonexistent id (e.g. a deleted recording) would otherwise create orphan
// rows. Callers 404 when this returns false.
function recordingExists(id) {
  return !!db.prepare("SELECT 1 FROM recordings WHERE id = ?").get(id);
}

// Strip CR/LF (and other control chars) so user-supplied values can't forge
// extra lines in the server logs (log injection). Also caps length.
function sanitizeLogValue(value, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, max);
}

// === Share codes ===
// Minted codes are 8 chars (~1.1e12 keyspace). Lookup still accepts legacy
// 4-char codes so existing shares keep working. Mint requires ownership of
// the uploaded file (x-device-id must match a recordings row for that path).

const SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusion
const SHARE_CODE_LEN = 8;

function generateShareCode() {
  let s = "";
  for (let i = 0; i < SHARE_CODE_LEN; i++) {
    s += SHARE_ALPHABET[crypto.randomInt(0, SHARE_ALPHABET.length)];
  }
  return s;
}

app.post("/api/share", shareMintLimiter, (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
  if (!deviceId) return res.status(400).json({ error: "Missing or invalid x-device-id" });
  const { audioUrl, name, emoji } = req.body || {};
  if (typeof audioUrl !== "string" || !audioUrl) {
    return res.status(400).json({ error: "audioUrl is required" });
  }
  // The audioUrl must be a /uploads/... path on this server (not arbitrary)
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(audioUrl)) {
    return res.status(400).json({ error: "audioUrl must be a /uploads/... path" });
  }
  const filename = audioUrl.slice("/uploads/".length);
  // Ownership: only the uploader can mint a share code for their file.
  const owned = db.prepare(
    "SELECT 1 FROM recordings WHERE filename = ? AND device_id = ?"
  ).get(filename, deviceId);
  if (!owned) {
    return res.status(403).json({ error: "Not your recording" });
  }
  // File must still exist on disk.
  const abs = path.resolve(UPLOAD_DIR, filename);
  const root = path.resolve(UPLOAD_DIR) + path.sep;
  if (!abs.startsWith(root) || !fs.existsSync(abs)) {
    return res.status(404).json({ error: "Audio file not found" });
  }
  if (containsBannedWord(name) || containsBannedWord(emoji)) {
    return res.status(400).json({ error: "Name or emoji contains blocked words" });
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
      if (err && err.code === "SQLITE_CONSTRAINT_PRIMARYKEY" && attempt < 4) continue;
      console.error(`[share] insert failed on attempt ${attempt}: ${err && err.message}`);
      return res.status(500).json({ error: "code collision, retry" });
    }
  }
});

app.get("/api/share/:code", shareLookupLimiter, (req, res) => {
  const code = String(req.params.code || "").toUpperCase().slice(0, SHARE_CODE_LEN);
  // Accept legacy 4-char codes and new 8-char codes.
  if (!/^[A-Z0-9]{4}$|^[A-Z0-9]{8}$/.test(code)) {
    return res.status(400).json({ error: "Invalid code format" });
  }
  const row = db.prepare("SELECT audio_url, name, emoji, created_at FROM share_codes WHERE code = ?").get(code);
  if (!row) return res.status(404).json({ error: "Code not found" });
  res.json({ code, audioUrl: row.audio_url, name: row.name, emoji: row.emoji, createdAt: row.created_at });
});

// List recordings (sorted by upvotes desc, then recency). Offset pagination
// because the primary sort is not a unique timestamp cursor.
app.get("/api/recordings", (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]) || "";
  const limit = parseLimit(req.query.limit, 50, 100);
  const offset = Math.max(0, Math.min(parseInt(String(req.query.offset ?? "0"), 10) || 0, 5000));
  const rows = db.prepare(`
    SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename,
           (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
    FROM recordings r
    ORDER BY r.upvotes DESC, r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?
  `).all(deviceId, limit + 1, offset);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    recordings: page.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      durationSec: r.duration_sec,
      upvotes: r.upvotes,
      userVoted: r.user_voted > 0,
      createdAt: r.created_at,
      audioUrl: `/uploads/${r.filename}`,
    })),
    nextOffset: hasMore ? offset + limit : null,
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
      const status = /file too large|File too large/i.test(msg) ? 413 : 400;
      return res.status(status).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file provided" });
    const { name, emoji, kidName, durationSec } = req.body;
    // Require a validated x-device-id header (consistent with every other write
    // endpoint). The previous fallback to req.body.deviceId was an extra
    // spoofing surface and inconsistent with the rest of the API.
    const deviceId = parseDeviceId(req.headers["x-device-id"]);
    const operationId = parseOperationId(req.headers["x-operation-id"]);
    if (operationId === false) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(400).json({ error: "Invalid x-operation-id" });
    }
    if (!name || !deviceId) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(400).json({ error: "Missing name or x-device-id" });
    }
    if (operationId) {
      const existing = db.prepare(`
        SELECT id, name, emoji, duration_sec, filename
        FROM recordings
        WHERE device_id = ? AND client_operation_id = ?
      `).get(deviceId, operationId);
      if (existing) {
        safeUnlink(req.file.filename);
        return res.json({
          id: existing.id,
          name: existing.name,
          emoji: existing.emoji,
          durationSec: existing.duration_sec,
          upvotes: 0,
          userVoted: false,
          audioUrl: `/uploads/${existing.filename}`,
          deduplicated: true,
        });
      }
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
    // Per-device quota — caps unbounded disk growth from a single identity.
    const owned = db.prepare(
      "SELECT COUNT(*) AS n FROM recordings WHERE device_id = ?"
    ).get(deviceId).n;
    if (owned >= MAX_RECORDINGS_PER_DEVICE) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(429).json({
        error: `Recording limit reached (${MAX_RECORDINGS_PER_DEVICE}). Delete an old one first.`,
      });
    }
    // Magic-byte check — Content-Type alone is not enough.
    const ext = path.extname(req.file.filename).slice(1).toLowerCase();
    const magic = verifyAudioMagic(path.join(UPLOAD_DIR, req.file.filename), ext);
    if (!magic.ok) {
      if (req.file) safeUnlink(req.file.filename);
      return res.status(400).json({ error: magic.error || "Invalid audio file" });
    }
    // Only store a finite numeric duration. A non-numeric string used to
    // parseFloat to NaN and get bound to SQLite as-is.
    const parsedDuration =
      durationSec != null && Number.isFinite(parseFloat(durationSec))
        ? parseFloat(durationSec)
        : null;
    const result = db.prepare(`
      INSERT INTO recordings (
        name, emoji, device_id, kid_name, filename, duration_sec, created_at, client_operation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(name).slice(0, 40),
      String(emoji || "💨").slice(0, 8),
      deviceId,
      kidName ? String(kidName).slice(0, 20) : null,
      req.file.filename,
      parsedDuration,
      Date.now(),
      operationId,
    );
    res.json({
      id: result.lastInsertRowid,
      name, emoji,
      kidName,
      durationSec: parsedDuration,
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
app.post("/api/recordings/:id/upvote", upvoteLimiter, (req, res) => {
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id header" });
  if (!recordingExists(id)) return res.status(404).json({ error: "Not found" });

  // Wrap the read-modify-write in a transaction so two concurrent toggles
  // from the same device can't both see "no vote" and double-insert (PK
  // conflict) or drift the count.
  const toggle = db.transaction(() => {
    const existing = db.prepare("SELECT 1 FROM votes WHERE recording_id = ? AND device_id = ?").get(id, deviceId);
    if (existing) {
      db.prepare("DELETE FROM votes WHERE recording_id = ? AND device_id = ?").run(id, deviceId);
      db.prepare("UPDATE recordings SET upvotes = upvotes - 1 WHERE id = ?").run(id);
    } else {
      db.prepare("INSERT INTO votes (recording_id, device_id, created_at) VALUES (?, ?, ?)").run(id, deviceId, Date.now());
      db.prepare("UPDATE recordings SET upvotes = upvotes + 1 WHERE id = ?").run(id);
    }
    const updated = db.prepare("SELECT upvotes FROM recordings WHERE id = ?").get(id);
    return { upvotes: updated?.upvotes ?? 0, userVoted: !existing };
  });
  res.json(toggle());
});

// Delete (only by original creator's device id)
app.delete("/api/recordings/:id", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id header" });
  const operationId = parseOperationId(req.headers["x-operation-id"]);
  if (operationId === false) return res.status(400).json({ error: "Invalid x-operation-id" });
  if (operationId) {
    const completed = db.prepare(
      "SELECT recording_id FROM recording_deletions WHERE device_id = ? AND operation_id = ?"
    ).get(deviceId, operationId);
    if (completed) {
      return res.json({ ok: true, alreadyDeleted: true, id: completed.recording_id });
    }
  }
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
  const applyDelete = db.transaction(() => {
    db.prepare("DELETE FROM votes WHERE recording_id = ?").run(id);
    db.prepare("DELETE FROM comments WHERE recording_id = ?").run(id);
    db.prepare("DELETE FROM reactions WHERE recording_id = ?").run(id);
    db.prepare("DELETE FROM share_codes WHERE audio_url = ?").run(`/uploads/${row.filename}`);
    db.prepare("DELETE FROM recordings WHERE id = ?").run(id);
    if (operationId) {
      db.prepare(`
        INSERT INTO recording_deletions (device_id, operation_id, recording_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(deviceId, operationId, id, Date.now());
    }
  });
  applyDelete();
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

// v74 (pass 3, 2026-06-18): batched N+1 fix for /api/users list. The
// previous code called userToPublic() per user, which ran 4 queries
// each (follower count, following count, recording count, isFollowing).
// With 4 users that's 16 queries; with 200 (the cap) that's 800. We
// keep userToPublic for the single-user endpoints (cheaper, fewer
// queries than the join) and add usersToPublicBatch for the list
// endpoint. Single SQL, 4 left joins, returns the same shape as
// userToPublic but for N users in 1 query.
function usersToPublicBatch(users, viewerDeviceId) {
  if (!users || users.length === 0) return [];
  // One query with subqueries for the 3 counts + a LEFT JOIN for
  // the isFollowing flag (per-viewer). The COUNT subqueries are
  // correlated to the outer user via u.device_id.
  const placeholders = users.map(() => "?").join(",");
  const sql = `
    SELECT u.*,
      (SELECT COUNT(*) FROM follows WHERE followee_device_id = u.device_id) AS follower_count,
      (SELECT COUNT(*) FROM follows WHERE follower_device_id = u.device_id) AS following_count,
      (SELECT COUNT(*) FROM recordings WHERE device_id = u.device_id) AS recording_count,
      CASE WHEN ? IS NULL OR ? = '' THEN 0
           ELSE (SELECT COUNT(*) FROM follows
                 WHERE follower_device_id = ? AND followee_device_id = u.device_id)
      END AS is_following
    FROM users u
    WHERE u.device_id IN (${placeholders})
  `;
  const params = [viewerDeviceId || "", viewerDeviceId || "", viewerDeviceId || "", ...users.map((u) => u.device_id)];
  const rows = db.prepare(sql).all(...params);
  // Preserve input order (the SQL is IN-clause, order is preserved
  // by SQLite, but be defensive).
  const byId = new Map(rows.map((r) => [r.device_id, r]));
  return users.map((u) => {
    const r = byId.get(u.device_id);
    return {
      // deviceId is intentionally omitted from public payloads — it is the
      // sole write-auth secret. Clients use handle + isMe instead.
      handle: r.handle,
      displayName: r.display_name,
      avatar: r.avatar,
      bio: r.bio,
      createdAt: r.created_at,
      followerCount: r.follower_count,
      followingCount: r.following_count,
      recordingCount: r.recording_count,
      isFollowing: !!r.is_following,
      isMe: viewerDeviceId === u.device_id,
    };
  });
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
    // Never expose device_id — it is the write-auth credential.
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
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const u = getOrCreateUser(deviceId);
  res.json(userToPublic(u, deviceId));
});

// PATCH /api/me — update profile
app.patch("/api/me", (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
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
    if (containsBannedWord(displayName)) return res.status(400).json({ error: "Display name contains blocked words" });
    db.prepare("UPDATE users SET display_name = ? WHERE device_id = ?").run(displayName.slice(0, 30), deviceId);
  }
  if (avatar !== undefined) {
    if (typeof avatar !== "string") return res.status(400).json({ error: "avatar must be a string" });
    if (containsBannedWord(avatar)) return res.status(400).json({ error: "Avatar contains blocked words" });
    db.prepare("UPDATE users SET avatar = ? WHERE device_id = ?").run(avatar.slice(0, 8), deviceId);
  }
  if (bio !== undefined) {
    if (typeof bio !== "string") return res.status(400).json({ error: "bio must be a string" });
    if (bio.length > 200) return res.status(400).json({ error: "Bio too long" });
    if (containsBannedWord(bio)) return res.status(400).json({ error: "Bio contains blocked words" });
    db.prepare("UPDATE users SET bio = ? WHERE device_id = ?").run(bio.slice(0, 200), deviceId);
  }
  if (handle !== undefined) {
    if (typeof handle !== "string") return res.status(400).json({ error: "handle must be a string" });
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    if (cleanHandle.length < 3) return res.status(400).json({ error: "Handle too short" });
    if (containsBannedWord(cleanHandle)) return res.status(400).json({ error: "Handle contains blocked words" });
    const existing = db.prepare("SELECT 1 FROM users WHERE handle = ? AND device_id != ?").get(cleanHandle, deviceId);
    if (existing) return res.status(409).json({ error: "Handle taken" });
    try {
      db.prepare("UPDATE users SET handle = ? WHERE device_id = ?").run(cleanHandle, deviceId);
    } catch (err) {
      // Race: UNIQUE index catches concurrent claims the SELECT missed.
      if (err && (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.code === "SQLITE_CONSTRAINT")) {
        return res.status(409).json({ error: "Handle taken" });
      }
      throw err;
    }
  }
  const u = db.prepare("SELECT * FROM users WHERE device_id = ?").get(deviceId);
  res.json(userToPublic(u, deviceId));
});

// GET /api/users/:handle — public profile
app.get("/api/users/:handle", (req, res) => {
  const viewer = parseDeviceId(req.headers["x-device-id"]) || "";
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json(userToPublic(u, viewer));
});

// POST /api/users/:handle/follow — toggle follow
app.post("/api/users/:handle/follow", followLimiter, (req, res) => {
  const viewer = parseDeviceId(req.headers["x-device-id"]);
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
  const limit = parseLimit(req.query.limit, 50, 100);
  const offset = Math.max(0, Math.min(parseInt(String(req.query.offset ?? "0"), 10) || 0, 5000));
  const rows = db.prepare(`
    SELECT users.* FROM follows
    JOIN users ON users.device_id = follows.follower_device_id
    WHERE follows.followee_device_id = ?
    ORDER BY follows.created_at DESC
    LIMIT ? OFFSET ?
  `).all(u.device_id, limit + 1, offset);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    users: usersToPublicBatch(page, parseDeviceId(req.headers["x-device-id"]) || ""),
    nextOffset: hasMore ? offset + limit : null,
  });
});

// GET /api/users/:handle/following
app.get("/api/users/:handle/following", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "Not found" });
  const limit = parseLimit(req.query.limit, 50, 100);
  const offset = Math.max(0, Math.min(parseInt(String(req.query.offset ?? "0"), 10) || 0, 5000));
  const rows = db.prepare(`
    SELECT users.* FROM follows
    JOIN users ON users.device_id = follows.followee_device_id
    WHERE follows.follower_device_id = ?
    ORDER BY follows.created_at DESC
    LIMIT ? OFFSET ?
  `).all(u.device_id, limit + 1, offset);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    users: usersToPublicBatch(page, parseDeviceId(req.headers["x-device-id"]) || ""),
    nextOffset: hasMore ? offset + limit : null,
  });
});

// GET /api/users/:handle/recordings — recordings by a user
app.get("/api/users/:handle/recordings", (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]) || "";
  const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle);
  if (!u) return res.status(404).json({ error: "Not found" });
  const limit = parseLimit(req.query.limit, 50, 100);
  const cursor = parseCursor(req.query.cursor);
  let rows;
  if (cursor) {
    rows = db.prepare(`
      SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
             (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
      FROM recordings r
      WHERE r.device_id = ?
        AND (r.created_at < ? OR (r.created_at = ? AND r.id < ?))
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?
    `).all(deviceId, u.device_id, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1);
  } else {
    rows = db.prepare(`
      SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
             (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
      FROM recordings r
      WHERE r.device_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?
    `).all(deviceId, u.device_id, limit + 1);
  }
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  res.json({
    recordings: page.map((r) => ({
      id: r.id, name: r.name, emoji: r.emoji,
      durationSec: r.duration_sec, upvotes: r.upvotes, userVoted: r.user_voted > 0,
      createdAt: r.created_at, audioUrl: `/uploads/${r.filename}`,
      author: userToPublic(u, deviceId),
    })),
    nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  });
});

// GET /api/feed — recordings from people you follow + your own
app.get("/api/feed", (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]) || "";
  const limit = parseLimit(req.query.limit, 50, 100);
  const cursor = parseCursor(req.query.cursor);
  // Make sure the user exists
  if (deviceId) getOrCreateUser(deviceId);
  let rows;
  if (cursor) {
    rows = db.prepare(`
      SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
             (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
      FROM recordings r
      WHERE (r.device_id = ?
         OR r.device_id IN (SELECT followee_device_id FROM follows WHERE follower_device_id = ?))
        AND (r.created_at < ? OR (r.created_at = ? AND r.id < ?))
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?
    `).all(deviceId, deviceId, deviceId, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1);
  } else {
    rows = db.prepare(`
      SELECT r.id, r.name, r.emoji, r.duration_sec, r.upvotes, r.created_at, r.filename, r.device_id,
             (SELECT COUNT(*) FROM votes WHERE recording_id = r.id AND device_id = ?) as user_voted
      FROM recordings r
      WHERE r.device_id = ?
         OR r.device_id IN (SELECT followee_device_id FROM follows WHERE follower_device_id = ?)
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?
    `).all(deviceId, deviceId, deviceId, limit + 1);
  }
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  // v79: batched author lookup. Key by the row's device_id — SQLite IN (...)
  // does not preserve authorIds order, so never zip authorMap[i] with authorIds[i].
  const authorIds = [...new Set(page.map(r => r.device_id))];
  const authorRows = authorIds.length === 0
    ? []
    : db.prepare(`SELECT * FROM users WHERE device_id IN (${authorIds.map(() => "?").join(",")})`).all(...authorIds);
  const authorMap = usersToPublicBatch(authorRows, deviceId);
  const byDeviceId = new Map();
  for (let i = 0; i < authorRows.length; i++) {
    byDeviceId.set(authorRows[i].device_id, authorMap[i]);
  }
  // Group by author for Instagram-style feed
  const groupOrder = [];
  const groupMap = new Map();
  for (const r of page) {
    if (!groupMap.has(r.device_id)) {
      groupOrder.push(r.device_id);
      groupMap.set(r.device_id, {
        author: byDeviceId.get(r.device_id),
        recordings: [],
      });
    }
    groupMap.get(r.device_id).recordings.push({
      id: r.id, name: r.name, emoji: r.emoji,
      durationSec: r.duration_sec, upvotes: r.upvotes, userVoted: r.user_voted > 0,
      createdAt: r.created_at, audioUrl: `/uploads/${r.filename}`,
    });
  }
  res.json({
    groups: groupOrder.map(id => groupMap.get(id)),
    nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  });
});

// GET /api/recordings/:id/comments
app.get("/api/recordings/:id/comments", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const limit = parseLimit(req.query.limit, 50, 100);
  const cursor = parseCursor(req.query.cursor);
  let rows;
  if (cursor) {
    rows = db.prepare(`
      SELECT c.id, c.body, c.created_at, c.device_id, u.handle, u.display_name, u.avatar
      FROM comments c
      LEFT JOIN users u ON u.device_id = c.device_id
      WHERE c.recording_id = ?
        AND (c.created_at > ? OR (c.created_at = ? AND c.id > ?))
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ?
    `).all(id, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1);
  } else {
    rows = db.prepare(`
      SELECT c.id, c.body, c.created_at, c.device_id, u.handle, u.display_name, u.avatar
      FROM comments c
      LEFT JOIN users u ON u.device_id = c.device_id
      WHERE c.recording_id = ?
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ?
    `).all(id, limit + 1);
  }
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  res.json({
    comments: page.map((r) => ({
      id: r.id, body: r.body, createdAt: r.created_at,
      author: { handle: r.handle, displayName: r.display_name, avatar: r.avatar },
    })),
    nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  });
});

// POST /api/recordings/:id/comments
app.post("/api/recordings/:id/comments", commentCreateLimiter, (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const body = (req.body && req.body.body || "").toString().trim();
  if (!body) return res.status(400).json({ error: "Empty comment" });
  if (body.length > 280) return res.status(400).json({ error: "Comment too long (max 280)" });
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "Comment contains blocked words" });
  }
  if (!recordingExists(id)) return res.status(404).json({ error: "Not found" });
  getOrCreateUser(deviceId);
  const r = db.prepare(`INSERT INTO comments (recording_id, device_id, body, created_at) VALUES (?, ?, ?, ?)`)
    .run(id, deviceId, body, Date.now());
  res.json({ id: r.lastInsertRowid, body, createdAt: Date.now() });
});

// DELETE /api/comments/:id
app.delete("/api/comments/:id", commentDeleteLimiter, (req, res) => {
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
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
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
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
  const deviceId = parseDeviceId(req.headers["x-device-id"]);
  if (!deviceId) return res.status(400).json({ error: "Missing x-device-id" });
  const id = parseIdParam(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid id" });
  const emoji = sanitizeEmoji(req.body && req.body.emoji);
  if (!emoji) return res.status(400).json({ error: "Invalid emoji" });
  if (!recordingExists(id)) return res.status(404).json({ error: "Not found" });
  // Toggle + re-aggregate in one transaction so concurrent toggles can't
  // double-insert (PK conflict) or return a torn count.
  const apply = db.transaction(() => {
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
    const rows = db.prepare(
      "SELECT emoji, COUNT(*) AS n FROM reactions WHERE recording_id = ? GROUP BY emoji"
    ).all(id);
    const counts = {};
    for (const r of rows) counts[r.emoji] = r.n;
    const mineRows = db.prepare(
      "SELECT emoji FROM reactions WHERE recording_id = ? AND device_id = ?"
    ).all(id, deviceId);
    return { counts, mine: mineRows.map((r) => r.emoji), added: !exists };
  });
  res.json(apply());
});

// GET /api/users — list all users (for discover)
app.get("/api/users", (req, res) => {
  const viewer = parseDeviceId(req.headers["x-device-id"]) || "";
  const limit = parseLimit(req.query.limit, 50, 100);
  const offset = Math.max(0, Math.min(parseInt(String(req.query.offset ?? "0"), 10) || 0, 5000));
  const rows = db.prepare(
    "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(limit + 1, offset);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    users: usersToPublicBatch(page, viewer),
    nextOffset: hasMore ? offset + limit : null,
  });
});

// Final JSON error handler — never leak stacks / HTML default pages to clients.
app.use((err, req, res, _next) => {
  console.error("[unhandled]", err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  const status = Number(err && err.status) || Number(err && err.statusCode) || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status >= 500 ? "Internal error" : (err && err.message) || "Request failed",
  });
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
