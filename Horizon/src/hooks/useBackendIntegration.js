
import { useCallback } from 'react';
import { formatProbeResult } from '@/lib/diagnosticsUtils';
import { scanWorkflows } from '@/services/workflowScanner';
import { scanIntegrations } from '@/services/integrationScanner';

export const useBackendIntegration = () => {
  const runBackendTests = useCallback(async (onLog) => {
    try {
      if (onLog) onLog("Starting Deep Backend Analysis...");

      // 1. Workflow Scan
      if (onLog) onLog("Tracing Business Workflows...");
      const workflowResult = await scanWorkflows((wf, pct) => {});
      if (onLog) onLog(`Workflow Reliability Score: ${workflowResult.score}/100`);

      // 2. Integration Scan
      if (onLog) onLog("Verifying Third-Party Integrations...");
      const integrationResult = await scanIntegrations((int, pct) => {});
      if (onLog) onLog(`Integration Health Score: ${integrationResult.score}/100`);

      // Format for legacy consumers
      const formattedResults = workflowResult.workflows.map(w => 
        formatProbeResult(w.name, w.functionality > 80 ? 'ok' : 'warning', 100, `${w.functionality}% Complete`)
      );

      // Attach deep data
      formattedResults.deepData = {
        workflows: workflowResult,
        integrations: integrationResult
      };

      return formattedResults;

    } catch (err) {
      if (onLog) onLog(`Backend Test Failed: ${err.message}`);
      return [formatProbeResult('Backend Scanner', 'error', 0, err.message)];
    }
  }, []);

  return { runBackendTests };
};
