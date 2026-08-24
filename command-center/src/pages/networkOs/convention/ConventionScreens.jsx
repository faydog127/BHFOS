import React, { useEffect, useState } from 'react';
import { useConventionWorkspace } from './ConventionDemoLayout';
import {
  ConventionBanner,
  ConventionEmpty,
  ConventionError,
  demoRecordLabel,
} from './conventionUi';
import { DEMO_WRITE_ISOLATION_BLOCKED } from '@/lib/networkOs/conventionDemoPolicy';
import { CONVENTION_QR_PATH } from '@/lib/networkOs/conventionIntakePolicy';
import { buildConventionQrDataUrl } from '@/lib/networkOs/conventionQr';

function Section({ title, error, rows, empty, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {error ? <ConventionError error={error} /> : null}
      {!error && (!rows || rows.length === 0) ? (
        <ConventionEmpty>{empty}</ConventionEmpty>
      ) : null}
      {!error && rows && rows.length > 0 ? children : null}
    </section>
  );
}

function RecordTable({ headers, rows, renderRow }) {
  return (
    <div className="overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConventionAttentionPage() {
  const { workspace } = useConventionWorkspace();
  const [qrUrl, setQrUrl] = useState('');
  const qrTarget =
    typeof window !== 'undefined'
      ? `${window.location.origin}${CONVENTION_QR_PATH}`
      : CONVENTION_QR_PATH;

  useEffect(() => {
    let mounted = true;
    buildConventionQrDataUrl(
      typeof window !== 'undefined' ? window.location.origin : '',
    ).then((url) => {
      if (mounted) setQrUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const counts = [
    { label: 'Service needs', value: workspace.leads.rows.length },
    { label: 'Contacts', value: workspace.contacts.rows.length },
    { label: 'Organizations', value: workspace.organizations.rows.length },
    { label: 'Accounts', value: workspace.accounts.rows.length },
    { label: 'Properties', value: workspace.properties.rows.length },
    { label: 'Catalog items', value: workspace.catalog.rows.length },
    { label: 'Tasks', value: workspace.tasks.rows.length },
    { label: 'Events', value: workspace.events.rows.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Attention</h2>
        <p className="mt-1 text-sm text-slate-500">
          Data-backed convention shell using existing test records in the active
          session scope.
        </p>
      </div>
      <section className="flex flex-col gap-3 border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        {qrUrl ? (
          <img src={qrUrl} alt="Convention provider-interest QR code" className="h-40 w-40" />
        ) : (
          <div className="h-40 w-40 bg-slate-100" />
        )}
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-900">QR destination</p>
          <p className="break-all">{qrTarget}</p>
          <p className="mt-2">
            Public join collects interest only. Persistence stays blocked until an
            isolated intake object and RLS are proven.
          </p>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map((item) => (
          <div key={item.label} className="border border-slate-200 bg-white px-3 py-3">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="mt-1 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
      <Section
        title="Recent service needs"
        error={workspace.leads.error}
        rows={workspace.leads.rows.slice(0, 5)}
        empty="No test service-need records are available in this scope."
      >
        <RecordTable
          headers={['Need', 'Status', 'Stage']}
          rows={workspace.leads.rows.slice(0, 5)}
          renderRow={(row) => (
            <>
              <td className="px-3 py-2">{demoRecordLabel(row)}</td>
              <td className="px-3 py-2 text-slate-500">{row.status || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.pipeline_stage || '—'}</td>
            </>
          )}
        />
      </Section>
    </div>
  );
}

export function ConventionNeedsPage() {
  const { workspace, service } = useConventionWorkspace();
  const [writeResult, setWriteResult] = useState(null);

  const onCreate = async () => {
    const result = await service.createDemoLead(
      { company: 'Convention demo' },
      { sessionTenantId: workspace.tenant.tenantId, urlTenantId: null },
    );
    setWriteResult(result);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Service needs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Existing `leads` rows marked as test data. Customer records are not requested.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          Request demo insert
        </button>
      </div>
      {writeResult && !writeResult.ok && (
        <ConventionBanner tone="blocked">
          {writeResult.error?.message || DEMO_WRITE_ISOLATION_BLOCKED}
        </ConventionBanner>
      )}
      <Section
        title="Test needs"
        error={workspace.leads.error}
        rows={workspace.leads.rows}
        empty="No test leads were returned for the active tenant."
      >
        <RecordTable
          headers={['Need', 'Status', 'Source', 'Qualification']}
          rows={workspace.leads.rows}
          renderRow={(row) => (
            <>
              <td className="px-3 py-2">{demoRecordLabel(row)}</td>
              <td className="px-3 py-2 text-slate-500">{row.status || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.source || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.qualification_status || '—'}</td>
            </>
          )}
        />
      </Section>
    </div>
  );
}

export function ConventionContactsPage() {
  const { workspace } = useConventionWorkspace();
  const orgs = new Map(workspace.organizations.rows.map((row) => [row.id, row]));
  const accounts = new Map(workspace.accounts.rows.map((row) => [row.id, row]));
  const properties = new Map(workspace.properties.rows.map((row) => [row.id, row]));

  return (
    <Section
      title="Contacts"
      error={workspace.contacts.error}
      rows={workspace.contacts.rows}
      empty="No test contacts were returned for the active tenant."
    >
      <RecordTable
        headers={['Contact', 'Role', 'Organization type', 'Account type', 'Property']}
        rows={workspace.contacts.rows}
        renderRow={(row) => {
          const org = orgs.get(row.organization_id);
          const account = accounts.get(row.account_id);
          const property = properties.get(row.property_id);
          return (
            <>
              <td className="px-3 py-2">{demoRecordLabel(row)}</td>
              <td className="px-3 py-2 text-slate-500">{row.role || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{org?.type || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{account?.type || '—'}</td>
              <td className="px-3 py-2 text-slate-500">
                {property ? (property.is_active ? 'Active' : 'Inactive') : '—'}
              </td>
            </>
          );
        }}
      />
    </Section>
  );
}

export function ConventionCatalogPage() {
  const { workspace } = useConventionWorkspace();
  return (
    <div className="space-y-4">
      <Section
        title="Service catalog"
        error={workspace.catalog.error}
        rows={workspace.catalog.rows}
        empty="No active catalog items were returned."
      >
        <RecordTable
          headers={['Slug', 'Active']}
          rows={workspace.catalog.rows}
          renderRow={(row) => (
            <>
              <td className="px-3 py-2">{row.slug || row.id}</td>
              <td className="px-3 py-2 text-slate-500">{row.is_active ? 'Yes' : 'No'}</td>
            </>
          )}
        />
      </Section>
      <Section
        title="Open tasks for demo needs"
        error={workspace.tasks.error}
        rows={workspace.tasks.rows}
        empty="No tenant-scoped tasks are linked to the loaded test records."
      >
        <RecordTable
          headers={['Task', 'Status', 'Type', 'Priority']}
          rows={workspace.tasks.rows}
          renderRow={(row) => (
            <>
              <td className="px-3 py-2">{row.title || row.type || 'Task'}</td>
              <td className="px-3 py-2 text-slate-500">{row.status || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.type || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.priority || '—'}</td>
            </>
          )}
        />
      </Section>
      <Section
        title="Events for demo records"
        error={workspace.events.error}
        rows={workspace.events.rows}
        empty="No tenant-scoped events are linked to the loaded test records."
      >
        <RecordTable
          headers={['Entity', 'Event', 'Actor']}
          rows={workspace.events.rows}
          renderRow={(row) => (
            <>
              <td className="px-3 py-2">{row.entity_type || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.event_type || '—'}</td>
              <td className="px-3 py-2 text-slate-500">{row.actor_type || '—'}</td>
            </>
          )}
        />
      </Section>
    </div>
  );
}
