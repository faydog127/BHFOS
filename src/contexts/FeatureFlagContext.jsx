
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { defaultFlags, getModuleDefinitions } from '@/config/featureFlags';
import { useToast } from '@/components/ui/use-toast';
import brandConfig from '@/config/bhf.config.json';

const FeatureFlagContext = createContext(null);

export const FeatureFlagProvider = ({ children }) => {
  const [flags, setFlags] = useState(defaultFlags);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default';

  // PRIORITY RESOLUTION LOGIC (Runtime)
  // Re-applies the logic ensuring database overrides also respect BHF Hard Limits
  const resolveWithRuntimeOverrides = (dbOverrides = {}) => {
    const bhfDefaults = brandConfig.bhf_defaults.features;
    const tenantStaticOverrides = brandConfig.tenants[TENANT_ID]?.features || {};
    
    // Merge Static Tenant Config with DB Runtime Overrides (DB wins over Static Tenant)
    const effectiveTenantConfig = { ...tenantStaticOverrides, ...dbOverrides };
    
    const resolved = {};

    Object.keys(bhfDefaults).forEach(key => {
      const bhfSetting = bhfDefaults[key];
      const tenantValue = effectiveTenantConfig[key];

      // 1. HARD LIMIT: If BHF says OFF, it stays OFF.
      if (bhfSetting.value === false) {
        resolved[key] = false;
        return;
      }

      // 2. LOCK: If BHF says LOCKED, Tenant/DB cannot change it.
      if (bhfSetting.locked) {
        resolved[key] = bhfSetting.value;
        return;
      }

      // 3. OVERRIDE: Tenant can turn OFF (or ON, if BHF allowed it).
      resolved[key] = tenantValue !== undefined ? tenantValue : bhfSetting.value;
    });

    return resolved;
  };

  // Load flags from Supabase system_settings
  useEffect(() => {
    const loadFlags = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', `feature_flags_${TENANT_ID}`) // Multi-tenant key support
          .single();

        if (error && error.code !== 'PGRST116') { 
          // Fallback to global if specific tenant key missing? 
          // For now, assume no runtime overrides if missing.
          console.log(`No runtime flags found for tenant ${TENANT_ID}, using static defaults.`);
        }

        if (data?.value) {
          const finalFlags = resolveWithRuntimeOverrides(data.value);
          setFlags(finalFlags);
        } else {
          // Just verify static resolution one more time
          setFlags(resolveWithRuntimeOverrides({})); 
        }

      } catch (err) {
        console.error('Failed to load feature flags:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFlags();
    
    // Subscribe to changes (Realtime)
    const subscription = supabase
      .channel('public:system_settings')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'system_settings', 
        filter: `key=eq.feature_flags_${TENANT_ID}` 
      }, (payload) => {
        if (payload.new?.value) {
          const finalFlags = resolveWithRuntimeOverrides(payload.new.value);
          setFlags(finalFlags);
          toast({
            title: "Tenant Configuration Updated",
            description: `Features updated for ${TENANT_ID}. BHF restrictions applied.`,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [TENANT_ID]);

  const updateFlag = async (flagName, value) => {
    // Optimistic Update with Safety Check
    // We must check if this is even allowed to be changed
    const bhfDefaults = brandConfig.bhf_defaults.features;
    if (bhfDefaults[flagName]?.locked || bhfDefaults[flagName]?.value === false) {
        toast({
            variant: "destructive",
            title: "Modification Denied",
            description: "This feature is managed by BHF Global Policy and cannot be changed by the tenant."
        });
        return;
    }

    const currentOverrides = { ...flags }; 
    // Note: 'flags' state is the *result*, not the raw overrides. 
    // Ideally we'd store raw overrides separately, but for MVP we assume 
    // updating 'flags' writes to the tenant override slot.
    
    const newFlags = { ...flags, [flagName]: value };
    setFlags(newFlags); 

    try {
      // Upsert into system_settings with TENANT suffix
      const { error } = await supabase
        .from('system_settings')
        .upsert({ 
          key: `feature_flags_${TENANT_ID}`, 
          value: newFlags, // We save the fully resolved set as the "override" state for simplicity in this implementation
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      
    } catch (err) {
      console.error('Error saving feature flags:', err);
      setFlags(flags); // Revert on error
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not persist feature flag change."
      });
    }
  };

  const getEnabledModules = () => {
    const definitions = getModuleDefinitions();
    return definitions.filter(mod => flags[mod.flag] !== false);
  };

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, updateFlag, getEnabledModules }}>
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
