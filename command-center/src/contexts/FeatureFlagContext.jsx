import React, { createContext, useContext, useState } from 'react';

const FeatureFlagContext = createContext();

export const FeatureFlagProvider = ({ children }) => {
  // Default flags configuration
  const [flags, setFlags] = useState({
    enableLeads: true,
    enablePipeline: true,
    enableJobs: true,
    enableSchedule: true,
    enableEstimates: true,
    enableInvoicing: true,
    enablePayments: true,
    enableMarketing: true,
    enableReporting: true,
    enableSettings: true,
    enableCallConsole: true,
    enableSMS: true,
    enableContacts: true,
    enableInspections: true,
    enablePricebook: true,
    enablePartners: true,
    enableTechPwa: String(import.meta?.env?.VITE_TECH_PWA_ENABLED || 'true').toLowerCase() !== 'false',
    // Explicitly disabling visualEditor to prevent MIME/Load errors
    visualEditor: false 
  });

  return (
    <FeatureFlagContext.Provider value={{ flags, setFlags, isLoading: false }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};
