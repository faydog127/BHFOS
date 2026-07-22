# Founder Decision Packet — ML-P1 Slice 4 (PD-S4-01…06)

> **Product policy only.** No architecture. No coding until Founder answers.  
> Disposition remains: `SLICE4_PLANNING_REQUIRES_PRODUCT_DECISION`

---

## Standing boundary (not optional unless you override)

### Automatic invoice when a job is completed

**Today’s behavior can create a draft invoice when a work order is marked complete.** That is a **Slice 5 (billing) boundary**, not field execution.

**Recommendation:** Disable or gate invoice creation on job complete for Slice 4 unless you explicitly require invoices at completion.

Completing a job should mean: work + evidence done — **not** “invoice created.”

### Completion with pending or rejected change orders

**Recommended default:**

- **Block** job completion while any change order is still waiting for approval.
- **Rejected / unapproved** extra work is **never billable** and must not count as completed approved scope.

Confirm under **PD-S4-06**.

---

## PD-S4-01 — Emergency or safety work before approval

**Tags:** emergency / safety work before approval

**Field scenario:** Tech is on site for an approved tune-up and finds a gas leak or unsafe condition. Fixing it is outside the approved quote. Customer cannot approve a change order immediately.

**Recommended:** **A** — No out-of-scope work until a change order is approved (safest money control). Choose **B** only if you need a written make-safe allowlist the same day.

**Other options:**

- **A** — No exception until change order approved *(recommended)*
- **B** — Narrow make-safe exception: your allowlist only; required reason + photos; auto draft change order; **still not billable until approved**
- **C** — Other (you specify)

**Operational / financial:** A reduces surprise bills, may delay non-approved work. B speeds safety response; vague allowlists create scope creep. Wrong choice → unsafe delay **or** unpaid/disputed work.

**Technician app:** A blocks extra work and prompts a change-order proposal. B offers “Emergency make-safe” only for allowlisted actions.

**Office:** Sees emergency proposals immediately; approves before anything is billable.

**Customer:** Not billed for emergency work until they (or office under your override rules) approve.

**Change later without migration?** Yes for future rules; past jobs keep what was recorded.

**Founder question:** May a technician do any work outside the approved quote before a change order is approved? **A / B / C** — if B/C, what exactly is allowed?

---

## PD-S4-02 — Can a technician approve their own change order?

**Tags:** technician self-approval · office override

**Field scenario:** Tech proposes adding a condensate pump ($280). Can they tap Approve themselves so work continues without office or customer?

**Recommended:** **A** — Never. Tech proposes only.

**Other options:**

- **A** — Never; propose only *(recommended)*
- **B** — Self-approve under a dollar and/or item cap (you state $X / items)
- **C** — Only named people with a special permission

**Operational / financial:** A slower, stronger control. B/C faster, higher unauthorized-scope risk.

**Technician app:** Propose yes; Approve hidden unless B/C and they qualify.

**Office:** Approves/rejects; break-glass with required reason when skipping customer (see PD-S4-06).

**Customer:** Never treats tech self-approve as “customer approved.”

**Change later without migration?** Yes for future approvals.

**Founder question:** May any technician approve their own change order? **A / B / C** — if B, what limits?

---

## PD-S4-03 — Customer signature or acknowledgement at completion

**Tags:** customer signature / approval

**Field scenario:** Tech finishes. Must the customer sign or tap-acknowledge on the phone before the job can be marked complete?

**Recommended:** **C** or **D** for Slice 4 launch unless every job already depends on signatures (**A**).

**Other options:**

- **A** — Required on every completed job
- **B** — Required by job type or above a dollar amount (state rules)
- **C** — Optional; office may waive with reason
- **D** — Not required in Slice 4; add later

**Operational / financial:** A/B stronger dispute proof, more stuck completes when customer absent. C/D faster completes, weaker proof.

**Technician app:** A/B block Complete until signature (or threshold). C/D no hard block (C: office waiver).

**Office:** Tracks missing signatures; may waive under C.

