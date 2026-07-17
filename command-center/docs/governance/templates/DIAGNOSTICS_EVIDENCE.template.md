# Diagnostics Evidence Template — BHFOS Operating Model v2.2

> **Masked evidence only.** Agent-prepared. Copy this template for an authorized
> PD investigation. **Do not paste raw logs or screenshots.** Prefer
> platform-native references (system, project, time window, run id, request id).
>
> Content rules: no credentials, no secret values, no customer data, no unmasked
> PII. Use placeholders such as `[REDACTED]` when a field would otherwise expose
> sensitive data.

---

## Header

| Field | Value |
| --- | --- |
| Release or incident reference | |
| Role and identity | Production Diagnostics / I2 |
| Environment | production / other: |
| System inspected | GitHub / Hostinger / Supabase / App / Browser |
| Time window (UTC) | |
| Authorization reference | |
| Evidence author | |
| Evidence created at (UTC) | |

---

## Observations (references only)

| Field | Value |
| --- | --- |
| Observed evidence | Describe what was seen; cite platform location ids — **no raw logs** |
| Platform-native references | e.g. workflow run id, Hostinger deploy id, Supabase log filter window |
| Sensitive-data masking confirmation | Yes — masked before leaving platform / N/A (metadata only) |
| Confidence | high / medium / low |
| Affected system | |
| Likely cause | |
| Missing evidence | |

---

## Recommendations

| Field | Value |
| --- | --- |
| Containment recommendation | |
| Rollback-versus-forward-fix recommendation | |
| Handoff role | Builder / Production Operator / Incident Commander |
| Exact authorization the handoff needs | |

---

## Controls and disposition

| Field | Value |
| --- | --- |
| Write-attempt negative-test result | denied / not_run / **stop_if_allowed** |
| Stop condition hit? | No / Yes — describe |
| Disposition | open / handed_off / closed |
| Masked evidence retention expiry | ≤ 30 days from created_at unless incident requires longer |
| Deletion / re-mask plan | |

---

## Explicit non-actions for this investigation

Confirm:

- [ ] No deploy
- [ ] No migration
- [ ] No database write
- [ ] No `execute-sql` invocation
- [ ] No service-role use
- [ ] No secret values recorded
- [ ] No raw logs pasted
- [ ] No customer impersonation

---

## Exact stopping point

_
