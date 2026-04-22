# H1B_TENANT_IMMUTABILITY_PACKET_V1.md

## Purpose

This packet defines the **H1b hardening pass** for tenant ownership immutability.

This is not a broad security rewrite.
This is a **surgical immutability packet**.

It exists to ensure that once a record is created under a tenant, its `tenant_id` cannot be changed by UI, edge function, script, or accidental raw update.

---

## Objective

Promote tenant ownership from policy to physics.

After this packet is implemented:

* protected tables cannot have `tenant_id` changed after insert
* edge/UI paths cannot silently drift records across tenants
* service-role paths cannot mutate tenant ownership accidentally or maliciously

---

## Scope Lock

This packet is limited to:

1. making `tenant_id` immutable on the highest-priority core tables
2. verifying that active write paths do not depend on changing `tenant_id`
3. preserving existing tenant-scoped access patterns
4. returning proof that attempted `tenant_id` mutation is rejected

Out of scope:

* broad RLS redesign
* money-loop hardening
* transition matrix enforcement
* owner-path trigger/RPC migration beyond tenant immutability
* Air Check / inspection entity work
* cascade/orphan logic
* UI redesign

---

## Preconditions

Proceed only if all of the following are true:

* `SOURCE_OF_TRUTH_MAP.md` exists at repo root
* `DECISION_LOG.md` exists at repo root
* `ENTITY_OWNERSHIP_AND_MUTATION_RULES.md` exists at repo root
* `PRE_RESUMPTION_DECISION_PACKET_V1.md` is accepted
* review gate enforcement is active in CI or accepted for immediate rollout
* current tenant isolation baseline from H1a is already accepted for appointments or equivalent scoped baseline

If any precondition fails, STOP and report `BLOCKED` with evidence.

---

## Authority Sources

This packet is governed by:

* `SOURCE_OF_TRUTH_MAP.md`
* `ENTITY_OWNERSHIP_AND_MUTATION_RULES.md`
* `DECISION_LOG.md`
* `PRE_RESUMPTION_DECISION_PACKET_V1.md`

---

# 1. PROTECTED FIELD RULE

## Rule

For protected tables in scope, `tenant_id` is immutable after insert.

That means:

* INSERT may set `tenant_id` through authorized path
* UPDATE may never change `tenant_id`

This rule applies regardless of:

* caller type
* UI/client path
* edge function path
* service-role path

Any attempt to change `tenant_id` after insert must fail.

---

# 2. TABLE PRIORITY

## Minimum required scope

H1b must cover the highest-risk core tables first.

Priority 1 tables:

* `public.jobs`
* `public.quotes`
* `public.invoices`
* `public.leads`
* `public.appointments`

If repo reality shows naming differences, map to the actual authoritative table names and report them.

## Rule

Do not silently widen scope beyond these unless required by direct linkage and explicitly reported.

---

# 3. IMPLEMENTATION REQUIREMENT

## Required enforcement model

Use DB-level protection so `tenant_id` immutability does not depend on UI or edge-function discipline.

Preferred implementation pattern:

* `BEFORE UPDATE` trigger(s) or equivalent DB mechanism
* compare `OLD.tenant_id` vs `NEW.tenant_id`
* reject any change with a clear error

Alternative implementation is allowed only if it provides equivalent DB-level immutability.

## Rule

Do not rely on review gate alone.
Do not rely on client discipline alone.
Do not rely on service-role discipline alone.

This must become **database-enforced**.

---

# 4. WRITE-PATH SAFETY CHECK

Before adding immutability enforcement, inspect active write paths to confirm whether any legitimate code path currently tries to mutate `tenant_id`.

## Required audit questions

For each table in scope:

* where is it inserted?
* where is it updated?
* does any update path intentionally set or overwrite `tenant_id`?
* does any service-role path trust request/body tenant data?

## If mutation attempts are found

* report exact file/path
* classify whether it is a bug, legacy drift, or required path
* do not silently adapt the law to fit a bad path

---

# 5. SERVICE-ROLE SAFETY RULE

Service-role functions must not be allowed to mutate `tenant_id` after insert.

If a service-role path currently does so, that is a vulnerability and must be reported.

H1b does not need to redesign the whole function, but it must ensure DB immutability still blocks the write.

---

# 6. IMPLEMENTATION ORDER

## Step 1

Reality-check the actual tables in scope and current write paths

## Step 2

Identify whether any current update paths mutate `tenant_id`

## Step 3

Add DB-level immutability enforcement for `tenant_id`

## Step 4

Run verification on allowed inserts and forbidden updates

## Step 5

Report any blocked or broken legacy paths discovered

---

# 7. REQUIRED VERIFICATION

Verification must prove all of the following:

## Insert behavior

* valid insert path still works when `tenant_id` is initially set through authorized path

## Update rejection behavior

For each protected table in scope, attempted update changing `tenant_id` must fail.

Proof should show:

* old tenant_id
* attempted new tenant_id
* DB rejection/error

## No-regression behavior

* non-tenant updates still work where otherwise allowed
* immutability does not break ordinary valid updates unrelated to tenant ownership

## Service-role behavior

* attempted post-insert tenant mutation via privileged path is also rejected by DB enforcement

---

# 8. PATCH OUTPUTS REQUIRED

Implementation output must include:

* files changed
* exact migration(s) added
* tables actually covered
* trigger/function names or equivalent DB enforcement artifacts
* write-path audit findings
* verification evidence for inserts and rejected tenant mutations
* any residual risks not fixed in this packet

---

# 9. DONE DEFINITION

This packet is done only when:

* `tenant_id` is DB-immutable after insert for tables in scope
* attempted tenant mutation is rejected with evidence
* ordinary non-tenant updates still work
* legacy mutation attempts, if any, are identified and reported
* no unrelated security redesign was introduced

---

# 10. EXECUTION RULE

This packet must be implemented as a **surgical DB hardening pass**.

The operator standard is:

* inspect reality
* add immutability at DB level
* prove mutation rejection
* report legacy breakpoints
* stop

Do not expand into other hardening tracks from this packet.

