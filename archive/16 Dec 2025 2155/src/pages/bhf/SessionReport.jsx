
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Calendar, CheckCircle, AlertTriangle, FileCode, Clock, Server, Download } from 'lucide-react';
import { diagnosticsLogger } from '@/services/diagnosticsLogger';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const SessionReport = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // If no ID provided, get latest
      let sessionData;
      if (!sessionId) {
        const recent = await diagnosticsLogger.getRecentSessions(1);
        if (recent.length > 0) {
           sessionData = await diagnosticsLogger.getSessionDetails(recent[0].id);
        }
      } else {
        sessionData = await diagnosticsLogger.getSessionDetails(sessionId);
      }
      
      setData(sessionData);
      setLoading(false);
    };
    loadData();
  }, [sessionId]);

  if (loading) return <div className="p-10 text-center">Loading Report...</div>;
  if (!data) return <div className="p-10 text-center">Session not found.</div>;

  const { session, issues, fixes } = data;

  const getSeverityColor = (sev) => {
    switch(sev?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 min-h-screen bg-white">
       <Helmet><title>Session Report | {format(new Date(session.created_at), 'yyyy-MM-dd')}</title></Helmet>
       
       {/* Nav */}
       <div className="flex items-center gap-4">
         <Button variant="ghost" size="sm" onClick={() => navigate('/bhf/documentation')}>
           <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
         </Button>
         <div className="flex-1" />
         <Button variant="outline" size="sm">
           <Download className="w-4 h-4 mr-2" /> Export PDF
         </Button>
       </div>

       {/* Header */}
       <div className="space-y-2">
         <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900">Diagnostic Session Report</h1>
            <Badge className="text-lg px-3 py-1 bg-indigo-600 hover:bg-indigo-700">Health: {session.health_score_end}/100</Badge>
         </div>
         <p className="text-slate-500 flex items-center gap-2">
           <Calendar className="w-4 h-4" /> {format(new Date(session.created_at), 'MMMM dd, yyyy')} 
           <Clock className="w-4 h-4 ml-2" /> {format(new Date(session.created_at), 'HH:mm a')}
           <span className="mx-2 text-slate-300">|</span>
           Session ID: <span className="font-mono text-xs text-slate-400">{session.id}</span>
         </p>
       </div>

       {/* Executive Summary */}
       <Card className="bg-slate-50 border-slate-200">
         <CardHeader>
           <CardTitle>Executive Summary</CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
            <p className="text-slate-700 leading-relaxed">{session.summary}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                 <div className="text-xs text-slate-500 uppercase">Issues Found</div>
                 <div className="text-2xl font-bold text-amber-600">{session.total_issues_found}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                 <div className="text-xs text-slate-500 uppercase">Issues Fixed</div>
                 <div className="text-2xl font-bold text-emerald-600">{session.total_issues_fixed}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                 <div className="text-xs text-slate-500 uppercase">Improvement</div>
                 <div className="text-2xl font-bold text-indigo-600">+{session.health_score_improvement}%</div>
              </div>
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                 <div className="text-xs text-slate-500 uppercase">Modules Improved</div>
                 <div className="text-2xl font-bold text-slate-900">{session.modules_improved?.length || 0}</div>
              </div>
            </div>
         </CardContent>
       </Card>

       {/* Fixes Applied */}
       <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Applied Fixes & Enhancements
          </h2>
          <div className="grid gap-4">
             {fixes.length === 0 ? (
               <div className="p-6 text-center text-slate-500 border rounded-lg bg-slate-50">No fixes logged for this session.</div>
             ) : (
               fixes.map(fix => (
                 <Card key={fix.id} className="overflow-hidden">
                   <CardHeader className="py-3 bg-emerald-50/50 border-b">
                     <div className="flex justify-between items-start">
                        <div className="font-semibold text-emerald-900">{fix.fix_description}</div>
                        <Badge variant="outline" className="bg-white">{fix.fix_type}</Badge>
                     </div>
                   </CardHeader>
                   <CardContent className="py-4 space-y-3">
                      <div className="flex gap-2 text-sm text-slate-600">
                        <span className="font-medium">Files Changed:</span>
                        <div className="flex flex-wrap gap-2">
                          {fix.files_changed?.map((f, i) => (
                            <Badge key={i} variant="secondary" className="font-mono text-xs">{f}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      {fix.code_before && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-md overflow-hidden text-xs font-mono">
                           <div className="bg-red-50 p-2 border-r border-red-100">
                             <div className="text-red-800 font-bold mb-1">BEFORE</div>
                             <pre className="whitespace-pre-wrap text-red-700">{fix.code_before}</pre>
                           </div>
                           <div className="bg-green-50 p-2">
                             <div className="text-green-800 font-bold mb-1">AFTER</div>
                             <pre className="whitespace-pre-wrap text-green-700">{fix.code_after || '(Code updated)'}</pre>
                           </div>
                         </div>
                      )}
                      
                      <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t mt-2">
                         <span>Applied by: {fix.applied_by}</span>
                         <span className="flex items-center gap-1 text-emerald-600 font-medium">
                           <CheckCircle className="w-3 h-3" /> Verified
                         </span>
                      </div>
                   </CardContent>
                 </Card>
               ))
             )}
          </div>
       </div>

       {/* Issues Found */}
       <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Issues Log
          </h2>
          <Card>
            <CardContent className="p-0">
               <ScrollArea className="h-[500px]">
                 <div className="divide-y">
                   {issues.map((issue, idx) => (
                     <div key={idx} className="p-4 hover:bg-slate-50">
                        <div className="flex justify-between items-start mb-1">
                           <div className="font-medium text-slate-900">{issue.issue_description}</div>
                           <Badge className={cn("text-xs font-normal border", getSeverityColor(issue.severity))}>
                             {issue.severity}
                           </Badge>
                        </div>
                        <div className="text-sm text-slate-500 mb-2 flex items-center gap-2">
                           <FileCode className="w-3 h-3" />
                           <span className="font-mono">{issue.file_path}:{issue.line_number}</span>
                        </div>
                        {issue.code_snippet && (
                          <div className="bg-slate-900 text-slate-300 p-2 rounded text-xs font-mono overflow-x-auto">
                            {issue.code_snippet}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-400">
                           Impact: {issue.impact}
                        </div>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
            </CardContent>
          </Card>
       </div>

    </div>
  );
};

export default SessionReport;
