# BHFOS V2 — Product Definition

| Field | Value |
| --- | --- |
| Status | Draft |
| Version | 0.2 |
| Owner | Founder |
| Last reviewed | 2026-08-01 |
| Active governance baseline | `f81ed30` |
| Supporting product source | Closed PR #125 at `d0f57b0` |
| Implementation authority | None — product-definition planning only |

## 1. Authority and status

This document defines the proposed product direction for BHFOS V2.

Active DEC-V2-001 through DEC-V2-010 and the active Command Center governance remain binding. Closed PR #125, V1 closeout material, demonstrations, screenshots, founder discussions, and operational observations are supporting evidence only unless incorporated into an active decision or explicitly ratified with this document.

This draft does not:

- ratify the Product Definition;
- approve requirements or architecture;
- authorize a release;
- authorize application implementation;
- authorize migrations, deployment, or production changes;
- authorize financial-policy changes; or
- activate any AI or automation capability.

This draft proposes two material directions that require separate governing decisions before ratification:

1. multi-tenancy is reserved for a separate future build and must not influence the current TVG platform; and
2. BHFOS V2 is an AI-native, founder-by-exception operating platform.

Until those decisions are approved, active governance remains controlling.

## 2. Business platform definition

BHFOS V2 is the dedicated business operating platform for The Vent Guys.

It is intended to connect marketing, demand generation, sales conversion, customer and property management, scheduling, field execution, evidence, reporting, billing, collections, retention, management visibility, and business controls into one dependable operating system.

BHFOS is not complete merely because individual modules exist. The platform is complete only when the approved core capabilities operate together through dependable end-to-end business workflows with:

- authoritative records;
- controlled handoffs;
- clear ownership;
- visible exceptions;
- recoverable failures;
- usable office and field experiences;
- trustworthy reporting; and
- validated financial, security, and production controls.

The Product Definition establishes the full business-platform direction. It does not assign every capability to the first release.

## 3. Business purpose

BHFOS V2 should help The Vent Guys:

- create and capture qualified demand;
- convert opportunities into scheduled and approved work;
- perform field services dependably;
- collect and organize professional evidence;
- produce useful customer reports;
- invoice, collect, and reconcile revenue accurately;
- retain and reactivate customers;
- grow residential and commercial relationships;
- understand business performance; and
- reduce routine founder involvement without weakening control.

The platform must first become stable and dependable for one operating company: The Vent Guys.

## 4. Product promise

BHFOS V2 should make the right work easier to perform, harder to miss, and easier to verify.

It should:

- reduce handoffs and duplicate entry;
- make next actions clear;
- support fast real-world office and field capture;
- connect evidence to findings, recommendations, approvals, reports, and outcomes;
- preserve financial and operational integrity;
- automate approved routine work;
- prepare decisions before they reach the founder;
- surface material exceptions, risks, and opportunities; and
- make business value visible.

The founder should operate primarily through strategy, approvals, exceptions, risks, opportunities, and performance review rather than repetitive workflow administration.

## 5. Current users

| User | Current need |
| --- | --- |
| Founder / owner | Understand performance, protect cash flow, review material exceptions, approve high-impact decisions, and avoid manually coordinating routine work |
| Office / customer service | Respond, qualify, book, schedule, communicate, prepare quotes, follow up, collect, and resolve customer or workflow exceptions |
| Field technician / inspector | Know where to go, what to do, what evidence is required, what is authorized, and what must happen before completion |
| Customer | Understand the problem, review evidence, approve work, receive reports and invoices, communicate clearly, and pay |
| Approved marketing or content user | Access governed, approved business information and media needed for marketing execution without gaining unrestricted operational access |

Commercial customer contacts are included within the Customer role where applicable.

Future franchise operators, tenant administrators, external operating companies, and shared-SaaS users are outside the current user model.

## 6. Operating problem

TVG needs one dependable operating platform that works under:

