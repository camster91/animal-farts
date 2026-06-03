// Local server for Animal Farts.
// Endpoints:
//   GET  /api/recordings       — list shared recordings
//   POST /api/recordings       — upload a new recording (multipart, audio file + metadata)
//   POST /api/recordings/:id/upvote — upvote (deduped by device id)
//   GET  /api/recordings/:id/audio — fetch the audio file
//   GET  /api/health           — health check
//
// Storage: SQLite for metadata, /server/uploads/ for audio files (webm/mp4).
// No auth — device-id header is used to dedupe upvotes and identify the "creator".

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
`);

const app = express();
app.use(cors());
// No body parser needed — multer handles multipart for uploads, and the other
// endpoints don't need a JSON body (they read headers + URL params).

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
  db.prepare("DELETE FROM recordings WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`💥 Animal Farts server running on http://localhost:${PORT}`);
});
