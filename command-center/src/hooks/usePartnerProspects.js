import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';

export const partnerProspectsKeys = {
  all: ['partnerProspects'],
  lists: () => [...partnerProspectsKeys.all, 'list'],
  list: (filters) => [...partnerProspectsKeys.lists(), { filters }],
  details: () => [...partnerProspectsKeys.all, 'detail'],
  detail: (id) => [...partnerProspectsKeys.details(), id],
  queue: () => [...partnerProspectsKeys.all, 'queue', 'next'],
};

export function usePartnerProspects(filters = {}) {
  return useQuery({
    queryKey: partnerProspectsKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('partner_prospects')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.persona) {
        query = query.eq('persona', filters.persona);
      }

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`business_name.ilike.${searchTerm},contact_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function usePartnerProspect(id) {
  return useQuery({
    queryKey: partnerProspectsKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('partner_prospects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useNextPartnerProspect() {
  return useQuery({
    queryKey: partnerProspectsKeys.queue(),
    queryFn: async () => {
      // FIFO queue: oldest item with status 'new'
      const { data, error } = await supabase
        .from('partner_prospects')
        .select('*')
        .eq('status', 'new')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProspectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, notes, ...otherUpdates }) => {
      if (!id) throw new Error("ID is required for update");
      
      const updates = { 
        status, 
        ...otherUpdates,
        // Only update notes if provided, otherwise leave as is or append if logic required
        // Here we assume notes replaces the field or is handled by caller logic
        ...(notes !== undefined && { notes }) 
      };

      const { data, error } = await supabase
        .from('partner_prospects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all lists to refresh counts/tables
      queryClient.invalidateQueries({ queryKey: partnerProspectsKeys.lists() });
      
      // Invalidate the queue so we fetch the next fresh item
      queryClient.invalidateQueries({ queryKey: partnerProspectsKeys.queue() });
      
      // Update specific item in cache if it exists
      if (data?.id) {
        queryClient.setQueryData(partnerProspectsKeys.detail(data.id), data);
      }
    },
  });
}