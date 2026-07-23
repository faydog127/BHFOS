import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { formatInvoiceStatusLabel, canPerformS5 } from '@/lib/mlP1S5InvoiceAuthz';
import { createMlP1S5InvoiceService } from '@/services/mlP1S5InvoiceService';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Office invoice panel for completed jobs (ML-P1 S5).
 * Create draft / issue (persists sent, shows Issued) / void with reason.
 */
export default function OfficeInvoicePanel({ job, role = 'office', onUpdated }) {
  const { toast } = useToast();
  const service = useMemo(() => createMlP1S5InvoiceService({ supabase }), []);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [taxRate, setTaxRate] = useState('');
  const [voidReason, setVoidReason] = useState('');

  const active = invoices.find((i) => String(i.status).toLowerCase() !== 'void') || null;
  const canCreate = canPerformS5(role, 'create');
  const canIssue = canPerformS5(role, 'issue');
  const canVoid = canPerformS5(role, 'void');

  const load = async () => {
    if (!job?.id) return;
    const [ready, rows] = await Promise.all([
      service.readiness(job.id).catch(() => null),
      service.getByJob(job.id),
    ]);
    setReadiness(ready);
    setInvoices(rows);
    const draft = rows.find((r) => String(r.status).toLowerCase() === 'draft');
    if (draft?.tax_rate != null) setTaxRate(String(draft.tax_rate));
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const run = async (fn, title) => {
    setBusy(true);
    try {
      const result = await fn();
      toast({
        title,
        description: result?.display_status || formatInvoiceStatusLabel(result?.status),
      });
      await load();
      onUpdated?.(result);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed', description: err?.message || 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  if (!job?.id) return null;
  if (String(job.status || '').toLowerCase() !== 'completed' && !active) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Invoice actions unlock when the job is completed (or when a draft already exists).
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Slice 5 invoice</div>
          <div className="text-xs text-slate-500">Final only · office issues · never auto-send</div>
        </div>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      </div>

      {readiness && !readiness.eligible && !active ? (
        <div className="text-xs text-amber-700">
          Blocked: {(readiness.blockers || []).map((b) => b.code).join(', ') || 'not eligible'}
        </div>
      ) : null}

      {active ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatInvoiceStatusLabel(active.status)}</Badge>
            <span className="font-mono text-xs">{active.invoice_number || active.id}</span>
            <span>${Number(active.total_amount || 0).toFixed(2)}</span>
          </div>
          {String(active.status).toLowerCase() === 'draft' && canIssue ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <div className="text-xs text-slate-500">Tax rate (draft)</div>
                <Input
                  className="h-8 w-28"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      service.draftUpdate(active.id, {
                        taxRate: taxRate === '' ? null : Number(taxRate),
                      }),
                    'Draft tax updated',
                  )
                }
              >
                Save tax
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => service.issue(active.id), 'Invoice issued')}
              >
                Issue
              </Button>
            </div>
          ) : null}
          {canVoid && ['draft', 'sent'].includes(String(active.status).toLowerCase()) ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Void reason (required)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={busy || !voidReason.trim()}
                onClick={() =>
                  run(() => service.void(active.id, voidReason.trim()), 'Invoice voided')
                }
              >
                Void (reissue required for corrections)
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          {canCreate ? (
            <Button
              size="sm"
              disabled={busy || readiness?.eligible === false}
              onClick={() => run(() => service.create(job.id), 'Draft invoice created')}
            >
              Create draft invoice
            </Button>
          ) : (
            <div className="text-xs text-slate-500">No create permission for role {role}</div>
          )}
        </div>
      )}
    </div>
  );
}
