
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
    enablePricebook: true,
    enablePartners: true,
    // Visual Editor flag added as requested - default to false to disable plugin logic
    visualEditor: false 
  });

  return (
    <FeatureFlagContext.Provider value={{ flags, setFlags }}>
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
