
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Check, Clock, AlertTriangle } from 'lucide-react';

const LeadGenE2E = () => {
  const [status, setStatus] = useState('idle'); // idle, running, complete
  const [steps, setSteps] = useState([
    { id: 1, name: 'Lead Capture Form', status: 'pending' },
    { id: 2, name: 'Validation Logic', status: 'pending' },
    { id: 3, name: 'Availability Check', status: 'pending' },
    { id: 4, name: 'Slot Selection', status: 'pending' },
    { id: 5, name: 'Database Insertion', status: 'pending' },
    { id: 6, name: 'Confirmation Email', status: 'pending' }
  ]);
  const [progress, setProgress] = useState(0);

  const runSimulation = async () => {
    setStatus('running');
    setProgress(0);
    
    const newSteps = steps.map(s => ({ ...s, status: 'pending' }));
    setSteps(newSteps);

    for (let i = 0; i < newSteps.length; i++) {
       // Update current to running
       newSteps[i].status = 'running';
       setSteps([...newSteps]);
       
       // Wait random time
       await new Promise(r => setTimeout(r, 600));
       
       // Success
       newSteps[i].status = 'success';
       setSteps([...newSteps]);
       setProgress(((i + 1) / newSteps.length) * 100);
    }
    
    setStatus('complete');
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
             <CardTitle>End-to-End Workflow Simulation</CardTitle>
             <CardDescription>Validates the complete Lead Generation > Booking > Notification pipeline.</CardDescription>
          </div>
          <Button onClick={runSimulation} disabled={status === 'running'}>
            <Play className="w-4 h-4 mr-2" />
            Start Simulation
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
           {status !== 'idle' && (
             <div className="space-y-1">
               <div className="flex justify-between text-xs text-muted-foreground">
                 <span>Progress</span>
                 <span>{Math.round(progress)}%</span>
               </div>
               <Progress value={progress} className="h-2" />
             </div>
           )}

           <div className="grid gap-3">
             {steps.map((step) => (
               <div key={step.id} className="flex items-center gap-4 p-3 rounded-lg border bg-slate-50/50">
                 <div className="w-8 h-8 rounded-full flex items-center justify-center border bg-white shadow-sm">
                   {step.status === 'pending' && <span className="text-slate-400 text-xs">{step.id}</span>}
                   {step.status === 'running' && <Clock className="w-4 h-4 text-blue-500 animate-pulse" />}
                   {step.status === 'success' && <Check className="w-4 h-4 text-green-500" />}
                   {step.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                 </div>
                 <div className="flex-1">
                   <div className="font-medium text-sm">{step.name}</div>
                   <div className="text-xs text-muted-foreground">
                     {step.status === 'pending' && 'Waiting...'}
                     {step.status === 'running' && 'Executing step logic...'}
                     {step.status === 'success' && 'Verified successfully'}
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadGenE2E;
