import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { tenantPath, getUrlTenant } from '@/lib/tenantUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { tenantId: paramTenant } = useParams();
  const tenantId = paramTenant || getUrlTenant() || 'tvg';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const recoveryError = hashParams.get('error_description');
    if (recoveryError) {
      setError(recoveryError);
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setHasRecoverySession(Boolean(data?.session));
      setIsChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasRecoverySession(Boolean(session));
        setIsChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError('Use at least 12 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setCompleted(true);
    } catch (updateError) {
      setError(updateError?.message || 'Password could not be updated.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnToLogin = () => {
    navigate(tenantPath('/login', tenantId), { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link to={tenantPath('/login', tenantId)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </Button>
      </div>

      <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
          <CardDescription>
            Set a new password for the {tenantId} CRM.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {completed ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Your password has been updated.</AlertDescription>
              </Alert>
              <Button type="button" className="w-full" onClick={returnToLogin}>
                Continue to sign in
              </Button>
            </div>
          ) : isChecking ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-600">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying recovery link...
            </div>
          ) : !hasRecoverySession ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This recovery link is invalid or expired. Request a new link from the sign-in page.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={12}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  minLength={12}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-800 pt-6">
          <Link
            to={tenantPath('/forgot-password', tenantId)}
            className="text-sm text-blue-600 hover:underline"
          >
            Request another recovery link
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ResetPassword;
