# BHFOS V2 — Product Definition

| Field | Value |
| --- | --- |
| Status | Draft |
| Version | 0.1 |
| Owner | Founder |
| Last reviewed | 2026-08-01 |
| Active governance baseline | `f81ed30` |
| Supporting product source | Closed PR #125 at `d0f57b0` |
| Implementation authority | None — product-definition planning only |

## 1. Authority and status

This reconciled Product Definition draft is governed by active DEC-V2-001 through DEC-V2-010 and the active Command Center foundation. Closed PR #125 is supporting evidence only. This draft does not ratify product scope, approve requirements or architecture, authorize a release, or authorize application implementation, migrations, deployment, or production changes.

## 2. Business purpose

BHFOS V2 is first an in-house operating system for The Vent Guys. It should help TVG turn demand, field labor, inspections, estimates, completed work, billing, and follow-up into profitable revenue while producing dependable customer experiences and professional evidence.

BHFOS V2 is a dedicated operating system for The Vent Guys. The current product, architecture, requirements, and releases must optimize for one operating company and must not introduce multi-tenant, franchise-management, or cross-company capabilities.

Multi-tenancy is reserved for a separate future build requiring explicit founder authorization. The current program is not required to preserve speculative multi-tenant compatibility or absorb present complexity for that future possibility.

## 3. Product promise

BHFOS V2 should make the right work easier to perform, harder to miss, and easier to verify. It should reduce handoffs and duplicate entry, make next actions clear, support fast real-world field capture, connect evidence to recommendations and approvals, preserve financial integrity, and make operational value visible.

## 4. Current users

| User | Current need |
| --- | --- |
| Founder / owner | See exceptions, protect cash flow, verify performance, and make decisions without operating every workflow |
| Office / customer service | Respond, qualify, book, schedule, communicate, prepare quotes, and collect |
| Field technician / inspector | Know where to go, what to do, what evidence is required, and what must happen before completion |
| Customer | Understand the problem, review evidence, approve work, receive reports and invoices, and pay clearly |

Commercial customer contacts are included within the Customer role where applicable. Future managers may be considered only as users of the dedicated TVG operation. Franchise operators, external operating companies, tenants, and SaaS administrators are outside the current user model.

## 5. Operating problem

TVG needs a dependable path from demand to cash that works under office interruptions, field time pressure, imperfect connectivity, evidence requirements, customer approvals, and financial controls. The product must reduce fallback to phone Notes, texts, memory, and disconnected tools because BHFOS is slower or harder to use.

The current system also carries legacy tenant behavior that requires a user to choose a tenant during login, even though V2 is a dedicated TVG operation. This creates unnecessary login friction and presents multi-company behavior that is outside the current product boundary.

## 6. Core operating loop and exception families

**Demand -> lead response -> qualification -> booking or next-step commitment -> dispatch -> inspection or planned service -> recommendation or estimate as needed -> customer approval as needed -> authorized work -> completion evidence -> report -> invoice -> payment and reconciliation -> follow-up**

Important exception families include estimate-only visits, same-visit work, unscheduled add-ons, return visits, unsafe-to-proceed work, commercial recurring service, multi-property accounts, change orders, and payment or reconciliation exceptions. Detailed states belong in `V2_WORKFLOW_MAP.md`.

Not every service follows every step. The Workflow Map must define which steps are required, optional, repeated, or skipped for each approved workflow.

## 7. Strategic product areas

### Established strategic product areas

- Demand capture, response, attribution, and follow-up.
- Field inspection, evidence, recommendations, approvals, and completion.
- Office scheduling, dispatch, customer communication, billing, and reconciliation.
- Customer reporting, education, retention, and referrals.

### Proposed strategic product areas pending source capture and founder disposition

- **Commercial Account Manager:** a proposed dedicated-TVG area for managing commercial customers, contacts, properties, recurring service, compliance evidence, history, and account growth inside one TVG operation. Multiple customer properties do not constitute multi-tenancy. This area must not introduce tenant abstractions, cross-company administration, or franchise architecture.
- **Coach's Corner:** a possible long-term differentiator using business state and performance signals for optional, achievable, non-punitive growth challenges. It is deferred from early implementation unless separately authorized; no forced gamification is implied.
- **Approved reuse of field media for customer education and marketing operations:** a proposed area pending exact source references, consent decisions, data classification, and founder disposition.

