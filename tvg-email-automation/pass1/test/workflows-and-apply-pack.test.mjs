import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const workflowFiles = [
  'n8n/tvg-email-intake-fast-ack.json',
  'n8n/tvg-email-intake-worker.json',
  'n8n/tvg-email-intake-reconcile.json',
  'n8n/tvg-email-daily-filtered-digest.json',
  'n8n/tvg-email-notification-dispatcher.json',
  'n8n/tvg-email-health-heartbeat.json',
];

function load(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('workflows stay inactive and do not enable schedules or send', () => {
  for (const relativePath of workflowFiles) {
    const workflow = JSON.parse(load(relativePath));
    assert.equal(workflow.active, false, relativePath);
    assert.equal(workflow.meta.tvgEmailPass1.hostinger, 'OFF');
    assert.equal(workflow.meta.tvgEmailPass1.projectRef, 'glkrykpksbsqmmilmjhs');
    const serialized = JSON.stringify(workflow);
    assert.doesNotMatch(serialized, /n8n-nodes-base\.(emailSend|slack|httpRequest)/);
    assert.doesNotMatch(serialized, /api\.mail\.hostinger\.com|developers\.hostinger\.com/);
    for (const node of workflow.nodes) {
      const query = node.parameters?.query || '';
      assert.doesNotMatch(query, /email_responses|email_send_queue/);
    }
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.scheduleTrigger') {
        assert.equal(node.disabled, true, `${relativePath}:${node.name}`);
      }
    }
  }
});

test('fast ACK code has no Hostinger fetch and worker claims synthetic rows only', () => {
  const fast = JSON.parse(load('n8n/tvg-email-intake-fast-ack.json'));
  assert.equal(fast.nodes.some((node) => node.type === 'n8n-nodes-base.httpRequest'), false);
  const prepare = fast.nodes.find((node) => node.name === 'Prepare intake');
  assert.match(prepare.parameters.jsCode, /normalizeWebhookPointer/);
  assert.doesNotMatch(prepare.parameters.jsCode, /fetch\(/);
  const worker = JSON.parse(load('n8n/tvg-email-intake-worker.json'));
  const claim = worker.nodes.find((node) => node.name === 'Claim synthetic');
  assert.match(claim.parameters.query, /FOR UPDATE SKIP LOCKED/);
  assert.match(claim.parameters.query, /synthetic_message/);
  assert.equal(worker.nodes.some((node) => node.type === 'n8n-nodes-base.scheduleTrigger'), false);
});

test('reconcile names the inactive schedule and resume SQL', () => {
  const reconcile = JSON.parse(load('n8n/tvg-email-intake-reconcile.json'));
  const schedule = reconcile.nodes.find((node) => node.name === 'Schedule disabled');
  assert.equal(schedule.disabled, true);
  const resume = reconcile.nodes.find((node) => node.name === 'Resume deferred');
  assert.match(resume.parameters.query, /deferred_kill_switch/);
  assert.match(resume.parameters.query, /intake_processing_enabled/);
  const stale = reconcile.nodes.find((node) => node.name === 'Stale to HOLD');
  assert.match(stale.parameters.query, /stale_processing/);
  assert.doesNotMatch(stale.parameters.query, /status = 'pending'/);
});

test('apply pack follows bootstrap order and preserves the claims table', () => {
  const sql = load('apply/20260924_tvg_email_pass1_v5.sql');
  const design = load('design/02-email-automation-schema.sql');
  const marker = '-- -----------------------------------------------------------------------------\n-- 1) Extensions';
  assert.ok(sql.includes(design.slice(design.indexOf(marker)).trim()));
  const steps = [
    '-- 1) Extensions',
    '-- 2) Schemas',
    '-- 3) Roles',
    '-- 4) Enums',
    '-- 5) Tables',
    '-- 6) Foreign keys',
    '-- 7) Indexes',
    '-- 8) Functions + triggers',
    '-- 9) RLS ENABLE',
    '-- 10) Policies',
    '-- 11) REVOKE / GRANT',
    '-- 12) Seeds / settings',
  ];
  let cursor = 0;
  for (const step of steps) {
    const at = sql.indexOf(step, cursor);
    assert.ok(at > cursor, `missing or out of order: ${step}`);
    cursor = at;
  }
  assert.match(sql, /glkrykpksbsqmmilmjhs/);
  assert.match(sql, /wwyxohjnyqnegzbxtuxs/);
  assert.doesNotMatch(sql, /DROP TABLE[^;]*network_os_assurance_delivery_claims/i);
  assert.doesNotMatch(sql, /ALTER TABLE public\.network_os_assurance_delivery_claims/i);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*email_responses/i);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*email_send_queue/i);
  assert.match(sql, /claim_intake_batch/);
  assert.match(sql, /n8n_contacts_tvg_select/);
  assert.match(sql, /n8n_leads_tvg_select/);
  assert.match(sql, /uq_notification_log_event_kind/);
  assert.match(sql, /max_internal_sms_per_hour/);
  assert.match(sql, /internal_sms_enabled/);
  assert.match(sql, /founder_mobile_ref/);
  assert.doesNotMatch(sql, /AC[0-9a-f]{32}/i);
  assert.doesNotMatch(sql, /authToken|AUTH_TOKEN|TWILIO_AUTH/);
});

