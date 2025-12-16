
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const TrainingModeContext = createContext();

export const useTrainingMode = () => {
  return useContext(TrainingModeContext);
};

export const TrainingModeProvider = ({ children }) => {
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync with DB or Local Storage on mount
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Ideally fetch from a user_settings table, falling back to local state for now
          // For MVP/Demo, we default to false or whatever was last set if we had persistence
        }
      } catch (error) {
        console.error('Error checking training mode:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMode();
  }, []);

  const toggleTrainingMode = (value) => {
    // If value is provided, use it, otherwise toggle
    setIsTrainingMode(prev => value !== undefined ? value : !prev);
  };

  const value = {
    isTrainingMode,
    toggleTrainingMode,
    loading
  };

  return (
    <TrainingModeContext.Provider value={value}>
      {children}
    </TrainingModeContext.Provider>
  );
};
