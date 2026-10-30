import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { cleanup } from '../cloudflare/worker.mjs';

// Real SQLite executes the production SQL. Only the D1/R2 transport is adapted.
function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8'));
  const prepared = (sql, args = []) => ({
    bind: (...values) => prepared(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) || null,
    run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...args) }),
  });
  const objects = new Map();
  let failPut = false;
  let failDelete = false;
  const env = {
    DB: { prepare: prepared, batch: async queries => {
      sqlite.exec('BEGIN');
      try { const result = await Promise.all(queries.map(q => q.run())); sqlite.exec('COMMIT'); return result; }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    } },
    AUDIO: {
      put: async (key, bytes) => { if (failPut) throw new Error('R2 unavailable'); objects.set(key, bytes); },
      head: async key => objects.has(key) ? {} : null,
      get: async (key, options) => {
        if (!objects.has(key)) return null;
        const bytes = objects.get(key);
        const requested = options?.range?.get('range');
        const match = requested && /^bytes=(\d+)-(\d+)$/.exec(requested);
        const offset = match ? Number(match[1]) : 0;
        const length = match ? Number(match[2]) - offset + 1 : bytes.length;
        // Real R2 includes range metadata even when no Range header was supplied.
        return { body: bytes.slice(offset, offset + length), size: bytes.length,
          httpEtag: '"test"', range: { offset, length } };
      },
      delete: async key => { if (failDelete) throw new Error('R2 unavailable'); objects.delete(key); },
    },
    ASSETS: { fetch: async () => new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } }) },
  };
  let ip = 1;
  const request = async (path, options = {}) => {
    const background = [];
    const headers = new Headers(options.headers);
    if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', `192.0.2.${ip++}`);
    const response = await worker.fetch(new Request(`https://pootbox.test${path}`, { ...options, headers }), env,
      { waitUntil: promise => background.push(promise) });
    await Promise.all(background);
    return response;
  };
  const upload = (options = {}) => {
    const form = new FormData();
    form.set('name', options.name ?? 'Funny sound');
    form.set('emoji', '💨');
    form.set('durationSec', '1.5');
    form.set('audio', new Blob([options.bytes ?? new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])],
      { type: options.mime ?? 'audio/webm' }), 'sound.webm');
    return request('/api/recordings', { method: 'POST', headers: { 'x-device-id': options.owner ?? 'owner_123',
      ...(options.op ? { 'x-operation-id': options.op } : {}) }, body: form });
  };
  const share = (recording, owner = 'owner_123') => request('/api/share', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-id': owner },
    body: JSON.stringify({ audioUrl: recording.audioUrl, name: recording.name, emoji: '💨' }) });
  return { sqlite, objects, env, request, upload, share,
    failPut: () => { failPut = true; }, failDelete: () => { failDelete = true; } };
}

