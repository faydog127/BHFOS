/**
 * ML-P1 Slice 1 — Mobile-first customer find/create + draft quote (canonical quotes only).
 * Does not issue, approve, convert to job, or invoice.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId, resolveTenantIdFromSession, tenantPath } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  assertLeadIntakeValid,
  buildLeadIntakeInsertPayload,
  describeLeadIntakeDbError,
} from '@/lib/leadIntakeContract';
import { createMlP1S1QuoteDraftService } from '@/services/mlP1S1QuoteDraftService';
import { resolveWriteTenantId, isTenantDenyError } from '@/lib/mlP1S1Tenant';
import {
  endKpiTimer,
  getKpiSnapshot,
  recordNotesEscape,
  startKpiTimer,
} from '@/lib/mlP1S1Kpi';
import { ArrowLeft, Loader2, Plus, Search, UserPlus } from 'lucide-react';

const draftService = createMlP1S1QuoteDraftService({ supabase });

const emptyForm = () => ({
  first_name: '',
  last_name: '',
  company: '',
  phone: '',
  email: '',
  address1: '',
  city: '',
  state: '',
  zip: '',
});

export default function MlP1S1DraftQuotePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useSupabaseAuth() || {};
  const urlTenantId = getTenantId();

  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [duplicates, setDuplicates] = useState([]);
  const [lineDesc, setLineDesc] = useState('Service');
  const [linePrice, setLinePrice] = useState('0');
  const [saving, setSaving] = useState(false);
  const [idemKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `s1-${Date.now()}`,
  );
  const [lastQuoteId, setLastQuoteId] = useState(null);
  const [tapCount, setTapCount] = useState(0);

  const bumpTap = () => setTapCount((n) => n + 1);

  const runSearch = async () => {
    bumpTap();
    startKpiTimer('find_customer');
    setSearching(true);
    try {
      const sessionTenantId = await resolveTenantIdFromSession();
      const tenantId = resolveWriteTenantId({ sessionTenantId, urlTenantId });
      const q = search.trim();
      if (!q) {
        setResults([]);
        return;
      }
      const { data, error } = await supabase
        .from('leads')
        .select(
          'id, tenant_id, first_name, last_name, company, phone, email, address, property_formatted_address',
        )
        .eq('tenant_id', tenantId)
        .or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,address.ilike.%${q}%`,
        )
        .limit(12);
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Search failed',
        description: error.message || 'Could not search customers',
      });
    } finally {
      endKpiTimer('find_customer');
      setSearching(false);
    }
  };

  const selectLead = (lead) => {
    bumpTap();
    setSelectedLead(lead);
    setDuplicates([]);
    setStep(2);
    recordNotesEscape({ usedExternalTool: false, task: 'select_customer' });
  };

  const createCustomer = async ({ force = false } = {}) => {
    bumpTap();
    startKpiTimer('create_customer');
    setCreating(true);
    try {
      const sessionTenantId = await resolveTenantIdFromSession();
      const tenantId = resolveWriteTenantId({ sessionTenantId, urlTenantId });
      assertLeadIntakeValid(form);
      if (!force) {
        const dup = await draftService.findDuplicateCustomers({
          sessionTenantId,
          urlTenantId,
          input: form,
        });
        if (dup.ok && dup.matches?.length) {
          setDuplicates(dup.matches);
          toast({
            title: 'Possible duplicates',
            description: 'Select an existing customer or force-create if intentional.',
          });
          return;
        }
      }

      const payload = buildLeadIntakeInsertPayload(form, {
        tenantId,
        source: 'ml_p1_s1',
      });
      const { data, error } = await supabase.from('leads').insert(payload).select('*').single();
      if (error) throw error;
      setSelectedLead(data);
      setDuplicates([]);
      setStep(2);
      recordNotesEscape({ usedExternalTool: false, task: 'create_customer' });
      toast({ title: 'Customer created', description: 'Continue to draft quote.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: isTenantDenyError(error) ? 'Tenant deny' : 'Could not create customer',
        description: describeLeadIntakeDbError(error) || error.message,
      });
    } finally {
      endKpiTimer('create_customer');
      setCreating(false);
    }
  };

  const saveDraft = async () => {
    bumpTap();
    if (!selectedLead) return;
    setSaving(true);
    try {
      const sessionTenantId = await resolveTenantIdFromSession();
      const price = Number(linePrice) || 0;
      const result = await draftService.createDraftQuote({
        lead: selectedLead,
        form,
        lineItems: [
          {
            description: lineDesc || 'Service',
            quantity: 1,
            unit_price: price,
          },
        ],
        sessionTenantId,
        urlTenantId,
        actorId: user?.id || null,
        actorRole: 'office',
        idempotencyKey: idemKey,
      });
      setLastQuoteId(result.quote.id);
      recordNotesEscape({ usedExternalTool: false, task: 'create_draft_quote' });
      toast({
        title: result.idempotent ? 'Draft reused (idempotent)' : 'Draft quote saved',
        description: `Quote ${result.quote.id.slice(0, 8)}… — issue/approve not in Slice 1.`,
      });
      setStep(3);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Draft save failed',
        description: error.message || 'Could not save draft quote',
      });
    } finally {
      setSaving(false);
    }
  };

  const kpi = getKpiSnapshot();

  return (
    <div className="mx-auto max-w-lg px-3 py-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            bumpTap();
            navigate(tenantPath('/crm/estimates'));
          }}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">P1 Draft Quote</h1>
          <p className="text-xs text-slate-500">Slice 1 — customer + draft only (no issue/approve)</p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Find or create customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search name, phone, address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-base"
              />
              <Button type="button" onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <ul className="divide-y rounded-md border">
              {results.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-3 hover:bg-slate-50"
                    onClick={() => selectLead(lead)}
                  >
                    <div className="font-medium text-slate-900">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                        lead.company ||
                        'Customer'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {lead.phone} · {lead.address || lead.property_formatted_address}
                    </div>
                  </button>
                </li>
              ))}
              {!results.length && (
                <li className="px-3 py-4 text-sm text-slate-500">No matches yet — create below.</li>
              )}
            </ul>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserPlus className="h-4 w-4" /> New customer
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>First</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Last</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Street (address_line_1)</Label>
                <Input
                  value={form.address1}
                  onChange={(e) => setForm((f) => ({ ...f, address1: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>ST</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input
                    value={form.zip}
                    onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                  />
                </div>
              </div>

              {duplicates.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-900">Possible duplicates</p>
                  {duplicates.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="block w-full text-left text-sm underline"
                      onClick={() => selectLead(d)}
                    >
                      {[d.first_name, d.last_name].filter(Boolean).join(' ') || d.company} —{' '}
                      {d.phone}
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={creating}
                    onClick={() => createCustomer({ force: true })}
                  >
                    Create anyway
                  </Button>
                </div>
              )}

              <Button type="button" className="w-full" disabled={creating} onClick={() => createCustomer()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create customer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && selectedLead && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Draft quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              {[selectedLead.first_name, selectedLead.last_name].filter(Boolean).join(' ') ||
                selectedLead.company}
            </p>
            <p className="text-xs text-slate-500">
              {selectedLead.address || selectedLead.property_formatted_address}
            </p>
            <div>
              <Label>Line item</Label>
              <Input value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} />
            </div>
            <div>
              <Label>Price</Label>
              <Input
                inputMode="decimal"
                value={linePrice}
                onChange={(e) => setLinePrice(e.target.value)}
              />
            </div>
            <Button type="button" className="w-full" disabled={saving} onClick={saveDraft}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft quote
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>
              Change customer
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draft saved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Quote id: {lastQuoteId}</p>
            <p className="text-slate-500">
              Slice 1 stops here — issue, approve, job, and invoice are not authorized.
            </p>
            <p className="text-xs text-slate-400">
              Taps this session: {tapCount}. KPI timers:{' '}
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(kpi.timers || {}).map(([k, v]) => [k, v.ms]),
                ),
              )}
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate(tenantPath(`/crm/estimates/${lastQuoteId}`))}
            >
              Open in estimates list editor (existing)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
