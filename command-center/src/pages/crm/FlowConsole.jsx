import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { expandLegacyJobStatuses } from '@/lib/jobStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCcw } from 'lucide-react';

const isMissingRelationError = (error) => {
  const combined = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return (
    combined.includes('schema cache') ||
    combined.includes('could not find the table') ||
    combined.includes('does not exist') ||
    combined.includes('relation') ||
    error?.code === '42P01' ||
    error?.code === 'PGRST205'
  );
};

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const formatTracking = (value) => {
  const raw = String(value ?? '').trim();
  return raw ? raw.toUpperCase() : '';
};

const toCrmLink = ({ tenantId, entityType, entityId }) => {
  const safeTenant = (tenantId || 'tvg').toLowerCase();
  const type = (entityType || '').toLowerCase();

  if (type === 'invoice' && entityId) return `/${safeTenant}/crm/invoices/${entityId}`;
  if (type === 'quote' && entityId) return `/${safeTenant}/crm/estimates/${entityId}`;

  if (type === 'job') return `/${safeTenant}/crm/jobs`;
  if (type === 'lead' || type === 'contact') return `/${safeTenant}/crm/leads`;

  return `/${safeTenant}/crm`;
};

const EmptyState = ({ children }) => <div className="text-sm text-slate-500">{children}</div>;

const SectionError = ({ title, error }) => {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="mt-3">
      <AlertDescription>
        <span className="font-semibold">{title}:</span> {error.message || 'Unknown error'}
      </AlertDescription>
    </Alert>
  );
};

