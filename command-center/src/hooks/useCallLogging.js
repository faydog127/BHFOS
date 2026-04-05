import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';

// Keys for query caching
export const callKeys = {
  all: ['calls'],
  list: (prospectId) => [...callKeys.all, 'list', prospectId],
};

/**
 * Hook to fetch call history for a specific prospect
 * @param {string} prospectId - UUID of the partner prospect
 */
export function useGetCallHistory(prospectId) {
  return useQuery({
    queryKey: callKeys.list(prospectId),
    queryFn: async () => {
      if (!prospectId) return [];
      
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!prospectId, // Only run if we have an ID
  });
}

/**
 * Hook to log a new call record
 */
export function useCreateCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      prospect_id, 
      conversation_flow, 
      outcome, 
      notes, 
      goals_met, 
      call_duration 
    }) => {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          prospect_id,
          conversation_flow,
          outcome,
          notes,
          goals_met,
          call_duration
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific prospect's call history so it refreshes immediately
      if (variables.prospect_id) {
        queryClient.invalidateQueries({ 
          queryKey: callKeys.list(variables.prospect_id) 
        });
      }
      // Also invalidate global call lists if they exist later
      queryClient.invalidateQueries({ queryKey: callKeys.all });
    },
  });
}