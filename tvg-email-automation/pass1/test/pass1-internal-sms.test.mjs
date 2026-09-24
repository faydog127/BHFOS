import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDestinationLabel,
  buildNotificationInsertSql,
  gateSmsTransport,
  planInternalSms,
  backlogSummaryBody,
  renderInternalSms,
  sanitizeSubject,
  stormSummaryBody,
} from '../lib/pass1-internal-sms.mjs';

const EVENT = '40000000-0000-4000-8000-000000000001';

function plan(overrides = {}) {
  return planInternalSms({
    status: 'awaiting_pass2',
    emailEventId: EVENT,
    senderName: 'Kelly Martin',
    senderEmail: 'kelly@example.com',
    subject: 'Dryer vent question',
    maxPerHour: 10,
    ordinarySent: 0,
    prioritySent: 0,
    suppressedOrdinary: 0,
    summarySent: false,
    suppressionWindow: '2026-09-24T13',
    existingKeys: new Set(),
    ...overrides,
  });
}

test('ordinary inbound text is deterministic and ends with no reply sent', () => {
  const text = renderInternalSms({
    status: 'awaiting_pass2',
    senderName: 'Kelly Martin',
    subject: 'Dryer vent question',
    body: 'SECRET BODY TEXT',
    phone: '415-555-1212',
    street: '9 Oak Lane',
  });
  assert.equal(text, [
    'TVG: New email — review',
    'From: Kelly Martin',
    'Subject: Dryer vent question',
    'No reply sent by automation.',
  ].join('\n'));
  assert.doesNotMatch(text, /SECRET BODY|415-555-1212|Oak Lane/);
});

test('sanitization strips urls, phones, streets, html, and caps the subject', () => {
  const raw = '  <b>Call</b> (415) 555-1212 at 123 Main Street https://evil.example/a and www.secret.test/x \u0001 now';
  const subject = sanitizeSubject(`${raw} ${'x'.repeat(80)}`);
  assert.equal(subject.length <= 60, true);
  assert.doesNotMatch(subject, /https?:\/\/|www\.|415|Main Street|<\s*b/i);
  const rendered = renderInternalSms({
    status: 'awaiting_pass2',
    senderName: 'Kelly <Martin>',
    senderEmail: 'not an email',
    subject: raw,
    formFields: { service: 'Dryer vent', city: 'Tampa', street: '9 Oak Lane' },
  });
  assert.match(rendered, /Form service: Dryer vent/);
  assert.match(rendered, /City: Tampa/);
  assert.doesNotMatch(rendered, /https?:\/\/|www\.|415|Main Street|Oak Lane|not an email/);
});

test('subject text does not change the send decision', () => {
  const calm = plan({ subject: 'Dryer vent question' });
  const noisy = plan({ subject: 'URGENT https://evil.example/job 555-0100 10 Oak Street' });
  assert.equal(calm.action, 'send');
  assert.equal(noisy.action, 'send');
  assert.equal(calm.kind, noisy.kind);
  assert.doesNotMatch(noisy.smsBody, /https?:\/\/|555-0100|Oak Street/);
});

test('immediate SMS is only for awaiting_pass2, held, and error', () => {
  for (const status of ['filtered', 'system_lessen', 'duplicate_ignored', 'received']) {
    const decision = plan({ status });
    assert.equal(decision.action, 'skip');
    assert.equal(decision.smsBody, null);
  }
  assert.equal(plan({ status: 'awaiting_pass2' }).kind, 'actionable_inbound');
  assert.equal(plan({ status: 'held', holdReason: 'form_auth_failure' }).kind, 'hold_alert');
  assert.match(plan({ status: 'held', holdReason: 'form_auth_failure' }).smsBody, /Email held — form_auth_failure/);
  assert.equal(plan({ status: 'error', errorCode: 'fetch_failed' }).kind, 'error_alert');
  assert.match(plan({ status: 'error', errorCode: 'fetch_failed' }).smsBody, /Email error — fetch_failed/);
  assert.equal(plan({ emailEventId: null }).action, 'skip');
});

