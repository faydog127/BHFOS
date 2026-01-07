
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, CheckCircle2, XCircle, AlertTriangle, Play, RefreshCw, Database } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { formatProbeResult, normalizeStatus, timeoutPromise } from '@/lib/diagnosticsUtils';
import { cn } from '@/lib/utils';

// --- EXPORTED LOGIC FOR HOOK CONSUMPTION ---
export const getSystemDoctorResults = async () => {
  const tables = [
    'leads', 'invoices', 'customers', 'system_settings', 
    'app_user_roles', 'calls', 'estimates', 'proposals',
    'automation_workflows', 'marketing_actions'
  ];

  // Map each table check to a resilient promise
  const checks = tables.map(async (table) => {
    const start = performance.now();
    try {
      // Use resilient timeout wrapper
      await timeoutPromise(
        supabase.from(table).select('count').limit(1).single(),
        5000, 
        `Check ${table}`
      );
      
      const duration = Math.round(performance.now() - start);
      return formatProbeResult(table, 'ok', duration, 'Table accessible');
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      let status = 'error';
      let msg = err.message;
      
      if (msg.includes('timed out')) status = 'blocked';
      else if (err.code === '42P01') { status = 'missing'; msg = 'Table not found'; }
      else if (err.code === '42501') { status = 'blocked'; msg = 'Permission denied (RLS)'; }
      
      return formatProbeResult(table, status, duration, msg);
    }
  });

  // Execute all settled
  const results = await Promise.allSettled(checks);
  
  // Unwrap settled results
  return results.map(r => 
    r.status === 'fulfilled' ? r.value : formatProbeResult('unknown', 'error', 0, r.reason)
  );
};

// --- COMPONENT UI ---
const SystemDoctorConsole = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runScan = async () => {
    setLoading(true);
    const data = await getSystemDoctorResults();
    setResults(data);
    setLoading(false);
  };

  useEffect(() => {
    runScan();
  }, []);

  return (
    <Card className="h-full border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <CardTitle>System Doctor</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={runScan} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="ml-2">Scan Tables</span>
          </Button>
        </div>
        <CardDescription>Direct database connectivity and RLS verification.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y">
            {results.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-500">No scan results.</div>
            )}
            {results.map((res, i) => (
              <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  {res.status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                   res.status === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
                   <XCircle className="h-4 w-4 text-red-500" />}
                  <div>
                    <div className="text-sm font-medium text-slate-900 capitalize">{res.name}</div>
                    <div className="text-xs text-slate-500">{res.message}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={res.status === 'ok' ? 'outline' : 'destructive'} 
                         className={cn("text-[10px] h-5", res.status === 'ok' && "text-emerald-700 bg-emerald-50 border-emerald-200")}>
                    {res.status.toUpperCase()}
                  </Badge>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{res.latency}ms</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SystemDoctorConsole;
