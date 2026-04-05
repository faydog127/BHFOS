import { supabase } from '@/lib/customSupabaseClient';

export const DEFAULT_TIERS = [
    { threshold: 10, bonus_percent: 2, label: 'Bronze Volume' },
    { threshold: 25, bonus_percent: 5, label: 'Silver Volume' },
    { threshold: 50, bonus_percent: 10, label: 'Gold Volume' },
    { threshold: 100, bonus_percent: 15, label: 'Platinum Volume' }
];

export const fetchVolumeTiers = async () => {
    try {
        const { data, error } = await supabase
            .from('global_config')
            .select('value')
            .eq('key', 'volume_discount_tiers')
            .single();
        
        if (error || !data) return DEFAULT_TIERS;
        return data.value || DEFAULT_TIERS;
    } catch (e) {
        console.error("Error fetching volume tiers:", e);
        return DEFAULT_TIERS;
    }
};

export const calculateVolumeDiscount = (bookingsCount, tiers) => {
    // Sort tiers descending to find the highest matching threshold
    const sortedTiers = [...tiers].sort((a, b) => b.threshold - a.threshold);
    const activeTier = sortedTiers.find(t => bookingsCount >= t.threshold);
    
    // Find next tier
    // Sort ascending to find the first threshold higher than current count
    const ascendingTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
    const nextTier = ascendingTiers.find(t => t.threshold > bookingsCount);

    return {
        bonusPercent: activeTier ? activeTier.bonus_percent : 0,
        currentLabel: activeTier ? activeTier.label : 'Standard',
        nextTier: nextTier || null,
        bookingsToNext: nextTier ? nextTier.threshold - bookingsCount : 0
    };
};