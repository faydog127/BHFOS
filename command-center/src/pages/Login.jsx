import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { tenantPath, getUrlTenant } from '@/lib/tenantUtils';
import {
  hostedLocalSupabaseErrorMessage,
} from '@/lib/supabaseEnv';

const Login = () => {
  const {
    signIn,
    signInWithGoogle,
    user,
    isLocalAuth,
    hasHostedLocalSupabaseMismatch,
  } = useSupabaseAuth();
  const localDevEmail = import.meta.env.VITE_LOCAL_DEV_AUTH_EMAIL || '';
  const localDevPassword = import.meta.env.VITE_LOCAL_DEV_AUTH_PASSWORD || '';
  const [email, setEmail] = useState(() => (isLocalAuth ? localDevEmail : ''));
  const [password, setPassword] = useState(() => (isLocalAuth ? localDevPassword : ''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  // Prefer params, fallback to util
  const { tenantId: paramTenant } = useParams();
  const urlTenant = paramTenant || getUrlTenant() || 'tvg';
  
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      // 1. Check for 'next' query param
      const searchParams = new URLSearchParams(location.search);
      const next = searchParams.get('next');

      // 2. Validate 'next' param: must start with /${urlTenant}/ to be safe and same-tenant
      if (next && next.startsWith(`/${urlTenant}/`)) {
         navigate(next, { replace: true });
      } else {
         // 3. Default redirect
         navigate(tenantPath('/crm', urlTenant), { replace: true });
      }
    }
  }, [user, navigate, urlTenant, location]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (hasHostedLocalSupabaseMismatch) {
      setError(hostedLocalSupabaseErrorMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await signIn({ email, password });
      if (error) throw error;
      // Success is handled by useEffect above
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Redirect handled by Supabase (OAuth)
    } catch (err) {
      console.error("Google sign-in failed:", err);
      setError(err?.message || "Failed to sign in with Google.");
      setIsSubmitting(false);
    }
  };

  const fillLocalCredentials = () => {
    setEmail(localDevEmail);
    setPassword(localDevPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link to={tenantPath('/', urlTenant)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </Button>
      </div>
      <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold capitalize">Sign in to {urlTenant}</CardTitle>
          <CardDescription>
            Enter your credentials to access the {urlTenant} CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {hasHostedLocalSupabaseMismatch ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{hostedLocalSupabaseErrorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {isLocalAuth ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <div>Local Supabase does not have Google OAuth enabled. Use the local dev admin account.</div>
                  <div className="font-mono text-xs break-all">
                    {localDevEmail || 'local admin email missing in .env.local'}
                  </div>
                  {localDevEmail && localDevPassword ? (
                    <Button type="button" variant="outline" size="sm" onClick={fillLocalCredentials}>
                      Use Local Dev Credentials
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
              disabled={isSubmitting || hasHostedLocalSupabaseMismatch}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            {!isLocalAuth && !hasHostedLocalSupabaseMismatch ? (
              <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={handleGoogle}
                >
                  Continue with Google
                </Button>
              </>
            ) : null}
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-800 pt-6">
          <p className="text-sm text-slate-500">
            Authorized personnel only.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
