import React from 'react';
import { Button } from '@/components/ui/button';
import { BRAND_ASSETS } from '@/lib/brandConfig';

const BRAND = {
  navy: '#173861',
  navyDark: '#102945',
  navySoft: '#EDF3FA',
  red: '#B1221C',
  gold: '#C8A24A',
  ink: '#0F172A',
  slate: '#475569',
};

const QUOTE_DOCUMENT_PRINT_STYLES = `
  @page {
    size: Letter;
    margin: 0;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      background: #ffffff !important;
    }

    .quote-doc-shell {
      display: block !important;
      background: #ffffff !important;
      padding: 0 !important;
      gap: 0 !important;
    }

    .quote-doc-page {
      width: 8.5in !important;
      height: 11in !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      overflow: hidden !important;
      break-after: page;
      page-break-after: always;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .quote-doc-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .quote-doc-controls {
      display: none !important;
    }

    .quote-doc-screen-approval {
      display: none !important;
    }

    .quote-doc-print-approval {
      display: block !important;
    }

    .quote-doc-main {
      min-height: 0 !important;
      overflow: hidden !important;
    }

    .quote-doc-elevation {
      box-shadow: none !important;
    }
  }
`;

const toneClasses = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
};

const pageStyle = {
  width: '8.5in',
  height: '11in',
  boxSizing: 'border-box',
};

const imgFit = {
  objectFit: 'contain',
};

function CredentialRow({ compact = false, monochrome = false, align = 'start' }) {
  const badges = [
    { src: BRAND_ASSETS.badge_nadca_url, alt: 'NADCA Certified', className: compact ? 'h-7' : 'h-10' },
    { src: BRAND_ASSETS.badge_sdv_osb_url, alt: 'SDVOSB Certified', className: compact ? 'h-8' : 'h-12' },
    { src: BRAND_ASSETS.badge_clean_air_cert_url, alt: 'Clean Air Certified', className: compact ? 'h-7' : 'h-10' },
  ].filter((badge) => badge.src);

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {badges.map((badge) => (
        <img
          key={badge.alt}
          src={badge.src}
          alt={badge.alt}
          className={`${badge.className} w-auto ${monochrome ? 'grayscale' : ''}`}
          style={imgFit}
        />
      ))}
    </div>
  );
}

function ScanBlock({ model }) {
  const entries = [
    ['Quote #', model.payload.document_number],
    ['Job ID', model.payload.job_id],
    ['Property', model.display.propertyName],
    ['Valid Through', model.display.validThroughLabel],
  ];

  if (model.payload.po_number) {
    entries.push(['PO Number', model.payload.po_number]);
  }

  return (
    <div className="quote-doc-elevation rounded-[20px] border border-slate-200 bg-white px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: BRAND.red }}>Quote Snapshot</p>
          <p className="mt-1 text-[13px] text-slate-600">Scope, property, and commercial details at a glance.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Total Investment</p>
          <p className="mt-1 text-[1.65rem] font-black tracking-tight text-slate-950">{model.formatCurrency(model.priceSummary.total)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {entries.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteriorHeader({ model, pageNumber, pageCount }) {
  return (
    <div className="quote-doc-elevation rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-1 rounded-full"
            style={{ background: `linear-gradient(180deg, ${BRAND.red} 0%, ${BRAND.gold} 100%)` }}
          />
          <img src={BRAND_ASSETS.logo_url} alt="The Vent Guys" className="h-14 w-auto" style={imgFit} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND.red }}>{model.display.documentTypeLabel}</p>
            <p className="text-sm font-semibold text-slate-900">{model.payload.document_number}</p>
          </div>
        </div>

        <div className="text-right text-sm text-slate-600">
          <div>{model.payload.job_id}</div>
          <div>{model.display.propertyName}</div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Page {pageNumber} of {pageCount}</div>
        </div>
      </div>
    </div>
  );
}

function FirstHeader({ model }) {
  return (
    <div className="quote-doc-elevation relative h-full overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div
        className="absolute inset-x-0 top-0 h-12"
        style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.navyDark} 76%)` }}
      />
      {BRAND_ASSETS.logo_primary_seal_url ? (
        <img
          src={BRAND_ASSETS.logo_primary_seal_url}
          alt=""
          aria-hidden="true"
          className="absolute right-6 top-3 h-24 w-24 opacity-[0.08]"
          style={imgFit}
        />
      ) : null}
      <div className="relative grid h-full grid-cols-[1.1fr_0.9fr] gap-4 px-4 pb-3.5 pt-3">
        <div className="flex h-full flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-2xl bg-white/98 px-3.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
              <img src={BRAND_ASSETS.logo_url} alt="The Vent Guys" className="h-[66px] w-auto" style={imgFit} />
              <div className="mt-1.5 border-t border-slate-200/90 pt-1.5 text-[10px] leading-[1.35] text-slate-700">
                <p className="font-semibold uppercase tracking-[0.14em]" style={{ color: BRAND.red }}>
                  TVG Contact
                </p>
                <p className="mt-1 font-semibold text-slate-900">{model.display.tvgContactName}</p>
                {model.display.tvgContactTitle ? <p className="text-slate-500">{model.display.tvgContactTitle}</p> : null}
                <p className="mt-1">
                  {model.display.tvgContactEmail}
                  {model.display.tvgContactPhone ? ` | ${model.display.tvgContactPhone}` : ''}
                </p>
                <p className="text-slate-500">{model.display.tvgContactWebsite}</p>
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses[model.display.statusTone] || toneClasses.info}`}>
              {model.display.statusLabel}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">The Vent Guys</p>
            <h1 className="text-[2rem] font-black leading-none tracking-tight text-slate-950">Service Quote</h1>
            <p className="max-w-2xl text-[12.5px] leading-5 text-slate-700">
              Clear scope, locked pricing, and a document your customer, property manager, or accounting team can process without follow-up.
            </p>
          </div>

          <div className="space-y-1">
            <CredentialRow compact />
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              NADCA Certified • SDVOSB • We Clear What Others Miss
            </div>
          </div>
        </div>

        <div className="pt-1">
          <ScanBlock model={model} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, rightText }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p> : null}
        <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-950">{title}</h2>
      </div>
      {rightText ? <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{rightText}</div> : null}
    </div>
  );
}

