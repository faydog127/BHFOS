import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILTER_FIELD_MAP,
  PSL_SUBSET_ID,
  applyFilterLists,
  assertStagingTarget,
  buildFastPathInsertSql,
  buildGapFillSql,
  buildOutcomeSql,
  computeIdentity,
  evaluateIntake,
  normalizeWebhookPointer,
  parseAuthResults,
  registrableDomain,
  sha256Hex,
} from '../lib/pass1-intake-logic.mjs';

const settings = {
  hold_on_form_auth_failure: true,
  open_lead_statuses: ['new', 'contacted', 'qualified', 'escalated'],
};

const lessenRows = [
  { kind: 'domain_deny', pattern: 'lessen.com', match_mode: 'domain', action: 'system_lessen', reason_code: 'vendor_lessen', enabled: true },
  { kind: 'noreply_pattern', pattern: 'noreply', match_mode: 'contains', action: 'deny', reason_code: 'noreply', enabled: true },
];

const authPass = 'spf=pass dkim=pass dmarc=pass';
const authFail = 'spf=fail dkim=pass dmarc=pass';

function message(overrides) {
  return {
    mailbox: 'info@vent-guys.com',
    from_raw: 'Customer <Customer@Example.com>',
    to_raw: 'info@vent-guys.com',
    subject: 'SYNTH Hello',
    date_header: 'Thu, 24 Sep 2026 12:00:00 +0000',
    bodyText: 'Hello from a synthetic fixture.\n',
    message_id: '<synth-pass1-f1@vent-guys.test>',
    authentication_results: authPass,
    ...overrides,
  };
}

test('sha256 known vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('F3 fallback hash is stable and excludes folder and uid', () => {
  const base = message({ message_id: null, bodyText: 'Same body\r\n' });
  const a = computeIdentity({ ...base, from_email: 'customer@example.com', to_email: 'info@vent-guys.com', mailbox_email: 'info@vent-guys.com', folder: 'INBOX', uid: '1' });
  const b = computeIdentity({ ...base, from_email: 'customer@example.com', to_email: 'info@vent-guys.com', mailbox_email: 'info@vent-guys.com', folder: 'INBOX.Spam', uid: '99' });
  assert.equal(a.fallback_hash, b.fallback_hash);
  assert.match(a.fallback_hash, /^v2:[0-9a-f]{64}$/);
  assert.equal(a.message_id, null);
});

test('F1 no CRM match still ends at awaiting_pass2', () => {
  const contactId = '10000000-0000-4000-8000-000000000001';
  const leadId = '20000000-0000-4000-8000-000000000001';
  const decision = evaluateIntake({
    message: message({}),
    filterRows: lessenRows,
    settings,
    contacts: [{ id: contactId, tenant_id: 'tvg', email: 'contact@example.com', phone: '555-0101' }],
    leads: [
      { id: leadId, tenant_id: 'tvg', contact_id: contactId, status: 'new' },
      { id: '20000000-0000-4000-8000-000000000002', tenant_id: 'tvg', contact_id: contactId, status: 'Customer' },
    ],
  });
  assert.equal(decision.event_status, 'awaiting_pass2');
  assert.equal(decision.queue_status, 'done');
  assert.equal(decision.contact_id, null);
  assert.equal(decision.resolved_recipient, 'customer@example.com');
});

test('F16 case-insensitive contact match', () => {
  const contactId = '10000000-0000-4000-8000-000000000001';
  const decision = evaluateIntake({
    message: message({ from_raw: 'Contact@Example.com' }),
    settings,
    contacts: [{ id: contactId, tenant_id: 'tvg', email: 'contact@example.com', phone: '' }],
    leads: [],
  });
  assert.equal(decision.contact_id, contactId);
  assert.equal(decision.event_status, 'awaiting_pass2');
});

test('F17 Customer status does not auto-link', () => {
  const contactId = '10000000-0000-4000-8000-000000000001';
  const decision = evaluateIntake({
    message: message({ from_raw: 'contact@example.com' }),
    settings,
    contacts: [{ id: contactId, tenant_id: 'tvg', email: 'contact@example.com', phone: '' }],
    leads: [{ id: '20000000-0000-4000-8000-000000000002', tenant_id: 'tvg', contact_id: contactId, status: 'Customer' }],
  });
  assert.equal(decision.contact_id, contactId);
  assert.equal(decision.lead_id, null);
});