- office interruptions;
- field time pressure;
- imperfect connectivity;
- evidence requirements;
- customer approvals;
- financial controls;
- changing schedules;
- vendor outages;
- recurring work;
- marketing and sales follow-up;
- customer-retention needs; and
- limited founder attention.

The product must reduce fallback to phone Notes, texts, memory, spreadsheets, disconnected tools, and duplicate systems because BHFOS is slower, harder to use, incomplete, or unreliable.

The current system also contains legacy tenant behavior that requires a user to select a tenant during login even though the active product is a dedicated TVG operation. That creates unnecessary friction and presents multi-company behavior outside the current product boundary.

## 7. Core business operating loop

**Market presence and demand generation -> lead capture and attribution -> response and qualification -> opportunity follow-up -> booking or next-step commitment -> scheduling and dispatch -> inspection or planned service -> recommendation or estimate as needed -> customer approval as needed -> authorized work -> completion evidence -> customer report -> invoice -> payment and reconciliation -> review, referral, retention, reactivation, and renewed demand**

Not every service or customer journey follows every step.

The Workflow Map must define which steps are:

- required;
- optional;
- repeated;
- skipped;
- automated;
- AI-assisted;
- approval-controlled; or
- exception-driven

for each approved workflow.

Important exception families include:

- estimate-only visits;
- same-visit work;
- unscheduled add-ons;
- return visits;
- unsafe-to-proceed work;
- deferred recommendations;
- stalled estimates;
- commercial recurring service;
- multi-property customer accounts;
- schedule changes;
- change orders;
- failed communications;
- payment and reconciliation exceptions;
- media-consent exceptions; and
- automation failures.

Detailed workflow states do not belong in this Product Definition.

## 8. Core platform capability domains

The following are core business-platform capabilities. Their inclusion here does not assign them to a specific release or authorize implementation.

### 8.1 Marketing and demand generation

BHFOS should support business visibility across:

- lead sources;
- campaigns and promotions;
- website and local-search demand;
- educational and social content;
- reputation and review generation;
- referral activity;
- customer reactivation;
- seasonal service opportunities;
- commercial prospecting; and
- booked and collected revenue by source or campaign where practical.

BHFOS may integrate with specialized marketing platforms rather than replacing them. Marketing performance must still be visible within the business operating platform.

### 8.2 Lead and opportunity conversion

BHFOS should support:

- lead capture;
- response;
- qualification;
- booking;
- estimate follow-up;
- declined or deferred recommendations;
- stalled opportunities;
- lost opportunities;
- same-visit opportunities;
- commercial sales opportunities; and
- conversion measurement.

Marketing creates demand. This capability converts demand into appropriate work and revenue.

### 8.3 Customer, contact, property, and account management

BHFOS should provide dependable records for:

- residential customers;
- commercial customers;
- contacts;
- service properties;
- communication preferences;
- service history;
- account relationships; and
- multiple properties associated with one customer or commercial account.

Multiple customer properties do not constitute multi-tenancy.

### 8.4 Scheduling, dispatch, time, mileage, and capacity

BHFOS should support:

- appointments;
- technician availability;
- dispatch;
- routing context;
- on-my-way activity;
- work start and finish;
- time tracking;
- mileage;
- schedule changes;
- return visits;
- unscheduled work; and
- capacity visibility.

### 8.5 Field execution and inspection

BHFOS should support:

- job instructions;
- inspections;
- findings;
- required evidence;
- safety conditions;
- add-on opportunities;
- authorized work;
- completion;
- field reporting; and
- interrupted-network recovery.

The field experience must be fast enough that technicians do not routinely fall back to Notes, texts, memory, or disconnected tools.

### 8.6 Media Intelligence Library

The Media Intelligence Library, or MIL, is a core shared platform capability.

MIL should connect governed photos and videos to:

- customers;
- properties;
- appointments;
- jobs;
- inspections;
- findings;
- recommendations;
- completed work;
- reports;
- warranty or dispute evidence;
- internal training;
- customer education; and
- approved marketing activity.

