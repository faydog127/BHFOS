import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
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
import {
  clearPendingPostLoginPath,
  isSafeMilPostLoginPath,
  isSafeTenantPostLoginPath,
  passwordResetRedirectTo,
  sanitizePostLoginPath,
} from '@/lib/postLoginRedirect';

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
  const [info, setInfo] = useState(null);

  const navigate = useNavigate();
  const { tenantId: paramTenant } = useParams();
  const urlTenant = paramTenant || getUrlTenant() || 'tvg';
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const nextRaw = searchParams.get('next');
  const safeNext = sanitizePostLoginPath(nextRaw, urlTenant);
  const isCreatorEntry =
    isSafeMilPostLoginPath(safeNext) &&
    (safeNext.startsWith('/creator') || safeNext.startsWith('/contributor'));

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const { fetchMilRole, milCapabilities } = await import('@/lib/mediaIntel/roles');
        const role = await fetchMilRole();
        if (cancelled) return;
        const caps = milCapabilities(role);

        // MIL product next always wins.
        if (safeNext && isSafeMilPostLoginPath(safeNext)) {
          clearPendingPostLoginPath();
          navigate(safeNext, { replace: true });
          return;
        }

        // Creators must not land on CRM even when next points at the CRM hub.
        if (caps.isCreator && !caps.isStaff) {
          clearPendingPostLoginPath();
          navigate('/creator', { replace: true });
          return;
        }

        if (safeNext && isSafeTenantPostLoginPath(safeNext, urlTenant)) {
          clearPendingPostLoginPath();
          navigate(safeNext, { replace: true });
          return;
        }

        navigate(tenantPath('/crm', urlTenant), { replace: true });
      } catch {
        if (!cancelled) {
          if (safeNext && (isSafeMilPostLoginPath(safeNext) || isSafeTenantPostLoginPath(safeNext, urlTenant))) {
            navigate(safeNext, { replace: true });
          } else {
            navigate(tenantPath('/crm', urlTenant), { replace: true });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, navigate, urlTenant, safeNext]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (hasHostedLocalSupabaseMismatch) {
      setError(hostedLocalSupabaseErrorMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const { error: signInError } = await signIn({ email, password });
      if (signInError) throw signInError;
      // Success is handled by useEffect above
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address first, then select Forgot password.');
      return;
    }
    if (hasHostedLocalSupabaseMismatch) {
      setError(hostedLocalSupabaseErrorMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const redirectTo = passwordResetRedirectTo(window.location.origin, urlTenant);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setInfo('If an account exists for this email, a password-reset link has been sent.');
    } catch (err) {
      setError(err?.message || 'Unable to send a password-reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const { error: googleError } = await signInWithGoogle({
        nextPath: safeNext,
      });
      if (googleError) throw googleError;
      // Redirect handled by Supabase (OAuth)
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setError(err?.message || 'Failed to sign in with Google.');
      setIsSubmitting(false);
    }
  };

  const fillLocalCredentials = () => {
    setEmail(localDevEmail);
    setPassword(localDevPassword);
    setError(null);
    setInfo(null);
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
            {isCreatorEntry
              ? 'Enter your credentials to open the Contributor Workspace.'
              : `Enter your credentials to access ${urlTenant}.`}
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
            {info && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{info}</AlertDescription>
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                {!isLocalAuth && !hasHostedLocalSupabaseMismatch ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-700 hover:underline"
                    disabled={isSubmitting}
                    onClick={handleForgotPassword}
                    data-testid="forgot-password"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
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
