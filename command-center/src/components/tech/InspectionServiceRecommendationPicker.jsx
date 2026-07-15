import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const DEFAULT_OPTIONS = [
  {
    title: 'Full Dryer Vent Cleaning',
    description: 'Complete a full cleaning from the dryer connection through the rooftop termination. Remove accumulated lint and debris, inspect the exterior termination, and verify airflow after service.',
  },
  {
    title: 'Air Duct Cleaning',
    description: 'Clean accessible supply and return duct runs documented during the inspection. Remove accumulated debris where reachable and verify system airflow after service.',
  },
  {
    title: 'Targeted Corrective Service',
    description: 'Correct the conditions documented in this inspection. Confirm access, remove debris or obstructions, and verify the affected area after service.',
  },
  {
    title: 'No Immediate Service Recommended',
    description: 'No immediate corrective service is recommended based on the conditions documented during this inspection. Continue routine maintenance as appropriate.',
  },
];

/**
 * Technician phone picker for exactly one inspection-level Service Recommendation.
 * Persists finding_id = null, customer-visible, no pricing.
 */
export default function InspectionServiceRecommendationPicker({
  tenantId,
  inspectionId,
  recommendations = [],
  locked = false,
  onChanged,
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const selected = useMemo(
    () => (recommendations || []).find((row) => row?.finding_id == null && row?.is_customer_visible !== false) || null,
    [recommendations],
  );

  const selectOption = async ({ title, description }) => {
    if (!inspectionId || locked || busy) return;
    const nextTitle = asText(title);
    const nextDescription = asText(description);
    if (!nextTitle) {
      toast({ variant: 'destructive', title: 'Title required', description: 'Choose or enter a recommendation title.' });
      return;
    }

    setBusy(true);
    try {
      // Demote any prior inspection-level customer-visible recommendations.
      const priorIds = (recommendations || [])
        .filter((row) => row?.finding_id == null && row?.is_customer_visible !== false)
        .map((row) => row.id)
        .filter(Boolean);

      if (priorIds.length) {
        const { error: hideError } = await supabase
          .from('inspection_recommendations')
          .update({ is_customer_visible: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId)
          .in('id', priorIds);
        if (hideError) throw hideError;
      }

      const existingSame = (recommendations || []).find(
        (row) => row?.finding_id == null && asText(row?.title).toLowerCase() === nextTitle.toLowerCase(),
      );

      if (existingSame?.id) {
        const { error } = await supabase
          .from('inspection_recommendations')
          .update({
            title: nextTitle,
            description: nextDescription || null,
            is_customer_visible: true,
            finding_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('id', existingSame.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inspection_recommendations')
          .insert({
            tenant_id: tenantId,
            inspection_id: inspectionId,
            title: nextTitle,
            description: nextDescription || null,
            priority: 'normal',
            is_customer_visible: true,
            finding_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      toast({ title: 'Recommendation selected', description: 'Saved for the customer report. Pricing stays in Estimates.' });
      await onChanged?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not save recommendation',
        description: error?.message || 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const saveEditedExplanation = async () => {
    if (!selected?.id || locked || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('inspection_recommendations')
        .update({
          description: asText(customDescription) || selected.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', selected.id);
      if (error) throw error;
      toast({ title: 'Explanation updated' });
      await onChanged?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error?.message || 'Could not update explanation.',
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setCustomDescription(asText(selected?.description));
    setCustomTitle(asText(selected?.title));
  }, [selected?.id, selected?.description, selected?.title]);

  return (
    <Card id="inspection-recommendations" className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Service Recommendation</CardTitle>
        <p className="text-xs text-slate-500">
          Select one recommendation for the customer report. Pricing and authorization stay in Estimates.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {selected ? (
          <div
            id={`inspection-recommendation-${selected.id}`}
            data-recommendation-id={selected.id}
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600">Selected</Badge>
              <span className="font-semibold text-slate-900">{selected.title}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{selected.description || 'No explanation yet.'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Choose one Service Recommendation to continue.
          </div>
        )}

        <div className="space-y-2">
          {DEFAULT_OPTIONS.map((option) => {
            const isActive = asText(selected?.title).toLowerCase() === option.title.toLowerCase();
            return (
              <button
                key={option.title}
                type="button"
                disabled={locked || busy}
                onClick={() => selectOption(option)}
                className={`w-full rounded-xl border p-3 text-left min-h-11 ${isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-start gap-2">
                  {isActive ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" /> : null}
                  <div>
                    <div className="font-semibold text-slate-900">{option.title}</div>
                    <p className="mt-1 text-xs text-slate-600">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Label>Custom recommendation</Label>
          <Input
            className="min-h-11"
            value={customTitle}
            onChange={(event) => setCustomTitle(event.target.value)}
            placeholder="Recommendation title"
            disabled={locked || busy}
          />
          <Textarea
            className="min-h-24"
            value={customDescription}
            onChange={(event) => setCustomDescription(event.target.value)}
            placeholder="Short explanation for the customer"
            disabled={locked || busy}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="min-h-11 bg-blue-600 hover:bg-blue-700"
              disabled={locked || busy}
              onClick={() => selectOption({ title: customTitle || selected?.title, description: customDescription })}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save selection
            </Button>
            {selected ? (
              <Button type="button" variant="outline" className="min-h-11" disabled={locked || busy} onClick={saveEditedExplanation}>
                Update explanation
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
