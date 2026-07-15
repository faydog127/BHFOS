/**
 * R1C helper contract tests (Node built-in test runner — no Playwright browsers).
 * Run: node --test tests/unit/r1c-helper-contracts.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LEAD_ADDRESS_SELECT,
  LEAD_FIELD_SELECT,
  hydrateLeadsWithProperties,
  resolveLegacyServiceAddress,
  resolveServiceAddress,
} from '../../src/lib/inspectionFieldAddress.js';
import {
  resolveLoggedInTechnicianRosterId,
  resolveTechnicianAuthUserId,
  resolveTechnicianDisplayName,
  resolveTechnicianRosterId,
  resolveTechnicianSelectValue,
  TECHNICIAN_ROSTER_SELECT,
} from '../../src/lib/technicianIdentity.js';
import { scanIdentityRelationshipGuards } from '../../tools/identity-relationship-guards.mjs';

const UUID = '13662027-a547-46b6-ada6-f89f4fe0ec09';
const TECH_ROSTER_ID = '11111111-1111-4111-8111-111111111111';
const TECH_USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ROSTER_ID = '33333333-3333-4333-8333-333333333333';

const technicians = [
  { id: TECH_ROSTER_ID, user_id: TECH_USER_ID, full_name: 'Roster Tech', is_active: true },
  { id: OTHER_ROSTER_ID, user_id: null, full_name: 'No Login Tech', is_active: true },
];

describe('R1C property helper contracts', () => {
  it('UUID leads.property_id does not require a properties join for address resolution', () => {
    const lead = { property_id: UUID, address: '101 Lead Only Lane' };
    assert.equal(resolveLegacyServiceAddress({ lead }), '101 Lead Only Lane');
    assert.equal(resolveServiceAddress({ lead }), '101 Lead Only Lane');
    assert.match(LEAD_FIELD_SELECT, /(^|,)\s*property_id\s*(,|$)/);
    assert.doesNotMatch(LEAD_FIELD_SELECT, /property\s*:\s*property_id/);
    assert.doesNotMatch(LEAD_ADDRESS_SELECT, /property\s*:\s*property_id/);
  });

  it('safe address fallback order: snapshot → service → formatted → leads.address → empty', () => {
    const lead = {
      property_id: UUID,
      property_formatted_address: '201 Secondary Property Rd, Titusville, FL 32780',
      address: 'FALLBACK LEAD ADDRESS ONLY',
    };

    assert.equal(
      resolveLegacyServiceAddress({
        snapshotAddress: 'SNAP SHOT ADDR',
        serviceAddress: '99 Job Service St',
        lead,
      }),
      'SNAP SHOT ADDR',
    );
    assert.equal(
      resolveLegacyServiceAddress({
        snapshotAddress: '',
        serviceAddress: '99 Job Service St',
        lead,
      }),
      '99 Job Service St',
    );
    assert.match(
      resolveLegacyServiceAddress({
        snapshotAddress: '',
        serviceAddress: '',
        lead,
      }),
      /201 Secondary Property Rd/,
    );
    assert.equal(
      resolveLegacyServiceAddress({
        snapshotAddress: '',
        serviceAddress: '',
        lead: { property_id: UUID, address: '101 Lead Only Lane' },
      }),
      '101 Lead Only Lane',
    );
    assert.equal(
      resolveLegacyServiceAddress({
        snapshotAddress: '',
        serviceAddress: '',
        lead: { property_id: UUID, address: '' },
      }),
      '',
    );
  });

  it('optional hydration failure does not throw and skips UUID property ids', async () => {
    let queried = false;
    const client = {
      from() {
        return {
          select() {
            return {
              in(_col, ids) {
                queried = true;
                assert.deepEqual(ids, ['42']);
                return Promise.resolve({ data: null, error: { message: 'boom' } });
              },
            };
          },
        };
      },
    };

    const uuidOnly = await hydrateLeadsWithProperties(client, 'tvg', {
      id: '1',
      property_id: UUID,
      address: 'Lead Addr',
    });
    assert.equal(queried, false);
    assert.equal(uuidOnly.property_id, UUID);

    const numeric = await hydrateLeadsWithProperties(client, 'tvg', {
      id: '2',
      property_id: '42',
      address: 'Numeric Lead',
    });
    assert.equal(queried, true);
    assert.equal(numeric.address, 'Numeric Lead');
    assert.equal(numeric.property, null);
  });
});

describe('R1C technician helper contracts', () => {
  it('auth user resolves through technicians.user_id to roster id', () => {
    assert.equal(
      resolveLoggedInTechnicianRosterId({ technicians, authUserId: TECH_USER_ID }),
      TECH_ROSTER_ID,
    );
    assert.equal(
      resolveLoggedInTechnicianRosterId({ technicians, authUserId: 'missing' }),
      null,
    );
  });

  it('assignment writes use technicians.id; legacy user_id only for display normalization', () => {
    assert.equal(resolveTechnicianRosterId({ technicians, value: TECH_USER_ID }), TECH_ROSTER_ID);
    assert.equal(resolveTechnicianSelectValue({ technicians, value: TECH_USER_ID }), TECH_ROSTER_ID);
    assert.equal(resolveTechnicianSelectValue({ technicians, value: null }), 'unassigned');
    assert.equal(resolveTechnicianDisplayName({ technicians, value: TECH_USER_ID }), 'Roster Tech');
    assert.equal(resolveTechnicianAuthUserId({ technicians, value: TECH_ROSTER_ID }), TECH_USER_ID);
    assert.match(TECHNICIAN_ROSTER_SELECT, /\bid\b/);
    assert.match(TECHNICIAN_ROSTER_SELECT, /\buser_id\b/);
  });

  it('missing technician mapping returns a clear safe state', () => {
    assert.equal(resolveTechnicianRosterId({ technicians, value: 'nope' }), null);
    assert.equal(resolveTechnicianSelectValue({ technicians, value: 'nope' }), 'unassigned');
    assert.equal(
      resolveTechnicianDisplayName({ technicians, value: 'nope', fallback: 'Unassigned' }),
      'Unassigned',
    );
  });

  it('roster rows without user_id do not break assignment lists', () => {
    assert.equal(
      resolveTechnicianSelectValue({ technicians, value: OTHER_ROSTER_ID }),
      OTHER_ROSTER_ID,
    );
    assert.equal(
      resolveTechnicianDisplayName({ technicians, value: OTHER_ROSTER_ID }),
      'No Login Tech',
    );
    assert.equal(resolveTechnicianAuthUserId({ technicians, value: OTHER_ROSTER_ID }), null);
    assert.equal(
      resolveLoggedInTechnicianRosterId({ technicians, authUserId: null }),
      null,
    );
  });
});

describe('R1C source-walk guards', () => {
  it('active src contains no forbidden property or technician patterns', () => {
    const result = scanIdentityRelationshipGuards();
    assert.equal(
      result.ok,
      true,
      result.offenders
        .map((o) => `${o.file}:${o.line} ${o.ruleId} — ${o.message}`)
        .join('\n'),
    );
    assert.ok(result.scannedFiles > 50);
  });
});
