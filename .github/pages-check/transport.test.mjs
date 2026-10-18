// Focused request-error classification. All responses are synthetic; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../../connect-core.js', import.meta.url), 'utf8');
const redirectUri = 'https://dimon3898-sys.github.io/world-engine-connect/';
function fixture({ online = true, timeout = false, fetch }) {
  const sandbox = { module: { exports: {} }, navigator: { onLine: online },
    AbortController, TextEncoder, TextDecoder, URL, URLSearchParams, btoa, atob,
    setTimeout: timeout ? callback => { queueMicrotask(callback); return 0; } : setTimeout,
    clearTimeout: timeout ? () => {} : clearTimeout };
  runInNewContext(source, sandbox);
  return sandbox.module.exports.createClient({ redirectUri, allowedRedirectUris: [redirectUri],
    storage: { getItem() {}, setItem() {}, removeItem() {} }, crypto: webcrypto, fetch });
}
for (const status of [401, 403, 429]) {
  test('readable HTTP ' + status + ' remains distinct from network/CORS failure', async () => {
    const client = fixture({ fetch: async () => new Response('{}', { status }) });
    await assert.rejects(client.githubPreflight('synthetic_permission_probe_only'), { message: 'GITHUB_HTTP_' + status });
  });
}
test('browser offline is classified without guessing a GitHub permission failure', async () => {
  const client = fixture({ online: false, fetch: async () => { throw new TypeError('private failure text must not escape'); } });
  await assert.rejects(client.githubPreflight('synthetic_permission_probe_only'), { message: 'GITHUB_BROWSER_OFFLINE' });
});
test('own deadline is distinct from an ambiguous browser fetch rejection', async () => {
  const client = fixture({ timeout: true, fetch: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('private transport detail', 'AbortError')));
  }) });
  await assert.rejects(client.githubPreflight('synthetic_permission_probe_only'), { message: 'GITHUB_REQUEST_TIMEOUT' });
});
test('unobservable fetch cause stays ambiguous and never exposes the raw error', async () => {
  const client = fixture({ fetch: async () => { throw new TypeError('private failure text must not escape'); } });
  await assert.rejects(client.githubPreflight('synthetic_permission_probe_only'), { message: 'GITHUB_NETWORK_OR_CORS_FAILED' });
});
