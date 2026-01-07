import { useCallback } from 'react';
import { formatProbeResult } from '@/lib/diagnosticsUtils';
import { scanCodeQuality } from '@/services/codeQualityScanner';
import { scanModules } from '@/services/moduleScanner';

export const useFrontendIntegration = () => {
  const runFrontendTests = useCallback(async (onLog) => {
    try {
      if (onLog) onLog("Starting Deep Frontend Analysis...");
      
      // 1. Code Quality Scan
      if (onLog) onLog("Running Static Code Analysis...");
      const qualityResult = await scanCodeQuality((file, pct) => {
         // Optional: verbose logging
      });
      if (onLog) onLog(`Code Quality Score: ${qualityResult.score}/100 (${qualityResult.totalIssues} issues)`);

      // 2. Module Scan
      if (onLog) onLog("Scanning Modules & UI Components...");
      const moduleResult = await scanModules((mod, pct) => {
         // Optional: verbose logging
      });
      if (onLog) onLog(`Module Functionality Score: ${moduleResult.score}/100`);

      // 3. Transform to legacy format for compatibility if needed, or return rich object
      // We will return a rich object that the new MasterDiagnostics can consume
      // But we must also return an array for the old loop if other components use it.
      
      // We'll wrap the detailed data in a special result object
      const formattedResults = moduleResult.modules.map(m => formatProbeResult(m.name, m.status === 'healthy' ? 'ok' : 'warning', 50, `${m.functionality}% Functional`));
      
      // Attach the deep data to the array (hacky but effective for maintaining hook signature)
      formattedResults.deepData = {
        codeQuality: qualityResult,
        modules: moduleResult
      };

      return formattedResults;

    } catch (err) {
      if (onLog) onLog(`Frontend Test Failed: ${err.message}`);
      return [formatProbeResult('Frontend Scanner', 'error', 0, err.message)];
    }
  }, []);

  return { runFrontendTests };
};