/**
 * A terminal closed hold must drop the processing lock.
 * Throwaway local Postgres only.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildClosedHoldSql } from '../lib/pass1-hostinger-fetch.mjs';

const DB = 'tvg_pass1_closed_hold_7298';
const HELD = '30000000-0000-4000-8000-0000000000c1';
const ERRORED = '30000000-0000-4000-8000-0000000000c2';
const BYSTANDER = '30000000-0000-4000-8000-0000000000c3';

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

test('closed-hold SQL clears locked_at and locked_by on held and error', () => {
  const heldSql = buildClosedHoldSql({
    queue_id: HELD,
    queue_status: 'held',
    hold_reason: 'hostinger_rate_limited',
    error_code: 'hostinger_rate_limited',
    detail: 'hostinger_rate_limited',
    fetch_base_url: 'disabled',
  });
  const errorSql = buildClosedHoldSql({
    queue_id: ERRORED,
    queue_status: 'error',
    hold_reason: 'hostinger_timeout',
    error_code: 'hostinger_timeout',
    detail: 'hostinger_timeout',
    fetch_base_url: 'disabled',
  });
  assert.match(heldSql, /locked_at = NULL/);
  assert.match(heldSql, /locked_by = NULL/);
  assert.match(errorSql, /locked_at = NULL/);
  assert.match(errorSql, /locked_by = NULL/);
  assert.equal(heldSql.includes('$'), false);
  assert.equal(errorSql.includes('$'), false);

  const drop = `
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = '${DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB};
CREATE DATABASE ${DB};
`;
  const created = psql('postgres', drop);
  assert.equal(created.status, 0, created.stderr);
  must(`
CREATE SCHEMA email_automation;
CREATE TYPE email_automation.intake_queue_status AS ENUM (
  'pending', 'processing', 'done', 'duplicate', 'error', 'held', 'deferred_kill_switch'
);
CREATE TABLE email_automation.intake_queue (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'tvg',
  status email_automation.intake_queue_status NOT NULL,
  hold_reason text,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  hostinger_pointers jsonb NOT NULL DEFAULT '{}'::jsonb
);
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
INSERT INTO email_automation.intake_queue (id, status, locked_at, locked_by)
VALUES
  ('${HELD}', 'processing', now(), 'n8n-worker-fetch'),
  ('${ERRORED}', 'processing', now(), 'n8n-worker-fetch'),
  ('${BYSTANDER}', 'processing', now(), 'n8n-worker-fetch');
`);
  must(heldSql);
  must(errorSql);

  const rows = must(`
SELECT id::text || '|' || status::text || '|' || COALESCE(hold_reason, '')
    || '|' || COALESCE(locked_at::text, '') || '|' || COALESCE(locked_by, '')
  FROM email_automation.intake_queue
 ORDER BY id;
`);
  const byId = Object.fromEntries(rows.split('\n').map((line) => {
    const [id, status, hold, lockedAt, lockedBy] = line.split('|');
    return [id, { status, hold, lockedAt, lockedBy }];
  }));
  assert.equal(byId[HELD].status, 'held');
  assert.equal(byId[HELD].hold, 'hostinger_rate_limited');
  assert.equal(byId[HELD].lockedAt, '');
  assert.equal(byId[HELD].lockedBy, '');
  assert.equal(byId[ERRORED].status, 'error');
  assert.equal(byId[ERRORED].hold, 'hostinger_timeout');
  assert.equal(byId[ERRORED].lockedAt, '');
  assert.equal(byId[ERRORED].lockedBy, '');
  assert.equal(byId[BYSTANDER].status, 'processing');
  assert.equal(byId[BYSTANDER].lockedBy, 'n8n-worker-fetch');
  assert.notEqual(byId[BYSTANDER].lockedAt, '');
});