MIL may use AI to assist with:

- classification;
- tagging;
- retrieval;
- before-and-after grouping;
- evidence selection;
- report preparation;
- marketing-candidate identification;
- content-creator asset preparation; and
- reuse history.

Operational evidence, customer-report use, internal training, customer education, content-creator use, and public marketing are separate purposes.

AI classification or recommendation does not grant consent or public-use authority.

### 8.7 Recommendations, estimates, approvals, and authorized work

BHFOS should support:

- findings and recommendations;
- estimate preparation;
- customer review;
- approvals;
- declined work;
- deferred work;
- change orders;
- same-visit authorization;
- work-scope accountability; and
- follow-up.

The platform must distinguish recommendation, estimate, approval, authorization, and completed work.

### 8.8 Customer reporting and communication

BHFOS should support:

- booking confirmations;
- appointment reminders;
- on-my-way notices;
- estimates;
- approval requests;
- service reports;
- invoices;
- payment reminders;
- educational communication;
- review requests;
- referral requests;
- sales follow-up; and
- approved marketing communication.

Operational, transactional, educational, sales-related, promotional, and marketing communications are separate purposes with separate authority and consent requirements.

### 8.9 Financial operations

BHFOS should support or control the operational path for:

- pricing;
- estimates;
- deposits;
- invoices;
- payments;
- credits;
- refunds;
- collections;
- aging;
- reconciliation;
- financial exceptions; and
- accounting integration.

BHFOS does not need to become the accounting system. It must preserve financial integrity and provide traceable operational inputs and outcomes.

### 8.10 Reviews, referrals, retention, and reactivation

BHFOS should support:

- review requests;
- referral activity;
- recurring reminders;
- maintenance cycles;
- customer reactivation;
- deferred-work follow-up;
- repeat-service opportunities; and
- relationship history.

The operating loop does not end when the invoice is paid.

### 8.11 Management visibility and exception control

BHFOS should provide the founder and authorized managers with visibility into:

- demand;
- conversion;
- capacity;
- job progress;
- evidence completeness;
- invoicing;
- collections;
- marketing contribution;
- customer retention;
- operational exceptions;
- financial exceptions;
- automation activity;
- automation failures; and
- system health.

The platform should surface what requires attention rather than requiring the founder to inspect every record.

### 8.12 Shared platform services

Every business capability depends on shared services for:

- authentication;
- roles and permissions;
- authoritative records;
- audit history;
- configuration;
- notifications;
- files and media;
- search;
- integrations;
- background work;
- monitoring;
- backup and restoration;
- environment isolation;
- production safety;
- error recovery;
- data quality;
- manual takeover; and
- controlled automation.

## 9. Capability classification

### 9.1 Core TVG platform

The core TVG platform includes:

- marketing and demand generation;
- lead and opportunity conversion;
- customer, contact, property, and account management;
- scheduling and dispatch;
- field execution and inspection;
- MIL;
- recommendations, estimates, approvals, and authorized work;
- customer reporting and communication;
- financial operations;
- reviews, referrals, retention, and reactivation;
- management visibility; and
- shared platform services.

### 9.2 Strategic candidates requiring explicit disposition

#### Commercial Account Manager

Commercial Account Manager is a proposed dedicated-TVG product area for:

- commercial customers;
- contacts;
- properties;
- recurring service;
- compliance evidence;
- history;
- account growth; and
- multi-property relationships.

It must not introduce tenant abstractions, cross-company administration, or franchise architecture.

Its final core-versus-later classification requires founder disposition and durable source capture.

### 9.3 Deferred differentiators

#### Coach's Corner

Coach's Corner is a proposed differentiator that may use business state and performance signals to offer:

- optional;
- achievable;
- non-punitive;
- practical; and
- outcome-connected

business-growth challenges.

It is deferred from early implementation unless separately authorized. No forced gamification is implied.

### 9.4 External systems or integrations

