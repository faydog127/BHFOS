/**
 * Post-login / OAuth redirect helpers.
 * Run: node --test tests/unit/post-login-redirect.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSafeMilPostLoginPath,
  isSafePostLoginPath,
  passwordResetRedirectTo,
  resolveOAuthDesiredPath,
  sanitizePostLoginPath,
} from '../../src/lib/postLoginRedirect.js';

describe('sanitizePostLoginPath', () => {
  it('accepts MIL creator and media paths', () => {
    assert.equal(sanitizePostLoginPath('/creator', 'tvg'), '/creator');
    assert.equal(sanitizePostLoginPath('/creator/', 'tvg'), '/creator/');
    assert.equal(sanitizePostLoginPath('/media/dashboard', 'tvg'), '/media/dashboard');
    assert.equal(sanitizePostLoginPath('%2Fcreator', 'tvg'), '/creator');
  });

  it('accepts same-tenant CRM paths', () => {
    assert.equal(sanitizePostLoginPath('/tvg/crm', 'tvg'), '/tvg/crm');
  });

  it('rejects external and cross-tenant paths', () => {
    assert.equal(sanitizePostLoginPath('https://evil.example/', 'tvg'), null);
    assert.equal(sanitizePostLoginPath('//evil.example', 'tvg'), null);
    assert.equal(sanitizePostLoginPath('/other/crm', 'tvg'), null);
  });
});

describe('resolveOAuthDesiredPath', () => {
  it('prefers next=/creator from the login query', () => {
    assert.equal(
      resolveOAuthDesiredPath({ locationSearch: '?next=%2Fcreator', tenantId: 'tvg' }),
      '/creator'
    );
  });

  it('falls back to pending path then CRM', () => {
    assert.equal(
      resolveOAuthDesiredPath({
        locationSearch: '',
        tenantId: 'tvg',
        pendingPath: '/media/review',
      }),
      '/media/review'
    );
    assert.equal(
      resolveOAuthDesiredPath({ locationSearch: '', tenantId: 'tvg', pendingPath: null }),
      '/tvg/crm'
    );
  });
});

describe('passwordResetRedirectTo', () => {
  it('builds tenant reset-password URL', () => {
    assert.equal(
      passwordResetRedirectTo('https://app.bhfos.com', 'tvg'),
      'https://app.bhfos.com/tvg/reset-password'
    );
  });
});

describe('isSafeMilPostLoginPath', () => {
  it('recognizes contributor alias', () => {
    assert.equal(isSafeMilPostLoginPath('/contributor'), true);
    assert.equal(isSafePostLoginPath('/contributor', 'tvg'), true);
  });
});
