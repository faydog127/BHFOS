import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Database, Hammer, ShieldAlert, Layers, Terminal, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import config from '@/bhf.config.json';

const ICON_MAP = { Activity, Database, Hammer, ShieldAlert };

const COLOR_STYLES = {
  emerald: {
    icon: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    cta: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20',
    glow: 'from-emerald-500/15',
  },
  blue: {
    icon: 'bg-blue-500/10 border border-blue-500/30 text-blue-300',
    badge: 'bg-blue-500/10 text-blue-200 border border-blue-500/20',
    cta: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
    glow: 'from-blue-500/15',
  },
  amber: {
    icon: 'bg-amber-500/10 border border-amber-500/30 text-amber-200',
    badge: 'bg-amber-500/10 text-amber-100 border border-amber-500/20',
    cta: 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/20',
    glow: 'from-amber-500/15',
  },
  red: {
    icon: 'bg-red-500/10 border border-red-500/30 text-red-300',
    badge: 'bg-red-500/10 text-red-200 border border-red-500/20',
    cta: 'bg-red-600 hover:bg-red-500 shadow-red-900/20',
    glow: 'from-red-500/15',
  },
};

const FactoryLobby = () => {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    const checkStatus = async () => {
      const next = {};
      // Probe
      next.probe = supabase ? 'ready' : 'error';
      // Build Health
      next.build = import.meta.env.VITE_SUPABASE_URL ? 'ready' : 'config_missing';
      // Doctor auth
      const { data } = await supabase.auth.getSession();
      next.doctor = data.session ? 'ready' : 'standby';
      // Tenant default
      next.tenant = 'standby';
      setStatuses(next);
    };
    checkStatus();
  }, []);

  const renderStatus = (id) => {
    const s = statuses[id] || 'loading';
    if (s === 'ready')
      return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">READY</Badge>;
    if (s === 'error')
      return <Badge variant="destructive" className="text-xs px-2">ERROR</Badge>;
    if (s === 'config_missing')
      return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">CONFIG</Badge>;
    return <Badge variant="outline" className="text-slate-500 border-slate-700">STANDBY</Badge>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex items-end justify-between border-b border-border pb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Factory Console</h2>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Welcome to the Black Horse Factory. Select a workstation to begin diagnostic, repair, or security operations.
            All systems are nominal.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-right px-6 border-r border-border">
            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Environment</div>
            <div className="text-white font-mono font-bold">{config.project?.environment?.toUpperCase() || 'LOCAL'}</div>
          </div>
          <div className="text-right pl-2">
            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Last Scan</div>
            <div className="text-emerald-400 font-mono font-bold">JUST NOW</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {config.stations.map((station) => {
          const Icon = ICON_MAP[station.icon] || Activity;
          const c = COLOR_STYLES[station.color] || COLOR_STYLES.emerald;
          return (
            <div
              key={station.id}
              className="group relative bg-[#0f172a]/60 border border-slate-800 hover:border-slate-600 rounded-xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5 cursor-pointer overflow-hidden"
              onClick={() => navigate(station.route || station.path)}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${c.glow} to-transparent blur-[50px] rounded-full -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity`} />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-lg bg-[#020617] ${c.icon} transition-transform group-hover:scale-110`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {renderStatus(station.id)}
                </div>

                <div className="mb-8">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                    {station.label}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{station.description}</p>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <Button size="sm" className={`${c.cta} text-white font-medium px-6`}>
                    {station.cta}
                  </Button>
                  <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="bg-[#0f172a] border-slate-800">
        <CardContent className="p-4 flex items-center gap-4 text-xs font-mono text-slate-400">
          <Terminal className="w-4 h-4 text-slate-500" />
          <span className="text-slate-600">10:42:05</span>
          <span className="text-emerald-500">SYSTEM_READY</span>
          <span>Factory shell initialized successfully.</span>
        </CardContent>
      </Card>
    </div>
  );
};

export default FactoryLobby;
