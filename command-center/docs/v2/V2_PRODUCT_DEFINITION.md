# BHFOS V2 Product Definition

| Field | Value |
| --- | --- |
| Status | **DISCUSSION DRAFT — NOT IMPLEMENTATION AUTHORITY** |
| Version | 0.1 |
| Date | 2026-07-24 |
| Product | Black Horse Factory OS V2 / TVG CRM |
| Primary business | The Vent Guys |
| Source baseline | V1 closeout at `9369d206bfbcaf32267e9e88518b222146e11de8` |
| Authority | Product discovery and definition only |

## 1. Business purpose

BHFOS V2 is first an **in-house operating system for The Vent Guys**.

Its purpose is to help The Vent Guys consistently turn demand, field labor, inspections, estimates, completed work, billing, and follow-up into profitable revenue while producing a dependable, professional customer experience.

V2 is not being created to compete feature-for-feature with Housecall Pro, ServiceTitan, or every home-service platform. It should be a focused system that fits how The Vent Guys actually operates, reduces friction in the work that generates revenue, and helps every user produce quality work and quality customer-facing reports.

The system may later support a Vent Guys franchise model in which the founder retains and operates the CRM. That is an architectural option to preserve, not authority to build a shared multi-tenant SaaS product now.

## 2. Product promise

BHFOS V2 should make the right work easier to perform, harder to miss, and easier to verify.

For The Vent Guys, that means:

- fewer handoffs and less duplicate entry from lead through payment;
- clear next actions for office and field users;
- fast, mobile-first inspection and job execution;
- estimates and appropriate upsells created from evidence gathered in the field;
- customer approvals captured without ambiguity;
- high-quality before/after evidence and reports;
- reliable invoicing, payment status, and reconciliation;
- useful reporting that shows operational quality and business value;
- safeguards that keep training, test, and synthetic activity out of real customer and financial workflows.

## 3. Primary users

| User | Primary need |
| --- | --- |
| Founder / owner | See what requires attention, protect cash flow, verify performance, and make business decisions without becoming the system operator |
| Office / customer service | Respond to leads, book work, manage customers and locations, prepare quotes, schedule, dispatch, communicate, and collect |
| Field technician / inspector | Know where to go, what to do, what evidence is required, what can be offered, and what must happen before completion |
| Customer | Understand the problem, see evidence, approve work, receive a professional report and invoice, and pay through a clear path |
| Future manager / franchise operator | Run a defined Vent Guys operating model with controlled flexibility and comparable performance data |

Future users do not create present V2 scope. A proposed capability must first improve or protect the TVG operating model.

## 4. Revenue engines

V2 should concentrate on the operating engines that turn labor and opportunity into revenue:

1. **Demand capture and response**  
   Capture where leads came from, respond quickly, qualify the opportunity, and move it to a booked next step.

2. **Booking-to-completion speed**  
   Reduce the time and manual effort between booking, dispatch, field arrival, inspection, approval, work, and completion.

3. **Evidence-led estimates and upsells**  
   Convert legitimate inspection findings into clear recommendations and customer-approved work without encouraging unnecessary selling.

4. **Same-visit and first-time completion**  
   Give the field team the information, approval path, parts visibility, and completion gates needed to finish appropriate work without avoidable return trips.

5. **Billing and collection discipline**  
   Produce correct invoices from approved and completed work, preserve financial controls, and make payment and reconciliation status obvious.

6. **Reporting that demonstrates value**  
   Turn field evidence into consistent reports that help customers understand what was found, what was done, and why the work mattered.

7. **Retention, referrals, and repeat work**  
   Support appropriate follow-up, maintenance reminders, review requests, and account history without creating communication noise.

8. **Marketing visibility and content reuse**  
   Make lead-source performance measurable and support a repeatable social-content operation using approved field photos, videos, results, and customer education. Detailed marketing requirements remain discovery work.

## 5. Core operating loop

The target business loop is:

**Demand → lead response → qualification → booking → dispatch → inspection → recommendation / estimate → customer approval → work order → completion evidence → after-inspection / report → invoice → payment / reconciliation → follow-up**

The loop may branch for estimate-only visits, change orders, commercial work, return visits, and work that cannot safely be completed. Those branches must preserve a clear customer commitment, operational owner, and financial state.

No screen or feature should be treated as successful merely because it stores data. It must help advance, control, or explain this operating loop.

## 6. Product principles

1. **TVG first.** Optimize for the proven in-house operating model before hypothetical external customers.
2. **Revenue with integrity.** Increase conversion and speed without weakening evidence, approval, safety, or financial controls.
3. **Field reality over office theory.** Mobile workflows must work under the time, attention, signal, and photo constraints of real jobs.
4. **One business event, one accountable state.** Avoid duplicate writers, competing records, and screens that disagree about what happened.
5. **Evidence before claims.** Photos, readings, approvals, timestamps, and reports should support customer-facing and internal claims.
6. **Dependability before breadth.** A smaller reliable workflow is more valuable than a large collection of partially working features.
7. **Controlled flexibility.** Allow useful configuration of services, checklists, reports, pricing, and roles without turning every workflow into custom software.
8. **Founder focus is a product constraint.** The system should surface decisions and exceptions, not require the founder to maintain its mechanics.
9. **Automation must remain interruptible.** Automated communication, billing, AI, and integrations need explicit authority, auditability, and safe failure behavior.
10. **Existing code has no automatic right to survive.** V1 is evidence and inventory, not the V2 specification.

