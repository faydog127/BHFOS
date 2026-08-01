import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OAUTH_CALLBACK_MAX_WAIT_MS,
  readOAuthErrorFromUrl,
  resolveOAuthCallbackNavigation,
  urlHasOAuthCallbackParams,
} from '../../src/lib/oauthCallbackGate.js';

test('urlHasOAuthCallbackParams detects query code and hash tokens', () => {
  assert.equal(urlHasOAuthCallbackParams('?code=abc', ''), true);
  assert.equal(urlHasOAuthCallbackParams('', '#access_token=xyz'), true);
  assert.equal(urlHasOAuthCallbackParams('?foo=1', '#bar=2'), false);
});

test('readOAuthErrorFromUrl reads error from query', () => {
  const { oauthError, oauthErrorDescription } = readOAuthErrorFromUrl(
    '?error=access_denied&error_description=User%20cancelled',
    ''
  );
  assert.equal(oauthError, 'access_denied');
  assert.equal(oauthErrorDescription, 'User cancelled');
});

test('OAuth success navigates to post-login redirect and clears flag', () => {
  const decision = resolveOAuthCallbackNavigation({
    hasOAuthParams: true,
    session: { access_token: 't' },
    postLoginRedirect: '/tvg/crm',
    waitedMs: 0,
  });
  assert.equal(decision.action, 'navigate');
  assert.equal(decision.to, '/tvg/crm');
  assert.equal(decision.clearPostLoginRedirect, true);
});

test('OAuth success honors creator post-login redirect', () => {
  const decision = resolveOAuthCallbackNavigation({
    hasOAuthParams: true,
    session: { access_token: 't' },
    postLoginRedirect: '/creator',
    waitedMs: 0,
  });
  assert.equal(decision.action, 'navigate');
  assert.equal(decision.to, '/creator');
  assert.equal(decision.clearPostLoginRedirect, true);
});

test('OAuth code with no session yet must WAIT (do not bounce to select-tenant)', () => {
  const decision = resolveOAuthCallbackNavigation({
    hasOAuthParams: true,
    session: null,
    waitedMs: 1000,
    maxWaitMs: OAUTH_CALLBACK_MAX_WAIT_MS,
  });
  assert.equal(decision.action, 'wait');
  assert.notEqual(decision.to, '/select-tenant');
});

test('regression: prior bug immediately sent null session + OAuth params to select-tenant', () => {
  // The old RootGate did: if (hasOAuthParams && !session) navigate('/select-tenant')
  // which drops ?code= and aborts Safari PKCE. New gate must wait instead.
  const early = resolveOAuthCallbackNavigation({
    hasOAuthParams: true,
    session: null,
    waitedMs: 0,
  });
  assert.equal(early.action, 'wait');
});

test('OAuth provider error fails with message (not silent select-tenant)', () => {
  const decision = resolveOAuthCallbackNavigation({
    hasOAuthParams: true,
    session: null,
    oauthError: 'access_denied',
    oauthErrorDescription: 'User cancelled',
    waitedMs: 0,
  });
  assert.equal(decision.action, 'fail');
  assert.match(decision.message, /cancelled|access_denied|User cancelled/i);
  assert.notEqual(decision.to, '/select-tenant');
});

test('OAuth wait timeout fails to login path, not select-tenant', () => {
  const decision = resolveOAuthCallbackNavigation({
    hasOAuthParams: true,
    session: null,
    waitedMs: OAUTH_CALLBACK_MAX_WAIT_MS + 1,
  });
  assert.equal(decision.action, 'fail');
  assert.equal(decision.to, '/tvg/login');
  assert.notEqual(decision.to, '/select-tenant');
});

test('non-OAuth root without session still goes to select-tenant', () => {
  const decision = resolveOAuthCallbackNavigation({
    hasOAuthParams: false,
    session: null,
  });
  assert.equal(decision.action, 'navigate');
  assert.equal(decision.to, '/select-tenant');
});
