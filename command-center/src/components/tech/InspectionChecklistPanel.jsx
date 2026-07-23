import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const FLAG_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
  { value: 'make_safe', label: 'Make-safe' },
];

const flagTone = (code) => {
  if (code === 'safety' || code === 'make_safe') return 'bg-rose-50 text-rose-800 border-rose-200';
  if (code === 'quality') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

/**
 * ML-P1 S8 checklist responses with structured on/off/flag fields (PD-S8-03/05).
 */
export default function InspectionChecklistPanel({
  inspectionId,
  workType = null,
  locked = false,
  onFlagsChange = null,
}) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!inspectionId) return;
    setLoading(true);
    setError('');
    try {
      let list = await supabase
        .from('inspection_checklist_responses')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('sort_order', { ascending: true });
      if (list.error) throw list.error;

      if (!list.data?.length) {
        const seeded = await supabase.rpc('ml_p1_s8_seed_checklist_for_inspection', {
          p_inspection_id: inspectionId,
          p_work_type: workType || null,
        });
        if (seeded.error) throw seeded.error;
        list = await supabase
          .from('inspection_checklist_responses')
          .select('*')
          .eq('inspection_id', inspectionId)
          .order('sort_order', { ascending: true });
        if (list.error) throw list.error;
      }

      setRows(list.data || []);
      onFlagsChange?.(
        (list.data || []).filter((r) => r.flag_code && r.flag_code !== 'none'),
      );
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [inspectionId, workType, onFlagsChange]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (itemKey, patch) => {
    if (locked) return;
    setSavingKey(itemKey);
    setError('');
    try {
      const { data, error: rpcErr } = await supabase.rpc('ml_p1_s8_upsert_checklist_response', {
        p_inspection_id: inspectionId,
        p_item_key: itemKey,
        p_checked: patch.checked ?? null,
        p_flag_code: patch.flag_code ?? null,
        p_notes: patch.notes ?? null,
      });
      if (rpcErr) throw rpcErr;
      setRows((prev) => prev.map((row) => (row.item_key === itemKey ? { ...row, ...data } : row)));
      const next = (rows || []).map((row) => (row.item_key === itemKey ? { ...row, ...data } : row));
      onFlagsChange?.(next.filter((r) => r.flag_code && r.flag_code !== 'none'));
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading checklist…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm" data-testid="inspection-checklist-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Checklist
          {workType ? <Badge variant="outline">{workType}</Badge> : null}
        </CardTitle>
        <p className="text-xs text-slate-500">Structured on/off and safety/quality flags per work type.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No checklist items for this work type.</p>
        ) : (
          rows.map((row) => (
            <div key={row.item_key} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{row.item_label}</div>
                  {row.photo_required ? (
                    <div className="text-[11px] text-slate-500">Photo required for this item</div>
                  ) : null}
                </div>
                <Badge variant="outline" className={flagTone(row.flag_code)}>
                  {row.flag_code === 'safety' || row.flag_code === 'make_safe' ? (
                    <ShieldAlert className="h-3 w-3 mr-1 inline" />
                  ) : null}
                  {row.flag_code}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={row.checked === true ? 'default' : 'outline'}
                  disabled={locked || savingKey === row.item_key}
                  onClick={() => save(row.item_key, { checked: true })}
                >
                  On / Pass
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={row.checked === false ? 'default' : 'outline'}
                  disabled={locked || savingKey === row.item_key}
                  onClick={() => save(row.item_key, { checked: false })}
                >
                  Off / Fail
                </Button>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                  disabled={locked || savingKey === row.item_key}
                  value={row.flag_code || 'none'}
                  onChange={(e) => save(row.item_key, { flag_code: e.target.value })}
                  aria-label={`Flag for ${row.item_label}`}
                >
                  {FLAG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                rows={2}
                disabled={locked || savingKey === row.item_key}
                defaultValue={row.notes || ''}
                placeholder="Notes"
                onBlur={(e) => {
                  const next = e.target.value;
                  if (next !== (row.notes || '')) save(row.item_key, { notes: next });
                }}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
