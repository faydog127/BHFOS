
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const FrontendIntegration = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const modules = [
    { name: 'CRM Dashboard', route: '/crm', type: 'Page' },
    { name: 'Lead Pipeline', route: '/crm/pipeline', type: 'Component' },
    { name: 'Smart Call Console', route: '/crm/calls', type: 'Feature' },
    { name: 'Invoice Builder', route: '/crm/invoices/new', type: 'Form' },
    { name: 'Partner Portal', route: '/partners', type: 'External' }
  ];

  const runTests = async () => {
    setLoading(true);
    setResults([]); // Clear previous

    // Simulate testing delays
    for (const mod of modules) {
      await new Promise(r => setTimeout(r, 400));
      setResults(prev => [...prev, {
        ...mod,
        status: Math.random() > 0.1 ? 'pass' : 'warn', // Mostly pass for demo
        latency: Math.floor(Math.random() * 150) + 20
      }]);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Frontend Module Integration</CardTitle>
            <CardDescription>Simulates mount and render tests for critical UI components.</CardDescription>
          </div>
          <Button onClick={runTests} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Testing...' : 'Run Integration Tests'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {results.length === 0 && !loading && (
             <div className="text-center py-10 text-slate-500 border-2 border-dashed rounded-lg">
               Ready to test {modules.length} modules. Click run to start.
             </div>
          )}
          
          {results.map((res, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-white">
               <div className="flex items-center gap-3">
                 {res.status === 'pass' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-yellow-500" />}
                 <div>
                   <div className="font-medium text-sm">{res.name}</div>
                   <div className="text-xs text-slate-500">{res.route} • {res.type}</div>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <span className="text-xs font-mono text-slate-400">{res.latency}ms</span>
                 <Badge variant={res.status === 'pass' ? 'outline' : 'secondary'}>
                   {res.status.toUpperCase()}
                 </Badge>
               </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FrontendIntegration;
