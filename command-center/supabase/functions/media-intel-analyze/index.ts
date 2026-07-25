/**
 * AI suggestion adapter for MIL assets (single-company). AI only ever suggests;
 * humans verify (see mil_verified_metadata / mil_verify_asset). This function
 * never fabricates a result for content it cannot actually analyze.
 *
 * Job consumer note: `mil_processing_jobs` rows are created with status
 * 'queued' whenever an upload finalizes (phone session or staff upload) — but
 * there is no background worker draining that queue. This function IS the
 * worker, and it is invoke-on-demand only: the client (`queueAiAnalysis` in
 * `src/lib/mediaIntel/api.js`) inserts the queued job row and then calls this
 * function directly. If this function is never invoked for a given asset, its
 * job row honestly stays 'queued' forever — that reflects the real
 * architecture and is not hidden behind a fake background-worker claim.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilStaff } from '../_shared/milRoles.ts'

const PROMPT_VERSION = 'mil-v1'
const PROVIDER = 'openai'

// No sharp/imagemagick (or any resize pipeline) is available in this Deno edge
// runtime. Rather than base64-truncate raw bytes (which produces an invalid,
// corrupt image and risks OpenAI silently "succeeding" on garbage input), we
// only ever send the AI provider a complete, valid image — and only when it
// is at or under this byte cap. Larger originals are skipped honestly.
function envInt(name: string, fallback: number) {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
const MAX_AI_SAFE_IMAGE_BYTES = envInt('MIL_MAX_AI_IMAGE_BYTES', 2 * 1024 * 1024)

const json = (headers: Record<string, string>, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

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

/** Find the queued ai_analyze job for this asset, if any, and claim it as running. */
async function claimQueuedJob(assetId: string) {
  const { data: job } = await supabaseAdmin
    .from('mil_processing_jobs')
    .select('*')
    .eq('asset_id', assetId)
    .eq('job_type', 'ai_analyze')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!job) return null
  await supabaseAdmin
    .from('mil_processing_jobs')
    .update({ status: 'running', attempts: (job.attempts || 0) + 1 })
    .eq('id', job.id)
  return job
}

/**
 * mil_processing_jobs.status only allows queued|running|succeeded|failed|cancelled —
 * there is no 'skipped' state. Honest skips (no key, duplicate, unsupported media,
 * over the AI-safe size cap) are recorded as 'cancelled' with last_error explaining why,
 * never as 'succeeded'.
 */
