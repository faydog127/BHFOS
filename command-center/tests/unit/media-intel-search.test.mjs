/**
 * MIL All Media search — pure helper + source contracts.
 * Run: node --test tests/unit/media-intel-search.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAssetSearchPlan,
  buildTextSearchOrFilter,
  isAssetSearchUuid,
  mergeAssetsById,
  normalizeAssetSearchTerm,
  normalizeAssetSearchUuid,
  postgrestFilenameIlikeOrClause,
  postgrestIdInOrClause,
  sanitizeSearchLiteral,
} from '../../src/lib/mediaIntel/assetSearch.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SAMPLE_UUID = 'ce6eb7ed-700b-4a8c-887e-e079387f7992';
const OTHER_UUID = 'cc8c7c1c-fefa-4a70-be94-c0c4a1dc431e';

describe('normalizeAssetSearchTerm', () => {
  it('blank and whitespace-only → null', () => {
    assert.equal(normalizeAssetSearchTerm(''), null);
    assert.equal(normalizeAssetSearchTerm('   '), null);
    assert.equal(normalizeAssetSearchTerm('\t\n'), null);
    assert.equal(normalizeAssetSearchTerm(null), null);
    assert.equal(normalizeAssetSearchTerm(undefined), null);
  });

  it('trims ordinary text', () => {
    assert.equal(normalizeAssetSearchTerm('  dryer_vent  '), 'dryer_vent');
  });
});

describe('UUID detection', () => {
  it('accepts exact valid UUID and rejects non-UUID text', () => {
    assert.equal(isAssetSearchUuid(SAMPLE_UUID), true);
    assert.equal(normalizeAssetSearchUuid(` ${SAMPLE_UUID.toUpperCase()} `), SAMPLE_UUID);
    assert.equal(isAssetSearchUuid('01_before_vent_lint'), false);
    assert.equal(isAssetSearchUuid('dryer_vent'), false);
    assert.equal(isAssetSearchUuid('not-a-uuid'), false);
    assert.equal(normalizeAssetSearchUuid('01_before_vent_lint'), null);
  });
});

describe('buildAssetSearchPlan', () => {
  it('blank / whitespace → none (unfiltered list)', () => {
    assert.deepEqual(buildAssetSearchPlan(''), { kind: 'none' });
    assert.deepEqual(buildAssetSearchPlan('   '), { kind: 'none' });
  });

  it('exact valid UUID → uuid plan (no filename/tag id.eq for arbitrary text)', () => {
    const plan = buildAssetSearchPlan(SAMPLE_UUID);
    assert.equal(plan.kind, 'uuid');
    assert.equal(plan.uuid, SAMPLE_UUID);
  });

  it('non-UUID ordinary text → text plan with literal ilike pattern', () => {
    const plan = buildAssetSearchPlan('Before_Vent');
    assert.equal(plan.kind, 'text');
    assert.equal(plan.literal, 'Before_Vent');
    assert.equal(plan.ilikePattern, '%Before_Vent%');
  });

  it('partial / case-insensitive filename terms stay text plans', () => {
    assert.equal(buildAssetSearchPlan('vent_lint').kind, 'text');
    assert.equal(buildAssetSearchPlan('LOWQ').kind, 'text');
    assert.match(buildAssetSearchPlan('lowq').ilikePattern, /%lowq%/i);
  });

  it('UUID-shaped text is uuid plan even when no asset will match', () => {
    const missing = '00000000-0000-4000-8000-000000000099';
    const plan = buildAssetSearchPlan(missing);
    assert.equal(plan.kind, 'uuid');
    assert.equal(plan.uuid, missing);
  });

  it('punctuation and filter-significant characters are sanitized for text plans', () => {
    const plan = buildAssetSearchPlan('foo,bar (baz) "qux" 100%_done');
    assert.equal(plan.kind, 'text');
    assert.equal(plan.literal.includes('%'), false);
    assert.ok(plan.literal.includes('foo,bar'));
    assert.ok(plan.literal.includes('(baz)'));
    assert.ok(plan.literal.includes('_done'));
  });

  it('only LIKE multi-wildcards → no_match (empty result, not an exception)', () => {
    assert.equal(buildAssetSearchPlan('%%%').kind, 'no_match');
    assert.equal(buildAssetSearchPlan('___').kind, 'text'); // underscores alone remain searchable literal
  });
});

describe('PostgREST filter composition', () => {
  it('never embeds raw non-UUID text as id.eq', () => {
    const filter = buildTextSearchOrFilter('01_before_vent_lint', []);
    assert.ok(filter);
    assert.doesNotMatch(filter, /id\.eq\./);
    assert.match(filter, /original_filename\.ilike\./);
  });

  it('quotes filename pattern so commas/parens are safe', () => {
    const clause = postgrestFilenameIlikeOrClause('a,b (c)');
    assert.equal(clause, 'original_filename.ilike."%a,b (c)%"');
  });

  it('id.in clause only accepts valid UUIDs and applies the launch ID cap', () => {
    assert.equal(postgrestIdInOrClause(['nope', SAMPLE_UUID, SAMPLE_UUID]), `id.in.(${SAMPLE_UUID})`);
    assert.equal(postgrestIdInOrClause([]), null);
    const many = Array.from({ length: 250 }, (_, i) => {
      const hex = i.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${hex}`;
    });
    const clause = postgrestIdInOrClause(many);
    assert.ok(clause.startsWith('id.in.('));
    assert.equal(clause.slice('id.in.('.length, -1).split(',').length, 200);
  });

  it('combines filename and tag-derived ids without duplicating logic errors', () => {
    const filter = buildTextSearchOrFilter('dryer_vent', [SAMPLE_UUID, OTHER_UUID, 'bad']);
    assert.match(filter, /original_filename\.ilike\."%dryer_vent%"/);
    assert.match(filter, new RegExp(`id\\.in\\.\\(${SAMPLE_UUID},${OTHER_UUID}\\)`));
    assert.doesNotMatch(filter, /id\.eq\./);
  });
});

describe('mergeAssetsById dedupes filename+tag overlaps', () => {
  it('returns each asset once when both sources match', () => {
    const a = { id: SAMPLE_UUID, original_filename: '01_before_vent_lint.jpg' };
    const b = { id: OTHER_UUID, original_filename: '02_after_vent_clean.jpg' };
    const merged = mergeAssetsById([a, b], [a]);
    assert.equal(merged.length, 2);
    assert.equal(merged.filter((r) => r.id === SAMPLE_UUID).length, 1);
  });
});

describe('sanitizeSearchLiteral', () => {
  it('neutralizes % and backslash but keeps underscores for snake_case tags/filenames', () => {
    assert.equal(sanitizeSearchLiteral('a%b_c'), 'a b_c');
    assert.equal(sanitizeSearchLiteral('dryer_vent'), 'dryer_vent');
  });
});

describe('listAssets search source contracts', () => {
  it('listAssets uses buildAssetSearchPlan and never raw id.eq for arbitrary search', () => {
    const api = read('src/lib/mediaIntel/api.js');
    const start = api.indexOf('export async function listAssets');
    const body = api.slice(start, start + 2200);
    assert.match(body, /buildAssetSearchPlan/);
    assert.match(body, /mil_asset_tags/);
    assert.match(body, /tag_slug/);
    assert.match(body, /plan\.kind === 'uuid'/);
    assert.doesNotMatch(body, /id\.eq\.\$\{/);
    assert.doesNotMatch(body, /original_filename\.ilike\.%\$\{/);
  });

  it('All Media trims search and shows empty-search honesty', () => {
    const page = read('src/pages/crm/media/MediaAllMedia.jsx');
    assert.match(page, /search\.trim\(\)/);
    assert.match(page, /No media matches this search/);
    assert.match(page, /Filename, tags, or id/);
  });

  it('preserves archive / dup / limit filter wiring in listAssets', () => {
    const api = read('src/lib/mediaIntel/api.js');
    const start = api.indexOf('export async function listAssets');
    const body = api.slice(start, start + 2200);
    assert.match(body, /filters\.archived/);
    assert.match(body, /filters\.duplicatesOnly/);
    assert.match(body, /filters\.limit/);
    assert.match(body, /order\('created_at'/);
  });
});
