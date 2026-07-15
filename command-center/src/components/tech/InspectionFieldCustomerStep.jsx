import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { appointmentService } from '@/services/appointmentService';
import { formatPhoneNumber } from '@/lib/formUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const leadDisplayName = (lead) =>
  asText(lead?.company) ||
  `${asText(lead?.first_name)} ${asText(lead?.last_name)}`.trim() ||
  asText(lead?.email) ||
  'Customer';

const formatLeadAddress = (lead) => {
  const direct = asText(lead?.address) || asText(lead?.service_address);
  if (direct) return direct;
  const cityLine = [asText(lead?.city), asText(lead?.state), asText(lead?.zip)].filter(Boolean).join(' ');
  return [asText(lead?.address1), asText(lead?.address2), cityLine].filter(Boolean).join(', ');
};

const emptyLeadForm = () => ({
  first_name: '',
  last_name: '',
  company: '',
  phone: '',
  email: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
});

/**
 * Field step: search existing lead/customer/job address, or quick-add a lead
 * using appointmentService.createCustomer, then link to the inspection.
 */
export default function InspectionFieldCustomerStep({
  tenantId,
  inspection,
  locked = false,
  onLinked,
  onContinue,
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyLeadForm);
  const [duplicates, setDuplicates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');

  const linkedName = leadDisplayName(inspection?.lead);
  const linkedAddress =
    asText(inspection?.service_address) ||
    asText(inspection?.job?.service_address) ||
    formatLeadAddress(inspection?.lead);

  useEffect(() => {
    setAddressDraft(linkedAddress || '');
  }, [linkedAddress, inspection?.id]);

  const hasLink = Boolean(inspection?.lead_id);

  const runSearch = async (rawQuery) => {
    const q = asText(rawQuery).replace(/[,.()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const like = `%${q}%`;
      const [leadRes, jobRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, first_name, last_name, company, email, phone, address1, address2, city, state, zip, property_id, contact_id')
          .eq('tenant_id', tenantId)
          .or(`first_name.ilike."${like}",last_name.ilike."${like}",company.ilike."${like}",email.ilike."${like}",phone.ilike."${like}",address1.ilike."${like}"`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('jobs')
          .select('id, lead_id, work_order_number, service_address, status')
          .eq('tenant_id', tenantId)
          .ilike('service_address', like)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (leadRes.error) throw leadRes.error;
      if (jobRes.error) throw jobRes.error;

      const leadRows = (leadRes.data || []).map((lead) => ({
        key: `lead-${lead.id}`,
        type: 'Lead',
        leadId: lead.id,
        jobId: null,
        propertyId: lead.property_id || null,
        contactId: lead.contact_id || null,
        name: leadDisplayName(lead),
        phone: asText(lead.phone),
        email: asText(lead.email),
        address: formatLeadAddress(lead),
        lead,
      }));

      const jobLeadIds = [...new Set((jobRes.data || []).map((job) => job.lead_id).filter(Boolean))];
      let jobLeads = [];
      if (jobLeadIds.length) {
        const { data, error } = await supabase
          .from('leads')
          .select('id, first_name, last_name, company, email, phone, address1, address2, city, state, zip, property_id, contact_id')
          .eq('tenant_id', tenantId)
          .in('id', jobLeadIds);
        if (error) throw error;
        jobLeads = data || [];
      }
      const leadById = new Map(jobLeads.map((row) => [row.id, row]));

      const jobRows = (jobRes.data || []).map((job) => {
        const lead = leadById.get(job.lead_id) || null;
        return {
          key: `job-${job.id}`,
          type: 'Property',
          leadId: job.lead_id || null,
          jobId: job.id,
          propertyId: lead?.property_id || null,
          contactId: lead?.contact_id || null,
          name: lead ? leadDisplayName(lead) : (job.work_order_number || 'Job'),
          phone: asText(lead?.phone),
          email: asText(lead?.email),
          address: asText(job.service_address),
          lead,
        };
      });

      // Prefer explicit lead hits, then job/address hits not already represented.
      const seenLeads = new Set(leadRows.map((row) => row.leadId));
      const merged = [
        ...leadRows.map((row) => ({ ...row, type: row.lead?.company ? 'Customer' : 'Lead' })),
        ...jobRows.filter((row) => row.leadId && !seenLeads.has(row.leadId) ? true : Boolean(row.address)),
      ];
      setResults(merged.slice(0, 30));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Search failed',
        description: error?.message || 'Could not search customers.',
      });
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      runSearch(query).catch(() => null);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tenantId]);

  const linkSelection = async ({ leadId, jobId, propertyId, contactId, address, lead }) => {
    if (!inspection?.id || locked || !leadId) return;
    setSaving(true);
    try {
      const serviceAddress = asText(address) || formatLeadAddress(lead) || null;
      const { data, error } = await supabase
        .from('inspections')
        .update({
          lead_id: leadId,
          job_id: jobId || inspection.job_id || null,
          property_id: propertyId || lead?.property_id || null,
          contact_id: contactId || lead?.contact_id || null,
          service_address: serviceAddress,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', inspection.id)
        .select(`
          *,
          lead:leads(id, first_name, last_name, company, email, phone, address1, address2, city, state, zip, property_id, contact_id),
          job:jobs(id, work_order_number, service_address)
        `)
        .single();
      if (error) throw error;
      const normalized = {
        ...data,
        lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
        job: Array.isArray(data.job) ? data.job[0] : data.job,
      };
      toast({ title: 'Customer linked', description: 'Service address saved on this inspection.' });
      await onLinked?.(normalized);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Link failed',
        description: error?.message || 'Could not attach this customer to the inspection.',
      });
    } finally {
      setSaving(false);
    }
  };

  const findDuplicates = async () => {
    const phone = formatPhoneNumber(form.phone);
    const email = asText(form.email);
    const filters = [];
    if (phone) filters.push(`phone.ilike.%${phone.replace(/\D/g, '').slice(-10)}%`);
    if (email) filters.push(`email.ilike.${email}`);
    if (asText(form.last_name)) filters.push(`last_name.ilike.%${asText(form.last_name)}%`);
    if (asText(form.address1)) filters.push(`address1.ilike.%${asText(form.address1)}%`);
    if (!filters.length) {
      setDuplicates([]);
      return [];
    }
    const { data, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, company, email, phone, address1, address2, city, state, zip, property_id, contact_id')
      .eq('tenant_id', tenantId)
      .or(filters.join(','))
      .limit(8);
    if (error) throw error;
    const rows = data || [];
    setDuplicates(rows);
    return rows;
  };

  const createAndLink = async ({ force = false } = {}) => {
    if (locked) return;
    if (!asText(form.first_name) && !asText(form.last_name) && !asText(form.company)) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Add a first name, last name, or company.',
      });
      return;
    }
    if (!asText(form.address1) || !asText(form.city) || !asText(form.state) || !asText(form.zip)) {
      toast({
        variant: 'destructive',
        title: 'Service address required',
        description: 'Address, city, state, and ZIP are required for the report.',
      });
      return;
    }

    setSaving(true);
    try {
      if (!force) {
        const matches = await findDuplicates();
        if (matches.length) {
          setSaving(false);
          return;
        }
      }

      const created = await appointmentService.createCustomer(
        {
          first_name: asText(form.first_name) || null,
          last_name: asText(form.last_name) || null,
          company: asText(form.company) || null,
          phone: formatPhoneNumber(form.phone) || null,
          email: asText(form.email) || null,
          source: 'field_inspection',
          status: 'new',
        },
        tenantId,
      );

      const serviceAddress = [
        asText(form.address1),
        asText(form.address2),
        [asText(form.city), asText(form.state), asText(form.zip)].filter(Boolean).join(' '),
      ].filter(Boolean).join(', ');

      // Best-effort address fields on the lead when columns exist.
      const addressPatch = {
        address1: asText(form.address1) || null,
        address2: asText(form.address2) || null,
        city: asText(form.city) || null,
        state: asText(form.state) || null,
        zip: asText(form.zip) || null,
        notes: asText(form.notes) || null,
        updated_at: new Date().toISOString(),
      };
      const addressUpdate = await supabase
        .from('leads')
        .update(addressPatch)
        .eq('tenant_id', tenantId)
        .eq('id', created.id);
      if (addressUpdate.error) {
        // Column drift should not block inspection linking; service_address is authoritative on inspection.
        console.warn('Lead address patch skipped:', addressUpdate.error.message);
      }

      await linkSelection({
        leadId: created.id,
        jobId: null,
        propertyId: created.property_id || null,
        contactId: created.contact_id || null,
        address: serviceAddress,
        lead: { ...created, ...addressPatch },
      });

      setShowAdd(false);
      setForm(emptyLeadForm());
      setDuplicates([]);
      setQuery('');
      onContinue?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not add lead',
        description: error?.message || 'Lead creation failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAddressOnly = async () => {
    if (!inspection?.id || locked) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .update({
          service_address: asText(addressDraft) || null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', inspection.id)
        .select(`
          *,
          lead:leads(id, first_name, last_name, company, email, phone, address1, address2, city, state, zip, property_id, contact_id),
          job:jobs(id, work_order_number, service_address)
        `)
        .single();
      if (error) throw error;
      const normalized = {
        ...data,
        lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
        job: Array.isArray(data.job) ? data.job[0] : data.job,
      };
      toast({ title: 'Address saved' });
      await onLinked?.(normalized);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Address save failed',
        description: error?.message || 'Could not save the service address.',
      });
    } finally {
      setSaving(false);
    }
  };

  const noMatch = asText(query).length >= 2 && !searching && results.length === 0;

  const resultList = useMemo(() => results, [results]);

  return (
    <Card id="inspection-customer-step" className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Customer / Lead & Property</CardTitle>
        <p className="text-xs text-slate-500">
          Confirm who this inspection is for and the service address used on the report.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasLink ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <div className="font-semibold">{linkedName}</div>
            <div className="mt-1 text-xs">{linkedAddress || 'No service address on file'}</div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs">Service address</Label>
              <Input
                id="inspection-service-address"
                value={addressDraft}
                onChange={(event) => setAddressDraft(event.target.value)}
                disabled={locked || saving}
                placeholder="123 Main St, City, ST ZIP"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={saveAddressOnly} disabled={locked || saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save address
                </Button>
                <Button type="button" className="min-h-11 bg-blue-600 hover:bg-blue-700" onClick={() => onContinue?.()} disabled={locked}>
                  Continue to Photos
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Select a customer or add a new lead before capturing photos for the report.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="field-customer-search">Search customers, leads, or addresses</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="field-customer-search"
              className="min-h-11 pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, phone, email, or address"
              disabled={locked || saving}
            />
          </div>
        </div>

        {searching ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : null}

        {resultList.length ? (
          <ul className="space-y-2">
            {resultList.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={locked || saving || !row.leadId}
                  onClick={() => linkSelection(row)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{row.type}</Badge>
                    <span className="font-semibold text-slate-900">{row.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {[row.phone, row.email, row.address].filter(Boolean).join(' • ') || 'No contact details'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {noMatch || showAdd ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900">Customer not found</div>
                <div className="text-xs text-slate-500">Add a new lead without leaving this inspection.</div>
              </div>
              {!showAdd ? (
                <Button type="button" className="min-h-11 gap-2" onClick={() => setShowAdd(true)} disabled={locked}>
                  <UserPlus className="h-4 w-4" />
                  Add new lead
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showAdd ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>First name</Label>
                <Input className="min-h-11" value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <Label>Last name</Label>
                <Input className="min-h-11" value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Company (optional)</Label>
              <Input className="min-h-11" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} disabled={saving} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input className="min-h-11" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <Label>Email (optional)</Label>
                <Input className="min-h-11" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Service address</Label>
              <Input className="min-h-11" value={form.address1} onChange={(e) => setForm((p) => ({ ...p, address1: e.target.value }))} disabled={saving} placeholder="Street address" />
            </div>
            <div className="space-y-1">
              <Label>Unit / line 2 (optional)</Label>
              <Input className="min-h-11" value={form.address2} onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))} disabled={saving} />
            </div>
            <div className="grid gap-3 grid-cols-3">
              <div className="space-y-1 col-span-1">
                <Label>City</Label>
                <Input className="min-h-11" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input className="min-h-11" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <Label>ZIP</Label>
                <Input className="min-h-11" value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} disabled={saving} className="min-h-20" />
            </div>

            {duplicates.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="text-sm font-semibold text-amber-950">Possible existing matches</div>
                <p className="text-xs text-amber-900">Select a match instead of creating a duplicate.</p>
                {duplicates.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="w-full rounded-lg border border-amber-200 bg-white p-2 text-left text-sm"
                    onClick={() => linkSelection({
                      leadId: lead.id,
                      jobId: null,
                      propertyId: lead.property_id || null,
                      contactId: lead.contact_id || null,
                      address: formatLeadAddress(lead),
                      lead,
                    }).then(() => {
                      setShowAdd(false);
                      setDuplicates([]);
                      onContinue?.();
                    })}
                  >
                    <div className="font-medium">{leadDisplayName(lead)}</div>
                    <div className="text-xs text-slate-600">{[lead.phone, lead.email, formatLeadAddress(lead)].filter(Boolean).join(' • ')}</div>
                  </button>
                ))}
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => createAndLink({ force: true })} disabled={saving}>
                  Create new lead anyway
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => { setShowAdd(false); setDuplicates([]); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" className="min-h-11 bg-blue-600 hover:bg-blue-700" onClick={() => createAndLink()} disabled={saving || locked}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Save lead
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
