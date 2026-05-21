import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { startOfDay, endOfDay, format } from 'date-fns';
import { ClipboardList, Loader2, MapPin, RefreshCw } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');

const formatJobTime = (job) => {
  const start = job?.scheduled_start ? new Date(job.scheduled_start) : null;
  if (!start || Number.isNaN(start.valueOf())) return 'Unscheduled';
  return format(start, 'h:mm a');
};

const getCustomerName = (lead) =>
  asText(lead?.company) ||
  `${asText(lead?.first_name)} ${asText(lead?.last_name)}`.trim() ||
  asText(lead?.email) ||
  'Customer';

export default function TechQueue() {
  const tenantId = getTenantId();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('assigned');

  const [technician, setTechnician] = useState(null);
  const [assignedToday, setAssignedToday] = useState([]);
  const [draftInspections, setDraftInspections] = useState([]);
  const [needsAttention, setNeedsAttention] = useState([]);

  const todayRange = useMemo(() => {
    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();
    return { start, end };
  }, []);

  const fetchTechnician = async () => {
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('technicians')
      .select('id, user_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  };

  const refresh = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const tech = await fetchTechnician();
      setTechnician(tech);
      if (!tech?.id) {
        setAssignedToday([]);
        setDraftInspections([]);
        setNeedsAttention([]);
        return;
      }

      const [jobsRes, draftRes, attentionRes] = await Promise.all([
        supabase
          .from('jobs')
          .select(
            `
            id,
            tenant_id,
            status,
            scheduled_start,
            scheduled_end,
            service_address,
            work_order_number,
            lead:leads(first_name,last_name,company,email,phone)
          `,
          )
          .eq('tenant_id', tenantId)
          .eq('technician_id', tech.id)
          .gte('scheduled_start', todayRange.start)
          .lte('scheduled_start', todayRange.end)
          .order('scheduled_start', { ascending: true }),
        supabase
          .from('inspections')
          .select(
            `
            id,
            tenant_id,
            status,
            revision,
            title,
            updated_at,
            job:jobs(id, work_order_number, service_address),
            lead:leads(first_name,last_name,company,email)
          `,
          )
          .eq('tenant_id', tenantId)
          .eq('technician_id', tech.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase
          .from('inspections')
          .select(
            `
            id,
            tenant_id,
            status,
            revision,
            title,
            updated_at,
            job:jobs(id, work_order_number, service_address),
            lead:leads(first_name,last_name,company,email)
          `,
          )
          .eq('tenant_id', tenantId)
          .eq('technician_id', tech.id)
          .or('status.eq.submitted,and(status.eq.draft,revision.gt.1)')
          .order('updated_at', { ascending: false })
          .limit(50),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (draftRes.error) throw draftRes.error;
      if (attentionRes.error) throw attentionRes.error;

      const normalizeJoin = (row) => ({
        ...row,
        lead: Array.isArray(row.lead) ? row.lead[0] : row.lead,
        job: Array.isArray(row.job) ? row.job[0] : row.job,
      });

      setAssignedToday((jobsRes.data || []).map((row) => ({
        ...row,
        lead: Array.isArray(row.lead) ? row.lead[0] : row.lead,
      })));
      setDraftInspections((draftRes.data || []).map(normalizeJoin));
      setNeedsAttention((attentionRes.data || []).map(normalizeJoin));
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Queue failed to load',
        description: err?.message || 'Could not load technician queue.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenantId]);

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">My Queue</h1>
            <div className="text-sm text-slate-500 truncate">
              {technician?.full_name ? technician.full_name : 'Technician'}
            </div>
          </div>
        </div>
      </div>
      <Button variant="outline" className="gap-2" onClick={refresh} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Refresh
      </Button>
    </div>
  );

  const EmptyState = ({ label }) => (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
      {label}
    </div>
  );

  const JobCard = ({ job }) => {
    const lead = job?.lead || {};
    const customer = getCustomerName(lead);
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-3">
            <span className="truncate">{customer}</span>
            <Badge variant="outline" className="text-[11px]">
              {formatJobTime(job)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-slate-600">
            {job?.work_order_number ? <div className="font-medium text-slate-900">{job.work_order_number}</div> : null}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <span className="truncate">{asText(job?.service_address) || 'No address on file'}</span>
            </div>
          </div>
          <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
            <Link to={`../jobs/${job.id}`}>Open Job</Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const InspectionCard = ({ row }) => {
    const lead = row?.lead || {};
    const job = row?.job || null;
    const customer = getCustomerName(lead);
    const status = asText(row?.status || 'draft').toLowerCase();
    const tone =
      status === 'submitted'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : status === 'completed'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-3">
            <span className="truncate">{row?.title || `Inspection - ${customer}`}</span>
            <Badge variant="outline" className={tone}>
              {status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-slate-600">
            <div className="truncate">{customer}</div>
            {job?.work_order_number ? <div className="text-xs text-slate-500">WO: {job.work_order_number}</div> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link to={`../inspections/${row.id}`}>Open</Link>
            </Button>
            <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
              <Link to={`../inspections/${row.id}/review`}>Review</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {header}

      {!technician?.id ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">No Technician Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            This account is not linked to an active technician record. `/tech` requires `technicians.user_id = auth.uid()`.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-3">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="assigned">Assigned Today</TabsTrigger>
            <TabsTrigger value="progress">In Progress</TabsTrigger>
            <TabsTrigger value="attention">Needs Attention</TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading...
              </div>
            ) : assignedToday.length === 0 ? (
              <EmptyState label="No assigned jobs scheduled for today." />
            ) : (
              assignedToday.map((job) => <JobCard key={job.id} job={job} />)
            )}
          </TabsContent>

          <TabsContent value="progress" className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading...
              </div>
            ) : draftInspections.length === 0 ? (
              <EmptyState label="No draft inspection sessions right now." />
            ) : (
              draftInspections.map((row) => <InspectionCard key={row.id} row={row} />)
            )}
          </TabsContent>

          <TabsContent value="attention" className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading...
              </div>
            ) : needsAttention.length === 0 ? (
              <EmptyState label="Nothing needs attention right now." />
            ) : (
              needsAttention.map((row) => <InspectionCard key={row.id} row={row} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