const FlowConsole = () => {
  const { tenantId: tenantIdParam } = useParams();
  const tenantId = (tenantIdParam || 'tvg').toLowerCase();
  const { user, loading: authLoading } = useSupabaseAuth();

  const [refreshing, setRefreshing] = useState(false);

  const [nowQueue, setNowQueue] = useState([]);
  const [nowQueueUnavailable, setNowQueueUnavailable] = useState(false);
  const [nowQueueError, setNowQueueError] = useState(null);

  const [jobsToSchedule, setJobsToSchedule] = useState([]);
  const [jobsError, setJobsError] = useState(null);

  const [quotesNeedingResponse, setQuotesNeedingResponse] = useState([]);
  const [quotesError, setQuotesError] = useState(null);

  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [invoicesError, setInvoicesError] = useState(null);

  const [activeSuspensions, setActiveSuspensions] = useState([]);
  const [suspensionsUnavailable, setSuspensionsUnavailable] = useState(false);
  const [suspensionsError, setSuspensionsError] = useState(null);

  const [openTasks, setOpenTasks] = useState([]);
  const [tasksUnavailable, setTasksUnavailable] = useState(false);
  const [tasksError, setTasksError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('currentTenantId', tenantId);
    } catch {
      // ignore
    }
  }, [tenantId]);

  const loadNowQueue = async () => {
    setNowQueueError(null);
    try {
      const { data, error } = await supabase
        .from('now_queue')
        .select('priority, subpriority, item_type, entity_id, title, created_at, due_at')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true })
        .order('subpriority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        if (isMissingRelationError(error)) {
          setNowQueueUnavailable(true);
          setNowQueue([]);
          return;
        }
        throw error;
      }

      setNowQueueUnavailable(false);
      setNowQueue(data || []);
    } catch (error) {
      setNowQueueError(error);
      setNowQueue([]);
    }
  };

  const loadJobsToSchedule = async () => {
    setJobsError(null);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, status, created_at, quote_id, lead_id')
        .eq('tenant_id', tenantId)
        .in('status', expandLegacyJobStatuses(['unscheduled', 'pending_schedule']))
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setJobsToSchedule(data || []);
    } catch (error) {
      setJobsError(error);
      setJobsToSchedule([]);
    }
  };

  const loadQuotesNeedingResponse = async () => {
    setQuotesError(null);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, total_amount, valid_until, viewed_at, accepted_at, rejected_at, created_at, lead_id')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .is('rejected_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setQuotesNeedingResponse(data || []);
    } catch (error) {
      setQuotesError(error);
      setQuotesNeedingResponse([]);
    }
  };

  const loadUnpaidInvoices = async () => {
    setInvoicesError(null);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total_amount, balance_due, due_date, viewed_at, paid_at, created_at, lead_id')
        .eq('tenant_id', tenantId)
        .is('paid_at', null)
        .gt('balance_due', 0)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setUnpaidInvoices(data || []);
    } catch (error) {
      setInvoicesError(error);
      setUnpaidInvoices([]);
    }
  };

  const loadSuspensions = async () => {
    setSuspensionsError(null);
    try {
      const { data, error } = await supabase
        .from('automation_suspensions')
        .select('id, entity_type, entity_id, reason, suspended_at, resumed_at')
        .eq('tenant_id', tenantId)
        .is('resumed_at', null)
        .order('suspended_at', { ascending: false })
        .limit(10);

      if (error) {
        if (isMissingRelationError(error)) {
          setSuspensionsUnavailable(true);
          setActiveSuspensions([]);
          return;
        }
        throw error;
      }

      setSuspensionsUnavailable(false);
      setActiveSuspensions(data || []);
    } catch (error) {
      setSuspensionsError(error);
      setActiveSuspensions([]);
    }
  };

  const loadOpenTasks = async () => {
    setTasksError(null);
    try {
      const { data, error } = await supabase
        .from('crm_tasks')
        .select('id, title, status, source_type, source_id, due_at, created_at, priority')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'queued'])
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        if (isMissingRelationError(error)) {
          setTasksUnavailable(true);
          setOpenTasks([]);
          return;
        }
        throw error;
      }

      setTasksUnavailable(false);
      setOpenTasks(data || []);
    } catch (error) {
      setTasksError(error);
      setOpenTasks([]);
    }
  };

  const refresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.all([loadNowQueue(), loadJobsToSchedule(), loadQuotesNeedingResponse(), loadUnpaidInvoices(), loadSuspensions(), loadOpenTasks()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, user?.id]);

  const quickLinks = useMemo(
    () => [
      { label: 'Hub', to: `/${tenantId}/crm` },
      { label: 'Leads', to: `/${tenantId}/crm/leads` },
      { label: 'Estimates', to: `/${tenantId}/crm/estimates` },
      { label: 'Work Orders', to: `/${tenantId}/crm/jobs` },
      { label: 'Dispatch', to: `/${tenantId}/crm/dispatch` },
      { label: 'Invoices', to: `/${tenantId}/crm/invoices` }
    ],
    [tenantId]
  );

  return (
    <>
      <Helmet>
        <title>Flow Console | {tenantId.toUpperCase()} CRM</title>
      </Helmet>

      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">Flow Console</h1>
              <Badge variant="secondary">Read-only</Badge>
            </div>
            <p className="text-slate-600 mt-1">
              Orchestration lens over existing entities (Lead → Estimate → Work Order → Invoice → Payment). No parallel creation workflow lives here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={!user || authLoading || refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {!user && !authLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Flow Console uses your existing CRM data and requires authentication.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/${tenantId}/login?next=/${tenantId}/crm`}>Go to login</Link>
              </Button>
            </CardContent>
          </Card>
        ) : authLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking session...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((l) => (
                <Button key={l.to} variant="outline" asChild>
                  <Link to={l.to}>{l.label}</Link>
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Now Queue</CardTitle>
                  <CardDescription>Prioritized items needing attention (if available).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {nowQueueUnavailable ? (
                    <EmptyState>
                      `now_queue` is not available in this environment yet. Apply the Appendix A Exec-3 migration (or refresh the schema cache) to enable it.
                    </EmptyState>
                  ) : nowQueue.length === 0 ? (
                    <EmptyState>No items returned.</EmptyState>
                  ) : (
                    <ul className="space-y-2">
                      {nowQueue.map((item) => {
                        const to = toCrmLink({ tenantId, entityType: item.item_type, entityId: item.entity_id });
                        return (
                          <li key={`${item.item_type}:${item.entity_id}`} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{item.title}</div>
                              <div className="text-xs text-slate-500 capitalize">
                                {item.item_type} • priority {item.priority}.{item.subpriority}
                              </div>
                              {item.due_at ? <div className="text-xs text-slate-500">Due: {formatDateTime(item.due_at)}</div> : null}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-xs text-slate-500 whitespace-nowrap">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                              </div>
                              <Button size="sm" variant="outline" asChild>
                                <Link to={to}>Open</Link>
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <SectionError title="Now Queue" error={nowQueueError} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Work Orders to Schedule</CardTitle>
                  <CardDescription>Schedule-ready work orders awaiting dispatch (UNSCHEDULED / pending_schedule).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {jobsToSchedule.length === 0 ? (
                    <EmptyState>No unscheduled work orders found.</EmptyState>
                  ) : (
                    <ul className="space-y-2">
                      {jobsToSchedule.map((job) => (
                        <li key={job.id} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{formatTracking(job.id)}</div>
                            <div className="text-xs text-slate-500">
                              Status: <span className="font-medium">{job.status}</span>
                            </div>
                            {job.created_at ? <div className="text-xs text-slate-500">Created: {formatDateTime(job.created_at)}</div> : null}
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/${tenantId}/crm/dispatch`}>Dispatch</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <SectionError title="Work Orders" error={jobsError} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estimates Awaiting Response</CardTitle>
                  <CardDescription>Estimates that are sent/viewed but not yet accepted or declined.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quotesNeedingResponse.length === 0 ? (
                    <EmptyState>No pending estimates found.</EmptyState>
                  ) : (
                    <ul className="space-y-2">
                      {quotesNeedingResponse.map((q) => (
                        <li key={q.id} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{formatTracking(q.quote_number || q.id)}</div>
                            <div className="text-xs text-slate-500">
                              Status: <span className="font-medium">{q.status}</span>
                              {q.viewed_at ? <span className="ml-2 text-emerald-700">Viewed</span> : null}
                            </div>
                            {q.valid_until ? <div className="text-xs text-slate-500">Valid until: {new Date(q.valid_until).toLocaleDateString()}</div> : null}
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/${tenantId}/crm/estimates/${q.id}`}>Open</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <SectionError title="Estimates" error={quotesError} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Unpaid Invoices</CardTitle>
                  <CardDescription>Invoices with an outstanding balance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {unpaidInvoices.length === 0 ? (
                    <EmptyState>No unpaid invoices found.</EmptyState>
                  ) : (
                    <ul className="space-y-2">
                      {unpaidInvoices.map((inv) => (
                        <li key={inv.id} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{formatTracking(inv.invoice_number || inv.id)}</div>
                            <div className="text-xs text-slate-500">
                              Status: <span className="font-medium">{inv.status}</span>
                              {inv.viewed_at ? <span className="ml-2 text-emerald-700">Viewed</span> : null}
                            </div>
                            {inv.due_date ? <div className="text-xs text-slate-500">Due: {new Date(inv.due_date).toLocaleDateString()}</div> : null}
                            <div className="text-xs text-slate-500">Balance due: {inv.balance_due}</div>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/${tenantId}/crm/invoices/${inv.id}`}>Open</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <SectionError title="Invoices" error={invoicesError} />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Active Suspensions</CardTitle>
                  <CardDescription>Automation suspensions created by human signals (if available).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suspensionsUnavailable ? (
                    <EmptyState>`automation_suspensions` is not available in this environment.</EmptyState>
                  ) : activeSuspensions.length === 0 ? (
                    <EmptyState>No active suspensions.</EmptyState>
                  ) : (
                    <ul className="space-y-2">
                      {activeSuspensions.map((s) => (
                        <li key={s.id} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {s.entity_type}:{formatTracking(s.entity_id)}
                            </div>
                            <div className="text-xs text-slate-500">Reason: {s.reason}</div>
                            <div className="text-xs text-slate-500">Since: {formatDateTime(s.suspended_at)}</div>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={toCrmLink({ tenantId, entityType: s.entity_type, entityId: s.entity_id })}>Open</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <SectionError title="Suspensions" error={suspensionsError} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Open Tasks</CardTitle>
                  <CardDescription>Operator follow-ups generated by Money Loop events (if available).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tasksUnavailable ? (
                    <EmptyState>`crm_tasks` is not available in this environment.</EmptyState>
                  ) : openTasks.length === 0 ? (
                    <EmptyState>No open tasks returned.</EmptyState>
                  ) : (
                    <ul className="space-y-2">
                      {openTasks.map((t) => {
                        const to = toCrmLink({ tenantId, entityType: t.source_type, entityId: t.source_id });
                        return (
                          <li key={t.id} className="flex items-start justify-between gap-3 rounded border bg-white p-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{t.title}</div>
                              <div className="text-xs text-slate-500 capitalize">
                                {t.source_type} • {t.status}
                                {t.priority ? <span className="ml-2">• p{t.priority}</span> : null}
                              </div>
                              {t.due_at ? <div className="text-xs text-slate-500">Due: {formatDateTime(t.due_at)}</div> : null}
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={to}>Open</Link>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <SectionError title="Tasks" error={tasksError} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default FlowConsole;
