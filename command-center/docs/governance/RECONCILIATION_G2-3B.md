# G2.3B Reconciliation Gate — Procedures and Attestation Records

> **BHFOS Operating Model v2.2 — G2.3B-B1.** Procedure and empty attestation
> scaffold only. **No live system was inspected in B1.** No gate item below is
> resolved by this document.
>
> Content rules: no credentials, no secret values, no raw logs, no customer data.
> Evidence in later phases must be **references** (system, time window, id), never
> pasted log bodies.

---

## 1. Status

| Field | Value |
| --- | --- |
| Phase authoring this scaffold | G2.3B-B1 |
| Live reconciliation execution | **Not performed** (deferred to B4 under separate authorization) |
| Edge Function 37↔106 / repo↔hosted mismatch | **Unresolved** — not claimed complete |
| Schema drift | **Unresolved** — not claimed complete |
| execute-sql review | **Unresolved** — not claimed complete |

A bare acknowledgment does **not** clear a blocker. Formal attestation fields
below are mandatory when proceeding with residual risk.

---

## 2. Formal attestation schema (required fields)

When a gate item is attested rather than fully resolved, the record **must**
contain all of:

1. Exact condition
2. Affected system and scope
3. Known risk
4. Evidence (platform-native references only)
5. Why the phase may proceed
6. Compensating controls
7. Responsible approving authority
8. Expiration or follow-up condition

---

## 3. Gate R1 — Edge Function inventory reconciliation

### 3.1 Procedure (read-only; execute in B4 only)

**Authoritative repository root:** `command-center/supabase/functions/`
(exclude directories named `_lib`, `_shared`, or other `_` prefixes). Legacy or
root `supabase/functions/` trees are classified separately and must not inflate
the primary inventory.

**Compare:**

- Repository function directories vs hosted function inventory
- Function names
- Deployment timestamps (hosted)
- Version or source identity where available
- Authentication requirements (where discoverable without invoking)
- Callers (repository search only)
- Apparent purpose
- Repository ownership / path
- Status: active / deprecated / orphaned / unknown

**Classification (required for each hosted or repo name):**

| Class | Meaning |
| --- | --- |
| `reconciled` | Present in authoritative repo and hosted with consistent identity |
| `hosted-only` | Hosted but absent from authoritative repo |
| `repository-only` | In authoritative repo but not hosted (or not found) |
| `duplicate-or-legacy` | Duplicate name or only in legacy trees |
| `unknown` | Insufficient evidence to classify |
| `high-risk` | Financial, communication, SQL-execution, auth, or destructive/admin |

**Mandatory high-risk review labels** for (non-exhaustive): `execute-sql`,
`stripe-webhook`, `payment-webhook`, `create-payment-intent`, `send-sms`,
`send-invoice`, `send-estimate`, `send-receipt`, `money-loop-delete`, and any
function that can mutate money, messages, auth, or data.

**Outputs (B4):** machine-readable inventory (YAML/JSON) + human-readable summary
filed by **reference** in this document’s R1 record. No function may be disabled,
deleted, deployed, or modified during G2.3B.

### 3.2 R1 record (pending)

| Field | Value |
| --- | --- |
| Status | `pending` |
| Exact condition | Repository↔hosted Edge Function inventory does not reconcile (umbrella cited ~37 repo vs ~106 hosted; local authoritative count may differ — hosted figure unverified in B1) |
| Affected system / scope | Supabase Edge Functions / production project |
| Known risk | Orphaned, duplicate, or unknown functions may include financial, communication, or SQL-execution surfaces |
| Evidence | _empty until B4_ |
| Why phase may proceed | _empty until attestation_ |
| Compensating controls | _empty until attestation_ |
| Approving authority | _empty until Founder/authorized reviewer_ |
| Expiration / follow-up | _empty until attestation_ |
| Blocks G2.3C? | **Yes** until resolved or formally attested |

---

## 4. Gate R2 — Schema drift (metadata only)

### 4.1 Procedure (read-only; execute in B4 only)

**Sources:**

- Repository migrations: `command-center/supabase/migrations/`
- Hosted migration history (platform metadata)
- Schema metadata: tables, columns, indexes, constraints, database functions,
  triggers, policies, enum values

**Rules:**

- Keep **local** and **hosted** evidence distinct
- **No** customer-table data extraction
- **No** automatic repair
- **No** migration application
- **No** arbitrary SQL; metadata mechanisms only
- Produce machine-readable + human-readable results
- Record drift severity, affected subsystem, and whether drift **blocks G2.3C**
- Build on G2.3A `verify-migration-state.mjs` when later authorized to extend
  (tool changes are **out of B1 scope**)

### 4.2 R2 record (pending)

