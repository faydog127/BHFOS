/**
 * AI suggestion adapter for MIL assets (single-company). AI only ever suggests;
 * humans verify (see mil_verified_metadata / mil_verify_asset). This function
 * never fabricates a result for content it cannot actually analyze.
 *
 * Job consumer note: upload finalize often inserts `mil_processing_jobs` with
 * status 'queued', but there is no background worker draining that queue. This
 * function IS the worker, invoke-on-demand only. The client (`queueAiAnalysis`)
 * must NOT insert jobs or update asset processing_status (RLS is SELECT-only on
 * jobs); it only awaits this edge. Here we claim an existing queued job, or
 * insert a new queued row via service_role (reanalyze / missing job), then run
 * analysis. If never invoked, a finalize-created job stays 'queued' forever —
 * that reflects the real architecture, not a fake background-worker claim.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilStaff } from '../_shared/milRoles.ts'

const PROMPT_VERSION = 'mil-v2-lifecycle'
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
// Field HEIC/JPEG often exceeds 2 MB; default raised for staging usefulness.
const MAX_AI_SAFE_IMAGE_BYTES = envInt('MIL_MAX_AI_IMAGE_BYTES', 8 * 1024 * 1024)

function isServiceRoleRequest(req: Request) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const internal = req.headers.get('x-mil-internal-analyze') === '1'
  return Boolean(internal && token && serviceKey && token === serviceKey)
}

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
  usability?: string
  needs_human_review?: boolean
  lifecycle_recommendation?: string
  quality_issues?: string[]
  lifecycle_rationale?: string
  quality?: Record<string, { suitable?: boolean; score?: number; explanation?: string }>
}

const LIFECYCLE_RECS = new Set(['keep', 'keep_internal', 'archive', 'trash', 'human_review'])
const QUALITY_ISSUES = new Set([
  'blurry', 'too_dark', 'duplicate', 'badly_framed', 'obstructed_view',
  'accidental', 'unrelated', 'overexposed', 'low_resolution',
])

function normalizeLifecycleRecommendation(raw: unknown): string | undefined {
  const v = String(raw ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (LIFECYCLE_RECS.has(v)) return v
  if (v === 'keep_for_internal' || v === 'internal' || v === 'report_use') return 'keep_internal'
  if (v === 'review' || v === 'needs_review') return 'human_review'
  return undefined
}

function normalizeQualityIssues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const v = String(item ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_')
    if (QUALITY_ISSUES.has(v) && !out.includes(v)) out.push(v)
  }
  return out.slice(0, 12)
}

function deriveLifecycleRecommendation(usability?: string, issues: string[] = [], needsReview?: boolean): string {
  const u = String(usability || '').toLowerCase()
  if (needsReview || u === 'unknown') return 'human_review'
  if (u === 'unusable' || issues.includes('unrelated') || issues.includes('accidental')) return 'trash'
  if (
    u === 'poor' ||
    issues.some((i) => ['blurry', 'too_dark', 'badly_framed', 'duplicate', 'obstructed_view'].includes(i))
  ) {
    return 'archive'
  }
  if (u === 'limited') return 'keep_internal'
  if (u === 'good' || u === 'usable') return 'keep'
  return 'human_review'
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, 24)
}

/** Normalize / reject malformed model JSON before persistence. */
export function validateSuggested(raw: unknown): { ok: true; suggested: Suggested; confidence: number } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'AI response was not a JSON object' }
  }
  const s = raw as Record<string, unknown>
  const narrative = String(s.narrative || s.explanation || '').trim()
  if (!narrative && !String(s.service_category || '').trim() && !asStringArray(s.tags).length) {
    return { ok: false, error: 'AI response missing usable description/classification' }
  }
  const qualityIn = s.quality && typeof s.quality === 'object' && !Array.isArray(s.quality)
    ? s.quality as Record<string, unknown>
    : {}
  const quality: Suggested['quality'] = {}
  for (const [key, row] of Object.entries(qualityIn).slice(0, 16)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const q = row as Record<string, unknown>
    quality[key] = {
      suitable: typeof q.suitable === 'boolean' ? q.suitable : undefined,
      score: typeof q.score === 'number' && Number.isFinite(q.score) ? q.score : undefined,
      explanation: q.explanation != null ? String(q.explanation).slice(0, 500) : undefined,
    }
  }
  const suggested: Suggested = {
    media_type: s.media_type != null ? String(s.media_type).slice(0, 80) : undefined,
    service_category: s.service_category != null ? String(s.service_category).slice(0, 120) : undefined,
    work_phase: s.work_phase != null ? String(s.work_phase).slice(0, 80) : undefined,
    condition_notes: s.condition_notes != null ? String(s.condition_notes).slice(0, 2000) : undefined,
    location_component: s.location_component != null ? String(s.location_component).slice(0, 120) : undefined,
    tags: asStringArray(s.tags).map((t) => t.slice(0, 80)),
    narrative: narrative.slice(0, 4000) || undefined,
    public_caption: s.public_caption != null ? String(s.public_caption).slice(0, 500) : undefined,
    alt_text: s.alt_text != null ? String(s.alt_text).slice(0, 500) : undefined,
    privacy_risks: asStringArray(s.privacy_risks).map((t) => t.slice(0, 120)),
    recommended_uses: asStringArray(s.recommended_uses).map((t) => t.slice(0, 80)),
    unsuitable_uses: asStringArray(s.unsuitable_uses).map((t) => t.slice(0, 80)),
    explanation: s.explanation != null ? String(s.explanation).slice(0, 2000) : undefined,
    usability: s.usability != null ? String(s.usability).slice(0, 40) : undefined,
    needs_human_review: typeof s.needs_human_review === 'boolean' ? s.needs_human_review : undefined,
    quality_issues: normalizeQualityIssues(s.quality_issues),
    lifecycle_rationale: s.lifecycle_rationale != null ? String(s.lifecycle_rationale).slice(0, 500) : undefined,
    quality,
  }
  const issues = suggested.quality_issues || []
  suggested.lifecycle_recommendation =
    normalizeLifecycleRecommendation(s.lifecycle_recommendation) ||
    deriveLifecycleRecommendation(suggested.usability, issues, suggested.needs_human_review)
  const confidenceRaw = (s as { confidence?: unknown }).confidence
  const confidence = typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.6
  return { ok: true, suggested, confidence }
}

