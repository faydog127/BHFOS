/**
 * R2 lead intake contract tests (Node built-in test runner).
 * Run: node --test tests/unit/r2-lead-intake-contract.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LEAD_INTAKE_MESSAGES,
  assertLeadIntakeValid,
  buildLeadIntakeInsertPayload,
  describeLeadIntakeDbError,
  resolveIntakeAddress,
  validateLeadIntake,
} from '../../src/lib/leadIntakeContract.js';

const validInput = {
  first_name: 'Pat',
  last_name: 'Homeowner',
  phone: '(321) 555-1212',
  address: '101 Test Airflow Lane, Titusville, FL 32780',
};

describe('R2 lead intake validation', () => {
  it('requires name, phone, and address with plain-language errors', () => {
    const empty = validateLeadIntake({});
    assert.equal(empty.ok, false);
    assert.deepEqual(
      empty.errors.map((e) => e.field).sort(),
      ['address', 'name', 'phone'],
    );
    assert.equal(empty.errors.find((e) => e.field === 'name')?.message, LEAD_INTAKE_MESSAGES.name);
    assert.equal(empty.errors.find((e) => e.field === 'phone')?.message, LEAD_INTAKE_MESSAGES.phone);
    assert.equal(empty.errors.find((e) => e.field === 'address')?.message, LEAD_INTAKE_MESSAGES.address);
  });

  it('accepts company-only name and structured address parts', () => {
    const result = validateLeadIntake({
      company: 'Vent Co',
      phone: '3215551212',
      address1: '55 Brand New Lead Way',
      city: 'Titusville',
      state: 'FL',
      zip: '32780',
    });
    assert.equal(result.ok, true);
    assert.equal(result.normalized.company, 'Vent Co');
    assert.match(result.normalized.address, /55 Brand New Lead Way/);
    assert.match(result.normalized.phone, /321/);
  });

  it('buildLeadIntakeInsertPayload writes lead address only (no property_id)', () => {
    const payload = buildLeadIntakeInsertPayload(validInput, {
      tenantId: 'tvg',
      source: 'crm_leads',
    });
    assert.equal(payload.tenant_id, 'tvg');
    assert.equal(payload.address, validInput.address);
    assert.equal(payload.property_formatted_address, validInput.address);
    assert.equal(payload.property_id, undefined);
    assert.equal(payload.source, 'crm_leads');
  });

  it('assertLeadIntakeValid throws LEAD_INTAKE_VALIDATION', () => {
    assert.throws(
      () => assertLeadIntakeValid({ first_name: 'Pat' }),
      (error) => error.code === 'LEAD_INTAKE_VALIDATION',
    );
  });

  it('describeLeadIntakeDbError is loud for missing columns', () => {
    const message = describeLeadIntakeDbError({
      code: '42703',
      message: 'column "property_formatted_address" does not exist',
    });
    assert.match(message, /property_formatted_address/);
    assert.match(message, /not saved with missing data/i);
  });

  it('resolveIntakeAddress prefers freeform then composed parts', () => {
    assert.equal(resolveIntakeAddress({ address: '  Freeform  ' }), 'Freeform');
    assert.match(
      resolveIntakeAddress({ address1: '1 Main', city: 'Titusville', state: 'FL', zip: '32780' }),
      /1 Main/,
    );
  });
});