test('webhook retry and reconcile rediscovery do not plan a second SMS', () => {
  const identity = `${EVENT}:actionable_inbound`;
  const decision = plan({ existingKeys: new Set([identity]) });
  assert.equal(decision.action, 'dedup');
  assert.equal(decision.smsBody, null);
  assert.equal(decision.summary, null);
});

test('at the hourly cap HOLD and error still surface, then suppress-with-log', () => {
  const ordinary = plan({ ordinarySent: 10, suppressedOrdinary: 0, summarySent: false });
  assert.equal(ordinary.action, 'suppress');
  assert.equal(ordinary.surface, 'suppress_with_log');
  assert.equal(ordinary.suppressionReason, 'storm_cap');
  assert.equal(ordinary.smsBody, null);
  const hold = plan({
    status: 'held',
    holdReason: 'phone_conflict',
    ordinarySent: 10,
    prioritySent: 0,
  });
  assert.equal(hold.action, 'send');
  assert.equal(hold.surface, 'prioritized_sms');
  assert.equal(hold.kind, 'hold_alert');
  assert.equal(hold.summary, null);
  assert.match(hold.smsBody, /Email held — phone_conflict/);
  const error = plan({
    status: 'error',
    errorCode: 'fetch_failed',
    ordinarySent: 10,
    prioritySent: 9,
  });
  assert.equal(error.surface, 'prioritized_sms');
  assert.equal(error.action, 'send');
  const holdCapped = plan({
    status: 'held',
    holdReason: 'form_auth_failure',
    ordinarySent: 10,
    prioritySent: 10,
  });
  assert.equal(holdCapped.action, 'suppress');
  assert.equal(holdCapped.surface, 'suppress_with_log');
  assert.equal(holdCapped.summary, null);
  assert.equal(holdCapped.smsBody, null);
  const errorCapped = plan({
    status: 'error',
    errorCode: 'fetch_failed',
    prioritySent: 10,
    ordinarySent: 0,
  });
  assert.equal(errorCapped.surface, 'suppress_with_log');
  assert.equal(errorCapped.summary, null);
});

test('storm summary count is the suppressed ordinary count and is written once', () => {
  const firstOverflow = plan({ ordinarySent: 10, suppressedOrdinary: 0, summarySent: false });
  assert.equal(firstOverflow.summary.suppressedCount, 1);
  assert.equal(firstOverflow.summary.smsBody, 'TVG: 1 additional new emails received — review queue.');
  const secondOverflow = plan({ ordinarySent: 10, suppressedOrdinary: 1, summarySent: true });
  assert.equal(secondOverflow.action, 'suppress');
  assert.equal(secondOverflow.summary, null);
  const amendmentExample = plan({ ordinarySent: 10, suppressedOrdinary: 11, summarySent: false });
  assert.equal(amendmentExample.summary.smsBody, stormSummaryBody(12));
  assert.equal(
    amendmentExample.summary.smsBody,
    'TVG: 12 additional new emails received — review queue.',
  );
  assert.equal(amendmentExample.summary.suppressedCount, 12);
  const repeated = plan({ ordinarySent: 10, suppressedOrdinary: 12, summarySent: true });
  assert.equal(repeated.summary, null);
});

