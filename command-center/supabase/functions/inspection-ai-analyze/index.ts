import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { analyzeInspectionPhoto, TIS_INSPECTION_PROMPT_VERSION } from '../_shared/tisInspectionAi.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
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
    const tenantId = String(user.app_metadata?.tenant_id || user.user_metadata?.tenant_id || '').trim()
    const body = await req.json()
    const inspectionId = body.inspection_id
    const requestedPhotoId = String(body.photo_id || '').trim()
    const retry = body.retry === true
    if (!tenantId || !inspectionId) return json({ error: 'Missing tenant or inspection' }, 400)

    const { data: inspection } = await supabaseAdmin.from('inspections')
      .select('id, tenant_id, revision, summary').eq('id', inspectionId).eq('tenant_id', tenantId).maybeSingle()
    if (!inspection) return json({ error: 'Inspection not found' }, 404)

    let photoQuery = supabaseAdmin.from('inspection_photos')
      .select('id, bucket_id, object_path, caption, content_type').eq('tenant_id', tenantId).eq('inspection_id', inspectionId)
      .eq('is_voided', false).eq('upload_state', 'complete')
    if (requestedPhotoId) photoQuery = photoQuery.eq('id', requestedPhotoId)
    const { data: photos, error: photoError } = await photoQuery
    if (photoError) throw photoError
    if (!photos?.length) return json({ error: 'No completed photos to analyze' }, 400)

    await supabaseAdmin.from('inspection_events').insert({
      tenant_id: tenantId, inspection_id: inspectionId, event_type: 'ai_photo_analysis_started',
      actor_user_id: user.id, inspection_revision: inspection.revision,
      metadata: { photos_count: photos.length, prompt_version: TIS_INSPECTION_PROMPT_VERSION },
    })

    let created = 0
    for (const photo of photos) {
      const existing = await supabaseAdmin.from('inspection_ai_suggestions').select('id, status, suggestion_version')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', inspection.revision)
        .eq('photo_id', photo.id).order('suggestion_version', { ascending: false })
      const existingRows = existing.data || []
      if (existingRows.some((row) => row.status === 'pending')) continue
      if (existingRows.length && !retry) continue
      const suggestionVersion = existingRows.reduce((max, row) => Math.max(max, Number(row.suggestion_version || 1)), 0) + 1
      const { data: image, error: imageError } = await supabaseAdmin.storage
        .from(photo.bucket_id || 'inspection-photos').download(photo.object_path)
      if (imageError || !image) throw imageError || new Error('Could not access private photo')
      const bytes = new Uint8Array(await image.arrayBuffer())
      const imageUrl = `data:${photo.content_type || 'image/jpeg'};base64,${toBase64(bytes)}`
      const result = await analyzeInspectionPhoto({ imageUrl, caption: photo.caption, notes: inspection.summary })
      const rows = [
        { suggestion_type: 'finding', content: result.finding },
        { suggestion_type: 'report_narrative', content: { narrative: result.narrative } },
      ].filter((row) => row.content && typeof row.content === 'object')
      const { error } = await supabaseAdmin.from('inspection_ai_suggestions').insert(rows.map((row) => ({
        tenant_id: tenantId, inspection_id: inspectionId, inspection_revision: inspection.revision,
        photo_id: photo.id, suggestion_version: suggestionVersion, model: result.model,
        prompt_version: TIS_INSPECTION_PROMPT_VERSION, ...row,
      })))
      if (error) throw error
      created += rows.length
    }
    await supabaseAdmin.from('inspection_events').insert({
      tenant_id: tenantId, inspection_id: inspectionId, event_type: 'ai_photo_analysis_completed',
      actor_user_id: user.id, inspection_revision: inspection.revision, metadata: { suggestions_created: created, prompt_version: TIS_INSPECTION_PROMPT_VERSION },
    })
    return json({ created, advisory: true, photo_id: requestedPhotoId || null, retry })
  } catch (error) {
    console.error('inspection-ai-analyze', error)
    return json({ error: error instanceof Error ? error.message : 'Analysis failed' }, 500)
  }
})
