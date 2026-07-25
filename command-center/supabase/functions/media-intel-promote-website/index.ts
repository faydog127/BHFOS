/**
 * Explicit owner/admin website promotion (single-company).
 * Never copies private originals. Only promotes verified public_safe derivatives
 * that actually had EXIF/metadata stripped.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function normalizeRole(role: string) {
  const r = role.toLowerCase().trim()
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin'
  if (r === 'manager') return 'manager'
  return r
}

/** Remove JPEG APP0–APP15 segments (includes EXIF APP1 / XMP). */
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

async function assertOwnerAdmin(userId: string) {
  const { data: roleRow } = await supabaseAdmin
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const role = normalizeRole(String(roleRow?.role || ''))
  if (!['admin', 'manager'].includes(role)) {
    return { ok: false as const, role }
  }
  return { ok: true as const, role }
}

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json()
    const action = String(body.action || 'promote')
    const assetId = String(body.assetId || '').trim()
    if (!assetId) return json({ error: 'Missing asset' }, 400)

    const admin = await assertOwnerAdmin(user.id)
    if (!admin.ok) return json({ error: 'Only owner/admin may prepare or promote website media' }, 403)

    const eligible = await loadEligibleAsset(assetId)
    if ('error' in eligible) return json({ error: eligible.error }, eligible.status)
    const { asset } = eligible

    // Create a private public_safe derivative with real EXIF strip (JPEG only in this slice).
    if (action === 'prepare_public_safe') {
      if (!String(asset.mime_type || '').includes('jpeg') && !String(asset.mime_type || '').includes('jpg')) {
        return json({
          error: 'Public-safe preparation currently supports JPEG originals only. Convert or provide a JPEG first.',
        }, 400)
      }

      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(asset.original_bucket)
        .download(asset.original_path)
      if (dlErr || !blob) throw dlErr || new Error('Unable to read private original for derivative generation')

      const originalBytes = new Uint8Array(await blob.arrayBuffer())
      const stripped = stripJpegExif(originalBytes)
      if (stripped.byteLength < 128) throw new Error('EXIF strip produced invalid JPEG')

      const objectPath = `mil/derivatives/${assetId}/public_safe.jpg`
      const up = await supabaseAdmin.storage.from('media-intel-derivatives').upload(objectPath, stripped, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (up.error) throw up.error

      const { data: derivative, error: derErr } = await supabaseAdmin
        .from('mil_derivatives')
        .upsert(
          {
            asset_id: assetId,
            kind: 'public_safe',
            bucket: 'media-intel-derivatives',
            object_path: objectPath,
            mime_type: 'image/jpeg',
            byte_size: stripped.byteLength,
            strip_exif: true,
          },
          { onConflict: 'bucket,object_path' },
        )
        .select('*')
        .single()
      if (derErr) throw derErr

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'public_safe_derivative_created',
        target_type: 'mil_derivatives',
        target_id: derivative.id,
        details: {
          assetId,
          objectPath,
          strip_exif: true,
          originalBytes: originalBytes.byteLength,
          strippedBytes: stripped.byteLength,
        },
      })

      return json({
        ok: true,
        derivativeId: derivative.id,
        objectPath,
        strip_exif: true,
        note: 'Private public_safe derivative ready. Promote copies this derivative, never the original.',
      })
    }

    // Promote: copy only an existing stripped public_safe derivative into the public bucket.
    const { data: safeDer } = await supabaseAdmin
      .from('mil_derivatives')
      .select('*')
      .eq('asset_id', assetId)
      .eq('kind', 'public_safe')
      .eq('strip_exif', true)
      .eq('bucket', 'media-intel-derivatives')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!safeDer) {
      return json({
        error: 'Create a public-safe derivative first (action=prepare_public_safe). Originals are never copied to the public bucket.',
      }, 400)
    }
    if (!String(safeDer.object_path).startsWith('mil/derivatives/')) {
      return json({ error: 'Invalid public-safe derivative path' }, 400)
    }

    // Re-check gates immediately before publication
    const recheck = await loadEligibleAsset(assetId)
    if ('error' in recheck) return json({ error: recheck.error }, recheck.status)

    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(safeDer.bucket)
      .download(safeDer.object_path)
    if (dlErr || !blob) throw dlErr || new Error('Unable to read public-safe derivative')

    const bytes = new Uint8Array(await blob.arrayBuffer())
    // Refuse if somehow still a JPEG with APP1 EXIF present
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      for (let i = 2; i + 3 < Math.min(bytes.length, 65536);) {
        if (bytes[i] !== 0xff) break
        const marker = bytes[i + 1]
        if (marker === 0xe1) {
          return json({ error: 'Public-safe derivative still contains EXIF (APP1); regenerate it.' }, 400)
        }
        if (marker === 0xda || marker === 0xd9) break
        if (marker >= 0xd0 && marker <= 0xd7) {
          i += 2
          continue
        }
        const len = (bytes[i + 2] << 8) | bytes[i + 3]
        i += 2 + len
      }
    }

    const publicPath = `promoted/mil/${assetId}/${crypto.randomUUID()}.jpg`
    const up = await supabaseAdmin.storage.from('website-public-media').upload(publicPath, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (up.error) throw up.error

    const verified = Array.isArray(asset.mil_verified_metadata)
      ? asset.mil_verified_metadata[0]
      : asset.mil_verified_metadata

    const { data: websiteDer, error: derErr } = await supabaseAdmin
      .from('mil_derivatives')
      .insert({
        asset_id: assetId,
        kind: 'website_optimized',
        bucket: 'website-public-media',
        object_path: publicPath,
        mime_type: 'image/jpeg',
        byte_size: bytes.byteLength,
        strip_exif: true,
      })
      .select('*')
      .single()
    if (derErr) throw derErr

    const alt = verified?.alt_text || asset.original_filename || 'Vent Guys field documentation'
    const { data: websiteRow, error: wmErr } = await supabaseAdmin
      .from('website_media')
      .insert({
        storage_bucket: 'website-public-media',
        storage_path: publicPath,
        original_filename: asset.original_filename,
        title: verified?.public_caption || null,
        alt_text: alt,
        caption: verified?.public_caption || null,
        media_type: 'photo',
        display_status: 'pending_review',
        authorization_source: `mil_asset:${assetId}`,
        authorization_notes: 'Promoted from MIL public_safe derivative after human verification',
      })
      .select('id')
      .single()
    if (wmErr) throw wmErr

    await supabaseAdmin.from('mil_website_promotions').insert({
      asset_id: assetId,
      derivative_id: websiteDer.id,
      website_media_id: websiteRow.id,
      promoted_by: user.id,
      notes: 'Promoted from public_safe derivative; private original unchanged',
    })

    await supabaseAdmin.from('mil_audit_events').insert({
      actor_user_id: user.id,
      action: 'promotion_to_website_media',
      target_type: 'mil_assets',
      target_id: assetId,
      details: {
        websiteMediaId: websiteRow.id,
        publicPath,
        sourceDerivativeId: safeDer.id,
        websiteDerivativeId: websiteDer.id,
        strip_exif: true,
      },
    })

    return json({
      ok: true,
      websiteMediaId: websiteRow.id,
      publicPath,
      note: 'Promoted public_safe derivative only. Private original remains in media-intel-originals.',
    })
  } catch (error) {
    console.error('media-intel-promote-website', error)
    return json({ error: error instanceof Error ? error.message : 'Promotion failed' }, 500)
  }
})