test('before the live watermark there is no per-message SMS and one backlog summary', () => {
  const first = plan({
    liveNotificationStartedAt: null,
    backlogCount: 4,
    backlogSummarySent: false,
  });
  assert.equal(first.action, 'record_only');
  assert.equal(first.reason, 'before_watermark');
  assert.equal(first.smsBody, null);
  assert.equal(first.summary.smsBody, backlogSummaryBody(4));
  assert.equal(
    first.summary.smsBody,
    'TVG: 4 emails were already queued before live notifications — review backlog.',
  );
  const second = plan({
    liveNotificationStartedAt: null,
    backlogCount: 5,
    backlogSummarySent: true,
  });
  assert.equal(second.action, 'record_only');
  assert.equal(second.summary, null);
  const after = plan({
    liveNotificationStartedAt: '2026-09-24T12:00:00.000Z',
    eventCreatedAt: '2026-09-24T12:05:00.000Z',
  });
  assert.equal(after.action, 'send');
  assert.match(after.smsBody, /New email — review/);
  const older = plan({
    liveNotificationStartedAt: '2026-09-24T12:00:00.000Z',
    eventCreatedAt: '2026-09-24T11:00:00.000Z',
    backlogSummarySent: true,
  });
  assert.equal(older.action, 'record_only');
  assert.equal(older.smsBody, null);
  const missingCreated = plan({
    liveNotificationStartedAt: '2026-09-24T12:00:00.000Z',
    backlogSummarySent: true,
  });
  assert.equal(missingCreated.action, 'record_only');
  assert.equal(missingCreated.reason, 'before_watermark');
});

test('disabled transport records the event and does not claim a send', () => {
  const gated = gateSmsTransport(plan(), false);
  assert.equal(gated.action, 'record_only');
  assert.equal(gated.deliveryState, 'recorded_not_sent');
  assert.equal(gated.suppressionReason, 'credential_not_approved');
  const sql = buildNotificationInsertSql({
    action: gated.action,
    kind: gated.kind,
    emailEventId: EVENT,
    status: 'awaiting_pass2',
    deliveryState: gated.deliveryState,
    suppressionReason: gated.suppressionReason,
    smsText: gated.smsBody,
    destinationRef: 'founder_mobile_ref',
  });
  assert.match(sql, /recorded_not_sent/);
  assert.match(sql, /credential_not_approved/);
  assert.doesNotMatch(sql, /'queued'/);
  assert.throws(() => buildNotificationInsertSql({
    action: gated.action,
    kind: gated.kind,
    emailEventId: EVENT,
    status: 'awaiting_pass2',
    deliveryState: gated.deliveryState,
    destinationRef: 'founder_mobile_ref',
    body: 'SECRET BODY TEXT',
  }), /must not carry body/);
  assert.throws(() => assertDestinationLabel('4155551212'), /settings label/);
  assert.throws(() => assertDestinationLabel('+14155551212'), /settings label/);
});

test('notification SQL dedups on event and kind and omits body, phone, and street', () => {
  const smsText = renderInternalSms({
    status: 'awaiting_pass2',
    senderName: 'Kelly Martin',
    subject: 'Dryer vent question',
    body: 'SECRET BODY TEXT',
    phone: '415-555-1212',
    street: '9 Oak Lane',
  });
  const sql = buildNotificationInsertSql({
    action: 'record_only',
    kind: 'actionable_inbound',
    emailEventId: EVENT,
    status: 'awaiting_pass2',
    deliveryState: 'recorded_not_sent',
    suppressionReason: 'credential_not_approved',
    smsText,
    destinationRef: 'founder_mobile_ref',
  });
  assert.match(sql, /ON CONFLICT \(tenant_id, email_event_id, notification_kind\)/);
  assert.match(sql, /'tvg'/);
  assert.match(sql, /founder_mobile_ref/);
  assert.match(sql, /internal_sms/);
  assert.doesNotMatch(sql, /customer_sms|SECRET BODY TEXT|415-555-1212|Oak Lane/);
  const summary = buildNotificationInsertSql({
    action: 'record_only',
    kind: 'storm_summary',
    deliveryState: 'recorded_not_sent',
    suppressionWindow: '2026-09-24T13',
    status: 'storm',
    smsText: stormSummaryBody(12),
    destinationRef: 'founder_mobile_ref',
  });
  assert.match(summary, /WHERE notification_kind = 'storm_summary' DO NOTHING/);
  assert.match(summary, /12 additional new emails received/);
});
