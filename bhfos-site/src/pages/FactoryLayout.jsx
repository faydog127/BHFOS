import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Database, Hammer, ShieldAlert, Layers, Settings, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import config from '@/bhf.config.json';
import { BRAND } from '@/lib/featureFlags';

const ICON_MAP = { Activity, Database, Hammer, ShieldAlert };

const FactoryLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState('Loading...');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || 'Guest / Disconnected');
    };
    getUser();
  }, []);

  return (
    <div className="flex h-screen bg-background text-slate-200 font-sans overflow-hidden">
      <aside className="w-72 border-r border-border bg-[#050b1d] flex flex-col shadow-2xl z-20">
        <div
          className="p-6 border-b border-border flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/')}
        >
          <img
            src={BRAND?.logoPath || '/blackhorse-logo.png'}
            alt={`${BRAND?.name || 'Factory'} Logo`}
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-white tracking-tight text-lg leading-none mb-1">
              {(BRAND?.name || 'Factory').toUpperCase()}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                {(BRAND?.product || 'Diagnostics').toUpperCase()}
              </span>
              <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-700 text-slate-500">
                v{config.project?.version || 'n/a'}
              </Badge>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="px-3 mb-2 mt-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Workstations
          </div>
          {config.stations.map((station) => {
            const Icon = ICON_MAP[station.icon] || Activity;
            const path = station.route || station.path;
            const isActive = location.pathname.startsWith(path);
            const activeColor = `text-${station.color}-400`;
            const activeBg = `bg-${station.color}-950/20 border-${station.color}-900/50`;
            return (
              <button
                key={station.id}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all group relative ${
                  isActive
                    ? `${activeBg} text-white`
                    : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? activeColor : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="font-medium">{station.label || station.name}</span>
                {isActive && <ChevronRight className={`w-3 h-3 ml-auto ${activeColor}`} />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-[#020617]">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
              {userEmail.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-white truncate w-32" title={userEmail}>
                {userEmail}
              </span>
              <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Session Active
              </span>
            </div>
            <Settings className="w-4 h-4 text-slate-500 ml-auto hover:text-white cursor-pointer" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/5 to-transparent pointer-events-none" />
        <div className="flex-1 overflow-auto p-8 relative z-10 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default FactoryLayout;
