
import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Timer } from 'lucide-react';

const CoachingPanel = ({ intent, callDuration, selectedScriptRisk }) => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const newAlerts = [];

    // Duration Alerts
    if (callDuration > 300) { // 5 mins
        newAlerts.push({ type: 'warning', msg: 'Call is running long. Try to pivot to closing or booking.' });
    }

    // Intent Specific Alerts
    if (intent === 'inbound_price_check') {
        newAlerts.push({ type: 'info', msg: 'Coach: Avoid giving exact phone quotes. Give ranges and push for onsite inspection.' });
    }
    if (intent === 'outbound_cold_residential') {
        newAlerts.push({ type: 'info', msg: 'Coach: Focus on "Neighborhood Activity" to build trust quickly.' });
    }

    // Risk Alerts
    if (selectedScriptRisk === 'high') {
        newAlerts.push({ type: 'danger', msg: 'RISK ALERT: You selected a high-risk script. Ensure you stick to compliance guidelines.' });
    }

    setAlerts(newAlerts);
  }, [intent, callDuration, selectedScriptRisk]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      {alerts.map((alert, idx) => (
        <Alert key={idx} variant={alert.type === 'danger' ? 'destructive' : 'default'} className="py-2">
           {alert.type === 'danger' ? <ShieldAlert className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
           <AlertTitle className="text-xs font-bold uppercase">{alert.type === 'danger' ? 'Compliance Alert' : 'Coaching Tip'}</AlertTitle>
           <AlertDescription className="text-xs">
             {alert.msg}
           </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

export default CoachingPanel;
