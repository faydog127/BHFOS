# I2 Revocation Checklist (G2.3B-B5 template)

> **BHFOS Operating Model v2.2 — G2.3B-B1.** Template for **future** B5
> revocation and emergency disable. **Do not revoke or disable anything under B1.**
>
> Content rules: names and categories only — never secret values.

---

## 1. Authorization gate

| Field | Value |
| --- | --- |
| Authorization reference | _pending — Founder B5 Decision Packet id_ |
| Risk tier | Tier 3 |
| Trigger | Scheduled B5 completion test **or** emergency suspicion |
| Live revocation in B1 | **Not authorized / not performed** |

---

## 2. Per-system revocation rows

### 2.1 GitHub

| Field | Record (B5) |
| --- | --- |
| Exact identity revoked | _pending_ |
| Revocation action | Revoke PAT and/or disable GitHub App installation |
| Actor | _pending_ |
| Revocation evidence (reference) | Audit log entry id / timestamp — _pending_ |
| Failed-access test after revoke | Expect 401/403 on prior read API — _pending_ |
| Emergency disable | Same as revocation; immediate |

### 2.2 Hostinger

| Field | Record (B5) |
| --- | --- |
| Exact identity revoked | _pending_ |
| Revocation action | Revoke token / remove read-only role |
| Actor | _pending_ |
| Revocation evidence (reference) | _pending_ |
| Failed-access test after revoke | Expect denial — _pending_ |
| Emergency disable | Immediate revoke |

### 2.3 Supabase

| Field | Record (B5) |
| --- | --- |
| Exact identity revoked | _pending_ |
| Revocation action | Revoke token / demote or remove project member |
| Actor | _pending_ |
| Revocation evidence (reference) | _pending_ |
| Failed-access test after revoke | Expect denial — _pending_ |
| Emergency disable | Immediate revoke + remove member |
| Confirm service-role untouched for I2 | I2 must never have held service-role |

### 2.4 Secret store

| Field | Record (B5) |
| --- | --- |
| Action | Delete or rotate secret-store entries for I2 names |
| Inventory update | Mark revoked / removed (names only) |
| Evidence reference | _pending_ |

### 2.5 Application / browser

| Field | Record (B5) |
| --- | --- |
| Action | End diagnostics sessions; discard masked working copies past retention |
| Cookie/token artifacts | Confirm none retained |

---

## 3. B5 completion criteria

- [ ] All provisioned I2 identities revoked or expired
- [ ] Post-revoke access attempts fail closed
- [ ] Ledger records revocation references (no secret values)
- [ ] Secret inventory names updated
- [ ] Standing I2 access does not remain without new Founder authorization

---

## 4. Emergency disable (any phase after B2)

On suspicion of compromise or over-scope:

1. Revoke all I2 tokens/roles immediately (do not wait for a full B5 packet if
   incident authority applies — record after the fact on the Ledger).
2. Stop diagnostics sessions.
3. Escalate to Founder / Incident Commander.
4. Do not re-provision without a new exact authorization.

---

## 5. Explicit non-action (B1)

No revocation, disable, or secret-store deletion was performed in B1.