Some capabilities may remain in specialized external systems while BHFOS retains operational visibility and controlled integration.

Potential external capability areas include:

- accounting;
- payment processing;
- email and SMS delivery;
- maps and routing;
- calendars;
- website management;
- advertising platforms;
- social-media publishing;
- file storage; and
- external AI providers.

The Product Definition does not select vendors or integration designs.

### 9.5 Future separate builds

The following are not part of the current TVG-first platform:

- multi-tenancy;
- tenant provisioning;
- tenant switching;
- cross-company administration;
- per-tenant configuration;
- per-tenant billing;
- franchise management; and
- shared SaaS administration.

These require a separate future product and architecture decision.

## 10. AI-native operating model

BHFOS V2 is proposed as an automation-first, AI-assisted operating platform.

AI is a shared platform capability serving:

- marketing;
- lead intake;
- sales;
- scheduling;
- field execution;
- MIL;
- reporting;
- financial operations;
- customer retention;
- management visibility;
- coaching; and
- platform support.

The platform should:

- observe business events;
- complete approved routine actions;
- prepare decisions;
- identify missing information;
- detect exceptions;
- surface risks and opportunities; and
- reduce repetitive founder administration.

AI does not replace:

- authoritative records;
- controlled workflows;
- permissions;
- approval rules;
- financial controls;
- consent;
- audit evidence;
- human accountability; or
- founder authority.

Core business workflows must remain usable through controlled manual operation when AI or automation is unavailable, inaccurate, slow, disabled, or over budget.

## 11. Founder-by-exception operating objective

BHFOS succeeds when routine business activity proceeds within approved controls without direct founder coordination while material exceptions, risks, opportunities, and decisions remain visible and actionable.

The founder should not need to monitor every:

- lead;
- appointment;
- job;
- estimate;
- report;
- invoice;
- follow-up;
- marketing activity; or
- routine automation.

The founder should receive concise visibility into:

- what changed;
- what requires action;
- what is at risk;
- what opportunity may be missed;
- what automation completed;
- where automation failed;
- what exceeded delegated authority; and
- what decision requires founder judgment.

## 12. Automation authority principle

Every automation or AI-assisted capability must have a defined authority level before implementation.

### Level 1 — Assist

May summarize, search, classify, transcribe, extract, organize, and draft.

### Level 2 — Recommend

May prioritize, flag, suggest, identify opportunities, propose next actions, and prepare decisions.

### Level 3 — Execute low-risk reversible actions

May perform approved actions such as:

- creating internal tasks;
- preparing reports;
- requesting missing information;
- queuing approved communications;
- organizing media; and
- assembling review packages.

These actions must be logged, recoverable, and reversible where practical.

### Level 4 — Execute governed actions within approved limits

May perform higher-impact actions only inside explicit business rules, permissions, approval limits, and monitoring.

Examples may include:

- booking approved service types;
- sending approved follow-up;
- applying configured pricing;
- generating recurring work; or
- publishing preapproved content.

Level 4 authority requires capability-specific approval. It is not authorized by this Product Definition.

### Level 5 — Human authority required

AI may not independently authorize:

- pricing-policy changes;
- customer commitments outside approved rules;
- unusual discounts;
- refunds or credits outside approved limits;
- financial transactions outside approved authority;
- public use of restricted media;
- production deployment;
- release activation;
- governance changes;
- product decisions;
- architecture decisions; or
- founder decisions.

Automation authority must be earned through measured reliability, recoverability, correction rates, cost, and business value.

## 13. Product principles