test('F4c allowlisted form auth failure holds and is not filtered', () => {
  const decision = evaluateIntake({
    message: message({
      from_raw: 'noreply@vent-guys.test',
      authentication_results: authFail,
    }),
    filterRows: lessenRows,
    formSenders: [{ from_email: 'noreply@vent-guys.test', enabled: true, trust_reply_to: true }],
    settings,
  });
  assert.equal(decision.event_status, 'held');
  assert.equal(decision.hold_reason, 'form_auth_failure');
  assert.notEqual(decision.event_status, 'filtered');
});

test('F4b mailbox From is not a form when the allowlist is empty', () => {
  const decision = evaluateIntake({
    message: message({ from_raw: 'info@vent-guys.com', authentication_results: authFail }),
    filterRows: lessenRows,
    formSenders: [],
    settings,
  });
  assert.equal(decision.is_form_sender, false);
  assert.equal(decision.event_status, 'filtered');
  assert.equal(decision.filter_reason, 'self_mail');
  assert.notEqual(decision.hold_reason, 'form_auth_failure');
});

test('F4 trusted reply-to after allowlist and auth pass', () => {
  const decision = evaluateIntake({
    message: message({
      from_raw: 'forms@vent-guys.test',
      reply_to_raw: 'Customer <contact@example.com>',
      authentication_results: authPass,
    }),
    formSenders: [{ from_email: 'forms@vent-guys.test', enabled: true, trust_reply_to: true }],
    settings,
    contacts: [{ id: '10000000-0000-4000-8000-000000000001', tenant_id: 'tvg', email: 'contact@example.com', phone: '' }],
  });
  assert.equal(decision.recipient_resolution, 'reply_to_trusted_form');
  assert.equal(decision.contact_id, '10000000-0000-4000-8000-000000000001');
  assert.equal(decision.event_status, 'awaiting_pass2');
});

test('F5 lessen comes from filter rows, not a hard-coded list', () => {
  const withoutRows = evaluateIntake({
    message: message({ from_raw: 'vendor@lessen.com' }),
    filterRows: [],
    settings,
  });
  assert.notEqual(withoutRows.event_status, 'system_lessen');
  const withRows = evaluateIntake({
    message: message({ from_raw: 'vendor@lessen.com' }),
    filterRows: lessenRows,
    settings,
  });
  assert.equal(withRows.event_status, 'system_lessen');
  assert.equal(withRows.filter_reason, 'vendor_lessen');
});

test('F6 phone conflict holds when the phone owner email differs', () => {
  const decision = evaluateIntake({
    message: message({ from_raw: 'new@example.com', phone: '555-0101' }),
    settings,
    contacts: [{ id: '10000000-0000-4000-8000-000000000001', tenant_id: 'tvg', email: 'contact@example.com', phone: '555-0101' }],
  });
  assert.equal(decision.hold_reason, 'phone_conflict');
  assert.equal(decision.contact_id, null);
});

test('multiple phone hits hold because staging has no unique phone constraint', () => {
  const decision = evaluateIntake({
    message: message({ from_raw: 'contact@example.com', phone: '555-0101' }),
    settings,
    contacts: [
      { id: '10000000-0000-4000-8000-000000000001', tenant_id: 'tvg', email: 'a@example.com', phone: '555-0101' },
      { id: '10000000-0000-4000-8000-000000000003', tenant_id: 'tvg', email: 'b@example.com', phone: '(555) 0101' },
    ],
  });
  assert.equal(decision.hold_reason, 'phone_conflict');
});

test('F7 cross-tenant contact is not linked', () => {
  const decision = evaluateIntake({
    message: message({ from_raw: 'other@example.com' }),
    settings,
    contacts: [{ id: '10000000-0000-4000-8000-000000000002', tenant_id: 'other', email: 'other@example.com', phone: '' }],
  });
  assert.equal(decision.hold_reason, 'cross_tenant_match');
  assert.equal(decision.contact_id, null);
});

