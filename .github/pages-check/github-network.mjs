// Read-only transport diagnosis using public endpoints and a deliberately invalid probe value.
// Never serialize request header values, response bodies, browser logs, or credentials.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const pageURL = 'https://dimon3898-sys.github.io/world-engine-connect/';
const apiOrigin = 'https://api.github.com';
const repositoryPrefix = '/repos/dimon3898-sys/yeonhwarok-free';
const apiPath = repositoryPrefix + '/actions/secrets/public-key';
const metadataPaths = new Set([
  repositoryPrefix,
  apiPath,
  ...['WORLD_ENGINE_STUDIO_BACKUP_KEY', 'WORLD_ENGINE_STUDIO_BACKUP_DROPBOX_APP_KEY',
    'WORLD_ENGINE_STUDIO_BACKUP_DROPBOX_APP_SECRET', 'WORLD_ENGINE_STUDIO_BACKUP_DROPBOX_REFRESH_TOKEN']
    .map(name => repositoryPrefix + '/actions/secrets/' + name)
]);
const corsNames = new Set(['access-control-allow-origin', 'access-control-allow-credentials',
  'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers', 'access-control-max-age']);
const output = resolve(process.env.PAGES_EVIDENCE_DIR || '/tmp/world-engine-pages-evidence');
mkdirSync(output, { recursive: true });
const result = {
  schema: 'WORLD_ENGINE_CONNECT_GITHUB_NETWORK_DIAGNOSIS_V1', status: 'NOT_CAPTURED',
  checkedAt: new Date().toISOString(), pageURL, commit: process.env.GITHUB_SHA || null,
  credentialsUsed: false, syntheticInvalidAuthorizationUsed: true, secretWrites: 0,
  realDropboxConnected: false, gpuExecuted: false, tlsVerificationDisabled: false,
  probes: [], network: []
};
let browser, currentProbe = 'page-navigation';
const entries = new Map();
const pendingExtraRequestNames = new Map(), pendingExtraResponses = new Map();
const boundedEnum = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,95}$/.test(value) ? value : null;
function namesOnly(headers) {
  return Object.keys(headers || {}).map(name => name.toLowerCase())
    .filter(name => /^[a-z0-9!#$%&'*+.^_`|~-]{1,96}$/.test(name)).sort().slice(0, 64);
}
function corsHeaders(headers) {
  const safe = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (corsNames.has(name.toLowerCase()) && typeof value === 'string' && /^[\x20-\x7e]{0,4096}$/.test(value)) safe[name.toLowerCase()] = value;
  }
  return safe;
}
function matchesEndpoint(raw) {
  try {
    const value = new URL(raw);
    return value.origin === apiOrigin && !value.search && !value.hash && metadataPaths.has(value.pathname)
      ? value.pathname === repositoryPrefix ? 'public-repository-metadata'
        : value.pathname === apiPath ? 'repository-secret-public-key' : 'repository-secret-metadata' : null;
  } catch { return null; }
}
function headerParameter(value) {
  if (value === '') return '';
  const supported = new Set(['accept', 'authorization', 'cache-control', 'content-type', 'pragma', 'x-github-api-version']);
  return typeof value === 'string' && value.split(',').every(name => supported.has(name.trim().toLowerCase()))
    ? value.toLowerCase() : 'NON_HEADER_PARAMETER_OMITTED';
}
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', event => {
    const endpoint = matchesEndpoint(event.request.url);
    if (!endpoint) return;
    const entry = { probe: currentProbe, endpoint,
      method: ['GET', 'OPTIONS'].includes(event.request.method) ? event.request.method : 'UNEXPECTED_METHOD_BLOCKED_BY_PROBE_DESIGN',
      requestHeaderNames: namesOnly(event.request.headers) };
    if (pendingExtraRequestNames.has(event.requestId)) entry.extraRequestHeaderNames = pendingExtraRequestNames.get(event.requestId);
    if (pendingExtraResponses.has(event.requestId)) Object.assign(entry, pendingExtraResponses.get(event.requestId));
    entries.set(event.requestId, entry); result.network.push(entry);
  });
  cdp.on('Network.requestWillBeSentExtraInfo', event => {
    const entry = entries.get(event.requestId);
    if (entry) entry.extraRequestHeaderNames = namesOnly(event.headers);
    else if (pendingExtraRequestNames.size < 128) pendingExtraRequestNames.set(event.requestId, namesOnly(event.headers));
  });
  cdp.on('Network.responseReceived', event => {
    const entry = entries.get(event.requestId);
    if (entry) { entry.httpStatus = event.response.status; entry.corsResponseHeaders = corsHeaders(event.response.headers); }
  });
  cdp.on('Network.responseReceivedExtraInfo', event => {
    const entry = entries.get(event.requestId);
    const safe = { extraHttpStatus: event.statusCode, extraCorsResponseHeaders: corsHeaders(event.headers) };
    if (entry) Object.assign(entry, safe);
    else if (pendingExtraResponses.size < 128) pendingExtraResponses.set(event.requestId, safe);
  });
  cdp.on('Network.loadingFailed', event => {
    const entry = entries.get(event.requestId);
    if (!entry) return;
    entry.loadingFailed = true;
    if (/^net::ERR_[A-Z0-9_]+$/.test(event.errorText || '')) entry.networkErrorCode = event.errorText;
    if (boundedEnum(event.blockedReason)) entry.blockedReason = event.blockedReason;
    if (event.corsErrorStatus) entry.corsErrorStatus = {
      corsError: boundedEnum(event.corsErrorStatus.corsError),
      failedParameter: headerParameter(event.corsErrorStatus.failedParameter)
    };
  });
  const response = await page.goto(pageURL, { waitUntil: 'networkidle', timeout: 45000 });
  if (response?.status() !== 200 || page.url() !== pageURL || !(await page.evaluate(() => isSecureContext))) throw new Error('ACTUAL_HTTPS_PAGE_UNAVAILABLE');
  await page.waitForFunction(() => typeof window.WorldDropboxConnect?.createClient === 'function');
  result.actualHttpsPageVerified = true;
  currentProbe = 'public-repository-original-options';
  result.probes.push(await page.evaluate(async target => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    try {
      const reply = await fetch(target, { method: 'GET', headers: { Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' }, credentials: 'omit', referrerPolicy: 'no-referrer',
        cache: 'no-store', redirect: 'error', signal: controller.signal });
      return { name: 'public-repository-original-options', outcome: 'HTTP_RESPONSE', httpStatus: reply.status,
        responseType: ['basic', 'cors', 'opaque', 'opaqueredirect', 'error', 'default'].includes(reply.type) ? reply.type : 'unknown',
        redirected: reply.redirected };
    } catch (error) {
      return { name: 'public-repository-original-options', outcome: 'FETCH_REJECTED',
        exceptionType: ['TypeError', 'AbortError', 'TimeoutError'].includes(error?.name) ? error.name : 'SAFE_DIAGNOSTIC_EXCEPTION' };
    } finally { clearTimeout(timer); }
  }, apiOrigin + repositoryPrefix));
  currentProbe = 'existing-core-github-preflight';
  result.probes.push(await page.evaluate(async () => {
    // This cannot authenticate. A successful Secret operation is not attempted.
    const invalid = 'invalid_network_probe_1234567890';
    try {
      const config = window.WORLD_CONNECT_CONFIG;
      const client = window.WorldDropboxConnect.createClient({ redirectUri: config.redirectUri,
        allowedRedirectUris: config.allowedRedirectUris, storage: sessionStorage, sodium: window.sodium });
      await client.githubPreflight(invalid);
      return { name: 'existing-core-github-preflight', outcome: 'UNEXPECTED_METADATA_SUCCESS' };
    } catch (error) {
      const code = typeof error?.message === 'string' && /^[A-Z][A-Z0-9_]{2,95}$/.test(error.message)
        ? error.message : 'SAFE_DIAGNOSTIC_EXCEPTION';
      return { name: 'existing-core-github-preflight', outcome: 'CAPTURED_ERROR', errorCode: code };
    }
  }));
  for (const cache of ['default', 'no-store']) for (const redirect of ['error', 'manual']) {
    const name = 'direct-' + cache + '-' + redirect;
    currentProbe = name;
    result.probes.push(await page.evaluate(async ({ target, name, cache, redirect }) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
      try {
        const reply = await fetch(target, { method: 'GET', headers: { Accept: 'application/vnd.github+json',
          Authorization: 'Bearer invalid_network_probe_1234567890', 'X-GitHub-Api-Version': '2022-11-28' },
          credentials: 'omit', referrerPolicy: 'no-referrer', cache, redirect, signal: controller.signal });
        return { name, cache, redirect, outcome: 'HTTP_RESPONSE', httpStatus: reply.status,
          responseType: ['basic', 'cors', 'opaque', 'opaqueredirect', 'error', 'default'].includes(reply.type) ? reply.type : 'unknown',
          redirected: reply.redirected,
          responseHeaderNames: [...reply.headers.keys()].filter(value => /^[a-z0-9-]{1,96}$/.test(value)).slice(0, 64).sort() };
      } catch (error) {
        return { name, cache, redirect, outcome: 'FETCH_REJECTED',
          exceptionType: ['TypeError', 'AbortError', 'TimeoutError'].includes(error?.name) ? error.name : 'SAFE_DIAGNOSTIC_EXCEPTION' };
      } finally { clearTimeout(timer); }
    }, { target: apiOrigin + apiPath, name, cache, redirect }));
  }
  await page.waitForTimeout(500);
  result.readOnlyApiRequestsObserved = result.network.length;
  result.status = 'CAPTURED';
  await context.close();
} catch (error) {
  result.reasonCode = typeof error?.message === 'string' && /^[A-Z][A-Z0-9_]{2,95}$/.test(error.message)
    ? error.message : 'GITHUB_DIAGNOSTIC_INFRASTRUCTURE_FAILED';
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  writeFileSync(resolve(output, 'GITHUB_NETWORK_DIAGNOSIS.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, reasonCode: result.reasonCode || null,
    probesCaptured: result.probes.length, credentialsUsed: false, secretWrites: 0, gpuExecuted: false }));
}
