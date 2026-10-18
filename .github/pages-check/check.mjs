// Public-page verification only. No credentials, token exchange, or GPU work.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const url = 'https://dimon3898-sys.github.io/world-engine-connect/';
const source = JSON.parse(readFileSync(resolve(root, 'SOURCE.json')));
const expected = Object.fromEntries(Object.keys(source.assets).map(name => [name,
  createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex')]));
const configText = readFileSync(resolve(root, 'config.js'), 'utf8');
const enabled = /enabled:\s*true/.test(configText);
const output = resolve(process.env.PAGES_EVIDENCE_DIR || '/tmp/world-engine-pages-evidence');
mkdirSync(output, { recursive: true });
let browser;
const result = {
  schema: 'WORLD_ENGINE_CONNECT_PAGES_CHECK_V1', status: 'FAIL',
  url, checkedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA || null,
  configurationEnabled: enabled, tlsVerificationDisabled: false,
  viewport: { width: 412, height: 915 }, assets: {},
  realDropboxOAuthVerified: false, realBackupRestoreVerified: false,
  credentialsUsed: false, providerTokenRequests: 0, gpuExecuted: false
};
try {
  // Wait for the branch deployment, never substitute local or cached UI bytes.
  for (let attempt = 0; attempt < 30; attempt++) {
    let matched = true;
    for (const [name, sha] of Object.entries(expected)) {
      const target = name === 'index.html' ? url : url + name;
      const response = await fetch(target + '?deployment=' + (process.env.GITHUB_SHA || 'local'),
        { redirect: 'error', signal: AbortSignal.timeout(20000), cache: 'no-store' });
      const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      result.assets[name] = { httpStatus: response.status, sha256: actual, matches: response.status === 200 && actual === sha };
      if (!result.assets[name].matches) matched = false;
    }
    if (matched) break;
    if (attempt === 29) throw new Error('PAGES_ASSET_DEPLOYMENT_NOT_MATCHED');
    await new Promise(done => setTimeout(done, 10000));
  }
  assert.equal(Object.keys(result.assets).length, 10);
  assert.ok(Object.values(result.assets).every(asset => asset.matches));
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: result.viewport, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  let scriptErrors = 0, providerRequests = 0, authorizationChecked = false;
  let githubReadOnlyRequests = 0;
  const browserAssets = {};
  page.on('pageerror', () => scriptErrors++);
  page.on('response', async response => {
    const target = new URL(response.url());
    if (target.origin !== new URL(url).origin) return;
    const name = target.pathname === new URL(url).pathname ? 'index.html' : target.pathname.slice(new URL(url).pathname.length);
    if (Object.hasOwn(expected, name)) {
      try { browserAssets[name] = { status: response.status(), sha256: createHash('sha256').update(await response.body()).digest('hex') }; }
      catch { browserAssets[name] = { status: 0 }; }
    }
  });
  await page.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.origin === new URL(url).origin) return route.continue();
    if (target.origin === 'https://api.github.com' && !target.search
        && target.pathname === '/repos/dimon3898-sys/yeonhwarok-free/actions/secrets/WORLD_ENGINE_STUDIO_BACKUP_KEY'
        && ['GET', 'OPTIONS'].includes(route.request().method())) {
      githubReadOnlyRequests++;
      return route.continue();
    }
    providerRequests++;
    if (enabled && target.origin === 'https://www.dropbox.com' && target.pathname === '/oauth2/authorize') {
      const q = target.searchParams;
      assert.equal(q.get('client_id'), 'publictestappkey');
      assert.equal(q.get('redirect_uri'), url);
      assert.equal(q.get('response_type'), 'code');
      assert.equal(q.get('token_access_type'), 'offline');
      assert.equal(q.get('code_challenge_method'), 'S256');
      assert.match(q.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
      assert.deepEqual(q.get('scope').split(' ').sort(), ['files.content.read', 'files.content.write', 'files.metadata.read']);
      assert.ok(q.get('state').length >= 32);
      assert.equal(q.has('client_secret'), false);
      authorizationChecked = true;
      // Authorization is inspected, then aborted before any provider request.
      return route.abort();
    }
    throw new Error('UNEXPECTED_EXTERNAL_REQUEST');
  });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.equal(page.url(), url);
  assert.equal(await page.evaluate(() => isSecureContext), true);
  await page.locator(enabled ? '#consent' : '#blocked').waitFor({ state: 'visible' });
  assert.equal(await page.locator(enabled ? '#blocked' : '#consent').isHidden(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.equal(scriptErrors, 0);
  const requiredInBrowser = ['index.html', 'callback-scrub.js', 'config.js', 'connect.css',
    'connect-core.js', 'connect.js', 'vendor/libsodium.js', 'vendor/libsodium-wrappers.js'];
  for (const name of requiredInBrowser) {
    assert.equal(browserAssets[name]?.status, 200, 'browser response ' + name);
    assert.equal(browserAssets[name]?.sha256, expected[name], 'browser deployed hash ' + name);
  }
  if (enabled) {
    const code = await page.evaluate(async () => {
      try {
        const config = window.WORLD_CONNECT_CONFIG;
        const client = window.WorldDropboxConnect.createClient({ redirectUri: config.redirectUri,
          allowedRedirectUris: config.allowedRedirectUris, storage: sessionStorage, sodium: window.sodium });
        // Deliberately invalid, non-secret probe. No write or real credential used.
        await client.githubPreflight('invalid_network_probe_1234567890');
        return 'UNEXPECTED_AUTHENTICATION_SUCCESS';
      } catch (error) { return /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'SAFE_PROBE_FAILURE'; }
    });
    assert.equal(code, 'GITHUB_HTTP_401');
    assert.ok(githubReadOnlyRequests >= 1);
    result.githubLiveReadOnly = { corsResponseReadable: true, invalidAuthorizationRejected: true,
      expectedCode: 'GITHUB_HTTP_401', realSecretWritten: false };
  }
  await page.screenshot({ path: resolve(output, 'MOBILE_CONNECT.png'), fullPage: true });
  if (enabled) {
    await page.locator('summary').first().click();
    assert.equal(await page.locator('#redirectUri').innerText(), url);
    await page.screenshot({ path: resolve(output, 'MOBILE_SETUP_DETAILS.png'), fullPage: true });
    await page.locator('#appKey').fill('publictestappkey');
    await page.locator('#connectDropbox').click();
    await page.waitForTimeout(500);
    assert.equal(authorizationChecked, true);
    assert.equal(providerRequests, 1);
  } else assert.equal(providerRequests, 0);
  result.mobile = { actualHttpsBrowserNavigation: true, browserAssetsMatch: true,
    noHorizontalOverflow: true, scriptErrors, setupGateVisible: !enabled,
    oauthStartVisible: enabled, offlinePkceRequestInspectedAndAborted: authorizationChecked,
    actualDropboxProviderContacted: false };
  result.status = 'PASS';
  await context.close();
} catch (error) {
  // Only a bounded failure label; never serialize request URLs or arbitrary logs.
  result.reasonCode = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'PAGES_ASSERTION_FAILED';
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  writeFileSync(resolve(output, 'PAGES_VERIFICATION.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, configurationEnabled: enabled, reasonCode: result.reasonCode || null }));
}