function ClientPropertySection({ model }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Prepared For" title="Client and Property" />
      <div className="grid grid-cols-2 gap-5 text-sm">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Prepared For</p>
          <p className="font-semibold text-slate-900">{model.display.customerName}</p>
          {model.display.customerEmail ? <p className="text-slate-600">{model.display.customerEmail}</p> : null}
          {model.display.customerPhone ? <p className="text-slate-600">{model.display.customerPhone}</p> : null}
          {model.payload.company_name ? <p className="text-slate-600">{model.payload.company_name}</p> : null}
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Service Location</p>
          <p className="font-semibold text-slate-900">{model.display.propertyName}</p>
          <p className="text-slate-600">{model.display.serviceAddress}</p>
          {model.payload.unit_reference ? <p className="text-slate-600">Units: {model.payload.unit_reference}</p> : null}
          {model.payload.batch_reference ? <p className="text-slate-600">Batch: {model.payload.batch_reference}</p> : null}
        </div>
      </div>
    </section>
  );
}

function ScopeSnapshotSection({ model, fragment }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Committed Scope" title={model.payload.service_summary || 'Approved Service Scope'} />
      <p className="max-w-none text-sm leading-5 text-slate-700">{fragment?.text || model.payload.scope_snapshot_text}</p>
      {fragment?.helperText || model.display.headerText ? (
        <p className="mt-2 border-l-2 border-slate-300 pl-3 text-sm italic leading-5 text-slate-600">{fragment?.helperText || model.display.headerText}</p>
      ) : null}
    </section>
  );
}

