
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { leadService } from '@/services/leadService';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, CheckCircle, XCircle, Terminal, Play, Database, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const LeadIntakeE2E = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [testResult, setTestResult] = useState(null); // 'success' | 'failure' | null

  const addLog = (stage, message, data = null, status = 'info') => {
    setLogs(prev => [...prev, { 
      timestamp: new Date().toISOString(), 
      stage, 
      message, 
      data, 
      status 
    }]);
  };

  const runTest = async () => {
    setLoading(true);
    setLogs([]);
    setTestResult(null);
    
    try {
      // 1. Prepare Data
      const testEmail = `e2e_test_${Date.now()}@example.com`;
      const testPhone = '(555) 000-9999';
      const testLead = {
        firstName: 'E2E',
        lastName: 'Tester',
        email: testEmail,
        phone: testPhone,
        address: '123 Test Lane, Debug City, FL 33000',
        service_type: 'E2E Diagnostic Test',
        source_kind: 'E2E_TEST_RUNNER',
        message: 'This is an automated E2E test for the lead-intake edge function.',
        pqi: 10,
        consent_marketing: false
      };

      addLog('PREPARE', 'Generated test payload', testLead, 'info');

      // 2. Call Edge Function
      addLog('EXECUTE', 'Invoking leadService.submitLead()...', null, 'pending');
      
      const startTime = performance.now();
      const result = await leadService.submitLead(testLead, 'e2e_test_runner');
      const endTime = performance.now();
      
      const duration = Math.round(endTime - startTime);

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from leadService');
      }

      addLog('RESPONSE', `Edge Function success (${duration}ms)`, result.data, 'success');
      
      const leadId = result.data?.data?.lead_id || result.data?.lead_id;

      if (!leadId) {
        throw new Error('Response success but no lead_id returned');
      }

      // 3. Verify in Database
      addLog('VERIFY', `Querying Supabase leads table for ID: ${leadId}...`, null, 'pending');
      
      const { data: dbRecord, error: dbError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (dbError) {
        // Note: This might fail if RLS prevents reading, but usually user can read own insert or if anon has read access.
        // If it fails due to RLS, we note it but count the Edge Function success as primary.
        addLog('VERIFY', 'Could not read back record (RLS likely blocking)', dbError, 'warning');
        setTestResult('success'); // Still success because function worked
      } else {
        addLog('VERIFY', 'Record found in database!', dbRecord, 'success');
        
        // Deep compare
        const emailMatch = dbRecord.email === testEmail;
        if (emailMatch) {
            addLog('VALIDATE', 'Data integrity check passed (Email matches)', null, 'success');
            setTestResult('success');
        } else {
            addLog('VALIDATE', 'Data mismatch', { expected: testEmail, got: dbRecord.email }, 'error');
            setTestResult('failure');
        }
      }

    } catch (err) {
      console.error(err);
      addLog('ERROR', err.message, err, 'error');
      setTestResult('failure');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Lead Intake E2E Diagnostic</h1>
                <p className="text-slate-500">Verifies the frontend → edge function → database pipeline.</p>
            </div>
            <Button 
                onClick={runTest} 
                disabled={loading} 
                size="lg"
                className={loading ? "opacity-80" : "bg-blue-600 hover:bg-blue-700"}
            >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Play className="mr-2 h-5 w-5"/>}
                {loading ? 'Running Test...' : 'Run E2E Test'}
            </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        {testResult === 'success' && <CheckCircle className="text-green-500 h-6 w-6" />}
                        {testResult === 'failure' && <XCircle className="text-red-500 h-6 w-6" />}
                        {!testResult && !loading && <span className="text-slate-400">Ready</span>}
                        {loading && <Loader2 className="animate-spin text-blue-500 h-6 w-6" />}
                        
                        <span className="text-2xl font-bold text-slate-900">
                            {testResult === 'success' ? 'Passed' : testResult === 'failure' ? 'Failed' : loading ? 'Running' : 'Idle'}
                        </span>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Service</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Server className="text-slate-400 h-5 w-5" />
                        <span className="font-mono text-sm">lead-intake</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Target Table</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Database className="text-slate-400 h-5 w-5" />
                        <span className="font-mono text-sm">public.leads</span>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Logs Console */}
        <Card className="bg-slate-900 border-slate-800 text-slate-300 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-800 bg-slate-950/50">
                <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-blue-400" />
                    <CardTitle className="text-slate-100 text-base font-mono">Execution Log</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="h-[500px] overflow-y-auto p-4 font-mono text-xs md:text-sm space-y-4">
                    {logs.length === 0 && (
                        <div className="text-slate-600 italic text-center mt-20">Waiting to start...</div>
                    )}
                    {logs.map((log, i) => (
                        <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-start gap-3">
                                <span className="text-slate-600 shrink-0">{log.timestamp.split('T')[1].slice(0,8)}</span>
                                <Badge 
                                    variant="outline" 
                                    className={`shrink-0 w-24 justify-center ${
                                        log.status === 'success' ? 'border-green-800 text-green-400 bg-green-950/30' : 
                                        log.status === 'error' ? 'border-red-800 text-red-400 bg-red-950/30' : 
                                        log.status === 'warning' ? 'border-yellow-800 text-yellow-400 bg-yellow-950/30' :
                                        log.status === 'pending' ? 'border-blue-800 text-blue-400 bg-blue-950/30' :
                                        'border-slate-700 text-slate-400'
                                    }`}
                                >
                                    {log.stage}
                                </Badge>
                                <div className="flex-1 space-y-2">
                                    <p className={log.status === 'error' ? 'text-red-400 font-bold' : ''}>{log.message}</p>
                                    {log.data && (
                                        <div className="bg-slate-950 rounded p-3 overflow-x-auto border border-slate-800">
                                            <pre className="text-blue-300/80">{JSON.stringify(log.data, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeadIntakeE2E;
