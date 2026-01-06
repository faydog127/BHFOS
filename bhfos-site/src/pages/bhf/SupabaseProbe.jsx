import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

const tablesToCheck = ['system_audit_log', 'remediation_step_log', 'app_user_roles', 'system_settings'];
const functionsToCheck = ['execute_remediation_plan', 'preview_rollback_plan', 'system-doctor'];

const statusToVariant = (status) =>
  ({ ok: 'default', missing: 'destructive', error: 'secondary' }[status] || 'secondary');

const Section = ({ title, loading, results }) => (
  <div className="space-y-2">
    <div className="text-sm font-semibold text-slate-700">{title}</div>
    <div className="space-y-1">
      {loading && <div className="text-sm text-slate-500">Checking...</div>}
      {!loading &&
        Object.entries(results).map(([name, { status, detail }]) => (
          <div key={name} className="flex items-center gap-2 text-sm">
            <Badge variant={statusToVariant(status)} className="w-24 justify-center uppercase text-[10px]">
              {status}
            </Badge>
            <span className="font-mono text-slate-700">{name}</span>
            {detail && <span className="text-xs text-slate-500">({detail})</span>}
          </div>
        ))}
    </div>
  </div>
);

const SupabaseProbe = () => {
  const [tableResults, setTableResults] = useState({});
  const [fnResults, setFnResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      setLoading(true);
      const tableOut = {};
      const fnOut = {};

      if (!supabase) {
        const msg = 'Supabase client not configured (missing env vars)';
        tablesToCheck.forEach((table) => {
          tableOut[table] = { status: 'missing', detail: msg };
        });
        functionsToCheck.forEach((fn) => {
          fnOut[fn] = { status: 'missing', detail: msg };
        });
        setTableResults(tableOut);
        setFnResults(fnOut);
        setLoading(false);
        return;
      }

      for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
        if (error) {
          const msg = (error.message || '').toLowerCase();
          tableOut[table] = { status: msg.includes('does not exist') ? 'missing' : 'error', detail: error.message };
        } else {
          tableOut[table] = { status: 'ok' };
        }
      }

      for (const fn of functionsToCheck) {
        const { error } = await supabase.rpc(fn, {});
        if (error) {
          const msg = (error.message || '').toLowerCase();
          fnOut[fn] = { status: msg.includes('does not exist') ? 'missing' : 'error', detail: error.message };
        } else {
          fnOut[fn] = { status: 'ok' };
        }
      }

      setTableResults(tableOut);
      setFnResults(fnOut);
      setLoading(false);
    };
    runChecks();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Supabase Prereq Probe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Section title="Tables" loading={loading} results={tableResults} />
          <Section title="Functions / RPCs" loading={loading} results={fnResults} />
          <p className="text-xs text-slate-500">
            Note: RPC calls may show an "unexpected arguments" error if params are required; that still proves the function
            exists.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseProbe;
