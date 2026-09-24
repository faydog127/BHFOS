/**
 * TVG Email Pass 1 internal SMS notification service.
 * Event → this service → delivery channel. Pass 1 channel is internal SMS.
 * Twilio is not called from here. SMS transport is not the system of record.
 */
import { quoteLiteral } from './pass1-intake-logic.mjs';

export const SMS_SUBJECT_MAX = 60;
export const DEFAULT_MAX_INTERNAL_SMS_PER_HOUR = 10;
export const DESTINATION_REF = 'founder_mobile_ref';

const SEND_STATES = new Set(['queued', 'attempted', 'sent', 'delivered', 'recorded_not_sent']);
const KINDS = new Set([
  'actionable_inbound',
  'hold_alert',
  'error_alert',
  'storm_summary',
  'backlog_summary',
  'health_outage',
  'health_recovery',
]);
const REASONS = /^[a-z0-9_]+$/;

const STATUS_KIND = {
  awaiting_pass2: { kind: 'actionable_inbound', priority: false },
  held: { kind: 'hold_alert', priority: true },
  error: { kind: 'error_alert', priority: true },
};

function collapseWhitespace(text) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/(?:^|[^\w])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g, ' ')
    .replace(/\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeSubject(raw) {
  const text = collapseWhitespace(raw);
  if (text.length <= SMS_SUBJECT_MAX) return text;
  return text.slice(0, SMS_SUBJECT_MAX).trim();
}

function sanitizeDisplay(raw, max) {
  return collapseWhitespace(raw).slice(0, max).trim();
}

function sanitizeEmail(raw) {
  const text = collapseWhitespace(raw).toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(text)) return '';
  return text;
}

