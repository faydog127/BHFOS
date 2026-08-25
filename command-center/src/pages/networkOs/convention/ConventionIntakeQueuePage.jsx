import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { createNetworkOsConventionIntakeService } from '@/services/networkOsConventionIntakeService';
import { INTAKE_QUEUE_STATUSES } from '@/lib/networkOs/conventionIntakePolicy';
import { ConventionBanner, ConventionEmpty, ConventionLoading } from './conventionUi';

export default function ConventionIntakeQueuePage() {
  const { session } = useSupabaseAuth();
  const service = useMemo(
    () => createNetworkOsConventionIntakeService({ supabase }),
    [],
  );
  const [queue, setQueue] = useState({ ok: false, rows: [], error: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const next = await service.listIntakeQueue({ session });
    setQueue(next);
    setLoading(false);
  }, [service, session]);

  useEffect(() => {
    load();
  }, [load]);

  const onStatus = async (id, status) => {
    const result = await service.updateIntakeStatus({ session }, id, status);
    if (result.ok) await load();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <h2 className="text-base font-semibold">Onboarding intake</h2>
        {queue.error ? (
          <ConventionBanner tone="blocked">{queue.error.message}</ConventionBanner>
        ) : (
          <p className="text-sm text-slate-500">
            HUGE 2026 convention QR interest. Status only. No CRM conversion from this queue.
          </p>
        )}
        {loading ? <ConventionLoading label="Loading intake…" /> : null}
        {!loading && queue.ok && queue.rows.length === 0 ? (
          <ConventionEmpty>No convention intake rows are visible.</ConventionEmpty>
        ) : null}
        {!loading && queue.ok && queue.rows.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Area</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Update</th>
                </tr>
              </thead>
              <tbody>
                {queue.rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.company_name}</td>
                    <td className="px-3 py-2">{row.display_name}</td>
                    <td className="px-3 py-2">
                      {row.email}
                      <div className="text-xs text-slate-500">{row.phone_digits}</div>
                    </td>
                    <td className="px-3 py-2">{row.service_area}</td>
                    <td className="px-3 py-2">{row.onboarding_status}</td>
                    <td className="px-3 py-2">
                      <select
                        className="border border-slate-300 px-2 py-1"
                        value=""
                        onChange={(event) => {
                          if (event.target.value) onStatus(row.id, event.target.value);
                        }}
                      >
                        <option value="">Set status</option>
                        {INTAKE_QUEUE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