## 7. V1 inheritance rule

Every V1 capability, deferred item, proposal, and material code path must receive one V2 disposition:

| Disposition | Meaning |
| --- | --- |
| **Reuse** | Preserve substantially as-is because the workflow, contract, and evidence remain suitable |
| **Redesign** | Preserve the business capability but change the user experience or workflow |
| **Replace** | Meet the need through a different technical or product approach |
| **Abandon** | Remove because it no longer serves the operating model or creates unjustified cost/risk |
| **Defer** | Keep outside the current V2 boundary without treating absence as a defect |
| **Investigate further** | Evidence is insufficient for a responsible decision |

A disposition is not approval to implement. It records the product decision required before architecture or implementation planning.

## 8. V2 boundaries

### Authorized now

- product discovery;
- business-purpose and outcome definition;
- workflow mapping;
- V1 capability disposition;
- user and field research;
- requirements classification;
- UX planning;
- architecture analysis;
- technical spike definition;
- roadmap development after the product definition is ratified.

### Not authorized by this document

- feature coding;
- implementation slicing;
- production deployment;
- database migration or production-data changes;
- Stripe, QuickBooks, or other financial integration changes;
- enabling auto-send, auto-charge, stored cards, portal, or Terminal;
- treating V1 residuals or deferred ideas as approved V2 requirements;
- shared multi-tenant SaaS construction;
- a native mobile rewrite;
- merging TIS or Photo Bundles into V2 without a separate product decision.

## 9. Existing decisions carried as constraints

Until explicitly re-ratified or replaced through a founder decision:

- V2 serves a dedicated TVG deployment.
- One accepted quote creates one canonical job.
- Billable field changes require customer approval; make-safe work does not authorize billable expansion.
- Job completion requires the defined evidence and readiness gates.
- Invoice issue, correction, refund, reconciliation, and immutability controls remain protected.
- Auto-send and auto-charge remain off.
- Saved cards, Stripe Customer Portal, and Stripe Terminal remain out.
- Synthetic and training data must not contaminate customer communications, Stripe, QuickBooks, or live reporting.
- Photo Bundles, full offline, PWA installability, advanced analytics, AI/voice operations, and QuickBooks expansion remain candidates, not commitments.

## 10. Outcomes and measures

V2 planning should define baselines and targets for:

| Outcome | Candidate measures |
| --- | --- |
| Faster demand response | lead response time, contact rate, lead-to-booking conversion |
| Faster job flow | booking-to-dispatch time, arrival-to-completion time, approval wait time |
| More earned revenue | estimate approval rate, evidence-led upsell conversion, average completed-job value |
| Better field productivity | first-time completion, same-visit completion, return trips, technician admin time |
| Stronger cash flow | completion-to-invoice time, invoice aging, payment completion, reconciliation exceptions |
| Better customer proof | report delivery rate, evidence completeness, disputed-scope rate, reviews and referrals |
| Cleaner operations | duplicate records, alternate-writer exceptions, synthetic contamination, manual corrections |
| Better marketing | source attribution, content-ready job evidence, social publishing cadence, lead conversion by source |

Numeric targets will be set only after current-state measurement or a founder-approved business target.

## 11. Product-definition gates

V2 is ready to move from definition into requirements and architecture planning when:

1. the founder confirms the business purpose and product promise;
2. the primary operating loop and important exception paths are mapped;
3. the initial V1 capability inventory has a proposed disposition;
4. revenue outcomes and non-goals are agreed;
5. unresolved production facts are separated from product assumptions;
6. the first delivery boundary is defined without silently authorizing implementation.

V2 is **not ready for feature coding** when any of those gates remains materially unresolved.

## 12. Immediate planning sequence

1. Ratify or revise this Product Definition.
2. Build the V1 capability disposition matrix.
3. Map the current and target demand-to-cash workflows, including field exceptions.
4. Define measurable business outcomes and establish available baselines.
5. Classify candidate requirements as required, conditional, deferred, or rejected.
6. Evaluate architecture only after the workflow and requirement boundaries are stable.
7. Produce a roadmap; seek separate authority before implementation planning or coding.

## 13. Questions reserved for product discovery

- Which service lines and job types must the first V2 delivery support?
- Which parts of lead intake and social marketing must live inside BHFOS versus integrate with another system?
- What evidence is mandatory for each service, recommendation, completion, and report?
- Which recommendations may be priced and approved during the visit?
- Which jobs should be optimized for same-visit completion, and what prevents it today?
- What decisions should the founder see daily, and what should be handled by role-based exception queues?
- What configuration is genuinely needed for TVG teams, and what would create avoidable complexity?
- What franchise compatibility must be preserved now without building franchise or multi-tenant features?
- Which V1 residuals create present operational or financial risk, and which can remain accepted?
- What current measurements exist for response, conversion, completion, invoicing, payment, and repeat work?

---

This document defines what V2 is for. It does not approve a build.
