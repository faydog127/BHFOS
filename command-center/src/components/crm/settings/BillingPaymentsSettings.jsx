import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  ML_P1_S6_PAYMENT_FLAGS,
  ML_P1_S6_FLAG_DEFAULTS,
  canEditPaymentSettings,
} from '@/lib/mlP1S6PaymentSettings';
import { createMlP1S6PaymentService } from '@/services/mlP1S6PaymentService';

/**
 * Settings › Billing & Payments — Payment & Invoicing flags (ML-P1 S6).
 * Runtime flips via global_config; writers read flags without redeploy.
 */
export default function BillingPaymentsSettings({ role: roleProp }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const service = useMemo(() => createMlP1S6PaymentService({ supabase }), []);
  const [flags, setFlags] = useState({ ...ML_P1_S6_FLAG_DEFAULTS });
  const [recon, setRecon] = useState([]);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState(roleProp || 'office');

  const canEdit = canEditPaymentSettings(role);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (roleProp) {
        setRole(roleProp);
      } else if (user?.id) {
        const { data } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled && data?.role) setRole(data.role);
      }
      try {
        const [f, q] = await Promise.all([
          service.getFlags(),
          service.listReconOpen().catch(() => []),
        ]);
        if (!cancelled) {
          setFlags({ ...ML_P1_S6_FLAG_DEFAULTS, ...f });
          setRecon(q);
        }
      } catch (err) {
        if (!cancelled) {
          toast({ variant: 'destructive', title: 'Could not load payment settings', description: err.message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, roleProp, service, toast]);

  const toggle = async (key, next) => {
    if (!canEdit) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'Office or admin role required.' });
      return;
    }
    if (key === 'invoice_auto_charge_enabled' && next === true) {
      toast({
        variant: 'destructive',
        title: 'Auto-charge blocked',
        description: 'Major Decision required. S6 keeps auto-charge OFF (writers deny).',
      });
      return;
    }
    setBusy(true);
    try {
      const updated = await service.setFlags({ [key]: next });
      setFlags({ ...ML_P1_S6_FLAG_DEFAULTS, ...updated });
      toast({ title: 'Saved', description: `${key} → ${next ? 'ON' : 'OFF'}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Billing & Payments</h2>
        <p className="text-sm text-slate-500">
          Payment & Invoicing flags (Slice 6). Changes apply at runtime — no redeploy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment & Invoicing</CardTitle>
          <CardDescription>
            Single Stripe account · Checkout capture · no card vault. Auto-charge stays OFF by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ML_P1_S6_PAYMENT_FLAGS.map((f) => {
            const on = Boolean(flags[f.key]);
            return (
              <div
                key={f.key}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={f.key} className="font-semibold cursor-pointer">
                      {f.label}
                    </Label>
                    {!f.defaultValue && (
                      <Badge variant="outline" className="text-[10px]">
                        Default OFF
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{f.description}</p>
                  <div className="text-[10px] font-mono text-slate-400">{f.key}</div>
                </div>
                <Switch
                  id={f.key}
                  checked={on}
                  disabled={!canEdit || busy}
                  onCheckedChange={(checked) => toggle(f.key, checked)}
                />
              </div>
            );
          })}
          {!canEdit && (
            <p className="text-xs text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Read-only for your role ({role}). Office/admin can edit.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation queue</CardTitle>
          <CardDescription>Open dispute / unmatched payment quarantines.</CardDescription>
        </CardHeader>
        <CardContent>
          {recon.length === 0 ? (
            <p className="text-sm text-slate-500">No open recon items.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recon.map((row) => (
                <li key={row.id} className="rounded border border-slate-200 px-3 py-2">
                  <div className="font-medium">{row.event_type}</div>
                  <div className="text-xs text-slate-500">{row.reason}</div>
                  <div className="text-[10px] font-mono text-slate-400">{row.provider_payment_id || row.id}</div>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setRecon(await service.listReconOpen());
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