Proposed areas are not requirements or release scope merely because they appear here.

## 8. Revenue and operational outcomes

Candidate outcomes include faster demand response, better booking conversion, faster booking-to-completion flow, evidence-led recommendations, appropriate same-visit completion, accurate invoicing, disciplined collection, lower reconciliation exceptions, stronger customer proof, repeat work, and measurable lead-source performance.

Commercial-account growth and approved reuse of field media are strategic outcomes to evaluate, not first-release commitments. Operational evidence, customer reporting, internal training, and public marketing are separate purposes; approval for one does not authorize the others. Operational job evidence remains restricted to its approved service, reporting, safety, warranty, training, or dispute purpose by default. Public marketing use requires separate, recorded authorization and may not be inferred from the existence of the media.

## 9. Product principles

1. **TVG first:** optimize the proven in-house operating model.
2. **Revenue with integrity:** improve speed and conversion without weakening evidence, approval, safety, or financial controls.
3. **Field reality over office theory:** account for time, attention, signal, device, and photo constraints.
4. **One business event, one accountable state:** avoid duplicate writers and competing records.
5. **Evidence before claims:** customer and internal claims should be supported by appropriate evidence.
6. **Dependability before breadth:** prefer a smaller reliable operating loop.
7. **Controlled flexibility:** configure useful TVG variation without bespoke sprawl.
8. **Founder focus:** surface decisions and exceptions rather than maintenance mechanics.
9. **Interruptible automation:** AI, communication, billing, and integrations require safe failure and auditability.
10. **No automatic V1 inheritance:** existing code and behavior are evidence, not the V2 specification.
11. **Environment isolation and production safety:** training, development, testing, staging, and synthetic activity must not contact real customers, mutate production records, enter live payment or accounting systems, or distort production reporting, consistent with DEC-V2-009.

## 10. Boundaries and non-goals

This draft authorizes Product Definition planning only. It does not authorize application implementation, requirements, architecture selection, releases, migrations, deployment, production changes, or financial-policy changes.

Current non-goals include:

- shared multi-tenant SaaS;
- tenant or organization abstraction;
- cross-company data isolation;
- organization switching;
- per-tenant configuration or billing;
- franchise-management capability;
- SaaS administration;
- architectural work intended to preserve or accelerate those capabilities;
- premature commitment to a client-platform or application architecture;
- automatic inheritance of V1 behavior.

The current Product Definition does not require architecture to remain multi-tenant-ready. Reconsideration requires a separate founder-approved benchmark review and active governing decision. The Product Definition does not select PWA/native, Supabase topology, hosting, vendors, payment architecture, offline technique, AI vendor, or integration design.

### Stable-platform-first boundary

BHFOS V2 must first become a stable, dependable operating platform for The Vent Guys with working modules, reliable workflows, strong field and office adoption, and validated financial, security, and production controls.

Multi-tenancy, tenant provisioning, tenant switching, cross-company administration, franchise management, per-tenant configuration, and per-tenant billing are outside the current product, architecture, requirements, and release scope.

Existing tenant-related database structures may remain where required for compatibility, security, data integrity, or migration safety. Their presence does not establish multi-tenancy as an active product capability and must not influence current module design.

Multi-tenancy may be considered only in a separate future build after the founder confirms that the dedicated TVG platform has passed approved stability, module-completeness, adoption, operational, security, and business-value benchmarks.

### Single-company architecture boundary

The current V2 program must be designed and built for one operating company: The Vent Guys.

Current architecture and implementation must not add:

- tenant provisioning;
- tenant or organization switching;
- customer-facing tenant selection;
- per-tenant configuration or billing;
- cross-company administration;
- franchise-management controls;
- speculative tenant abstraction; or
- implementation complexity intended primarily to support a future multi-tenant product.

Existing `tenant_id` fields, relationships, policies, or claims may remain temporarily where they are required for compatibility, security, data integrity, or controlled migration. Their presence does not establish multi-tenancy as a V2 requirement.

The technical disposition of existing tenant-related structures must be determined during architecture and capability review. They may be retained, fixed to the TVG operating context, renamed, redesigned, or removed through separately authorized work.

### Dedicated TVG operating context

V2 must not require users to select a tenant, organization, franchise, or operating company during normal login.

The Vent Guys is the single authorized operating context for the current product. Approved users should enter the TVG operating context directly, subject to their TVG role and permissions.