| Field | Value |
| --- | --- |
| Status | `pending` |
| Exact condition | Known local↔hosted schema drift unresolved (examples cited in umbrella: UUID vs bigint properties; address column naming; tenant_id; estimates CREATE gap) |
| Affected system / scope | Supabase Postgres schema / migrations |
| Known risk | Deploy or migration assumptions may be wrong; data-model mismatch |
| Evidence | _empty until B4_ |
| Why phase may proceed | _empty until attestation_ |
| Compensating controls | _empty until attestation_ |
| Approving authority | _empty until Founder/authorized reviewer_ |
| Expiration / follow-up | _empty until attestation_ |
| Blocks G2.3C? | **Yes** until resolved or formally attested |

---

## 5. Gate R3 — execute-sql review

Procedure and findings live in `EXECUTE_SQL_REVIEW.md`. **Do not invoke
execute-sql** during review.

### 5.1 R3 record (pending)

| Field | Value |
| --- | --- |
| Status | `pending` |
| Exact condition | execute-sql purpose, hosted state, authn/authz, mutation capability, and risk not fully evidenced |
| Affected system / scope | Supabase Edge Function `execute-sql` + underlying RPC |
| Known risk | Potential broad SQL / write surface; blocks PO database-write authority until reviewed |
| Evidence | _empty until B4_ |
| Why phase may proceed | _empty until attestation_ |
| Compensating controls | No PO DB-write authority; I2 must not invoke |
| Approving authority | _empty until Founder/authorized reviewer_ |
| Expiration / follow-up | _empty until attestation_ |
| Blocks PO DB-write? | **Yes** until resolved or formally attested |

---

## 6. Gate R4 — GitHub branch-protection state

### 6.1 Procedure (read-only; execute in B3/B4 only)

Use G2.3A `command-center/tools/verify-branch-protection.mjs` as foundation.
Live verification targets: required checks (including `identity_contracts`),
review requirements, force-push/deletion restrictions, administrator bypass,
merge methods, status-check strictness, rulesets vs legacy protection.

**Do not modify GitHub settings** under G2.3B diagnostics authorization. Required
settings changes need a separate external-configuration authorization.

### 6.2 R4 record (pending)

| Field | Value |
| --- | --- |
| Status | `pending` |
| Exact condition | Live branch-protection enforcement not fully attested |
| Affected system / scope | GitHub `main` protection / rulesets |
| Known risk | Merge path may diverge from documented required checks |
| Evidence | _empty until B3/B4_ |
| Why phase may proceed | _empty until attestation_ |
| Compensating controls | _empty until attestation_ |
| Approving authority | _empty until Founder/authorized reviewer_ |
| Expiration / follow-up | _empty until attestation_ |
| Blocks G2.3C? | Soft for deploy tooling; **required** for G2.3B completion |

---

## 7. Gate R5 — Production log availability (Hostinger + Supabase)

### 7.1 Procedure (B3/B4)

Prove I2 can open platform-native log views for Hostinger deployment logs and
Supabase app/auth/DB/Edge Function logs. Record **locations and time windows**
only — never paste raw logs.

### 7.2 R5 record (pending)

| Field | Value |
| --- | --- |
| Status | `pending` |
| Exact condition | Production log availability for I2 unverified |
| Affected system / scope | Hostinger logs; Supabase logs |
| Known risk | Incidents cannot be diagnosed without founder mechanics |
| Evidence | _empty until B3/B4_ |
| Why phase may proceed | _empty until attestation_ |
| Compensating controls | Masking policy in `DIAGNOSTICS_ACCESS.md` |
| Approving authority | _empty until Founder/authorized reviewer_ |
| Expiration / follow-up | _empty until attestation_ |
| Blocks G2.3C? | Soft for C; **required** for B REACHABLE evidence |

---

## 8. Gate R6 — Secret storage and revocation mechanism

### 8.1 Procedure (B2 define / B5 exercise)

Confirm secret-store category for I2 tokens; name rows in `SECRET_INVENTORY.md`;
execute revocation test per `I2_REVOCATION_CHECKLIST.md` in B5.

### 8.2 R6 record (pending)

| Field | Value |
| --- | --- |
| Status | `pending` |
| Exact condition | I2 secret-storage and revocation not yet exercised |
| Affected system / scope | Secret store + I2 tokens |
| Known risk | Standing credentials without proven revoke path |
| Evidence | _empty until B2/B5_ |
| Why phase may proceed | _empty until attestation_ |
| Compensating controls | Names-only inventory; B1 forbids values in repo |
| Approving authority | _empty until Founder/authorized reviewer_ |
| Expiration / follow-up | _empty until attestation_ |
| Blocks standing I2? | **Yes** until B5 revoke demonstrated (or attested with expiration) |

---

## 9. Explicit non-claims (B1)

- This file does **not** resolve Edge Function inventory mismatch.
- This file does **not** resolve schema drift.
- This file does **not** complete the execute-sql review.
- This file does **not** authorize production access or credential provisioning.
