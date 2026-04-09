-- Replay and recovery semantics (transactional).
-- Run with: psql -v ON_ERROR_STOP=1 -f /work/tests/004_recovery.sql

-- If a transaction reserves idempotency but rolls back, the key should not be "burned".
begin;
select idempotency_begin('recovery:key:rollback', 'op_recovery', 'hash_recovery');
rollback;

-- Retry should be treated as a new attempt.
select idempotency_begin('recovery:key:rollback', 'op_recovery', 'hash_recovery');

-- If we complete, subsequent retries should replay.
select idempotency_complete('recovery:key:rollback', '{"ok":true,"attempt":2}'::jsonb);
select idempotency_begin('recovery:key:rollback', 'op_recovery', 'hash_recovery');

