/**
 * Explicit owner/admin website promotion (single-company).
 *
 * PRE-STAGING HARDENING: `prepare_public_safe` and `promote` are intentionally
 * DISABLED (503) pending a proven decode/re-encode public-safe transform
 * pipeline. The previous implementation only stripped JPEG APP0–APP15
 * segments (EXIF/XMP marker removal) from the *original* container — it never
 * decoded and re-encoded pixel data. Stripping metadata markers does NOT
 * prove an image is safe to publish (embedded thumbnails, non-EXIF
 * steganographic content, or marker-parsing edge cases in other viewers can
 * still leak data), so this function must not claim it does. Re-enable only
 * after a verified decode → re-encode → strip pipeline exists and has been
 * reviewed.
 *
 * `unpublish` remains available so owner/admin can pull anything already
 * live (or that predates this hardening) without waiting on that work.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilOwnerAdmin } from '../_shared/milRoles.ts'

const PUBLIC_SAFE_DISABLED_MESSAGE =
  'Public-safe transform is not implemented. Stripping EXIF/XMP markers from the original container does not prove an image is safe to publish (it does not decode/re-encode pixel data). This action is disabled until a proven decode → re-encode → strip pipeline is built and reviewed. media-intel-originals is never copied directly to website-public-media.'

/** Remove JPEG APP0–APP15 segments (includes EXIF APP1 / XMP). Kept for future re-enablement only — NOT wired in below. */
function stripJpegExif(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new Error('Not a JPEG')
  }
  const out: number[] = [0xff, 0xd8]
  let i = 2
  while (i + 1 < input.length) {
    if (input[i] !== 0xff) {
      for (; i < input.length; i++) out.push(input[i])
      break
    }
    while (i < input.length && input[i] === 0xff) i++
    if (i >= input.length) break
    const marker = input[i]
    i += 1
    if (marker === 0xd9) {
      out.push(0xff, 0xd9)
      break
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(0xff, marker)
      continue
    }
    if (i + 1 >= input.length) break
    const len = (input[i] << 8) | input[i + 1]
    if (len < 2 || i + len > input.length) break
    const isApp = marker >= 0xe0 && marker <= 0xef
    if (!isApp) {
      out.push(0xff, marker)
      for (let j = 0; j < len; j++) out.push(input[i + j])
    }
    i += len
    if (marker === 0xda) {
      for (; i < input.length; i++) out.push(input[i])
      break
    }
  }
  return new Uint8Array(out)
}

/** Eligibility gates a future proven pipeline must still enforce. Not currently invoked by promote (disabled). */
async function loadEligibleAsset(assetId: string) {
  const { data: asset, error: assetErr } = await supabaseAdmin
    .from('mil_assets')
    .select('*, mil_verified_metadata(*)')
    .eq('id', assetId)
    .maybeSingle()
  if (assetErr) throw assetErr
  if (!asset) return { error: 'Asset not found', status: 404 }
  if (asset.human_review_status !== 'verified') {
    return { error: 'Asset must be human-verified before website promotion', status: 400 }
  }
  if (asset.privacy_status !== 'clear') {
    return { error: 'Privacy must be clear before website promotion', status: 400 }
  }
  if (['ownership_unknown', 'permission_unknown', 'public_use_prohibited'].includes(asset.rights_status)) {
    return { error: 'Rights/permission block public promotion', status: 400 }
  }
  if (asset.customer_permission_status === 'unknown') {
    return { error: 'Customer permission unknown — cannot promote', status: 400 }
  }
  const { data: useRow } = await supabaseAdmin
    .from('mil_permitted_uses')
    .select('*')
    .eq('asset_id', assetId)
    .eq('use_key', 'website')
    .eq('approved', true)
    .maybeSingle()
  if (!useRow) return { error: 'Website permitted use must be approved first', status: 400 }
  return { asset }
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'promote')
    const assetId = String(body.assetId || '').trim()

    if (!(await isMilOwnerAdmin(user.id))) {
      return json({ error: 'Only owner/admin may manage website promotions' }, 403)
    }

    if (action === 'prepare_public_safe' || action === 'promote') {
      if (!assetId) return json({ error: 'Missing asset' }, 400)
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'website_promotion_attempt_blocked',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { action, reason: 'public_safe_transform_not_implemented' },
      })
      return json({ error: PUBLIC_SAFE_DISABLED_MESSAGE, code: 'not_implemented' }, 503)
    }

    if (action === 'unpublish') {
      if (!assetId) return json({ error: 'Missing asset' }, 400)

      const { data: promotions, error: promoErr } = await supabaseAdmin
        .from('mil_website_promotions')
        .select('*')
        .eq('asset_id', assetId)
        .order('promoted_at', { ascending: false })
      if (promoErr) throw promoErr
      if (!promotions || !promotions.length) {
        return json({ error: 'No website promotion found for this asset' }, 404)
      }

      const results: Array<{ promotionId: string; ok: boolean; error?: string }> = []
      for (const promo of promotions) {
        try {
          if (promo.website_media_id) {
            await supabaseAdmin
              .from('website_media')
              .update({ display_status: 'unavailable' })
              .eq('id', promo.website_media_id)
          }

          const { data: der } = await supabaseAdmin
            .from('mil_derivatives')
            .select('bucket, object_path')
            .eq('id', promo.derivative_id)
            .maybeSingle()
          if (der && der.bucket === 'website-public-media') {
            await supabaseAdmin.storage.from(der.bucket).remove([der.object_path]).catch(() => {})
          }

          results.push({ promotionId: promo.id, ok: true })
        } catch (err) {
          results.push({ promotionId: promo.id, ok: false, error: err instanceof Error ? err.message : 'unpublish failed' })
        }
      }

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'website_unpublish',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { results },
      })

      const allOk = results.every((r) => r.ok)
      return json({ ok: allOk, results }, allOk ? 200 : 500)
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    console.error('media-intel-promote-website', error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error ? error.message : 'Promotion failed' }, 500)
  }
})
