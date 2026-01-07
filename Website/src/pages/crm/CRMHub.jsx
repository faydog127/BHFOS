
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
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import HubCalendar from '@/components/crm/HubCalendar';

// NOTE: Visual Editor plugin imports are intentionally omitted here.
// The visual-editor plugin logic should only be enabled via feature flags or strictly gated environments
// to prevent MIME type errors or load failures in production.

const StatCard = ({ title, value, icon: Icon, color, loading, subtext, link }) => (
  <Link to={link || "#"} className={link ? "cursor-pointer" : "cursor-default"}>
    <Card className="hover:bg-slate-50 transition-colors h-full">
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
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
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
    queued_jobs: 0
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch Stats in parallel using specific Tenant ID and Hub Filters
        const promises = [
          // Leads: All active leads
          supabase.from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .not('status', 'eq', 'archived'),
            
          // Proposals: Waiting Approval OR Expired
          supabase.from('quotes')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .in('status', ['sent', 'viewed', 'pending_review', 'expired']),
            
          // Active Jobs: Scheduled, In Progress, On Hold
          supabase.from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .in('status', ['scheduled', 'in_progress', 'en_route', 'on_hold', 'pending_schedule']),
            
          // Unpaid Invoices: Sent, Partial, Overdue
          supabase.from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .in('status', ['sent', 'partial', 'overdue']),

          // Queued System Jobs
          supabase.from('event_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'queued'),

          // Recent Activity
          supabase
            .from('activity_log')
            .select(`
              *,
              leads (first_name, last_name, company)
            `)
            .order('created_at', { ascending: false })
            .limit(8)
        ];

        const [leadsRes, quotesRes, jobsRes, invoicesRes, queuedRes, activityRes] = await Promise.all(promises);

        if (mounted) {
          setStats({
            leads: leadsRes.count || 0,
            quotes: quotesRes.count || 0,
            jobs: jobsRes.count || 0,
            invoices: invoicesRes.count || 0,
            queued_jobs: queuedRes.count || 0
          });

          if (activityRes.data) {
            setActivities(activityRes.data);
          }
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // We do NOT block rendering on stats failure, UI just shows 0 or loading state if persisted
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { mounted = false; };
  }, [tenantId]);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back, {userName}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here's what's happening today in {tenantId.toUpperCase()}.
          </p>
        </div>
        <div className="flex gap-2">
          {flags.enableLeads && (
            <Button asChild>
              <Link to={`/${tenantId}/crm/leads`}>
                <Plus className="mr-2 h-4 w-4" /> New Lead
              </Link>
            </Button>
          )}
          {flags.enableEstimates && (
            <Button variant="outline" asChild>
              <Link to={`/${tenantId}/crm/proposals/new`}>
                <Plus className="mr-2 h-4 w-4" /> New Proposal
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            title="Proposals" 
            value={stats.quotes} 
            icon={FileText} 
            color="text-orange-500" 
            loading={loading}
            subtext="Waiting Approval / Expired"
            link={`/${tenantId}/crm/proposals?status=actionable`}
          />
        )}
        {flags.enableJobs && (
          <StatCard 
            title="Active Jobs" 
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

      <div className="grid gap-4 md:grid-cols-12">
        {/* Main Content Area: Calendar & Actions */}
        <div className="md:col-span-8 space-y-6">
           {/* HubCalendar handles its own errors internally */}
           {flags.enableSchedule && (
             <HubCalendar />
           )}

           {/* Quick Actions Card */}
           <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks to manage your workflow</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {flags.enableJobs && (
                <Link to={`/${tenantId}/crm/schedule`} className="group block p-4 border rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-300">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold group-hover:text-green-600 transition-colors">View Schedule</h3>
                  </div>
                  <p className="text-sm text-gray-500">Jump to calendar view.</p>
                </Link>
              )}

              {flags.enablePipeline && (
                <Link to={`/${tenantId}/crm/pipeline`} className="group block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold group-hover:text-blue-600 transition-colors">View Pipeline</h3>
                  </div>
                  <p className="text-sm text-gray-500">Track lead status.</p>
                </Link>
              )}

              {flags.enableReporting && (
                <Link to={`/${tenantId}/crm/reporting`} className="group block p-4 border rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-300">
                      <Activity className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold group-hover:text-purple-600 transition-colors">Performance Reports</h3>
                  </div>
                  <p className="text-sm text-gray-500">Analyze business metrics.</p>
                </Link>
              )}

              {flags.enableSettings && (
                <Link to={`/${tenantId}/crm/settings`} className="group block p-4 border rounded-lg hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                      <Users className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Team Settings</h3>
                  </div>
                  <p className="text-sm text-gray-500">Manage user access.</p>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Feed */}
        <div className="md:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your team</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
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
                      <div className="mt-1 bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full h-fit">
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
                            {activity.leads.first_name} {activity.leads.last_name} {activity.leads.company ? `(${activity.leads.company})` : ''}
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
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CRMHub;