function PricingTableSection({ model, items, continued = false }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle
        eyebrow={continued ? 'Pricing (continued)' : 'Pricing'}
        title={continued ? 'Approved Line Items' : 'Quoted Services'}
        rightText={continued ? 'Continued' : null}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Qty</th>
              <th className="px-4 py-2.5 text-right">Unit</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200 bg-white">
                <td className="px-4 py-2.5 align-top font-medium text-slate-900">{item.description}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{item.quantity}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{model.formatCurrency(item.unit_price)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{model.formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IncludedExcludedSection({ model, fragment, continued = false }) {
  const includedItems = fragment?.includedItems || model.payload.included_items;
  const excludedItems = fragment?.excludedItems || model.payload.excluded_items;
  const hasIncluded = includedItems.length > 0;
  const hasExcluded = excludedItems.length > 0;
  const isSingleColumn = hasIncluded !== hasExcluded;
  const sectionTitle = hasIncluded && hasExcluded ? 'Included vs Not Included' : hasIncluded ? 'Included' : 'Not Included';

  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle
        eyebrow={continued ? 'Scope Boundaries (continued)' : 'Scope Boundaries'}
        title={sectionTitle}
        rightText={continued ? 'Continued' : null}
      />
      <div className={`grid gap-5 text-sm ${isSingleColumn ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {hasIncluded ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Included</p>
            <ul className="space-y-1.5 text-slate-700">
              {includedItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasExcluded ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Not Included</p>
            <ul className="space-y-1.5 text-slate-700">
              {excludedItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ServiceNotesSection({ model }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Batch & Processing" title="Service Notes" />
      <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
        {model.payload.batch_reference ? <p><span className="font-semibold text-slate-900">Batch:</span> {model.payload.batch_reference}</p> : null}
        {model.payload.unit_reference ? <p><span className="font-semibold text-slate-900">Units:</span> {model.payload.unit_reference}</p> : null}
        {model.payload.po_number ? <p><span className="font-semibold text-slate-900">PO:</span> {model.payload.po_number}</p> : null}
        {model.payload.accounting_contact ? <p><span className="font-semibold text-slate-900">AP Contact:</span> {model.payload.accounting_contact}</p> : null}
      </div>
    </section>
  );
}

function AssumptionsSection({ model, text, continued = false }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle
        eyebrow={continued ? 'Assumptions (continued)' : 'Assumptions'}
        title="What This Pricing Assumes"
        rightText={continued ? 'Continued' : null}
      />
      <p className="text-sm leading-5 text-slate-700">{text || model.payload.assumptions_text}</p>
    </section>
  );
}

function ExclusionsSection({ model, text, continued = false }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle
        eyebrow={continued ? 'Exclusions (continued)' : 'Exclusions'}
        title="What Triggers a Change Order"
        rightText={continued ? 'Continued' : null}
      />
      <p className="text-sm leading-5 text-slate-700">{text || model.payload.exclusions_text}</p>
    </section>
  );
}

function ValiditySection({ model }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Quote Validity" title="Timing and Acceptance Window" />
      <div className="grid grid-cols-2 gap-5 text-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Issue Date</p>
          <p className="mt-1 font-semibold text-slate-900">{model.display.issueDateLabel}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Valid Through</p>
          <p className="mt-1 font-semibold text-slate-900">{model.display.validThroughLabel}</p>
        </div>
      </div>
    </section>
  );
}

function TotalsSection({ model }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Investment Summary" title="Quote Totals" />
      <div className="ml-auto max-w-[16rem] space-y-1.5">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{model.priceSummary.subtotalLabel}</span>
          <span>{model.formatCurrency(model.priceSummary.subtotal)}</span>
        </div>
        {Number(model.priceSummary.taxAmount || 0) > 0 ? (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>{model.priceSummary.taxLabel}</span>
            <span>{model.formatCurrency(model.priceSummary.taxAmount)}</span>
          </div>
        ) : null}
        <div
          className="flex items-center justify-between rounded-[18px] border px-3 py-1.5 text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.navyDark} 100%)`, borderColor: BRAND.gold }}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">Total Investment</span>
          <span className="text-[1.35rem] font-black leading-none">{model.formatCurrency(model.priceSummary.total)}</span>
        </div>
      </div>
    </section>
  );
}

function PaymentTermsSection({ model }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Scheduling & Payment" title="What Happens Next" />
      <div className="space-y-1 text-[13.5px] leading-5 text-slate-700">
        <p>{model.payload.payment_terms}</p>
        <p>{model.payload.payment_instructions}</p>
      </div>
    </section>
  );
}

