import {
  AUTHORITY,
  PREPARED_NOT_DELIVERED,
  assertPrepareOnly,
  computeFreshness,
  minimizeRecord,
  normalizeWithContract,
  safeIso,
} from './core.mjs';

export class PlatformBot {
  constructor(contract) {
    this.contract = Object.freeze(structuredClone(contract));
  }

  prepare(rawRecord, options = {}) {
    assertPrepareOnly(options);
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      throw new TypeError('rawRecord must be an object');
    }

    const runTime = safeIso(options.runTime ?? new Date().toISOString());
    const minimized = minimizeRecord(rawRecord, options.redactKeys ?? []);
    const normalized = normalizeWithContract(minimized, this.contract);
    const sourceAsOf = safeIso(normalized.data.source_as_of);
    const freshness = computeFreshness({
      sourceAsOf,
      runTime,
      staleAfterMinutes: options.staleAfterMinutes,
    });

    return {
      bot: this.contract.bot,
      platform: this.contract.platform,
      record_type: this.contract.recordType,
      status: PREPARED_NOT_DELIVERED,
      authority: AUTHORITY,
      run_time: runTime,
      source_as_of: sourceAsOf,
      freshness,
      source_record_id: normalized.data.source_record_id,
      data: normalized.data,
      provenance: normalized.provenance,
      missing: normalized.missing,
      routing: this.contract.routing,
      claims: {
        exact_platform_schema_verified: false,
        live_connection_used: false,
        external_write_performed: false,
      },
      notes: normalized.missing.length ? ['MISSING_FIELDS_REMAIN_UNKNOWN'] : [],
    };
  }

  handoff(rawRecord, options = {}) {
    const prepared = this.prepare(rawRecord, options);
    return {
      platform: prepared.platform,
      source_record_id: prepared.source_record_id,
      status: PREPARED_NOT_DELIVERED,
      external_action: 'NONE',
      writes: 'BARRED',
      live_access: 'BARRED',
      recipient: options.recipient ?? 'OCC',
      missing: prepared.missing,
      freshness: prepared.freshness.state,
      payload: prepared,
    };
  }
}
