import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Database, Lock, Search, AlertTriangle, FileText, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const SystemDoctorWidget = forwardRef(({ autoRun = false }, ref) => {
  const [loading, setLoading] = useState(false);
  const [schemaReport, setSchemaReport] = useState(null);
  const [error, setError] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const runDiagnosis = async () => {
    setLoading(true);
    setError(null);
    setSchemaReport(null);

    try {
      // Invoke the new diagnostic-schema-drift function
      const { data, error: functionError } = await supabase.functions.invoke('diagnostic-schema-drift');

      if (functionError) throw functionError;
      setSchemaReport(data);
      setLastRun(new Date());
      return true;
    } catch (err) {
      console.error('Schema Diagnosis failed:', err);
      setError(err.message || 'System Doctor check failed.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    run: runDiagnosis,
    isLoading: loading
  }));

  useEffect(() => {
    if (autoRun) {
      runDiagnosis();
    }
  }, [autoRun]);

  const StatusIcon = ({ status }) => {
    if (loading) return <Activity className="h-5 w-5 text-blue-500 animate-spin" />;
    if (status === 'OK' || status === 100) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (typeof status === 'number' && status >= 80) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (typeof status === 'number' && status < 80) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            System Doctor Diagnostics
            {loading && <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50 animate-pulse">Running...</Badge>}
          </h3>
          <p className="text-sm text-gray-500">
            Deep scan of schema versioning, column integrity, and index performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
            {lastRun && (
            <span className="text-xs text-slate-400">
                Last updated: {lastRun.toLocaleTimeString()}
            </span>
            )}
            <Button size="sm" variant="outline" onClick={runDiagnosis} disabled={loading}>
                {loading ? 'Scanning...' : 'Run Scan'}
            </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md text-red-800 dark:text-red-200 flex items-center gap-3"
          >
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Schema Integrity Card */}
        <Card className={cn("border-t-4", schemaReport?.schema_health_score >= 90 ? "border-t-green-500" : "border-t-amber-500")}>
          <CardHeader className="pb-2 space-y-0">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Database className="h-4 w-4" /> Schema Health
              </CardTitle>
              <StatusIcon status={schemaReport?.schema_health_score} />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
              </div>
            ) : schemaReport ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Score</span>
                    <span className={cn("text-2xl font-bold", schemaReport.schema_health_score >= 90 ? "text-green-600" : "text-amber-600")}>
                        {schemaReport.schema_health_score}/100
                    </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t pt-2">
                    <span className="text-gray-500">Expected Version</span>
                    <span className="font-mono text-gray-700">{schemaReport.version?.expected}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Actual Version</span>
                    <span className={cn("font-mono", schemaReport.version?.actual === schemaReport.version?.expected ? "text-green-600" : "text-red-600")}>
                        {schemaReport.version?.actual}
                    </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic">Waiting for diagnostics...</div>
            )}
          </CardContent>
        </Card>

        {/* Findings Card */}
        <Card className="border-t-4 border-t-gray-200">
          <CardHeader className="pb-2 space-y-0">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Search className="h-4 w-4" /> Findings & Fixes
              </CardTitle>
              <Badge variant="outline">{schemaReport?.findings?.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
             {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full"></div>
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3"></div>
              </div>
            ) : schemaReport?.findings?.length > 0 ? (
               <ScrollArea className="h-40 w-full rounded border bg-gray-50 dark:bg-gray-900">
                  <div className="divide-y">
                    {schemaReport.findings.map((finding, idx) => (
                      <div key={idx} className="p-3 text-xs">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-700">{finding.category}</span>
                            <Badge variant={finding.status === 'CRITICAL' || finding.status === 'FAIL' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                                {finding.status}
                            </Badge>
                        </div>
                        <p className="text-gray-600 mb-2">{finding.message}</p>
                        {finding.remediation && (
                            <div className="bg-slate-900 text-green-400 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                                {finding.remediation}
                            </div>
                        )}
                      </div>
                    ))}
                  </div>
               </ScrollArea>
            ) : schemaReport ? (
              <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2 h-full justify-center py-8">
                 <CheckCircle2 className="w-5 h-5" /> All systems nominal.
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic">Waiting for diagnostics...</div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
});

SystemDoctorWidget.displayName = "SystemDoctorWidget";

export default SystemDoctorWidget;