/**
 * Staging fixture runner. Default is a dry plan: it does not connect.
 * Live execution requires --confirm-staging plus:
 *   TVG_EMAIL_STAGING_PROJECT_REF=glkrykpksbsqmmilmjhs
 *   TVG_EMAIL_DATABASE_URL containing that ref and not wwyxohjnyqnegzbxtuxs
 *
 * This file does not open a connection in dry-plan mode.
 */
import { assertStagingTarget } from '../lib/pass1-intake-logic.mjs';

const confirm = process.argv.includes('--confirm-staging');
const projectRef = process.env.TVG_EMAIL_STAGING_PROJECT_REF || '';
const databaseUrl = process.env.TVG_EMAIL_DATABASE_URL || '';

const plan = [
  'Target only glkrykpksbsqmmilmjhs. Refuse wwyxohjnyqnegzbxtuxs.',
  'Schema must already be applied. This runner does not apply DDL.',
  'Insert SYNTH contacts/leads and intake rows with Message-ID prefix synth-pass1-.',
  'Run evaluateIntake decisions from lib/pass1-intake-logic.mjs against those rows via the inactive worker, or the SQL checks in fixtures/sql/local-smoke.sql.',
  'Cleanup deletes only rows whose message_id LIKE \'synth-pass1-%\' or name LIKE \'SYNTH %\'.',
  'Do not enable Hostinger webhooks or n8n schedules.',
];

if (!confirm) {
  process.stdout.write(`TVG Email Pass 1 staging fixture plan (no connection)\n`);
  for (const line of plan) process.stdout.write(`- ${line}\n`);
  process.exit(0);
}

assertStagingTarget({ projectRef, databaseUrl });
process.stderr.write(
  'Staging URL passed the guard, but this runner does not execute SQL. Apply fixtures with psql against glkrykpksbsqmmilmjhs only after the apply checklist.\n',
);
process.exit(0);
