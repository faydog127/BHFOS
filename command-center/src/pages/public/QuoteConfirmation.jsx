import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, XCircle, FileText, Home } from 'lucide-react';

const QuoteConfirmation = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const result = (params.get('quote_result') || '').toLowerCase();
  const quoteId = params.get('quote_id') || '';
  const token = params.get('token') || '';
  const tenantId = params.get('tenant_id') || '';
  const invoiceToken = params.get('invoice_token') || '';

  const approved = result === 'approved';
  const declined = result === 'declined';

  const title = approved ? 'Quote Approved' : declined ? 'Quote Declined' : 'Quote Updated';
  const message = approved
    ? 'Thank you. Your approval was recorded successfully. Our team will contact you within 1 business day.'
    : declined
      ? 'Your response was recorded as declined. If this was accidental, please contact us and we can reopen it.'
      : 'Your quote response was received.';

  const viewQuoteHref = token
    ? `/quotes/${token}${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}${quoteId ? `&quote_id=${encodeURIComponent(quoteId)}` : ''}` : quoteId ? `?quote_id=${encodeURIComponent(quoteId)}` : ''}`
    : '/';

  const icon = approved ? (
    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
  ) : declined ? (
    <XCircle className="h-10 w-10 text-red-600" />
  ) : (
    <FileText className="h-10 w-10 text-slate-600" />
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          {icon}
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        </div>

        <p className="mb-4 text-slate-700">{message}</p>

        {quoteId && (
          <p className="mb-6 text-sm text-slate-500">
            Reference ID: <span className="font-mono">{quoteId}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {token && (
            <Link
              to={viewQuoteHref}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <FileText className="mr-2 h-4 w-4" />
              View Quote
            </Link>
          )}

          {approved && invoiceToken && (
            <Link
              to={`/invoices/${invoiceToken}${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ''}`}
              className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Open Invoice
            </Link>
          )}

          <a
            href="/"
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default QuoteConfirmation;
