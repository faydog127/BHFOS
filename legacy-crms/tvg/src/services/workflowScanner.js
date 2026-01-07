const WORKFLOWS = [
  { id: 'lead_to_cash', name: 'Lead to Cash', steps: ['Capture', 'Qualify', 'Estimate', 'Job', 'Invoice', 'Payment'] },
  { id: 'partner_onboarding', name: 'Partner Onboarding', steps: ['Register', 'Approve', 'Portal Access', 'First Referral'] },
  { id: 'service_visit', name: 'Service Visit', steps: ['Dispatch', 'Arrive', 'Inspect', 'Work', 'Complete'] }
];

export const scanWorkflows = async (onProgress) => {
  const results = [];

  for (let i = 0; i < WORKFLOWS.length; i++) {
    const wf = WORKFLOWS[i];
    if (onProgress) onProgress(wf.name, Math.round((i / WORKFLOWS.length) * 100));

    // Simulate Step verification
    const stepDetails = wf.steps.map(step => {
      // Heuristic: "Payment" is usually mocked or hard
      const isHard = step === 'Payment' || step === 'Dispatch';
      return {
        name: step,
        status: isHard ? 'mocked' : 'implemented',
        type: isHard ? 'simulation' : 'real'
      };
    });

    const realSteps = stepDetails.filter(s => s.status === 'implemented').length;
    const functionality = Math.round((realSteps / wf.steps.length) * 100);
    
    results.push({
      ...wf,
      stepDetails,
      functionality,
      completion: functionality + 10, // UI is usually ahead of logic
      blockers: functionality < 100 ? [`${wf.steps.length - realSteps} steps are mocked/simulated`] : [],
      estHours: (wf.steps.length - realSteps) * 3
    });

    await new Promise(r => setTimeout(r, 150));
  }

  const avgFunc = results.reduce((acc, curr) => acc + curr.functionality, 0) / results.length;

  return {
    score: Math.round(avgFunc),
    workflows: results
  };
};