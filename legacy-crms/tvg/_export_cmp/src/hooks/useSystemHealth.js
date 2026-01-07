import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSystemDoctorResults } from '@/components/SystemDoctorConsole';
import { getBuildHealthResults } from '@/pages/BuildHealth';
import { getSupabaseProbeResults } from '@/pages/SupabaseProbe';
import { useFrontendIntegration } from '@/hooks/useFrontendIntegration';
import { useBackendIntegration } from '@/hooks/useBackendIntegration';
import { scanDependencies } from '@/services/dependencyScanner';
import { STATUS_ENUM } from '@/lib/diagnosticsUtils';
import { diagnosticsLogger } from '@/services/diagnosticsLogger';

export const useSystemHealth = () => {
  const { runFrontendTests } = useFrontendIntegration();
  const { runBackendTests } = useBackendIntegration();

  const [state, setState] = useState({
    // Legacy Data Structures
    systemDoctor: [],
    buildHealth: [],
    supabaseProbe: [],
    frontendIntegration: [],
    backendIntegration: [],
    
    // New Deep Data Structures
    codeQuality: null,
    moduleHealth: null,
    workflowHealth: null,
    integrationHealth: null,
    dependencyHealth: null,
    
    aggregatedScore: 100,
    categoryScores: {
      system: 100,
      build: 100,
      supabase: 100,
      frontend: 100,
      backend: 100,
      code: 100,
      security: 100
    },
    allFailures: [],
    loading: false,
    error: null,
    logs: []
  });

  const addLog = useCallback((msg) => {
    setState(prev => ({
      ...prev,
      logs: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.logs].slice(0, 200)
    }));
  }, []);

  const calculateHonestScore = (results) => {
     let score = 100;
     const { codeQuality, moduleHealth, workflowHealth, integrationHealth, dependencyHealth } = results;

     if (codeQuality) score -= (100 - codeQuality.score) * 0.15;
     if (moduleHealth) score -= (100 - moduleHealth.score) * 0.20;
     if (workflowHealth) score -= (100 - workflowHealth.score) * 0.20;
     if (integrationHealth) score -= (100 - integrationHealth.score) * 0.15;
     if (dependencyHealth) score -= (100 - dependencyHealth.score) * 0.10;
     
     return Math.max(0, Math.floor(score));
  };

  const runDiagnostics = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null, logs: [], allFailures: [] }));
    addLog('Starting DEEP GRANULAR Diagnostics...');
    
    // START LOGGING SESSION
    let session = await diagnosticsLogger.startSession();
    if (session) addLog(`Session logged: ${session.id}`);

    try {
      addLog('Initializing Scanners...');

      const depResult = await scanDependencies();
      addLog(`Dependency Scan: ${depResult.score}/100`);

      const [docRes, buildRes, probeRes, feRes, beRes] = await Promise.allSettled([
        getSystemDoctorResults().then(res => { addLog(`System Doctor: Checked ${res.length} items`); return res; }),
        getBuildHealthResults().then(res => { addLog(`Build Health: Checked ${res.length} items`); return res; }),
        getSupabaseProbeResults().then(res => { addLog(`Supabase Probe: Checked ${res.length} items`); return res; }),
        runFrontendTests(addLog),
        runBackendTests(addLog)
      ]);

      const systemDoctor = docRes.status === 'fulfilled' ? docRes.value : [];
      const buildHealth = buildRes.status === 'fulfilled' ? buildRes.value : [];
      const supabaseProbe = probeRes.status === 'fulfilled' ? probeRes.value : [];
      
      const frontendIntegration = feRes.status === 'fulfilled' ? feRes.value : [];
      const backendIntegration = beRes.status === 'fulfilled' ? beRes.value : [];
      
      const codeQuality = frontendIntegration.deepData?.codeQuality || { score: 0, issues: [] };
      const moduleHealth = frontendIntegration.deepData?.modules || { score: 0, modules: [] };
      const workflowHealth = backendIntegration.deepData?.workflows || { score: 0, workflows: [] };
      const integrationHealth = backendIntegration.deepData?.integrations || { score: 0, integrations: [] };

      // Collect Failures
      const allFailures = [
         ...codeQuality.issues.map(i => ({ ...i, type: 'code', name: 'Quality Issue', message: `${i.issueType}: ${i.snippet}`, severity: i.severity })),
         ...moduleHealth.modules.flatMap(m => m.blockers.map(b => ({ type: 'module', name: m.name, message: b, severity: 'high' }))),
         ...workflowHealth.workflows.flatMap(w => w.blockers.map(b => ({ type: 'workflow', name: w.name, message: b, severity: 'high' }))),
         ...integrationHealth.integrations.flatMap(i => i.issues.map(err => ({ type: 'integration', name: i.name, message: err, severity: 'critical' }))),
         ...systemDoctor.filter(r => r.status !== STATUS_ENUM.OK).map(f => ({ ...f, type: 'system', severity: 'critical' }))
      ];

      // LOG ISSUES TO DATABASE
      if (session) {
        addLog(`Logging ${allFailures.length} issues to database...`);
        await diagnosticsLogger.logIssues(session.id, allFailures);
      }

      const totalScore = calculateHonestScore({
         codeQuality,
         moduleHealth,
         workflowHealth,
         integrationHealth,
         dependencyHealth: depResult
      });

      // UPDATE SESSION SUMMARY
      if (session) {
        await diagnosticsLogger.updateSession(session.id, {
          health_score_end: totalScore,
          total_issues_found: allFailures.length,
          summary: `Automatic diagnostics run completed with score ${totalScore}/100. Found ${allFailures.length} issues.`
        });
      }

      addLog(`Diagnostics Complete. HONEST Health Score: ${totalScore}/100`);

      setState(prev => ({
        ...prev,
        systemDoctor,
        buildHealth,
        supabaseProbe,
        frontendIntegration,
        backendIntegration,
        codeQuality,
        moduleHealth,
        workflowHealth,
        integrationHealth,
        dependencyHealth: depResult,
        aggregatedScore: totalScore,
        categoryScores: {
           code: codeQuality.score,
           frontend: moduleHealth.score,
           backend: workflowHealth.score,
           system: integrationHealth.score,
           build: depResult.score,
           supabase: 100
        },
        allFailures,
        loading: false
      }));

    } catch (err) {
      addLog(`CRITICAL FAILURE: ${err.message}`);
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [addLog, runFrontendTests, runBackendTests]);

  return {
    ...state,
    runDiagnostics,
    addLog
  };
};