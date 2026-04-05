import React from 'react';

/**
 * This is a shim for the useAuth hook.
 * It provides a default, non-functional authentication context 
 * to prevent the application from crashing after removing the real
 * authentication system. All components that previously used useAuth
 * will now use this, allowing them to render without errors.
 */
export function useAuth() {
  return {
    user: null,
    session: null,
    signIn: async () => {
        console.warn("Sign-in function is disabled.");
        return ({ error: { message: "Authentication is disabled." } });
    },
    signOut: async () => {
        console.warn("Sign-out function is disabled.");
        return ({ error: null });
    },
    loading: false
  };
}