import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { getUrlTenant, tenantPath } from '@/lib/tenantUtils';
import { fetchMilRole, milCapabilities } from '@/lib/mediaIntel/roles';

/**
 * Recovery landing: Supabase recovery links establish a session, then the user
 * sets a new password here.
 */
export default function ResetPassword() {
  const { tenantId: paramTenant } = useParams();
  const urlTenant = paramTenant || getUrlTenant() || 'tvg';
  const { session, loading: authLoading } = useSupabaseAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setError('This reset link is invalid or has expired. Request a new one from the sign-in page.');
    }
  }, [authLoading, session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!session) {
      setError('This reset link is invalid or has expired. Request a new one from the sign-in page.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      try {
        const role = await fetchMilRole();
        const caps = milCapabilities(role);
        const dest = caps.isCreator && !caps.isStaff ? '/creator' : tenantPath('/crm', urlTenant);
        setTimeout(() => navigate(dest, { replace: true }), 800);
      } catch {
        setTimeout(() => navigate(tenantPath('/login', urlTenant), { replace: true }), 800);
      }
    } catch (err) {
      setError(err?.message || 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link to={tenantPath('/login', urlTenant)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </Button>
      </div>
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-password-form">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Password updated. Redirecting…</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={!session || success || submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                disabled={!session || success || submitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!session || success || submitting || authLoading}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t pt-6">
          <p className="text-sm text-slate-500">Authorized personnel only.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
