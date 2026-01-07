
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantIdFromSession, logTenantDebugInfo, getSelectedTenantId } from '@/lib/tenantUtils';
import { jwtDecode } from "jwt-decode";

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
  const [activeTenantId, setActiveTenantId] = useState('tvg'); // Derived from selectedTenantId (Source of Truth)

  const logTenantContext = async (currentSession) => {
    try {
      const sess = currentSession || session;
      let tokenTenantId = null;

      if (sess?.access_token) {
        try {
          const decoded = jwtDecode(sess.access_token);
          tokenTenantId = decoded.app_metadata?.tenant_id;
        } catch (e) {
          console.error("Error decoding token for context log:", e);
        }
      }

      // SOURCE OF TRUTH: selectedTenantId (from URL or localStorage)
      const selectedTenantId = getSelectedTenantId();
      
      // Set activeTenantId = selectedTenantId (defaulting to 'tvg' if null)
      const finalActiveId = selectedTenantId || 'tvg';
      setActiveTenantId(finalActiveId);

      const match = (finalActiveId === tokenTenantId) || (tokenTenantId === null && finalActiveId === 'tvg');

      // Log: "Active Tenant: {activeTenantId} (selected), Token Tenant: {tokenTenantId} (informational), match={boolean}"
      console.log(`Active Tenant: ${finalActiveId} (selected), Token Tenant: ${tokenTenantId} (informational), match=${match}`);
      
      // If they don't match, log a warning but DO NOT block; continue with selectedTenantId as active
      if (!match && tokenTenantId) {
        console.warn(`Tenant Mismatch: Active(${finalActiveId}) vs Token(${tokenTenantId}). Proceeding with Active Tenant.`);
      }
      
      return { selectedTenantId: finalActiveId, tokenTenantId, match };
    } catch (err) {
      console.error("Error in logTenantContext:", err);
      // Fallback in case of error
      const fallbackId = getSelectedTenantId() || 'tvg';
      setActiveTenantId(fallbackId);
      return { selectedTenantId: fallbackId, tokenTenantId: null, match: false };
    }
  };

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
            
            // Log full tenant context check and set activeTenantId
            await logTenantContext(session);
          } else {
            // Even without session, set activeTenantId from URL/Storage so public pages have context
            const current = getSelectedTenantId() || 'tvg';
            setActiveTenantId(current);
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
            localStorage.removeItem('currentTenantId');
            setActiveTenantId('tvg');
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
          
          // Log context on auth state change (sign in / refresh) and set activeTenantId
          await logTenantContext(session);
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
          setTenantId('tvg'); // Reset to default
          localStorage.removeItem('tvg_tenant_id'); // Clear cache
          
          // Reset activeTenantId to URL/Storage or default
          const current = getSelectedTenantId() || 'tvg';
          setActiveTenantId(current);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Helper to safely check if a user exists by email without using "in" operator
  const checkUserExists = async (email) => {
    if (!email || typeof email !== 'string') {
      console.warn('checkUserExists called with invalid email:', email);
      return false;
    }
    
    try {
      // Use .eq() instead of .in() for exact string matching
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        // If 406 or similar, we might ignore, but log generally
        console.error('Error checking user existence:', error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.error('Exception in checkUserExists:', err);
      return false;
    }
  };

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
        setActiveTenantId('tvg');
      } catch (error) {
        console.error('Error signing out:', error);
      }
    },
    checkUserExists,
    user,
    session,
    loading,
    authError,
    role,
    tenantId, // Deprecated: derived from token
    activeTenantId, // New Source of Truth: derived from selectedTenantId
    isAdmin: role === 'admin' || role === 'super_admin',
    logTenantContext 
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
