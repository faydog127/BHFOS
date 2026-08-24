import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { createNetworkOsConventionIntakeService } from '@/services/networkOsConventionIntakeService';
import { CONVENTION_INTAKE_DUPLICATE } from '@/lib/networkOs/conventionIntakePolicy';
import { ConventionBanner } from './conventionUi';

const REQUEST_KEY = 'nos-convention-intake-request-id';
const SUBMITTED_KEY = 'nos-convention-intake-submitted';
const TRADE_OPTIONS = ['HVAC', 'Plumbing', 'Electrical', 'Roofing', 'General contractor'];

function readOrCreateRequestId() {
  try {
    const existing = sessionStorage.getItem(REQUEST_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `join-${Date.now()}`;
    sessionStorage.setItem(REQUEST_KEY, next);
    return next;
  } catch {
    return `join-${Date.now()}`;
  }
}

function alreadySubmitted() {
  try {
    return sessionStorage.getItem(SUBMITTED_KEY) === '1';
  } catch {
    return false;
  }
}

function markSubmitted() {
  try {
    sessionStorage.setItem(SUBMITTED_KEY, '1');
  } catch {
    // ignore storage restrictions
  }
}

export default function ConventionJoinPage() {
  const navigate = useNavigate();
  const service = useMemo(
    () =>
      createNetworkOsConventionIntakeService({
        functionsBase: `${String(supabaseUrl || '').replace(/\/$/, '')}/functions/v1`,
        anonKey: supabaseAnonKey,
      }),
    [],
  );
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    trades: [],
    service_area: '',
    consent: false,
    honeypot: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (alreadySubmitted()) {
    return <Navigate to="/network-os/convention/join/thanks" replace />;
  }

  const onTrade = (trade) => {
    setForm((current) => {
      const next = current.trades.includes(trade)
        ? current.trades.filter((item) => item !== trade)
        : [...current.trades, trade];
      return { ...current, trades: next };
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setBanner(null);
    const result = await service.submitProviderInterest({
      ...form,
      client_request_id: readOrCreateRequestId(),
    });
    setSubmitting(false);
    if (result.error?.code === 'CONVENTION_INTAKE_VALIDATION') {
      const next = {};
      for (const item of result.error.errors || []) next[item.field] = item.message;
      setFieldErrors(next);
      return;
    }
    if (result.error?.code === CONVENTION_INTAKE_DUPLICATE || result.confirmation?.received) {
      markSubmitted();
      navigate('/network-os/convention/join/thanks', { replace: true });
      return;
    }
    setBanner(result.error?.message || 'The request could not be completed.');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Network OS</p>
          <h1 className="text-xl font-semibold">Provider interest</h1>
          <p className="mt-1 text-sm text-slate-500">
            Convention QR destination. BHIS will contact you about network participation.
          </p>
        </div>
        {banner ? <ConventionBanner tone="blocked">{banner}</ConventionBanner> : null}
        <form onSubmit={onSubmit} className="space-y-4 border border-slate-200 bg-white p-4">
          <label className="block text-sm">
            Name
            <input
              className="mt-1 w-full border border-slate-300 px-3 py-2"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              autoComplete="name"
            />
            {fieldErrors.name ? <span className="text-xs text-red-700">{fieldErrors.name}</span> : null}
          </label>
          <label className="block text-sm">
            Company
            <input
              className="mt-1 w-full border border-slate-300 px-3 py-2"
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              autoComplete="organization"
            />
            {fieldErrors.company ? (
              <span className="text-xs text-red-700">{fieldErrors.company}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            Email
            <input
              className="mt-1 w-full border border-slate-300 px-3 py-2"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              inputMode="email"
            />
            {fieldErrors.email ? <span className="text-xs text-red-700">{fieldErrors.email}</span> : null}
          </label>
          <label className="block text-sm">
            Phone
            <input
              className="mt-1 w-full border border-slate-300 px-3 py-2"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              autoComplete="tel"
              inputMode="tel"
            />
            {fieldErrors.phone ? <span className="text-xs text-red-700">{fieldErrors.phone}</span> : null}
          </label>
          <fieldset className="text-sm">
            <legend>Trades / services</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TRADE_OPTIONS.map((trade) => (
                <label key={trade} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.trades.includes(trade)}
                    onChange={() => onTrade(trade)}
                  />
                  {trade}
                </label>
              ))}
            </div>
            {fieldErrors.trades ? (
              <span className="text-xs text-red-700">{fieldErrors.trades}</span>
            ) : null}
          </fieldset>
          <label className="block text-sm">
            Service area
            <input
              className="mt-1 w-full border border-slate-300 px-3 py-2"
              value={form.service_area}
              onChange={(event) => setForm({ ...form, service_area: event.target.value })}
            />
            {fieldErrors.service_area ? (
              <span className="text-xs text-red-700">{fieldErrors.service_area}</span>
            ) : null}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) => setForm({ ...form, consent: event.target.checked })}
            />
            <span>I consent to BHIS contacting me about network participation.</span>
          </label>
          {fieldErrors.consent ? (
            <span className="text-xs text-red-700">{fieldErrors.consent}</span>
          ) : null}
          <div aria-hidden="true" className="hidden">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.honeypot}
                onChange={(event) => setForm({ ...form, honeypot: event.target.value })}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {submitting ? 'Submitting…' : 'Submit interest'}
          </button>
        </form>
      </div>
    </div>
  );
}
