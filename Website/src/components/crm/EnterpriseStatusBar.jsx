
import React, { useState, useEffect } from 'react';
import { 
  Phone, Clock, MessageSquare, CheckCircle2, 
  AlertCircle, Wifi, Signal, Battery, Activity 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EnterpriseStatusBar = () => {
  const [time, setTime] = useState(new Date());
  const [callActive, setCallActive] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-10 bg-slate-900 text-slate-300 border-t border-slate-800 flex items-center justify-between px-4 text-xs font-medium fixed bottom-0 w-full z-50 select-none">
      
      {/* Left: System Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-500">System Operational</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-400">
          <Activity className="w-3 h-3" />
          <span>Latency: 24ms</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-400">
          <Wifi className="w-3 h-3" />
          <span>VoIP Connected</span>
        </div>
      </div>

      {/* Center: Active Context */}
      <div className="flex items-center gap-6">
        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full transition-colors", callActive ? "bg-green-900/50 text-green-400" : "bg-slate-800/50")}>
          <Phone className={cn("w-3 h-3", callActive && "animate-pulse")} />
          <span>{callActive ? 'Active Call' : 'Ready for Calls'}</span>
          {callActive && <span className="font-mono ml-1">{formatDuration(duration)}</span>}
        </div>
        
        <div className="hidden md:flex items-center gap-4">
           <div className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
              <MessageSquare className="w-3 h-3 text-blue-400" />
              <span>3 Unread</span>
           </div>
           <div className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
              <CheckCircle2 className="w-3 h-3 text-orange-400" />
              <span>5 Tasks Pending</span>
           </div>
        </div>
      </div>

      {/* Right: Clock & Agent Status */}
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2">
           <span className="text-slate-500">Session:</span>
           <span className="font-mono">4h 12m</span>
        </div>
        <div className="w-px h-4 bg-slate-700 hidden md:block" />
        <div className="flex items-center gap-2 font-mono text-slate-400">
          <Clock className="w-3 h-3" />
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseStatusBar;