Existing tenant-related tables, fields, foreign keys, policies, claims, routes, or application logic are legacy implementation residuals. Their presence does not create a V2 multi-tenancy requirement and must not be expanded.

This Product Definition does not authorize deleting or migrating those structures. Their technical disposition requires controlled data-model, architecture, security, and migration analysis.

### Multi-tenancy reconsideration gate

Multi-tenancy may not enter active product scope, architecture design, requirements development, implementation planning, or release scope until the founder confirms that TVG has passed approved benchmarks in all of these areas.

Limited planning may define the benchmark categories and evidence needed for a future reconsideration, but it must not design the multi-tenant product or influence the current TVG platform.

1. **Core platform stability:** The core platform is stable and can be maintained without constant repair or workaround.
2. **Module completeness:** Primary modules work end to end across approved workflows.
3. **Internal adoption:** Office and field users consistently operate through BHFOS, and fallback to Notes, texts, memory, and disconnected tools is reduced to an accepted level.
4. **Core operating-loop reliability:** The approved demand-to-cash workflow operates dependably, and important exceptions are visible, controlled, and recoverable.
5. **Business results:** BHFOS demonstrates measurable improvement or protection in agreed revenue, productivity, customer-proof, or cash-flow outcomes.
6. **Operational maturity:** Roles, permissions, configuration ownership, support responsibilities, and data ownership are stable for the dedicated TVG operation.
7. **Security and data controls:** Environment isolation, access control, audit evidence, production safety, retention, and financial-data boundaries have been validated.
8. **External business case:** There is verified demand and a founder-approved economic reason to support more than one operating company.

Passing these benchmarks authorizes reconsideration only. It does not automatically authorize multi-tenancy, franchise capability, SaaS development, architecture changes, or implementation.

The founder must approve the measurable thresholds and required evidence before any formal multi-tenancy reconsideration begins. Those thresholds may be recorded in the eventual superseding decision or a separately controlled benchmark record.

AI and automation may assist with analysis, drafting, prioritization, preparation, and execution of separately authorized actions. They may not independently authorize pricing or policy changes, customer commitments, financial transactions, production deployment, release activation, or founder decisions.

## 11. V1 inheritance rule

Every inherited V1 capability, constraint, residual, deferred item, or material code path must be classified as `Reuse`, `Redesign`, `Replace`, `Abandon`, `Defer`, or `Investigate further` in the Capability Disposition Matrix. A disposition is not implementation authorization.

V1 rules are not binding automatically. Each rule must instead be confirmed as an active decision, proposed as a decision, recorded as a requirement candidate, treated as an architecture or risk-control candidate, placed in capability disposition, or retained as historical evidence only. This includes financial controls, quote-to-job behavior, auto-send settings, stored-card exclusions, offline candidates, and integration boundaries.

Existing tenant-related schema and login-selection behavior must receive an explicit V2 disposition. The disposition must separately address the user-facing tenant-selection experience; authentication claims and session context; authorization and row-level security dependencies; database tables and foreign keys; production records associated with the current TVG tenant; and integrations, reports, storage paths, and background jobs that depend on tenant identifiers. Removing the user-facing selector does not authorize deleting tenant-related database structures.

## 12. Candidate success measures

| Outcome | Candidate measures |
| --- | --- |
| Faster intake | response time, mobile capture time, booking conversion, fallback-to-Notes/text frequency |
| Dedicated-login adoption | approved users enter the TVG workspace without tenant selection; tenant-selection prompts encountered |
| Better field adoption | capture completeness for customer, property, appointment, add-on, action, time, mileage, evidence, and completion; technician admin time |
| Better job flow | approval wait, return trips, same-visit completion, exception resolution |
| Stronger cash flow | completion-to-invoice time, aging, payment completion, reconciliation exceptions |
| Better customer proof | evidence completeness, report delivery, disputed-scope rate, reviews and referrals |
| Cleaner operations | duplicate records, alternate-writer exceptions, manual corrections |
| Production safety | environment-isolation violations, synthetic contamination events, unauthorized production mutations |
| Better marketing | source attribution, approved content-ready evidence, publishing cadence, lead conversion by source |

Numeric business targets require current-state measurement or founder-approved targets. Governance and safety controls may establish pass/fail or zero-tolerance limits without waiting for a business-performance baseline.

