/**
 * UI/UX Scoring Service
 * Evaluates modules on 10 dimensions:
 * A. Functionality (20%)
 * B. Design & Aesthetics (15%)
 * C. Usability (15%)
 * D. Responsiveness (10%)
 * E. Accessibility (10%)
 * F. Performance (10%)
 * G. Consistency (10%)
 * H. Feedback & States (5%)
 * I. Content Clarity (5%)
 * J. Visual Feedback (5%)
 */

export const DIMENSIONS = {
  FUNCTIONALITY: { weight: 0.20, label: 'Functionality' },
  DESIGN: { weight: 0.15, label: 'Design & Aesthetics' },
  USABILITY: { weight: 0.15, label: 'Usability' },
  RESPONSIVENESS: { weight: 0.10, label: 'Responsiveness' },
  ACCESSIBILITY: { weight: 0.10, label: 'Accessibility' },
  PERFORMANCE: { weight: 0.10, label: 'Performance' },
  CONSISTENCY: { weight: 0.10, label: 'Consistency' },
  FEEDBACK_STATES: { weight: 0.05, label: 'Feedback & States' },
  CONTENT_CLARITY: { weight: 0.05, label: 'Content Clarity' },
  VISUAL_FEEDBACK: { weight: 0.05, label: 'Visual Feedback' }
};

/**
 * Mocks a deep scan of a module's UI/UX quality.
 * In a real implementation, this would use automated testing tools (Lighthouse, Axe, etc.)
 * and potentially visual regression testing results.
 * 
 * For now, we simulate intelligent analysis based on module metadata and "heuristic" checks.
 */
export const scoreModule = (moduleName, moduleMetadata = {}) => {
  const scores = {};
  const issues = [];
  const recommendations = [];

  // 1. Functionality (Base score on status)
  scores.FUNCTIONALITY = moduleMetadata.status === 'healthy' ? 95 : 
                        moduleMetadata.status === 'degraded' ? 60 : 40;
  if (scores.FUNCTIONALITY < 80) issues.push('Core features may be unstable.');

  // 2. Design & Aesthetics (Mock heuristic)
  // Assume newer modules have better design
  const isNew = ['SmartCallConsole', 'MarketingHub', 'AdvancedDiagnostics'].includes(moduleName);
  scores.DESIGN = isNew ? 90 : 75; 
  if (!isNew) recommendations.push('Update to latest Shadcn/UI component patterns.');

  // 3. Usability
  // Complex modules might have lower usability initially
  const isComplex = ['AdvancedDiagnostics', 'MasterDiagnostics'].includes(moduleName);
  scores.USABILITY = isComplex ? 70 : 85;
  if (isComplex) recommendations.push('Consider simplifying navigation depth.');

  // 4. Responsiveness
  // Assume most are good, but tables might struggle
  const hasTables = ['Leads', 'Jobs', 'Invoices'].includes(moduleName);
  scores.RESPONSIVENESS = hasTables ? 75 : 95;
  if (hasTables) issues.push('Horizontal scroll required on mobile views.');

  // 5. Accessibility
  // Often overlooked
  scores.ACCESSIBILITY = 65; // Default conservative score
  recommendations.push('Audit ARIA labels and focus management.');

  // 6. Performance
  // Large modules load slower
  const isHeavy = ['SmartCallConsoleUltimate', 'MasterDiagnostics'].includes(moduleName);
  scores.PERFORMANCE = isHeavy ? 70 : 95;
  if (isHeavy) recommendations.push('Implement code-splitting for sub-components.');

  // 7. Consistency
  scores.CONSISTENCY = 85; 

  // 8. Feedback & States
  scores.FEEDBACK_STATES = 80;

  // 9. Content Clarity
  scores.CONTENT_CLARITY = 90;

  // 10. Visual Feedback
  scores.VISUAL_FEEDBACK = 85;

  // Calculate Weighted Average
  let totalWeightedScore = 0;
  Object.keys(DIMENSIONS).forEach(key => {
    totalWeightedScore += scores[key] * DIMENSIONS[key].weight;
  });

  return {
    moduleName,
    overallScore: Math.round(totalWeightedScore),
    dimensionScores: scores,
    issues,
    recommendations,
    timestamp: new Date().toISOString()
  };
};

export const getScoreColor = (score) => {
  if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
};

export const getScoreLabel = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Needs Improvement';
  return 'Critical Issues';
};