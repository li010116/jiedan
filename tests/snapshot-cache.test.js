import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotCache, createKeyedSnapshotCache } from '../src/admin/snapshot-cache.js';

test('business snapshot deduplicates, expires, invalidates, and cannot restore stale data after a mutation', async () => {
  let time = 0, calls = 0;
  const cache = createSnapshotCache({ ttl: 30, now: () => time });
  const load = async () => ({ version: ++calls });
  const [a,b] = await Promise.all([cache.get(load), cache.get(load)]);
  assert.equal(a, b); assert.equal(calls, 1);
  assert.equal((await cache.get(load)).version, 1);
  time = 31; assert.equal((await cache.get(load)).version, 2);
  assert.equal((await cache.get(load, { force: true })).version, 3);
  let release;
  cache.clear();
  const old = cache.get(() => new Promise(resolve => { release = resolve; }));
  await Promise.resolve(); cache.clear();
  assert.equal((await cache.get(load)).version, 4);
  release({ version: -1 }); await old;
  assert.equal((await cache.get(load)).version, 4);
});

test('paged cache isolates filters, evicts least recent pages, and invalidates every page after writes', async () => {
  const cache = createKeyedSnapshotCache({ maxEntries: 2 });
  let calls = 0;
  const loader = async () => ++calls;
  assert.equal(await cache.get('page=1',loader),1);
  assert.equal(await cache.get('page=2',loader),2);
  assert.equal(await cache.get('page=1',loader),1);
  assert.equal(await cache.get('search=hello',loader),3);
  assert.equal(await cache.get('page=2',loader),4);
  cache.clear();
  assert.equal(await cache.get('page=2',loader),5);
  assert.equal(await cache.get('search=hello',loader),6);
});
test('aborting a consumer does not cancel other readers, and failed snapshots can be retried', async () => {
  const cache = createSnapshotCache();
  const controller = new AbortController();
  let release;
  const loader = () => new Promise(resolve => { release = resolve; });
  const first = cache.get(loader, { signal: controller.signal });
  const second = cache.get(loader);
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  release({ ready: true });
  assert.deepEqual(await second, { ready: true });
  cache.clear();
  await assert.rejects(cache.get(() => Promise.reject(new Error('offline'))), /offline/);
  assert.deepEqual(await cache.get(async () => ({ ready: true })), { ready: true });
});
