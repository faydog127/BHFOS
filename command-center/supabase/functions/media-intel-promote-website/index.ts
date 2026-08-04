/**
 * Explicit owner/admin website promotion (single-company).
 *
 * prepare_public_safe / promote remain DISABLED (503).
 * unpublish uses mil_unpublish_website_audited (mutation + audit one TX);
 * storage / website_media cleanup happen after the durable DB state is recorded.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { persistAccessAudit } from '../_shared/milAudit.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilOwnerAdmin } from '../_shared/milRoles.ts'
import {
  newCorrelationId,
  PUBLIC_ERROR_CATALOG,
  redactErrorForClient,
} from '../_shared/milSafeErrors.ts'

// prepare_public_safe / promote remain disabled until a proven decode → re-encode →
// strip pipeline exists. Client responses must not reveal storage topology.

/** Remove JPEG APP0–APP15 segments (includes EXIF APP1 / XMP). Kept for future re-enablement only — NOT wired below. */
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
void stripJpegExif

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const correlationId = req.headers.get('x-correlation-id') || newCorrelationId()

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ ...body, correlationId }), {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'x-correlation-id': correlationId,
      },
    })

  const deny = (code: string, status = 403, extra: Record<string, unknown> = {}) => {
    const pub = PUBLIC_ERROR_CATALOG[code] ? code : 'INTERNAL_ERROR'
    return json({ error: PUBLIC_ERROR_CATALOG[pub], code: pub, ...extra }, status)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return deny('SIGN_IN_REQUIRED', 401)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'promote')
    const assetId = String(body.assetId || '').trim()

    if (!(await isMilOwnerAdmin(user.id))) {
      return deny('MEDIA_ACCESS_DENIED', 403)
    }

    if (action === 'prepare_public_safe' || action === 'promote') {
      if (!assetId) return deny('INVALID_REQUEST', 400)
      // No business mutation — advisory access audit only.
      await persistAccessAudit({
        actorUserId: user.id,
        action: 'website_promotion_attempt_blocked',
        targetType: 'mil_assets',
        targetId: assetId,
        details: { action, reason: 'public_safe_transform_not_implemented', correlationId },
      })
      // Catalog-only 503 — never expose storage topology or pipeline internals to clients.
      return deny('PUBLIC_PROMOTION_UNAVAILABLE', 503)
    }

    if (action === 'unpublish') {
      if (!assetId) return deny('INVALID_REQUEST', 400)

      const { data: unpublished, error: unpubErr } = await supabaseAdmin.rpc(
        'mil_unpublish_website_audited',
        {
          p_actor_id: user.id,
          p_asset_id: assetId,
          p_details: { correlationId },
          p_idempotency_key: `website_unpublish:${assetId}:${user.id}`,
        },
      )
      if (unpubErr) {
        const msg = String(unpubErr.message || '')
        if (/No active website promotion/i.test(msg)) return deny('MEDIA_NOT_AVAILABLE', 404)
        throw unpubErr
      }
      const payload = unpublished as {
        ok?: boolean
        cleanup?: Array<{ promotionId?: string; derivativeId?: string; websiteMediaId?: string }>
      }
      if (!payload?.ok) return deny('INTERNAL_ERROR', 500)

      const results: Array<{ promotionId: string; ok: boolean }> = []
      for (const item of payload.cleanup || []) {
        const promotionId = String(item.promotionId || '')
        try {
          if (item.websiteMediaId) {
            await supabaseAdmin
              .from('website_media')
              .update({ display_status: 'unavailable' })
              .eq('id', item.websiteMediaId)
          }
          if (item.derivativeId) {
            const { data: der } = await supabaseAdmin
              .from('mil_derivatives')
              .select('bucket, object_path')
              .eq('id', item.derivativeId)
              .maybeSingle()
            if (der && der.bucket === 'website-public-media') {
              await supabaseAdmin.storage.from(der.bucket).remove([der.object_path]).catch(() => {})
            }
          }
          results.push({ promotionId, ok: true })
        } catch (err) {
          console.error('media-intel-promote-website cleanup', { correlationId, err })
          results.push({ promotionId, ok: false })
        }
      }

      return json({ ok: true, results, durableUnpublish: true })
    }

    return deny('INVALID_REQUEST', 400)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('media-intel-promote-website', { correlationId, msg })
    const redacted = redactErrorForClient(error, { correlationId, fallbackCode: 'INTERNAL_ERROR' })
    return json({ error: redacted.error, code: redacted.code }, 500)
  }
})