test('Cloudflare: upload, playback, controlled share, delete and retry end to end', async () => {
  const h = harness();
  const response = await h.upload({ op: 'upload_op_123' });
  assert.equal(response.status, 200);
  const recording = await response.json();
  assert.equal(recording.durationSec, 1.5);
  assert.equal('device_id' in recording, false);
  assert.equal((await h.upload({ op: 'upload_op_123' }).then(r => r.json())).id, recording.id);
  assert.equal(h.objects.size, 1);
  const playback = await h.request(recording.audioUrl);
  assert.equal(playback.status, 200);
  assert.equal(playback.headers.get('content-type'), 'audio/webm');
  assert.equal((await playback.arrayBuffer()).byteLength, 8);
  assert.equal((await h.request(recording.audioUrl, { method: 'HEAD' })).status, 200);
  const partial = await h.request(recording.audioUrl, { headers: { Range: 'bytes=0-3' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 0-3/8');
  assert.equal((await partial.arrayBuffer()).byteLength, 4);
  const sharing = await h.share(recording);
  assert.equal(sharing.status, 200);
  const { code } = await sharing.json();
  assert.equal(code.length, 8);
  const resolved = await h.request(`/api/share/${code}`).then(r => r.json());
  assert.equal(resolved.audioUrl, recording.audioUrl);
  assert.equal('device_id' in resolved, false);
  const deletion = { method: 'DELETE', headers: { 'x-device-id': 'owner_123', 'x-operation-id': 'delete_op_123' } };
  assert.equal((await h.request(`/api/recordings/${recording.id}`, deletion)).status, 200);
  assert.equal((await h.request(`/api/recordings/${recording.id}`, deletion).then(r => r.json())).alreadyDeleted, true);
  assert.equal((await h.request(`/api/share/${code}`)).status, 404);
  assert.equal((await h.request(recording.audioUrl)).status, 404);
  assert.equal(h.objects.size, 0);
});

test('Cloudflare: cross-device share and delete are denied', async () => {
  const h = harness();
  const recording = await h.upload().then(r => r.json());
  assert.equal((await h.share(recording, 'other_123')).status, 403);
  assert.equal((await h.request(`/api/recordings/${recording.id}`, { method: 'DELETE', headers: { 'x-device-id': 'other_123' } })).status, 403);
  assert.equal(h.objects.size, 1);
});

test('Cloudflare: social routes stay disabled, including with an enabling flag', async () => {
  const h = harness();
  h.env.SOCIAL_FEATURES_ENABLED = '1';
  for (const path of ['/api/recordings', '/api/me', '/api/feed', '/api/users', '/api/users/test', '/api/recordings/1/comments', '/api/recordings/1/reactions']) {
    assert.equal((await h.request(path)).status, 404, path);
  }
  assert.equal((await h.request('/api/recordings/1/upvote', { method: 'POST' })).status, 404);
});

test('Cloudflare: forged audio, bad identity, blocked name and invalid operation do not persist', async () => {
  const h = harness();
  assert.equal((await h.upload({ bytes: new TextEncoder().encode('<html>hello</html>') })).status, 400);
  assert.equal((await h.upload({ mime: 'audio/html' })).status, 400);
  assert.equal((await h.upload({ owner: '../evil' })).status, 400);
  assert.equal((await h.upload({ name: 'shitface' })).status, 400);
  assert.equal((await h.upload({ op: 'short' })).status, 400);
  assert.equal(h.objects.size, 0);
});

test('Cloudflare: 5MiB audio and streamed request size ceilings are enforced', async () => {
  const h = harness();
  assert.equal((await h.upload({ bytes: new Uint8Array(5 * 1024 * 1024 + 1) })).status, 413);
  assert.equal((await h.request('/api/share', { method: 'POST', headers: { 'x-device-id': 'owner_123' }, body: 'x'.repeat(1024 * 1024 + 1) })).status, 413);
  assert.equal(h.objects.size, 0);
});

test('Cloudflare: expired shares are rejected before retention cleanup runs', async () => {
  const h = harness();
  const recording = await h.upload().then(r => r.json());
  const { code } = await h.share(recording).then(r => r.json());
  h.sqlite.prepare('UPDATE share_codes SET created_at = ?').run(Date.now() - 31 * 86400000);
  assert.equal((await h.request(`/api/share/${code}`)).status, 404);
  await cleanup(h.env);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM share_codes').get().n, 0);
});

test('Cloudflare: concurrent quota and retry enforcement never creates more than 40 recordings', async () => {
  const h = harness();
  for (let i = 0; i < 39; i++) assert.equal((await h.upload({ op: `operation_${i}` })).status, 200);
  const responses = await Promise.all([h.upload({ op: 'last_upload_one' }), h.upload({ op: 'last_upload_two' })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]);
  assert.equal(h.objects.size, 40);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM recordings').get().n, 40);
  const replay = await h.upload({ op: 'operation_0' }).then(r => r.json());
  assert.equal(replay.deduplicated, true);
  assert.equal(h.objects.size, 40);
});

test('Cloudflare: concurrent upload retries keep one row and one R2 object', async () => {
  const h = harness();
  const recordings = await Promise.all(Array.from({ length: 4 }, () => h.upload({ op: 'same_operation' }).then(r => r.json())));
  assert.equal(new Set(recordings.map(r => r.id)).size, 1);
  assert.equal(h.objects.size, 1);
});

test('Cloudflare: R2 outages fail closed without false upload/delete success', async () => {
  const h = harness();
  const recording = await h.upload().then(r => r.json());
  h.failDelete();
  assert.equal((await h.request(`/api/recordings/${recording.id}`, { method: 'DELETE', headers: { 'x-device-id': 'owner_123' } })).status, 503);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM recordings').get().n, 1);
  h.failPut();
  assert.equal((await h.upload()).status, 503);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM recordings').get().n, 1);
});

test('Cloudflare: fixed-window limits are shared across requests and return Retry-After', async () => {
  const h = harness();
  for (let i = 0; i < 30; i++) assert.equal((await h.request('/api/share/ABCDEFGH', { headers: { 'cf-connecting-ip': '192.0.2.99' } })).status, 404);
  const response = await h.request('/api/share/ABCDEFGH', { headers: { 'cf-connecting-ip': '192.0.2.99' } });
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
});

test('Cloudflare: health, static headers, narrow native CORS and JSON 404s', async () => {
  const h = harness();
  assert.deepEqual(await h.request('/api/health').then(r => r.json()), { ok: true });
  assert.equal((await h.request('/sw.js')).headers.get('cache-control'), 'no-cache, must-revalidate');
  assert.equal((await h.request('/')).headers.get('permissions-policy'), 'microphone=(self), camera=(), geolocation=(), payment=()');
  const cors = await h.request('/api/health', { headers: { origin: 'https://localhost' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'https://localhost');
  assert.equal((await h.request('/api/health', { headers: { origin: 'https://evil.test' } })).headers.has('access-control-allow-origin'), false);
  const missing = await h.request('/api/not-found');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('content-type'), 'application/json');
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  h.env.DB = null;
  assert.equal((await h.request('/api/health')).status, 503);
});

test('Cloudflare: malformed JSON, invalid codes and path traversal return bounded errors', async () => {
  const h = harness();
  assert.equal((await h.request('/api/share', { method: 'POST', headers: { 'x-device-id': 'owner_123' }, body: '{' })).status, 400);
  assert.equal((await h.request('/api/share/ABCDEFGHXXXXX')).status, 400);
  assert.equal((await h.request('/uploads/evil.html')).status, 404);
  assert.equal((await h.request('/api/recordings/1junk', { method: 'DELETE', headers: { 'x-device-id': 'owner_123' } })).status, 400);
});
