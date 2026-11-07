// Cloudflare Pages advanced-mode Worker. The Express deployment remains supported.
import { containsBannedWord } from '../server/moderation.js';

const DAY = 86400000;
const MAX_AUDIO = 5 * 1024 * 1024;
const MIME_EXT = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/wave': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg' };
const EXT_MIME = { webm: 'audio/webm', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
const json = (body, status = 200) => Response.json(body, { status });
const error = (message, status = 400) => json({ error: message }, status);
const device = request => {
  const id = request.headers.get('x-device-id')?.trim();
  return /^[a-zA-Z0-9_-]{4,64}$/.test(id || '') ? id : null;
};
const operation = request => {
  const id = request.headers.get('x-operation-id');
  if (id === null) return null;
  return /^[a-zA-Z0-9_-]{8,128}$/.test(id.trim()) ? id.trim() : false;
};
const statement = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const first = (env, sql, ...args) => statement(env, sql, ...args).first();
const run = (env, sql, ...args) => statement(env, sql, ...args).run();
const publicRecording = row => ({ id: row.id, name: row.name, emoji: row.emoji,
  durationSec: row.duration_sec, upvotes: 0, userVoted: false, audioUrl: `/uploads/${row.filename}` });

// Same signature checks as the filesystem server, using bytes instead of node:fs.
export function audioMagic(bytes, ext) {
  if (bytes.length < 4) return false;
  const starts = value => [...value].every((c, i) => bytes[i] === c.charCodeAt(0));
  if (ext === 'webm') return [0x1a, 0x45, 0xdf, 0xa3].every((b, i) => bytes[i] === b);
  if (ext === 'ogg') return starts('OggS');
  if (ext === 'wav') return starts('RIFF');
  if (ext === 'mp3') return starts('ID3') || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (ext === 'm4a') return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  return false;
}

async function readLimited(request, max) {
  if (Number(request.headers.get('content-length')) > max) throw new Response(null, { status: 413 });
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) { await reader.cancel(); throw new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function readJSON(request) {
  try {
    const bytes = await readLimited(request, 1024 * 1024);
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
    return value;
  } catch (e) {
    if (e instanceof Response) throw error('Request too large', e.status);
    throw error('Invalid JSON');
  }
}

async function limit(request, env, scope, ceiling) {
  // Cloudflare supplies this header; never trust caller X-Forwarded-For.
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const window = Math.floor(Date.now() / 60000);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${window}:${ip}`));
  const key = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const row = await first(env, `INSERT INTO rate_limits (key, window, n) VALUES (?, ?, 1)
    ON CONFLICT(key, window) DO UPDATE SET n = n + 1 RETURNING n`, key, window);
  return row.n > ceiling ? new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(60 - Math.floor(Date.now() / 1000) % 60) },
  }) : null;
}

export async function cleanup(env) {
  return env.DB.batch([
    statement(env, 'DELETE FROM share_codes WHERE created_at < ?', Date.now() - 30 * DAY),
    statement(env, 'DELETE FROM recording_deletions WHERE created_at < ?', Date.now() - 90 * DAY),
    statement(env, 'DELETE FROM rate_limits WHERE window < ?', Math.floor(Date.now() / 60000) - 2),
  ]);
}

async function upload(request, env) {
  const owner = device(request);
  const op = operation(request);
  if (!owner) return error('Missing or invalid x-device-id');
  if (op === false) return error('Invalid x-operation-id');
  let form;
  try {
    const bytes = await readLimited(request, MAX_AUDIO + 65536);
    form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
  } catch (e) {
    if (e instanceof Response) return error('File too large', e.status);
    return error('Invalid multipart upload');
  }
  const audio = form.get('audio');
  const name = form.get('name');
  const emoji = String(form.get('emoji') || '💨').slice(0, 8);
  if (!audio || typeof audio.arrayBuffer !== 'function') return error('No audio file provided');
  if (typeof name !== 'string' || !name.trim() || name.length > 40) return error('Name must be a string up to 40 chars');
  if (containsBannedWord(name) || containsBannedWord(emoji)) return error('Name or emoji contains blocked words');
  if (audio.size > MAX_AUDIO) return error('File too large', 413);
  const ext = MIME_EXT[audio.type];
  if (!ext) return error('Only audio files allowed');
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!audioMagic(bytes, ext)) return error('Invalid audio file');
  if (op) {
    const existing = await first(env, 'SELECT * FROM recordings WHERE device_id = ? AND client_operation_id = ?', owner, op);
    if (existing) return json({ ...publicRecording(existing), deduplicated: true });
  }
  const filename = `${crypto.randomUUID().replaceAll('-', '')}.${ext}`;
  const rawDuration = parseFloat(String(form.get('durationSec')));
  const duration = Number.isFinite(rawDuration) ? rawDuration : null;
  await env.AUDIO.put(filename, bytes, { httpMetadata: { contentType: EXT_MIME[ext] } });
  let row;
  try {
    // A single SQL statement enforces the quota and idempotency under concurrency.
    row = await first(env, `INSERT INTO recordings
      (name, emoji, device_id, kid_name, filename, duration_sec, created_at, client_operation_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM recordings WHERE device_id = ?) < 40
      ON CONFLICT DO NOTHING RETURNING *`, name, emoji, owner,
    form.get('kidName') ? String(form.get('kidName')).slice(0, 20) : null,
    filename, duration, Date.now(), op, owner);
  } catch (e) {
    // A failed SQL response can follow a committed INSERT. Do not delete its audio.
    const committed = await first(env, 'SELECT * FROM recordings WHERE filename = ?', filename);
    if (committed) return json(publicRecording(committed));
    await env.AUDIO.delete(filename);
    throw e;
  }
  if (!row) {
    await env.AUDIO.delete(filename);
    const existing = op && await first(env, 'SELECT * FROM recordings WHERE device_id = ? AND client_operation_id = ?', owner, op);
    if (existing) return json({ ...publicRecording(existing), deduplicated: true });
    return error('Recording limit reached (40). Delete an old one first.', 429);
  }
  return json(publicRecording(row));
}

async function remove(request, env, id) {
  if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return error('Invalid id');
  const owner = device(request);
  const op = operation(request);
  if (!owner) return error('Missing or invalid x-device-id');
  if (op === false) return error('Invalid x-operation-id');
  if (op) {
    const done = await first(env, 'SELECT recording_id FROM recording_deletions WHERE device_id = ? AND operation_id = ?', owner, op);
    if (done) return Number(id) === done.recording_id
      ? json({ ok: true, alreadyDeleted: true, id: done.recording_id }) : error('Operation belongs to another recording', 409);
  }
  const row = await first(env, 'SELECT * FROM recordings WHERE id = ?', Number(id));
  if (!row) return error('Not found', 404);
  if (row.device_id !== owner) return error('Not your recording', 403);
  await env.AUDIO.delete(row.filename);
  const queries = [
    statement(env, 'DELETE FROM share_codes WHERE audio_url = ?', `/uploads/${row.filename}`),
    statement(env, 'DELETE FROM recordings WHERE id = ? AND device_id = ?', Number(id), owner),
  ];
  if (op) queries.push(statement(env, `INSERT INTO recording_deletions (device_id, operation_id, recording_id, created_at)
    VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, owner, op, Number(id), Date.now()));
  await env.DB.batch(queries);
  return json({ ok: true });
}

