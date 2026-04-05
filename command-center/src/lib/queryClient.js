import { QueryClient } from '@tanstack/react-query';
import logger from './logger';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      onError: (error) => {
        logger.error('Mutation error:', error);
      },
    },
  },
});

export default queryClient;