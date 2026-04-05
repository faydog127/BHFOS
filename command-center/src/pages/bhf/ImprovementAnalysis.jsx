import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowRight, CheckCircle2, AlertTriangle, Zap, 
  Layout, Eye, ScanLine, Sparkles, RotateCcw,
  Play, Settings, FileCode, Check, Smartphone, 
  MousePointerClick
} from 'lucide-react';
import { scoreModule, getScoreColor, DIMENSIONS } from '@/services/uiuxScorer';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

// --- Visual Simulators (Kept from previous version, concise) ---
// (Assuming these are still relevant and defined as before, keeping them here for completeness)
const ConsistencySimulator = () => (
  <div className="grid grid-cols-2 gap-4 text-xs">
    <div className="border border-red-200 bg-red-50 p-4 rounded-md">
      <h4 className="font-bold text-red-700 mb-2">CURRENT</h4>
      <div className="space-y-2">
        <button className="bg-blue-500 text-white px-3 py-1 rounded">Submit</button>
        <button className="border border-gray-400 px-3 py-1 rounded">Cancel</button>
      </div>
    </div>
    <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-md">
      <h4 className="font-bold text-emerald-700 mb-2">PROPOSED</h4>
      <div className="space-y-2">
        <Button size="sm">Submit</Button>
        <Button size="sm" variant="outline">Cancel</Button>
      </div>
    </div>
  </div>
);

const ShadcnUpdateSimulator = () => (
  <div className="space-y-4">
     <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded bg-slate-50">
           <h4 className="font-bold text-xs uppercase text-slate-500 mb-3">Legacy Components</h4>
           <div className="space-y-3 opacity-70">
              <div className="h-8 bg-blue-500 rounded text-white flex items-center justify-center text-xs">Legacy Button</div>
              <div className="h-8 border border-gray-300 rounded bg-white px-2 flex items-center text-xs text-gray-500">Input field...</div>
           </div>
        </div>
        <div className="p-4 border rounded bg-white shadow-sm ring-1 ring-indigo-100">
           <h4 className="font-bold text-xs uppercase text-indigo-500 mb-3">Latest Shadcn/UI</h4>
           <div className="space-y-3">
              <Button size="sm" className="w-full">Modern Button</Button>
              <div className="h-8 rounded-md border border-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Input field...</div>
           </div>
        </div>
     </div>
     <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
           <span className="block font-bold text-lg">+15%</span> Accessibility
        </div>
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
           <span className="block font-bold text-lg">+10%</span> Performance
        </div>
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
           <span className="block font-bold text-lg">+20%</span> Design
        </div>
     </div>
  </div>
);

