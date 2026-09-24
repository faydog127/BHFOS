# FOUNDER DECISION — UNAPPROVED-BY-DEADLINE ESCALATION

**Date:** 2026-09-24 (ET)  
**Scope:** TVG Email Automation — Pass 2 / Stage 2  
**Decision status:** ACTIVE — Founder-approved policy  
**Implementation status:** Deferred to Pass 2 / not yet implementation-authorized  
**Pass 1 impact:** NONE — do not expand Pass 1 scope

This addendum records the Founder-approved policy architecture for unapproved-by-deadline escalation. It is durable Decision Register evidence for Pass 2 / Stage 2 design. It does **not** authorize current customer-facing auto-send, Pass 1 SQL/n8n/staging-apply changes, Hostinger activation, Twilio live traffic, or production mutation.

---

## 1. Objective

Avoid unanswered customer inquiries when the Founder is unavailable, while preserving human authority over substantive replies. Escalation must not silently convert an unapproved draft into a customer-facing send.

---

## 2. Escalation ladder

1. **Draft ready** — A draft is prepared and presented for human review (Pass 2 mobile-first review path; see related operator-preference decisions).
2. **Deadline reached** — When the configured review deadline is reached without approval:
   - Send a reminder SMS to the Founder / authorized internal recipient(s).
   - Do **not** immediately auto-send the substantive draft.
   - Default next-business-day (NBD) preparation target remains approximately **8:30 AM local** unless configuration says otherwise.
3. **Grace period** — After the deadline reminder, a configurable grace period applies before any further escalation action.
   - Grace duration is operator-tunable and **must be set before Stage 2 activation**.
   - An unset grace period is `DECISION_REQUIRED` — no silent default that enables send-anyway.

---

## 3. Send-anyway eligibility (positive allowlist only)

If, after the grace period, the draft remains unapproved, automated “send-anyway” of a **substantive draft** is permitted only when **all** of the following hold:

- The response class is on a **positive allowlist** of Founder-approved eligible classes (no negative-exclusion-only logic).
- Validation passes for the draft and routing context.
- The draft is **not** in a prohibited category, including but not limited to: pricing, quote, scheduling, financial, legal, complaint, refund, safety, or any held-category matter.
- Customer/contact policy checks pass (identity, routing, and any separately recorded contact restrictions).
- Eligible response classes are those the Founder has approved separately; do **not** invent class lists as approved.

`send_anyway_enabled` ships **false** and remains false until Stage 2 activation gates are satisfied and Founder/Command Center separately authorize enablement.

---

## 4. Ineligible path — human review + optional fixed fallback ack

When a draft is **ineligible** for send-anyway:

- Keep the item in **human review**; do not auto-send the substantive draft.
- If separately authorized, send an approved **fixed fallback acknowledgment** only (example intent: brief receipt / “we received your message and will follow up” — exact wording requires Founder template approval).
- Fallback templates must be Founder-approved.
- The fallback is a **fixed template**, not free-form AI-generated customer text.

Do not invent final fallback wording as approved in this addendum.

---

## 5. Mandatory pre-send guard — human reply already sent

Before any automated customer-facing send (including send-anyway or authorized fallback):

- **Re-check** whether a human reply was already sent from the Hostinger/manual mailbox (and later from CRM when that detection path exists).
- If a human/outbound reply is detected, **cancel** the automated send.
- `send_anyway` (and related automated customer send paths under this policy) is **not enabled** until reliable manual/outbound reply detection has been demonstrated with evidence.

This guard is mandatory policy architecture for Pass 2; implementation is deferred and evidence-gated.

---

## 6. Configurable audited settings

The following settings are operator-tunable under the standing configuration principle (auditable CRM/admin destination where appropriate). Every change must record **actor, timestamp, setting, previous value, and new value**:

| Setting | Notes |
|---|---|
| Lead time | How far ahead of deadline drafts/reminders are prepared |
| Deadline | Review-deadline clock for unapproved drafts |
| Reminder on/off + timing | Deadline-reached reminder SMS behavior |
| Grace period | Post-deadline wait before further escalation action; must be set before Stage 2 activation |
| Send-anyway on/off | Master enable; ships **false** (`send_anyway_enabled = false`) |
| Eligible response classes | Positive allowlist only; Founder-approved classes required |
| Fallback template | Fixed Founder-approved acknowledgment template reference |
| Fallback on/off | Whether the fixed fallback ack path may fire for ineligible items |

Domain invariants, security controls, authority boundaries, and protected state transitions must not be weakened by configuration alone.

---

## 7. Authority and Stage 2 activation gates

**Authority**

- The Founder approves this **policy architecture**.
- This decision does **NOT** authorize current customer-facing auto-send.
- `send_anyway_enabled` ships **false**.
- Implementation is deferred to Pass 2 / Stage 2 and is not implementation-authorized by this addendum alone.

**Stage 2 activation gate list (all required before enabling send-anyway or related auto-send under this policy)**

1. Mobile review path operational (authenticated view/edit/approve/reject).
2. Validation path proven for eligible drafts.
3. Positive allowlist of Founder-approved eligible response classes recorded.
4. Reliable manual/outbound reply detection demonstrated (Hostinger/manual mailbox; CRM path when in scope).
5. Pre-send cancel guard wired and tested (human reply already sent → cancel automated send).
6. Business-hours / NBD timing configuration set (including grace before Stage 2 activation).
7. Fallback template Founder-approved (if fallback path will be enabled).
8. Audit trail for every tunable setting change.
9. Kill switch available and tested.
10. Controlled test evidence reviewed and separately authorized before any live enablement.

---

## Pass 1 boundary

**Pass 1 impact: NONE.**

Do not expand Pass 1 scope. Do not change Pass 1 SQL, n8n workflows, or staging-apply artifacts except documentation links to this addendum and Decision Register entries. Do not set `send_anyway_enabled` true anywhere. Do not invent eligible response class lists or final fallback wording as approved.

### Related Decision Register entries

- **D028** (follow-up cadence) remains **Open** — related but distinct from unapproved-by-deadline escalation; this addendum does not close D028 or invent a follow-up cadence.
- **D029–D033** record this policy architecture and its open configuration/template gates (see Decision Register).

### Evidence / non-authorization reminder

This file is policy-architecture evidence only. Contained Pass 1 staging continues under existing authorization. Pre-webhook, Hostinger, schedules, production, customer email/SMS, AI customer auto-send, and `send_anyway` remain closed / disabled unless a later explicit Founder/Command Center decision recorded in the Decision Register says otherwise.
