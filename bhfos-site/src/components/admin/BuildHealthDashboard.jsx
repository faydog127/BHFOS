import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import config from '../../bhf.config.json';
import { probeTableSafetyCheck } from '../../lib/probe';
import { BRAND } from '../../lib/featureFlags';

const statusStyles = {
  ok: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  blocked: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  drift: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  missing: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  error: 'text-red-500 bg-red-500/10 border-red-500/20',
  pending: 'text-slate-500 bg-slate-800 border-slate-700',
};

const BuildHealthDashboard = () => {
  const [results, setResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [userRole, setUserRole] = useState('anon');
  const [secretsStatus] = useState({
    supabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
    supabaseAnon: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    openai: !!import.meta.env.VITE_OPENAI_API_KEY,
    gemini: !!import.meta.env.VITE_GEMINI_API_KEY,
  });

  useEffect(() => {
    const checkAuthAndRun = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const role = session ? 'authenticated' : 'anon';
      setUserRole(role);
      if (role === 'authenticated') {
        runSystemScan(role);
      }
    };
    checkAuthAndRun();
  }, []);

  const runSystemScan = async (roleOverride) => {
    const role = roleOverride || userRole;
    setIsRunning(true);
    const scanResults = {};

    for (const station of config.stations) {
      if (!station.checks || station.checks.length === 0) continue;
      scanResults[station.id] = {};

      for (const check of station.checks) {
        const start = performance.now();
        let status = 'pending';
        let message = 'Checking...';

        try {
          if (role === 'anon') {
            status = 'blocked';
            message = 'Sign in to scan';
          } else {
            // RPC check: existence / drift
            const { data: rpcData, error: rpcError } = await supabase.rpc('system_doctor_check_table', {
              p_table_name: check.table,
              p_required_columns: check.columns,
            });

            if (rpcError) {
              status = 'error';
              message = `RPC Error: ${rpcError.message}`;
            } else if (rpcData.status === 'missing') {
              status = 'missing';
              message = 'Table Missing in DB';
            } else if (rpcData.status === 'drift') {
              status = 'drift';
              message = `Missing cols: ${rpcData.missing_columns.join(', ')}`;
            } else {
              // Client probe: permissions
              const probe = await probeTableSafetyCheck(supabase, check.table);
              if (probe.accessible) {
                status = 'ok';
                message = `Healthy (${rpcData.row_count || 0} rows)`;
              } else {
                status = 'blocked';
                message = 'Exists, but RLS blocked access (401)';
              }
            }
          }
        } catch (err) {
          status = 'error';
          message = err.message;
        }

        scanResults[station.id][check.table] = {
          status,
          message,
          latency: Math.round(performance.now() - start),
        };
      }
    }

    setResults(scanResults);
    setIsRunning(false);
  };

  const handleSecretsAction = (action) => {
    console.info(`Secrets action requested: ${action}`);
    alert(`${action} requested. Wire this button to your secure rotation/sync service.`);
  };

  const getStatusClass = (status) => statusStyles[status] || statusStyles.pending;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-300 p-6 font-mono">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-white">
              System <span className="text-sky-500">Pulse</span>
            </h1>
            <p className="text-sm text-slate-500">
              Version {config.project.version} • {config.project.environment}
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={() => runSystemScan()}
              disabled={isRunning}
              className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50"
            >
              {isRunning ? 'Scanning...' : 'Run Diagnostics'}
            </button>
            <p className="text-xs mt-2 text-slate-500">Role: {userRole}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {config.stations
            .filter((station) => station.checks && station.checks.length > 0)
            .map((station) => {
              const path = station.route || station.path;
              return (
                <div key={station.id} className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-[#1F2937] border-b border-slate-700 font-semibold text-white flex justify-between items-center">
                    <Link
                      to={path}
                      className="hover:text-sky-400 hover:underline decoration-sky-500/30 underline-offset-4"
                    >
                      {station.name || station.label}
                    </Link>
                    <span className="text-xs text-slate-500">{path}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {station.checks.map((check) => {
                      const res = results[station.id]?.[check.table] || { status: 'pending', message: 'Waiting', latency: 0 };
                      return (
                        <div key={check.table} className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">{check.table}</span>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded border text-xs ${getStatusClass(res.status)}`}>{res.message}</span>
                            <span className="text-[10px] text-slate-600 w-12 text-right">
                              {res.latency > 0 ? `${res.latency}ms` : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#1F2937] border-b border-slate-700 font-semibold text-white">
              Environment & Keys
            </div>
            <div className="p-4 space-y-3">
              {config.integrations.map((int) => {
                const exists = !!import.meta.env[int.env_key];
                return (
                  <div key={int.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">{int.name}</span>
                    <span
                      className={`px-2 py-1 rounded border text-xs ${
                        exists
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                      }`}
                    >
                      {exists ? 'Configured' : `Missing ${int.env_key}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#1F2937] border-b border-slate-700 font-semibold text-white flex justify-between items-center">
              <span>Secrets & Rotation (Stub)</span>
              <span className="text-xs text-slate-500">
                Brand: {BRAND?.name || 'Factory'} · {BRAND?.product || 'Diagnostics'}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-slate-50/5 rounded border border-slate-800">
                  <span className="text-slate-300">Supabase URL</span>
                  <span className={`px-2 py-1 rounded border text-xs ${secretsStatus.supabaseUrl ? 'text-emerald-400 border-emerald-500/40' : 'text-rose-400 border-rose-500/40'}`}>
                    {secretsStatus.supabaseUrl ? 'Present' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50/5 rounded border border-slate-800">
                  <span className="text-slate-300">Supabase Anon Key</span>
                  <span className={`px-2 py-1 rounded border text-xs ${secretsStatus.supabaseAnon ? 'text-emerald-400 border-emerald-500/40' : 'text-rose-400 border-rose-500/40'}`}>
                    {secretsStatus.supabaseAnon ? 'Present' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50/5 rounded border border-slate-800">
                  <span className="text-slate-300">OpenAI Key</span>
                  <span className={`px-2 py-1 rounded border text-xs ${secretsStatus.openai ? 'text-emerald-400 border-emerald-500/40' : 'text-rose-400 border-rose-500/40'}`}>
                    {secretsStatus.openai ? 'Present' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50/5 rounded border border-slate-800">
                  <span className="text-slate-300">Gemini Key</span>
                  <span className={`px-2 py-1 rounded border text-xs ${secretsStatus.gemini ? 'text-emerald-400 border-emerald-500/40' : 'text-rose-400 border-rose-500/40'}`}>
                    {secretsStatus.gemini ? 'Present' : 'Missing'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => handleSecretsAction('Rotate Supabase')}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded text-xs font-bold"
                >
                  Rotate Supabase
                </button>
                <button
                  onClick={() => handleSecretsAction('Rotate OpenAI')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded text-xs font-bold"
                >
                  Rotate OpenAI
                </button>
                <button
                  onClick={() => handleSecretsAction('Sync from Remote')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded text-xs font-bold"
                >
                  Sync from Remote
                </button>
                <button
                  onClick={() => handleSecretsAction('Push to Remote')}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded text-xs font-bold"
                >
                  Push to Remote
                </button>
              </div>
              <p className="text-xs text-slate-500">
                These controls are placeholders. Wire them to a secure rotation/sync service (e.g., secrets manager) to keep environments aligned.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BuildHealthDashboard;
