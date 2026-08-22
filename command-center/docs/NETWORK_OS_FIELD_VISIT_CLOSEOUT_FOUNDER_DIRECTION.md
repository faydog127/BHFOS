# BHFOS Network OS — BHIS Field Visit Closeout Founder Direction

| Field | Value |
| --- | --- |
| Status | Active product/requirements direction |
| Date | 2026-08-22 |
| Owner | Founder |
| Product | Network OS for BHIS |
| Product area | Field Relationship / Sales |
| Applies to | Release 1 / Slice 1 readiness and later field-sales implementation |
| Implementation authority | None |

## 1. Governing rule

> **Field activity is not complete until the next action is already in motion.**

Every boots-on-the-ground property visit must be fully closed out before the
representative leaves the property. The full closeout target is **2–3 minutes**
and must not exceed three minutes for the ordinary supported path.

The real operating standard is:

> **No visit should depend on someone remembering to follow up later.**

## 2. Required representative capture

The closeout must allow the representative to capture in one mobile pass:

- property/account context;
- contact or person spoken with;
- visit outcome;
- service needs or pain points;
- short notes, with voice-to-text capability where device permissions and
  approved data handling allow;
- promised actions;
- next-touch timing or return date.

The workflow should minimize typing and preserve selected property/contact
context throughout the closeout.

## 3. Required system action

Saving the closeout must cause Network OS to:

1. create the authoritative visit/contact record;
2. send the approved follow-up email automatically when policy permits, or
   prepare/queue it for one-tap approval when human approval is required;
3. establish the next follow-up date or explicit no-follow-up disposition;
4. update property/account history;
5. update relationship, opportunity, Service Need, or account status where the
   selected outcome requires an authorized transition;
6. place the account into the correct follow-up pipeline/queue;
7. surface the account automatically when follow-up becomes due;
8. record actor, source, time, outcome, communication state, and next-action
   provenance without silently duplicating sensitive content.

The interface must distinguish **sent**, **queued for approval**, **queued for
delivery**, and **failed**. A failed or incomplete automation may not be shown as
complete; it must remain visible for recovery.

## 4. Completion invariant

A visit is closed only when all required capture is saved and exactly one valid
next-action state exists:

- follow-up sent and next touch scheduled;
- follow-up queued for approval/delivery and next touch scheduled;
- another promised action is assigned and scheduled; or
- an explicit, reasoned no-follow-up disposition is recorded.

Merely saving notes does not close the visit.

## 5. Friction standard

- Basic factual visit capture may retain the existing approximately one-minute
  target.
- The complete closeout—including next action and communication state—must fit
  the **2–3 minute rule**.
- No separate end-of-day CRM cleanup, duplicate entry, email drafting, calendar
  entry, or reminder creation should be required for an ordinary closeout.
- Interrupted, offline, or failed submission must preserve the draft and show
  the representative what remains incomplete; the system must never falsely
  claim an email was sent or a next action was established.

## 6. TIS reuse boundary

TIS is **not a BHIS or Network OS dependency**.

TIS may be mined as reusable source material for useful patterns such as:

- property lookup;
- geolocation and nearby-target discovery;
- routing;
- quick notes and voice-friendly capture;
- contact records;
- visit/activity history.

Any reused pattern must be deliberately copied/adapted into the native Network
OS field workflow under Network OS authority, security, event, and design
contracts. No runtime coupling, mandatory TIS adoption, TIS system-of-record
authority, or TIS merge is implied.

## 7. Purpose

This requirement creates continuous information flow:

- the property receives timely communication;
- BHIS remains current without administrative cleanup;
- BHFOS carries the next action;
- the account reliably resurfaces when due; and
- the next person touching the account has full context.

## 8. Governance effect

This direction activates the product requirement and decision direction only.
It does not activate Release 1 / Slice 1 or authorize application code, schema,
automation deployment, customer email, migration, production mutation, merge,
or deployment.