function sanitizeCity(raw) {
  const text = collapseWhitespace(raw);
  if (!/^[A-Za-z][A-Za-z .'-]{0,39}$/.test(text)) return '';
  return text;
}

function formValue(formFields, key) {
  if (!formFields || typeof formFields !== 'object') return '';
  return formFields[key];
}

export function renderInternalSms(event) {
  const spec = STATUS_KIND[event.status];
  if (!spec) throw new Error('status is not an internal SMS event');
  let headline = 'TVG: New email — review';
  if (event.status === 'held') {
    const reason = REASONS.test(event.holdReason || '') ? event.holdReason : 'held';
    headline = `TVG: Email held — ${reason}`;
  } else if (event.status === 'error') {
    const code = REASONS.test(event.errorCode || '') ? event.errorCode : 'error';
    headline = `TVG: Email error — ${code}`;
  }
  const lines = [headline];
  const name = sanitizeDisplay(event.senderName, 60);
  const email = sanitizeEmail(event.senderEmail);
  const from = [name, email].filter(Boolean).join(' ');
  if (from) lines.push(`From: ${from}`);
  const subject = sanitizeSubject(event.subject);
  if (subject) lines.push(`Subject: ${subject}`);
  const service = sanitizeDisplay(formValue(event.formFields, 'service'), 40);
  if (service) lines.push(`Form service: ${service}`);
  const city = sanitizeCity(formValue(event.formFields, 'city'));
  if (city) lines.push(`City: ${city}`);
  lines.push('No reply sent by automation.');
  return lines.join('\n');
}

export function stormSummaryBody(suppressedCount) {
  const count = Number(suppressedCount);
  if (!Number.isInteger(count) || count < 1) throw new Error('summary count must be a positive integer');
  return `TVG: ${count} additional new emails received — review queue.`;
}

export function backlogSummaryBody(backlogCount) {
  const count = Number(backlogCount);
  if (!Number.isInteger(count) || count < 1) throw new Error('backlog count must be a positive integer');
  return `TVG: ${count} emails were already queued before live notifications — review backlog.`;
}

function requireEventUuid(value) {
  const text = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error('expected uuid');
  }
  return text.toLowerCase();
}

/**
 * Exact behavior once ordinary traffic is already at maxPerHour (default 10)
 * for the UTC hour:
 * - further awaiting_pass2 rows are suppress-with-log (storm_cap) plus one
 *   storm summary for that window;
 * - a held or error row still surfaces as one prioritized SMS while the
 *   priority counter is below the same cap. It is not folded into the summary;
 * - once the priority counter is also at the cap, further HOLD/error rows are
 *   suppress-with-log. The log row remains. No second summary is created.
 */
export function planInternalSms(input) {
  const spec = STATUS_KIND[input.status];
  if (!spec) return { action: 'skip', reason: 'not_immediate', smsBody: null, summary: null };
  if (!input.emailEventId) return { action: 'skip', reason: 'no_canonical_event', smsBody: null, summary: null };
  const emailEventId = requireEventUuid(input.emailEventId);
  const identity = `${emailEventId}:${spec.kind}`;
  if (input.existingKeys && input.existingKeys.has(identity)) {
    return { action: 'dedup', kind: spec.kind, emailEventId, identity, smsBody: null, summary: null };
  }
  if (Object.prototype.hasOwnProperty.call(input, 'liveNotificationStartedAt')) {
    const started = input.liveNotificationStartedAt;
    const created = input.eventCreatedAt ? new Date(input.eventCreatedAt) : null;
    const preLive = started == null
      || created == null
      || Number.isNaN(created.getTime())
      || created < new Date(started);
    if (preLive) {
      let backlog = null;
      if (!input.backlogSummarySent) {
        backlog = {
          kind: 'backlog_summary',
          smsBody: backlogSummaryBody(input.backlogCount || 1),
          suppressedCount: input.backlogCount || 1,
        };
      }
      return {
        action: 'record_only',
        reason: 'before_watermark',
        kind: spec.kind,
        priority: spec.priority,
        surface: 'backlog',
        emailEventId,
        identity,
        suppressionReason: 'before_watermark',
        summary: backlog,
        smsBody: null,
      };
    }
  }
  const max = input.maxPerHour ?? DEFAULT_MAX_INTERNAL_SMS_PER_HOUR;
  const ordinarySent = input.ordinarySent ?? 0;
  const prioritySent = input.prioritySent ?? 0;
  let action = 'send';
  let suppressionReason = null;
  let summary = null;
  let surface = spec.priority ? 'prioritized_sms' : 'sms';
  if (spec.priority) {
    if (prioritySent >= max) {
      action = 'suppress';
      suppressionReason = 'storm_cap';
      surface = 'suppress_with_log';
    }
  } else if (ordinarySent >= max) {
    action = 'suppress';
    suppressionReason = 'storm_cap';
    surface = 'suppress_with_log';
    if (!input.summarySent) {
      const count = (input.suppressedOrdinary ?? 0) + 1;
      summary = {
        kind: 'storm_summary',
        smsBody: stormSummaryBody(count),
        suppressedCount: count,
        suppressionWindow: input.suppressionWindow || null,
      };
    }
  }
  return {
    action,
    kind: spec.kind,
    priority: spec.priority,
    surface,
    emailEventId,
    identity,
    suppressionReason,
    summary,
    smsBody: action === 'send' ? renderInternalSms(input) : null,
  };
}

/** Settings label only. A phone number is rejected. */
export function assertDestinationLabel(value) {
  const text = String(value || '').trim();
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(text)) {
    throw new Error('destination ref must be the Founder-approved settings label');
  }
  return text;
}

export function gateSmsTransport(decision, smsEnabled) {
  if (smsEnabled) return decision;
  const gated = { ...decision, transport: 'not_connected' };
  if (decision.action === 'send') {
    gated.action = 'record_only';
    gated.deliveryState = 'recorded_not_sent';
    gated.suppressionReason = 'credential_not_approved';
  }
  if (decision.summary) {
    gated.summary = { ...decision.summary, deliveryState: 'recorded_not_sent' };
  }
  return gated;
}

