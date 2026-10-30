// Runs from GitHub Actions where the live Cloudflare endpoint is reachable.
// Uses synthetic silent audio and removes only the recording it creates.
import assert from 'node:assert/strict';

const base = 'https://pootbox.pages.dev';
const owner = `qa_${crypto.randomUUID().replaceAll('-', '')}`;
const operation = `qa_upload_${crypto.randomUUID()}`;
const call = (path, init) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(20000) });
const expectJSON = async (response, status = 200) => {
  assert.equal(response.status, status, `Unexpected HTTP status: ${response.status}`);
  assert.ok(response.headers.get('content-type')?.includes('application/json'));
  return response.json();
};

let recording;
try {
  assert.deepEqual(await call('/api/health').then(r => expectJSON(r)), { ok: true });
  for (const path of ['/api/recordings', '/api/me', '/api/users', '/api/feed']) {
    await call(path).then(r => expectJSON(r, 404));
  }
  const home = await call('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /PootBox/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  const sw = await call('/sw.js');
  assert.equal(sw.status, 200);
  assert.match(sw.headers.get('cache-control'), /no-cache/);
  const manifest = await call('/manifest.webmanifest');
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get('content-type'), /json|manifest/);
  assert.ok((await manifest.json()).name);
  const audio = new Uint8Array(1644);
  const view = new DataView(audio.buffer);
  const text = (offset, value) => [...value].forEach((c, i) => { audio[offset + i] = c.charCodeAt(0); });
  text(0, 'RIFF'); view.setUint32(4, audio.length - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, 1600, true);
  const upload = async () => {
    const form = new FormData();
    form.set('name', 'Cloudflare QA'); form.set('emoji', '🔧'); form.set('durationSec', '0.1');
    form.set('audio', new Blob([audio], { type: 'audio/wav' }), 'qa.wav');
    return call('/api/recordings', { method: 'POST', headers: { 'x-device-id': owner, 'x-operation-id': operation }, body: form }).then(r => expectJSON(r));
  };
  recording = await upload();
  assert.equal((await upload()).id, recording.id);
  assert.equal('device_id' in recording, false);
  const playback = await call(recording.audioUrl);
  assert.equal(playback.status, 200);
  assert.match(playback.headers.get('content-type'), /^audio\/wav/);
  assert.deepEqual(new Uint8Array(await playback.arrayBuffer()), audio);
  const partial = await call(recording.audioUrl, { headers: { Range: 'bytes=0-15' } });
  assert.equal(partial.status, 206);
  assert.equal((await partial.arrayBuffer()).byteLength, 16);
  const head = await call(recording.audioUrl, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), audio.length);
  const shareBody = JSON.stringify({ audioUrl: recording.audioUrl, name: recording.name, emoji: '🔧' });
  const shared = await call('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-id': owner }, body: shareBody }).then(r => expectJSON(r));
  assert.match(shared.code, /^[A-Z2-9]{8}$/);
  const resolved = await call(`/api/share/${shared.code}`).then(r => expectJSON(r));
  assert.equal(resolved.audioUrl, recording.audioUrl);
  assert.equal('device_id' in resolved, false);
  await call('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-id': 'qa_stranger' }, body: shareBody }).then(r => expectJSON(r, 403));
  await call(`/api/recordings/${recording.id}`, { method: 'DELETE', headers: { 'x-device-id': 'qa_stranger' } }).then(r => expectJSON(r, 403));
  const deletion = { method: 'DELETE', headers: { 'x-device-id': owner, 'x-operation-id': `qa_delete_${crypto.randomUUID()}` } };
  await call(`/api/recordings/${recording.id}`, deletion).then(r => expectJSON(r));
  assert.equal((await call(`/api/recordings/${recording.id}`, deletion).then(r => expectJSON(r))).alreadyDeleted, true);
  await call(`/api/share/${shared.code}`).then(r => expectJSON(r, 404));
  await call(recording.audioUrl).then(r => expectJSON(r, 404));
  recording = null;
  console.log('Cloudflare live smoke passed: app, health, security headers, social boundary, upload/retry, R2 playback/range/HEAD, share/resolve, ownership, delete/retry.');
} finally {
  if (recording) {
    const response = await call(`/api/recordings/${recording.id}`, { method: 'DELETE', headers: { 'x-device-id': owner } });
    if (![200, 404].includes(response.status)) console.error('Synthetic QA recording cleanup failed.');
  }
}
