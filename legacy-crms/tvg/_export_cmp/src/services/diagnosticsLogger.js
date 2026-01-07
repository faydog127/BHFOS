import { supabase } from '@/lib/customSupabaseClient';

export const diagnosticsLogger = {
  /**
   * Starts a new diagnostic session log
   */
  startSession: async (userId = 'system') => {
    try {
      const { data, error } = await supabase
        .from('session_log')
        .insert({
          session_start: new Date().toISOString(),
          user_id: userId,
          health_score_start: 0 // Will be updated later
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to start diagnostics session:', err);
      return null;
    }
  },

  /**
   * Updates an existing session with results
   */
  updateSession: async (sessionId, updates) => {
    try {
      const { data, error } = await supabase
        .from('session_log')
        .update({
          ...updates,
          session_end: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to update diagnostics session:', err);
      return null;
    }
  },

  /**
   * Bulk logs issues found during scan
   */
  logIssues: async (sessionId, issues) => {
    if (!issues || issues.length === 0) return;

    try {
      const formattedIssues = issues.map(issue => ({
        session_id: sessionId,
        issue_id: issue.id || crypto.randomUUID(),
        issue_type: issue.type || 'unknown',
        severity: issue.severity || 'low',
        file_path: issue.file || issue.name || 'unknown',
        line_number: issue.line || 0,
        code_snippet: issue.snippet || '',
        issue_description: issue.message || 'No description',
        impact: issue.impact || 'Unknown impact',
        status: 'found'
      }));

      const { error } = await supabase
        .from('diagnostics_log')
        .insert(formattedIssues);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to log issues:', err);
    }
  },

  /**
   * Logs a fix application
   */
  logFix: async (sessionId, fixData) => {
    try {
      const { data, error } = await supabase
        .from('fixes_log')
        .insert({
          session_id: sessionId,
          applied_at: new Date().toISOString(),
          verified: true,
          ...fixData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to log fix:', err);
      return null;
    }
  },

  /**
   * Fetch recent sessions
   */
  getRecentSessions: async (limit = 5) => {
    const { data } = await supabase
      .from('session_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  },

  /**
   * Fetch session details
   */
  getSessionDetails: async (sessionId) => {
    const { data: session } = await supabase
      .from('session_log')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) return null;

    const { data: issues } = await supabase
      .from('diagnostics_log')
      .select('*')
      .eq('session_id', sessionId);

    const { data: fixes } = await supabase
      .from('fixes_log')
      .select('*')
      .eq('session_id', sessionId);

    return { session, issues: issues || [], fixes: fixes || [] };
  }
};