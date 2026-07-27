/**
 * Media Intelligence — single-company access architecture contracts.
 * Run: node --test tests/unit/media-intel-access.test.mjs
 *
 * These are static/source contracts. They do not prove deployed RLS, storage,
 * edge-function, expiry, or revocation behavior.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('MIL access routes (single-company)', () => {
  const app = read('src/App.jsx');

  it('registers /media/*, /media/upload, and /creator/* without tenant segments', () => {
    assert.match(app, /path="\/media\/\*"/);
    assert.match(app, /path="\/creator\/\*"/);
    assert.match(app, /path="upload"/);
    assert.match(app, /MediaUploadEntry/);
    assert.match(app, /CreatorRoutesPage/);
    assert.doesNotMatch(app, /path="\/:tenantId\/media\/\*"/);
    assert.doesNotMatch(app, /path="\/:tenantId\/creator\/\*"/);
  });

  it('uses MediaSessionGuard for staff/creator — not TenantGuard on MIL product routes', () => {
    assert.match(app, /MediaSessionGuard/);
    assert.match(app, /Session upload must not require CRM login/);
    assert.match(app, /const MediaStaffLayout/);
    // Staff layout must not wrap with TenantGuard
    const staffBlock = app.slice(app.indexOf('const MediaStaffLayout'), app.indexOf('const MediaLibraryRoutes'));
    assert.doesNotMatch(staffBlock, /TenantGuard/);
    assert.match(staffBlock, /MediaSessionGuard/);
  });

  it('documents temporary /crm/media → /media alias without tenant-prefixed MIL aliases', () => {
    assert.match(app, /MediaCrmAliasRedirect/);
    assert.match(app, /path="\/crm\/media\/\*"/);
    assert.match(app, /\/media\/\$\{rest/);
    assert.doesNotMatch(app, /\/\$\{tenantId\}\/media\//);
  });
});

describe('MIL creator isolation UI', () => {
  it('creator portal has no CRM sidebar', () => {
    const layout = read('src/pages/creator/CreatorPortalLayout.jsx');
    assert.match(layout, /creator-portal/);
    assert.doesNotMatch(layout, /BHFSidebar/);
    assert.doesNotMatch(layout, /CRM_PRIMARY_NAV/);
  });

  it('creator IA is one workspace — no fake media/reels/upload tabs; upload stays retryable', () => {
    const layout = read('src/pages/creator/CreatorPortalLayout.jsx');
    const routes = read('src/pages/creator/CreatorRoutes.jsx');
    const workspace = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.doesNotMatch(layout, /to=\{`\/creator\/\$\{item\.path\}`\}/);
    assert.doesNotMatch(layout, /Available media/);
    assert.doesNotMatch(layout, /My reels/);
    assert.match(routes, /index element=\{<CreatorWorkspacePage/);
    assert.match(routes, /path="media" element=\{<Navigate to="\/creator"/);
    assert.doesNotMatch(routes, /path="media" element=\{<CreatorWorkspacePage/);
    assert.doesNotMatch(workspace, /reelUploadDisabled|setReelUploadDisabled/);
    assert.match(workspace, /REEL_UPLOAD_UNAVAILABLE_MESSAGE/);
    assert.match(workspace, /approval is not publishing/i);
  });

  it('CRM layout redirects creator-only accounts to /creator', () => {
    const layout = read('src/components/BHFCrmLayout.jsx');
    assert.match(layout, /accessGate/);
    assert.match(layout, /to="\/creator"/);
    assert.match(layout, /fetchMilRole\(\)/);
  });

  it('owner shell redirects creators away from staff library', () => {
    const shell = read('src/pages/crm/media/MediaOwnerShell.jsx');
    assert.match(shell, /to="\/creator"/);
    assert.match(shell, /to="\/media\/upload"/);
    assert.doesNotMatch(shell, /tenantId/);
  });

  it('capability guard never requires route tenant identity', () => {
    const guard = read('src/components/media/MediaCapabilityGuard.jsx');
    assert.match(guard, /fetchMilRole\(\)/);
    assert.doesNotMatch(guard, /useParams/);
    assert.doesNotMatch(guard, /tenantId/);
  });
});

describe('MIL dashboard navigation contracts', () => {
  it('does not link to dead /media/creator; duplicates use /media/all?dup=1', () => {
    const dash = read('src/pages/crm/media/MediaDashboard.jsx');
    assert.doesNotMatch(dash, /to="\/media\/creator"/);
    assert.match(dash, /to="\/media\/settings"/);
    assert.match(dash, /to="\/media\/all\?dup=1"/);
    assert.doesNotMatch(dash, /resumable batches/i);
  });

  it('All Media honors dup=1 via listAssets duplicatesOnly', () => {
    const page = read('src/pages/crm/media/MediaAllMedia.jsx');
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(page, /params\.get\('dup'\) === '1'/);
    assert.match(page, /duplicatesOnly/);
    assert.match(api, /filters\.duplicatesOnly/);
    assert.match(api, /duplicate_of_asset_id/);
  });
});

describe('MIL upload session + signed access (no tenant)', () => {
  it('upload session stores token hash only and supports revoke/validate/mint', () => {
    const fn = read('supabase/functions/media-intel-upload-session/index.ts');
    assert.match(fn, /token_hash/);
    assert.match(fn, /sha256Hex/);
    assert.match(fn, /action === 'create'/);
    assert.match(fn, /action === 'validate'/);
    assert.match(fn, /action === 'mint_upload'/);
    assert.match(fn, /action === 'revoke'/);
    assert.match(fn, /browseLibrary: false/);
    // Fragment form (#session=), not a query param — never sent to the server in
    // the request line and stripped before any Referer header is generated.
    assert.match(fn, /\/media\/upload#session=/);
    assert.doesNotMatch(fn, /tenant_id|tenantId/);
  });

  it('sign function blocks creators from originals and uses short TTLs', () => {
    const fn = read('supabase/functions/media-intel-sign/index.ts');
    assert.match(fn, /PREVIEW_TTL = 300/);
    assert.match(fn, /DOWNLOAD_TTL = 600/);
    assert.match(fn, /Creators never get originals/);
    assert.match(fn, /creatorCanView/);
    assert.match(fn, /creator_download|detail_preview|grid_thumb/);
    assert.doesNotMatch(fn, /tenant_id|tenantId/);
  });

  it('sign function is fail-closed: auth, purpose, staff/creator gate, no client createSignedUrl', () => {
    const fn = read('supabase/functions/media-intel-sign/index.ts');
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(fn, /auth\.getUser\(\)/);
    assert.match(fn, /VALID_PURPOSES/);
    assert.match(fn, /STAFF_ROLES/);
    assert.match(fn, /You do not have access to this media/);
    assert.match(fn, /allowOriginal === true/);
    assert.match(fn, /createSignedUrl/);
    // Browser must not mint storage signed URLs; only the edge may.
    assert.match(api, /requestSignedMediaUrl|media-intel-sign/);
    assert.doesNotMatch(api, /storage\.from\([^)]*\)\.createSignedUrl/);
  });

  it('storage policies keep client inserts on quarantine paths only', () => {
    const core = read('supabase/migrations/20260725120000_media_intelligence_library.sql');
    assert.match(core, /create policy "MIL originals quarantine insert by staff"/);
    assert.match(core, /name like 'mil\/quarantine\/%'/);
    assert.match(core, /mil_is_staff\(\)/);
    // Legacy broad insert policy names may appear only in DROP IF EXISTS cleanup.
    assert.doesNotMatch(core, /create policy "MIL originals insertable by staff/);
  });

  it('client table grants migration states SELECT/write privileges explicitly', () => {
    const grants = read('supabase/migrations/20260727130000_media_intel_client_table_grants.sql');
    assert.match(grants, /grant select on public\.mil_collections to authenticated/);
    assert.match(grants, /grant insert, update, delete on public\.mil_collection_items to authenticated/);
    assert.match(grants, /grant insert, update, delete on public\.mil_verified_metadata to authenticated/);
    assert.match(grants, /grant select, insert, update, delete on public\.mil_collections to service_role/);
    assert.match(grants, /Correct-looking RLS without GRANT/);
    assert.doesNotMatch(grants, /grant insert on public\.mil_assets to authenticated/);
  });

  it('JWT-seeded RLS behavioral SQL test exists', () => {
    const sql = read('supabase/tests/mil/05_jwt_rls_behavior.sql');
    assert.match(sql, /request\.jwt\.claim\.sub/);
    assert.match(sql, /mil_is_reviewer\(\)/);
    assert.match(sql, /office must NOT be mil_is_reviewer/);
    assert.match(sql, /mil\/quarantine\//);
    assert.match(sql, /mil 05_jwt_rls_behavior: PASS/);
  });

  it('access migration adds mil_upload_sessions without tenant_id', () => {
    const mig = read('supabase/migrations/20260725130000_media_intel_access_sessions.sql');
    const core = read('supabase/migrations/20260725120000_media_intelligence_library.sql');
    assert.match(mig, /mil_upload_sessions/);
    assert.match(mig, /mil_revoke_creator_assignment/);
    assert.match(mig, /mil_revoke_upload_session/);
    assert.match(core, /phone_uploader/);
    assert.doesNotMatch(mig, /\btenant_id\s+text\b/);
  });
});

describe('MIL authorization model affirmations', () => {
  it('roles resolve by user_id only', () => {
    const roles = read('src/lib/mediaIntel/roles.js');
    assert.match(roles, /\.eq\('user_id', auth\.user\.id\)/);
    assert.doesNotMatch(roles, /tenant_id/);
    assert.doesNotMatch(roles, /tenantId/);
  });

  it('docs forbid new domain and public gallery placement', () => {
    const doc = read('docs/media-intelligence/ACCESS_ARCHITECTURE.md');
    assert.match(doc, /No new domain/);
    assert.match(doc, /Not a public gallery/);
    assert.match(doc, /app\.bhfos\.com/);
  });

  it('docs prescribe single-company routes', () => {
    const doc = read('docs/media-intelligence/ACCESS_ARCHITECTURE.md');
    assert.match(doc, /\/media\/\*/);
    assert.match(doc, /\/creator\/\*/);
    assert.match(doc, /Not supported/);
    assert.match(doc, /Tenant-prefixed media library/);
  });
});
