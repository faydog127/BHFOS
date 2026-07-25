import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const PROMPT_VERSION = 'mil-v1'
const PROVIDER = 'openai'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

type Suggested = {
  media_type?: string
  service_category?: string
  work_phase?: string
  condition_notes?: string
  location_component?: string
  tags?: string[]
  narrative?: string
  public_caption?: string
  alt_text?: string
  privacy_risks?: string[]
  recommended_uses?: string[]
  unsuitable_uses?: string[]
  explanation?: string
  quality?: Record<string, { suitable?: boolean; score?: number; explanation?: string }>
}

function normalizeRole(role: string) {
  const r = role.toLowerCase().trim()
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin'
  if (r === 'manager') return 'manager'
  // Library analysis staff — technicians are not included by default.
  if (['office', 'csr', 'media_reviewer', 'reviewer'].includes(r)) return 'staff'
  return 'other'
}

async function isStaff(userId: string) {
  const { data } = await supabaseAdmin
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const role = normalizeRole(String(data?.role || ''))
  return role === 'admin' || role === 'manager' || role === 'staff'
}

async function analyzeWithOpenAI(imageUrl: string, filename: string) {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new Error('NO_AI_KEY')
  const model = Deno.env.get('MIL_OPENAI_MODEL') || 'gpt-4o-mini'
  const system = `You analyze HVAC dryer-vent and air-duct field media for The Vent Guys.
Return JSON only. Suggestions are advisory; humans verify.
Never invent customer names or addresses. Flag privacy risks.`
  const user = `Filename: ${filename}
Produce JSON with keys: media_type, service_category, work_phase, condition_notes, location_component,
tags, narrative, public_caption, alt_text, privacy_risks, recommended_uses, unsuitable_uses, explanation,
quality (object keyed by homepage_hero, website_service_proof, social_photo, reel_short_video, inspection_report, training, internal_docs).`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: imageUrl } }] },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
  const payload = await res.json()
  const suggested = JSON.parse(payload?.choices?.[0]?.message?.content || '{}') as Suggested
  return { model, suggested, confidence: 0.6 }
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

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'analyze')

    if (action === 'config_status') {
      const configured = Boolean(Deno.env.get('OPENAI_API_KEY'))
      return json({
        configured,
        provider: configured ? PROVIDER : null,
        prompt_version: PROMPT_VERSION,
        message: configured
          ? 'AI analysis is configured.'
          : 'AI key not configured. Uploads and manual review still work. Analysis records skipped_no_key until a key is set.',
      })
    }

    if (!(await isStaff(user.id))) return json({ error: 'Forbidden' }, 403)

    const assetId = String(body.assetId || '').trim()
    if (!assetId) return json({ error: 'Missing asset' }, 400)

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) throw assetErr
    if (!asset) return json({ error: 'Asset not found' }, 404)

    if (asset.exclude_from_ai) {
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'skipped_duplicate',
        suggested: {},
        explanation: 'Excluded from AI reprocessing',
      })
      return json({ skipped: true, reason: 'exclude_from_ai' })
    }

    await supabaseAdmin.from('mil_assets').update({ processing_status: 'analyzing' }).eq('id', assetId)

    if (!Deno.env.get('OPENAI_API_KEY')) {
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'skipped_no_key',
        suggested: {},
        explanation: 'OPENAI_API_KEY not configured',
      })
      await supabaseAdmin.from('mil_assets').update({ processing_status: 'uploaded' }).eq('id', assetId)
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'ai_analysis_skipped_no_key',
        target_type: 'mil_assets',
        target_id: assetId,
        details: {},
      })
      return json({ configured: false, status: 'skipped_no_key' })
    }

    if (asset.media_kind !== 'photo') {
      const suggested: Suggested = {
        media_type: 'video',
        work_phase: 'unknown',
        narrative: `Video file ${asset.original_filename}. Human review required.`,
        explanation: 'Video frame analysis limited; human verification required.',
        privacy_risks: ['spoken_names_or_addresses_possible', 'copyrighted_music_possible'],
        recommended_uses: ['internal'],
        tags: [],
      }
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        model: 'mil-video-stub',
        prompt_version: PROMPT_VERSION,
        status: 'succeeded',
        suggested,
        overall_confidence: 0.2,
        explanation: suggested.explanation,
      })
      await supabaseAdmin.from('mil_assets').update({ processing_status: 'analyzed' }).eq('id', assetId)
      return json({ ok: true, mode: 'video_stub' })
    }

    const { data: image, error: imageError } = await supabaseAdmin.storage
      .from(asset.original_bucket || 'media-intel-originals')
      .download(asset.original_path)
    if (imageError || !image) throw imageError || new Error('Could not download original')

    const bytes = new Uint8Array(await image.arrayBuffer())
    const imageUrl = `data:${asset.mime_type || 'image/jpeg'};base64,${toBase64(bytes.slice(0, Math.min(bytes.length, 4_500_000)))}`

    try {
      const result = await analyzeWithOpenAI(imageUrl, asset.original_filename)
      // Do NOT write into mil_verified_metadata — suggestions only
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        model: result.model,
        prompt_version: PROMPT_VERSION,
        status: 'succeeded',
        suggested: result.suggested,
        overall_confidence: result.confidence,
        explanation: result.suggested.explanation || null,
      })

      for (const [purpose, q] of Object.entries(result.suggested.quality || {})) {
        await supabaseAdmin.from('mil_quality_scores').upsert({
          asset_id: assetId,
          purpose,
          source: 'ai_suggested',
          score: q?.score ?? null,
          suitable: q?.suitable ?? null,
          explanation: q?.explanation ?? null,
        }, { onConflict: 'asset_id,purpose,source' })
      }

      for (const risk of result.suggested.privacy_risks || []) {
        await supabaseAdmin.from('mil_privacy_findings').insert({
          asset_id: assetId,
          finding_key: String(risk).slice(0, 120),
          severity: 'warning',
          source: 'ai_suggested',
        })
      }

      for (const tag of result.suggested.tags || []) {
        await supabaseAdmin.from('mil_asset_tags').insert({
          asset_id: assetId,
          tag_slug: String(tag).toLowerCase().replace(/\s+/g, '-').slice(0, 80),
          source: 'ai_suggested',
        })
      }

      await supabaseAdmin.from('mil_assets').update({
        processing_status: 'analyzed',
        privacy_status: 'needs_review',
      }).eq('id', assetId)

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'ai_analysis',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { provider: PROVIDER, model: result.model, prompt_version: PROMPT_VERSION },
      })

      return json({ ok: true, advisory: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'failed',
        suggested: {},
        error_message: message.slice(0, 500),
      })
      await supabaseAdmin.from('mil_assets').update({ processing_status: 'processing_failed' }).eq('id', assetId)
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'ai_analysis_failure',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { message: message.slice(0, 200) },
      })
      return json({ error: message }, 500)
    }
  } catch (error) {
    console.error('media-intel-analyze', error)
    return json({ error: error instanceof Error ? error.message : 'Analysis failed' }, 500)
  }
})