1. **TVG first:** optimize the dedicated operating model for The Vent Guys.
2. **Complete business platform:** connect marketing, sales, operations, finance, retention, and management rather than building disconnected modules.
3. **Stable platform before expansion:** deliver dependable working modules before future platform expansion.
4. **Revenue with integrity:** improve demand, conversion, productivity, and cash flow without weakening evidence, approval, safety, consent, or financial controls.
5. **Field reality over office theory:** account for time, attention, signal, device, photo, and interruption constraints.
6. **One business event, one accountable state:** avoid duplicate writers, competing records, and ambiguous ownership.
7. **Evidence before claims:** customer, marketing, operational, and internal claims should be supported by appropriate evidence.
8. **Dependability before breadth:** prefer a smaller reliable operating loop over a larger unstable one.
9. **Controlled flexibility:** support useful TVG variation without bespoke sprawl.
10. **Founder focus:** surface decisions and exceptions rather than maintenance mechanics.
11. **AI as an acceleration layer:** core workflows must remain controllable when AI is unavailable.
12. **AI is not the source of truth:** authoritative facts remain in governed records.
13. **Interruptible automation:** automation requires safe failure, auditability, override, and manual takeover.
14. **Authority grows gradually:** autonomous execution must be earned through evidence.
15. **No automatic V1 inheritance:** existing code and behavior are evidence, not the V2 specification.
16. **Environment isolation and production safety:** training, development, testing, staging, and synthetic activity must not contact real customers, mutate production records, enter live payment or accounting systems, or distort production reporting.
17. **Purpose-bound data and media:** access or approval for one purpose does not authorize another.
18. **Measured value:** automation and AI must demonstrate acceptable reliability, cost, and business value.

## 14. Stable-module and platform-completeness standard

A module is not considered working and stable merely because its main screen loads or its ideal workflow succeeds once.

Before a module is considered stable, it should meet approved criteria for:

- end-to-end workflow completion;
- correct data preservation;
- authoritative-state integrity;
- permissions and approvals;
- visible errors;
- retries or recovery;
- manual takeover;
- reconcilable financial and operational outputs;
- expected network and vendor failures;
- audit evidence;
- monitoring;
- support ownership;
- usability;
- field or office adoption;
- acceptable defect severity; and
- reduced fallback to disconnected tools.

BHFOS is not considered a stable business platform until the approved core modules work together through dependable end-to-end workflows.

Exact numeric thresholds belong in controlled benchmark, requirement, risk, and release records rather than this Product Definition.

## 15. Stable-platform-first and single-company boundary

BHFOS V2 must first become a stable, dependable operating platform for The Vent Guys with working modules, reliable workflows, strong field and office adoption, validated controls, maintainable operations, and demonstrated business value.

The current product, architecture, requirements, and releases must optimize for one operating company: The Vent Guys.

### 15.1 Existing tenant structures

Existing `tenant_id` fields, relationships, policies, claims, or records may remain where they are needed for compatibility, security, data integrity, production safety, or controlled migration.

Their presence does not establish multi-tenancy as an active product capability.

Existing tenant structures must be treated as legacy implementation constraints, not as the foundation of current product design.

### 15.2 Normal login experience

Approved users should enter the TVG operating context without being required to select a tenant, organization, franchise, or operating company during normal login.

This is a product direction only. It does not authorize authentication, database, policy, or migration changes.

### 15.3 Current prohibitions

The current V2 program must not introduce:

- tenant provisioning;
- tenant switching;
- organization switching;
- per-tenant configuration;
- per-tenant billing;
- cross-company administration;
- franchise-management controls;
- speculative tenant abstraction; or
- implementation complexity intended primarily to support future multi-tenancy.

Current architecture is not required to preserve speculative multi-tenant readiness.

### 15.4 Future reconsideration

Multi-tenancy may not enter active product scope, architecture design, requirements development, implementation planning, or release scope until the founder confirms that TVG has passed approved benchmarks in:

- internal adoption;
- core operating-loop reliability;
- module stability;
- business results;
- operational maturity;
- security and data controls;
- maintainability; and
- verified external demand.

Limited planning may define benchmark categories and evidence for a future reconsideration. It must not design the multi-tenant product or influence the current TVG platform.

Passing the benchmarks authorizes reconsideration only. It does not authorize multi-tenancy, franchise capability, SaaS development, architecture changes, or implementation.

