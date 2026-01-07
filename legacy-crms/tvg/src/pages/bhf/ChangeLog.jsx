import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, CheckCircle2, 
  RotateCcw, Clock, FileCode, Activity, ArrowUpRight,
  ShieldCheck, User, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Mock Data for Change Log
const MOCK_LOGS = [
  {
    id: 'CL-1024',
    title: 'Standardize Button Variants',
    type: 'Consistency',
    status: 'Applied',
    user: 'System Admin',
    timestamp: '2025-12-15T14:30:00',
    impact: { health: '+5', uiux: '+8' },
    affected: ['src/components/ui/button.jsx', 'src/pages/crm/LeadsPage.jsx'],
    before: '<button class="bg-blue-500">Submit</button>',
    after: '<Button variant="default">Submit</Button>'
  },
  {
    id: 'CL-1023',
    title: 'Fix Mobile Table Scrolling',
    type: 'Mobile UX',
    status: 'Applied',
    user: 'System Doctor',
    timestamp: '2025-12-15T14:15:00',
    impact: { health: '+8', uiux: '+12' },
    affected: ['src/components/crm/EnterpriseTable.jsx'],
    before: 'overflow-x-hidden',
    after: 'overflow-x-auto scrollbar-thin'
  },
  {
    id: 'CL-1022',
    title: 'Update Aria Labels (Accessibility)',
    type: 'Accessibility',
    status: 'Rolled Back',
    user: 'System Admin',
    timestamp: '2025-12-15T13:45:00',
    impact: { health: '-2', uiux: '-5' },
    affected: ['src/components/Navigation.jsx'],
    reason: 'Caused hydration error in production build.'
  },
  {
    id: 'CL-1021',
    title: 'Optimize Bundle Size (Lazy Loading)',
    type: 'Performance',
    status: 'Applied',
    user: 'Auto-Optimizer',
    timestamp: '2025-12-15T10:00:00',
    impact: { health: '+12', uiux: '+5' },
    affected: ['src/App.jsx', 'src/pages/crm/Dashboard.jsx'],
    before: 'import Dashboard from ...',
    after: 'const Dashboard = lazy(() => ...'
  }
];

const ChangeLog = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filteredLogs = MOCK_LOGS.filter(log => 
    (filterType === 'all' || log.type.toLowerCase() === filterType.toLowerCase()) &&
    log.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50 font-sans">
      <Helmet><title>System Change Log | BHF</title></Helmet>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <Button variant="ghost" className="mb-2 pl-0 hover:pl-2 transition-all" onClick={() => navigate('/bhf/master-diagnostics')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Diagnostics
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <History className="w-8 h-8 text-indigo-600" />
            System Change Log
          </h1>
          <p className="text-slate-500 mt-1">Audit trail of all automated and manual system modifications.</p>
        </div>
        
        <div className="flex gap-4">
           <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col items-center min-w-[120px]">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Changes</span>
              <span className="text-2xl font-bold text-slate-900">{MOCK_LOGS.length}</span>
           </Card>
           <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col items-center min-w-[120px]">
              <span className="text-xs font-semibold text-slate-500 uppercase">Health Impact</span>
              <span className="text-2xl font-bold text-emerald-600 flex items-center">
                 <ArrowUpRight className="w-4 h-4 mr-1" /> 25%
              </span>
           </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <Input 
             placeholder="Search changes..." 
             className="pl-9 bg-white" 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
           <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Filter by Type" />
           </SelectTrigger>
           <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="consistency">Consistency</SelectItem>
              <SelectItem value="accessibility">Accessibility</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="mobile ux">Mobile UX</SelectItem>
           </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {filteredLogs.map((log) => (
          <Card key={log.id} className="border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
             <div className="flex flex-col md:flex-row">
                {/* Meta Panel */}
                <div className="bg-slate-50/50 p-6 md:w-64 border-b md:border-b-0 md:border-r border-slate-100 flex-shrink-0">
                   <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className={cn(
                         "capitalize",
                         log.status === 'Applied' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                      )}>
                         {log.status === 'Applied' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                         {log.status}
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">{log.id}</span>
                   </div>
                   
                   <div className="space-y-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                         <User className="w-4 h-4 text-slate-400" /> {log.user}
                      </div>
                      <div className="flex items-center gap-2">
                         <Calendar className="w-4 h-4 text-slate-400" /> {new Date(log.timestamp).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                         <Clock className="w-4 h-4 text-slate-400" /> {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                   </div>

                   <div className="mt-6 pt-4 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Impact Score</p>
                      <div className="flex gap-4">
                         <div>
                            <span className="text-xs text-slate-400 block">Health</span>
                            <span className={cn("font-bold", log.impact.health.startsWith('+') ? "text-emerald-600" : "text-red-600")}>
                               {log.impact.health}
                            </span>
                         </div>
                         <div>
                            <span className="text-xs text-slate-400 block">UI/UX</span>
                            <span className={cn("font-bold", log.impact.uiux.startsWith('+') ? "text-emerald-600" : "text-red-600")}>
                               {log.impact.uiux}
                            </span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Content Panel */}
                <div className="p-6 flex-1">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <h3 className="text-xl font-bold text-slate-900">{log.title}</h3>
                         <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{log.type}</Badge>
                            <span className="text-sm text-slate-500">Affected: {log.affected.length} files</span>
                         </div>
                      </div>
                   </div>

                   {/* Code Diff Simulation */}
                   {(log.before || log.after) && (
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <div className="text-red-400 font-bold mb-2 border-b border-slate-700 pb-1">BEFORE</div>
                            <div className="bg-red-900/20 p-2 rounded text-red-200 border-l-2 border-red-500 break-all">
                               {log.before || '// No code available'}
                            </div>
                         </div>
                         <div className="space-y-1">
                            <div className="text-emerald-400 font-bold mb-2 border-b border-slate-700 pb-1">AFTER</div>
                            <div className="bg-emerald-900/20 p-2 rounded text-emerald-200 border-l-2 border-emerald-500 break-all">
                               {log.after || '// No code available'}
                            </div>
                         </div>
                      </div>
                   )}
                   
                   {log.reason && (
                      <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200">
                         <span className="font-bold">Reason for Rollback:</span> {log.reason}
                      </div>
                   )}

                   <div className="mt-4 pt-4 border-t flex justify-end">
                      <Button variant="outline" size="sm">
                         <FileCode className="w-4 h-4 mr-2" /> View Full Diff
                      </Button>
                   </div>
                </div>
             </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ChangeLog;