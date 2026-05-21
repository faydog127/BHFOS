import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Plus, Search, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const statusTone = (status) => {
  const s = normalizeStatus(status);
  if (s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'submitted') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'draft') return 'bg-slate-50 text-slate-700 border-slate-200';
  if (s === 'in_progress') return 'bg-slate-50 text-slate-700 border-slate-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

export default function Inspections() {
  const tenantId = getTenantId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const lead = row.lead || null;
      const job = row.job || null;
      const hay = [
        row.title,
        row.status,
        lead?.company,
        lead?.email,
        `${lead?.first_name || ''} ${lead?.last_name || ''}`,
        job?.work_order_number,
        job?.service_address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, rows]);

  useEffect(() => {
    let mounted = true;

    const fetchInspections = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('inspections')
          .select(`
            id,
            tenant_id,
            status,
            title,
            started_at,
            completed_at,
            created_at,
            updated_at,
            lead:leads(id, first_name, last_name, company, email),
            job:jobs(id, work_order_number, status, service_address),
            technician:technicians(id, full_name)
          `)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(250);

        if (error) throw error;

        if (!mounted) return;
        setRows((data || []).map((row) => ({
          ...row,
          lead: Array.isArray(row.lead) ? row.lead[0] : row.lead,
          job: Array.isArray(row.job) ? row.job[0] : row.job,
          technician: Array.isArray(row.technician) ? row.technician[0] : row.technician,
        })));
      } catch (err) {
        console.error('Failed to load inspections:', err);
        toast({
          variant: 'destructive',
          title: 'Failed to load inspections',
          description: err?.message || 'The inspection list could not be loaded.',
        });
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInspections();
    return () => {
      mounted = false;
    };
  }, [tenantId, toast]);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Inspections | TVG CRM</title>
      </Helmet>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Inspections</h1>
            <p className="text-sm text-slate-500">Capture findings, photos, and recommendations that drive quotes and work orders.</p>
          </div>
        </div>

        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/${tenantId}/crm/inspections/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Inspection
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Customer, email, work order number, address..."
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading inspections...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-600">
              No inspections found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const lead = row.lead || {};
                const job = row.job || null;
                const tech = row.technician || null;
                const customer =
                  lead.company ||
                  `${lead.first_name || ''} ${lead.last_name || ''}`.trim() ||
                  lead.email ||
                  'Customer';

                return (
                  <Link
                    key={row.id}
                    to={`/${tenantId}/crm/inspections/${row.id}`}
                    className="block rounded-xl px-3 py-3 hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-medium text-slate-900">{row.title || `Inspection - ${customer}`}</div>
                          <Badge variant="outline" className={statusTone(row.status)}>
                            {normalizeStatus(row.status) || 'draft'}
                          </Badge>
                          {job?.work_order_number ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {job.work_order_number}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-500 truncate">
                          {lead.email ? `${lead.email}` : null}
                          {lead.email && job?.service_address ? ' • ' : null}
                          {job?.service_address ? job.service_address : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                        <div className="text-xs text-slate-500">
                          {tech?.full_name ? `Tech: ${tech.full_name}` : 'Tech: Unassigned'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.completed_at ? `Completed` : 'In progress'}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