The founder must approve measurable thresholds and required evidence before any formal multi-tenancy reconsideration begins.

## 16. Architecture and implementation neutrality

This Product Definition may establish product constraints and boundaries. It may not select:

- native, web, or hybrid client architecture;
- database topology;
- Supabase topology;
- hosting;
- vendors;
- payment architecture;
- offline implementation technique;
- AI provider;
- model provider;
- integration design;
- queue technology;
- monitoring technology; or
- deployment design.

The stable-platform-first single-company boundary is a product constraint, not a technical design.

## 17. V1 inheritance rule

Every inherited V1 capability, constraint, residual, deferred item, or material code path must be classified as `Reuse`, `Redesign`, `Replace`, `Abandon`, `Defer`, or `Investigate further` in the Capability Disposition Matrix.

A disposition is not implementation authorization.

V1 rules are not binding automatically. Each rule must instead be confirmed as an active decision, proposed as a new decision, recorded as a requirement candidate, treated as an architecture candidate, treated as a risk-control candidate, placed in capability disposition, or retained as historical evidence only.

This includes financial controls, quote-to-job behavior, auto-send settings, stored-card exclusions, offline candidates, integration boundaries, tenant selection, tenant-related schema, and authentication context.

Existing tenant-related structures must receive a separate technical disposition covering:

- user-facing tenant selection;
- authentication claims;
- session context;
- authorization dependencies;
- row-level security;
- database relationships;
- production records;
- storage paths;
- integrations;
- reports; and
- background work.

Removing the user-facing selector does not authorize deleting tenant-related database structures.

## 18. Candidate outcomes and measures

| Outcome | Candidate measures |
| --- | --- |
| Marketing and demand generation | qualified leads by source, response and booking conversion, booked revenue by source, collected revenue by source, review generation, referral activity, reactivation results, campaign contribution |
| Faster intake | response time, mobile capture time, booking conversion, fallback-to-Notes or text frequency |
| Better opportunity conversion | estimate follow-up completion, stalled opportunities, deferred-work recovery, lost-opportunity reasons |
| Better field adoption | capture completeness for customer, property, appointment, add-on, action, time, mileage, evidence, and completion; technician administrative time |
| Better job flow | approval wait, return trips, same-visit completion, exception resolution |
| Better reporting | evidence completeness, report-preparation time, missing-evidence rate, customer report delivery |
| Stronger cash flow | completion-to-invoice time, aging, payment completion, reconciliation exceptions |
| Better customer proof | disputed-scope rate, reviews, referrals, repeat work |
| Better retention | recurring-service completion, reactivation conversion, deferred-work follow-up, repeat-service rate |
| Better management visibility | exception age, unresolved high-impact decisions, founder manual coordination time |
| Cleaner operations | duplicate records, alternate-writer exceptions, manual corrections, data-quality failures |
| Production safety | environment-isolation violations, synthetic contamination events, unauthorized production mutations |
| Automation value | time saved, completion rate, correction rate, override rate, failed-action rate, cost per completed task, measured business contribution |
| AI quality | approval rate, human correction rate, false-positive and false-negative rates where measurable, performance drift |
| Dedicated-login adoption | approved users entering the TVG workspace without tenant selection; tenant-selection prompts encountered |
| Platform stability | critical workflow success, recoverable-failure rate, serious defect level, monitoring coverage, support ownership, fallback-tool frequency |

Numeric business targets require current-state measurement or founder-approved targets.

Governance and safety controls may establish pass/fail or zero-tolerance limits without waiting for a business-performance baseline.

## 19. Product Definition ratification gates

The Product Definition may be ratified only when:

- the founder approves the business purpose;
- the founder approves the business-platform definition;
- the founder approves current users;
- the founder approves the product promise;
- the founder approves the capability classification;
- the founder approves the AI-native and founder-by-exception direction;
- the founder approves the stable-platform-first single-company boundary;
- the founder approves the principles and major non-goals;
- the founder acknowledges and accepts the recorded unresolved questions;
- the required critique rounds are completed;
- all required findings are reconciled;
- source gaps are resolved, explicitly restated by the founder, or retained as non-binding proposals;
- proposed DEC-V2-011 is approved for activation with this document;
- the decision superseding the future-compatibility portion of DEC-V2-010 is approved; and
- the AI-native, founder-by-exception governing decision is approved.

Product Definition ratification does not authorize application implementation.

## 20. Implementation-authorization gates

Implementation authorization is a separate later gate.

Before an implementation slice begins, the relevant planning package must include the controlled portions of:

- Business Capability Map;
- Workflow Map;
- Canonical Business Model;
- Capability Disposition Matrix;
- AI Capability Register;
- Automation Authority Matrix;
- Data and Consent Matrix;
- Integration Ownership Map;
- Module Stability Standard;
- Architecture Register;
- Requirements Register;
- Risk Register; and
- Release Register.

Each implementation slice also requires:

- an active Requirement ID;
- an active Release ID;
- governing decisions;
- a controlled branch and worktree;
- an identified owner;
- a validation method;
- environment identification; and
- explicit founder authorization where required.

No Product Definition statement is implementation authority by itself.

## 21. Open discovery questions

### 21.1 Business-platform coverage

- Which modules are essential for BHFOS to operate the complete TVG business?
- Which capabilities are strategic additions rather than essential modules?
- Which capabilities should remain in external systems?
- What minimum capability set makes BHFOS a complete TVG business platform?
- Which service lines and job types need first-class support?

### 21.2 Module stability and platform readiness

- What functional, reliability, usability, support, recovery, and adoption criteria must a module meet before it is considered working and stable?
- Which core modules must work end to end before platform expansion may be considered?
- What defect severity, workflow success, recovery, and adoption evidence is required?
- What business-continuity, backup, restoration, degraded-operation, monitoring, and support capabilities are necessary?

### 21.3 Marketing, sales, and retention

- Which marketing activities must BHFOS manage directly?
- Which activities should remain in specialized external platforms?
- Which lead sources, campaigns, referral programs, and reactivation efforts must be traceable through booked and collected revenue?
- What distinguishes a lead, qualified opportunity, estimate opportunity, deferred recommendation, booked job, lost opportunity, and reactivation opportunity?
- What marketing and sales follow-up should be automatic, manual, or approval-controlled?
- What prevents same-visit completion today?
- Which recommendations may be priced and approved during a visit?

### 21.4 Authoritative records and transitions

- Which system or record is authoritative for each major business object and business event?
- What transition and cutover principles will prevent duplicate records, lost work, conflicting sources of truth, or premature retirement of current tools?
- Which historical data should move, remain archived, or be abandoned?
- Which V1 residuals create operational, financial, security, or data risk?
- What data-quality, duplicate-prevention, merge, correction, and historical-preservation principles are required?

### 21.5 Roles, authority, and founder visibility

- Which actions require role-based permission, approval, audit evidence, or founder-only authority?
- What decisions should the founder see daily?
- What should be handled through role-based exception queues?
- What operating, financial, marketing, customer, automation, and system-health information must the founder see regularly?
- What defines a material exception, risk, opportunity, or decision?

### 21.6 AI and automation

- Which AI capabilities are needed in each core business area?
- What authority level applies to each capability?
- What data may each AI capability access?
- What information may be submitted to external AI services?
- What sensitive data must be excluded, redacted, or processed internally?
- What human approval is required?
- What happens when AI is unavailable, wrong, slow, or over budget?
- What manual takeover and emergency-disable controls are required?
- What audit evidence must be retained?
- How will correction, override, and failure data be captured?
- How will reliability, cost, value, and performance drift be measured?
- When may an automation move from drafting to recommendation, approval-controlled execution, or governed autonomous execution?
- How should provider dependence and model lock-in be limited without prematurely selecting multiple vendors?