function deliveryStateFor(action, explicit) {
  if (explicit) return explicit;
  if (action === 'send') return 'queued';
  if (action === 'suppress') return 'suppressed';
  if (action === 'record_only') return 'recorded_not_sent';
  throw new Error('no delivery state');
}

function assertSafeSmsText(text) {
  const value = String(text);
  if (value.length > 480) throw new Error('sms text too long');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('sms text has control characters');
  if (/https?:\/\/|www\./i.test(value)) throw new Error('sms text has a url');
  if (/(?:^|[^\w])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/.test(value)) {
    throw new Error('sms text has a phone number');
  }
  if (/\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i.test(value)) {
    throw new Error('sms text has a street address');
  }
  return value;
}

function conflictClause(kind) {
  if (kind === 'storm_summary') {
    return `ON CONFLICT (tenant_id, channel, suppression_window, notification_kind)
       WHERE notification_kind = 'storm_summary' DO NOTHING`;
  }
  if (kind === 'backlog_summary') {
    return `ON CONFLICT (tenant_id, channel, notification_kind)
       WHERE notification_kind = 'backlog_summary' DO NOTHING`;
  }
  if (kind === 'health_outage' || kind === 'health_recovery') {
    return `ON CONFLICT (tenant_id, suppression_window)
       WHERE notification_kind = '${kind}' DO NOTHING`;
  }
  return `ON CONFLICT (tenant_id, email_event_id, notification_kind)
       WHERE email_event_id IS NOT NULL DO NOTHING`;
}

export function buildNotificationInsertSql(row) {
  if (!KINDS.has(row.kind)) throw new Error('bad notification kind');
  for (const key of ['body', 'bodyText', 'phone', 'street', 'streetAddress']) {
    if (row[key]) throw new Error(`notification row must not carry ${key}`);
  }
  const deliveryState = deliveryStateFor(row.action, row.deliveryState);
  if (!SEND_STATES.has(deliveryState) && deliveryState !== 'suppressed') {
    throw new Error('bad delivery state');
  }
  if ((row.kind === 'storm_summary' || row.kind === 'health_outage' || row.kind === 'health_recovery')
    && !row.suppressionWindow) {
    throw new Error('suppression window required');
  }
  const destinationRef = assertDestinationLabel(row.destinationRef);
  const emailSql = row.emailEventId ? `${quoteLiteral(requireEventUuid(row.emailEventId))}::uuid` : 'NULL';
  const payload = {
    status: row.status || null,
    hold_reason: row.holdReason && REASONS.test(row.holdReason) ? row.holdReason : null,
    error_code: row.errorCode && REASONS.test(row.errorCode) ? row.errorCode : null,
  };
  if (row.smsText) payload.sms_text = assertSafeSmsText(row.smsText);
  const conflict = conflictClause(row.kind);
  const suppressionState = row.action === 'suppress' ? 'suppressed' : null;
  return `
INSERT INTO email_automation.notification_log (
  tenant_id, kind, notification_kind, channel, email_event_id, destination_ref,
  payload_summary, status, delivery_state, suppression_state, suppression_reason,
  suppression_window, attempted_at
) VALUES (
  'tvg',
  ${quoteLiteral(row.kind)}::email_automation.notification_kind,
  ${quoteLiteral(row.kind)},
  'internal_sms',
  ${emailSql},
  ${quoteLiteral(destinationRef)},
  ${quoteLiteral(JSON.stringify(payload))}::jsonb,
  ${quoteLiteral(deliveryState)},
  ${quoteLiteral(deliveryState)},
  ${suppressionState ? quoteLiteral(suppressionState) : 'NULL'},
  ${row.suppressionReason ? quoteLiteral(row.suppressionReason) : 'NULL'},
  ${row.suppressionWindow ? quoteLiteral(row.suppressionWindow) : 'NULL'},
  now()
)
${conflict}
RETURNING id;
`.trim();
}