async function analyzeWithOpenAI(imageUrl: string, filename: string) {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new Error('NO_AI_KEY')
  const model = Deno.env.get('MIL_OPENAI_MODEL') || 'gpt-4o-mini'
  const system = `You analyze HVAC dryer-vent and air-duct field media for The Vent Guys (TVG).
Return JSON only. Suggestions are advisory; humans verify.
Never invent customer names, street addresses, or invoice numbers.
Distinguish directly visible observations from uncertain inference.
Flag privacy risks (faces, children, documents, plates, house numbers).`
  const user = `Filename: ${filename}
Produce JSON with keys:
media_type, service_category, work_phase (before|during|after|equipment|unknown),
condition_notes (visible observations only), location_component,
tags (short normalized strings), narrative (plain-language description of what the media shows),
public_caption, alt_text, privacy_risks, recommended_uses, unsuitable_uses,
usability (good|usable|limited|poor|unusable), needs_human_review (boolean),
lifecycle_recommendation (keep|keep_internal|archive|trash|human_review) — advisory only; never delete,
quality_issues (subset of: blurry, too_dark, duplicate, badly_framed, obstructed_view, accidental, unrelated, overexposed, low_resolution),
lifecycle_rationale (short plain-language reason for the recommendation),
explanation, confidence (0-1),
quality (object keyed by homepage_hero, website_service_proof, social_photo, reel_short_video, inspection_report, training, internal_docs;
each value: suitable boolean, score 0-1, explanation).
Recommended/unsuitable uses should answer whether media fits inspection report, customer proof, marketing, social, training, or do not use.
Never instruct permanent deletion of originals; poor photos may still be unique evidence.`
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
  let parsed: unknown = {}
  try {
    parsed = JSON.parse(payload?.choices?.[0]?.message?.content || '{}')
  } catch {
    throw new Error('AI response was not valid JSON')
  }
  const validated = validateSuggested(parsed)
  if (!validated.ok) throw new Error(validated.error)
  return { model, suggested: validated.suggested, confidence: validated.confidence }
}

/** Find the newest queued ai_analyze job for this asset and claim it as running. */
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
 * Ensure a job exists for this invoke: claim an existing queued row, or insert a
 * new queued ai_analyze job via service_role then claim it. Prefer inserting a
 * fresh row for reanalyze (succeeded/cancelled/failed history stays intact).
 */
async function ensureAndClaimJob(assetId: string) {
  const existing = await claimQueuedJob(assetId)
  if (existing) return existing

  const { data: created, error } = await supabaseAdmin
    .from('mil_processing_jobs')
    .insert({
      asset_id: assetId,
      job_type: 'ai_analyze',
      status: 'queued',
    })
    .select('*')
    .single()
  if (error) throw error

  await supabaseAdmin
    .from('mil_processing_jobs')
    .update({ status: 'running', attempts: (created.attempts || 0) + 1 })
    .eq('id', created.id)
  return created
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
    const internalService = isServiceRoleRequest(req)
    let user: { id: string } | null = null
    if (!internalService) {
      const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user: authUser }, error: authError } = await authClient.auth.getUser()
      if (authError || !authUser) return respond({ error: 'Unauthorized' }, 401)
      user = authUser
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'analyze')

    if (action === 'config_status') {
      if (!internalService && !user) return respond({ error: 'Unauthorized' }, 401)
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

    if (!internalService) {
      if (!user || !(await isMilStaff(user.id))) return respond({ error: 'Forbidden' }, 403)
    }
    const actorUserId = user?.id || null

    const assetId = String(body.assetId || '').trim()
    if (!assetId) return respond({ error: 'Missing asset' }, 400)

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) throw assetErr
    if (!asset) return respond({ error: 'Asset not found' }, 404)

    const job = await ensureAndClaimJob(assetId)

    if (asset.archived_at || asset.trashed_at) {
      await settleJob(job?.id || null, 'cancelled', 'skipped_lifecycle: archived_or_trashed')
      return respond({ skipped: true, reason: 'archived_or_trashed' })
    }

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
        actor_user_id: actorUserId,
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
        actor_user_id: actorUserId,
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
        actor_user_id: actorUserId,
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

      // Advisory disposition only — never set archived_at / trashed_at from AI.
      const usability = String(result.suggested.usability || '').toLowerCase()
      const aiUsability = ['good', 'usable', 'limited', 'poor', 'unusable'].includes(usability)
        ? usability
        : 'unknown'
      await supabaseAdmin.from('mil_assets').update({
        processing_status: 'analyzed',
        privacy_status: 'needs_review',
        ai_lifecycle_recommendation: result.suggested.lifecycle_recommendation || null,
        ai_quality_issues: result.suggested.quality_issues || [],
        ai_usability: aiUsability,
      }).eq('id', assetId)

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: actorUserId,
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
        actor_user_id: actorUserId,
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
