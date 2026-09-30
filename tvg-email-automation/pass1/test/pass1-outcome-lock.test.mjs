/**
 * A terminal outcome, and a stale processing hold, must drop the processing lock.
 * Throwaway local Postgres only. The production tenant check is omitted so an
 * another-tenant bystander can exist; the SQL under test still filters tenant tvg.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildOutcomeSql } from '../lib/pass1-intake-logic.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const DB = 'tvg_pass1_outcome_lock_7298';
const DONE = '31000000-0000-4000-8000-0000000000d1';
const DUPLICATE = '31000000-0000-4000-8000-0000000000d2';
const HELD = '31000000-0000-4000-8000-0000000000d3';
const ERRORED = '31000000-0000-4000-8000-0000000000d4';
const STALE = '31000000-0000-4000-8000-0000000000d5';
const PENDING = '31000000-0000-4000-8000-0000000000b1';
const ALREADY_DONE = '31000000-0000-4000-8000-0000000000b2';
const OTHER_TENANT = '31000000-0000-4000-8000-0000000000b3';
const FRESH = '31000000-0000-4000-8000-0000000000b4';
const EXISTING_EVENT = '32000000-0000-4000-8000-0000000000e1';

function psql(db, sql) {
  return spawnSync('sudo', [
    '-u', 'postgres', 'psql', '-d', db, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A',
  ], { input: sql, encoding: 'utf8' });
}

function must(sql) {
  const result = psql(DB, sql);
  assert.equal(result.status, 0, `psql failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function outcomeSql(queueId, messageId, eventStatus, queueStatus, holdReason) {
  return buildOutcomeSql({
    queue_id: queueId,
    event_status: eventStatus,
    queue_status: queueStatus,
    hold_reason: holdReason,
    message_id: messageId,
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
}

function snapshot() {
  const rows = must(`
SELECT id::text || '|' || tenant_id || '|' || status::text || '|' || COALESCE(hold_reason, '')
    || '|' || COALESCE(locked_at::text, '') || '|' || COALESCE(locked_by, '')
  FROM email_automation.intake_queue
 ORDER BY id;
`);
  return Object.fromEntries(rows.split('\n').filter(Boolean).map((line) => {
    const [id, tenant, status, hold, lockedAt, lockedBy] = line.split('|');
    return [id, { tenant, status, hold, lockedAt, lockedBy }];
  }));
}

function assertOnlyTargetChanged(before, after, targetId) {
  for (const id of Object.keys(before)) {
    if (id === targetId) continue;
    assert.deepEqual(after[id], before[id], `${id} changed`);
  }
  assert.equal(Object.keys(after).length, Object.keys(before).length);
}

test('terminal outcome and stale hold clear locked_at and locked_by', () => {
  const doneSql = outcomeSql(DONE, '<done-lock@example.com>', 'awaiting_pass2', 'done', null);
  const duplicateSql = outcomeSql(DUPLICATE, '<dup-lock@example.com>', 'awaiting_pass2', 'done', null);
  const heldSql = outcomeSql(HELD, '<held-lock@example.com>', 'held', 'held', 'form_auth_failure');
  const errorSql = outcomeSql(ERRORED, '<error-lock@example.com>', 'error', 'error', null);
  const staleSql = readFileSync(join(root, '../apply/reconcile_stale_to_hold.sql'), 'utf8');
  for (const sql of [doneSql, duplicateSql, heldSql, errorSql, staleSql]) {
    assert.match(sql, /locked_at = NULL/);
    assert.match(sql, /locked_by = NULL/);
    assert.equal(sql.includes('$'), false);
  }

  const created = psql('postgres', `
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = '${DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB};
CREATE DATABASE ${DB};
`);
  assert.equal(created.status, 0, created.stderr);
  must(`
CREATE SCHEMA email_automation;
CREATE TYPE email_automation.email_event_status AS ENUM (
  'received', 'queued', 'fetching', 'fetched', 'filtered', 'system_lessen',
  'held', 'awaiting_pass2', 'duplicate_ignored', 'deferred_kill_switch', 'error'
);
CREATE TYPE email_automation.intake_queue_status AS ENUM (
  'pending', 'processing', 'done', 'duplicate', 'error', 'held', 'deferred_kill_switch'
);
CREATE TYPE email_automation.notification_kind AS ENUM (
  'hold_alert', 'error_alert', 'daily_filtered_digest', 'stale_intake_hold', 'auth_reject_sample'
);
CREATE TABLE email_automation.intake_queue (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'tvg',
  mailbox text NOT NULL,
  mailbox_resource_id text NOT NULL,
  folder text NOT NULL,
  uid bigint,
  message_id text,
  fallback_hash text,
  status email_automation.intake_queue_status NOT NULL,
  hold_reason text,
  locked_at timestamptz,
  locked_by text,
  email_event_id uuid,
  hostinger_pointers jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE email_automation.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tvg',
  mailbox text NOT NULL,
  mailbox_resource_id text,
  message_id text,
  fallback_hash text,
  folder text,
  uid bigint,
  status email_automation.email_event_status NOT NULL DEFAULT 'received',
  filter_reason text,
  hold_reason text,
  from_email text,
  reply_to_email text,
  subject text,
  message_date_header text,
  body_hash text,
  resolved_recipient text,
  recipient_resolution text,
  authentication_results text,
  spf_pass boolean,
  dkim_pass boolean,
  dmarc_pass boolean,
  body_text_excerpt text,
  in_reply_to text,
  references_header text,
  has_attachments boolean DEFAULT false,
  attachment_meta jsonb DEFAULT '[]'::jsonb,
  contact_id uuid,
  lead_id uuid,
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_events_identity_present
    CHECK (message_id IS NOT NULL OR fallback_hash IS NOT NULL)
);
CREATE UNIQUE INDEX uq_email_events_mailbox_message_id
  ON email_automation.email_events (tenant_id, mailbox, message_id)
  WHERE message_id IS NOT NULL;
CREATE TABLE email_automation.automation_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tvg',
  email_event_id uuid,
  intake_queue_id uuid,
  stage text NOT NULL,
  error_code text,
  error_message text NOT NULL,
  context_json jsonb DEFAULT '{}'::jsonb,
  retryable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_automation.automation_settings (
  tenant_id text NOT NULL DEFAULT 'tvg',
  key text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, key)
);
CREATE TABLE email_automation.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tvg',
  kind email_automation.notification_kind NOT NULL,
  notification_kind text NOT NULL,
  channel text NOT NULL,
  email_event_id uuid,
  destination_ref text NOT NULL,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  delivery_state text NOT NULL,
  suppression_reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_notification_log_event_kind
  ON email_automation.notification_log (tenant_id, email_event_id, notification_kind)
  WHERE email_event_id IS NOT NULL;
INSERT INTO email_automation.email_events (id, tenant_id, mailbox, message_id, body_hash, status)
VALUES (
  '${EXISTING_EVENT}', 'tvg', 'info@vent-guys.com', '<dup-lock@example.com>',
  '${'cd'.repeat(32)}', 'awaiting_pass2'
);
INSERT INTO email_automation.intake_queue (
  id, tenant_id, mailbox, mailbox_resource_id, folder, uid, status, locked_at, locked_by
) VALUES
  ('${DONE}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 101, 'processing', now(), 'n8n-worker-fetch'),
  ('${DUPLICATE}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 102, 'processing', now(), 'n8n-worker-fetch'),
  ('${HELD}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 103, 'processing', now(), 'n8n-worker-fetch'),
  ('${ERRORED}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 104, 'processing', now(), 'n8n-worker-fetch'),
  ('${STALE}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 105, 'processing', now() - interval '2 hours', 'n8n-worker-fetch'),
  ('${PENDING}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 201, 'pending', now() - interval '2 hours', 'n8n-worker-fetch'),
  ('${ALREADY_DONE}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 202, 'done', now(), 'n8n-worker-fetch'),
  ('${OTHER_TENANT}', 'other', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 203, 'processing', now() - interval '2 hours', 'n8n-worker-fetch'),
  ('${FRESH}', 'tvg', 'info@vent-guys.com', 'mbx_synth', 'INBOX', 204, 'processing', now(), 'n8n-worker-fetch');
`);

  const cases = [
    [DONE, doneSql, 'done', ''],
    [DUPLICATE, duplicateSql, 'duplicate', ''],
    [HELD, heldSql, 'held', 'form_auth_failure'],
    [ERRORED, errorSql, 'error', ''],
  ];
  for (const [id, sql, status, hold] of cases) {
    const before = snapshot();
    must(sql);
    const after = snapshot();
    assertOnlyTargetChanged(before, after, id);
    assert.equal(after[id].tenant, 'tvg');
    assert.equal(after[id].status, status);
    assert.equal(after[id].hold, hold);
    assert.equal(after[id].lockedAt, '');
    assert.equal(after[id].lockedBy, '');
  }

  const beforeStale = snapshot();
  const counts = must(staleSql);
  const afterStale = snapshot();
  assertOnlyTargetChanged(beforeStale, afterStale, STALE);
  assert.equal(afterStale[STALE].status, 'held');
  assert.equal(afterStale[STALE].hold, 'stale_processing');
  assert.equal(afterStale[STALE].lockedAt, '');
  assert.equal(afterStale[STALE].lockedBy, '');
  assert.equal(afterStale[PENDING].status, 'pending');
  assert.equal(afterStale[PENDING].lockedBy, 'n8n-worker-fetch');
  assert.notEqual(afterStale[PENDING].lockedAt, '');
  assert.equal(afterStale[ALREADY_DONE].status, 'done');
  assert.equal(afterStale[ALREADY_DONE].lockedBy, 'n8n-worker-fetch');
  assert.notEqual(afterStale[ALREADY_DONE].lockedAt, '');
  assert.equal(afterStale[OTHER_TENANT].tenant, 'other');
  assert.equal(afterStale[OTHER_TENANT].status, 'processing');
  assert.equal(afterStale[OTHER_TENANT].lockedBy, 'n8n-worker-fetch');
  assert.notEqual(afterStale[OTHER_TENANT].lockedAt, '');
  assert.equal(afterStale[FRESH].status, 'processing');
  assert.equal(afterStale[FRESH].lockedBy, 'n8n-worker-fetch');
  assert.notEqual(afterStale[FRESH].lockedAt, '');
  assert.match(counts, /^1\|1\|0\|0$/);
});
