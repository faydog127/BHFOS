import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, ShieldAlert, Activity, Database, Lock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function SystemDoctorTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  const [tableName, setTableName] = useState('leads');
  const [columnName, setColumnName] = useState('id');

  const runDiagnosis = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // The `system-doctor` edge function is now expecting specific parameters
      // when the 'diagnose' action is implicitly chosen by the client-side UI
      // and not explicitly sent as an 'action' parameter.
      // For this test component, we'll keep the previous action-based invocation
      // but acknowledge that the BuildConsole version uses a direct call to the edge function
      // with a specific payload for AI analysis.
      
      const { data, error: functionError } = await supabase.functions.invoke('system-doctor', {
        body: { 
          // For SystemDoctorTest, we simulate the previous 'diagnose' action
          // that the system-doctor function might have handled internally.
          // In the context of the BuildConsole, the `system-doctor` function
          // is invoked with `error_message`, `context`, etc., for AI analysis.
          // This test component will mimic a direct diagnostic query.
          action: 'diagnose', // This action parameter was removed in the build-console's implementation
          table: tableName, 
          column: columnName 
        }
      });

      if (functionError) throw functionError;
      setResults(data);
    } catch (err) {
      console.error('Diagnosis failed:', err);
      setError(err.message || 'An unexpected error occurred while contacting the System Doctor.');
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ ok }) => {
    return ok ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <AlertCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-4 mb-8">
        <div className="bg-blue-100 p-3 rounded-full dark:bg-blue-900/30">
          <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">System Doctor Test Utility</h1>
          <p className="text-gray-500 dark:text-gray-400">Diagnostic utility for database schema, RLS, and dependency health (Test Mode).</p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Specify the target table and column for focused RLS and dependency analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">Target Table</Label>
              <div className="relative">
                <Database className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input 
                  id="tableName" 
                  value={tableName} 
                  onChange={(e) => setTableName(e.target.value)} 
                  className="pl-9" 
                  placeholder="e.g. leads"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="columnName">Target Column</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input 
                  id="columnName" 
                  value={columnName} 
                  onChange={(e) => setColumnName(e.target.value)} 
                  className="pl-9" 
                  placeholder="e.g. id"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50/50 dark:bg-gray-900/20 border-t p-4 flex justify-end">
          <Button 
            onClick={runDiagnosis} 
            disabled={loading}
            className="min-w-[150px]"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Activity className="h-4 w-4" />
                </motion.div>
                <span>Diagnosing...</span>
              </div>
            ) : (
              <>
                <ShieldAlert className="mr-2 h-4 w-4" />
                Run Diagnosis
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold">Diagnosis Failed</h3>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Display */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="rls">RLS Policies</TabsTrigger>
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Schema Integrity Card */}
                  <Card className={cn(
                    "border-l-4", 
                    results.schema_integrity?.ok ? "border-l-green-500" : "border-l-red-500"
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">Schema Integrity</CardTitle>
                        <StatusIcon ok={results.schema_integrity?.ok} />
                      </div>
                      <CardDescription>Checks for ambiguous Foreign Keys</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {results.schema_integrity?.ok ? (
                         <div className="flex items-center text-green-600 dark:text-green-400 text-sm">
                           <CheckCircle2 className="mr-2 h-4 w-4" />
                           No ambiguous relationships detected.
                         </div>
                       ) : (
                         <div className="space-y-2">
                            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                               Ambiguity Detected:
                            </p>
                            <ScrollArea className="h-[100px] w-full rounded-md border p-2 bg-slate-50 dark:bg-slate-900">
                               <pre className="text-xs text-red-600 dark:text-red-300">
                                 {JSON.stringify(results.schema_integrity?.error || results.schema_integrity?.ambiguous_fk_pairs, null, 2)}
                               </pre>
                            </ScrollArea>
                         </div>
                       )}
                    </CardContent>
                  </Card>

                  {/* RLS Status Card */}
                  <Card className={cn(
                    "border-l-4", 
                    results.rls_policies?.ok ? "border-l-green-500" : "border-l-yellow-500"
                  )}>
                     <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">RLS Status: {results.target?.table}</CardTitle>
                        <StatusIcon ok={results.rls_policies?.ok} />
                      </div>
                      <CardDescription>Row Level Security Policies</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {results.rls_policies?.policies?.length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Active Policies Found</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Raw JSON Dump (for devs) */}
                 <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-gray-500">Diagnostic Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-xs overflow-x-auto">
                      <p>Target: {results.target?.table}.{results.target?.column}</p>
                      <p>Mode: {results.mode}</p>
                    </div>
                  </CardContent>
                 </Card>
              </TabsContent>

              {/* RLS TAB */}
              <TabsContent value="rls" className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Lock className="h-5 w-5 text-blue-500" />
                      <CardTitle>RLS Policies for '{results.target?.table}'</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {results.rls_policies?.ok && results.rls_policies?.policies?.length > 0 ? (
                       <ScrollArea className="h-[300px] pr-4">
                         <div className="space-y-4">
                           {results.rls_policies.policies.map((policy, idx) => (
                             <div key={idx} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2">
                               <div className="flex justify-between items-center">
                                 <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300">{policy.policyname}</h4>
                                 <span className="text-xs uppercase bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300 font-mono">
                                   {policy.cmd}
                                 </span>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                 <div>
                                   <span className="font-semibold text-gray-500 block">Using Expression:</span>
                                   <code className="block bg-white dark:bg-gray-950 p-1.5 rounded border mt-1">
                                     {policy.using_expr || 'N/A'}
                                   </code>
                                 </div>
                                 <div>
                                   <span className="font-semibold text-gray-500 block">Check Expression:</span>
                                   <code className="block bg-white dark:bg-gray-950 p-1.5 rounded border mt-1">
                                     {policy.check_expr || 'N/A'}
                                   </code>
                                 </div>
                               </div>
                               <div className="text-xs text-gray-500">
                                 Roles: {policy.roles ? policy.roles.join(', ') : 'ALL'}
                               </div>
                             </div>
                           ))}
                         </div>
                       </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {results.rls_policies?.ok 
                          ? "No RLS policies found for this table. It might be public or policies are not enabled." 
                          : `Error: ${results.rls_policies?.error}`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* DEPENDENCIES TAB */}
              <TabsContent value="dependencies" className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Search className="h-5 w-5 text-purple-500" />
                      <CardTitle>Dependencies for '{results.target?.table}.{results.target?.column}'</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {results.dependencies?.ok && results.dependencies?.column_dependencies?.length > 0 ? (
                       <ScrollArea className="h-[300px] pr-4">
                          <div className="space-y-3">
                             {results.dependencies.column_dependencies.map((dep, idx) => (
                               <div key={idx} className="flex items-start p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-md">
                                  <div className="mr-3 mt-1 bg-purple-100 dark:bg-purple-800 p-1 rounded">
                                     <Database className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                                  </div>
                                  <div className="overflow-hidden">
                                     <h5 className="font-medium text-sm text-purple-900 dark:text-purple-100">{dep.name}</h5>
                                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                       Type: View / Dependency
                                     </p>
                                     <details className="mt-2">
                                       <summary className="text-xs text-purple-600 cursor-pointer hover:underline">View Definition</summary>
                                       <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-[10px] overflow-x-auto">
                                         {dep.definition}
                                       </pre>
                                     </details>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {results.dependencies?.ok 
                          ? "No direct dependencies found via simple search." 
                          : `Error: ${results.dependencies?.error}`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}