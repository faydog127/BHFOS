import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { finiteAppointmentPrice, queryRows, summarizeScheduledPrices } from '../../src/lib/crm/analyticsIntegrity.js';

describe('business analytics source integrity', () => {
  it('does not coerce a missing or non-finite price to zero', () => {
    assert.equal(finiteAppointmentPrice({ pricing_snapshot: {} }), null);
    assert.equal(finiteAppointmentPrice({ pricing_snapshot: { price: null } }), null);
    assert.equal(finiteAppointmentPrice({ pricing_snapshot: { price: Number.NaN } }), null);
    assert.equal(finiteAppointmentPrice({ pricing_snapshot: { price: Number.POSITIVE_INFINITY } }), null);
    assert.equal(summarizeScheduledPrices([{ status: 'completed', pricing_snapshot: { price: 5 } }, { pricing_snapshot: {} }]).ok, false);
    const complete = summarizeScheduledPrices([
      { scheduled_start: '2026-01-02T15:00:00.000Z', pricing_snapshot: { price: 1.25 } },
      { scheduled_start: '2026-01-03T15:00:00.000Z', pricing_snapshot: { price: 0 } },
    ]);
    assert.equal(complete.ok, true);
    assert.equal(complete.total, 1.25);
    assert.equal(summarizeScheduledPrices([]).total, 0);
  });

  it('treats a query error as unavailable rather than an empty measurement', () => {
    assert.equal(queryRows({ data: null, error: { message: 'failed' } }).ok, false);
    assert.equal(queryRows({ data: null, error: null }).ok, false);
    assert.equal(queryRows({ data: [], error: null }).ok, true);
    assert.equal(queryRows(null).ok, false);
  });
});
