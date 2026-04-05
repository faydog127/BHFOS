import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CloudRain, Wind, TrendingUp, AlertTriangle, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SignalsMonitor = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSignals();

    const channel = supabase
      .channel('signals-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_signals' }, (payload) => {
        fetchSignals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSignals = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_signals')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (data) setSignals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'weather': return <CloudRain className="h-5 w-5 text-blue-500" />;
      case 'aqi': return <Wind className="h-5 w-5 text-gray-500" />;
      case 'trend': return <TrendingUp className="h-5 w-5 text-green-500" />;
      default: return <Info className="h-5 w-5 text-slate-500" />;
    }
  };

  const getSeverityColor = (sev) => {
    switch(sev) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-700';
      case 'warning': return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'positive': return 'bg-green-50 border-green-200 text-green-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Live Signals Monitor
          </CardTitle>
          <RefreshCw className={`h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-600 ${loading ? 'animate-spin' : ''}`} onClick={fetchSignals} />
        </div>
      </CardHeader>
      <CardContent className="px-0 space-y-3">
        <AnimatePresence>
          {signals.map((signal) => (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`p-4 rounded-lg border flex gap-3 items-start ${getSeverityColor(signal.severity)}`}
            >
              <div className="mt-0.5 p-1.5 bg-white/50 rounded-full">
                {getIcon(signal.type)}
              </div>
              <div>
                <h4 className="font-bold text-sm">{signal.title}</h4>
                <p className="text-xs opacity-90 mt-1 leading-snug">{signal.description}</p>
                {signal.data && Object.keys(signal.data).length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {Object.entries(signal.data).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-[10px] bg-white/40 border-black/10 uppercase">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {signals.length === 0 && !loading && (
          <div className="text-center p-6 text-slate-400 text-sm border border-dashed rounded-lg">
            No active signals detected.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SignalsMonitor;