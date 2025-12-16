import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Play, Trash2 } from 'lucide-react';

const PERSONAS = [
  'homeowner',
  'property_manager',
  'realtor',
  'contractor',
  'vendor',
  'hoa',
  'government',
  'b2b',
  'other_partner',
  'other'
];

const LeadsUpdateTest = () => {
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const log = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, timestamp: new Date().toISOString() }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setLogs([]);
    log('Starting Lead Update Constraint Tests...', 'info');

    let testLeadId = null;

    try {
      // 1. Create Test Lead
      log('Creating test lead...', 'info');
      const { data: lead, error: createError } = await supabase
        .from('leads')
        .insert({
          first_name: 'TEST_AUTO',
          last_name: 'LEAD_CONSTRAINT',
          email: `test_${Date.now()}@example.com`,
          persona: 'homeowner',
          segment: 'homeowner', // Initial creation must also match
          utm_source: 'test_suite',
          status: 'new',
          pqi: 0
        })
        .select()
        .single();

      if (createError) throw new Error(`Creation failed: ${createError.message}`);
      testLeadId = lead.id;
      log(`Test lead created: ${testLeadId}`, 'success');

      // 2. Test Updates for ALL Personas
      for (const persona of PERSONAS) {
        log(`Testing update to persona: ${persona}...`, 'info');

        // The critical fix: Ensure we are sending segment along with persona
        const updates = {
          persona: persona,
          segment: persona 
        };

        const { error: updateError } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', testLeadId);

        if (updateError) {
          log(`❌ Update to ${persona} failed: ${updateError.message}`, 'error');
          // Continue to next test even if this one failed
          continue;
        }

        // Verify DB state by fetching back
        const { data: verifyData, error: verifyError } = await supabase
          .from('leads')
          .select('persona, segment')
          .eq('id', testLeadId)
          .single();

        if (verifyError) {
           log(`❌ Verification fetch failed: ${verifyError.message}`, 'error');
        } else {
           if (verifyData.segment === persona) {
             log(`✅ Update to ${persona} successful. DB Segment: ${verifyData.segment}`, 'success');
           } else {
             log(`❌ Segment mismatch! Expected ${persona}, got ${verifyData.segment}`, 'error');
           }
        }
        
        // Small delay to not hammer the DB
        await new Promise(r => setTimeout(r, 200));
      }

    } catch (err) {
      log(`Critical Error: ${err.message}`, 'error');
    } finally {
      // Cleanup
      if (testLeadId) {
        log('Cleaning up test lead...', 'info');
        const { error: deleteError } = await supabase.from('leads').delete().eq('id', testLeadId);
        if (deleteError) {
            log(`Failed to delete test lead: ${deleteError.message}`, 'error');
        } else {
            log('Cleanup complete.', 'success');
        }
      }
      setIsRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Helmet>
        <title>Lead Constraint Tests | CRM</title>
      </Helmet>

      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">DB Constraint Test Suite</h1>
            <p className="text-gray-500 mt-2">
                Verifies that updating a lead's persona correctly updates the segment field 
                to satisfy the <code>leads_segment_check</code> database constraint.
            </p>
        </div>
        <Button onClick={runTests} disabled={isRunning} size="lg">
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {isRunning ? 'Running Tests...' : 'Run Test Suite'}
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Execution Log</CardTitle>
            <CardDescription>Real-time results from the test execution.</CardDescription>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[500px] w-full rounded-md border p-4 bg-slate-950 text-slate-100 font-mono text-sm">
                {logs.length === 0 ? (
                    <div className="text-slate-500 italic">Ready to start...</div>
                ) : (
                    logs.map((log, idx) => (
                        <div key={idx} className="mb-2 flex items-start">
                            <span className="text-slate-500 mr-3 text-xs min-w-[140px]">
                                {log.timestamp.split('T')[1].replace('Z', '')}
                            </span>
                            <span className={
                                log.type === 'error' ? 'text-red-400' :
                                log.type === 'success' ? 'text-green-400' :
                                'text-slate-300'
                            }>
                                {log.msg}
                            </span>
                        </div>
                    ))
                )}
                {/* Scroll anchor could be added here */}
            </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadsUpdateTest;