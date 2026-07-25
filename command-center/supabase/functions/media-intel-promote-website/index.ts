/**
 * Explicit owner/admin promotion to website-public-media (single-company).
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
    const assetId = String(body.assetId || '').trim()
    if (!assetId) return json({ error: 'Missing asset' }, 400)

    const { data: roleRow } = await supabaseAdmin
      .from('app_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const role = normalizeRole(String(roleRow?.role || ''))
    if (!['admin', 'manager'].includes(role)) {
      return json({ error: 'Only owner/admin may promote to website media' }, 403)
    }

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*, mil_verified_metadata(*)')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) throw assetErr
    if (!asset) return json({ error: 'Asset not found' }, 404)
    if (asset.human_review_status !== 'verified') {
      return json({ error: 'Asset must be human-verified before website promotion' }, 400)
    }
    if (asset.privacy_status !== 'clear') {
      return json({ error: 'Privacy must be clear before website promotion' }, 400)
    }
    if (['ownership_unknown', 'permission_unknown', 'public_use_prohibited'].includes(asset.rights_status)) {
      return json({ error: 'Rights/permission block public promotion' }, 400)
    }
    if (asset.customer_permission_status === 'unknown') {
      return json({ error: 'Customer permission unknown — cannot promote' }, 400)
    }

    const { data: useRow } = await supabaseAdmin
      .from('mil_permitted_uses')
      .select('*')
      .eq('asset_id', assetId)
      .eq('use_key', 'website')
      .eq('approved', true)
      .maybeSingle()
    if (!useRow) return json({ error: 'Website permitted use must be approved first' }, 400)

    const verified = Array.isArray(asset.mil_verified_metadata)
      ? asset.mil_verified_metadata[0]
      : asset.mil_verified_metadata

    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(asset.original_bucket)
      .download(asset.original_path)
    if (dlErr || !blob) throw dlErr || new Error('Unable to read private original')

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const ext = (asset.original_filename || 'file').split('.').pop() || 'bin'
    const publicPath = `promoted/mil/${assetId}/${crypto.randomUUID()}.${ext}`
    const contentType = asset.mime_type || 'application/octet-stream'

    const up = await supabaseAdmin.storage.from('website-public-media').upload(publicPath, bytes, {
      contentType,
      upsert: false,
    })
    if (up.error) throw up.error

    const { data: derivative, error: derErr } = await supabaseAdmin
      .from('mil_derivatives')
      .insert({
        asset_id: assetId,
        kind: 'website_optimized',
        bucket: 'website-public-media',
        object_path: publicPath,
        mime_type: contentType,
        byte_size: bytes.byteLength,
        strip_exif: String(contentType).includes('jpeg'),
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
        media_type: asset.media_kind === 'video' ? 'video' : 'photo',
        display_status: 'pending_review',
        authorization_source: `mil_asset:${assetId}`,
        authorization_notes: 'Promoted from Media Intelligence Library after human verification',
      })
      .select('id')
      .single()
    if (wmErr) throw wmErr

    await supabaseAdmin.from('mil_website_promotions').insert({
      asset_id: assetId,
      derivative_id: derivative.id,
      website_media_id: websiteRow.id,
      promoted_by: user.id,
      notes: 'Explicit promote; private original unchanged',
    })

    await supabaseAdmin.from('mil_audit_events').insert({
      actor_user_id: user.id,
      action: 'promotion_to_website_media',
      target_type: 'mil_assets',
      target_id: assetId,
      details: { websiteMediaId: websiteRow.id, publicPath, derivativeId: derivative.id },
    })

    return json({
      ok: true,
      websiteMediaId: websiteRow.id,
      publicPath,
      note: 'Private original remains in media-intel-originals. Website row starts as pending_review.',
    })
  } catch (error) {
    console.error('media-intel-promote-website', error)
    return json({ error: error instanceof Error ? error.message : 'Promotion failed' }, 500)
  }
})
