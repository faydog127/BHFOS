import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const useSystemMode = (user) => {
  const [mode, setMode] = useState('training'); // Default to training for safety
  const [loading, setLoading] = useState(true);

  const fetchMode = useCallback(async () => {
    if (!user) {
      setMode('training');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('kanban_config')
        .select('system_mode')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching system mode:', error);
      }

      if (data?.system_mode) {
        setMode(data.system_mode);
      } else {
        // If no config exists, default to training
        setMode('training');
      }
    } catch (err) {
      console.error('System mode fetch error:', err);
      setMode('training');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMode();
  }, [fetchMode]);

  const updateMode = async (newMode) => {
    if (!user) return;
    
    // Optimistic update
    setMode(newMode);

    try {
      const { error } = await supabase
        .from('kanban_config')
        .upsert({ 
          user_id: user.id, 
          system_mode: newMode,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error updating system mode:', err);
      // Revert on error (optional, but good practice)
      fetchMode(); 
    }
  };

  return {
    mode,
    setMode: updateMode,
    loading,
    refreshMode: fetchMode
  };
};