test('workflows are staging-named, one-way, and outbox-only', () => {
  for (const relativePath of workflowFiles) {
    const workflow = JSON.parse(load(relativePath));
    assert.equal(workflow.name.startsWith('[STAGING] '), true, relativePath);
    assert.equal(workflow.name.includes('[PROD]'), false, relativePath);
    assert.equal(workflow.meta.tvgEmailPass1.credentialScope, 'staging-only');
    const blob = JSON.stringify(workflow);
    assert.equal(blob.includes('wwyxohjnyqnegzbxtuxs') && blob.includes('prod credential'), false);
    assert.equal(workflow.nodes.some((node) => /inbound|smsTrigger|command/i.test(node.type)), false);
  }
  const worker = JSON.parse(load('n8n/tvg-email-intake-worker.json'));
  assert.equal(worker.nodes.some((node) => node.type === 'n8n-nodes-base.twilio'), false);
  assert.match(worker.nodes.find((node) => node.name === 'Load SMS budget').parameters.query, /live_notification_started_at/);
  const plan = worker.nodes.find((node) => node.name === 'Plan internal SMS');
  assert.match(plan.parameters.jsCode, /kind: summaryKind/);
  assert.match(plan.parameters.jsCode, /backlog_summary/);
  assert.doesNotMatch(JSON.stringify(worker), /needs response/);
  assert.doesNotMatch(JSON.stringify(worker), /The Vent Guys Team|draft review|urgencyKeywords|after_hours_ack/);
  assert.match(JSON.stringify(worker), /No reply sent by automation/);
  const health = JSON.parse(load('n8n/tvg-email-health-heartbeat.json'));
  assert.equal(health.nodes.some((node) => node.type === 'n8n-nodes-base.twilio'), false);
  assert.equal(health.nodes.some((node) => node.type === 'n8n-nodes-base.httpRequest'), false);
  assert.equal(health.meta.tvgEmailPass1.hostingerMailboxProbe, 'dormant');
  assert.equal(health.meta.tvgEmailPass1.hostingerApiHealth, 'not-a-live-check');
  const healthQuery = health.nodes.find((node) => node.name === 'Load health').parameters.query;
  assert.match(healthQuery, /last_successful_health_at/);
  assert.match(healthQuery, /'dormant'::text AS mailbox_probe/);
  assert.match(healthQuery, /NULL::integer AS newer_mail_count/);
  assert.doesNotMatch(healthQuery, /api\.mail\.hostinger|developers\.hostinger/);
  const healthPlan = health.nodes.find((node) => node.name === 'Plan health').parameters.jsCode;
  assert.match(healthPlan, /mailboxProbeLive: false/);
  assert.match(plan.parameters.jsCode, /liveNotificationStartedAt: budget\.live_notification_started_at \?\? null/);
});