## 13. Product Definition ratification gates

The Product Definition may be ratified only when the founder approves the business purpose, current users, product promise, principles, boundaries, major non-goals, and candidate outcomes; acknowledges and accepts the explicitly recorded unresolved questions; and approves proposed DEC-V2-011 for activation with this document. The three required critique rounds must be completed and all required findings must be reconciled.

Because the benchmark-gated multi-tenancy boundary supersedes the applicable future-expansion language in DEC-V2-010, the ratification package must also include proposed DEC-V2-012. DEC-V2-012 is not created or active in this draft.

Any statement dependent on a source marked `Specific references still must be captured` or `Exact references required` must, before ratification, either receive a durable source reference, be explicitly restated and approved by the founder during Product Definition review, or remain identified as a non-binding proposal or open question.

Product Definition ratification does not authorize application implementation.

## 14. Implementation-authorization gates

Implementation authorization is a separate later gate requiring mapped workflows, classified capabilities, a canonical business model, approved architecture boundaries, ready requirements, an active release, and founder approval. No implementation slice may begin without the active Requirement ID, Release ID, governing decisions, branch/worktree, and validation method required by the active governance foundation.

## 15. Open discovery questions

- Which service lines and job types need first-class support?
- What must live in BHFOS versus integrate with another system?
- What evidence is mandatory for each service, recommendation, completion, and report?
- Which recommendations may be priced and approved during a visit?
- What prevents same-visit completion today?
- What decisions should the founder see daily, and what should be handled through role-based exception queues?
- What TVG configuration is genuinely necessary without creating bespoke complexity?
- What measurable benchmarks define a stable and dependable TVG platform?
- Which core modules must work end to end before future platform expansion may be considered?
- What adoption, workflow-reliability, security, financial-control, and maintainability evidence must the founder review before multi-tenancy may be reconsidered?
- Which V1 residuals create current operational, financial, security, or data risk, and which may remain accepted?
- What measurements exist for response, conversion, completion, invoicing, payment, and repeat work?
- What is Coach's Corner's long-term product role, if any?
- What commercial-account outcomes matter before any first-release commitment?
- How should approved field evidence support reporting, education, internal training, and public marketing separately?
- What technician-location tracking is permitted during active work, on personal devices, and outside work hours; who may access it; and how long may it be retained?
- What disclosure or consent is required for operational service-evidence photos and videos?
- What separate consent is required for public marketing use, and how is consent withdrawal handled?
- What customer and technician data-retention, deletion, correction, and export obligations apply?
- What commercial-account records may contain confidential customer information, and which roles may access them?
- What information may be submitted to external AI services?
- What payment-data boundaries and architecture controls are required to minimize PCI scope and prevent raw card-data storage?
- What interrupted-network behavior is needed for field adoption?
- Which database tables, policies, functions, authentication claims, routes, reports, storage paths, and integrations currently depend on a tenant identifier?
- Is there exactly one valid production tenant representing The Vent Guys?
- Can the current TVG context be resolved safely without a user-facing tenant selector?
- Which tenant references are required temporarily for production compatibility?
- Which tenant references should be renamed, replaced, fixed to the TVG context, or removed?
- What migration and rollback evidence would be required before changing production tenant-related data?

Undocumented conversations cannot be treated as binding answers. Missing sources remain explicit evidence gaps.

## 16. Source and decision traceability

| Source | Authority / use | State |
| --- | --- | --- |
| Active DEC-V2-001 through DEC-V2-010 | Binding governance decisions | Available |
| Active Command Center governance | Binding process and safety rules | Merge `f81ed30` |
| Closed PR #125 at `d0f57b0` | Supporting product-definition evidence | Available; not authority |
| V1 closeout and deferred-scope records | Ratified historical evidence | Available under `command-center/docs/v2-handoff/` |
| Field and office observations | Supporting evidence | Specific references still must be captured |
| Coach's Corner discussions | Supporting evidence | Specific references still must be captured |
| Commercial Account Manager discussions | Supporting evidence | Specific references still must be captured |
| Media Intelligence discussions | Supporting evidence | Exact references required |
| Competitor research and demonstrations | Supporting evidence | Exact references required |

A source marked as requiring capture cannot support a binding statement until its relevant finding is recorded durably. The Product Definition remains `Draft` until formal critique, proposed DEC-V2-011 approval, founder approval, and merge.
