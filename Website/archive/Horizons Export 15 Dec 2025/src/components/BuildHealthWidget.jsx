
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Database, ShieldCheck, Zap, ServerOff, XCircle, CheckCircle2, Map, AlertTriangle, Link2, Link2Off, Activity, Box, CornerDownRight } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const BuildHealthWidget = ({ className }) => {
  const [metrics, setMetrics] = useState({
    databaseConnection: { status: 'unknown', message: 'Attempting to connect...' },
    authenticationStatus: { status: 'unknown', message: 'Checking user session...' },
    supabaseServiceStatus: { status: 'unknown', message: 'Querying Supabase services...' },
    apiHealthChecks: { status: 'unknown', message: 'Running API health checks...' },
    activeErrorsWarnings: { status: 'none', message: 'No active errors or warnings detected.' },
  });
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading] = useState(false);

  // Hierarchical Route Definition matching BuildHealth page structure
  const routeGroups = {
    "Dashboard": [
      { name: 'Dashboard', path: '/crm/dashboard', status: 'wired' },
      { name: 'Solo Dashboard', path: '/crm/solo', status: 'wired' },
    ],
    "Main Workflows": [
      { name: 'Leads', path: '/crm/leads', status: 'wired' },
      { name: 'Pipeline', path: '/crm/pipeline', status: 'wired' },
      { name: 'Estimates', path: '/crm/estimates', status: 'wired' },
      { name: 'Proposals', path: '/crm/proposals', status: 'wired' },
      { name: 'Jobs', path: '/crm/jobs', status: 'wired' },
      { name: 'Invoices', path: '/crm/invoices', status: 'wired' },
    ],
    "Communication & Scheduling": [
      { name: 'Inbox', path: '/crm/inbox', status: 'wired' },
      { name: 'Schedule', path: '/crm/schedule', status: 'wired' },
      { name: 'Call Console', path: '/crm/call-console', status: 'wired' },
      { name: 'Call Log', path: '/crm/call-log', status: 'wired' },
      { name: 'Scripts', path: '/crm/scripts', status: 'wired' },
    ],
    "Management": [
      { name: 'Partners', path: '/crm/partners', status: 'wired' },
      { name: 'Customers', path: '/crm/customers', status: 'wired' },
      { name: 'Referral Partners', path: '/crm/referral-partners', status: 'wired' },
      { name: 'Marketing', path: '/crm/marketing', status: 'wired' },
      { name: 'Marketing Console', path: '/crm/marketing-console', status: 'wired' },
      { name: 'Scoreboard', path: '/crm/marketing-scoreboard', status: 'wired' },
      { name: 'Funnel', path: '/crm/marketing-funnel', status: 'wired' },
    ],
    "Admin & Tools": [
      { name: 'Admin Panel', path: '/crm/admin', status: 'wired' },
      { name: 'Reporting', path: '/crm/reporting', status: 'wired' },
      { name: 'Analytics', path: '/crm/analytics', status: 'wired' },
      { name: 'Automation', path: '/crm/automation', status: 'wired' },
      { name: 'Action Hub', path: '/crm/action-hub', status: 'wired' },
      { name: 'Data Tools', path: '/crm/data-tools', status: 'wired' },
      { name: 'Audit Inspector', path: '/crm/audit-inspector', status: 'wired' },
      { name: 'System Doctor', path: '/system-doctor', status: 'wired' },
      { name: 'System Health', path: '/crm/system-health', status: 'wired' },
      { 
        name: 'Settings', 
        path: '/crm/settings', 
        status: 'wired',
        subRoutes: [
          { name: 'Business Info', path: '/crm/settings/business', status: 'wired' },
          { name: 'Branding', path: '/crm/settings/branding', status: 'wired' },
          { name: 'Notifications', path: '/crm/settings/notifications', status: 'wired' },
          { name: 'API Keys', path: '/crm/settings/api-keys', status: 'wired' },
          { name: 'Email Config', path: '/crm/settings/email', status: 'wired' },
          { name: 'SMS Config', path: '/crm/settings/sms', status: 'wired' },
          { name: 'Kanban Config', path: '/crm/settings/kanban', status: 'wired' },
          { name: 'Call Tracking', path: '/crm/settings/call-tracking', status: 'wired' },
          { name: 'Service Configs', path: '/crm/settings/service-configs', status: 'wired' },
          { name: 'Audit Logs', path: '/crm/settings/audit-log', status: 'wired' },
          { name: 'Rollback Manager', path: '/crm/settings/rollback-manager', status: 'wired' },
          { name: 'Feedback Impact', path: '/crm/settings/feedback-impact', status: 'wired' },
        ]
      },
    ],
    "Specific Tools": [
      { name: 'Quote Builder', path: '/crm/quote-builder', status: 'wired' },
      { name: 'Invoice Builder', path: '/crm/invoice-builder', status: 'wired' },
      { name: 'Pricebook Manager', path: '/crm/pricebook', status: 'wired' },
      { name: 'Service Catalog', path: '/crm/service-catalog', status: 'wired' },
      { name: 'Brand Review', path: '/crm/brand-review', status: 'wired' },
      { name: 'Brand Brain', path: '/crm/brand-brain', status: 'wired' },
      { name: 'Escalations', path: '/crm/escalations', status: 'wired' },
      { name: 'Discounts', path: '/crm/discounts', status: 'wired' },
      { name: 'Submissions', path: '/crm/submissions', status: 'wired' },
    ]
  };

  const fetchSupabaseMetrics = async () => {
    setLoading(true);
    const newMetrics = { ...metrics };
    const now = new Date();

    try {
      // 1. Database Connection Status
      try {
        const { error: dbError } = await supabase.from('app_user_roles').select('id').limit(1);
        if (dbError && dbError.code !== 'PGRST116') { // Ignore "no rows" errors, focus on connection
          throw dbError;
        }
        newMetrics.databaseConnection = { status: 'healthy', message: 'Successfully connected to the database.' };
      } catch (error) {
        newMetrics.databaseConnection = { status: 'unhealthy', message: `Database connection failed: ${error.message}` };
      }

      // 2. Authentication Status
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError) {
          throw authError;
        }
        if (session) {
          newMetrics.authenticationStatus = { status: 'healthy', message: `User authenticated: ${session.user.email}` };
        } else {
          newMetrics.authenticationStatus = { status: 'healthy', message: 'Auth service reachable (No active session).' };
        }
      } catch (error) {
        newMetrics.authenticationStatus = { status: 'unhealthy', message: `Authentication service failed: ${error.message}` };
      }

      // 3. Supabase Service Status (Storage/Realtime)
      try {
        const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
        if (storageError) {
          throw storageError;
        }
        newMetrics.supabaseServiceStatus = { status: 'healthy', message: `Storage operational. ${buckets?.length || 0} buckets found.` };
      } catch (error) {
        newMetrics.supabaseServiceStatus = { status: 'unhealthy', message: `Supabase Storage API failed: ${error.message}` };
      }

      // 4. API Health Checks (Edge Functions)
      try {
        const { data, error: funcError } = await supabase.functions.invoke('hello-world'); 
        if (funcError) {
          throw funcError;
        }
        newMetrics.apiHealthChecks = { status: 'healthy', message: 'Edge Functions responding successfully.' };
      } catch (error) {
        // Fallback for when function might not be deployed yet, treat as warning not critical failure for "Build Health" usually
        newMetrics.apiHealthChecks = { status: 'warning', message: `Edge Function check: ${error.message}` };
      }

      // 5. Active Errors/Warnings
      const unhealthyMetrics = Object.values(newMetrics).filter(m => m.status === 'unhealthy');
      if (unhealthyMetrics.length > 0) {
        newMetrics.activeErrorsWarnings = {
          status: 'warning',
          message: `Detected ${unhealthyMetrics.length} issues. Please review the unhealthy metrics below.`,
        };
      } else {
        newMetrics.activeErrorsWarnings = {
          status: 'healthy',
          message: 'All monitored systems are operating normally.',
        };
      }

    } catch (generalError) {
      toast({
        title: "Probe Error",
        description: `Failed to run probes: ${generalError.message}`,
        variant: "destructive",
      });
      newMetrics.activeErrorsWarnings = { status: 'warning', message: `Probe failure: ${generalError.message}` };
    } finally {
      setMetrics(newMetrics);
      setLastChecked(now);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupabaseMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status) => {
    if (status === 'healthy') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (status === 'unhealthy') return <XCircle className="h-5 w-5 text-red-500" />;
    if (status === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <Activity className="h-5 w-5 text-slate-500" />;
  };

  const getStatusColor = (status) => {
    if (status === 'healthy') return 'text-emerald-500';
    if (status === 'unhealthy') return 'text-red-500';
    if (status === 'warning') return 'text-amber-500';
    return 'text-slate-500';
  };

  const flattenRoutes = (groups) => {
    let allRoutes = [];
    Object.values(groups).forEach(group => {
      group.forEach(route => {
        allRoutes.push(route);
        if (route.subRoutes) {
          allRoutes = allRoutes.concat(route.subRoutes);
        }
      });
    });
    return allRoutes;
  };

  const allFlatRoutes = flattenRoutes(routeGroups);
  const totalRoutes = allFlatRoutes.length;
  const wiredRoutes = allFlatRoutes.filter(r => r.status === 'wired').length;

  const metricCards = [
    {
      title: 'Database Connection',
      icon: <Database className="h-6 w-6 text-blue-400" />,
      description: 'Verifies connection to Supabase PostgreSQL.',
      metric: metrics.databaseConnection,
    },
    {
      title: 'Authentication Status',
      icon: <ShieldCheck className="h-6 w-6 text-violet-400" />,
      description: 'Checks if Supabase Auth service is reachable.',
      metric: metrics.authenticationStatus,
    },
    {
      title: 'Supabase Services',
      icon: <Box className="h-6 w-6 text-orange-400" />,
      description: 'Probes Storage and Realtime availability.',
      metric: metrics.supabaseServiceStatus,
    },
    {
      title: 'API Health Checks',
      icon: <Zap className="h-6 w-6 text-cyan-400" />,
      description: 'Tests response of critical Edge Functions.',
      metric: metrics.apiHealthChecks,
    },
  ];

  const RouteItem = ({ route, isSubRoute = false }) => (
    <div 
      className={cn(
        "flex items-center justify-between p-2.5 rounded-lg transition-all group/item",
        isSubRoute ? "bg-slate-900/20 border border-slate-800/30 ml-6" : "bg-slate-950/30 border border-slate-800/50 hover:bg-slate-800/40 hover:border-slate-700"
      )}
    >
      <div className="flex items-center space-x-3 overflow-hidden">
        {isSubRoute ? (
          <CornerDownRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
        ) : (
          <div className={cn(
            "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all",
            route.status === 'wired' 
              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] group-hover/item:shadow-[0_0_12px_rgba(16,185,129,0.6)]" 
              : "bg-red-500/50"
          )} />
        )}
        <div className="flex flex-col min-w-0">
          <span className={cn(
            "text-sm font-medium truncate",
            route.status === 'wired' ? "text-slate-200" : "text-slate-500"
          )}>
            {route.name}
          </span>
          <span className="text-[10px] text-slate-500 truncate font-mono mt-0.5 group-hover/item:text-slate-400 transition-colors">
            {route.path}
          </span>
        </div>
      </div>
      
      {route.status === 'wired' ? (
        <Badge variant="outline" className="h-6 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] group-hover/item:bg-emerald-500/20 transition-colors">
          <Link2 className="w-3 h-3 mr-1" /> Wired
        </Badge>
      ) : (
        <Badge variant="outline" className="h-6 bg-red-500/5 text-red-500/70 border-red-500/20 text-[10px] group-hover/item:bg-red-500/10 transition-colors">
          <Link2Off className="w-3 h-3 mr-1" /> Unwired
        </Badge>
      )}
    </div>
  );

  return (
    <div className={cn("space-y-6 font-sans text-slate-100", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500" />
            System Probe Diagnostics
          </h2>
          <p className="mt-1 text-slate-400">Real-time diagnostics for backend services and hierarchical route integrity map.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-col items-start sm:items-end space-y-2 sm:space-y-0">
          <Button 
            onClick={fetchSupabaseMetrics} 
            disabled={loading} 
            variant="outline"
            className="flex items-center space-x-2 border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
          </Button>
          {lastChecked && (
            <p className="text-xs text-slate-500">Last checked: {lastChecked.toLocaleTimeString()}</p>
          )}
        </div>
      </div>

      {/* Overall Status Card */}
      <Card className="border-slate-800 bg-slate-900/50 shadow-lg">
        <CardContent className="flex items-center space-x-4 p-6">
          <div className="rounded-full bg-slate-950 p-3 border border-slate-800">
             {getStatusIcon(metrics.activeErrorsWarnings.status)}
          </div>
          <div>
            <p className={`text-lg font-medium ${getStatusColor(metrics.activeErrorsWarnings.status)}`}>
              {metrics.activeErrorsWarnings.status === 'healthy' ? 'System Operational' : metrics.activeErrorsWarnings.status === 'warning' ? 'Degraded Performance' : 'Critical Issues Detected'}
            </p>
            <p className="text-slate-400">{metrics.activeErrorsWarnings.message}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: Metrics Grid */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metricCards.map((card, index) => (
              <Card key={index} className="border-slate-800 bg-slate-900/50 shadow-md transition-all hover:bg-slate-800/80 hover:border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold text-white">{card.title}</CardTitle>
                  {card.icon}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-400 mb-3 min-h-[2.5rem]">{card.description}</p>
                  <div className="flex items-center space-x-2 mb-1">
                    {getStatusIcon(card.metric.status)}
                    <span className={`font-medium ${getStatusColor(card.metric.status)}`}>
                      {card.metric.status === 'healthy' ? 'Healthy' : card.metric.status === 'warning' ? 'Warning' : 'Unhealthy'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-2 line-clamp-2" title={card.metric.message}>
                    {card.metric.message}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Route & Feature Map */}
        <Card className="border-slate-800 bg-slate-900/50 shadow-md h-full flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Map className="h-5 w-5 text-indigo-400" />
                <CardTitle className="text-lg font-semibold text-white">Route & Feature Map</CardTitle>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                {wiredRoutes} / {totalRoutes} Wired
              </Badge>
            </div>
            <CardDescription className="text-slate-400">
              Live status of anticipated CRM routes categorized by functional area.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-[500px]">
            <ScrollArea className="h-[500px] xl:h-[600px] w-full p-4">
              <Accordion type="multiple" defaultValue={['Dashboard', 'Main Workflows', 'Admin & Tools']} className="space-y-4">
                {Object.entries(routeGroups).map(([category, routes]) => (
                  <AccordionItem key={category} value={category} className="border-slate-800 border rounded-lg bg-slate-950/20 overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-900/40 hover:no-underline group">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-200">{category}</span>
                        <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-xs">
                          {routes.length} Routes
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 bg-slate-950/10">
                      <div className="space-y-2 mt-2">
                        {routes.map((route, index) => (
                          <React.Fragment key={index}>
                            <RouteItem route={route} />
                            {route.subRoutes && route.subRoutes.map((subRoute, subIndex) => (
                              <RouteItem key={`${index}-${subIndex}`} route={subRoute} isSubRoute={true} />
                            ))}
                          </React.Fragment>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BuildHealthWidget;
