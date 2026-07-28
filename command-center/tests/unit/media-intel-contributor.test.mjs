/**
 * Contributor Workspace (Creator architecture) source contracts.
 * Run: node --test tests/unit/media-intel-contributor.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Contributor Workspace source contracts', () => {
  it('migration denies archived/trashed assignment and adds pause + brief fields', () => {
    const sql = read('supabase/migrations/20260728140000_media_intel_contributor_workspace.sql');
    assert.match(sql, /Cannot assign trashed media to a contributor/);
    assert.match(sql, /Cannot assign archived media to a contributor/);
    assert.match(sql, /mil_set_creator_assignment_status/);
    assert.match(sql, /requested_output/);
    assert.match(sql, /'paused'/);
  });

  it('sign edge mirrors trash denial for creator access', () => {
    const src = read('supabase/functions/media-intel-sign/index.ts');
    assert.match(src, /trashed_at/);
    assert.match(src, /asset\.trashed_at/);
  });

  it('UI uses Contributor Workspace labels and /contributor alias', () => {
    const app = read('src/App.jsx');
    const portal = read('src/pages/creator/CreatorPortalLayout.jsx');
    const workspace = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.match(app, /path="\/contributor/);
    assert.match(portal, /Contributor Workspace/);
    assert.match(workspace, /Contributor Workspace/);
    assert.match(workspace, /allowOriginal:\s*false/);
  });

  it('login allows /contributor next and defaults creators to /creator', () => {
    const login = read('src/pages/Login.jsx');
    assert.match(login, /\/contributor/);
    assert.match(login, /navigate\('\/creator'/);
  });
});
