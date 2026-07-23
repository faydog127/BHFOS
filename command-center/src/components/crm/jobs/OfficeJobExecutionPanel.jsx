import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { formatS4StatusLabel, isDispatchedDerived } from '@/lib/mlP1S4RoleAuthz';
import { createMlP1S4JobExecutionService } from '@/services/mlP1S4JobExecutionService';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Minimum office execution controls for ML-P1 Slice 4.
 * Uses canonical RPCs only — no invoice actions.
 */
export default function OfficeJobExecutionPanel({ job, tenantId, technicians = [], onUpdated }) {
  const { toast } = useToast();
  const service = useMemo(() => createMlP1S4JobExecutionService({ supabase }), []);
  const [busy, setBusy] = useState(false);
  const [technicianId, setTechnicianId] = useState(job?.technician_id || '');
  const [start, setStart] = useState(job?.scheduled_start ? String(job.scheduled_start).slice(0, 16) : '');
  const [end, setEnd] = useState(job?.scheduled_end ? String(job.scheduled_end).slice(0, 16) : '');
  const [reopenReason, setReopenReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [bgReason, setBgReason] = useState('');
  const [bgEvidenceType, setBgEvidenceType] = useState('recorded_verbal');
  const [bgEvidenceRef, setBgEvidenceRef] = useState('');
  const [bgAuthAt, setBgAuthAt] = useState('');
  const [changeOrders, setChangeOrders] = useState([]);
  const [blockers, setBlockers] = useState([]);

  const load = async () => {
    if (!job?.id || !tenantId) return;
    const rows = await service.listChangeOrders(job.id, tenantId);
    setChangeOrders(rows);
    try {
      const ready = await service.completionReadiness(job.id);
      setBlockers(ready?.blockers || []);
    } catch {
      setBlockers([]);
    }
  };

  React.useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, tenantId]);

  const run = async (fn, title) => {
    setBusy(true);
    try {
      const result = await fn();
      toast({ title, description: result?.status ? formatS4StatusLabel(result.status) : undefined });
      await load();
      onUpdated?.(result);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed', description: err?.message || 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  if (!job?.id) return null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Slice 4 execution</div>
          <div className="text-xs text-slate-500">
            Status: {formatS4StatusLabel(job.status)}
            {isDispatchedDerived(job) ? ' · Dispatched (derived)' : ''}
          </div>
        </div>
        <Badge variant="outline">Invoice via Slice 5 (no auto-send)</Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <select
          className="h-10 rounded-md border px-2 text-sm"
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
        >
          <option value="">Assign technician</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name || t.id}
            </option>
          ))}
        </select>
        <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <Button
        disabled={busy}
        onClick={() =>
          run(
            () =>
              service.assignAndSchedule(job.id, {
                technicianId: technicianId || null,
                scheduledStart: start ? new Date(start).toISOString() : null,
                scheduledEnd: end ? new Date(end).toISOString() : null,
              }),
            'Assigned / scheduled',
          )
        }
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save assignment & schedule
      </Button>

      {Array.isArray(blockers) && blockers.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Completion blockers: {blockers.map((b) => b.code || JSON.stringify(b)).join(', ')}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm font-medium">Pending change orders</div>
        {changeOrders.length === 0 ? (
          <div className="text-xs text-slate-500">None</div>
        ) : (
          changeOrders.map((co) => (
            <div key={co.id} className="rounded border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{co.reason}</span>
                <Badge variant="outline">{co.status}</Badge>
              </div>
              <div className="text-xs text-slate-500">
                Delta: {(co.financial_delta_cents || 0) / 100} {co.free_form_pricing ? '· free-form' : '· price-book'}
              </div>
              {co.status === 'proposed' && co.free_form_pricing ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(() => service.transitionChangeOrder(co.id, 'release_free_form'), 'Free-form released')
                  }
                >
                  Release free-form to customer
                </Button>
              ) : null}
              {['proposed', 'pending_approval'].includes(co.status) ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <Textarea
                    placeholder="Break-glass reason (required)"
                    value={bgReason}
                    onChange={(e) => setBgReason(e.target.value)}
                  />
                  <select
                    className="h-10 rounded-md border px-2 text-sm"
                    value={bgEvidenceType}
                    onChange={(e) => setBgEvidenceType(e.target.value)}
                  >
                    <option value="recorded_verbal">Recorded verbal</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="signed_document">Signed document</option>
                    <option value="portal_token">Portal token</option>
                    <option value="other_approved">Other approved</option>
                  </select>
                  <Input
                    placeholder="Immutable evidence reference (storage path / message id)"
                    value={bgEvidenceRef}
                    onChange={(e) => setBgEvidenceRef(e.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={bgAuthAt}
                    onChange={(e) => setBgAuthAt(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          service.transitionChangeOrder(co.id, 'approve_break_glass', {
                            reason: bgReason,
                            customerAuthEvidenceType: bgEvidenceType,
                            customerAuthEvidenceRef: bgEvidenceRef,
                            customerAuthAt: bgAuthAt ? new Date(bgAuthAt).toISOString() : new Date().toISOString(),
                          }),
                        'Break-glass approved',
                      )
                    }
                  >
                    Break-glass approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(() => service.transitionChangeOrder(co.id, 'reject', { reason: 'Office reject' }), 'Rejected')
                    }
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-2">
          <Textarea placeholder="Reopen reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
          <Button
            variant="outline"
            disabled={busy || job.status !== 'completed'}
            onClick={() => run(() => service.reopen(job.id, reopenReason), 'Reopened')}
          >
            Break-glass reopen
          </Button>
        </div>
        <div className="space-y-2">
          <Textarea placeholder="Cancel reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => run(() => service.cancel(job.id, cancelReason), 'Cancelled')}
          >
            Cancel job
          </Button>
        </div>
      </div>
    </div>
  );
}
