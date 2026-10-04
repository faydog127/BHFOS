# TVG Platform Bots — Foundation v0.2

Status: **A0/A1 development only — NOT ACTIVE — NO LIVE ACCESS — NO EXTERNAL WRITES**.

Adapters: Housecall Pro, Lessen, Lula, app.bhfos.com (TVG CRM/internal operating surface), and ZRS.

## What changed after independent review

- Freshness now measures **capture age**, with record age shown separately, plus threshold and `valid_until`.
- Missing/placeholder/invalid values are typed states; `UNKNOWN` is no longer an in-band data value.
- Conflicting aliases produce `CONFLICT` and block the handoff.
- Wrong record types/all-unknown/wrapped records are rejected as unusable.
- Zone-less dates are invalid; deterministic paths require caller-supplied run time.
- Untrusted free text is separated and quoted with control-character flags and raw hashes.
- Handoffs carry schema/contract/bot versions, deterministic ids/hashes, supersession, input origin, unmapped key names, and verification-before-acting fields.
- Options are allow-listed; a source-scan test enforces no network/filesystem/process-environment code in `src/`.
- Pure manual-relay JSON/key-value parsing and batch preparation are available without live access.
- BHFOS App carries `UNVERIFIED_VS_HCP` source authority and can be reconciled against HCP for conflicts.

## Public-repository rule

This repository is public. **Never commit real platform exports, screenshots, portal text, emails, customer/vendor records, or derived real fixtures.** Real samples, even sanitized ones, must be handled privately/ephemerally for mapping and then converted into synthetic golden fixtures before anything is committed.

## Still blocked

- No platform credentials or automated live reads.
- No claim that current aliases match real platform schemas.
- Money units/currency remain unverified until real private samples are reviewed.
- BHFOS App per-field authority vs HCP remains `UNVERIFIED_VS_HCP` except where durable governance already establishes HCP as the operational source.
- ZRS integration surface remains UNKNOWN.
- No event-detection or decision automation yet.

Any output remains a prepared draft and the listed identity, time, money, warranty and schedule fields must be confirmed in the source system before acting.