test('internal SMS path stays inactive and has no live Twilio secret', () => {
  const delivery = JSON.parse(load('n8n/tvg-email-notification-dispatcher.json'));
  assert.equal(delivery.active, false);
  assert.equal(delivery.meta.tvgEmailPass1.smsTransportIsNotSoR, true);
  const twilio = delivery.nodes.filter((node) => node.type === 'n8n-nodes-base.twilio');
  assert.equal(twilio.length, 1);
  assert.equal(twilio[0].disabled, true);
  assert.equal(twilio[0].name, 'Twilio send disabled');
  assert.equal(twilio[0].credentials.twilioApi.name, 'TVG Internal SMS Twilio');
  assert.equal(twilio[0].parameters.to, '={{ $json.destination_ref }}');
  assert.equal(twilio[0].parameters.from, '={{ $json.sms_from_credential_only }}');
  assert.equal(JSON.stringify(delivery.connections).includes('Twilio'), false);
  const blob = JSON.stringify(delivery);
  assert.doesNotMatch(blob, /AC[0-9a-f]{32}/i);
  assert.doesNotMatch(blob, /authToken|auth_token|AccountSid/i);
  assert.doesNotMatch(blob, /FOUNDER_APPROVED_MOBILE|INTERNAL_ALERT_FROM|\+1\d{10}|\b\d{3}-\d{3}-\d{4}\b/);
  assert.match(blob, /internal_sms_destination_ref/);
  const guard = delivery.nodes.find((node) => node.name === 'Credential guard');
  assert.match(guard.parameters.jsCode, /INTERNAL_SMS_CREDENTIAL_NOT_APPROVED/);
  const worker = JSON.parse(load('n8n/tvg-email-intake-worker.json'));
  assert.equal(worker.nodes.some((node) => node.type === 'n8n-nodes-base.twilio'), false);
  const plan = worker.nodes.find((node) => node.name === 'Plan internal SMS');
  const footer = plan.parameters.jsCode.split('// SMS_PLAN_FOOTER')[1];
  assert.ok(footer);
  assert.doesNotMatch(footer, /bodyText|body_text|synthetic\.phone|\.street/);
  const evaluate = worker.nodes.find((node) => node.name === 'Evaluate');
  const displaySlice = evaluate.parameters.jsCode.slice(evaluate.parameters.jsCode.lastIndexOf('const formFields'));
  assert.doesNotMatch(displaySlice, /bodyText|body_text|\.phone|\.street/);
  const digest = JSON.parse(load('n8n/tvg-email-daily-filtered-digest.json'));
  const record = digest.nodes.find((node) => node.name === 'Record suppressed digest');
  assert.match(record.parameters.query, /internal_digest/);
  assert.match(record.parameters.query, /daily_filtered_digest/);
});

