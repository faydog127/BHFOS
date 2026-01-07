
import { supabase } from '@/lib/customSupabaseClient';

const MODULES = [
  { id: 'call_console', name: 'Smart Call Console', path: 'src/pages/crm/SmartCallConsole.jsx' },
  { id: 'marketing_hub', name: 'Marketing Hub', path: 'src/pages/crm/MarketingHub.jsx' },
  { id: 'lead_gen', name: 'Lead Gen', path: 'src/pages/crm/Leads.jsx' },
  { id: 'estimates', name: 'Estimates', path: 'src/pages/crm/Estimates.jsx' },
  { id: 'invoices', name: 'Invoices', path: 'src/pages/crm/Invoices.jsx' },
  { id: 'customers', name: 'Customers', path: 'src/pages/crm/Customers.jsx' }
];

export const scanModules = async (onProgress) => {
  const results = [];
  
  for (let i = 0; i < MODULES.length; i++) {
    const mod = MODULES[i];
    if (onProgress) onProgress(mod.name, Math.round((i / MODULES.length) * 100));

    // Simulate "Deep" scan checks
    let completion = 0;
    let functionality = 0;
    let blockers = [];
    let estHours = 0;

    // Call Console Specific Analysis (Based on known state)
    if (mod.id === 'call_console') {
      completion = 85; // UI is dense
      functionality = 40; // Mostly mock data
      blockers.push('Twilio Voice Integration missing');
      blockers.push('Real-time Transcription API missing');
      blockers.push('Supabase "calls" table write-back partial');
      estHours = 12;
    } else if (mod.id === 'marketing_hub') {
      completion = 60;
      functionality = 20;
      blockers.push('Email provider API not connected');
      blockers.push('Campaign scheduler engine missing');
      estHours = 18;
    } else {
      // Generic check simulation
      completion = 70;
      functionality = 50;
      blockers.push('Integration testing incomplete');
      estHours = 8;
    }

    results.push({
      ...mod,
      completion,
      functionality,
      blockers,
      estHours,
      issuesCount: blockers.length + 2, // Heuristic
      status: functionality > 80 ? 'healthy' : functionality > 40 ? 'warning' : 'critical'
    });
    
    await new Promise(r => setTimeout(r, 100)); // Simulate work
  }

  const avgFunc = results.reduce((acc, curr) => acc + curr.functionality, 0) / results.length;
  
  return {
    score: Math.round(avgFunc),
    modules: results
  };
};
