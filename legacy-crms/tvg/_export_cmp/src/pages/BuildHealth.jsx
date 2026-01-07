import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Server, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { formatProbeResult, timeoutPromise } from '@/lib/diagnosticsUtils';
import { cn } from '@/lib/utils';

// --- EXPORTED LOGIC FOR HOOK CONSUMPTION ---
export const getBuildHealthResults = async () => {
  const checks = [
    { key: 'VITE_SUPABASE_URL', required: true },
    { key: 'VITE_SUPABASE_ANON_KEY', required: true },
    { key: 'MODE', required: false }, // Environment mode
    { key: 'BASE_URL', required: false }
  ];

  const promises = checks.map(async (check) => {
    const start = performance.now();
    
    // Simulate async check for consistency, even though it's sync
    await new Promise(r => setTimeout(r, 10)); // minimal delay
    
    const val = import.meta.env[check.key];
    const duration = Math.round(performance.now() - start);
    
    if (check.required && !val) {
      return formatProbeResult(check.key, 'missing', duration, 'Required environment variable missing');
    }
    
    return formatProbeResult(check.key, 'ok', duration, val ? 'Loaded' : 'Optional (Missing)');
  });

  const results = await Promise.allSettled(promises);
  return results.map(r => 
    r.status === 'fulfilled' ? r.value : formatProbeResult('env_check', 'error', 0, r.reason)
  );
};


const BuildHealth = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    const data = await getBuildHealthResults();
    setResults(data);
    setLoading(false);
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
       <Card>
         <CardHeader>
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
               <Server className="h-6 w-6 text-blue-600" />
               <div>
                 <CardTitle>Build Health Dashboard</CardTitle>
                 <CardDescription>Environment configuration and build artifact validation.</CardDescription>
               </div>
             </div>
             <Button onClick={runCheck} disabled={loading} variant="outline" size="sm">
               <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
               Re-verify
             </Button>
           </div>
         </CardHeader>
         <CardContent>
            <div className="grid gap-4">
              {results.map((res, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                   <div className="flex items-center gap-3">
                     {res.status === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                     <div>
                       <code className="text-sm font-bold text-slate-800">{res.name}</code>
                       <div className="text-xs text-slate-500">{res.message}</div>
                     </div>
                   </div>
                   <Badge variant={res.status === 'ok' ? 'default' : 'destructive'}>
                     {res.status.toUpperCase()}
                   </Badge>
                </div>
              ))}
            </div>
         </CardContent>
       </Card>
    </div>
  );
};

export default BuildHealth;