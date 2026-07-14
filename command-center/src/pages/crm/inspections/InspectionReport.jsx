import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { Button } from '@/components/ui/button';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const leadAddress = (lead) => {
  if (!lead) return '';
  const direct = asText(lead.address) || asText(lead.service_address);
  if (direct) return direct;
  const cityLine = [asText(lead.city), asText(lead.state), asText(lead.zip)].filter(Boolean).join(' ');
  return [asText(lead.address1), asText(lead.address2), cityLine].filter(Boolean).join(', ');
};

export default function InspectionReport() {
  const tenantId = getTenantId();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [inspection, setInspection] = useState(null);
  const [findings, setFindings] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [photos, setPhotos] = useState([]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: parent, error: parentError } = await supabase
        .from('inspections')
        .select(`
          *,
          lead:leads(*),
          job:jobs(id, work_order_number, job_number, service_address),
          technician:technicians(id, full_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent) throw new Error('Inspection report not found.');

      const [findingResult, recommendationResult, photoResult] = await Promise.all([
        supabase.from('inspection_findings').select('*').eq('tenant_id', tenantId).eq('inspection_id', id).eq('is_customer_visible', true).order('sort_order'),
        supabase.from('inspection_recommendations').select('*').eq('tenant_id', tenantId).eq('inspection_id', id).eq('is_customer_visible', true).order('created_at'),
        supabase.from('inspection_photos').select('*').eq('tenant_id', tenantId).eq('inspection_id', id).eq('is_voided', false).eq('upload_state', 'complete').order('uploaded_at'),
      ]);
      if (findingResult.error) throw findingResult.error;
      if (recommendationResult.error) throw recommendationResult.error;
      if (photoResult.error) throw photoResult.error;

      const photoRows = await Promise.all((photoResult.data || []).map(async (photo) => {
        const { data } = await supabase.storage.from(photo.bucket_id || 'inspection-photos').createSignedUrl(photo.object_path, 60 * 60);
        return { ...photo, signed_url: data?.signedUrl || null };
      }));

      setInspection({
        ...parent,
        lead: Array.isArray(parent.lead) ? parent.lead[0] : parent.lead,
        job: Array.isArray(parent.job) ? parent.job[0] : parent.job,
        technician: Array.isArray(parent.technician) ? parent.technician[0] : parent.technician,
      });
      setFindings(findingResult.data || []);
      setRecommendations(recommendationResult.data || []);
      setPhotos(photoRows);
    } catch (loadError) {
      console.error('Failed to load inspection report:', loadError);
      setError(loadError?.message || 'The inspection report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    loadReport();
  }, [loadReport, reloadToken]);

  const customerName = useMemo(() => {
    const lead = inspection?.lead || {};
    return asText(lead.company) || [asText(lead.first_name), asText(lead.last_name)].filter(Boolean).join(' ') || asText(lead.email) || 'Customer';
  }, [inspection]);

  const address = asText(inspection?.service_address) || asText(inspection?.job?.service_address) || leadAddress(inspection?.lead) || 'Not recorded';
  const activePhotos = photos.slice(0, 24);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading report...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <h1 className="text-xl font-bold text-red-900">Report unavailable</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 print:max-w-none print:space-y-0">
      <Helmet><title>Inspection Report | The Vent Guys</title></Helmet>
      <style>{`@media print { body { background: white !important; } .inspection-report { box-shadow: none !important; border: 0 !important; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" asChild><Link to={`/${tenantId}/crm/inspections/${id}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to inspection</Link></Button>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button>
      </div>

      <article className="inspection-report overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-[#091e39] px-6 py-6 text-white sm:px-10">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">The Vent Guys</div>
              <h1 className="mt-2 text-3xl font-bold">Inspection Report</h1>
              <p className="mt-2 text-sm text-white/80">Professional findings and recommendations for your residence</p>
            </div>
            <img src="/assets/branding/logo-secondary-lockup.png" alt="The Vent Guys" className="h-16 max-w-44 object-contain" />
          </div>
        </header>
        <div className="h-1 bg-[#b52025]" />

        <div className="space-y-8 p-6 sm:p-10">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Customer', customerName],
              ['Service address', address],
              ['Inspection date', formatDate(inspection?.completed_at || inspection?.started_at || inspection?.created_at)],
              ['Technician', asText(inspection?.technician?.full_name) || 'The Vent Guys Technician'],
              ['Service type', asText(inspection?.service_type) || asText(inspection?.title) || 'Inspection'],
              ['Work order', asText(inspection?.job?.work_order_number) || asText(inspection?.job?.job_number) || 'Unlinked'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
              </div>
            ))}
          </section>

          {inspection?.summary ? <section><h2 className="text-lg font-bold text-slate-900">Inspection summary</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{inspection.summary}</p></section> : null}

          <section>
            <h2 className="text-lg font-bold text-slate-900">Findings</h2>
            <div className="mt-3 space-y-4">
              {findings.length ? findings.map((finding) => (
                <div key={finding.id} className="break-inside-avoid rounded-xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{finding.title}</h3><span className="text-xs uppercase text-slate-500">{[finding.severity, finding.category?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</span></div>
                  {finding.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{finding.description}</p> : null}
                  {finding.recommended_action ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Recommended:</strong> {finding.recommended_action}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-500">No findings recorded.</p>}
            </div>
          </section>

          {activePhotos.length ? <section><h2 className="text-lg font-bold text-slate-900">Photo evidence</h2><div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{activePhotos.map((photo) => <figure key={photo.id} className="break-inside-avoid overflow-hidden rounded-xl border border-slate-200">{photo.signed_url ? <img src={photo.signed_url} alt={photo.caption || photo.file_name || 'Inspection photo'} className="h-56 w-full object-cover" /> : <div className="flex h-56 items-center justify-center bg-slate-100 text-sm text-slate-500">Image unavailable</div>}<figcaption className="p-3 text-sm text-slate-700">{photo.caption || photo.file_name || 'Inspection photo'}</figcaption></figure>)}</div></section> : null}

          <section><h2 className="text-lg font-bold text-slate-900">Recommendations</h2><div className="mt-3 space-y-3">{recommendations.length ? recommendations.map((recommendation) => <div key={recommendation.id} className="break-inside-avoid rounded-xl border border-slate-200 p-4"><div className="font-semibold text-slate-900">{recommendation.title}</div>{recommendation.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{recommendation.description}</p> : null}</div>) : <p className="text-sm text-slate-500">No recommendations recorded.</p>}</div></section>

          {(inspection?.limitations_notes || inspection?.disclaimer_text) ? <section className="rounded-xl bg-slate-50 p-5"><h2 className="text-sm font-bold text-slate-900">Limitations and notes</h2>{inspection?.limitations_notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{inspection.limitations_notes}</p> : null}{inspection?.disclaimer_text ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{inspection.disclaimer_text}</p> : null}</section> : null}

          <section className="border-t border-slate-200 pt-5 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Customer acknowledgment</div>
            {inspection?.customer_acknowledged_at ? <p className="mt-1">Acknowledged by {inspection.customer_acknowledged_name || customerName} on {formatDate(inspection.customer_acknowledged_at)}.</p> : <p className="mt-1 text-slate-500">Customer acknowledgment was not recorded.</p>}
          </section>
        </div>
      </article>
    </div>
  );
}
