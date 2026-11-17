import { encode } from '@ipld/dag-cbor';

const patched = new WeakSet();

/**
 * The pinned 0.4.0 client places continuation cursors in the query string.
 * Graffiti's current inbox routes accept CBOR bodies for all pages instead.
 * Keep the SDK's authentication, timeout, cache, and error handling intact.
 */
export function installInboxCursorCompatibility(client) {
  const inboxes = (client.graffiti || client).inboxes;
  if (!inboxes || typeof inboxes.fetchMessageBatch !== 'function') {
    throw new Error('The Graffiti inbox adapter is incompatible with this client version.');
  }
  if (patched.has(inboxes)) return client;
  const fetchBatch = inboxes.fetchMessageBatch.bind(inboxes);
  inboxes.fetchMessageBatch = (endpoint, type, body, token, cursor, signal) => {
    const requestBody = cursor ? new Uint8Array(encode({ cursor }))
      : type === 'export' && body === undefined ? new Uint8Array(encode({})) : body;
    return fetchBatch(endpoint, type, requestBody, token, undefined, signal);
  };
  patched.add(inboxes);
  return client;
}
