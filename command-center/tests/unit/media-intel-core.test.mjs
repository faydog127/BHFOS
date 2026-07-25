/**
 * Media Intelligence Library — pure helper + single-company contract tests.
 * Run: node --test tests/unit/media-intel-core.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const MIL_SUPPORTED_MIME = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
];
const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', mov: 'video/quicktime', mp4: 'video/mp4',
};
function extensionOf(filename = '') {
  const parts = String(filename).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}
function resolveMimeType(file) {
  if (file?.type && MIL_SUPPORTED_MIME.includes(file.type)) return file.type;
  return EXT_MIME[extensionOf(file?.name)] || file?.type || 'application/octet-stream';
}
function validateMediaFile(file) {
  if (!file) return { ok: false, reason: 'No file selected.' };
  const mime = resolveMimeType(file);
  if (!MIL_SUPPORTED_MIME.includes(mime) && !EXT_MIME[extensionOf(file.name)]) {
    return { ok: false, reason: `Unsupported type: ${file.name}` };
  }
  if (file.size > 2 * 1024 * 1024 * 1024) return { ok: false, reason: 'too large' };
  if (file.size <= 0) return { ok: false, reason: 'empty' };
  return { ok: true, mime };
}
function safeStorageSegment(name) {
  return String(name || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180) || 'file';
}

describe('MIL formats', () => {
  it('accepts common iPhone/Android types', () => {
    assert.equal(validateMediaFile({ name: 'IMG_1.HEIC', size: 12, type: '' }).ok, true);
    assert.equal(validateMediaFile({ name: 'clip.MOV', size: 12, type: '' }).ok, true);
    assert.equal(validateMediaFile({ name: 'a.mp4', size: 12, type: 'video/mp4' }).ok, true);
  });

  it('rejects unsupported and empty files', () => {
    assert.equal(validateMediaFile({ name: 'x.exe', size: 12, type: 'application/x-msdownload' }).ok, false);
    assert.equal(validateMediaFile({ name: 'x.jpg', size: 0, type: 'image/jpeg' }).ok, false);
  });

  it('sanitizes storage path segments', () => {
    assert.equal(safeStorageSegment('../../etc/passwd').includes('..'), false);
    assert.ok(!safeStorageSegment('a/b\\c').includes('/'));
  });
});

describe('MIL checksum de-dupe contract', () => {
  it('exact checksum equality identifies duplicates', () => {
    const a = createHash('sha256').update('same-bytes').digest('hex');
    const b = createHash('sha256').update('same-bytes').digest('hex');
    const c = createHash('sha256').update('other').digest('hex');
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});

describe('MIL denial notes optional', () => {
  it('reviewReelVersion source allows deny without inventing notes', () => {
    const src = read('src/lib/mediaIntel/api.js');
    assert.match(src, /review_notes: notes\?\.trim\(\) \? notes\.trim\(\) : null/);
    assert.match(src, /notesProvided: Boolean\(notes\?\.trim\(\)\)/);
  });
});

describe('MIL schema & security contracts (single-company)', () => {
  const migration = read('supabase/migrations/20260725120000_media_intelligence_library.sql');
  const accessMig = read('supabase/migrations/20260725130000_media_intel_access_sessions.sql');

  it('creates private buckets and does not make originals public', () => {
    assert.match(migration, /media-intel-originals/);
    assert.match(migration, /media-intel-derivatives/);
    assert.doesNotMatch(migration, /values \('media-intel-originals', 'media-intel-originals', true\)/);
  });

  it('does not modify inspection-photos policies destructively', () => {
    assert.doesNotMatch(migration, /drop policy if exists "Inspection photos/);
  });

  it('keeps AI suggestions separate from verified metadata', () => {
    assert.match(migration, /mil_ai_analyses/);
    assert.match(migration, /mil_verified_metadata/);
  });

  it('enforces creator visibility helper and blocks unknown rights for marketing uses', () => {
    assert.match(migration, /mil_creator_can_view_asset/);
    assert.match(migration, /mil_enforce_public_use_gates/);
    assert.match(migration, /ownership_unknown/);
  });

  it('does not introduce MIL tenant_id columns, JWT tenant helpers, or org abstractions', () => {
    assert.doesNotMatch(migration, /mil_jwt_tenant_id/);
    assert.doesNotMatch(migration, /\btenant_id\s+text\b/);
    assert.doesNotMatch(migration, /\borganization_id\b/);
    assert.doesNotMatch(migration, /\baccount_id\b/);
    assert.doesNotMatch(migration, /\bcompany_id\b/);
    assert.doesNotMatch(migration, /\bworkspace_id\b/);
    assert.doesNotMatch(accessMig, /\btenant_id\s+text\b/);
  });

  it('uses mil/ storage namespace without tenant path segments', () => {
    assert.match(migration, /name like 'mil\/%'/);
    assert.match(migration, /mil\/reels\/%/);
    assert.match(migration, /Paths: mil\/originals/);
    assert.doesNotMatch(migration, /storage\.foldername/);
  });

  it('authorizes by role helpers on auth.uid, not JWT tenant claims', () => {
    assert.match(migration, /mil_current_role/);
    assert.match(migration, /auth\.uid\(\)/);
    assert.doesNotMatch(migration, /app_metadata' ->> 'tenant_id'/);
  });
});

describe('MIL routes wired', () => {
  it('App.jsx registers single-company /media and /creator routes', () => {
    const app = read('src/App.jsx');
    assert.match(app, /path="\/media\/\*"/);
    assert.match(app, /path="\/creator\/\*"/);
    assert.doesNotMatch(app, /path="\/:tenantId\/media\/\*"/);
    assert.doesNotMatch(app, /path="\/:tenantId\/creator\/\*"/);
    for (const p of [
      'dashboard', 'uploads', 'upload', 'review', 'all', 'collections',
      'before-after', 'reel-review', 'approved-to-post', 'archive', 'settings',
    ]) {
      assert.ok(app.includes(p), `missing route fragment ${p}`);
    }
  });

  it('declares no social publishing surface', () => {
    const settings = read('src/pages/crm/media/MediaSettings.jsx');
    assert.match(settings, /No social platform connections/);
    const approved = read('src/pages/crm/media/MediaApprovedToPost.jsx');
    assert.match(approved, /No social connection, scheduling, or automatic publishing/);
  });
});

describe('MIL AI edge contract', () => {
  it('analyze function supports config_status and no-key skip without fabricating results', () => {
    const src = read('supabase/functions/media-intel-analyze/index.ts');
    assert.match(src, /config_status/);
    assert.match(src, /skipped_no_key/);
    assert.match(src, /Do NOT write into mil_verified_metadata/);
    assert.match(src, /OPENAI_API_KEY/);
    assert.doesNotMatch(src, /tenant_id/);
    assert.doesNotMatch(src, /tenantId/);
  });

  it('promote function requires verified + privacy clear + website use + admin role', () => {
    const src = read('supabase/functions/media-intel-promote-website/index.ts');
    assert.match(src, /human_review_status !== 'verified'/);
    assert.match(src, /privacy_status !== 'clear'/);
    assert.match(src, /use_key', 'website'/);
    assert.match(src, /website-public-media/);
    assert.match(src, /media-intel-originals/);
    assert.doesNotMatch(src, /tenant_id/);
    assert.doesNotMatch(src, /tenantId/);
  });
});

describe('MIL client API single-company contracts', () => {
  it('api and roles omit tenant parameters', () => {
    const api = read('src/lib/mediaIntel/api.js');
    const roles = read('src/lib/mediaIntel/roles.js');
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    assert.match(roles, /export async function fetchMilRole\(\)/);
    assert.doesNotMatch(api, /tenantId|tenant_id/);
    assert.doesNotMatch(upload, /tenantId|tenant_id/);
    assert.match(upload, /mil\/originals\//);
  });
});
