
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantIdFromSession, logTenantDebugInfo } from '@/lib/tenantUtils';

const SupabaseAuthContext = createContext({});

export const useSupabaseAuth = () => useContext(SupabaseAuthContext);

// Export useAuth for compatibility
export const useAuth = useSupabaseAuth;

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [role, setRole] = useState(null);
  const [tenantId, setTenantId] = useState('tvg'); // Default safe tenant

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // 1. Attempt to recover session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          // Extract role if available in metadata
          setRole(session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || 'viewer');
          
          if (session) {
            // Resolve and log tenant info immediately on init
            await logTenantDebugInfo();
            const resolvedTenant = await resolveTenantIdFromSession();
            setTenantId(resolvedTenant);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        
        // 2. Handle Corrupted Tokens
        const isCorruptedToken = 
          error.message?.includes('bad_jwt') || 
          error.message?.includes('missing sub claim') || 
          error.message?.includes('invalid claim') ||
          error.code === 403;

        if (isCorruptedToken) {
          console.warn('⚠️ Detected corrupted JWT or session. Forcing cleanup...');
          try {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setRole(null);
            localStorage.removeItem('tvg_tenant_id'); // Clear tenant cache
          } catch (signOutError) {
            console.error('Error during forced sign-out:', signOutError);
          }
        }
        
        if (mounted) {
          setAuthError(error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth state changed: ${event}`);
      
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setRole(session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || 'viewer');
        setLoading(false);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setAuthError(null);
          // Re-resolve tenant on sign-in or refresh to ensure claims are up to date
          await logTenantDebugInfo();
          const resolvedTenant = await resolveTenantIdFromSession();
          setTenantId(resolvedTenant);
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
          setTenantId('tvg'); // Reset to default
          localStorage.removeItem('tvg_tenant_id'); // Clear cache
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signInWithGoogle: async () => {
      // Redirect to CRM after successful login
      const redirectTo = `${window.location.origin}/crm`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      return { data, error };
    },
    signOut: async () => {
      try {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        localStorage.removeItem('tvg_tenant_id');
      } catch (error) {
        console.error('Error signing out:', error);
      }
    },
    user,
    session,
    loading,
    authError,
    role,
    tenantId, // Expose resolved tenant ID
    isAdmin: role === 'admin' || role === 'super_admin'
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
