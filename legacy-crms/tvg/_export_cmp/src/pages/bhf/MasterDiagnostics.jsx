import React, { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, Layout, Workflow, Code, Zap, Package, 
  AlertTriangle, FileCode, Download, Trash2, CheckCircle2,
  Terminal, Play, RotateCcw, Settings, AlertOctagon,
  Sparkles, FileText, ChevronRight, Monitor, History
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import QuickFixes from '@/components/diagnostics/QuickFixes';
import { scoreModule, getScoreColor as getUiScoreColor, getScoreLabel, DIMENSIONS } from '@/services/uiuxScorer';

// Helper Components
const ScoreCard = ({ title, score, icon: Icon }) => (
  <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", score >= 90 ? "bg-emerald-100 text-emerald-600" : score >= 70 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600")}>
         <Icon className="w-5 h-5" />
      </div>
      <div>
         <div className="text-sm font-medium text-slate-500">{title}</div>
         <div className="text-2xl font-bold text-slate-900">{score}%</div>
      </div>
    </div>
    <Progress value={score} className="w-16 h-2" indicatorClassName={score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-red-500"} />
  </div>
);

const IssueItem = ({ type, message, file, line, severity }) => (
  <div className="flex items-start gap-3 p-3 text-sm border-b last:border-0 hover:bg-slate-50 transition-colors bg-white">
     <div className="mt-0.5">
       {severity === 'critical' || severity === 'high' ? (
         <AlertOctagon className="w-4 h-4 text-red-500" />
       ) : (
         <AlertTriangle className="w-4 h-4 text-amber-500" />
       )}
     </div>
     <div className="flex-1">
       <div className="font-medium text-slate-800 break-words">{message}</div>
       {file && (
         <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1">
           <FileCode className="w-3 h-3" /> {file}:{line}
         </div>
       )}
       <div className="flex gap-2 mt-2">
         <Badge variant="outline" className="text-[10px] uppercase border-slate-200">{type}</Badge>
         <Badge variant={severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">{severity}</Badge>
       </div>
     </div>
  </div>
);

const UiUxBreakdown = ({ moduleName, metadata }) => {
  const scoreData = scoreModule(moduleName, metadata);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 border rounded-md overflow-hidden bg-slate-50/50">
      <div 
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-slate-700">UI/UX Score:</span>
          <Badge className={cn("text-[10px] h-5 border", getUiScoreColor(scoreData.overallScore))}>
            {scoreData.overallScore} - {getScoreLabel(scoreData.overallScore)}
          </Badge>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", expanded && "rotate-90")} />
      </div>

      {expanded && (
        <div className="p-3 border-t space-y-3 bg-white">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
             {Object.entries(scoreData.dimensionScores).map(([key, score]) => (
               <div key={key} className="flex items-center justify-between text-xs">
                 <span className="text-slate-500 truncate pr-2" title={DIMENSIONS[key].label}>{DIMENSIONS[key].label}</span>
                 <div className="flex items-center gap-2 w-24">
                    <Progress value={score} className="h-1.5 flex-1" indicatorClassName={score < 70 ? "bg-red-400" : "bg-emerald-400"} />
                    <span className="font-mono w-6 text-right">{score}</span>
                 </div>
               </div>
             ))}
          </div>
          
          {scoreData.recommendations.length > 0 && (
             <div className="bg-indigo-50 p-2 rounded text-xs text-indigo-800 flex gap-2 items-start mt-2">
                <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                <div>
                   <span className="font-bold">Recommendation:</span> {scoreData.recommendations[0]}
                </div>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

const MasterDiagnostics = () => {
  const navigate = useNavigate();
  const { 
    runDiagnostics, 
    aggregatedScore, 
    allFailures, 
    loading, 
    logs,
    codeQuality,
    moduleHealth,
    workflowHealth,
    integrationHealth,
    dependencyHealth
  } = useSystemHealth();
  
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const logEndRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Auto-run if score is perfect (meaning likely uninitialized state)
    if (aggregatedScore === 100 && allFailures.length === 0 && logs.length === 0) {
      runDiagnostics();
    }
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!loading) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading]);

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const clearLogs = () => {
    toast({ title: "Logs cleared", description: "Run a new scan to generate new logs." });
  };

  const exportLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-health-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Logs exported", description: "File downloaded successfully." });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1800px] mx-auto space-y-6 bg-slate-50/50 min-h-screen font-sans relative">
      <Helmet><title>Master Diagnostics | BHF</title></Helmet>

      {/* Floating Quick Fixes Box */}
      {aggregatedScore < 95 && (
         <QuickFixes failures={allFailures} />
      )}

      {/* 1. Header & Global Score */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-900">
            <Activity className="w-8 h-8 text-indigo-600" />
            System Health Console
          </h1>
          <div className="text-sm text-slate-500 mt-1">Deep granular analysis of Code, Modules, and Infrastructure.</div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
           <div className="text-right hidden sm:block">
               <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Health</div>
               <div className={cn("text-5xl font-black leading-none", getScoreColor(aggregatedScore))}>
                 {aggregatedScore}
               </div>
           </div>
           <div className="flex gap-2 w-full sm:w-auto">
             <Button variant="outline" size="lg" className="flex-1 sm:flex-none h-12 border-slate-300" onClick={() => navigate('/bhf/change-log')}>
               <History className="w-4 h-4 mr-2" />
               Change Log
             </Button>
             <Button variant="outline" size="lg" className="flex-1 sm:flex-none h-12 border-slate-300" onClick={() => navigate('/bhf/config-explainer')}>
               <Settings className="w-4 h-4 mr-2" />
               Config
             </Button>
             <Button variant="outline" size="lg" className="flex-1 sm:flex-none h-12 border-slate-300" onClick={() => navigate('/bhf/improvement-analysis')}>
               <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
               UX Analysis
             </Button>
             <Button size="lg" onClick={runDiagnostics} disabled={loading} className={cn("flex-1 sm:flex-none shadow-md h-12 px-6 bg-slate-900 hover:bg-slate-800", loading && "animate-pulse")}>
               {loading ? <RotateCcw className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
               {loading ? 'Scanning...' : 'Run Deep Scan'}
             </Button>
           </div>
        </div>
      </div>

      {/* 2. KPI Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
         <ScoreCard title="Code Quality" score={codeQuality?.score || 0} icon={Code} />
         <ScoreCard title="Modules" score={moduleHealth?.score || 0} icon={Layout} />
         <ScoreCard title="Workflows" score={workflowHealth?.score || 0} icon={Workflow} />
         <ScoreCard title="Integrations" score={integrationHealth?.score || 0} icon={Zap} />
         <ScoreCard title="Dependencies" score={dependencyHealth?.score || 0} icon={Package} />
      </div>

      {/* 4. Main Content Area: Logs (Left) + Tabs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[800px]">
        
        {/* LEFT COLUMN: Real-time Logs (4 cols) */}
        <div className="lg:col-span-4 h-[400px] lg:h-full flex flex-col">
          <Card className="h-full bg-slate-950 text-slate-300 border-slate-800 flex flex-col shadow-lg overflow-hidden">
             <CardHeader className="py-3 px-4 border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between shrink-0">
               <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400">
                 <Terminal className="w-3 h-3" /> DIAGNOSTIC STREAM
               </div>
               <div className="flex gap-2">
                 <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300" onClick={exportLogs} title="Export Logs">
                   <Download className="w-3 h-3" />
                 </Button>
                 <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400" onClick={clearLogs} title="Clear Logs">
                   <Trash2 className="w-3 h-3" />
                 </Button>
               </div>
             </CardHeader>
             <CardContent className="p-0 flex-1 relative">
               <div className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                 {logs.length === 0 && <span className="text-slate-600 italic">Ready to start...</span>}
                 {logs.map((log, i) => (
                   <div key={i} className="border-b border-slate-800/50 pb-0.5 last:border-0 break-all">
                     <span className="opacity-50 mr-2">{log.split(']')[0]}]</span>
                     <span className={cn(
                        log.includes('CRITICAL') || log.includes('error') ? "text-red-400 font-bold" : 
                        log.includes('Score') ? "text-emerald-400 font-bold" :
                        "text-slate-300"
                     )}>
                        {log.split(']').slice(1).join(']')}
                     </span>
                   </div>
                 ))}
                 <div ref={logEndRef} />
               </div>
             </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Detailed Tabs (8 cols) */}
        <div className="lg:col-span-8 h-full flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <div className="bg-white p-1 rounded-t-lg border-x border-t shadow-sm shrink-0">
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto min-h-10 p-1 bg-slate-100/50">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="modules">Modules</TabsTrigger>
                <TabsTrigger value="workflows">Workflows</TabsTrigger>
                <TabsTrigger value="integrations">Integrations</TabsTrigger>
                <TabsTrigger value="dependencies">Deps</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 bg-white border-x border-b rounded-b-lg shadow-sm overflow-hidden relative min-h-[500px]">
              <div className="absolute inset-0 overflow-y-auto p-6 scrollbar-thin">
                
                {/* OVERVIEW CONTENT */}
                <TabsContent value="overview" className="mt-0 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="bg-slate-50 border-slate-200">
                        <CardHeader className="pb-2">
                           <CardTitle className="text-sm font-medium text-slate-500 uppercase">Total Issues Detected</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <div className="text-3xl font-bold text-slate-900">{allFailures.length}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-50 border-slate-200">
                        <CardHeader className="pb-2">
                           <CardTitle className="text-sm font-medium text-slate-500 uppercase">Estimated Fix Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <div className="text-3xl font-bold text-indigo-600">{Math.ceil(allFailures.length * 0.5)} Hours</div>
                        </CardContent>
                      </Card>
                   </div>
                   
                   <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" /> 
                        Top Critical Issues
                      </h3>
                      <div className="border rounded-md divide-y shadow-sm">
                        {allFailures.filter(f => f.severity === 'critical' || f.severity === 'high').length > 0 ? (
                            allFailures.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 10).map((fail, i) => (
                              <IssueItem key={i} type={fail.type} message={fail.message} severity={fail.severity} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-slate-500 bg-slate-50">
                              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                              No critical issues found. Great job!
                            </div>
                        )}
                      </div>
                   </div>
                </TabsContent>

                {/* CODE CONTENT */}
                <TabsContent value="code" className="mt-0">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Static Analysis Report</h3>
                      <Badge variant="outline">{codeQuality?.totalIssues || 0} Issues</Badge>
                   </div>
                   <div className="border rounded-md divide-y shadow-sm bg-white">
                      {codeQuality?.issues.length > 0 ? (
                         codeQuality.issues.map((issue, i) => (
                             <IssueItem 
                                key={i} 
                                type={issue.issueType} 
                                message={issue.message} 
                                file={issue.file} 
                                line={issue.line} 
                                severity={issue.severity} 
                             />
                          ))
                      ) : (
                         <div className="p-12 text-center text-slate-500">No code quality issues detected.</div>
                      )}
                   </div>
                </TabsContent>

                {/* MODULES CONTENT */}
                <TabsContent value="modules" className="mt-0">
                   <div className="grid gap-4">
                      {moduleHealth?.modules.map((mod, i) => (
                           <Card key={i} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                 <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                       <div className={cn("p-2 rounded-lg", mod.functionality > 80 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600")}>
                                         <Layout className="w-5 h-5" />
                                       </div>
                                       <div>
                                          <div className="flex items-center gap-2">
                                             <h4 className="font-bold text-lg text-slate-900">{mod.name}</h4>
                                          </div>
                                          <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                             <span>Completeness: {mod.completion}%</span>
                                             <span>•</span>
                                             <span>Functionality: {mod.functionality}%</span>
                                          </div>
                                       </div>
                                    </div>
                                    <Badge variant={mod.status === 'healthy' ? 'default' : 'destructive'} className={mod.status === 'healthy' ? 'bg-emerald-500' : ''}>
                                       {mod.status.toUpperCase()}
                                    </Badge>
                                 </div>
                                 <UiUxBreakdown moduleName={mod.name} metadata={mod} />
                              </CardContent>
                           </Card>
                         )
                      )}
                   </div>
                </TabsContent>

                {/* WORKFLOWS CONTENT */}
                <TabsContent value="workflows" className="mt-0">
                   <div className="space-y-6">
                      <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Workflow Health</h3>
                      {workflowHealth?.workflows.map((wf, i) => (
                         <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                               <h3 className="font-bold text-lg flex items-center gap-2">
                                  <Workflow className="w-5 h-5 text-indigo-500" />
                                  {wf.name}
                               </h3>
                               <div className="text-right">
                                  <div className="text-2xl font-bold">{wf.functionality}%</div>
                                  <div className="text-xs text-slate-500">Reliability Score</div>
                               </div>
                            </div>
                            <div className="space-y-4">
                               <div>
                                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-600">
                                     <span>Step Completion</span>
                                     <span>{wf.stepDetails.filter(s => s.status === 'implemented').length} / {wf.stepDetails.length} Steps</span>
                                  </div>
                                  <Progress value={wf.functionality} className="h-2" />
                               </div>
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {wf.stepDetails.map((step, idx) => (
                                     <div key={idx} className={cn("text-xs p-2 rounded border text-center font-medium", 
                                        step.status === 'implemented' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-400 dashed border-2"
                                     )}>
                                        {step.name}
                                     </div>
                                  ))}
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </TabsContent>

                {/* INTEGRATIONS CONTENT */}
                <TabsContent value="integrations" className="mt-0">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {integrationHealth?.integrations.map((int, i) => (
                           <Card key={i} className={cn("border-l-4", int.status === 'active' ? "border-l-emerald-500" : int.status === 'error' ? "border-l-red-500" : "border-l-slate-300")}>
                              <CardContent className="p-4">
                                 <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold flex flex-col gap-1">
                                       <span className="flex items-center gap-2">{int.name}</span>
                                    </div>
                                    <Badge variant="outline">{int.status}</Badge>
                                 </div>
                                 {int.issues && int.issues.length > 0 ? (
                                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
                                       {int.issues[0]}
                                    </div>
                                 ) : (
                                    <div className="text-sm text-emerald-600 flex items-center gap-1 mt-2">
                                       <CheckCircle2 className="w-3 h-3" /> Operational
                                    </div>
                                 )}
                              </CardContent>
                           </Card>
                         )
                      )}
                   </div>
                </TabsContent>

                {/* DEPENDENCIES CONTENT */}
                <TabsContent value="dependencies" className="mt-0">
                    <Card>
                       <CardHeader><CardTitle>Package Health</CardTitle></CardHeader>
                       <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                             {dependencyHealth?.dependencies.map((dep, i) => (
                                <div key={i} className="flex justify-between items-center p-2 border rounded text-sm">
                                   <span className="font-mono text-slate-700">{dep.name}</span>
                                   <Badge variant="secondary" className="font-mono text-xs">{dep.version}</Badge>
                                </div>
                             ))}
                             {(!dependencyHealth?.dependencies || dependencyHealth.dependencies.length === 0) && (
                                <div className="col-span-3 text-center text-slate-400 py-8">No dependency data available.</div>
                             )}
                          </div>
                       </CardContent>
                    </Card>
                </TabsContent>
                
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MasterDiagnostics;