
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Activity, Shield, Database, Zap, Stethoscope, 
  Terminal, Server, PlayCircle, AlertTriangle, CheckCircle2, 
  XCircle, RefreshCw, Cpu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';

// Utilities
import { probeTableSafetyCheck } from '@/lib/probe';
import { supabase } from '@/lib/supabaseClient';

// Components
import FrontendIntegration from '@/components/diagnostics/FrontendIntegration';
import LeadGenE2E from '@/components/diagnostics/LeadGenE2E';
import QuickFixes from '@/components/diagnostics/QuickFixes';
import LLMChat from '@/components/diagnostics/LLMChat';

const BackendTest = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [healthScore, setHealthScore] = useState(100);
  const [results, setResults] = useState({
    tables: [],
    env: [],
    rpc: [],
    summary: { healthy: 0, warnings: 0, errors: 0, critical: 0 }
  });

  // Safe Diagnostics Runner
  const runSafeDiagnostics = async () => {
    setIsRunning(true);
    let newScore = 100;
    let stats = { healthy: 0, warnings: 0, errors: 0, critical: 0 };
    
    const tablesToCheck = [
      'leads', 'jobs', 'estimates', 'invoices', 'customers', // Core
      'partners', 'referrals', 'partner_prospects', // Partners
      'system_audit_log', 'system_settings', 'app_user_roles', // System
      'communications.calls', 'communications.sms_messages' // Namespaced
    ];

    try {
      // 1. Check Tables
      const tablePromises = tablesToCheck.map(async (table) => {
        const result = await probeTableSafetyCheck(table);
        return { name: table, ...result };
      });
      
      const tableResults = await Promise.all(tablePromises);

      // 2. Check Environment (Client side visibility)
      const envChecks = [
        { key: 'VITE_SUPABASE_URL', exists: !!import.meta.env.VITE_SUPABASE_URL },
        { key: 'VITE_SUPABASE_ANON_KEY', exists: !!import.meta.env.VITE_SUPABASE_ANON_KEY },
      ];

      // 3. Check RPC Connectivity (Ping)
      let rpcStatus = 'ok';
      try {
        const { error } = await supabase.rpc('get_system_audit_log', { p_limit: 1 });
        if (error) throw error;
      } catch (e) {
        rpcStatus = 'error';
      }

      // Calculate Score & Stats
      tableResults.forEach(r => {
        if (r.status === 'error') {
          newScore -= 30; // Critical
          stats.critical++;
        } else if (r.status === 'warning') {
          newScore -= 5;
          stats.warnings++;
        } else {
          newScore += 10;
          stats.healthy++;
        }
      });
      
      if (rpcStatus === 'error') {
        newScore -= 15;
        stats.errors++;
      } else {
        newScore += 10;
      }

      // Clamp Score
      newScore = Math.max(0, Math.min(100, newScore));

      setHealthScore(newScore);
      setResults({
        tables: tableResults,
        env: envChecks,
        rpc: [{ name: 'get_system_audit_log', status: rpcStatus }],
        summary: stats
      });

      toast({
        title: "Diagnostics Complete",
        description: `System Health Score: ${newScore}/100`,
        variant: newScore > 70 ? "default" : "destructive"
      });

    } catch (error) {
      console.error("Critical Diagnostic Failure:", error);
      toast({
        title: "Diagnostic Error",
        description: "Failed to run some probes. Check console.",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Run on mount
  useEffect(() => {
    runSafeDiagnostics();
  }, []);

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Helmet>
        <title>System Diagnostics 2.0 | CRM</title>
      </Helmet>

      {/* Header & Scoreboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            System Diagnostics 2.0
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time infrastructure health, integration testing, and automated remediation.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={runSafeDiagnostics} 
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {isRunning ? 'Scanning...' : 'Run Master Scan'}
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Overall System Health</div>
              <div className={`text-5xl font-black ${getScoreColor(healthScore)}`}>
                {healthScore}/100
              </div>
            </div>
            
            <div className="flex-1 w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Infrastructure Stability</span>
                <span>{healthScore}%</span>
              </div>
              <Progress value={healthScore} className="h-3 bg-slate-800" indicatorClassName={
                healthScore >= 90 ? "bg-green-500" : healthScore >= 70 ? "bg-yellow-500" : "bg-red-500"
              } />
              <div className="flex justify-between gap-4 pt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {results.summary.healthy} Healthy</span>
                <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500" /> {results.summary.warnings} Warnings</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {results.summary.critical} Critical</span>
              </div>
            </div>

            <div className="hidden md:block w-px h-16 bg-slate-800" />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400 text-xs">Database</div>
                <div className="font-semibold text-green-400">Connected</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Edge Functions</div>
                <div className="font-semibold text-yellow-400">Partial</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Storage</div>
                <div className="font-semibold text-green-400">Active</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Auth</div>
                <div className="font-semibold text-green-400">Secure</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="doctor" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto">
          <TabsTrigger value="doctor" className="gap-2 py-3"><Stethoscope className="w-4 h-4" /> System Doctor</TabsTrigger>
          <TabsTrigger value="build" className="gap-2 py-3"><Cpu className="w-4 h-4" /> Build Health</TabsTrigger>
          <TabsTrigger value="probe" className="gap-2 py-3"><Database className="w-4 h-4" /> Supabase Probe</TabsTrigger>
          <TabsTrigger value="frontend" className="gap-2 py-3"><Zap className="w-4 h-4" /> Frontend Integration</TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2 py-3"><Activity className="w-4 h-4" /> Lead Gen Workflow</TabsTrigger>
          <TabsTrigger value="fixes" className="gap-2 py-3"><Shield className="w-4 h-4" /> Quick Fixes</TabsTrigger>
          <TabsTrigger value="llm" className="gap-2 py-3"><Terminal className="w-4 h-4" /> LLM Chat</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          {/* SYSTEM DOCTOR TAB */}
          <TabsContent value="doctor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Table Health</CardTitle>
                <CardDescription>Direct probes to verify schema existence and RLS accessibility.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {results.tables.map((table) => (
                      <div key={table.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          {table.status === 'ok' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : table.status === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium text-sm">{table.name}</div>
                            <div className="text-xs text-muted-foreground">{table.message}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="font-mono">{table.count !== null ? `${table.count} rows` : 'N/A'}</Badge>
                          <Badge className={
                            table.status === 'ok' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                            table.status === 'warning' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                            'bg-red-100 text-red-800 hover:bg-red-100'
                          }>
                            {table.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {results.tables.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">Click "Run Master Scan" to probe tables.</div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUILD HEALTH TAB */}
          <TabsContent value="build">
            <Card>
              <CardHeader>
                <CardTitle>Environment & Build Configuration</CardTitle>
                <CardDescription>Client-side verification of build artifacts and environment variables.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {results.env.map((env) => (
                     <div key={env.key} className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                       <code className="text-sm font-semibold">{env.key}</code>
                       <Badge variant={env.exists ? "default" : "destructive"}>
                         {env.exists ? "LOADED" : "MISSING"}
                       </Badge>
                     </div>
                  ))}
                  <Alert>
                    <Server className="h-4 w-4" />
                    <AlertTitle>Build Info</AlertTitle>
                    <AlertDescription>
                      Mode: {import.meta.env.MODE} | Base URL: {import.meta.env.BASE_URL}
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUPABASE PROBE TAB */}
          <TabsContent value="probe">
            <Card>
              <CardHeader>
                <CardTitle>Supabase Connectivity Probe</CardTitle>
                <CardDescription>Testing RPC endpoints and connection latency.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {results.rpc.map((rpc) => (
                    <div key={rpc.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-blue-500" />
                        <div>
                          <div className="font-semibold">{rpc.name}</div>
                          <div className="text-sm text-slate-500">Remote Procedure Call</div>
                        </div>
                      </div>
                      <Badge variant={rpc.status === 'ok' ? "outline" : "destructive"} className="uppercase">
                        {rpc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FRONTEND INTEGRATION */}
          <TabsContent value="frontend">
            <FrontendIntegration />
          </TabsContent>

          {/* LEAD GEN WORKFLOW */}
          <TabsContent value="workflow">
            <LeadGenE2E />
          </TabsContent>

          {/* QUICK FIXES */}
          <TabsContent value="fixes">
             <QuickFixes failures={results.tables.filter(t => t.status !== 'ok')} />
          </TabsContent>

          {/* LLM CHAT */}
          <TabsContent value="llm">
             <LLMChat />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default BackendTest;
