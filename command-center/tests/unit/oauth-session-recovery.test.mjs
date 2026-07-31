/**
 * OAuth URL session recovery contracts.
 * Run: node --test tests/unit/oauth-session-recovery.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recoverOAuthSessionFromUrl } from '../../src/lib/oauthSessionRecovery.js';
import { OAUTH_CALLBACK_MAX_WAIT_MS } from '../../src/lib/oauthCallbackGate.js';

describe('recoverOAuthSessionFromUrl', () => {
  it('exchanges PKCE code', async () => {
    const calls = [];
    const auth = {
      exchangeCodeForSession: async (code) => {
        calls.push(code);
        return { data: { session: { access_token: 't' } }, error: null };
      },
      setSession: async () => ({ data: { session: null }, error: null }),
    };
    const result = await recoverOAuthSessionFromUrl(auth, { search: '?code=abc123', hash: '' });
    assert.deepEqual(calls, ['abc123']);
    assert.equal(result.recovered, true);
    assert.equal(result.session.access_token, 't');
  });

  it('sets session from hash access_token + refresh_token', async () => {
    const auth = {
      exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
      setSession: async (tokens) => ({
        data: { session: { access_token: tokens.access_token } },
        error: null,
      }),
    };
    const result = await recoverOAuthSessionFromUrl(auth, {
      search: '',
      hash: '#access_token=aaa&refresh_token=bbb&token_type=bearer',
    });
    assert.equal(result.recovered, true);
    assert.equal(result.session.access_token, 'aaa');
  });

  it('fails clearly when refresh_token is missing', async () => {
    const auth = {
      setSession: async () => ({ data: { session: null }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
    };
    const result = await recoverOAuthSessionFromUrl(auth, {
      search: '',
      hash: '#access_token=only',
    });
    assert.equal(result.recovered, false);
    assert.match(String(result.error?.message || ''), /refresh token/i);
  });

  it('surfaces provider error from hash', async () => {
    const auth = {
      setSession: async () => ({ data: { session: null }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
    };
    const result = await recoverOAuthSessionFromUrl(auth, {
      search: '',
      hash: '#error=access_denied&error_description=User%20cancelled',
    });
    assert.equal(result.recovered, false);
    assert.match(String(result.error?.message || ''), /cancelled|access_denied/i);
  });
});

describe('OAuth wait window', () => {
  it('allows enough time for hash/setSession recovery', () => {
    assert.ok(OAUTH_CALLBACK_MAX_WAIT_MS >= 20000);
  });
});
