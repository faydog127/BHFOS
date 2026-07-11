import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const base64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  let deliveryId: string | null = null
  try {
    const authorization = req.headers.get('Authorization') || ''
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)
    const tenantId = String(user.app_metadata?.tenant_id || user.user_metadata?.tenant_id || '').trim()
    const body = await req.json()
    const inspectionId = String(body.inspection_id || '').trim()
    const intentionalResend = body.intentional_resend === true
    const resendReason = String(body.resend_reason || '').trim()
    if (!tenantId || !inspectionId) return json({ error: 'Missing inspection' }, 400)
    if (intentionalResend && !resendReason) return json({ error: 'A resend reason is required.', code: 'RESEND_REASON_REQUIRED' }, 400)

    const { data: inspection } = await supabaseAdmin.from('inspections')
      .select('id, revision, reviewed_at, reviewed_revision, lead_id, title')
      .eq('tenant_id', tenantId).eq('id', inspectionId).maybeSingle()
    if (!inspection) return json({ error: 'Inspection not found' }, 404)
    if (!inspection.reviewed_at || inspection.reviewed_revision !== inspection.revision) {
      return json({ error: 'The current inspection report revision must be reviewed before sending.', code: 'INSPECTION_REPORT_NOT_REVIEWED' }, 409)
    }
    const { data: lead } = inspection.lead_id
      ? await supabaseAdmin.from('leads').select('email, first_name, last_name, company').eq('id', inspection.lead_id).eq('tenant_id', tenantId).maybeSingle()
      : { data: null }
    const recipient = String(body.to_email || lead?.email || '').trim().toLowerCase()
    if (!recipient) return json({ error: 'Recipient email is required', code: 'RECIPIENT_REQUIRED' }, 400)

    let { data: report } = await supabaseAdmin.from('inspection_reports').select('*')
      .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', inspection.revision)
      .in('status', ['generated', 'sent']).order('report_version', { ascending: false }).limit(1).maybeSingle()
    if (!report) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
      const generatedResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/inspection-report-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: authorization },
        body: JSON.stringify({ tenant_id: tenantId, inspection_id: inspectionId, store: true, return_pdf: false }),
      })
      const generated = await generatedResponse.json().catch(() => ({}))
      if (!generatedResponse.ok || generated?.error) return json({ error: generated?.error || 'Report generation failed', code: 'REPORT_GENERATION_FAILED' }, 500)
      const latest = await supabaseAdmin.from('inspection_reports').select('*')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', inspection.revision)
        .in('status', ['generated', 'sent']).order('report_version', { ascending: false }).limit(1).maybeSingle()
      report = latest.data
    }
    if (!report?.id || !report.file_path) return json({ error: 'Reviewed report artifact is unavailable', code: 'REPORT_NOT_AVAILABLE' }, 409)

    const baseKey = `report-only:${report.id}:${recipient}`
    const key = intentionalResend ? `${baseKey}:resend:${crypto.randomUUID()}` : baseKey
    const existing = await supabaseAdmin.from('inspection_report_deliveries').select('*')
      .eq('tenant_id', tenantId).eq('idempotency_key', key).maybeSingle()
    if (existing.data?.status === 'sent') return json({ success: true, skipped: true, reason: 'duplicate_delivery', delivery_id: existing.data.id })
    if (existing.data?.id) {
      deliveryId = existing.data.id
      await supabaseAdmin.from('inspection_report_deliveries').update({ status: 'pending', error_message: null }).eq('id', deliveryId)
    } else {
      const inserted = await supabaseAdmin.from('inspection_report_deliveries').insert({
        tenant_id: tenantId, inspection_id: inspectionId, inspection_report_id: report.id,
        delivery_kind: 'report_only', recipient, idempotency_key: key, requested_by_user_id: user.id,
      }).select('id').single()
      if (inserted.error) throw inserted.error
      deliveryId = inserted.data.id
    }

    const downloaded = await supabaseAdmin.storage.from('inspection-reports').download(report.file_path)
    if (downloaded.error || !downloaded.data) throw downloaded.error || new Error('Report download failed')
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
    const customer = String(lead?.company || `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim() || 'Customer')
    const provider = await sendEmail({
      from: 'The Vent Guys Reports <quotes@vent-guys.com>', to: [recipient],
      subject: 'Your reviewed inspection report',
      html: `<p>Hi ${customer},</p><p>Your reviewed inspection report is attached.</p>`,
      attachments: [{ filename: `inspection-report-${inspectionId}.pdf`, content: base64(bytes), content_type: 'application/pdf' }],
      tags: [{ name: 'inspection_id', value: inspectionId }, { name: 'tenant_id', value: tenantId }],
    })
    const sentAt = new Date().toISOString()
    await supabaseAdmin.from('inspection_report_deliveries').update({
      status: 'sent', provider_id: provider?.id ? String(provider.id) : null, sent_at: sentAt,
    }).eq('id', deliveryId)
    await supabaseAdmin.from('inspection_reports').update({
      status: 'sent', sent_at: sentAt, sent_by: user.id, sent_method: 'email', sent_to: recipient,
    }).eq('id', report.id)
    await supabaseAdmin.from('inspection_events').insert({
      tenant_id: tenantId, inspection_id: inspectionId,
      event_type: intentionalResend ? 'inspection_report_resent' : 'inspection_report_sent', actor_user_id: user.id,
      inspection_revision: inspection.revision, metadata: { delivery_id: deliveryId, report_id: report.id, recipient, resend_reason: intentionalResend ? resendReason : null },
    })
    return json({ success: true, delivery_id: deliveryId, report_id: report.id })
  } catch (error) {
    if (deliveryId) await supabaseAdmin.from('inspection_report_deliveries').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Delivery failed' }).eq('id', deliveryId)
    return json({ error: error instanceof Error ? error.message : 'Delivery failed', code: 'REPORT_DELIVERY_FAILED' }, 500)
  }
})