### 21.7 MIL, reporting, and media use

- What evidence is mandatory for each service, recommendation, completion, and report?
- What AI-assisted media classifications are useful and sufficiently reliable?
- What disclosure or consent is required for operational service-evidence photos and videos?
- What separate consent is required for public marketing use?
- How is consent withdrawal handled?
- What rules govern content-creator handoff?
- What customer, property, or occupant information must be excluded from public use?
- What media may be used for internal training or external AI processing?
- What human review is required before public claims or publication?

### 21.8 Communications and consent

- Which communications are operational, transactional, educational, sales-related, promotional, or marketing?
- What consent and approval apply to each category?
- When must customers be told they are interacting with automation or AI?
- What customer-facing topics require immediate human escalation?
- What identity, tone, and promise limits apply to customer-facing AI?

### 21.9 Financial and security controls

- What payment-data boundaries and architecture controls are required to minimize PCI scope?
- How will raw payment-card data be prevented from entering BHFOS?
- Which pricing, discount, credit, refund, collection, and reconciliation actions require approval?
- What financial events require audit evidence?
- What security, privacy, retention, deletion, correction, and export obligations apply?
- What technician-location tracking is permitted, when, and for how long?

### 21.10 Single-company and future multi-tenancy boundary

- Which current database tables, policies, functions, claims, routes, reports, storage paths, and integrations depend on tenant identifiers?
- Is there exactly one valid production tenant representing The Vent Guys?
- Can the TVG context be resolved safely without a user-facing tenant selector?
- Which tenant references should remain temporarily for compatibility or security?
- What migration and rollback evidence would be required before changing tenant-related production data?
- What measurable thresholds define successful internal adoption, operating-loop reliability, module stability, business results, operational maturity, security readiness, maintainability, and external demand?
- What evidence must the founder review before multi-tenancy may be reconsidered?

## 22. Source and decision traceability

| Source | Authority / use | State |
| --- | --- | --- |
| Active DEC-V2-001 through DEC-V2-010 | Binding governance decisions | Available |
| Active Command Center governance | Binding process and safety rules | Merge `f81ed30` |
| Active Product Definition reconciliation plan | Binding planning process | Merge `f81ed30` |
| Closed PR #125 at `d0f57b0` | Supporting product-definition evidence | Available; not authority |
| V1 closeout and deferred-scope records | Ratified historical evidence | Available under `command-center/docs/v2-handoff/` |
| Field and office observations | Supporting evidence | Exact durable references still required |
| Marketing and business-platform direction | Founder direction | Must be captured durably in review or decision records |
| MIL and reporting direction | Founder direction plus prior project work | Exact durable references still required |
| Coach's Corner direction | Supporting founder direction | Exact durable references still required |
| Commercial Account Manager direction | Supporting founder direction | Exact durable references still required |
| AI-native and founder-by-exception direction | Proposed founder direction | Requires governing decision before ratification |
| Stable-platform-first multi-tenancy boundary | Proposed founder direction | Requires governing decision before ratification |
| Competitor research and demonstrations | Supporting evidence | Exact references required |

A source marked as requiring capture cannot support a binding statement until its relevant finding has been recorded durably, explicitly restated and approved by the founder during Product Definition review, or retained as a non-binding proposal or open question.

## 23. Current conclusion

BHFOS V2 is proposed as a complete, AI-native business operating platform for The Vent Guys.

Its current direction is:

- stable TVG platform first;
- complete business-capability coverage;
- marketing and sales as core;
- MIL as core shared infrastructure;
- AI across the platform;
- founder operation by exception;
- authoritative records and deterministic controls beneath AI;
- staged automation authority;
- human control for high-impact decisions;
- dependable modules before broad autonomy;
- no present multi-tenancy influence; and
- no implementation authority until downstream planning and release gates are satisfied.

The Product Definition remains `Draft` until the required governing decisions, source reconciliation, critique, founder approval, and merge are complete.
