# TVG Production Security Lockdown Authorization — 2026-10-04

**Record ID:** TVG-PROD-SEC-AUTH-2026-10-04-001  
**Organization:** The Vent Guys (TVG) / app.bhfos.com operating surface  
**Authority:** Founder — Erron Fayson  
**Approval timestamp:** 2026-10-04T13:38:39-04:00  
**Founder approval statement:** `approved`  
**Status:** FOUNDER-APPROVED — ACTIVE EXECUTION AUTHORIZATION  
**Decision owner:** Founder  
**Coordinating owner:** BHFOS Operations Command Center  
**Execution lane:** authorized Build Coordinator / Production Operator mechanics only  
**Network OS authority:** NOT APPLICABLE; this record governs the TVG app.bhfos.com operating/security surface.

## Purpose

Authorize the bounded production-security containment package presented immediately before the Founder approval. This record separates the approved business/security decision from later execution evidence.

Approval is not evidence of execution. Every applied change requires a production receipt.

## Authorized Decision 1 — Technician estimate transmission

The TVG technician role is permitted to **send an already-issued / approved-for-send estimate** when the technician is assigned to the related TVG job, inspection, or equivalent authoritative service context.

This authorization does **not** grant a technician authority to:

- create pricing;
- change price or scope;
- revise quote money state;
- approve an estimate;
- issue an estimate;
- override recipient controls;
- add arbitrary CC/BCC recipients;
- attach arbitrary files;
- expand financial authority.

The estimate sender must enforce the distinction between **transmitting an already-authorized estimate** and **creating/revising/issuing the financial commitment**.

Recipient identity must come from the authoritative customer/quote context. Any attachment path must be restricted to approved estimate-related artifacts.

Office / Manager / Admin retain the existing quote money-state authorities unless a later approved record changes them.

## Authorized Decision 2 — Emergency production lockdown

The Build Coordinator / Production Operator is authorized to apply the already-prepared bounded security changes for the identified exposed functions.

### A. Estimate, invoice, and receipt send functions

Apply the prepared hardening to the production versions actually deployed, not an older main-branch implementation.

Required controls:

- authenticated caller required;
- server-side role/capability check;
- deny by default;
- kill switch / disable capability;
- no arbitrary recipient override;
- no arbitrary CC/BCC;
- no arbitrary attachment injection;
- preserve current legitimate workflow only to the extent proven by the live implementation.

Technician authorization applies only to the estimate-transmission rule above.

Invoice and receipt send functions remain restricted to the existing authorized office/manager/admin financial workflow unless a later Founder-approved record expands that scope.

### B. Diagnostic function

Disable the identified unauthenticated diagnostic function now.

Do not re-enable it unless a later review proves a legitimate caller, required authentication/authorization, and a bounded production purpose.

### C. SMS reply handler

Disable the current reply handler now.

Do not enable the prepared signed replacement until all of the following are verified:

- Twilio signing secret/configuration exists in the approved secret location;
- the exact production webhook URL used by Twilio is confirmed;
- Twilio signature verification is enforced;
- opt-out / STOP behavior is enforced;
- no unauthenticated alternate path remains.

This authorization does not authorize anyone to expose secret values in chat, GitHub, logs, or documents.

### D. Administrative rollback RPC containment

Continue the prepared administrative-RPC lockdown for:

- `execute_rollback_plan`;
- `execute_rollback_plan_dry_run`;
- any directly coupled administrative helper already identified in the same reviewed containment plan.

Remove unauthenticated/public execution and eliminate blanket authenticated execution where it would permit non-admin callers.

Preserve only the minimum verified administrative execution path required by the product.

Do **not** broaden this authorization into unrelated RPC cleanup.

### E. UAT test admin account

Deletion of `uat_testuser@bhfos.invalid` is **NOT AUTHORIZED YET**.

Before deletion:

1. positively identify the production Auth user;
2. confirm it is the intended synthetic/UAT identity;
3. capture a recoverable metadata backup/receipt without exposing a password or secret;
4. confirm no required production test process depends on it.

After that evidence is returned, OCC may route a separate bounded cleanup authorization if required.

## Execution controls

The authorized executor must:

- apply only the reviewed bounded changes;
- record exact production function/RPC names changed;
- record deployed code identity / function version where available;
- record database/security-control statements actually applied;
- verify post-change authentication and role behavior;
- run negative tests for unauthorized/unauthenticated callers;
- avoid real customer communication during testing;
- avoid live charges;
- avoid arbitrary customer-data mutation;
- preserve rollback instructions;
- return evidence to OCC.

## Required verification

Minimum production verification after execution:

1. unauthenticated calls to the disabled/locked functions fail closed;
2. unauthorized authenticated roles fail closed;
3. authorized office/manager/admin paths work where intended;
4. technician can transmit an already-authorized assigned estimate only, and cannot mutate quote money state;
5. arbitrary recipient / CC / BCC / attachment injection is blocked;
6. disabled diagnostic endpoint is not callable;
7. disabled SMS reply handler is not callable;
8. administrative rollback RPCs are no longer callable by unauthorized roles;
9. no unexpected regression in the legitimate send flows;
10. exact before/after production evidence is retained.

## Explicit exclusions

This authorization does **not** authorize:

- deletion of the UAT account;
- reading or disclosing secret values;
- enabling the signed Twilio reply handler before its prerequisites are verified;
- redesign of quote/invoice/receipt workflows;
- unrelated database/RLS/RPC cleanup;
- changes to Network OS;
- bot activation;
- platform-bot Gate C;
- customer communications for test purposes;
- live financial transactions for test purposes.

## Completion rule

The authorization becomes **executed** only when production receipts prove the changes were applied and verified.

Until then:

`FOUNDER-APPROVED — EXECUTION PENDING EVIDENCE`
