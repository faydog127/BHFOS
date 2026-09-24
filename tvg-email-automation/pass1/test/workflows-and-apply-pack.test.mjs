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
  'n8n/tvg-email-internal-sms-delivery.json',
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

test('internal SMS path stays inactive and has no live Twilio secret', () => {
  const delivery = JSON.parse(load('n8n/tvg-email-internal-sms-delivery.json'));
  assert.equal(delivery.active, false);
  assert.equal(delivery.meta.tvgEmailPass1.smsTransportIsNotSoR, true);
  const twilio = delivery.nodes.filter((node) => node.type === 'n8n-nodes-base.twilio');
  assert.equal(twilio.length, 1);
  assert.equal(twilio[0].disabled, true);
  assert.equal(twilio[0].name, 'Twilio send disabled');
  assert.equal(twilio[0].credentials.twilioApi.name, 'TVG Internal SMS Twilio');
  assert.equal(twilio[0].parameters.to, 'FOUNDER_APPROVED_MOBILE_NOT_IN_REPO');
  assert.equal(twilio[0].parameters.from, 'INTERNAL_ALERT_FROM_NOT_IN_REPO');
  assert.equal(JSON.stringify(delivery.connections).includes('Twilio'), false);
  const blob = JSON.stringify(delivery);
  assert.doesNotMatch(blob, /AC[0-9a-f]{32}/i);
  assert.doesNotMatch(blob, /authToken|auth_token|AccountSid/i);
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
