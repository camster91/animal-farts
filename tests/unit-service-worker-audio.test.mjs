import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function harness() {
  const handlers = {};
  const entries = new Map();
  const network = [];
  const cacheWrites = [];
  const bytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
  let online = true;
  const key = req => typeof req === 'string' ? req : req.url;
  const cache = {
    match: async req => entries.get(key(req))?.clone(),
    put: async (req, res) => {
      cacheWrites.push(res.status);
      assert.notEqual(res.status, 206, 'browser Cache.put rejects partial responses');
      entries.set(key(req), res.clone());
    },
  };
  const context = vm.createContext({
    self: { location: { origin: 'https://app.test' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { open: async () => cache, match: cache.match },
    fetch: async req => {
      if (!online) throw new Error('offline');
      network.push(req);
      const range = req.headers.get('range');
      return new Response(range ? bytes.slice(0, 4) : bytes, { status: range ? 206 : 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': range ? '4' : '8',
          ...(range ? { 'Content-Range': 'bytes 0-3/8' } : {}) } });
    },
    Request, Response, Headers, URL, Uint8Array, console,
  });
  vm.runInContext(readFileSync('public/sw.js', 'utf8'), context);
  const request = async (path, headers = {}) => {
    const background = [];
    let response;
    handlers.fetch({ request: new Request(`https://app.test${path}`, { headers }),
      respondWith: promise => { response = promise; }, waitUntil: promise => { background.push(promise); } });
    const result = await response;
    await Promise.all(background);
    return result;
  };
  return { request, network, cacheWrites, entries, offline: () => { online = false; } };
}

test('a browser range request saves the complete sound for later offline playback', async () => {
  const h = harness();
  const online = await h.request('/sounds/bear.mp3', { Range: 'bytes=0-3' });
  assert.equal(online.status, 206);
  assert.deepEqual([...new Uint8Array(await online.arrayBuffer())], [10, 20, 30, 40]);
  assert.equal(h.network[0].headers.has('range'), false, 'cache the full audio, never a 206 response');
  h.offline();
  const offline = await h.request('/sounds/bear.mp3', { Range: 'bytes=0-3' });
  assert.equal(offline.status, 206);
  assert.deepEqual([...new Uint8Array(await offline.arrayBuffer())], [10, 20, 30, 40]);
  assert.deepEqual(h.cacheWrites, [200]);
});

test('cached audio supports suffix, open ranges and unsatisfiable ranges', async () => {
  const h = harness();
  await h.request('/sounds/bear.mp3');
  h.offline();
  const suffix = await h.request('/sounds/bear.mp3', { Range: 'bytes=-2' });
  assert.equal(suffix.status, 206);
  assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())], [70, 80]);
  const open = await h.request('/sounds/bear.mp3', { Range: 'bytes=5-' });
  assert.deepEqual([...new Uint8Array(await open.arrayBuffer())], [60, 70, 80]);
  const invalid = await h.request('/sounds/bear.mp3', { Range: 'bytes=99-' });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get('content-range'), 'bytes */8');
});

test('played uploaded recordings also remain available offline', async () => {
  const h = harness();
  await h.request('/uploads/test.webm', { Range: 'bytes=0-3' });
  assert.equal(h.entries.size, 1);
  h.offline();
  const response = await h.request('/uploads/test.webm', { Range: 'bytes=0-3' });
  assert.equal(response.status, 206);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [10, 20, 30, 40]);
});
