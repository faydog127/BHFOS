
import { mockLeads, mockCompanyIntel } from '@/data/mockData';

// Virtual File System map to simulate reading codebase in browser environment
// Populated with known patterns from the current project state
const VIRTUAL_CODEBASE = {
  'src/data/mockData.js': {
    content: `export const mockLeads = [ { id: 'lead-1', name: 'Alice Johnson', ... } ];
export const mockCompanyIntel = { 'lead-1': { ... } };`,
    type: 'data'
  },
  'src/components/crm/call-console/AiCopilot.jsx': {
    content: `const MOCK_TRANSCRIPT = [ { role: 'agent', text: "Hi..." } ];
// Simulate Live Transcription
setInterval(() => { ... }, 3000);`,
    type: 'component'
  },
  'src/pages/crm/SmartCallConsole.jsx': {
    content: `const SCRIPT_OPTIONS = { opener: { ... } };
const SUGGESTIONS = [ { id: 1, type: 'insight' ... } ];
const HISTORY_ITEMS = [ { id: 1, type: 'call' ... } ];
handleLifelineQuery = () => { setTimeout(() => setAiResponse(...), 1500); }`,
    type: 'page'
  },
  'src/components/crm/call-console/PropertyInspectionPanel.jsx': {
    content: `// Mock AI logic
const mockIsTwoStory = Math.random() > 0.5;
setTimeout(() => { ... }, 2500);`,
    type: 'component'
  },
  'src/hooks/useBackendIntegration.js': {
    content: `// Generic table check based on dependency if possible, else simulated success
await new Promise(r => setTimeout(r, 50)); 
opResult = { error: null };`,
    type: 'hook'
  },
  'src/components/diagnostics/LeadGenE2E.jsx': {
    content: `// Wait random time
await new Promise(r => setTimeout(r, 600));`,
    type: 'component'
  },
  'src/components/crm/call-console/AutomatedActionsModal.jsx': {
    content: `merge_data: { 
    first_name: lead.first_name || "Customer",
    address: "Their Location", // Hardcoded
    appt_date: "Tomorrow" // Hardcoded
}`,
    type: 'component'
  },
  'src/lib/customSupabaseClient.js': {
    content: `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Basic client initialization`,
    type: 'lib'
  }
};

const PATTERNS = [
  { 
    id: 'mock_data', 
    regex: /MOCK_|FAKE_|mock|stub|dummy|sample/i, 
    type: 'mock', 
    severity: 'medium', 
    message: 'Mock data detected. Replace with real API data.',
    fix: 'Connect to Supabase/API endpoints.'
  },
  { 
    id: 'hardcoded', 
    regex: /"(Tomorrow|Their Location|123 Palm Ave|321-555-0123)"/, 
    type: 'hardcoded', 
    severity: 'medium', 
    message: 'Hardcoded string detected in logic.',
    fix: 'Use dynamic variables or props.'
  },
  { 
    id: 'console_log', 
    regex: /console\.(log|warn|error|debug)/, 
    type: 'console', 
    severity: 'low', 
    message: 'Console statement left in production code.',
    fix: 'Remove console logs or use a logger utility.'
  },
  { 
    id: 'todo', 
    regex: /TODO|FIXME|WIP|Coming soon|Not implemented/i, 
    type: 'placeholder', 
    severity: 'low', 
    message: 'Unfinished code marker detected.',
    fix: 'Implement the feature or remove the comment.'
  },
  { 
    id: 'simulation', 
    regex: /setTimeout|setInterval|Math\.random\(\)/, 
    type: 'incomplete', 
    severity: 'high', 
    message: 'Logic simulation detected (Timeouts/Random).',
    fix: 'Replace with real async operations/webhooks.'
  },
  {
    id: 'empty_return',
    regex: /return null;|return undefined;/,
    type: 'unimplemented',
    severity: 'medium',
    message: 'Component/Function returns empty value.',
    fix: 'Implement render logic or error boundary.'
  }
];

export const scanCodeQuality = async (onProgress) => {
  const issues = [];
  const files = Object.entries(VIRTUAL_CODEBASE);
  let processed = 0;

  for (const [filePath, fileData] of files) {
    if (onProgress) onProgress(filePath, Math.round((processed / files.length) * 100));
    
    // Simulate processing time
    await new Promise(r => setTimeout(r, 50));

    const lines = fileData.content.split('\n');
    lines.forEach((line, index) => {
      PATTERNS.forEach(pattern => {
        if (pattern.regex.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            snippet: line.trim().substring(0, 100),
            issueType: pattern.type,
            severity: pattern.severity,
            message: pattern.message,
            fix: pattern.fix,
            blocker: pattern.severity === 'critical' || pattern.severity === 'high'
          });
        }
      });
    });
    processed++;
  }

  // Calculate scores
  const totalIssues = issues.length;
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  // Base score 100, penalize
  let score = 100;
  score -= (criticalCount * 5);
  score -= (highCount * 3);
  score -= (mediumCount * 1);
  score -= (lowCount * 0.5);
  score = Math.max(0, Math.floor(score));

  return {
    score,
    totalIssues,
    breakdown: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount
    },
    issues
  };
};