**Customer:** May be asked to sign on the tech device. This is **not** the same as change-order money approval.

**Change later without migration?** Yes for future completes.

**Founder question:** At job completion, is customer signature/acknowledgement required? **A / B / C / D**?

---

## PD-S4-04 — Who sets prices on change orders?

**Tags:** technician change-order pricing

**Field scenario:** Tech finds extra ductwork. Who puts the dollar amount on the change order the customer will see?

**Recommended:** **A** — Office/admin sets all prices; tech proposes scope/quantities only.

**Other options:**

- **A** — Office prices everything *(recommended)*
- **B** — Tech prices only from your published price book; overrides need office
- **C** — Tech may enter any price; office reviews at approval
- **D** — Other (describe)

**Operational / financial:** A fewest pricing mistakes, office bottleneck. B faster, still controlled. C fastest, highest bad-price risk.

**Technician app:** A no free-form prices. B price-book picker. C editable prices.

**Office:** Sets or overrides prices before customer sees finals (A/B); careful review if C.

**Customer:** Sees final prices only after your pricing authority applied.

**Change later without migration?** Yes for future COs; approved COs keep locked prices.

**Founder question:** Who may set dollar amounts on a change order? **A / B / C / D**?

---

## PD-S4-05 — Field status language (tech + office)

**Tags:** status vocabulary

**Field scenario:** Office asks “where is the tech?” Tech asks “what do I tap next?” Everyone needs the same plain-language steps.

**Recommended:** Accept: Scheduled → On the way → Arrived → In progress → Paused → No access / Reschedule required → Completion pending → Completed. “Dispatched” = scheduled with tech + appointment (not a separate button).

**Other options:** Accept as-is · Accept with your word edits · Keep today’s shorter list only (weaker field clarity).

**Operational / financial:** Clear statuses cut “where is my job?” confusion; skipping new statuses leaves no-access/reschedule messy.

**Technician app:** Large next-action buttons match these words.

**Office:** Same words on the live board; exception queues for No access / Reschedule / Paused.

**Customer:** Does not need internal names; later “tech on the way” messages can use these meanings.

**Change later without migration?** Labels easy to rename; adding/removing real steps later is harder — prefer deciding now.

**Founder question:** Do you accept the recommended field status language, or what exact words should tech and office use?

---

## PD-S4-06 — Who approves a change order (customer vs office)?

**Tags:** customer approval · office override · completion with pending/rejected COs

**Field scenario:** Tech proposes $450 of extra work. Must the customer approve before work continues, or can office approve? Can the job be marked complete while a CO is pending or was rejected?

**Recommended:** **A** — Material COs need customer approval; office break-glass only with required reason. **Block complete while any CO is pending.** Rejected extras never billable.

**Other options:**

- **A** — Customer for material COs; office break-glass + reason *(recommended)*
- **B** — Office may approve any CO; customer path optional
- **C** — Customer required only above $X (state amount)

**Operational / financial:** A/C fewer billing disputes, more waits. B fastest, higher dispute risk. Complete-with-pending or billing rejected work = serious trust/finance failure.

**Technician app:** Cannot treat pending/rejected extras as done.

**Office:** Approval queue; break-glass with reason; completion readiness shows pending-CO blockers.

**Customer:** Approve/reject on material COs under A/C; under B may only get a notice.

**Change later without migration?** Yes for future COs and completion rules.

**Founder question:** Who must approve change orders (**A / B / C**, include $X if C)? Block complete while pending — **Yes/No**? Rejected extras never billable — **Yes/No**?

---

## Copy/paste Founder reply

```
PD-S4-01 Emergency before approval:
PD-S4-02 Tech self-approve CO:
PD-S4-03 Signature at complete:
PD-S4-04 CO pricing authority:
PD-S4-05 Status language:
PD-S4-06 CO customer vs office (+ complete-while-pending Yes/No):
Invoice on job complete (Slice 4): Disable/gate — Yes (recommended) / No, require invoices at complete:
```

**No Slice 4 coding until this packet is answered.**