async function share(request, env) {
  const owner = device(request);
  if (!owner) return error('Missing or invalid x-device-id');
  const body = await readJSON(request);
  if (typeof body.audioUrl !== 'string' || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(body.audioUrl)) return error('audioUrl must be a /uploads/... path');
  const filename = body.audioUrl.slice('/uploads/'.length);
  if (!await first(env, 'SELECT 1 FROM recordings WHERE filename = ? AND device_id = ?', filename, owner)) return error('Not your recording', 403);
  if (!await env.AUDIO.head(filename)) return error('Audio file not found', 404);
  if (containsBannedWord(body.name) || containsBannedWord(body.emoji)) return error('Name or emoji contains blocked words');
  const name = String(body.name || 'Shared sound').slice(0, 60);
  const emoji = String(body.emoji || '💨').slice(0, 8);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    // Rejection sampling avoids modulo bias with the 31-character alphabet.
    let code = '';
    while (code.length < 8) {
      const byte = crypto.getRandomValues(new Uint8Array(1))[0];
      if (byte < 256 - 256 % alphabet.length) code += alphabet[byte % alphabet.length];
    }
    const inserted = await first(env, `INSERT INTO share_codes (code, audio_url, name, emoji, created_at)
      SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM recordings WHERE filename = ? AND device_id = ?)
      ON CONFLICT DO NOTHING RETURNING code`, code, body.audioUrl, name, emoji, Date.now(), filename, owner);
    if (inserted) return json({ code, audioUrl: body.audioUrl, name, emoji });
  }
  return error('Could not create share code, retry', 409);
}

