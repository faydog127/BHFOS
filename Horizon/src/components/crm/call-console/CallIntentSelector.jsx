
import React from 'react';
import { PhoneIncoming, PhoneOutgoing, UserPlus, DollarSign, HelpCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const intents = [
  { id: 'inbound_price_check', label: 'Price Check', icon: DollarSign, type: 'inbound', color: 'text-green-500' },
  { id: 'inbound_booking', label: 'Booking Request', icon: PhoneIncoming, type: 'inbound', color: 'text-blue-500' },
  { id: 'inbound_tire_kicker', label: 'Info / Tire Kicker', icon: HelpCircle, type: 'inbound', color: 'text-amber-500' },
  { id: 'outbound_cold_residential', label: 'Cold Residential', icon: PhoneOutgoing, type: 'outbound', color: 'text-indigo-500' },
  { id: 'outbound_b2b', label: 'B2B Prospecting', icon: UserPlus, type: 'outbound', color: 'text-purple-500' },
  { id: 'outbound_referral', label: 'Referral Follow-up', icon: UserPlus, type: 'outbound', color: 'text-emerald-500' },
  { id: 'outbound_missed', label: 'Missed Call Back', icon: AlertTriangle, type: 'outbound', color: 'text-red-500' },
];

const CallIntentSelector = ({ selectedIntent, onSelect }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      {intents.map((intent) => (
        <button
          key={intent.id}
          onClick={() => onSelect(intent.id)}
          className={cn(
            "flex flex-col items-center justify-center p-3 rounded-lg border transition-all hover:bg-slate-50 dark:hover:bg-slate-800",
            selectedIntent === intent.id 
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500" 
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          )}
        >
          <intent.icon className={cn("h-5 w-5 mb-1", intent.color)} />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{intent.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{intent.type}</span>
        </button>
      ))}
    </div>
  );
};

export default CallIntentSelector;
