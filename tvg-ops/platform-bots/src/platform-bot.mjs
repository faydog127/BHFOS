import {
  AUTHORITY, BOT_CODE_VERSION, PREPARED_NOT_DELIVERED, REJECTED_UNUSABLE, SCHEMA_VERSION,
  assertAllowedOptions, collectAliasField, computeFreshness, listUnmappedTopLevelKeys,
  normalizeBooleanField, normalizeDateField, normalizeIdentity, quoteUntrustedText,
  recursivelyRedact, sha256, stableStringify,
} from './core.mjs';

function applyFieldPolicy(name, field, contract) {
  if ((contract.booleanFields ?? []).includes(name)) return normalizeBooleanField(field);
  if ((contract.dateFields ?? []).includes(name)) return normalizeDateField(field);
  return field;
}

function knownValue(field) {
  return field?.state === 'KNOWN' ? field.value : null;
}

export class PlatformBot {
  constructor(contract) {
    this.contract = structuredClone(contract);
  }

  prepare(rawRecord, options = {}) {
    assertAllowedOptions(options ?? {});
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord) || rawRecord instanceof Map) {
      return { status: REJECTED_UNUSABLE, reasons: ['INVALID_RECORD_CONTAINER'] };
    }
    if (!options.runTime) throw new Error('RUN_TIME_REQUIRED');

    const { record, redacted_fields } = recursivelyRedact(rawRecord, options.redactKeys ?? []);
    const fields = {};
    const untrusted_text = {};
    const blocking = [];

    for (const [name, aliases] of Object.entries(this.contract.fields)) {
      let field = collectAliasField(record, aliases, { maxLength: this.contract.maxFieldLength ?? 8192 });
      field = applyFieldPolicy(name, field, this.contract);
      if ((this.contract.identityFields ?? []).includes(name) && field.state === 'KNOWN') {
        const canonical = normalizeIdentity(field.value);
        field = canonical ? { ...field, value: canonical } : { state: 'UNKNOWN', reason: 'EMPTY_IDENTITY' };
      }
      if ((this.contract.untrustedTextFields ?? []).includes(name)) {
        untrusted_text[name] = quoteUntrustedText(field, this.contract.maxUntrustedTextLength ?? 4096);
        fields[name] = { state: field.state === 'KNOWN' ? 'KNOWN_UNTRUSTED' : field.state, source_key: field.source_key ?? null };
      } else {
        fields[name] = field;
      }
      if (['CONFLICT', 'INVALID'].includes(fields[name].state)) blocking.push(name);
    }

    for (const required of this.contract.requiredIdentityFields ?? []) {
      if (!fields[required] || fields[required].state !== 'KNOWN') blocking.push(required);
    }

    const sourceId = knownValue(fields.source_record_id);
    if (!sourceId) blocking.push('source_record_id');
    const uniqueBlocking = [...new Set(blocking)].sort();
    const sourceRecordUpdated = fields.source_as_of;
    const freshness = computeFreshness({
      recordUpdatedAt: sourceRecordUpdated,
      capturedAt: options.capturedAt,
      runTime: options.runTime,
      staleAfterMinutes: options.staleAfterMinutes,
    });

    const normalizedForHash = {
      platform: this.contract.platform,
      contract_version: this.contract.version,
      source_record_id: sourceId,
      fields,
      untrusted_text,
    };
    const normalizedHash = sha256(stableStringify(normalizedForHash));
    const handoffId = sourceId ? `${this.contract.platform}:${normalizedHash.slice(0, 24)}` : null;

    const prepared = {
      schema_version: SCHEMA_VERSION,
      contract_version: this.contract.version,
      bot_version: BOT_CODE_VERSION,
      bot: this.contract.bot,
      platform: this.contract.platform,
      record_type: this.contract.recordType,
      status: uniqueBlocking.length ? REJECTED_UNUSABLE : PREPARED_NOT_DELIVERED,
      handoff_id: uniqueBlocking.length ? null : handoffId,
      normalized_input_sha256: normalizedHash,
      supersedes: options.supersedes ?? null,
      authority: AUTHORITY,
      input_origin: options.inputOrigin ?? 'UNKNOWN',
      relayed_by: options.relayedBy ?? 'UNKNOWN',
      run_time: options.runTime,
      captured_at: options.capturedAt ?? 'UNKNOWN',
      freshness,
      source_record_id: sourceId,
      fields,
      untrusted_text,
      blocking_fields: uniqueBlocking,
      handoff_usable: uniqueBlocking.length === 0,
      source_authority: this.contract.sourceAuthority,
      field_authority: this.contract.fieldAuthority ?? {},
      verify_before_acting: this.contract.verifyBeforeActing ?? [],
      routing: [...this.contract.routing],
      unmapped_keys: listUnmappedTopLevelKeys(record, this.contract),
      redacted_fields,
      declared_posture: {
        module_network_code: 'ABSENT_BY_SOURCE_SCAN_EXPECTATION',
        external_action: 'NONE',
        writes: 'BARRED',
        live_access: 'BARRED',
      },
    };
    prepared.output_sha256 = sha256(stableStringify(prepared));
    return prepared;
  }

  handoff(rawRecord, options = {}) {
    const prepared = this.prepare(rawRecord, options);
    if (prepared.status === REJECTED_UNUSABLE) {
      return { status: REJECTED_UNUSABLE, handoff: null, reasons: prepared.blocking_fields ?? prepared.reasons ?? [] };
    }
    const recipient = options.recipient ?? 'OCC';
    if (recipient !== 'OCC' && !this.contract.routing.includes(recipient)) throw new Error(`RECIPIENT_NOT_ALLOWED:${recipient}`);
    return {
      status: PREPARED_NOT_DELIVERED,
      handoff_id: prepared.handoff_id,
      recipient,
      external_action: 'NONE',
      writes: 'BARRED',
      live_access: 'BARRED',
      payload: prepared,
    };
  }
}

export function reconcileHandoffs(a, b) {
  const aJob = a?.payload?.fields?.linked_job_id?.value ?? a?.payload?.fields?.job_id?.value;
  const bJob = b?.payload?.fields?.linked_job_id?.value ?? b?.payload?.fields?.job_id?.value;
  if (!aJob || !bJob || String(aJob) !== String(bJob)) return { same_record: false, conflicts: [] };
  const conflicts = [];
  const aFields = a.payload.fields ?? {};
  const bFields = b.payload.fields ?? {};
  for (const name of new Set([...Object.keys(aFields), ...Object.keys(bFields)])) {
    const av = aFields[name];
    const bv = bFields[name];
    if (av?.state === 'KNOWN' && bv?.state === 'KNOWN' && stableStringify(av.value) !== stableStringify(bv.value)) {
      conflicts.push({ field: name, left: av.value, right: bv.value });
    }
  }
  return { same_record: true, conflicts };
}
