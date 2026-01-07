import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { expectedRoutePaths } from '@/pages/crm/routeManifest';
import { actualRoutePaths } from '@/pages/Crm';

const tablesToCheck = [
  'system_audit_log',
  'remediation_step_log',
  'app_user_roles',
  'system_settings',
];

const functionsToCheck = [
  'execute_remediation_plan',
  'preview_rollback_plan',
  'system-doctor',
];

// Expected routes grouped hierarchically
const featureTree = [
  {
    group: 'Dashboard',
    items: [
      { name: 'Home', path: '/crm' },
    ],
  },
  {
    group: 'Main Workflows',
    items: [
      { name: 'Pipeline', path: '/crm/pipeline' },
      { name: 'Leads', path: '/crm/leads' },
      { name: 'Estimates', path: '/crm/estimates' },
      { name: 'Proposals', path: '/crm/proposals' },
      { name: 'Referrals', path: '/crm/referrals' },
      { name: 'Partners', path: '/crm/partners' },
    ],
  },
  {
    group: 'Communication & Scheduling',
    items: [
      { name: 'Inbox', path: '/crm/inbox' },
      { name: 'Schedule', path: '/crm/schedule' },
      { name: 'Call Console', path: '/crm/call-console' },
      { name: 'Call Log', path: '/crm/call-log' },
      { name: 'Call Scripts', path: '/crm/call-scripts' },
    ],
  },
  {
    group: 'Management',
    items: [
      { name: 'Customers', path: '/crm/customers' },
      { name: 'Marketing', path: '/crm/marketing' },
      { name: 'Marketing Console', path: '/crm/marketing/console' },
      { name: 'Marketing Funnel', path: '/crm/marketing/funnel' },
      { name: 'Marketing Scoreboard', path: '/crm/marketing/scoreboard' },
      { name: 'Reporting', path: '/crm/reporting' },
      { name: 'Analytics', path: '/crm/analytics' },
      { name: 'Audit Inspector', path: '/crm/audit-inspector' },
      { name: 'Automation', path: '/crm/automation' },
      { name: 'Discounts', path: '/crm/discounts' },
      { name: 'Escalations', path: '/crm/escalations' },
      { name: 'Pricebook Manager', path: '/crm/pricebook-manager' },
      { name: 'Invoice Builder', path: '/crm/invoice-builder' },
      { name: 'Invoices', path: '/crm/invoices' },
      { name: 'Service Catalog', path: '/crm/service-catalog' },
      { name: 'System Health', path: '/crm/system-health' },
      { name: 'System Doctor', path: '/crm/system-doctor' },
    ],
  },
  {
    group: 'Admin & Tools',
    items: [
      { name: 'Settings', path: '/crm/settings' },
      { name: 'Admin Panel', path: '/crm/admin' },
      { name: 'Submissions', path: '/crm/submissions' },
      { name: 'Data Tools', path: '/crm/data-tools' },
      { name: 'Brand Review', path: '/crm/brand-review' },
      { name: 'Brand Brain', path: '/crm/brand-brain' },
    ],
  },
  {
    group: 'Specific Tools',
    items: [
      { name: 'Chat Settings', path: '/crm/chat-settings' },
    ],
  },
  {
    group: 'Settings Subroutes',
    items: [
      { name: 'Business', path: '/crm/settings/business' },
      { name: 'Branding', path: '/crm/settings/branding' },
      { name: 'Service Configurations', path: '/crm/settings/service-configurations' },
      { name: 'API Keys', path: '/crm/settings/api-keys' },
      { name: 'Email Templates', path: '/crm/settings/email-templates' },
      { name: 'SMS Templates', path: '/crm/settings/sms-templates' },
      { name: 'Notifications', path: '/crm/settings/notifications' },
      { name: 'Call Tracking', path: '/crm/settings/call-tracking' },
      { name: 'Kanban', path: '/crm/settings/kanban' },
      { name: 'Audit Log', path: '/crm/settings/audit-log' },
      { name: 'Rollback Manager', path: '/crm/settings/rollback-manager' },
      { name: 'Rollback Analytics', path: '/crm/settings/rollback-analytics' },
      { name: 'Feedback Impact', path: '/crm/settings/feedback-impact' },
      { name: 'System Health (Settings)', path: '/crm/settings/system-health' },
      { name: 'System Diagnostics', path: '/crm/settings/system-diagnostics' },
    ],
  },
];

