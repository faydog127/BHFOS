
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, Activity, Wrench, History, ArrowRight, 
  TrendingUp, CheckCircle2, AlertTriangle, Calendar 
} from 'lucide-react';
import { diagnosticsLogger } from '@/services/diagnosticsLogger';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const DocumentationDashboard = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    totalIssues: 0,
    totalFixed: 0,
    avgHealth: 0,
    sessionsCount: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const recent = await diagnosticsLogger.getRecentSessions(10);
    setSessions(recent);

    // Calculate mock stats based on available data
    if (recent.length > 0) {
      const totalFound = recent.reduce((acc, curr) => acc + (curr.total_issues_found || 0), 0);
      const totalFixed = recent.reduce((acc, curr) => acc + (curr.total_issues_fixed || 0), 0);
      const avgScore = Math.round(recent.reduce((acc, curr) => acc + (curr.health_score_end || 0), 0) / recent.length);
      
      setStats({
        totalIssues: totalFound,
        totalFixed: totalFixed,
        avgHealth: avgScore,
        sessionsCount: recent.length
      });
    }
  };

  const chartData = sessions.map(s => ({
    date: format(new Date(s.created_at), 'MM/dd HH:mm'),
    health: s.health_score_end,
    issues: s.total_issues_found
  })).reverse();

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6 bg-slate-50/50 min-h-screen font-sans">
      <Helmet><title>Documentation Dashboard | BHF</title></Helmet>

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            Documentation & Fixes
          </h1>
          <p className="text-slate-500 mt-1">Central repository for all system diagnostics, issues, and applied fixes.</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={() => navigate('/bhf/issues')}>
             <AlertTriangle className="w-4 h-4 mr-2" /> View All Issues
           </Button>
           <Button variant="outline" onClick={() => navigate('/bhf/fixes')}>
             <Wrench className="w-4 h-4 mr-2" /> View All Fixes
           </Button>
           <Button onClick={() => navigate('/bhf/master-diagnostics')}>
             <Activity className="w-4 h-4 mr-2" /> Run Diagnostics
           </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Sessions</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.sessionsCount}</h3>
              </div>
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><History className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Issues Found</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.totalIssues}</h3>
              </div>
              <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Fixes Applied</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.totalFixed}</h3>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Wrench className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Avg Health Score</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.avgHealth}%</h3>
              </div>
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg"><Activity className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
             <CardHeader>
               <CardTitle>System Health Trends</CardTitle>
               <CardDescription>Health score improvement over recent sessions.</CardDescription>
             </CardHeader>
             <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="health" stroke="#4f46e5" strokeWidth={3} dot={{r: 4}} />
                  </LineChart>
                </ResponsiveContainer>
             </CardContent>
          </Card>

          <Card>
             <CardHeader>
               <CardTitle>Issues Detected vs Fixed</CardTitle>
               <CardDescription>Volume of diagnostics findings per session.</CardDescription>
             </CardHeader>
             <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="issues" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Sessions List */}
        <div className="space-y-6">
           <Card className="h-full flex flex-col">
             <CardHeader>
               <CardTitle>Recent Diagnostic Sessions</CardTitle>
               <CardDescription>History of system scans and fixes.</CardDescription>
             </CardHeader>
             <CardContent className="flex-1 p-0">
               <ScrollArea className="h-[600px]">
                 <div className="divide-y">
                   {sessions.map((session) => (
                     <div key={session.id} className="p-4 hover:bg-slate-50 transition-colors">
                       <div className="flex justify-between items-start mb-2">
                         <div className="flex flex-col">
                           <span className="font-semibold text-slate-900">Session Report</span>
                           <span className="text-xs text-slate-500 flex items-center gap-1">
                             <Calendar className="w-3 h-3" /> {format(new Date(session.created_at), 'MMM dd, yyyy • HH:mm a')}
                           </span>
                         </div>
                         <Badge variant={session.health_score_end > 80 ? 'default' : 'secondary'} className={session.health_score_end > 80 ? "bg-emerald-500" : ""}>
                           Score: {session.health_score_end}
                         </Badge>
                       </div>
                       
                       <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                         {session.summary || 'No summary provided.'}
                       </p>
                       
                       <div className="flex items-center justify-between">
                         <div className="flex gap-2 text-xs">
                           <span className="text-amber-600 font-medium">{session.total_issues_found} Found</span>
                           <span className="text-slate-300">•</span>
                           <span className="text-emerald-600 font-medium">{session.total_issues_fixed} Fixed</span>
                         </div>
                         <Button variant="ghost" size="sm" className="h-6 text-xs text-indigo-600 hover:text-indigo-700 p-0" onClick={() => navigate(`/bhf/session-report/${session.id}`)}>
                           View Details <ArrowRight className="w-3 h-3 ml-1" />
                         </Button>
                       </div>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default DocumentationDashboard;
