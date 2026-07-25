/**
 * Media Intelligence Library — static cross-file contract tests.
 * Run: node --test tests/unit/media-intel-contracts.test.mjs
 * Included in: npm run test:media-intel-helpers
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const MIL_EDGE_FUNCTIONS = [
  'media-intel-analyze',
  'media-intel-creator-admin',
  'media-intel-promote-website',
  'media-intel-reel-upload',
  'media-intel-sign',
  'media-intel-upload-session',
];

describe('MIL derivative kind SQL/JS parity', () => {
  it('ALL_DERIVATIVE_KINDS matches mil_derivatives.kind check in 20260725120000 migration', () => {
    const js = read('src/lib/mediaIntel/derivativeKinds.js');
    const mig = read('supabase/migrations/20260725120000_media_intelligence_library.sql');

    const kindsMatch = js.match(/export const ALL_DERIVATIVE_KINDS = \[([\s\S]*?)\];/);
    assert.ok(kindsMatch, 'ALL_DERIVATIVE_KINDS export not found');
    const jsKinds = [...kindsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    const checkMatch = mig.match(/kind text not null check \(kind in \(([\s\S]*?)\)\)/);
    assert.ok(checkMatch, 'mil_derivatives.kind check not found in migration');
    const sqlKinds = [...checkMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    assert.deepEqual(jsKinds, sqlKinds, 'derivativeKinds.js must stay in sync with migration check constraint');
    assert.ok(jsKinds.includes('public_safe'), 'missing public_safe');
    assert.ok(jsKinds.includes('ai_safe'), 'missing ai_safe');
  });
});

describe('MIL edge functions share milCors', () => {
  for (const fn of MIL_EDGE_FUNCTIONS) {
    it(`${fn} imports milCorsHeaders`, () => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      assert.match(src, /from '\.\.\/_shared\/milCors\.ts'/);
      assert.match(src, /milCorsHeaders/);
    });
  }
});

describe('MIL promote website honesty', () => {
  it('prepare_public_safe and promote return not_implemented (503)', () => {
    const fn = read('supabase/functions/media-intel-promote-website/index.ts');
    assert.match(fn, /action === 'prepare_public_safe' \|\| action === 'promote'/);
    assert.match(fn, /503/);
    assert.match(fn, /not_implemented/);
    assert.match(fn, /public_safe_transform_not_implemented/);
  });
});

describe('MIL upload session finalize contract', () => {
  it('complete_file calls mil_finalize_upload_grant RPC', () => {
    const fn = read('supabase/functions/media-intel-upload-session/index.ts');
    assert.match(fn, /\.rpc\('mil_finalize_upload_grant'/);
    assert.match(fn, /crypto\.subtle\.digest\('SHA-256'/);
    assert.match(fn, /verifiedChecksum/);
  });

  it('mint_upload uses #session= fragment in returned path', () => {
    const fn = read('supabase/functions/media-intel-upload-session/index.ts');
    assert.match(fn, /#session=\$\{token\}/);
  });
});

describe('MIL client security contracts', () => {
  it('signedUrl throws — direct storage signing disabled', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /export async function signedUrl\(\)/);
    assert.match(api, /throw new Error\([\s\S]*direct storage signing disabled/);
  });

  it('audit throws — no client mil_audit_events inserts', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /export function audit\(\)/);
    assert.match(api, /throw new Error/);
    assert.doesNotMatch(api, /from\('mil_audit_events'\)\.insert/);
  });

  it('staff uploadManager uses mil/quarantine/ path', () => {
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    assert.match(upload, /mil\/quarantine\//);
  });
});

describe('MIL pre-staging hardening migration contracts', () => {
  const hardening = read('supabase/migrations/20260725140000_media_intel_pre_staging_hardening.sql');

  it('defines mil_finalize_upload_grant granted to service_role', () => {
    assert.match(hardening, /create or replace function public\.mil_finalize_upload_grant/);
    assert.match(hardening, /grant execute on function public\.mil_finalize_upload_grant[\s\S]* to service_role/);
  });

  it('140000 drops mil_staff_all policies but does not create new mil_staff_all_* policies', () => {
    assert.match(hardening, /policyname like 'mil_staff_all_%'/);
    assert.doesNotMatch(
      hardening,
      /create policy mil_staff_all/i,
    );
    const creates = [...hardening.matchAll(/create policy (\S+)/gi)].map((m) => m[1]);
    assert.ok(
      !creates.some((name) => name.startsWith('mil_staff_all')),
      `unexpected mil_staff_all create policies: ${creates.filter((n) => n.startsWith('mil_staff_all')).join(', ')}`,
    );
  });

  it('mil_is_reviewer excludes office', () => {
    const reviewerBlocks = hardening.match(/create or replace function public\.mil_is_reviewer\([\s\S]*?\$\$;/g);
    assert.ok(reviewerBlocks?.length, 'mil_is_reviewer definition not found');
    const def = reviewerBlocks[reviewerBlocks.length - 1];
    assert.match(def, /media_reviewer/);
    assert.doesNotMatch(def, /office/);
  });
});

describe('MIL UI session fragment preference', () => {
  it('MediaSettings and MediaMobileUpload prefer #session= over query string', () => {
    const settings = read('src/pages/crm/media/MediaSettings.jsx');
    const mobile = read('src/pages/crm/media/MediaMobileUpload.jsx');
    assert.match(settings, /#session=\$\{encodeURIComponent/);
    assert.match(mobile, /#session=/);
    assert.match(mobile, /Prefer the URL fragment/);
  });
});

describe('MIL practical upload limit honesty', () => {
  it('constants advertise 250 MB cap tied to checksum helper', () => {
    const constants = read('src/lib/mediaIntel/constants.js');
    const checksum = read('src/lib/mediaIntel/checksum.js');
    assert.match(checksum, /MAX_PRACTICAL_HASH_BYTES = 250 \* 1024 \* 1024/);
    assert.match(constants, /MAX_PRACTICAL_HASH_BYTES/);
    assert.match(constants, /Do not advertise 2 GB/);
  });
});
