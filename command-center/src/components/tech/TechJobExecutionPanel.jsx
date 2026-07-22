import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  formatS4StatusLabel,
  isDispatchedDerived,
  nextFieldActionsForStatus,
} from '@/lib/mlP1S4RoleAuthz';
import { createMlP1S4JobExecutionService } from '@/services/mlP1S4JobExecutionService';
import { uploadJobExecutionPhoto, isUsableJobPhotoRef } from '@/lib/mlP1S4JobPhotoUpload';
import { supabase } from '@/lib/customSupabaseClient';

const ACTION_LABELS = {
  on_my_way: 'On my way',
  arrive: 'Arrive',
  start: 'Start work',
  pause: 'Pause',
  resume: 'Resume',
  complete_submit: 'Submit completion',
  complete_finalize: 'Finalize completion',
  no_access: 'No access',
  request_reschedule: 'Reschedule required',
};

export default function TechJobExecutionPanel({ job, tenantId, onUpdated }) {
  const { toast } = useToast();
  const service = useMemo(() => createMlP1S4JobExecutionService({ supabase }), []);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(job?.technician_notes || '');
  const [summary, setSummary] = useState(job?.customer_summary || '');
  const [findings, setFindings] = useState(
    typeof job?.execution_findings === 'string'
      ? job.execution_findings
      : job?.execution_findings?.text || '',
  );
  const [ackUnavailableReason, setAckUnavailableReason] = useState('');
  const [coReason, setCoReason] = useState('');
  const [coDesc, setCoDesc] = useState('');
  const [coQty, setCoQty] = useState('1');
  const [coPriceBookId, setCoPriceBookId] = useState('');
  const [coUnitCents, setCoUnitCents] = useState('0');
  const [makeSafeSummary, setMakeSafeSummary] = useState('');
  const [changeOrders, setChangeOrders] = useState([]);
  const [blockers, setBlockers] = useState(job?.completion_blockers || []);
  const [photos, setPhotos] = useState(
    Array.isArray(job?.execution_photos) ? job.execution_photos.filter(isUsableJobPhotoRef) : [],
  );

  const actions = nextFieldActionsForStatus(job?.status);
  const dispatched = isDispatchedDerived(job);

  const refreshOrders = async () => {
    if (!job?.id || !tenantId) return;
    const rows = await service.listChangeOrders(job.id, tenantId);
    setChangeOrders(rows);
  };

  React.useEffect(() => {
    refreshOrders().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, tenantId]);

  const run = async (fn, okTitle) => {
    setBusy(true);
    try {
      const result = await fn();
      toast({ title: okTitle || 'Updated', description: result?.status ? formatS4StatusLabel(result.status) : undefined });
      await refreshOrders();
      onUpdated?.(result);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: err?.message || 'Could not update job.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAction = (action) => {
    const needsReason = action === 'no_access' || action === 'request_reschedule';
    if (needsReason && !reason.trim()) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Enter a reason for this exception.' });
      return;
    }
    run(
      () =>
        service.transition(job.id, action, {
          reason: reason.trim() || null,
          expectedRowVersion: job.execution_row_version ?? null,
        }),
      ACTION_LABELS[action] || action,
    );
  };

  const onPhoto = async (kind, event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const ref = await uploadJobExecutionPhoto({
        tenantId,
        jobId: job.id,
        kind,
        file,
      });
      setPhotos((prev) => {
        const others = (prev || []).filter((p) => String(p.kind).toLowerCase() !== kind);
        return [...others, ref];
      });
      toast({ title: `${kind} photo uploaded` });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Photo upload failed',
        description: err?.message || 'Upload failed — completion remains blocked.',
      });
    } finally {
      setBusy(false);
      if (event?.target) event.target.value = '';
    }
  };

  const saveEvidence = () =>
    run(async () => {
      const usable = (photos || []).filter(isUsableJobPhotoRef);
      return service.upsertEvidence(job.id, {
        technicianNotes: notes,
        customerSummary: summary,
        executionFindings: { text: findings },
        executionPhotos: usable.length ? usable : [],
        executionChecklist: {
          materials_declared: true,
          approved_change_orders_accounted: true,
        },
        materialsNone: true,
        customerAckWaiverReason: ackUnavailableReason.trim() || null,
      });
    }, 'Evidence saved');

  const checkReady = () =>
    run(async () => {
      const ready = await service.completionReadiness(job.id);
      setBlockers(ready?.blockers || []);
      return ready;
    }, 'Readiness checked');

  const proposeCo = () => {
    if (!coReason.trim() || !coDesc.trim() || !coPriceBookId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Change order incomplete',
        description: 'Reason, description, and price-book item id are required (PD-S4-04).',
      });
      return;
    }
    const qty = Number(coQty) || 1;
    const unit = Number(coUnitCents) || 0;
    run(
      () =>
        service.proposeChangeOrder(job.id, {
          reason: coReason.trim(),
          pricingMode: 'price_book',
          items: [
            {
              line_action: 'add',
              price_book_item_id: coPriceBookId.trim(),
              description: coDesc.trim(),
              quantity: qty,
              unit_price_cents: unit,
              line_delta_cents: Math.round(qty * unit),
            },
          ],
        }),
      'Change order proposed',
    );
  };

  const recordMakeSafe = () => {
    if (!makeSafeSummary.trim()) {
      toast({ variant: 'destructive', title: 'Summary required' });
      return;
    }
    run(
      () =>
        service.recordMakeSafe(job.id, {
          actionType: 'secure_component',
          summary: makeSafeSummary.trim(),
        }),
      'Make-safe recorded (non-billable)',
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Field execution</span>
            <Badge variant="outline">{formatS4StatusLabel(job?.status)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dispatched ? (
            <div className="text-xs text-slate-500">Office condition: Dispatched (derived — not a tech action).</div>
          ) : null}
          <div className="grid gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => handleAction(action)}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {ACTION_LABELS[action] || action}
              </Button>
            ))}
          </div>
          {(actions.includes('no_access') || actions.includes('request_reschedule')) && (
            <Textarea
              placeholder="Reason for no access / reschedule"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          {Array.isArray(blockers) && blockers.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium mb-1">Completion blockers</div>
              <ul className="list-disc pl-5 space-y-1">
                {blockers.map((b, i) => (
                  <li key={i}>{typeof b === 'string' ? b : b.code || JSON.stringify(b)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Evidence & completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Technician notes (required)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Textarea placeholder="Work performed / findings (required)" value={findings} onChange={(e) => setFindings(e.target.value)} />
          <Textarea placeholder="Customer summary (required)" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <Textarea
            placeholder="If customer acknowledgement unavailable — document why (PD-S4-03)"
            value={ackUnavailableReason}
            onChange={(e) => setAckUnavailableReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="rounded border p-3">
              <div className="mb-1 font-medium">Before photo</div>
              <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => onPhoto('before', e)} />
              <div className="mt-1 text-xs text-slate-500">
                {photos.some((p) => p.kind === 'before') ? 'Uploaded' : 'Required'}
              </div>
            </label>
            <label className="rounded border p-3">
              <div className="mb-1 font-medium">After photo</div>
              <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => onPhoto('after', e)} />
              <div className="mt-1 text-xs text-slate-500">
                {photos.some((p) => p.kind === 'after') ? 'Uploaded' : 'Required'}
              </div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={saveEvidence}>
              Save evidence
            </Button>
            <Button variant="outline" disabled={busy} onClick={checkReady}>
              Check readiness
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Make-safe only (PD-S4-01)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-slate-500">
            Stop / disconnect / secure / document / advise only. Not billable. No repair or replace until CO approved.
          </div>
          <Textarea
            placeholder="Make-safe summary"
            value={makeSafeSummary}
            onChange={(e) => setMakeSafeSummary(e.target.value)}
          />
          <Button variant="outline" disabled={busy} onClick={recordMakeSafe} className="w-full">
            Record make-safe
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Propose change order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-slate-500">Technicians may propose only — never self-approve (PD-S4-02).</div>
          <Textarea placeholder="Reason" value={coReason} onChange={(e) => setCoReason(e.target.value)} />
          <Input placeholder="Price book item id" value={coPriceBookId} onChange={(e) => setCoPriceBookId(e.target.value)} />
          <Input placeholder="Description" value={coDesc} onChange={(e) => setCoDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Qty" value={coQty} onChange={(e) => setCoQty(e.target.value)} />
            <Input placeholder="Unit cents" value={coUnitCents} onChange={(e) => setCoUnitCents(e.target.value)} />
          </div>
          <Button disabled={busy} onClick={proposeCo} className="w-full">
            Propose change order
          </Button>
          {changeOrders.length > 0 ? (
            <div className="space-y-2 text-sm">
              {changeOrders.map((co) => (
                <div key={co.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span className="truncate">{co.reason}</span>
                  <Badge variant="outline">{co.status}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
