
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

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
        
        if (event === 'SIGNED_IN') {
          setAuthError(null);
        }
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
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
      } catch (error) {
        console.error('Error signing out:', error);
      }
    },
    user,
    session,
    loading,
    authError,
    role,
    isAdmin: role === 'admin' || role === 'super_admin'
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