async function audio(request, env, path) {
  if (!['GET', 'HEAD'].includes(request.method)) return error('Not found', 404);
  const filename = path.slice('/uploads/'.length);
  if (!/^[A-Za-z0-9_-]+\.(webm|m4a|mp3|wav|ogg)$/.test(filename)) return error('Not found', 404);
  // Only committed, retained recordings are playable; orphan objects are not exposed.
  if (!await first(env, 'SELECT 1 FROM recordings WHERE filename = ?', filename)) return error('Not found', 404);
  const object = await env.AUDIO.get(filename, { range: request.headers });
  if (!object) return error('Not found', 404);
  const headers = new Headers({ 'Content-Type': EXT_MIME[filename.split('.').pop()],
    'Cache-Control': 'private, max-age=0, must-revalidate', 'Cross-Origin-Resource-Policy': 'cross-origin',
    'Accept-Ranges': 'bytes', 'ETag': object.httpEtag });
  let status = 200;
  // R2 also returns range metadata for a full GET; only a requested range is 206.
  if (request.headers.has('range') && object.range && 'offset' in object.range && 'length' in object.range) {
    const { offset, length } = object.range;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    status = 206;
  } else headers.set('Content-Length', String(object.size));
  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

async function route(request, env, ctx) {
  const path = new URL(request.url).pathname;
  const api = path === '/api' || path.startsWith('/api/');
  if (!api && !path.startsWith('/uploads/')) {
    if (!['GET', 'HEAD'].includes(request.method)) return error('Not found', 404);
    return env.ASSETS.fetch(request);
  }
  if (request.method === 'OPTIONS' && request.headers.get('origin') === 'https://localhost') return new Response(null, { status: 204 });
  if (!env.DB || !env.AUDIO) return error('Storage unavailable', 503);
  if (api) {
    const limited = await limit(request, env, 'general', 120);
    if (limited) return limited;
    // No social feature flag can enable public discovery in this deployment.
    if ((path === '/api/recordings' && request.method === 'GET') ||
      /^\/api\/(me|feed|users|comments)(\/|$)/.test(path) ||
      /^\/api\/recordings\/[^/]+\/(upvote|comments|reactions)/.test(path)) return error('Not found', 404);
    const scope = request.method === 'POST' && path === '/api/recordings' ? ['upload', 6]
      : request.method === 'POST' && path === '/api/share' ? ['share-mint', 6]
      : path.startsWith('/api/share/') ? ['share-lookup', 30]
      : ['/api/errors', '/api/feedback'].includes(path) ? ['telemetry', 30] : null;
    if (scope) { const limited = await limit(request, env, ...scope); if (limited) return limited; }
  }
  // Expiry is enforced on reads; background cleanup only reclaims stale rows.
  if (path === '/api/health' || Math.random() < 0.02) ctx.waitUntil(cleanup(env).catch(() => console.error('Retention cleanup failed')));
  if (path === '/api/health' && request.method === 'GET') { await first(env, 'SELECT 1'); return json({ ok: true }); }
  if (path.startsWith('/uploads/')) return audio(request, env, path);
  if (path === '/api/recordings' && request.method === 'POST') return upload(request, env);
  const deletion = /^\/api\/recordings\/([^/]+)$/.exec(path);
  if (deletion && request.method === 'DELETE') return remove(request, env, deletion[1]);
  if (path === '/api/share' && request.method === 'POST') return share(request, env);
  const lookup = /^\/api\/share\/([^/]+)$/.exec(path);
  if (lookup && request.method === 'GET') {
    const code = lookup[1].toUpperCase();
    if (!/^([A-Z0-9]{4}|[A-Z0-9]{8})$/.test(code)) return error('Invalid code format');
    const row = await first(env, `SELECT s.* FROM share_codes s JOIN recordings r ON s.audio_url = '/uploads/' || r.filename
      WHERE s.code = ? AND s.created_at >= ?`, code, Date.now() - 30 * DAY);
    if (!row) return error('Code not found', 404);
    if (!await env.AUDIO.head(row.audio_url.slice('/uploads/'.length))) return error('Audio file not found', 404);
    return json({ code, audioUrl: row.audio_url, name: row.name, emoji: row.emoji, createdAt: row.created_at });
  }
  if (request.method === 'POST' && ['/api/errors', '/api/feedback'].includes(path)) {
    const body = await readJSON(request);
    if (path === '/api/feedback' && (typeof body.message !== 'string' || !body.message.trim())) return error('message is required');
    // Match the existing support channel, without logging device IDs or whole bodies.
    const message = String(body.message || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
    console.info(JSON.stringify({ type: path === '/api/feedback' ? 'feedback' : 'client-error', message }));
    return json({ ok: true });
  }
  return error('Not found', 404);
}

export default {
  async fetch(request, env, ctx) {
    let response;
    try { response = await route(request, env, ctx); }
    catch (e) {
      response = e instanceof Response ? e : error('Service temporarily unavailable', 503);
      if (!(e instanceof Response)) console.error('PootBox request failed');
    }
    const out = new Response(response.body, response);
    const path = new URL(request.url).pathname;
    out.headers.set('X-Content-Type-Options', 'nosniff');
    out.headers.set('X-Frame-Options', 'DENY');
    out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    out.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=(), payment=()');
    if (path === '/api' || path.startsWith('/api/')) {
      out.headers.set('Content-Type', 'application/json');
      out.headers.set('Cache-Control', 'no-store');
      out.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
    if (path === '/sw.js') out.headers.set('Cache-Control', 'no-cache, must-revalidate');
    if (request.headers.get('origin') === 'https://localhost' && (path.startsWith('/api/') || path.startsWith('/uploads/'))) {
      out.headers.set('Access-Control-Allow-Origin', 'https://localhost');
      out.headers.append('Vary', 'Origin');
      out.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, OPTIONS');
      out.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, X-Operation-Id');
    }
    return out;
  },
};
