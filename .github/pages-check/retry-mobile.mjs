// CPU mobile regression: the shipped HTTPS-origin UI with synthetic providers only.
// Every provider request is intercepted. No real credential, account, or GPU is used.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(import.meta.dirname, '../..');
const origin = 'https://dimon3898-sys.github.io';
const prefix = '/world-engine-connect/';
const redirectUri = origin + prefix;
const repository = 'dimon3898-sys/yeonhwarok-free';
const ref = 'development/dropbox-mobile-connect-v1-20261018';
const names = {
  key: 'WORLD_ENGINE_STUDIO_BACKUP_KEY', appKey: 'WORLD_ENGINE_STUDIO_BACKUP_DROPBOX_APP_KEY',
  appSecret: 'WORLD_ENGINE_STUDIO_BACKUP_DROPBOX_APP_SECRET', refresh: 'WORLD_ENGINE_STUDIO_BACKUP_DROPBOX_REFRESH_TOKEN'
};
const appKey = 'appkeyfixture';
const pat = 'github_pat_SYNTHETIC_FIXTURE_ONLY_1234567890';
const replacementPat = 'github_pat_SYNTHETIC_REPLACEMENT_ONLY_1234567890';
const access = 'accessfixture'.repeat(3), refresh = 'refreshfixture'.repeat(3);
const image = 'ghcr.io/dimon3898-sys/world-simulation-shorts-engine@sha256:6d2e87fc8fb7f10edc2ebb7f77b5d666e329904b9c37f7f060b289f943bdd9d0';
const output = resolve(process.env.PAGES_EVIDENCE_DIR || '/tmp/world-engine-pages-evidence');
mkdirSync(output, { recursive: true });
const modes = ['preflight-network', 'preflight-401', 'preflight-403', 'saved-status-network', 'dispatch-preflight-network', 'dispatch-ambiguous', 'poll-network', 'poll-401-replace', 'proof-network'];
const result = {
  schema: 'WORLD_ENGINE_CONNECT_RETRY_MOBILE_V1', status: 'FAIL', checkedAt: new Date().toISOString(),
  viewport: { width: 412, height: 915 }, assertions: 0, cases: [],
  syntheticProvidersOnly: true, realDropboxVerified: false, realGitHubSecretWritten: false,
  gpuExecuted: false, tlsVerificationDisabled: false
};
let browser;
function check(condition, label) { assert.ok(condition, label); result.assertions++; }
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/usr/bin/google-chrome'),
    args: ['--no-sandbox', '--disable-gpu'] });
  for (const mode of modes) {
    const context = await browser.newContext({ viewport: result.viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], logs = [], unexpected = [], writes = [], secretBodies = [], requestURLs = [], authValues = [];
    const existing = new Set([names.key, names.appSecret]);
    let authorization, keypair, publicKey;
    let failed = false, tokenExchanges = 0, dispatches = 0, firstMetadataGets = 0, runsGets = 0, remoteRun = false;
    let empty201Creates = 0, empty204Updates = 0;
    page.on('pageerror', () => errors.push('PAGE_SCRIPT_ERROR'));
    page.on('console', message => logs.push(message.text()));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      requestURLs.push(request.url());
      const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-GitHub-Api-Version,Accept', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' };
      const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(value) });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
      if (url.origin === origin && url.pathname.startsWith(prefix)) {
        const path = url.pathname === prefix ? 'index.html' : url.pathname.slice(prefix.length);
        check(!request.headers()['referer']?.includes('code='), 'authorization code absent from asset referrer');
        if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.includes('..') || !existsSync(join(root, path))) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ contentType: path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html', body: readFileSync(join(root, path)) });
      }
      if (url.origin === 'https://www.dropbox.com' && url.pathname === '/oauth2/authorize') {
        authorization = url;
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic provider fixture</title>' });
      }
      if (url.href === 'https://api.dropboxapi.com/oauth2/token') {
        tokenExchanges++;
        const form = new URLSearchParams(request.postData());
        check(form.get('code_verifier')?.length >= 43 && !form.has('client_secret'), 'browser PKCE never sends App Secret');
        return json({ token_type: 'bearer', access_token: access, refresh_token: refresh,
          expires_in: 14400, account_id: 'account_fixture_123456789', scope: 'files.content.read files.content.write files.metadata.read' });
      }
      const repoPrefix = '/repos/' + repository;
      if (url.origin === 'https://api.github.com' && url.pathname.startsWith(repoPrefix)) {
        const suffix = url.pathname.slice(repoPrefix.length);
        if (request.headers().authorization) authValues.push(request.headers().authorization);
        check(!url.searchParams.has('access_token') && !url.searchParams.has('token'), 'no credential in GitHub URL');
        if (suffix === '/actions/secrets/' + names.key && request.method() === 'GET') {
          firstMetadataGets++;
          if (!failed && mode.startsWith('preflight-')) {
            failed = true;
            if (mode === 'preflight-network') return route.abort('failed');
            return json({ message: 'Synthetic untrusted provider message ' + refresh }, mode === 'preflight-401' ? 401 : 403);
          }
          if (!failed && mode === 'dispatch-preflight-network' && runsGets > 0 && !remoteRun) {
            failed = true;
            return route.abort('failed');
          }
        }
        if (suffix === '/actions/secrets/public-key') return json({ key: publicKey, key_id: 'keyfixture123' });
        if (suffix.startsWith('/actions/secrets/')) {
          const name = suffix.split('/').at(-1);
          if (request.method() === 'GET') return json(existing.has(name) ? { name } : { message: 'Not Found' }, existing.has(name) ? 200 : 404);
          check(request.method() === 'PUT', 'Secrets only written via PUT');
          const body = request.postData() || '';
          secretBodies.push(body);
          const sealed = JSON.parse(body);
          check(Object.keys(sealed).sort().join(',') === 'encrypted_value,key_id', 'Secret PUT body contains ciphertext and key ID only');
          check(Buffer.from(sealed.encrypted_value, 'base64').length >= 48, 'real sealed box overhead');
          const decoded = await page.evaluate(async ({ sealed, pair }) => {
            await sodium.ready;
            return sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(sealed, sodium.base64_variants.ORIGINAL),
              sodium.from_base64(pair.publicKey, sodium.base64_variants.ORIGINAL), sodium.from_base64(pair.privateKey, sodium.base64_variants.ORIGINAL)));
          }, { sealed: sealed.encrypted_value, pair: keypair });
          const expected = name === names.appKey ? appKey : name === names.refresh ? refresh : 'WORLD_ENGINE_DROPBOX_BINDING_V1';
          check(decoded === expected, 'encrypted Secret decrypts to intended synthetic value');
          const alreadyExisted = existing.has(name);
          writes.push(name); existing.add(name);
          // GitHub's creation response is 201 with no JSON body; update is 204.
          if (alreadyExisted) empty204Updates++;
          else empty201Creates++;
          return route.fulfill({ status: alreadyExisted ? 204 : 201, headers: cors, body: '' });
        }
        if (suffix.endsWith('/dispatches')) {
          dispatches++; remoteRun = true;
          check(dispatches === 1, 'proof dispatch is never duplicated');
          if (mode === 'dispatch-ambiguous' && !failed) { failed = true; return route.abort('failed'); }
          return route.fulfill({ status: 204, headers: cors, body: '' });
        }
        const run = { id: 123456789, run_attempt: 1, status: 'completed', conclusion: 'success',
          head_branch: ref, event: 'workflow_dispatch', path: '.github/workflows/studio-dropbox-mobile-v1.yml' };
        if (suffix.endsWith('/runs')) {
          runsGets++;
          if (!failed && mode === 'poll-401-replace' && remoteRun) {
            failed = true;
            return json({ message: 'Synthetic expired authorization ' + refresh }, 401);
          }
          if (!failed && ((mode === 'saved-status-network' && writes.length >= 3) || (mode === 'poll-network' && remoteRun))) {
            failed = true; return route.abort('failed');
          }
          return json({ workflow_runs: remoteRun ? [run] : [] });
        }
        if (suffix === '/actions/runs/123456789') return json(run);
        if (suffix.startsWith('/contents/')) {
          if (!failed && mode === 'proof-network') {
            failed = true;
            return route.abort('failed');
          }
          const proof = { schema: 'WORLD_ENGINE_MOBILE_DROPBOX_PROOF_V1', runId: 123456789, attempt: 1,
            status: 'PASS', reasonCode: 'MOBILE_DROPBOX_CPU_RECOVERY_VERIFIED', sourceImage: image,
            offlineTokenRefreshVerified: true, metadataReadVerified: true, externalStorageRecoveryVerified: true,
            gpuExecuted: false, productionRenderingStarted: false,
            proofId: 'a'.repeat(64), checkpointId: 'b'.repeat(64), expiresUnix: Math.floor(Date.now() / 1000) + 3600 };
          const text = JSON.stringify(proof);
          return json({ type: 'file', path: suffix.slice('/contents/'.length), encoding: 'base64', size: Buffer.byteLength(text), content: Buffer.from(text).toString('base64') });
        }
      }
      unexpected.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    });
    await page.goto(redirectUri);
    await page.locator('#consent').waitFor({ state: 'visible' });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile width fits initial screen');
    keypair = await page.evaluate(async () => {
      await sodium.ready;
      const pair = sodium.crypto_box_keypair();
      return { publicKey: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL), privateKey: sodium.to_base64(pair.privateKey, sodium.base64_variants.ORIGINAL) };
    });
    publicKey = keypair.publicKey;
    await page.locator('#appKey').fill(appKey);
    await page.locator('#connectDropbox').click();
    await page.waitForURL('https://www.dropbox.com/**');
    check(authorization.searchParams.get('token_access_type') === 'offline', 'offline grant requested');
    check(authorization.searchParams.get('code_challenge_method') === 'S256', 'S256 PKCE retained');
    check(authorization.searchParams.get('redirect_uri') === redirectUri, 'callback exact canonical HTTPS URI');
    await page.goto(redirectUri + '?code=codefixture123&state=' + authorization.searchParams.get('state'));
    await page.locator('#status').filter({ hasText: 'Dropbox 승인을 확인했습니다' }).waitFor();
    check(page.url() === redirectUri, 'callback query scrubbed');
    check(await page.evaluate(() => sessionStorage.length === 0 && localStorage.length === 0), 'consumed PKCE state removed; tokens not persisted');
    await page.locator('#githubCredential').fill(pat);
    await page.locator('#checkGithub').click();
    if (mode.startsWith('preflight-')) {
      await page.locator('#retryGithub').waitFor({ state: 'visible' });
      const message = await page.locator('#error').innerText();
      check(!message.includes(refresh), 'provider error body never shown');
      check(await page.locator('#restart').isHidden(), 'GitHub error does not force Dropbox restart');
      check(await page.locator('#githubCredential').inputValue() === '', 'credential input cleared while retry retains memory only');
      if (mode === 'preflight-401') {
        check(/인증|만료/.test(message), '401 displayed as authentication failure');
        await page.locator('#githubCredential').fill(replacementPat);
        await page.locator('#checkGithub').click();
      } else {
        check(mode === 'preflight-403' ? /권한/.test(message) : /연결|네트워크|인터넷|통신/.test(message), 'permission and transport guidance distinguished');
        await page.locator('#retryGithub').evaluate(button => { button.click(); button.click(); });
      }
      await page.waitForFunction(() => !document.getElementById('saveConnection').disabled);
      check(firstMetadataGets === 2, 'retry double touch launches one preflight only');
    }
    await page.waitForFunction(() => !document.getElementById('saveConnection').disabled);
    check(await page.locator('#appSecretArea').isHidden(), 'existing App Secret not requested again');
    await page.locator('#saveConnection').click();
    if (!mode.startsWith('preflight-')) {
      await page.locator('#retryGithub').waitFor({ state: 'visible' });
      check(await page.locator('#restart').isHidden(), 'post-save network error has same-session retry');
      const savedCount = writes.length;
      check(savedCount === 3, 'connection saved once before status or dispatch failure');
      if (mode === 'poll-401-replace') {
        check(await page.locator('#githubCredential').isVisible(), 'expired post-save credential can be replaced without OAuth restart');
        check(await page.locator('#githubCredentials').evaluate(element => element.parentElement.id === 'verification'), 'same private controls reused in verification screen');
        check(/인증|만료/.test(await page.locator('#error').innerText()), 'post-save 401 remains authentication failure');
        await page.locator('#githubCredential').fill(replacementPat);
        await page.locator('#checkGithub').evaluate(button => { button.click(); button.click(); });
      } else await page.locator('#retryGithub').evaluate(button => { button.click(); button.click(); });
      await page.locator('#status').filter({ hasText: 'Dropbox 연결 완료' }).waitFor();
      check(writes.length === savedCount, 'retry after completed Secret save never repeats PUT');
      if (mode === 'poll-401-replace') check(authValues.includes('Bearer ' + replacementPat), 'post-save verification uses replacement credential');
    } else await page.locator('#status').filter({ hasText: 'Dropbox 연결 완료' }).waitFor();
    check(failed, 'requested failure actually exercised');
    check(tokenExchanges === 1, 'GitHub retries reuse grant without Dropbox token re-exchange');
    check(dispatches === 1, 'one workflow dispatch across retries');
    check(writes.length === 3 && writes.includes(names.appKey) && writes.includes(names.refresh)
      && writes.some(name => name.startsWith('WORLD_ENGINE_STUDIO_DROPBOX_BINDING_')), 'only connection identity and grant saved');
    check(empty201Creates === 3 && empty204Updates === 0, 'first-time Secret creation accepts documented 201 empty bodies');
    check(!writes.includes(names.key) && !writes.includes(names.appSecret), 'existing encryption key and App Secret preserved');
    check(secretBodies.every(body => ![pat, replacementPat, access, refresh].some(value => body.includes(value))), 'no plaintext credential in GitHub Secret request body');
    check(authValues.every(value => value === 'Bearer ' + pat || value === 'Bearer ' + replacementPat), 'only expected synthetic authorization headers');
    const publicState = await page.evaluate(() => ({ html: document.documentElement.outerHTML,
      storage: JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }), url: location.href,
      credential: document.getElementById('githubCredential').value, appSecret: document.getElementById('appSecret').value }));
    for (const value of [pat, replacementPat, access, refresh]) {
      check(!JSON.stringify(publicState).includes(value) && !logs.some(log => log.includes(value)) && !requestURLs.some(url => url.includes(value)), 'credentials absent from DOM, storage, URLs, and logs');
    }
    check(publicState.credential === '' && publicState.appSecret === '', 'private inputs cleared on completion');
    check(errors.length === 0 && unexpected.length === 0, 'no page error or unexpected external request');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile result has no horizontal overflow');
    result.cases.push({ case: mode, status: 'PASS', oauthTokenExchanges: tokenExchanges,
      secretWrites: writes.length, proofDispatches: dispatches, runsMetadataReads: runsGets,
      empty201Creates, empty204Updates,
      existingKeyPreserved: true, existingAppSecretPreserved: true, gpuExecuted: false });
    await context.close();
  }
  result.status = 'PASS';
  result.browser = browser.version();
} catch (error) {
  // Deliberately exclude raw errors, URLs, requests, and provider bodies from reports.
  result.reasonCode = 'MOBILE_RETRY_ASSERTION_FAILED';
  result.failedCase = modes[result.cases.length] || 'browser-start';
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  writeFileSync(join(output, 'MOBILE_RETRY_VERIFICATION.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, assertions: result.assertions, cases: result.cases.length,
    failedCase: result.failedCase || null, gpuExecuted: false, realDropboxVerified: false }));
}