test('F12 cross-domain reply-to holds using the PSL subset', () => {
  assert.equal(registrableDomain('mail.example.co.uk'), 'example.co.uk');
  assert.equal(registrableDomain('foo.vent-guys.com'), 'vent-guys.com');
  assert.equal(PSL_SUBSET_ID, 'tvg-email-pass1-psl-subset-2026-09-24');
  const decision = evaluateIntake({
    message: message({
      from_raw: 'person@example.com',
      reply_to_raw: 'person@other.co.uk',
    }),
    settings,
  });
  assert.equal(decision.hold_reason, 'reply_to_domain_mismatch');
});

test('filter field map is explicit and noreply reads the From local-part', () => {
  assert.equal(FILTER_FIELD_MAP.noreply_pattern, 'From local-part');
  assert.equal(FILTER_FIELD_MAP.form_path, 'known_form_senders.from_email exact match on normalized From only');
  const filtered = applyFilterLists(
    { from_email: 'noreply@example.com', from_registrable: 'example.com' },
    lessenRows,
  );
  assert.equal(filtered.outcome, 'filtered');
  assert.equal(filtered.reason, 'noreply');
});

test('webhook pointer fails closed when fields are missing', () => {
  assert.equal(normalizeWebhookPointer({ mailboxResourceId: 'mbx', folder: 'INBOX' }).ok, false);
  const ok = normalizeWebhookPointer({
    mailboxResourceId: 'mbx_synth',
    folder: 'INBOX',
    uid: 42,
    mailbox: 'info@vent-guys.com',
    event: 'message.received',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.tenant_id, 'tvg');
  const sql = buildFastPathInsertSql(ok, { killSwitchEnabled: false });
  assert.match(sql, /deferred_kill_switch/);
  assert.doesNotMatch(sql, /hostinger\.com/i);
});

test('F15 gap fill is pointer SQL and refuses an incomplete item', () => {
  const sql = buildGapFillSql([{
    mailbox: 'info@vent-guys.com',
    mailboxResourceId: 'mbx_synth',
    folder: 'INBOX',
    uid: '77',
  }]);
  assert.match(sql, /ON CONFLICT \(tenant_id, mailbox_resource_id, folder, uid\)/);
  assert.doesNotMatch(sql, /https?:\/\//);
  assert.throws(() => buildGapFillSql([{ folder: 'INBOX' }]));
});

test('outcome SQL cannot name send tables', () => {
  const sql = buildOutcomeSql({
    queue_id: '30000000-0000-4000-8000-000000000001',
    event_status: 'awaiting_pass2',
    queue_status: 'done',
    message_id: 'synth-pass1-f1@vent-guys.test',
    fallback_hash: null,
    mailbox: 'info@vent-guys.com',
    mailbox_resource_id: 'mbx_synth',
    folder: 'INBOX',
    uid: '42',
    body_hash: 'ab'.repeat(32),
    spf_pass: true,
    dkim_pass: true,
    dmarc_pass: true,
  });
  assert.match(sql, /email_automation\.email_events/);
  assert.doesNotMatch(sql, /email_responses|email_send_queue/);
  assert.throws(() => buildOutcomeSql({
    queue_id: '30000000-0000-4000-8000-000000000001',
    event_status: 'sent',
    queue_status: 'done',
    message_id: 'x',
    body_hash: 'ab',
    mailbox: 'a@b.co',
    mailbox_resource_id: 'm',
    folder: 'INBOX',
    uid: '1',
  }));
});

test('staging guard refuses production', () => {
  assert.throws(() => assertStagingTarget({
    projectRef: 'wwyxohjnyqnegzbxtuxs',
    databaseUrl: 'postgres://db.wwyxohjnyqnegzbxtuxs.supabase.co/postgres',
  }));
  assert.throws(() => assertStagingTarget({
    projectRef: 'glkrykpksbsqmmilmjhs',
    databaseUrl: 'postgres://db.wwyxohjnyqnegzbxtuxs.supabase.co/postgres',
  }));
  assert.doesNotThrow(() => assertStagingTarget({
    projectRef: 'glkrykpksbsqmmilmjhs',
    databaseUrl: 'postgres://db.glkrykpksbsqmmilmjhs.supabase.co/postgres',
  }));
});

test('auth parser does not treat softfail as pass', () => {
  const parsed = parseAuthResults('spf=softfail dkim=pass dmarc=pass');
  assert.equal(parsed.all_pass, false);
});
