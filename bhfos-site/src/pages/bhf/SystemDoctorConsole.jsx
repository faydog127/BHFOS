import React, { useEffect, useState } from 'react';
import {
  Activity,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { probeTableSafetyCheck } from '@/lib/probe';

// Tables and critical columns to check (hybrid probe)
const TABLE_CHECKS = [
  { table: 'public.system_audit_log', columns: ['feature_id'] },
  { table: 'public.system_settings', columns: ['key', 'value'] },
  { table: 'public.app_user_roles', columns: ['user_id', 'role'] },
  { table: 'communications.calls', columns: ['id', 'status'] },
  { table: 'communications.sms_messages', columns: ['id', 'status'] },
];

const statusBadge = (status) => {
  if (status === 'ok') return { className: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20', label: 'OK' };
  if (status === 'blocked') return { className: 'bg-amber-500/10 text-amber-300 border border-amber-500/20', label: 'BLOCKED' };
  if (status === 'drift') return { className: 'bg-purple-500/10 text-purple-200 border border-purple-500/20', label: 'DRIFT' };
  if (status === 'missing') return { className: 'bg-red-500/10 text-red-300 border border-red-500/20', label: 'MISSING' };
  return { className: 'bg-slate-800 text-slate-300 border border-slate-700', label: 'UNKNOWN' };
};

const iconForStatus = (status) => {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4" />;
  if (status === 'blocked') return <AlertTriangle className="w-4 h-4" />;
  if (status === 'drift') return <AlertTriangle className="w-4 h-4" />;
  if (status === 'missing') return <ShieldAlert className="w-4 h-4" />;
  return <ShieldAlert className="w-4 h-4" />;
};

const SystemDoctorConsole = () => {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [tableResults, setTableResults] = useState([]);

  const addLog = (entry) => setLogs((prev) => [...prev, { ...entry, time: new Date().toLocaleTimeString() }]);

  const runDiagnostics = async () => {
    setStatus('running');
    setLogs([]);
    const results = [];

    // Auth context (informational)
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      addLog({ check: 'Auth Session', status: 'ok', msg: `Active session: ${sessionData.session.user.email}` });
    } else {
      addLog({ check: 'Auth Session', status: 'blocked', msg: 'No active session; expect RLS blocks on some probes.' });
    }

    for (const { table, columns } of TABLE_CHECKS) {
      // Layer 1: Kernel (RPC)
      const { data: rpcData, error: rpcError } = await supabase.rpc('system_doctor_check_table', {
        p_table_name: table,
        p_required_columns: columns || null,
      });

      if (rpcError) {
        results.push({
          table,
          status: 'error',
          detail: rpcError.message,
        });
        addLog({ check: table, status: 'error', msg: rpcError.message });
        continue;
      }

      // Layer 2: User (Client access)
      const clientProbe = await probeTableSafetyCheck(supabase, table);

      let statusLabel = 'ok';
      let detail = 'Healthy';

      if (rpcData?.status === 'missing') {
        statusLabel = 'missing';
        detail = 'Table does not exist';
      } else if (rpcData?.status === 'drift') {
        statusLabel = 'drift';
        detail = `Missing columns: ${(rpcData.missing_columns || []).join(', ')}`;
      } else if (clientProbe.exists && !clientProbe.accessible) {
        statusLabel = 'blocked';
        detail = 'Table exists but RLS blocked this user';
      } else if (!clientProbe.exists) {
        statusLabel = 'missing';
        detail = clientProbe.message || 'Not found';
      }

      results.push({
        table,
        status: statusLabel,
        detail,
        rpc: rpcData,
        client: clientProbe,
      });

      addLog({ check: table, status: statusLabel, msg: detail });
    }

    setTableResults(results);
    setStatus('idle');
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-emerald-400" />
            System Doctor
          </h2>
          <p className="text-slate-400 mt-1">Hybrid probe: schema existence, column drift, and access.</p>
        </div>
        <Button
          onClick={runDiagnostics}
          disabled={status === 'running'}
          className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${status === 'running' ? 'animate-spin' : ''}`} />
          Run Diagnostics
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-slate-950 border-slate-800 shadow-xl">
          <CardHeader className="border-b border-slate-900">
            <CardTitle className="flex items-center gap-2 text-white">
              <Terminal className="w-5 h-5 text-slate-500" />
              Diagnostic Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-900">
            {tableResults.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic">Initializing scans...</div>
            )}
            {tableResults.map((row) => {
              const badge = statusBadge(row.status);
              return (
                <div key={row.table} className="p-4 flex items-start gap-4 hover:bg-slate-900/30 transition-colors">
                  <div className={`mt-1 p-1 rounded-full ${badge.className}`}>{iconForStatus(row.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-slate-200">{row.table}</div>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                    <div className="text-xs font-mono text-slate-500 mt-1">{row.detail}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-slate-950 border-slate-800">
          <CardHeader className="border-b border-slate-900 py-3">
            <CardTitle className="text-xs font-mono text-slate-500 flex items-center gap-2 uppercase">
              <Terminal className="w-4 h-4" /> Diagnostic Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-900">
              {logs.length === 0 && <div className="p-6 text-center text-slate-500">Ready to scan...</div>}
              {logs.map((log, idx) => (
                <div key={idx} className="p-3 flex items-start gap-3 text-xs">
                  <span className="text-slate-600 w-16">{log.time}</span>
                  <span className="text-slate-300 font-semibold">{log.check}</span>
                  <span className="text-slate-500 flex-1">{log.msg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemDoctorConsole;