function ApprovalSection({ model, isFinal, approving, onOpenApproval, onDecline, printMode }) {
  return (
    <section className="border-b border-slate-200 pb-4">
      <SectionTitle eyebrow="Approval" title="Approve to Schedule Service" />
      <div className="quote-doc-elevation rounded-[20px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-slate-900">Approve this quote to lock scope, pricing, and scheduling.</p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-600">
              Changes after approval require a formal change order tied to this quote version.
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: BRAND.red }}>
              Approved Version {model.payload.approved_version}
            </p>
          </div>

          {!isFinal ? (
            <div className="quote-doc-screen-approval flex flex-wrap gap-2">
              <Button
                className="text-white hover:opacity-95"
                style={{ background: BRAND.navy }}
                onClick={onOpenApproval}
                disabled={approving}
              >
                {approving ? 'Processing...' : 'Approve to Schedule'}
              </Button>
              <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={onDecline} disabled={approving}>
                Decline Quote
              </Button>
            </div>
          ) : null}
        </div>

        <div className={`quote-doc-print-approval ${printMode ? 'block' : 'hidden'} mt-2.5`}>
          <div className="grid grid-cols-2 gap-5 pt-1.5 text-sm text-slate-700">
            <div className="border-t border-slate-400 pt-2">Authorized Signature</div>
            <div className="border-t border-slate-400 pt-2">Date</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DisputeSection({ model }) {
  return (
    <section>
      <p className="text-xs leading-5 text-slate-500">{model.payload.dispute_protection_line}</p>
      {model.display.footerText ? <p className="mt-2 text-xs leading-5 text-slate-500">{model.display.footerText}</p> : null}
    </section>
  );
}

function Footer({ pageNumber, pageCount, compact = false }) {
  return (
    <div className="flex h-full flex-col justify-end border-t border-slate-200 pt-2">
      <div className={`flex items-end justify-between gap-4 text-[11px] text-slate-500 ${compact ? 'pt-1' : ''}`}>
        <div className="space-y-0.5">
          <div className="font-semibold uppercase tracking-[0.16em] text-slate-700">The Vent Guys</div>
          {compact ? (
            <div>Titusville, FL | vent-guys.com</div>
          ) : (
            <>
              <div>2987 Finsterwald Dr | Titusville, FL 32780</div>
              <div className="font-semibold uppercase tracking-[0.14em] text-slate-600">
                NADCA Certified • SDVOSB • IAQ Focused
              </div>
            </>
          )}
        </div>

        <div className="space-y-1 text-right">
          {!compact ? <CredentialRow compact monochrome={false} align="end" /> : null}
          <div className="font-semibold uppercase tracking-[0.14em]">Page {pageNumber} of {pageCount}</div>
        </div>
      </div>
    </div>
  );
}

function PageContent({ page, model, isFinal, approving, onOpenApproval, onDecline, printMode, debugLayout = false }) {
  return (
    <div className="space-y-3">
      {(page.blocks || page.sections || []).map((section, index) => {
        const entry =
          typeof section === 'string'
            ? { key: section, continued: false, fragment: null }
            : {
                key: section?.key,
                continued: Boolean(section?.continued),
                fragment: section?.fragment || null,
                estimatedHeightPx: section?.estimatedHeightPx,
                blockType: section?.type || null,
              };

        const sectionBody = (() => {
          switch (entry.key) {
            case 'client_property':
              return <ClientPropertySection key={`${entry.key}-${index}`} model={model} />;
            case 'scope_snapshot':
              return <ScopeSnapshotSection key={`${entry.key}-${index}`} model={model} fragment={entry.fragment} />;
            case 'pricing_table':
              return (
                <PricingTableSection
                  key={`${entry.key}-${index}`}
                  model={model}
                  items={entry.fragment?.items || page.pricingItems || model.payload.line_items}
                  continued={entry.continued}
                />
              );
            case 'included_excluded':
              return (
                <IncludedExcludedSection
                  key={`${entry.key}-${index}`}
                  model={model}
                  fragment={entry.fragment}
                  continued={entry.continued}
                />
              );
            case 'service_notes':
              return <ServiceNotesSection key={`${entry.key}-${index}`} model={model} />;
            case 'assumptions':
              return (
                <AssumptionsSection
                  key={`${entry.key}-${index}`}
                  model={model}
                  text={entry.fragment?.text}
                  continued={entry.continued}
                />
              );
            case 'exclusions':
              return (
                <ExclusionsSection
                  key={`${entry.key}-${index}`}
                  model={model}
                  text={entry.fragment?.text}
                  continued={entry.continued}
                />
              );
            case 'validity_window':
              return <ValiditySection key={`${entry.key}-${index}`} model={model} />;
            case 'totals':
              return <TotalsSection key={`${entry.key}-${index}`} model={model} />;
            case 'payment_terms':
              return <PaymentTermsSection key={`${entry.key}-${index}`} model={model} />;
            case 'approval':
              return (
                <ApprovalSection
                  key={`${entry.key}-${index}`}
                  model={model}
                  isFinal={isFinal}
                  approving={approving}
                  onOpenApproval={onOpenApproval}
                  onDecline={onDecline}
                  printMode={printMode}
                />
              );
            case 'dispute_protection':
              return <DisputeSection key={`${entry.key}-${index}`} model={model} />;
            default:
              return null;
          }
        })();

        if (!sectionBody) return null;

        return (
          <div key={`${entry.key}-${index}`} data-block-key={entry.key} data-block-height={entry.estimatedHeightPx || undefined}>
            {debugLayout && entry.estimatedHeightPx ? (
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fuchsia-600">
                {entry.key} · {Math.round(entry.estimatedHeightPx)}px
              </div>
            ) : null}
            {sectionBody}
          </div>
        );
      })}
    </div>
  );
}

