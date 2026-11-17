import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { encode, decode } from '@ipld/dag-cbor';
import { installInboxCursorCompatibility } from '../src/inbox-cursor-compat.js';

function fixture() {
  const calls = [];
  const inboxes = {
    fetchMessageBatch(...args) { calls.push(args); return Promise.resolve({ response: 'page' }); },
  };
  const client = installInboxCursorCompatibility({ inboxes });
  return { calls, client, inboxes };
}

test('initial query keeps tags and schema while continuation uses only a CBOR cursor body', async () => {
  const { calls, inboxes } = fixture();
  const body = encode({ tags: [new Uint8Array([1])], schema: { type: 'object' } });
  const controller = new AbortController();
  await inboxes.fetchMessageBatch('https://example.test/inbox', 'query', body, 'test-token', undefined, controller.signal);
  assert.equal(calls[0][2], body);
  await inboxes.fetchMessageBatch('https://example.test/inbox', 'query', undefined, 'test-token', 'page-2', controller.signal);
  assert.deepEqual(decode(calls[1][2]), { cursor: 'page-2' });
  assert.equal(calls[1][4], undefined);
  assert.equal(calls[1][3], 'test-token');
  assert.equal(calls[1][5], controller.signal);
  // Cached first pages may supply both an initial body and a cursor.
  await inboxes.fetchMessageBatch('https://example.test/inbox', 'query', body, undefined, 'cached-page', controller.signal);
  assert.deepEqual(decode(calls[2][2]), { cursor: 'cached-page' });
});

test('export gets a valid empty initial body and the same continuation contract', async () => {
  const { calls, inboxes } = fixture();
  await inboxes.fetchMessageBatch('https://example.test/inbox', 'export', undefined, 'test-token');
  assert.deepEqual(decode(calls[0][2]), {});
  await inboxes.fetchMessageBatch('https://example.test/inbox', 'export', undefined, 'test-token', 'export-next');
  assert.deepEqual(decode(calls[1][2]), { cursor: 'export-next' });
  assert.equal(calls[1][4], undefined);
});

test('the compatibility adapter is idempotent and preserves errors', async () => {
  const { client, inboxes } = fixture();
  const adapter = inboxes.fetchMessageBatch;
  installInboxCursorCompatibility(client);
  assert.equal(inboxes.fetchMessageBatch, adapter);
  const failure = Error('cursor expired');
  const failing = installInboxCursorCompatibility({ inboxes: { async fetchMessageBatch() { throw failure; } } });
  await assert.rejects(failing.inboxes.fetchMessageBatch('https://example.test', 'query', undefined, undefined, 'cursor'), error => error === failure);
});

test('the pinned production SDK supports the adapter boundary', () => {
  const require = createRequire(import.meta.url);
  const { GraffitiDecentralized } = require('@graffiti-garden/implementation-decentralized');
  const client = new GraffitiDecentralized();
  assert.equal(installInboxCursorCompatibility(client), client);
});

test('the production SDK consumes multiple inbox pages using cursor bodies', async () => {
  const require = createRequire(import.meta.url);
  const { GraffitiDecentralized } = require('@graffiti-garden/implementation-decentralized');
  const client = installInboxCursorCompatibility(new GraffitiDecentralized());
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const body = decode(options.body);
    requests.push({ url, body, authorization: options.headers.Authorization });
    const first = requests.length === 1;
    return new Response(encode({ results: [], hasMore: first, cursor: first ? 'page-2' : 'end' }), {
      headers: { 'Content-Type': 'application/cbor' },
    });
  };
  try {
    const iterator = client.graffiti.inboxes.query('https://protocol-test.example/inbox', [new Uint8Array(32)], {}, 'test-token');
    assert.equal((await iterator.next()).done, true);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0].body, { tags: [new Uint8Array(32)], schema: {} });
    assert.deepEqual(requests[1].body, { cursor: 'page-2' });
    assert.ok(requests.every(request => request.url === 'https://protocol-test.example/inbox/query'));
    assert.ok(requests.every(request => request.authorization === 'Bearer test-token'));
  } finally { globalThis.fetch = originalFetch; }
});
