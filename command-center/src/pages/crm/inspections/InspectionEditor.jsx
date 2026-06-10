import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Camera, Plus, Save, CheckCircle2, FileDown, Link2, Trash2 } from 'lucide-react';

const BUCKET_ID = 'inspection-photos';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeStatus = (value) => asText(value).toLowerCase();
const statusLabel = (value) => {
  const s = normalizeStatus(value);
  if (!s) return 'draft';
  if (s === 'in_progress') return 'draft';
  return s;
};

const sanitizeFilename = (name) =>
  asText(name)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'photo';

const downloadFromBase64 = (payload, fallbackName) => {
  const raw = String(payload?.content_base64 || payload?.content || '').trim();
  if (!raw) throw new Error('PDF was not returned.');

  let base64 = raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], { type: payload?.content_type || payload?.contentType || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload?.filename || fallbackName || 'inspection-report.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export default function InspectionEditor({ forceNew = false } = {}) {
  const tenantId = getTenantId();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();

  const isNew = forceNew || id === 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [findings, setFindings] = useState([]);
  const [recs, setRecs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const photoUrlCacheRef = useRef(new Map());

  // Draft inputs (new inspection)
  const [draftLeadId, setDraftLeadId] = useState('');
  const [draftJobId, setDraftJobId] = useState('unlinked');
  const [draftTechnicianId, setDraftTechnicianId] = useState('unassigned');
  const [draftTitle, setDraftTitle] = useState('');

  const [summary, setSummary] = useState('');
  const [disclaimer, setDisclaimer] = useState(
    'This report reflects visible conditions at the time of inspection. Hidden conditions may exist. Work is performed per customer authorization and applicable safety standards.'
  );

  const [newFinding, setNewFinding] = useState({
    title: '',
    severity: 'medium',
    category: 'general',
    description: '',
    recommended_action: '',
    is_customer_visible: true,
  });

  const [newRec, setNewRec] = useState({
    title: '',
    priority: 'normal',
    description: '',
    suggested_quantity: '',
    suggested_unit_price: '',
    is_customer_visible: true,
  });

  const leadOptions = useMemo(() => {
    return (leads || []).map((lead) => {
      const label =
        lead.company ||
        `${lead.first_name || ''} ${lead.last_name || ''}`.trim() ||
        lead.email ||
        String(lead.id).slice(0, 8);
      return { id: lead.id, label };
    });
  }, [leads]);

  const jobOptions = useMemo(() => {
    return (jobs || []).map((job) => {
      const label = [
        job.work_order_number || job.job_number || String(job.id).slice(0, 8),
        job.service_address || '',
      ]
        .filter(Boolean)
        .join(' • ');
      return { id: job.id, label, lead_id: job.lead_id };
    });
  }, [jobs]);

  const technicianOptions = useMemo(
    () => (technicians || []).filter((t) => t && t.is_active !== false),
    [technicians]
  );

  const fetchReferenceData = useCallback(async () => {
    const [leadRes, jobRes, techRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, first_name, last_name, company, email, property_id, contact_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(250),
      supabase
        .from('jobs')
        .select('id, lead_id, work_order_number, job_number, status, service_address, scheduled_start')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(250),
      supabase
        .from('technicians')
        .select('id, user_id, full_name, is_active, is_primary_default')
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
    ]);

    if (leadRes.error) throw leadRes.error;
    if (jobRes.error) throw jobRes.error;
    if (techRes.error) throw techRes.error;

    setLeads(leadRes.data || []);
    setJobs(jobRes.data || []);
    setTechnicians(techRes.data || []);
  }, [tenantId]);

  const hydratePhotoUrls = useCallback(async (rows) => {
    const next = [];
    for (const row of rows) {
      const key = `${row.bucket_id}:${row.object_path}`;
      const cached = photoUrlCacheRef.current.get(key);
      if (cached && cached.expiresAtMs > Date.now() + 10_000) {
        next.push({ ...row, signed_url: cached.url });
        continue;
      }

      try {
        const { data, error } = await supabase.storage
          .from(row.bucket_id || BUCKET_ID)
          .createSignedUrl(row.object_path, 60 * 60);
        if (!error && data?.signedUrl) {
          photoUrlCacheRef.current.set(key, { url: data.signedUrl, expiresAtMs: Date.now() + 55 * 60 * 1000 });
          next.push({ ...row, signed_url: data.signedUrl });
          continue;
        }
      } catch {
        // ignore
      }

      next.push({ ...row, signed_url: null });
    }
    return next;
  }, []);

  const fetchInspection = useCallback(async (inspectionId) => {
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        lead:leads(id, first_name, last_name, company, email, phone, contact_id, property_id),
        job:jobs(id, work_order_number, status, service_address),
        quote:quotes(id, quote_number, status, total_amount, public_token),
        technician:technicians(id, full_name)
      `)
      .eq('tenant_id', tenantId)
      .eq('id', inspectionId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Inspection not found.');

    const normalized = {
      ...data,
      lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
      job: Array.isArray(data.job) ? data.job[0] : data.job,
      quote: Array.isArray(data.quote) ? data.quote[0] : data.quote,
      technician: Array.isArray(data.technician) ? data.technician[0] : data.technician,
    };

    setInspection(normalized);
    setSummary(asText(normalized.summary));
    setDisclaimer(asText(normalized.disclaimer_text) || disclaimer);
  }, [tenantId, disclaimer]);

  const fetchChildRows = useCallback(async (inspectionId) => {
    const [findingRes, recRes, photoRes] = await Promise.all([
      supabase
        .from('inspection_findings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('inspection_recommendations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('inspection_photos')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('uploaded_at', { ascending: true }),
    ]);

    if (findingRes.error) throw findingRes.error;
    if (recRes.error) throw recRes.error;
    if (photoRes.error) throw photoRes.error;

    setFindings(findingRes.data || []);
    setRecs(recRes.data || []);
    const withUrls = await hydratePhotoUrls(photoRes.data || []);
    setPhotos(withUrls);
  }, [tenantId, hydratePhotoUrls]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await fetchReferenceData();
        if (!mounted) return;

        if (isNew) {
          setInspection(null);
          setLoading(false);
          return;
        }

        await fetchInspection(id);
        await fetchChildRows(id);
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Load failed', description: err?.message || 'Could not load inspection.' });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [fetchChildRows, fetchInspection, fetchReferenceData, id, isNew, toast]);

  const createInspection = async () => {
    if (!draftLeadId) {
      toast({ variant: 'destructive', title: 'Missing customer', description: 'Select a lead/customer before creating an inspection.' });
      return;
    }

    setSaving(true);
    try {
      const lead = leads.find((row) => row.id === draftLeadId) || null;
      const jobId = draftJobId && draftJobId !== 'unlinked' ? draftJobId : null;
      const techId = draftTechnicianId && draftTechnicianId !== 'unassigned' ? draftTechnicianId : null;
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('inspections')
        .insert({
          tenant_id: tenantId,
          lead_id: draftLeadId,
          contact_id: lead?.contact_id || null,
          property_id: lead?.property_id || null,
          job_id: jobId,
          technician_id: techId,
          created_by_user_id: user?.id || null,
          status: 'draft',
          title: asText(draftTitle) || null,
          started_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
          disclaimer_text: disclaimer,
        })
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error('Inspection create failed.');

      toast({ title: 'Inspection created', description: 'You can now add findings and photos.', className: 'bg-green-50 border-green-200' });
      navigate(`/${tenantId}/crm/inspections/${data.id}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Create failed', description: err?.message || 'Could not create inspection.' });
    } finally {
      setSaving(false);
    }
  };

  const saveInspectionMeta = async () => {
    if (!inspection?.id) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('inspections')
        .update({
          summary: summary || null,
          disclaimer_text: disclaimer || null,
          updated_at: nowIso,
        })
        .eq('tenant_id', tenantId)
        .eq('id', inspection.id);
      if (error) throw error;

      toast({ title: 'Saved', description: 'Inspection updated.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: err?.message || 'Could not save inspection.' });
    } finally {
      setSaving(false);
    }
  };

  const addFinding = async () => {
    if (!inspection?.id) return;
    if (!asText(newFinding.title)) {
      toast({ variant: 'destructive', title: 'Missing title', description: 'Add a finding title first.' });
      return;
    }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('inspection_findings')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspection.id,
          title: asText(newFinding.title),
          severity: asText(newFinding.severity) || null,
          category: asText(newFinding.category) || null,
          description: asText(newFinding.description) || null,
          recommended_action: asText(newFinding.recommended_action) || null,
          is_customer_visible: newFinding.is_customer_visible !== false,
          sort_order: findings.length,
          created_by_user_id: user?.id || null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();
      if (error) throw error;
      setFindings((prev) => [...prev, data]);
      setNewFinding({ title: '', severity: 'medium', category: 'general', description: '', recommended_action: '', is_customer_visible: true });
      toast({ title: 'Finding added' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Add failed', description: err?.message || 'Could not add finding.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteFinding = async (findingId) => {
    if (!inspection?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('inspection_findings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspection.id)
        .eq('id', findingId);
      if (error) throw error;
      setFindings((prev) => prev.filter((f) => f.id !== findingId));
      // Photos remain; user can reattach or delete. (We intentionally do not cascade delete storage objects here.)
      toast({ title: 'Finding deleted' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err?.message || 'Could not delete finding.' });
    } finally {
      setSaving(false);
    }
  };

  const addRecommendation = async () => {
    if (!inspection?.id) return;
    if (!asText(newRec.title)) {
      toast({ variant: 'destructive', title: 'Missing title', description: 'Add a recommendation title first.' });
      return;
    }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const qty = Number(String(newRec.suggested_quantity || '').trim());
      const price = Number(String(newRec.suggested_unit_price || '').trim());
      const { data, error } = await supabase
        .from('inspection_recommendations')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspection.id,
          title: asText(newRec.title),
          priority: asText(newRec.priority) || 'normal',
          description: asText(newRec.description) || null,
          suggested_quantity: Number.isFinite(qty) ? qty : null,
          suggested_unit_price: Number.isFinite(price) ? price : null,
          is_customer_visible: newRec.is_customer_visible !== false,
          created_by_user_id: user?.id || null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();
      if (error) throw error;
      setRecs((prev) => [...prev, data]);
      setNewRec({ title: '', priority: 'normal', description: '', suggested_quantity: '', suggested_unit_price: '', is_customer_visible: true });
      toast({ title: 'Recommendation added' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Add failed', description: err?.message || 'Could not add recommendation.' });
    } finally {
      setSaving(false);
    }
  };

  const uploadPhotos = async (fileList) => {
    if (!inspection?.id) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const techId = inspection.technician_id || null;

      for (const file of files) {
        const safeName = sanitizeFilename(file.name);
        const revision = inspection?.revision || 1;
        const path = `${tenantId}/inspections/${inspection.id}/revision-${revision}/photos/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_ID)
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });

        if (uploadError) throw uploadError;

        const { data: photoRow, error: insertError } = await supabase
          .from('inspection_photos')
          .insert({
            tenant_id: tenantId,
            inspection_id: inspection.id,
            finding_id: null,
            recommendation_id: null,
            technician_id: techId,
            created_by_user_id: user?.id || null,
            bucket_id: BUCKET_ID,
            object_path: path,
            file_name: file.name,
            content_type: file.type || null,
            byte_size: file.size || null,
            caption: null,
            category: null,
            is_before: null,
            taken_at: null,
            uploaded_at: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (insertError) throw insertError;

        const withUrls = await hydratePhotoUrls([photoRow]);
        setPhotos((prev) => [...prev, ...(withUrls || [])]);
      }

      toast({ title: 'Photos uploaded' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Upload failed', description: err?.message || 'Could not upload photo.' });
    } finally {
      setSaving(false);
    }
  };

  const updatePhoto = async (photoId, patch) => {
    if (!inspection?.id) return;
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('inspection_photos')
        .update({ ...patch, updated_at: nowIso })
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspection.id)
        .eq('id', photoId)
        .select('*')
        .single();
      if (error) throw error;
      const withUrls = await hydratePhotoUrls([data]);
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? withUrls[0] : p)));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Update failed', description: err?.message || 'Could not update photo.' });
    }
  };

  const deletePhoto = async (photo) => {
    if (!inspection?.id) return;
    const reason = window.prompt('Reason for voiding this photo (required):');
    if (!asText(reason)) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('inspection_void_photo', {
        p_tenant_id: tenantId,
        p_photo_id: photo.id,
        p_reason: asText(reason),
      });
      if (error) throw error;
      if (!data?.id) throw new Error('Void failed.');

      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, ...data, signed_url: p.signed_url } : p)));
      toast({ title: 'Photo voided', description: 'Evidence preserved and excluded from customer report by default.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Void failed', description: err?.message || 'Could not void photo.' });
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    if (!inspection?.id) return;
    setSaving(true);
    try {
      const snapshot = {
        status: statusLabel(inspection?.status),
        findings_count: findings.length,
        photos_count: photos.filter((p) => p && p.is_voided !== true).length,
        recommendations_count: recs.length,
        unresolved_upload_count: 0,
      };

      const { data, error } = await supabase.rpc('inspection_submit', {
        p_tenant_id: tenantId,
        p_inspection_id: inspection.id,
        p_expected_revision: inspection.revision || 1,
        p_validation_snapshot: snapshot,
      });

      if (error) throw error;
      if (!data?.id) throw new Error('Submit failed.');

      toast({ title: 'Submitted for review', description: 'Inspection is now locked pending office QA.' });
      await fetchInspection(inspection.id);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Submit failed', description: err?.message || 'Could not submit inspection.' });
    } finally {
      setSaving(false);
    }
  };

  const reopenInspection = async () => {
    if (!inspection?.id) return;
    const reason = window.prompt('Reopen reason (required):');
    if (!asText(reason)) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('inspection_reopen', {
        p_tenant_id: tenantId,
        p_inspection_id: inspection.id,
        p_expected_revision: inspection.revision || 1,
        p_reason: asText(reason),
      });

      if (error) throw error;
      if (!data?.id) throw new Error('Reopen failed.');

      toast({ title: 'Inspection reopened', description: `Revision incremented to ${data.revision || '?'}.` });
      await fetchInspection(inspection.id);
      await fetchChildRows(inspection.id);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Reopen failed', description: err?.message || 'Could not reopen inspection.' });
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async () => {
    if (!inspection?.id) return;
    setSaving(true);
    try {
      await saveInspectionMeta();

      const qaSnapshot = {
        findings_count: findings.length,
        photos_count: photos.filter((p) => p && p.is_voided !== true).length,
        recommendations_count: recs.length,
      };

      const { data, error } = await supabase.rpc('inspection_complete', {
        p_tenant_id: tenantId,
        p_inspection_id: inspection.id,
        p_expected_revision: inspection.revision || 1,
        p_qa_snapshot: qaSnapshot,
      });

      if (error) throw error;
      if (!data?.id) throw new Error('Complete failed.');

      toast({ title: 'Inspection completed', className: 'bg-green-50 border-green-200' });
      await fetchInspection(inspection.id);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Complete failed', description: err?.message || 'Could not complete inspection.' });
    } finally {
      setSaving(false);
    }
  };

  const generateReportPdf = async () => {
    if (!inspection?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('inspection-report-pdf', {
        body: { tenant_id: tenantId, inspection_id: inspection.id, store: true, return_pdf: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.pdf) throw new Error('PDF response was empty.');

      downloadFromBase64(data.pdf, `inspection-${inspection.id}.pdf`);
      toast({ title: 'Report ready', description: 'Downloaded inspection report PDF.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Report failed', description: err?.message || 'Could not generate report.' });
    } finally {
      setSaving(false);
    }
  };

  const createQuoteDraftFromRecommendations = async () => {
    if (!inspection?.id) return;
    if (!inspection?.lead_id) {
      toast({ variant: 'destructive', title: 'Missing lead', description: 'This inspection is not linked to a lead.' });
      return;
    }
    if (!recs.length) {
      toast({ variant: 'destructive', title: 'No recommendations', description: 'Add at least one recommendation first.' });
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const lineItems = recs.map((r) => {
        const qty = Number(r.suggested_quantity || 1);
        const unit = Number(r.suggested_unit_price || 0);
        const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const safeUnit = Number.isFinite(unit) && unit > 0 ? unit : 0;
        const total = safeQty * safeUnit;
        return {
          description: r.title,
          quantity: safeQty,
          unit_price: safeUnit,
          total_price: total,
        };
      });

      const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
      const totalAmount = subtotal;

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          tenant_id: tenantId,
          lead_id: inspection.lead_id,
          status: 'draft',
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: totalAmount,
          valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          header_text: 'Based on today’s inspection, here are the recommended next steps.',
          footer_text: 'Thank you for your business.',
          quote_number: Math.floor(100000 + Math.random() * 900000),
          customer_email: inspection?.lead?.email || null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single();

      if (quoteError) throw quoteError;

      const quoteItemsPayload = lineItems.map((item) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsPayload);
      if (itemsError) throw itemsError;

      const { error: linkError } = await supabase
        .from('inspections')
        .update({ quote_id: quote.id, updated_at: nowIso })
        .eq('tenant_id', tenantId)
        .eq('id', inspection.id);
      if (linkError) throw linkError;

      toast({ title: 'Quote draft created', description: 'Open Quotes to review and send.', className: 'bg-green-50 border-green-200' });
      await fetchInspection(inspection.id);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Quote create failed', description: err?.message || 'Could not create quote draft.' });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (() => {
    const s = statusLabel(inspection?.status);
    if (!s) return null;
    const label = s.replaceAll('_', ' ');
    const tone =
      s === 'completed'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : s === 'submitted'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';
    return (
      <Badge variant="outline" className={tone}>
        {label}
      </Badge>
    );
  })();

  const linkedQuote = inspection?.quote || null;
  const publicQuoteLink = linkedQuote?.public_token ? `/quotes/${linkedQuote.public_token}` : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading inspection...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{isNew ? 'New Inspection' : 'Inspection'} | TVG CRM</title>
      </Helmet>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/${tenantId}/crm/inspections`)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 truncate">
                {isNew ? 'New Inspection' : (inspection?.title || 'Inspection')}
              </h1>
              {!isNew ? statusBadge : null}
            </div>
            {!isNew ? (
              <p className="text-sm text-slate-500 truncate">
                {inspection?.lead?.company || `${inspection?.lead?.first_name || ''} ${inspection?.lead?.last_name || ''}`.trim() || inspection?.lead?.email || ''}
              </p>
            ) : (
              <p className="text-sm text-slate-500">Create an inspection that drives findings, photos, and recommendations.</p>
            )}
          </div>
        </div>

        {!isNew ? (
          <div className="flex flex-wrap items-center gap-2">
            {publicQuoteLink ? (
              <Button variant="outline" asChild className="gap-2">
                <Link to={publicQuoteLink} target="_blank" rel="noreferrer">
                  <Link2 className="h-4 w-4" />
                  Public Quote
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={saveInspectionMeta}
              disabled={saving || statusLabel(inspection?.status) !== 'draft'}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>

            {statusLabel(inspection?.status) === 'draft' ? (
              <Button onClick={submitForReview} disabled={saving} className="gap-2 bg-amber-600 hover:bg-amber-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit For Review
              </Button>
            ) : null}

            {statusLabel(inspection?.status) === 'submitted' ? (
              <>
                <Button onClick={markComplete} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Mark Customer-Ready
                </Button>
                <Button variant="outline" onClick={reopenInspection} disabled={saving} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Reopen
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {isNew ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Inspection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer (Lead)</Label>
                <Select value={draftLeadId} onValueChange={setDraftLeadId} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead/customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Work Order (Optional)</Label>
                <Select
                  value={draftJobId}
                  onValueChange={(value) => {
                    setDraftJobId(value);
                    if (value && value !== 'unlinked') {
                      const job = jobs.find((j) => j.id === value);
                      if (job?.lead_id) setDraftLeadId(job.lead_id);
                    }
                  }}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unlinked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlinked">Unlinked</SelectItem>
                    {jobOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Technician (Optional)</Label>
                <Select value={draftTechnicianId} onValueChange={setDraftTechnicianId} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {technicianOptions.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title (Optional)</Label>
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="e.g. Dryer Vent Inspection" disabled={saving} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={createInspection} disabled={saving || !draftLeadId} className="bg-blue-600 hover:bg-blue-700 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="findings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="findings">Findings</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-500">Lead</div>
                    <div className="text-right">
                      {inspection?.lead?.company || `${inspection?.lead?.first_name || ''} ${inspection?.lead?.last_name || ''}`.trim() || inspection?.lead?.email || 'Unlinked'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-500">Work Order</div>
                    <div className="text-right">{inspection?.job?.work_order_number || 'Unlinked'}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-500">Technician</div>
                    <div className="text-right">{inspection?.technician?.full_name || 'Unassigned'}</div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-500">Quote</div>
                    <div className="text-right">
                      {linkedQuote?.quote_number ? `#${linkedQuote.quote_number}` : 'None'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-500">Quote Status</div>
                    <div className="text-right capitalize">{linkedQuote?.status ? String(linkedQuote.status).toLowerCase() : 'n/a'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Inspection Summary</Label>
                    <Textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Brief summary a customer can read..."
                      className="min-h-28"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Disclaimer</Label>
                    <Textarea
                      value={disclaimer}
                      onChange={(e) => setDisclaimer(e.target.value)}
                      className="min-h-24"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="findings">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Finding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newFinding.title}
                      onChange={(e) => setNewFinding((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Excess lint buildup in vent line"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select
                        value={newFinding.severity}
                        onValueChange={(v) => setNewFinding((p) => ({ ...p, severity: v }))}
                        disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={newFinding.category}
                        onValueChange={(v) => setNewFinding((p) => ({ ...p, category: v }))}
                        disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="dryer_vent">Dryer Vent</SelectItem>
                          <SelectItem value="hvac">HVAC</SelectItem>
                          <SelectItem value="bath_fan">Bath Fan</SelectItem>
                          <SelectItem value="damage">Damage</SelectItem>
                          <SelectItem value="safety">Safety</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newFinding.description}
                      onChange={(e) => setNewFinding((p) => ({ ...p, description: e.target.value }))}
                      className="min-h-24"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recommended Action</Label>
                    <Textarea
                      value={newFinding.recommended_action}
                      onChange={(e) => setNewFinding((p) => ({ ...p, recommended_action: e.target.value }))}
                      className="min-h-20"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFinding.is_customer_visible !== false}
                      onChange={(e) => setNewFinding((p) => ({ ...p, is_customer_visible: e.target.checked }))}
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                    <span className="text-sm text-slate-700">Customer-visible</span>
                  </div>
                  <Button onClick={addFinding} disabled={saving || statusLabel(inspection?.status) !== 'draft'} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Finding
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Findings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {findings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                      No findings yet.
                    </div>
                  ) : (
                    findings.map((f) => (
                      <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{f.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {f.severity ? <Badge variant="secondary" className="text-[11px] capitalize">{String(f.severity)}</Badge> : null}
                              {f.category ? <Badge variant="outline" className="text-[11px] capitalize">{String(f.category).replaceAll('_', ' ')}</Badge> : null}
                              {f.is_customer_visible === false ? <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-600">Internal</Badge> : null}
                              <Badge variant="outline" className="text-[11px]">{photos.filter((p) => p.finding_id === f.id).length} photos</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteFinding(f.id)}
                            disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                            title="Delete finding"
                          >
                            <Trash2 className="h-4 w-4 text-slate-500" />
                          </Button>
                        </div>
                        {f.description ? <div className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{f.description}</div> : null}
                        {f.recommended_action ? (
                          <div className="mt-2 text-sm">
                            <div className="font-medium text-slate-900">Recommended</div>
                            <div className="text-slate-600 whitespace-pre-wrap">{f.recommended_action}</div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="photos">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload Photos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Camera className="h-4 w-4" />
                      Add inspection photos (stored in Supabase Storage)
                    </div>
                    <div className="mt-3">
                      <Input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => uploadPhotos(e.target.files)}
                        disabled={saving}
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Required: real uploads. No blob URLs.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Photo Evidence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {photos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                      No photos uploaded yet.
                    </div>
                  ) : (
                    photos.map((p) => (
                      <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <div className="h-28 w-full sm:w-40 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                            {p.signed_url ? (
                              <img src={p.signed_url} alt={p.caption || p.file_name || 'photo'} className="h-full w-full object-cover" />
                            ) : (
                              <div className="text-xs text-slate-500">Preview unavailable</div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Finding</Label>
                                <Select
                                  value={p.finding_id || 'unlinked'}
                                  onValueChange={(value) => updatePhoto(p.id, { finding_id: value === 'unlinked' ? null : value })}
                                  disabled={saving || statusLabel(inspection?.status) !== 'draft' || p.is_voided === true}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Unlinked" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unlinked">Unlinked</SelectItem>
                                    {findings.map((f) => (
                                      <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Before/After</Label>
                                <Select
                                  value={p.is_before === true ? 'before' : p.is_before === false ? 'after' : 'unspecified'}
                                  onValueChange={(value) => updatePhoto(p.id, { is_before: value === 'before' ? true : value === 'after' ? false : null })}
                                  disabled={saving || statusLabel(inspection?.status) !== 'draft' || p.is_voided === true}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unspecified">Unspecified</SelectItem>
                                    <SelectItem value="before">Before</SelectItem>
                                    <SelectItem value="after">After</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Caption</Label>
                              <Input
                                value={p.caption || ''}
                                onChange={(e) => updatePhoto(p.id, { caption: e.target.value })}
                                placeholder="Short caption the customer can read..."
                                className="h-8"
                                disabled={saving || statusLabel(inspection?.status) !== 'draft' || p.is_voided === true}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-slate-500 truncate">
                                {p.file_name || p.object_path}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deletePhoto(p)}
                                title="Void photo"
                                disabled={saving || statusLabel(inspection?.status) !== 'draft' || p.is_voided === true}
                              >
                                <Trash2 className="h-4 w-4 text-slate-500" />
                              </Button>
                            </div>
                            {p.is_voided ? (
                              <div className="text-xs text-amber-700">Voided: {p.void_reason || 'No reason recorded'}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Recommendation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newRec.title}
                      onChange={(e) => setNewRec((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Full dryer vent cleaning"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={newRec.priority}
                        onValueChange={(v) => setNewRec((p) => ({ ...p, priority: v }))}
                        disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Suggested Qty</Label>
                      <Input
                        value={newRec.suggested_quantity}
                        onChange={(e) => setNewRec((p) => ({ ...p, suggested_quantity: e.target.value }))}
                        inputMode="decimal"
                        placeholder="1"
                        disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Suggested Unit Price</Label>
                    <Input
                      value={newRec.suggested_unit_price}
                      onChange={(e) => setNewRec((p) => ({ ...p, suggested_unit_price: e.target.value }))}
                      inputMode="decimal"
                      placeholder="0.00"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newRec.description}
                      onChange={(e) => setNewRec((p) => ({ ...p, description: e.target.value }))}
                      className="min-h-24"
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRec.is_customer_visible !== false}
                      onChange={(e) => setNewRec((p) => ({ ...p, is_customer_visible: e.target.checked }))}
                      disabled={saving || statusLabel(inspection?.status) !== 'draft'}
                    />
                    <span className="text-sm text-slate-700">Customer-visible</span>
                  </div>
                  <Button onClick={addRecommendation} disabled={saving || statusLabel(inspection?.status) !== 'draft'} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Recommendation
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">Recommendations</CardTitle>
                  <Button variant="outline" onClick={createQuoteDraftFromRecommendations} disabled={saving || Boolean(inspection?.quote_id)} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Create Quote Draft
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                      No recommendations yet.
                    </div>
                  ) : (
                    recs.map((r) => (
                      <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{r.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {r.priority ? <Badge variant="secondary" className="text-[11px] capitalize">{String(r.priority)}</Badge> : null}
                              {r.is_customer_visible === false ? <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-600">Internal</Badge> : null}
                              {Number(r.suggested_unit_price) > 0 ? (
                                <Badge variant="outline" className="text-[11px]">${Number(r.suggested_unit_price).toFixed(2)}</Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {r.description ? <div className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{r.description}</div> : null}
                      </div>
                    ))
                  )}
                  {inspection?.quote_id ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Quote linked to this inspection: {linkedQuote?.quote_number ? `#${linkedQuote.quote_number}` : inspection.quote_id}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="report">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Customer Report</CardTitle>
                <Button onClick={generateReportPdf} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Download PDF
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  This PDF includes customer header, summary, findings, photo evidence, and recommendations. Photos are embedded server-side.
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Findings</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{findings.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Photos</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{photos.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Recommendations</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{recs.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