export default function QuoteDocument({
  documentModel,
  isFinal,
  approving,
  onOpenApproval,
  onDecline,
  printMode = false,
  debugLayout = false,
}) {
  const pageCount = documentModel.pagePlan.pages.length;
  const geometry = documentModel.pagePlan.geometry;

  return (
    <>
      <style>{QUOTE_DOCUMENT_PRINT_STYLES}</style>

      <div className="quote-doc-shell flex flex-col items-center gap-6 bg-slate-100 px-4 py-8 print:bg-white print:px-0 print:py-0">
        {documentModel.pagePlan.pages.map((page, index) => {
          const pageNumber = index + 1;
          const isFirst = page.master === 'first';

          return (
            <section
              key={`quote-page-${pageNumber}`}
              className="quote-doc-page relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] print:rounded-none print:border-none print:shadow-none"
              style={pageStyle}
            >
              {debugLayout ? (
                <>
                  <div
                    className="pointer-events-none absolute border border-dashed border-sky-300"
                    style={{
                      top: `${geometry.paddingTopPx}px`,
                      left: `${geometry.paddingXPx}px`,
                      right: `${geometry.paddingXPx}px`,
                      height: `${page.geometry.headerHeightPx}px`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute border border-dashed border-emerald-300"
                    style={{
                      top: `${page.geometry.bodyTopPx}px`,
                      left: `${geometry.paddingXPx}px`,
                      right: `${geometry.paddingXPx}px`,
                      height: `${page.geometry.bodyHeightPx}px`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute border border-dashed border-rose-300"
                    style={{
                      top: `${page.geometry.bodyBottomPx}px`,
                      left: `${geometry.paddingXPx}px`,
                      right: `${geometry.paddingXPx}px`,
                      height: `${page.geometry.footerHeightPx}px`,
                    }}
                  />
                  <div className="pointer-events-none absolute right-3 top-3 rounded bg-slate-900/85 px-2 py-1 text-[10px] text-white">
                    {page.master} · used {Math.round(page.layoutDebug?.usedHeightPx || 0)}px · remaining {Math.round(page.layoutDebug?.remainingHeightPx || 0)}px
                  </div>
                </>
              ) : null}
              <header
                className={isFirst ? 'absolute pb-3' : 'absolute pb-2'}
                style={{
                  top: `${geometry.paddingTopPx}px`,
                  left: `${geometry.paddingXPx}px`,
                  right: `${geometry.paddingXPx}px`,
                  height: `${page.geometry.headerHeightPx}px`,
                }}
              >
                  {isFirst ? <FirstHeader model={documentModel} /> : <InteriorHeader model={documentModel} pageNumber={pageNumber} pageCount={pageCount} />}
              </header>

              <main
                className="quote-doc-main absolute overflow-hidden"
                style={{
                  top: `${page.geometry.bodyTopPx}px`,
                  left: `${geometry.paddingXPx}px`,
                  right: `${geometry.paddingXPx}px`,
                  height: `${page.geometry.bodyHeightPx}px`,
                }}
              >
                  <PageContent
                    page={page}
                    model={documentModel}
                    isFinal={isFinal}
                    approving={approving}
                    onOpenApproval={onOpenApproval}
                    onDecline={onDecline}
                    printMode={printMode}
                    debugLayout={debugLayout}
                  />
              </main>

              <footer
                className="absolute"
                style={{
                  top: `${page.geometry.bodyBottomPx}px`,
                  left: `${geometry.paddingXPx}px`,
                  right: `${geometry.paddingXPx}px`,
                  height: `${page.geometry.footerHeightPx}px`,
                }}
              >
                  <Footer pageNumber={pageNumber} pageCount={pageCount} compact={!isFirst} />
              </footer>
            </section>
          );
        })}
      </div>
    </>
  );
}
