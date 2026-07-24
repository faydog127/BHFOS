import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { getTenantId } from '@/lib/tenantUtils';
import {
  Users,
  FileText,
  Briefcase,
  AlertCircle,
  Plus,
  TrendingUp,
  Activity,
  ServerCog,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import HubCalendar from '@/components/crm/HubCalendar';
import CrmPageHeader from '@/components/crm/CrmPageHeader';
import { excludeSyntheticRows } from '@/lib/excludeSynthetic';
import { CRM_PRODUCT_NAME } from '@/config/productBrand';

const StatCard = ({ title, value, icon: Icon, color, loading, subtext, link }) => (
  <Link to={link || '#'} className={link ? 'cursor-pointer' : 'cursor-default'}>
    <Card className="h-full transition-colors hover:bg-slate-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
          </>
        )}
      </CardContent>
    </Card>
  </Link>
);

const CRMHub = () => {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const tenantId = getTenantId();

  const [stats, setStats] = useState({
    leads: 0,
    quotes: 0,
    jobs: 0,
    invoices: 0,
    queued_jobs: 0,
  });
  const [performance, setPerformance] = useState({
    closeRate: 0,
    wonQuotes: 0,
    actionedQuotes: 0,
    moneyGenerated: 0,
  });
  const [todayCue, setTodayCue] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showKpis, setShowKpis] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const promises = [
          supabase
            .from('leads')
            .select('id,is_test_data,email,first_name,last_name,company,status')
            .eq('tenant_id', tenantId)
            .not('status', 'eq', 'archived')
            .limit(500),

          supabase
            .from('quotes')
            .select('id,is_test_data,status,quote_number')
            .eq('tenant_id', tenantId)
            .in('status', ['sent', 'viewed', 'pending_review', 'expired'])
            .limit(500),

          supabase
            .from('jobs')
            .select('id,is_test_data,status,scheduled_start,service_address,work_order_number,job_number')
            .eq('tenant_id', tenantId)
            .in('status', ['scheduled', 'in_progress', 'en_route', 'on_hold', 'pending_schedule'])
            .limit(500),

          supabase
            .from('invoices')
            .select('id,is_test_data,status,total_amount,amount_paid')
            .eq('tenant_id', tenantId)
            .in('status', ['sent', 'partial', 'overdue'])
            .limit(500),

          supabase
            .from('event_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'queued'),

          supabase
            .from('activity_log')
            .select(`
              *,
              leads (first_name, last_name, company)
            `)
            .order('created_at', { ascending: false })
            .limit(8),

          supabase.from('quotes').select('id,is_test_data,status').eq('tenant_id', tenantId).limit(1000),

          supabase
            .from('invoices')
            .select('id,is_test_data,status,total_amount,amount_paid,customer_name')
            .eq('tenant_id', tenantId)
            .limit(1000),

          supabase
            .from('jobs')
            .select('id,is_test_data,status,scheduled_start,service_address,work_order_number,job_number,leads(first_name,last_name)')
            .eq('tenant_id', tenantId)
            .not('scheduled_start', 'is', null)
            .gte('scheduled_start', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .order('scheduled_start', { ascending: true })
            .limit(20),
        ];

        const [
          leadsRes,
          quotesRes,
          jobsRes,
          invoicesRes,
          queuedRes,
          activityRes,
          quoteKpiRes,
          invoiceKpiRes,
          todayJobsRes,
        ] = await Promise.all(promises);

        if (!mounted) return;

        const liveLeads = excludeSyntheticRows(leadsRes.data || []);
        const liveQuotes = excludeSyntheticRows(quotesRes.data || []);
        const liveJobs = excludeSyntheticRows(jobsRes.data || []);
        const liveUnpaid = excludeSyntheticRows(invoicesRes.data || []);

        setStats({
          leads: liveLeads.length,
          quotes: liveQuotes.length,
          jobs: liveJobs.length,
          invoices: liveUnpaid.length,
          queued_jobs: queuedRes.count || 0,
        });

        const quoteRows = excludeSyntheticRows(quoteKpiRes.data || []);
        const actionableStatuses = new Set(['sent', 'viewed', 'accepted', 'approved', 'rejected', 'declined']);
        const wonStatuses = new Set(['accepted', 'approved']);
        const actionedQuotes = quoteRows.filter((row) =>
          actionableStatuses.has(String(row.status || '').toLowerCase()),
        ).length;
        const wonQuotes = quoteRows.filter((row) =>
          wonStatuses.has(String(row.status || '').toLowerCase()),
        ).length;
        const closeRate = actionedQuotes > 0 ? (wonQuotes / actionedQuotes) * 100 : 0;

        const invoiceRows = excludeSyntheticRows(invoiceKpiRes.data || []);
        const moneyGenerated = invoiceRows.reduce((sum, row) => {
          const status = String(row.status || '').toLowerCase();
          const total = Number(row.total_amount) || 0;
          const paid = Number(row.amount_paid) || 0;
          if (status === 'paid') return sum + total;
          if (paid > 0) return sum + paid;
          return sum;
        }, 0);

        setPerformance({
          closeRate,
          wonQuotes,
          actionedQuotes,
          moneyGenerated,
        });

        const todayJobs = excludeSyntheticRows(todayJobsRes.data || []).filter((job) => {
          if (!job.scheduled_start) return false;
          try {
            return isToday(parseISO(job.scheduled_start));
          } catch {
            return false;
          }
        });
        setTodayCue(todayJobs[0] || null);

        if (activityRes.data) {
          setActivities(activityRes.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  const userName =
    user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  const todayLabel = todayCue
    ? (() => {
        const lead = todayCue.leads || {};
        const name =
          `${lead.first_name || ''} ${lead.last_name || ''}`.trim() ||
          todayCue.work_order_number ||
          todayCue.job_number ||
          'Work order';
        const when = todayCue.scheduled_start
          ? format(parseISO(todayCue.scheduled_start), 'h:mm a')
          : '';
        return { name, when, address: todayCue.service_address || '' };
      })()
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <CrmPageHeader
        title={`${CRM_PRODUCT_NAME}`}
        description={`Welcome back, ${userName}. Here's today in ${tenantId.toUpperCase()}.`}
        breadcrumbs={[{ label: 'Hub' }]}
        actions={(
          <div className="flex gap-2">
            {flags.enableLeads && (
              <Button asChild>
                <Link to={`/${tenantId}/crm/leads`}>
                  <Plus className="mr-2 h-4 w-4" /> New Lead
                </Link>
              </Button>
            )}
            {flags.enableEstimates && (
              <Button asChild>
                <Link to={`/${tenantId}/crm/quotes/new`}>
                  <Plus className="mr-2 h-4 w-4" /> New Quote
                </Link>
              </Button>
            )}
          </div>
        )}
      />

      {/* UXV2: Today hero — single first-viewport composition */}
      <section
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-[hsl(var(--brand-accent)/0.08)] p-6 md:p-8"
        data-testid="hub-today-hero"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Today</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          {loading ? 'Loading today’s plan…' : todayLabel ? `Next up · ${todayLabel.name}` : 'No jobs scheduled yet today'}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {loading
            ? 'Pulling live schedule and money cues.'
            : todayLabel
              ? [todayLabel.when, todayLabel.address].filter(Boolean).join(' · ')
              : 'Create a quote or open Dispatch when booked work is ready to run.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {flags.enableJobs && (
            <Button variant="outline" asChild>
              <Link to={`/${tenantId}/crm/dispatch`}>
                <Calendar className="mr-2 h-4 w-4" /> Open Dispatch
              </Link>
            </Button>
          )}
          {flags.enableInvoicing && (
            <Button variant="outline" asChild>
              <Link to={`/${tenantId}/crm/invoices`}>
                <DollarSign className="mr-2 h-4 w-4" /> Invoices
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 gap-1 text-slate-600"
          aria-expanded={showKpis}
          aria-controls="hub-kpi-panel"
          onClick={() => setShowKpis((v) => !v)}
        >
          {showKpis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showKpis ? 'Hide performance KPIs' : 'Show performance KPIs'}
        </Button>

        {showKpis ? (
          <div
            id="hub-kpi-panel"
            className="grid grid-flow-col auto-cols-[minmax(11rem,1fr)] gap-3 overflow-x-auto pb-1 md:grid-flow-row md:auto-cols-auto md:grid-cols-2 lg:grid-cols-5"
          >
            <StatCard
              title="Close Rate"
              value={`${performance.closeRate.toFixed(1)}%`}
              icon={TrendingUp}
              color="text-emerald-500"
              loading={loading}
              subtext={`${performance.wonQuotes}/${performance.actionedQuotes} actioned quotes won`}
              link={`/${tenantId}/crm/quotes?status=accepted`}
            />
            <StatCard
              title="Money Generated"
              value={`$${performance.moneyGenerated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
              color="text-green-600"
              loading={loading}
              subtext="Paid + partial collected"
              link={`/${tenantId}/crm/invoices?status=all`}
            />
            {flags.enableLeads && (
              <StatCard
                title="Total Leads"
                value={stats.leads}
                icon={Users}
                color="text-blue-500"
                loading={loading}
                subtext="Active pipeline"
                link={`/${tenantId}/crm/leads?status=all`}
              />
            )}
            {flags.enableEstimates && (
              <StatCard
                title="Quotes"
                value={stats.quotes}
                icon={FileText}
                color="text-orange-500"
                loading={loading}
                subtext="Waiting acceptance / Expired"
                link={`/${tenantId}/crm/quotes?status=waiting_approval,expired`}
              />
            )}
            {flags.enableJobs && (
              <StatCard
                title="Active Work Orders"
                value={stats.jobs}
                icon={Briefcase}
                color="text-green-500"
                loading={loading}
                subtext="Scheduled, In Progress, On Hold"
                link={`/${tenantId}/crm/jobs?status=active`}
              />
            )}
            {flags.enableInvoicing && (
              <StatCard
                title="Unpaid Invoices"
                value={stats.invoices}
                icon={AlertCircle}
                color="text-red-500"
                loading={loading}
                subtext="Unpaid / Overdue"
                link={`/${tenantId}/crm/invoices?status=unpaid`}
              />
            )}
            <StatCard
              title="System Queue"
              value={stats.queued_jobs}
              icon={ServerCog}
              color="text-slate-500"
              loading={loading}
              subtext="Background jobs"
              link={`/${tenantId}/crm/ops`}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <div className="space-y-6 md:col-span-8">
          {flags.enableSchedule && <HubCalendar />}

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks to manage your workflow</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Link
                to={`/${tenantId}/crm/money`}
                className="group block rounded-lg border p-4 transition-all hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <Activity className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold transition-colors group-hover:text-slate-900 dark:group-hover:text-white">
                    Flow Console
                  </h3>
                </div>
                <p className="text-sm text-gray-500">Money Loop lens: next actions, suspensions, and priorities.</p>
              </Link>

              {flags.enableJobs && (
                <Link
                  to={`/${tenantId}/crm/dispatch`}
                  className="group block rounded-lg border p-4 transition-all hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold transition-colors group-hover:text-green-600">Open Dispatch</h3>
                  </div>
                  <p className="text-sm text-gray-500">Run booked work, assignments, and blockers.</p>
                </Link>
              )}

              {flags.enablePipeline && (
                <Link
                  to={`/${tenantId}/crm/opportunities`}
                  className="group block rounded-lg border p-4 transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold transition-colors group-hover:text-blue-600">View Opportunities</h3>
                  </div>
                  <p className="text-sm text-gray-500">Advance qualified work without mixing it with intake.</p>
                </Link>
              )}

              {flags.enableReporting && (
                <Link
                  to={`/${tenantId}/crm/reporting`}
                  className="group block rounded-lg border p-4 transition-all hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      <Activity className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold transition-colors group-hover:text-slate-900">Performance Reports</h3>
                  </div>
                  <p className="text-sm text-gray-500">Analyze business metrics.</p>
                </Link>
              )}

              {flags.enableSettings && (
                <Link
                  to={`/${tenantId}/crm/settings`}
                  className="group block rounded-lg border p-4 transition-all hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      <Users className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold transition-colors group-hover:text-gray-900 dark:group-hover:text-white">
                      Team Settings
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500">Manage user access.</p>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your team</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-6">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="mt-1 h-fit rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                        <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.type?.replace('_', ' ').toUpperCase() || 'UPDATE'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {activity.note || 'No details available'}
                        </p>
                        {activity.leads && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {activity.leads.first_name} {activity.leads.last_name}{' '}
                            {activity.leads.company ? `(${activity.leads.company})` : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No recent activity found.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CRMHub;