test('challenge notes keep the decision register, dormant mailbox probe, and role password out of git', () => {
  const register = load('decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md');
  const packet = load('apply/STAGING_RETURN_PACKET.md');
  const directive = load('directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md');
  assert.match(register, /TVG Email Automation Decision Register/);
  assert.match(directive, /PASS 1 STAGING BUILD PROCEED/);
  const addendum = load('directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md');
  assert.match(addendum, /FOUNDER OPERATOR-PREFERENCE DECISIONS/);
  assert.match(addendum, /OPEN — FOUNDER DECISION REQUIRED LATER/);
  assert.match(register, /CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24\.md/);
  assert.match(load('INDEX.md'), /decision-register\/TVG_EMAIL_AUTOMATION_DECISION_REGISTER\.md/);
  const statuses = {
    'TVG-EMAIL-P1-D001': 'Implementation-authorized',
    'TVG-EMAIL-P1-D002': 'Implementation-authorized',
    'TVG-EMAIL-P1-D003': 'Active',
    'TVG-EMAIL-P1-D004': 'Active',
    'TVG-EMAIL-P1-D005': 'Active',
    'TVG-EMAIL-P1-D006': 'Active',
    'TVG-EMAIL-P1-D007': 'Active',
    'TVG-EMAIL-P1-D008': 'Active',
    'TVG-EMAIL-P1-D009': 'Active',
    'TVG-EMAIL-P1-D010': 'Active',
    'TVG-EMAIL-P1-D011': 'Active',
    'TVG-EMAIL-P1-D012': 'Active',
    'TVG-EMAIL-P1-D013': 'Proposed',
    'TVG-EMAIL-P1-D014': 'Recommendation',
    'TVG-EMAIL-P1-D015': 'Recommendation',
    'TVG-EMAIL-P1-D016': 'Implementation-authorized',
    'TVG-EMAIL-P1-D017': 'Active',
    'TVG-EMAIL-P1-D018': 'Active',
    'TVG-EMAIL-P1-D019': 'Active',
    'TVG-EMAIL-P1-D020': 'Proposed',
    'TVG-EMAIL-P1-D021': 'Active',
    'TVG-EMAIL-P1-D022': 'Active',
    'TVG-EMAIL-P1-D023': 'Active',
    'TVG-EMAIL-P1-D024': 'Recommendation',
    'TVG-EMAIL-P1-D025': 'Recommendation',
    'TVG-EMAIL-P1-D026': 'Recommendation',
    'TVG-EMAIL-P1-D027': 'Recommendation',
    'TVG-EMAIL-P1-D028': 'Open / Proposed',
  };
  for (const [id, status] of Object.entries(statuses)) {
    const row = register.split('\n').find((line) => line.includes(`| ${id} |`));
    assert.ok(row, id);
    assert.match(row, new RegExp(`\\| ${status} \\|`), id);
  }
  assert.match(packet, /decision-register\/TVG_EMAIL_AUTOMATION_DECISION_REGISTER\.md/);
  assert.match(packet, /n8n_email_automation/);
  assert.match(packet, /password was not set/);
  assert.match(load('PRE_WEBHOOK_OPEN_ITEMS.md'), /not staging blockers/);
  const scanned = [
    ...workflowFiles,
    'apply/20260924_tvg_email_pass1_v5.sql',
    'apply/20260924_tvg_email_pass1_incremental.sql',
  ];
  for (const relativePath of scanned) {
    const text = load(relativePath);
    assert.doesNotMatch(text, /PASSWORD/i, relativePath);
    assert.doesNotMatch(text, /"password"\s*:/, relativePath);
  }
});

test('incremental SQL does not re-bootstrap the base pack', () => {
  const sql = load('apply/20260924_tvg_email_pass1_incremental.sql');
  assert.match(sql, /base pass1 pack is not present/);
  assert.match(sql, /in_reply_to/);
  assert.match(sql, /references_header/);
  assert.match(sql, /health_checks/);
  assert.match(sql, /live_notification_started_at/);
  assert.match(sql, /dispatch_after/);
  assert.match(sql, /notification_subscriptions/);
  assert.match(sql, /configuration_audit/);
  assert.match(sql, /escalation_after IS NULL/);
  assert.match(sql, /founder_mobile_ref/);
  assert.match(sql, /after_hours_ack_enabled/);
  assert.doesNotMatch(sql, /The Vent Guys Team/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS email_automation\.email_events/);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*email_responses/i);
});

test('fast ACK and worker code nodes parse', () => {
  for (const relativePath of workflowFiles) {
    const workflow = JSON.parse(load(relativePath));
    for (const node of workflow.nodes) {
      if (node.type !== 'n8n-nodes-base.code') continue;
      const wrapped = `${node.parameters.jsCode}\n`;
      // Syntax check without executing n8n globals.
      new Function('$input', '$env', '$', wrapped);
    }
  }
});
