/**
 * ML-P1 Slice 2/3 — Office quote lifecycle actions (issue / revise / reject / expire).
 * Approve uses customer path or admin break-glass with reason.
 * Slice 3: break-glass approve ensures exactly one job server-side (no invoice / field).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId, resolveTenantIdFromSession, tenantPath } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createMlP1S2QuoteLifecycleService } from '@/services/mlP1S2QuoteLifecycleService';
import { isRoleAuthzDeniedError } from '@/lib/mlP1S2RoleAuthz';
import { isTenantDenyError } from '@/lib/mlP1S1Tenant';
import { ArrowLeft, Loader2 } from 'lucide-react';

const lifecycle = createMlP1S2QuoteLifecycleService({ supabase });

export default function MlP1S2QuoteLifecyclePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, isAdmin } = useSupabaseAuth() || {};
  const urlTenantId = getTenantId();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [jobStatus, setJobStatus] = useState(null); // { jobId, jobCreated, idempotent } | { error }
  const [linkedJob, setLinkedJob] = useState(null);

  const actorRole = role || 'viewer';
  const actorId = user?.id || null;

  const load = async () => {
    setLoading(true);
    try {
      const sessionTenantId = await resolveTenantIdFromSession();
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', sessionTenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Quote not found for tenant');
      setQuote(data);
      if (data.valid_until) {
        setValidUntil(String(data.valid_until).slice(0, 10));
      }
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('id, work_order_number, status, source_quote_version')
        .eq('quote_id', id)
        .eq('tenant_id', sessionTenantId)
        .maybeSingle();
      setLinkedJob(jobRow || null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Load failed',
        description: error.message || 'Could not load quote',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runAction = async (fn, label) => {
    setBusy(true);
    try {
      const sessionTenantId = await resolveTenantIdFromSession();
      const result = await fn({
        quoteId: id,
        sessionTenantId,
        urlTenantId,
        actorId,
        actorRole: isAdmin ? 'admin' : actorRole,
      });
      setQuote(result.quote);
      if (result.action === 'approve' || result.action === 'ensure_job') {
        setJobStatus({
          jobId: result.jobId || null,
          jobCreated: Boolean(result.jobCreated),
          idempotent: Boolean(result.idempotent),
        });
        if (result.jobId) {
          setLinkedJob((prev) => ({
            ...(prev || {}),
            id: result.jobId,
          }));
        }
      }
      toast({
        title: `${label} complete`,
        description: result.superseded
          ? `New draft ${result.quote.id} (v${result.quote.quote_version})`
          : result.action === 'approve' || result.action === 'ensure_job'
            ? result.jobId
              ? result.jobCreated
                ? `Job created: ${result.jobId}`
                : `Job ensured (existing): ${result.jobId}`
              : 'Approve recorded but no jobId returned — use Ensure job'
            : `Status: ${result.quote.status}`,
      });
      if ((result.action === 'approve' || result.action === 'ensure_job') && !result.jobId) {
        setJobStatus({ error: 'ML_P1_S3_JOB_ID_MISSING' });
      }
      if (result.action === 'revise' && result.quote?.id) {
        navigate(tenantPath(`estimates/p1-lifecycle/${result.quote.id}`));
      }
    } catch (error) {
      const msg =
        isRoleAuthzDeniedError(error) || isTenantDenyError(error)
          ? error.message
          : error.message || `${label} failed`;
      if (/approve|ensure job/i.test(label)) {
        setJobStatus({ error: error.code || msg });
      }
      toast({ variant: 'destructive', title: `${label} denied`, description: msg });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <Button variant="ghost" onClick={() => navigate(tenantPath('estimates'))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="mt-4 text-sm text-slate-600">Quote not found.</p>
      </div>
    );
  }

  const status = String(quote.status || '').toLowerCase();

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-16">
      <Button variant="ghost" size="sm" onClick={() => navigate(tenantPath('estimates'))}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Estimates
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quote lifecycle (Slice 2/3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-slate-500">ID</span>
            <div className="font-mono text-xs break-all">{quote.id}</div>
          </div>
          <div className="flex justify-between gap-4">
            <div>
              <span className="text-slate-500">Status</span>
              <div className="font-semibold capitalize">{quote.status}</div>
            </div>
            <div>
              <span className="text-slate-500">Version</span>
              <div className="font-semibold">{quote.quote_version || 1}</div>
            </div>
            <div>
              <span className="text-slate-500">Amount</span>
              <div className="font-semibold">
                ${Number(quote.total_amount ?? quote.total ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Approve ensures exactly one job server-side. No invoice or field scheduling here.
          </p>
        </CardContent>
      </Card>

      {status === 'draft' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Valid until (optional)</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={busy}
              onClick={() =>
                runAction(
                  (args) =>
                    lifecycle.issueQuote({
                      ...args,
                      validUntil: validUntil || null,
                    }),
                  'Issue',
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Issue quote'}
            </Button>
          </CardContent>
        </Card>
      )}

      {(['issued', 'sent', 'viewed'].includes(status)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issued actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Reject reason</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="reason code or note"
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                runAction(
                  (args) =>
                    lifecycle.rejectQuote({
                      ...args,
                      rejectionReason: rejectReason || 'rejected',
                    }),
                  'Reject',
                )
              }
            >
              Reject
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => runAction((args) => lifecycle.expireQuote(args), 'Expire')}
            >
              Expire
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => runAction((args) => lifecycle.reviseQuote(args), 'Revise')}
            >
              Revise (new draft version)
            </Button>
            {isAdmin && (
              <div className="space-y-2 border-t pt-3">
                <Label>Admin break-glass approve (reason required)</Label>
                <Input
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="reason_code"
                />
                <Button
                  className="w-full"
                  disabled={busy || !breakGlassReason.trim()}
                  onClick={() =>
                    runAction(
                      (args) =>
                        lifecycle.approveQuote({
                          ...args,
                          actorRole: 'admin',
                          reasonCode: breakGlassReason.trim(),
                          approvalMethod: 'admin_break_glass',
                        }),
                      'Break-glass approve',
                    )
                  }
                >
                  Approve (break-glass)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(status === 'rejected' || status === 'expired') && (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => runAction((args) => lifecycle.reviseQuote(args), 'Revise')}
        >
          Revise into new draft
        </Button>
      )}

      {(status === 'accepted' || status === 'approved') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {jobStatus?.error ? (
              <p className="text-red-700">Last approve error: {jobStatus.error}</p>
            ) : linkedJob?.id || jobStatus?.jobId ? (
              <>
                <p>
                  {jobStatus?.jobCreated
                    ? 'Job created'
                    : jobStatus?.idempotent
                      ? 'Idempotent (existing)'
                      : 'Job linked'}
                </p>
                <div className="font-mono text-xs break-all">
                  {linkedJob?.id || jobStatus?.jobId}
                </div>
                {linkedJob?.work_order_number ? (
                  <p className="text-slate-600">WO {linkedJob.work_order_number}</p>
                ) : null}
              </>
            ) : (
              <p className="text-slate-600">
                Quote approved. No linked job yet — use Ensure job (admin break-glass).
              </p>
            )}
            {isAdmin && !(linkedJob?.id || jobStatus?.jobId) && (
              <div className="space-y-2 border-t pt-3">
                <Label>Ensure job (reason required)</Label>
                <Input
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="reason_code"
                />
                <Button
                  className="w-full"
                  disabled={busy || !breakGlassReason.trim()}
                  onClick={() =>
                    runAction(
                      (args) =>
                        lifecycle.ensureJobForQuote({
                          ...args,
                          actorRole: 'admin',
                          reasonCode: breakGlassReason.trim(),
                        }),
                      'Ensure job',
                    )
                  }
                >
                  Ensure job
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
