# COMMAND CENTER ADDENDUM — FOUNDER OPERATOR-PREFERENCE DECISIONS

**Date:** 2026-09-24 (ET)  
**Scope:** TVG Email Automation  
**Status:** Founder-approved decisions / Pass 2 design inputs

This addendum records the Founder’s operator-preference decisions for the TVG Email Automation decision register. It supplements the existing Pass 1 staging directive and does not reopen the general design loop.

## Standing configuration principle

Operator-tunable policy should be configuration-driven where practical, with CRM administration as a later destination where appropriate. Configuration changes must be auditable, including the actor, timestamp, setting, previous value, and new value.

Domain invariants, security controls, authority boundaries, and protected state transitions must not be made configurable merely for convenience. A configuration option cannot weaken those protections or authorize a transition that requires a separate decision.

## Founder decisions

### 1. Notification recipients

- The Founder is the only notification recipient for now.
- SMS is the preferred notification channel.
- The architecture must allow future recipients, roles, channels, subscriptions, and escalation paths without redesigning the core intake and notification records.
- Pass 1 may implement the recipient/configuration model needed for internal notifications, including the durable audit trail. This does not authorize additional recipients or live transport activation.

### 2. Draft review experience

- The Pass 2 review experience is mobile-first.
- Reviewers must authenticate on mobile and be able to view, edit, approve, or reject a draft.
- Do not use bearer open approval links. Approval must be tied to an authenticated reviewer and an auditable action.
- This is a Pass 2 design input and is not a Pass 1 authorization to create drafts, responses, or sends.

### 3. Time-of-day policy

- Time-of-day behavior should be configuration-driven, including timezone, working hours, holidays, after-hours acknowledgement behavior, and the next-business-day target of approximately 8:30 AM.
- In Pass 2, prepare the draft before the 8:30 AM target where the applicable policy calls for it.
- Do not allow AI auto-send without approval.
- A fixed after-hours acknowledgement is the first candidate for any narrow auto-send policy. It remains disabled until separately authorized; it is not a general permission for AI auto-send.
- Any material time-of-day preference left unset must remain `DECISION_REQUIRED`, not acquire a silent default.

### 4. Urgent communications

- Record urgent-communication candidates for property management, commercial matters, and fire/smoke/CO/burning-smell situations.
- Pass 1 must not use free-text urgency keywords as a decision mechanism.
- Urgent-communication behavior belongs in Pass 2 unless the Command Center reauthorizes it.
- Emergency acknowledgement language requires separate approval; it must not be invented or inferred from an unapproved keyword rule.

### 5. Reply identity and voice

- The reply identity/voice is **“The Vent Guys Team.”**
- The mailbox already has a signature.
- AI-generated drafts should not duplicate the mailbox signature unless duplication is required by an explicitly approved rendering or delivery path.
- This is a Pass 2 drafting/voice input and does not authorize customer replies or sends in Pass 1.

### 6. Follow-up cadence — open Founder decision

- Follow-up cadence remains **OPEN — FOUNDER DECISION REQUIRED LATER**.
- Research evidence must be gathered before deciding; do not invent a cadence or silently adopt one.
- The eventual policy should be CRM-configurable, subject to the standing configuration principle and the required audit trail.
- Until decided, any material follow-up-cadence preference must remain `DECISION_REQUIRED`.

## Decision Register requirement and phase boundary

The Decision Register must add all six decisions. Items 1–5 are Founder-approved with the boundaries stated above; item 6 is **OPEN / Proposed**. The standing rule is: **no silent defaults — use `DECISION_REQUIRED` when a material preference is unset.**

Pass 1 staging continues under the existing authorization. This addendum does not authorize SQL changes, Hostinger activity, n8n activation, production access or mutation, live mailbox traffic, customer communications, AI drafting, or auto-send. It does not reopen the general design loop. The recipient/configuration model and its auditability may be recorded as Pass 1 implementation inputs; draft review, time-of-day preparation, urgent communications, reply voice, and follow-up cadence remain Pass 2 inputs unless separately reauthorized.