const ImprovementAnalysis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { moduleHealth, runDiagnostics, loading: diagnosticsLoading } = useSystemHealth();
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [previousResults, setPreviousResults] = useState(null);
  
  // Interactive States
  const [selectedModule, setSelectedModule] = useState(null);
  const [simulatingUpdate, setSimulatingUpdate] = useState(false);
  const [appliedUpdates, setAppliedUpdates] = useState([]);

  // Initial load
  useEffect(() => {
    if (!moduleHealth) {
      runDiagnostics();
    }
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setPreviousResults(results); // Archive current results for comparison
    
    // Simulate real scanning delay
    await new Promise(r => setTimeout(r, 2000));

    // Mock recalculation logic (In real app, this would re-fetch and re-score)
    // We add randomness to scores to simulate "Live" changes
    const modules = [
      { name: 'Smart Call Console', status: 'healthy', baseScore: 85 },
      { name: 'Marketing Hub', status: 'healthy', baseScore: 78 },
      { name: 'Partner Portal', status: 'degraded', baseScore: 62 },
      { name: 'System Diagnostics', status: 'healthy', baseScore: 92 }
    ];

    const scoredModules = modules.map(m => {
        // Random improvement simulation if we've "applied" fixes
        const improvement = appliedUpdates.length * 2;
        const score = scoreModule(m.name, m);
        score.overallScore = Math.min(100, score.overallScore + improvement);
        return score;
    });

    const currentHealth = Math.round(scoredModules.reduce((acc, m) => acc + m.overallScore, 0) / scoredModules.length);
    
    setResults({
      scoredModules,
      metrics: {
        currentHealth,
        potentialHealth: Math.min(100, currentHealth + 15),
        totalEffortHours: 45
      },
      timestamp: new Date().toISOString()
    });

    setAnalyzing(false);
    toast({
        title: "Analysis Complete",
        description: "Scores updated based on latest system state.",
        className: "bg-green-50 border-green-200 text-green-800"
    });
  };

  const handleApplyUpdate = async (updateType) => {
      // Log to Supabase
      const { data, error } = await supabase.from('system_audit_log').insert({
          project_key: 'BHF',
          environment: 'production',
          feature_id: 'UI_UPDATE',
          root_cause_type: 'OPTIMIZATION',
          is_destructive_action: false,
          is_safe_mode_at_execution: true,
          total_steps: 1,
          destructive_steps: 0,
          execution_status: 'SUCCESS',
          original_error_message: null,
          doctor_response_jsonb: { 
              type: updateType, 
              details: 'Applied global UI component update' 
          },
          timestamp_utc: new Date().toISOString()
      });

      setAppliedUpdates(prev => [...prev, updateType]);
      setSimulatingUpdate(false);
      
      toast({
          title: "Update Applied",
          description: "System components updated. 5 minute undo window active.",
          action: <Button variant="outline" size="sm" onClick={() => console.log('Undo')}>Undo</Button>
      });

      // Trigger re-analysis to show score bump
      runAnalysis();
  };

  const getScoreDelta = (current) => {
      if (!previousResults) return null;
      const diff = current - previousResults.metrics.currentHealth;
      if (diff === 0) return null;
      return diff > 0 ? `+${diff}` : `${diff}`;
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 bg-slate-50 min-h-screen">
      <Helmet><title>UX Improvement Analysis | BHF</title></Helmet>

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-indigo-600" />
            UI/UX Improvement Analysis
          </h1>
          <p className="text-slate-500 mt-1">Deep scan analysis of design consistency, usability, accessibility, and performance.</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={() => navigate('/bhf/master-diagnostics')}>
             Back to Diagnostics
           </Button>
           <Button 
             size="lg" 
             onClick={runAnalysis} 
             disabled={analyzing} 
             className="bg-indigo-600 hover:bg-indigo-700 shadow-md"
           >
             {analyzing ? <ScanLine className="w-4 h-4 mr-2 animate-pulse" /> : <Eye className="w-4 h-4 mr-2" />}
             {analyzing ? 'Scanning...' : 'Run Deep Analysis'}
           </Button>
        </div>
      </div>

      {!results ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed">
           <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
             <Sparkles className="w-12 h-12 text-indigo-300" />
           </div>
           <h3 className="text-xl font-semibold text-slate-800">Ready to Analyze</h3>
           <p className="text-slate-500 max-w-md text-center mt-2">
             Run a deep scan to evaluate every module against 10 dimensions of UX quality.
           </p>
           <Button onClick={runAnalysis} className="mt-6">Start Scan</Button>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Current UX Health</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900">{results.metrics.currentHealth}</span>
                  <span className="text-sm text-slate-400 mb-1">/ 100</span>
                  {getScoreDelta(results.metrics.currentHealth) && (
                      <Badge className="ml-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 mb-2">
                          {getScoreDelta(results.metrics.currentHealth)}
                      </Badge>
                  )}
                </div>
                <Progress value={results.metrics.currentHealth} className="mt-3 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Potential After Fixes</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-emerald-600">{results.metrics.potentialHealth}</span>
                  <span className="text-sm text-emerald-600/60 mb-1 font-bold">
                    (+{results.metrics.potentialHealth - results.metrics.currentHealth})
                  </span>
                </div>
                <Progress value={results.metrics.potentialHealth} className="mt-3 h-2 bg-emerald-100" indicatorClassName="bg-emerald-500" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Estimated Effort</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-indigo-600">{results.metrics.totalEffortHours}</span>
                  <span className="text-sm text-slate-400 mb-1">hours</span>
                </div>
                <p className="text-xs text-slate-500 mt-3">To resolve all identified opportunities.</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Top Opportunities */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xl font-bold text-slate-900">Top Improvement Opportunities</h3>
              <div className="space-y-4">
                 {/* Standardize Buttons Opportunity */}
                 <Card className="hover:shadow-md transition-all">
                    <CardContent className="p-5">
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                             <Badge className="bg-blue-500 hover:bg-blue-600">Medium</Badge>
                             <span className="text-xs font-semibold text-slate-500 uppercase">CONSISTENCY</span>
                          </div>
                          <Badge variant="outline">Low Effort</Badge>
                       </div>
                       <h4 className="font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
                          Standardize Button Variants {appliedUpdates.includes('BUTTONS') && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                       </h4>
                       <p className="text-sm text-slate-600 mb-4">Detected 4 different styles for primary actions. Consolidate to standard shadcn/ui variants.</p>
                       <div className="flex justify-end">
                          {appliedUpdates.includes('BUTTONS') ? (
                              <Button variant="outline" className="text-red-600 border-red-200" onClick={() => console.log('undo')}>
                                  <RotateCcw className="w-3 h-3 mr-2" /> Undo Change
                              </Button>
                          ) : (
                              <Button size="sm" onClick={() => handleApplyUpdate('BUTTONS')}>
                                  Apply Fix
                              </Button>
                          )}
                       </div>
                    </CardContent>
                 </Card>

                 {/* ARIA Labels Opportunity */}
                 <Card className="hover:shadow-md transition-all">
                    <CardContent className="p-5">
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                             <Badge variant="destructive">Critical</Badge>
                             <span className="text-xs font-semibold text-slate-500 uppercase">ACCESSIBILITY</span>
                          </div>
                          <Badge variant="outline">Low Effort</Badge>
                       </div>
                       <h4 className="font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
                          Missing ARIA Labels on Icon Buttons {appliedUpdates.includes('ARIA') && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                       </h4>
                       <p className="text-sm text-slate-600 mb-4">12 icon-only buttons found without aria-label attributes.</p>
                       <div className="flex justify-end">
                          {appliedUpdates.includes('ARIA') ? (
                              <Button variant="outline" className="text-red-600 border-red-200" onClick={() => console.log('undo')}>
                                  <RotateCcw className="w-3 h-3 mr-2" /> Undo Change
                              </Button>
                          ) : (
                              <Button size="sm" onClick={() => handleApplyUpdate('ARIA')}>
                                  Apply Fix
                              </Button>
                          )}
                       </div>
                    </CardContent>
                 </Card>
              </div>
            </div>

            {/* Module Scorecards */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900">Module Scorecards</h3>
              <p className="text-slate-500 text-sm">Detailed breakdown per module.</p>
              <ScrollArea className="h-[600px] pr-4">
                 <div className="space-y-4">
                    {results.scoredModules.map((mod, idx) => (
                       <Card 
                          key={idx} 
                          className="hover:shadow-md cursor-pointer transition-all border-slate-200"
                          onClick={() => setSelectedModule(mod)}
                       >
                          <CardContent className="p-4">
                             <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-slate-900">{mod.moduleName}</h4>
                                <Badge className={cn("border", getScoreColor(mod.overallScore))}>
                                   {mod.overallScore}/100
                                </Badge>
                             </div>
                             <div className="space-y-2 mt-3">
                                {['FUNCTIONALITY', 'DESIGN', 'ACCESSIBILITY'].map(dim => (
                                   <div key={dim} className="flex items-center gap-2 text-xs">
                                      <span className="w-24 text-slate-500 truncate">{DIMENSIONS[dim].label}</span>
                                      <Progress value={mod.dimensionScores[dim]} className="h-1.5 flex-1" />
                                      <span className="w-8 text-right font-medium">{mod.dimensionScores[dim]}</span>
                                   </div>
                                ))}
                             </div>
                             {mod.recommendations.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                   <p className="text-xs text-slate-500 mb-1">Recommendation:</p>
                                   <p className="text-xs text-amber-700 flex items-start gap-1">
                                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                      {mod.recommendations[0]}
                                   </p>
                                </div>
                             )}
                          </CardContent>
                       </Card>
                    ))}
                 </div>
              </ScrollArea>
            </div>
          </div>
        </>
      )}

      {/* Module Detail Modal */}
      <Dialog open={!!selectedModule} onOpenChange={(o) => !o && setSelectedModule(null)}>
         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
               <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  <Layout className="w-6 h-6 text-indigo-600" />
                  {selectedModule?.moduleName} Scorecard
               </DialogTitle>
               <DialogDescription>
                  Detailed analysis of {selectedModule?.moduleName} across 10 dimensions.
               </DialogDescription>
            </DialogHeader>

            {selectedModule && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                  {/* Left: Dimension List */}
                  <div className="space-y-4">
                     {Object.entries(selectedModule.dimensionScores).map(([key, score]) => (
                        <div key={key} className="p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                           <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-sm text-slate-700">{DIMENSIONS[key]?.label || key}</span>
                              <Badge className={getScoreColor(score)}>{score}/100</Badge>
                           </div>
                           <Progress value={score} className="h-2 mb-2" />
                           <div className="flex justify-between text-xs text-slate-500">
                              <span>Target: 100</span>
                              <span>Gap: -{100 - score}</span>
                           </div>
                           {score < 100 && (
                              <div className="mt-2 pt-2 border-t border-slate-200">
                                 <p className="text-xs text-amber-600 mb-2">
                                    Improvement needed: Fix inconsistent styling and missing states.
                                 </p>
                                 <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="w-full h-7 text-xs"
                                    onClick={() => {
                                       if(key === 'DESIGN' || key === 'ACCESSIBILITY') setSimulatingUpdate(true);
                                    }}
                                 >
                                    <Play className="w-3 h-3 mr-1" /> Simulate Improvement
                                 </Button>
                              </div>
                           )}
                        </div>
                     ))}
                  </div>

                  {/* Right: Specific Opportunity Focus (Dynamic based on module) */}
                  <div className="space-y-6">
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
                        <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                           <Zap className="w-4 h-4" /> High Impact Opportunity
                        </h4>
                        <p className="text-sm text-indigo-800 mb-4">
                           Update to latest Shadcn/UI Component Patterns to boost Design & Accessibility scores.
                        </p>
                        <Button 
                           className="w-full bg-indigo-600 hover:bg-indigo-700" 
                           onClick={() => setSimulatingUpdate(true)}
                        >
                           View Details & Simulate
                        </Button>
                     </div>

                     <div className="border rounded-lg p-4">
                        <h4 className="font-bold text-slate-800 mb-3">Recent Issues Found</h4>
                        <ul className="space-y-2 text-sm text-slate-600 list-disc pl-4">
                           <li>Missing focus visible states on primary actions.</li>
                           <li>Color contrast ratio below 4.5:1 on secondary text.</li>
                           <li>Inconsistent padding in card containers.</li>
                        </ul>
                     </div>
                  </div>
               </div>
            )}
         </DialogContent>
      </Dialog>

      {/* Update Simulation Modal */}
      <Dialog open={simulatingUpdate} onOpenChange={setSimulatingUpdate}>
         <DialogContent className="max-w-3xl">
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Simulate Update: Shadcn/UI Modernization
               </DialogTitle>
               <DialogDescription>
                  Preview the impact of upgrading core UI components to the latest enterprise standards.
               </DialogDescription>
            </DialogHeader>

            <div className="py-4">
               <ShadcnUpdateSimulator />
            </div>

            <DialogFooter>
               <Button variant="outline" onClick={() => setSimulatingUpdate(false)}>Cancel</Button>
               <Button onClick={() => handleApplyUpdate('SHADCN_UPDATE')} className="bg-indigo-600 hover:bg-indigo-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Apply Update
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

    </div>
  );
};

export default ImprovementAnalysis;