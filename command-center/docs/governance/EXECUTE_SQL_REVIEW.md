# execute-sql Security and Authority Review

> **BHFOS Operating Model v2.2 — G2.3B-B1.** Dedicated review structure for the
> `execute-sql` Edge Function and related RPC surface.
>
> **Binding rules for all phases of this review:**
>
> 1. **`execute-sql` must not be invoked** during diagnostics review.
> 2. Unresolved execute-sql risk **blocks** Production Operator database-write
>    authority.
> 3. **No conclusion may be recorded without evidence.**
> 4. This artifact must **not** contain SQL capable of modifying production
>    (no writable script bodies, no paste of mutating SQL).
>
> B1 creates the checklist only. Findings remain `pending` until B4 under
> separate authorization. Content rules: no secrets, no raw logs, no customer data.

---

## 1. Review status

| Field | Value |
| --- | --- |
| Review status | `not_started` (scaffold only — B1) |
| Function invoked during review | **Forbidden / not performed** |
| Completion claim | **None** — do not treat this file as a completed review |
| Blocks PO database-write authority | **Yes** until Founder-accepted resolution or attestation |

---

## 2. Repository source (fill in B4 from repo evidence only)

| Question | Finding (B4) | Evidence reference |
| --- | --- | --- |
| Authoritative source path | _pending_ | _pending_ |
| Other copies (legacy trees) | _pending_ | _pending_ |
| Entry behavior (high level, no mutating SQL bodies) | _pending_ — describe control flow only | _pending_ |
| Uses admin client / elevated role? | _pending_ | _pending_ |
| Accepts `scriptKey` vs arbitrary SQL? | _pending_ | _pending_ |

**B1 note (non-conclusive planning observation):** source trees exist under
paths matching `**/supabase/functions/execute-sql/`. Treat as **unverified for
hosted risk** until B4. Do not paste script SQL into this file.

---

## 3. Hosted deployment state (B4 — read-only inventory)

| Question | Finding (B4) | Evidence reference |
| --- | --- | --- |
| Hosted function present? | _pending_ | _pending_ |
| Active / inactive | _pending_ | _pending_ |
| Last deployment timestamp | _pending_ | _pending_ |
| Version / source identity | _pending_ | _pending_ |

---

## 4. Authentication and authorization (B4)

| Question | Finding (B4) | Evidence reference |
| --- | --- | --- |
| Authentication requirement (JWT / anon / service / other) | _pending_ | _pending_ |
| Authorization checks (role, tenant, allowlist) | _pending_ | _pending_ |
| Who can call it in production? | _pending_ | _pending_ |

---

## 5. Input and mutation capability (B4 — static analysis only)

| Question | Finding (B4) | Evidence reference |
| --- | --- | --- |
| Accepted input shape | _pending_ | _pending_ |
| Arbitrary SQL possible? | _pending_ | _pending_ |
| Writes possible? | _pending_ | _pending_ |
| DDL possible? | _pending_ | _pending_ |
| Underlying RPC name / privileges (metadata only) | _pending_ | _pending_ |

**Do not** include executable mutating SQL samples in this document.

---

## 6. Callers, logging, secrets, isolation (B4)

| Question | Finding (B4) | Evidence reference |
| --- | --- | --- |
| Callers in application / repo | _pending_ | _pending_ |
| Logging content and retention risk | _pending_ | _pending_ |
| Secret usage (e.g. service-role / admin client) | _pending_ (names only) | _pending_ |
| Tenant isolation | _pending_ | _pending_ |
| Customer-data exposure risk | _pending_ | _pending_ |

---

## 7. Emergency disable mechanism (B4)

| Question | Finding (B4) | Evidence reference |
| --- | --- | --- |
| Who can disable the hosted function? | _pending_ | _pending_ |
| Under what authorization? | _pending_ | _pending_ |
| Disable path tested? | **Not in G2.3B diagnostics** unless separately authorized | _pending_ |

Disabling or modifying the function is **out of scope** for G2.3B diagnostics
authorization unless a separate Founder authorization is granted.

---

## 8. Recommendation (B4 — evidence required)

Choose **one** only after evidence exists:

- [ ] Retain as-is
- [ ] Restrict (describe required controls)
- [ ] Replace
- [ ] Disable (requires separate authorization to execute)

| Field | Value |
| --- | --- |
| Recommendation | _pending — no conclusion without evidence_ |
| Rationale | _pending_ |
| Residual risk | _pending_ |
| Follow-up / expiration | _pending_ |

---

## 9. Link to reconciliation gate R3

Gate record: `RECONCILIATION_G2-3B.md` §5. Clearing R3 requires this review to
reach a Founder-accepted recommendation **or** a formal attestation with all
required attestation fields.