// Actual routes exported directly from Crm.jsx (single source of truth at runtime)
const actualRoutes = new Set(actualRoutePaths);

const statusToVariant = {
  healthy: 'default',
  degraded: 'secondary',
  missing: 'destructive',
  error: 'secondary',
};

const BuildHealth = () => {
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const [dbStatus, setDbStatus] = useState({ status: 'unknown' });
  const [authStatus, setAuthStatus] = useState({ status: 'unknown' });
  const [storageStatus, setStorageStatus] = useState({ status: 'unknown' });
  const [tableResults, setTableResults] = useState({});
  const [fnResults, setFnResults] = useState({});
  const [routeResults, setRouteResults] = useState([]);

  const buildRouteResults = useMemo(() => {
    return featureTree.map((group) => ({
      group: group.group,
      items: group.items.map((item) => ({
        ...item,
        wired: actualRoutes.has(item.path),
        reachable: false,
        detail: null,
      })),
    }));
  }, []);

  // Simple reachability probe: fetch each route to see if it responds (200-399)
  const probeRoutes = async () => {
    const probed = [];
    for (const group of buildRouteResults) {
      const items = [];
      for (const item of group.items) {
        let reachable = false;
        let detail = null;
        if (item.wired) {
          try {
            const res = await fetch(item.path, {
              method: 'GET',
              credentials: 'include',
              redirect: 'follow',
              cache: 'no-store',
            });
            reachable = res.ok || (res.status >= 300 && res.status < 400);
            if (!reachable) detail = `HTTP ${res.status}`;
          } catch (err) {
            detail = err.message;
          }
        } else {
          detail = 'Not in route manifest';
        }
        items.push({ ...item, reachable, detail });
      }
      probed.push({ group: group.group, items });
    }
    setRouteResults(probed);
  };

  const run = async () => {
    setLoading(true);

    await probeRoutes();

    // DB connectivity via lightweight select
    const dbProbe = await supabase.from('app_user_roles').select('id', { head: true, count: 'exact' }).limit(1);
    setDbStatus(dbProbe.error ? { status: 'degraded', detail: dbProbe.error.message } : { status: 'healthy' });

    // Auth check
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setAuthStatus({ status: 'degraded', detail: authError.message });
    } else if (authData?.user?.email) {
      setAuthStatus({ status: 'healthy', detail: authData.user.email });
    } else {
      setAuthStatus({ status: 'degraded', detail: 'No active session' });
    }

    // Storage check
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    setStorageStatus(
      storageError ? { status: 'degraded', detail: storageError.message } : { status: 'healthy', detail: `${buckets?.length || 0} buckets` }
    );

    // Tables
    const tableOut = {};
    for (const table of tablesToCheck) {
      const { error } = await supabase.from(table).select('id', { head: true, count: 'exact' }).limit(1);
      if (error) {
        const msg = (error.message || '').toLowerCase();
        tableOut[table] = { status: msg.includes('does not exist') ? 'missing' : 'error', detail: error.message };
      } else {
        tableOut[table] = { status: 'healthy' };
      }
    }
    setTableResults(tableOut);

    // RPCs
    const fnOut = {};
    for (const fn of functionsToCheck) {
      const { error } = await supabase.rpc(fn, {}); // may error if params required
      if (error) {
        const msg = (error.message || '').toLowerCase();
        fnOut[fn] = { status: msg.includes('does not exist') ? 'missing' : 'error', detail: error.message };
      } else {
        fnOut[fn] = { status: 'healthy' };
      }
    }
    setFnResults(fnOut);

    setCheckedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    run();
  }, []);

  const overallStatus = computeOverall(dbStatus, authStatus, storageStatus, tableResults, fnResults);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Build Health</h1>
          <p className="text-sm text-slate-600">Backend prerequisites and route wiring status.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={run} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh Status'}
          </Button>
          {checkedAt && (
            <span className="text-xs text-slate-500">
              Last checked: {checkedAt.toLocaleDateString()} {checkedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Badge variant={statusToVariant[overallStatus]} className="px-3 py-1 text-xs">
            {overallStatus === 'healthy' ? 'Healthy' : overallStatus === 'degraded' ? 'Degraded' : 'Attention'}
          </Badge>
          <div className="text-sm text-slate-700">
            {overallStatus === 'healthy'
              ? 'All critical checks passed.'
              : 'One or more checks need attention. See details below.'}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusCard title="Database Connection" status={dbStatus} />
        <StatusCard title="Authentication" status={authStatus} />
        <StatusCard title="Supabase Storage/Services" status={storageStatus} />
        <ListCard title="Tables" items={tableResults} />
        <ListCard title="Functions / RPCs" items={fnResults} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route & Feature Map</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {routeResults.map((group, idx) => {
            const wiredCount = group.items.filter((i) => i.wired).length;
            const reachableCount = group.items.filter((i) => i.wired && i.reachable).length;
            return (
              <div key={idx} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{group.group}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={wiredCount === group.items.length ? 'default' : 'destructive'} className="text-[10px] uppercase">
                      {wiredCount} / {group.items.length} Wired
                    </Badge>
                    <Badge variant={reachableCount === wiredCount ? 'default' : 'destructive'} className="text-[10px] uppercase">
                      {reachableCount} Reachable
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5">
                      <div>
                        <div className="text-sm text-slate-900">{item.name}</div>
                        <div className="text-[11px] font-mono text-slate-600">{item.path}</div>
                        {!item.wired && <div className="text-[11px] text-amber-700">Not in route manifest</div>}
                        {item.wired && !item.reachable && (
                          <div className="text-[11px] text-amber-700">Unreachable: {item.detail || 'request failed'}</div>
                        )}
                      </div>
                      <Badge
                        variant={item.wired && item.reachable ? 'default' : 'destructive'}
                        className="text-[10px] uppercase"
                      >
                        {item.wired ? (item.reachable ? 'wired' : 'unreachable') : 'unwired'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

const computeOverall = (dbStatus, authStatus, storageStatus, tables, fns) => {
  const hasIssue = (statusObj) => statusObj?.status && statusObj.status !== 'healthy';
  if (hasIssue(dbStatus) || hasIssue(authStatus) || hasIssue(storageStatus)) return 'degraded';
  if (Object.values(tables).some((r) => r.status !== 'healthy')) return 'degraded';
  if (Object.values(fns).some((r) => r.status !== 'healthy')) return 'degraded';
  return 'healthy';
};

const StatusCard = ({ title, status }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base flex items-center gap-2">
        <Badge variant={statusToVariant[status.status]} className="w-20 justify-center text-[10px] uppercase">
          {status.status || 'unknown'}
        </Badge>
        <span className="text-slate-800">{title}</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-slate-700">
      {status.detail ? status.detail : 'OK'}
    </CardContent>
  </Card>
);

const ListCard = ({ title, items }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {Object.keys(items || {}).length === 0 && (
        <div className="text-sm text-slate-500">No checks run yet.</div>
      )}
      {Object.entries(items || {}).map(([name, { status, detail }]) => (
        <div key={name} className="flex items-center gap-2 text-sm">
          <Badge variant={statusToVariant[status]} className="w-20 justify-center text-[10px] uppercase">
            {status}
          </Badge>
          <span className="font-mono text-slate-800">{name}</span>
          {detail && <span className="text-xs text-slate-500">({detail})</span>}
        </div>
      ))}
    </CardContent>
  </Card>
);

export default BuildHealth;