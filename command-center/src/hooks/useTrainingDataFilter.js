import { useTrainingMode } from '@/contexts/TrainingModeContext';

/**
 * Hook to standardize database filtering for Training vs Live mode across the entire app.
 * Usage:
 * const { applyTrainingFilter } = useTrainingDataFilter();
 * let query = supabase.from('leads').select('*');
 * query = applyTrainingFilter(query);
 */
export const useTrainingDataFilter = () => {
  const { isTrainingMode } = useTrainingMode();

  const applyTrainingFilter = (query) => {
    // If query is null/undefined, we can't filter it.
    if (!query) return query;

    if (isTrainingMode) {
      // In Training Mode: Show ONLY test data
      return query.eq('is_test_data', true);
    } else {
      // In Live Mode: Show ONLY real data (false or null)
      // Note: .or syntax in Supabase JS client requires special formatting
      return query.or('is_test_data.eq.false,is_test_data.is.null');
    }
  };

  return { 
    isTrainingMode, 
    applyTrainingFilter 
  };
};