async function settleJob(jobId: string | null, status: 'succeeded' | 'failed' | 'cancelled', lastError?: string) {
  if (!jobId) return
  await supabaseAdmin
    .from('mil_processing_jobs')
    .update({ status, last_error: lastError || null })
    .eq('id', jobId)
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const respond = (body: unknown, status = 200) => json(cors, body, status)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return respond({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'analyze')

    if (action === 'config_status') {
      const configured = Boolean(Deno.env.get('OPENAI_API_KEY'))
      return respond({
        configured,
        provider: configured ? PROVIDER : null,
        prompt_version: PROMPT_VERSION,
        message: configured
          ? 'AI analysis is configured.'
          : 'AI key not configured. Uploads and manual review still work. Analysis records skipped_no_key until a key is set.',
      })
    }

    if (!(await isMilStaff(user.id))) return respond({ error: 'Forbidden' }, 403)

    const assetId = String(body.assetId || '').trim()
    if (!assetId) return respond({ error: 'Missing asset' }, 400)

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) throw assetErr
    if (!asset) return respond({ error: 'Asset not found' }, 404)

    const job = await claimQueuedJob(assetId)

    if (asset.exclude_from_ai) {
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'skipped_duplicate',
        suggested: {},
        explanation: 'Excluded from AI reprocessing',
      })
      await settleJob(job?.id || null, 'cancelled', 'skipped_duplicate: exclude_from_ai')
      return respond({ skipped: true, reason: 'exclude_from_ai' })
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
      await settleJob(job?.id || null, 'cancelled', 'skipped_no_key: OPENAI_API_KEY not configured')
      return respond({ configured: false, status: 'skipped_no_key' })
    }

    // Video: honestly report no AI analysis was performed. Do NOT mark this
    // "succeeded" — a video frame/transcript analysis pipeline is not built.
    if (asset.media_kind !== 'photo') {
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'skipped_unsupported',
        suggested: {},
        explanation: 'Video analysis is not implemented (awaiting_video_support). No AI analysis was performed; human review is required.',
      })
      await supabaseAdmin.from('mil_assets').update({ processing_status: 'uploaded' }).eq('id', assetId)
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'ai_analysis_skipped_unsupported',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { mediaKind: asset.media_kind, reason: 'awaiting_video_support' },
      })
      await settleJob(job?.id || null, 'cancelled', 'skipped_unsupported: awaiting_video_support')
      return respond({ ok: true, skipped: true, status: 'skipped_unsupported', reason: 'awaiting_video_support' })
    }

    // Bounded download: only fetch bytes once we know (from the verified
    // mil_assets.byte_size recorded at upload finalize) that the original is
    // within the AI-safe cap. This avoids downloading large originals just to
    // discover they must be skipped, and it never sends a truncated/corrupt image.
    const knownBytes = Number(asset.byte_size || 0)
    if (knownBytes > MAX_AI_SAFE_IMAGE_BYTES) {
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'skipped_needs_ai_safe_derivative',
        suggested: {},
        explanation: `Original is ${knownBytes} bytes, over the ${MAX_AI_SAFE_IMAGE_BYTES}-byte AI-safe cap. No resize pipeline (sharp/imagemagick) is available in this Deno runtime, so the full original is never truncated and sent as-is. Generate a real ai_safe derivative first, or raise MIL_MAX_AI_IMAGE_BYTES only after verifying provider limits.`,
      })
      await supabaseAdmin.from('mil_assets').update({ processing_status: 'uploaded' }).eq('id', assetId)
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'ai_analysis_skipped_needs_derivative',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { byteSize: knownBytes, cap: MAX_AI_SAFE_IMAGE_BYTES },
      })
      await settleJob(job?.id || null, 'cancelled', 'skipped_needs_ai_safe_derivative')
      return respond({ ok: true, skipped: true, status: 'skipped_needs_ai_safe_derivative' })
    }

    const { data: image, error: imageError } = await supabaseAdmin.storage
      .from(asset.original_bucket || 'media-intel-originals')
      .download(asset.original_path)
    if (imageError || !image) throw imageError || new Error('Could not download original')

    const bytes = new Uint8Array(await image.arrayBuffer())
    if (bytes.byteLength > MAX_AI_SAFE_IMAGE_BYTES) {
      // Defensive re-check: stored bytes disagree with mil_assets.byte_size. Skip
      // honestly rather than sending a possibly-oversized payload to the provider.
      await supabaseAdmin.from('mil_ai_analyses').insert({
        asset_id: assetId,
        provider: PROVIDER,
        prompt_version: PROMPT_VERSION,
        status: 'skipped_needs_ai_safe_derivative',
        suggested: {},
        explanation: `Downloaded object is ${bytes.byteLength} bytes, over the ${MAX_AI_SAFE_IMAGE_BYTES}-byte AI-safe cap (mil_assets.byte_size disagreed with stored object size).`,
      })
      await supabaseAdmin.from('mil_assets').update({ processing_status: 'uploaded' }).eq('id', assetId)
      await settleJob(job?.id || null, 'cancelled', 'skipped_needs_ai_safe_derivative: size mismatch')
      return respond({ ok: true, skipped: true, status: 'skipped_needs_ai_safe_derivative' })
    }
    // Private media is sent to a third-party AI provider (OpenAI) for suggestion
    // generation only — humans verify before anything is published. This is a
    // full, untruncated, valid image (never a byte-sliced fragment).
    const imageUrl = `data:${asset.mime_type || 'image/jpeg'};base64,${toBase64(bytes)}`

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

      await settleJob(job?.id || null, 'succeeded')
      return respond({ ok: true, advisory: true })
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
      await settleJob(job?.id || null, 'failed', message.slice(0, 500))
      return respond({ error: message }, 500)
    }
  } catch (error) {
    console.error('media-intel-analyze', error instanceof Error ? error.message : error)
    return respond({ error: error instanceof Error ? error.message : 'Analysis failed' }, 500)
  }
})
