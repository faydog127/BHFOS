/**
 * Authorized short-lived signed URLs for MIL private media (single-company).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const PREVIEW_TTL = 300
const DOWNLOAD_TTL = 600

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function normalizeRole(role: string) {
  const r = role.toLowerCase().trim()
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin'
  if (r === 'manager') return 'manager'
  if (['office', 'csr'].includes(r)) return 'office'
  if (['media_reviewer', 'reviewer'].includes(r)) return 'media_reviewer'
  if (['reel_creator', 'creator', 'contributor'].includes(r)) return 'reel_creator'
  if (['technician', 'tech'].includes(r)) return 'technician'
  if (['phone_uploader', 'uploader'].includes(r)) return 'phone_uploader'
  return 'unauthenticated'
}

async function actorRole(userId: string) {
  const { data } = await supabaseAdmin
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return normalizeRole(String(data?.role || ''))
}

async function creatorCanView(userId: string, assetId: string) {
  const { data: asset } = await supabaseAdmin
    .from('mil_assets')
    .select('id, privacy_status, human_review_status, archived_at')
    .eq('id', assetId)
    .maybeSingle()
  if (!asset || asset.archived_at || asset.privacy_status !== 'clear' || asset.human_review_status !== 'verified') {
    return false
  }
  const { data: use } = await supabaseAdmin
    .from('mil_permitted_uses')
    .select('asset_id')
    .eq('asset_id', assetId)
    .eq('use_key', 'reel_creation')
    .eq('approved', true)
    .maybeSingle()
  if (use) return true

  const { data: assign } = await supabaseAdmin
    .from('mil_creator_assignments')
    .select('id')
    .eq('creator_user_id', userId)
    .eq('status', 'active')
    .eq('asset_id', assetId)
    .maybeSingle()
  if (assign) return true

  const { data: collAssign } = await supabaseAdmin
    .from('mil_creator_assignments')
    .select('collection_id')
    .eq('creator_user_id', userId)
    .eq('status', 'active')
    .not('collection_id', 'is', null)
  const collectionIds = (collAssign || []).map((r) => r.collection_id).filter(Boolean)
  if (!collectionIds.length) return false
  const { data: item } = await supabaseAdmin
    .from('mil_collection_items')
    .select('asset_id')
    .in('collection_id', collectionIds)
    .eq('asset_id', assetId)
    .maybeSingle()
  return Boolean(item)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sign in required' }, 401)

    const body = await req.json()
    const assetId = String(body.assetId || '').trim()
    const purpose = String(body.purpose || 'preview')
    const derivativeKind = body.derivativeKind ? String(body.derivativeKind) : null
    const allowOriginal = body.allowOriginal === true
    if (!assetId) return json({ error: 'Missing asset' }, 400)

    const role = await actorRole(user.id)
    const isStaff = ['admin', 'manager', 'office', 'media_reviewer', 'technician'].includes(role)
    const isCreator = role === 'reel_creator'
    if (!isStaff && !isCreator) {
      return json({ error: 'You do not have access to this media.' }, 403)
    }

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) throw assetErr
    if (!asset) return json({ error: 'Media not found' }, 404)

    if (isCreator) {
      const ok = await creatorCanView(user.id, assetId)
      if (!ok) return json({ error: 'This media is not shared with you.' }, 403)
      // Creators never receive raw intake originals
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('*')
        .eq('asset_id', assetId)
        .in('kind', ['creator_download', 'detail_preview', 'grid_thumb', 'video_preview', 'video_thumb'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!der) return json({ error: 'No approved downloadable copy is available yet.' }, 403)
      const ttl = purpose === 'download' ? DOWNLOAD_TTL : PREVIEW_TTL
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from(der.bucket)
        .createSignedUrl(der.object_path, ttl)
      if (sErr) throw sErr
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: purpose === 'download' ? 'creator_download' : 'creator_preview',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { derivativeId: der.id, kind: der.kind, ttl },
      })
      return json({ url: signed.signedUrl, expiresIn: ttl, bucket: der.bucket, kind: der.kind })
    }

    let bucket = asset.original_bucket
    let path = asset.original_path
    let kind = 'original'

    if (derivativeKind) {
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('*')
        .eq('asset_id', assetId)
        .eq('kind', derivativeKind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!der) return json({ error: 'Derivative not found' }, 404)
      bucket = der.bucket
      path = der.object_path
      kind = der.kind
    } else if (!allowOriginal) {
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('*')
        .eq('asset_id', assetId)
        .in('kind', ['detail_preview', 'grid_thumb', 'heic_preview', 'video_thumb', 'video_preview'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (der) {
        bucket = der.bucket
        path = der.object_path
        kind = der.kind
      }
    }

    if (!['media-intel-originals', 'media-intel-derivatives'].includes(bucket)) {
      return json({ error: 'Invalid storage target' }, 400)
    }
    if (!String(path).startsWith('mil/')) {
      return json({ error: 'Invalid storage path' }, 400)
    }

    const ttl = purpose === 'download' ? DOWNLOAD_TTL : PREVIEW_TTL
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, ttl)
    if (sErr) throw sErr

    await supabaseAdmin.from('mil_audit_events').insert({
      actor_user_id: user.id,
      action: purpose === 'download' ? 'media_download' : 'media_preview',
      target_type: 'mil_assets',
      target_id: assetId,
      details: { bucket, kind, ttl, role },
    })

    return json({ url: signed.signedUrl, expiresIn: ttl, kind })
  } catch (error) {
    console.error('media-intel-sign', error)
    return json({ error: error instanceof Error ? error.message : 'Sign failed' }, 500)
  }
})
