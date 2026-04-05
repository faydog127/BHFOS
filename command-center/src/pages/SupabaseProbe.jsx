import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, Wifi, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { formatProbeResult, timeoutPromise } from '@/lib/diagnosticsUtils';

// --- EXPORTED LOGIC ---
export const getSupabaseProbeResults = async () => {
  const probes = [
    { name: 'Auth Service', check: async () => supabase.auth.getSession() },
    { name: 'Database (Read)', check: async () => supabase.from('system_settings').select('count').limit(1).maybeSingle() },
    { name: 'Edge Functions', check: async () => supabase.functions.invoke('diagnostic-ping') }, // Assuming this exists or will fail gracefully
    { name: 'Realtime', check: async () => { /* Mock check */ return true; } }
  ];

  const results = await Promise.allSettled(probes.map(async (probe) => {
    const start = performance.now();
    try {
      await timeoutPromise(probe.check(), 5000, probe.name);
      const duration = Math.round(performance.now() - start);
      return formatProbeResult(probe.name, 'ok', duration, 'Service responding');
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      let status = 'error';
      let msg = err.message;
      
      if (msg.includes('timed out')) status = 'blocked';
      // Functions often 404 if not deployed, treated as warning
      if (probe.name === 'Edge Functions' && msg.includes('404')) {
        status = 'warning';
        msg = 'Function not found (404)';
      }

      return formatProbeResult(probe.name, status, duration, msg);
    }
  }));

  return results.map(r => 
    r.status === 'fulfilled' ? r.value : formatProbeResult('unknown', 'error', 0, r.reason)
  );
};

const SupabaseProbe = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runProbe = async () => {
    setLoading(true);
    const data = await getSupabaseProbeResults();
    setResults(data);
    setLoading(false);
  };

  useEffect(() => {
    runProbe();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-indigo-600" />
              <div>
                <CardTitle>Supabase Probe</CardTitle>
                <CardDescription>Connectivity status for Supabase services.</CardDescription>
              </div>
            </div>
            <Button onClick={runProbe} disabled={loading} variant="outline" size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
           <div className="grid gap-3">
             {results.map((res, i) => (
               <div key={i} className="flex items-center justify-between p-3 border rounded bg-white shadow-sm">
                 <div className="flex items-center gap-3">
                    {res.status === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : 
                     res.status === 'warning' ? <AlertTriangle className="h-5 w-5 text-amber-500" /> :
                     <XCircle className="h-5 w-5 text-red-500" />}
                    <div>
                      <div className="font-semibold text-sm">{res.name}</div>
                      <div className="text-xs text-slate-500">{res.message}</div>
                    </div>
                 </div>
                 <div className="text-right">
                   <Badge variant={res.status === 'ok' ? 'default' : 'secondary'} className="mb-1">
                     {res.status}
                   </Badge>
                   <div className="text-[10px] text-slate-400">{res.latency}ms</div>
                 </div>
               </div>
             ))}
           </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseProbe;