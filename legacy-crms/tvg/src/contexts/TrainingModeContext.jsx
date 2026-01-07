import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const TrainingModeContext = createContext();

export const useTrainingMode = () => {
  const context = useContext(TrainingModeContext);
  if (!context) {
    throw new Error('useTrainingMode must be used within a TrainingModeProvider');
  }
  return context;
};

export const TrainingModeProvider = ({ children }) => {
  const { user } = useSupabaseAuth();
  
  // Default to false (Live Mode) to be safe if no user or metadata found
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync state with Supabase User Metadata on load/auth change
  useEffect(() => {
    if (user) {
      // Check user metadata for persisted preference
      const savedMode = user.user_metadata?.system_mode === 'training';
      setIsTrainingMode(savedMode);
    }
    setLoading(false);
  }, [user]);

  const toggleTrainingMode = async (value) => {
    // Determine new value (toggle if undefined)
    const newMode = value !== undefined ? value : !isTrainingMode;
    
    // Optimistic UI update
    setIsTrainingMode(newMode);
    
    // Dispatch event for non-React listeners if needed
    window.dispatchEvent(new Event('system-mode-change'));

    // Persist to Supabase Metadata if authenticated
    if (user) {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { system_mode: newMode ? 'training' : 'live' }
        });
        
        if (error) {
          console.error('Failed to persist training mode preference:', error);
          // Optional: revert state if strict consistency is required, 
          // but for UI mode switching, optimistic is usually better UX
        }
      } catch (err) {
        console.error('Error updating user metadata:', err);
      }
    }
  };

  const value = {
    isTrainingMode,
    toggleTrainingMode,
    loading,
    modeLabel: isTrainingMode ? 'Training' : 'Live'
  };

  return (
    <TrainingModeContext.Provider value={value}>
      {children}
    </TrainingModeContext.Provider>
  );
};