
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import queryClient from '@/lib/queryClient';
import { TrainingModeProvider } from '@/contexts/TrainingModeContext';
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext';
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext';

// Before BrowserRouter. Chrome runs an earlier popstate listener before one
// registered later, including a capture listener. A non-cancelable Back (the
// second Back after Esc consumes history activation) would otherwise let
// React Router unmount Finance and drop the unsaved edit with no prompt.
window.addEventListener('popstate', (e) => window.__financeLeaveHold?.(e), true);

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
