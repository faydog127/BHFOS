
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import queryClient from '@/lib/queryClient';
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext';
import { TrainingModeProvider } from '@/contexts/TrainingModeContext';
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <TrainingModeProvider>
          <FeatureFlagProvider>
            <App />
            <Toaster />
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          </FeatureFlagProvider>
        </TrainingModeProvider>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  </>,
);
