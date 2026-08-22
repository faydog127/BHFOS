# BHFOS Network OS — Copied Foundation Capability Disposition

| Field | Value |
| --- | --- |
| Status | Draft — planning evidence only |
| Version | 0.1 |
| Date | 2026-08-22 |
| Product | Network OS |
| Source baseline | Pre-product-split BHFOS foundation copied into `network-os/foundation` |
| Implementation authority | None |

## 1. Purpose

This document classifies major capabilities present in the copied BHFOS foundation against the Network OS Product Definition using five dispositions:

- **Keep** — concept and implementation direction fit Network OS closely enough to retain as a foundation, subject to normal verification and terminology cleanup.
- **Adapt** — meaningful implementation or domain value exists, but direct-service assumptions must be changed for Network OS.
- **Reuse** — components, patterns, controls, infrastructure, or code should be selectively reused rather than carrying the capability forward as-is.
- **Retire** — the capability is materially tied to Partner OS/direct-service operations and should not remain an active Network OS product area.
- **Defer** — potentially useful to Network OS later, but not needed for the initial operating loop.

Disposition is not implementation authorization. No schema, migration, refactor, deletion, deployment, or production change is authorized by this document.

## 2. Executive finding

The copied foundation should **not** be rebuilt from zero. It already contains substantial usable infrastructure and several surprisingly relevant domain surfaces.

However, it should also **not** be treated as Network OS with a rename. The strongest reusable areas are contacts/organizations, work records, scheduling/status mechanics, Service Partner prospecting concepts, service catalog, exception/escalation patterns, inspection/evidence infrastructure, communications, reporting/audit, and platform controls.

The largest direct-service assumptions that require removal or isolation are:

- technician-centric job assignment and internal workforce execution;
- direct customer lead-to-quote-to-job sales flow as the primary operating loop;
- direct-service pricing/pricebook assumptions;
- single-sided invoice/payment workflow;
- payroll/internal employee operations;
- residential/direct-marketing workflows;
- TVG-specific vertical and service assumptions;
- legacy tenant-oriented product behavior;
- referral-partner semantics that do not equal a Network OS Service Partner.

## 3. Phase 1 disposition summary

| Capability | Disposition | Phase 1 relevance | Network OS direction |
| --- | --- | --- | --- |
| Contacts / organizations / accounts | Adapt | Critical | Expand into management company → portfolio/region → property/facility → contacts and relationship intelligence |
| Customer list / CRM contact surfaces | Adapt | Critical | Reframe from direct customers into managed customer organizations and property relationships |
| Existing Partner Network / partner prospects | Adapt | Critical | Strong starting point, but replace referral/commission/realtor semantics with Service Partner lifecycle, capability, qualification, geography, capacity, restrictions, and performance |
| Partner submissions / onboarding concepts | Adapt | Critical | Reuse intake mechanics; redesign factual qualification and staged onboarding |
| Service Catalog | Adapt | Critical | Preserve catalog foundation; evolve into governed taxonomy connecting demand, Service Partner capability, qualification, work, and reporting |
| Leads / pipeline | Adapt | Critical for relationship development, not direct booking | Reuse pipeline mechanics for customer prospects, Service Needs, Service Partner prospects, and relationship stages rather than one universal lead funnel |
| Work orders / Jobs | Adapt | Critical | Preserve lifecycle/event foundation; replace internal-technician ownership with managed-service assignment and Service Partner coordination |
| Schedule / appointments | Adapt | Critical | Preserve time/status mechanics; Network OS coordinates Service Partner commitments rather than managing every Service Partner workforce shift |
| Escalations | Adapt | Critical | Strong exception pattern; move from lead-centric escalation to generic work/customer/Service Partner/SLA exceptions with owner, due time, escalation path, and reason codes |
| Inspections / checklists | Reuse | Critical for applicable services | Reuse evidence/checklist engine selectively; make templates service/customer/property specific and suitable for Service Partner completion evidence |
| MIL / media | Reuse | Critical for evidence | Reuse governed media, upload, review, retention, and before/after patterns; strip marketing-first assumptions from operational evidence path |
| SMS / inbox / call logging | Reuse | Important | Reuse communication infrastructure and event logging; bind messages to Network OS customer/work/Service Partner records |
| Audit / system health / data tools | Keep | Critical platform control | Preserve as shared operational-control infrastructure, after Network OS authority and data-scope review |
| Reporting / analytics | Adapt | Important | Replace direct-service KPIs with six Network OS scorecards and portfolio/network metrics |
| CRM Hub / Action Hub | Adapt | Important | Rebuild attention model around coordinator exceptions, relationship follow-ups, matching gaps, SLA risk, and Service Partner issues |
| Quotes / estimates | Adapt | Important | Preserve document/approval mechanics; separate customer quote, Service Partner quote/cost, scope change, and approval rules |
| Invoices / payments / QuickBooks integration | Adapt | Later Phase 1 / Phase 2 | Preserve financial controls and document mechanics; redesign for customer revenue + Service Partner cost + margin/reconciliation |
| Pricebook | Defer / Reuse | Not initial | Reuse catalog/pricing patterns later; Network OS commercial rules differ from direct-service pricebook |
| Marketing suite | Retire from core Network OS | No | Keep out of initial Network OS operational navigation; BHIS business development can be separately defined later |
| Referral partner system | Retire / selective Reuse | No | Do not equate referral partners with Service Partners; reuse only generic relationship/attribution mechanics if needed |
| Payroll | Retire | No | Internal service-company workforce/payroll belongs to Partner OS, not Network OS |
| Technician roster / technician dispatch | Retire as Network OS domain; Reuse mechanics | No | Network OS assigns Service Partners/work commitments; internal technician operations remain Partner OS territory |
| Solo-owner dashboard / direct-service money views | Retire | No | Replace with BHIS management/network economics scorecards |
| HVAC-specific portals/consoles | Retire / selective Reuse | No | Vertical-specific Partner OS artifacts are not Network OS product areas; extract generic Service Partner patterns only |
| Coach/owner business-growth concepts | Defer | No | Not part of Network OS initial managed-network loop |
| Creator/public marketing media workspace | Defer / isolate | No | Operational evidence stays; marketing-content workflow is secondary |

## 4. Detailed dispositions

### 4.1 Contacts, organizations, accounts — ADAPT

**Why it matters:** The existing Contacts surface already relates contacts to `organizations` and `accounts`, which is structurally useful for Network OS.

**What can carry forward:**

- person/contact records;
- organization relationship;
- account classification concept;
- email/phone communication affordances;
- shared table/search/list UI patterns.

**What must change:**

- expand organization hierarchy into management/ownership group, region/portfolio, property/facility, building/unit/asset where applicable;
- add contact roles such as property manager, maintenance director, regional manager, decision maker;
- add relationship owner, relationship status, last/next contact, visit history, preferences, issues, opportunities, satisfaction, and existing-vendor information;
- remove legacy tenant-selection assumptions from product behavior after architecture review.

**Disposition rationale:** Valuable domain foundation, but far short of Network OS relationship intelligence.

### 4.2 Customers — ADAPT

The existing customer surfaces are direct-CRM oriented. Network OS requires a customer-account model centered on organizations, portfolios, properties, and relationship depth.

Do not preserve a flat `customer = person who bought a job` mental model as the Network OS primary account abstraction.

### 4.3 Existing Partners / partner prospects — ADAPT, HIGH VALUE

The copied foundation already has a `Partners` surface backed by `partner_prospects`, onboarding-completion state, partner status, volume/performance tabs, SLA concepts, and partner onboarding navigation.

This is one of the most valuable starting points, but its current semantics are wrong for Network OS in important ways. It currently includes referral codes, commissions/benefits, realtor-persona onboarding, and partner tiers such as Active / At Risk / Dormant.

**Reuse:**

- prospect → onboarding → active concept;
- partner list/search UI;
- status dashboard pattern;
- volume/performance view pattern;
- SLA metadata concept;
- prospect table as migration/discovery input.

**Redesign:**

- rename domain semantics to Service Partner;
- lifecycle becomes Prospect → Contacted → Interested → Application Started → Application Submitted → Documentation Review → Approved → Active → Preferred → Restricted/Suspended → Inactive;
- add service capabilities, specialties, geographies, crews, equipment, capacity, availability, qualifications, documents, expirations, restrictions, customer/property eligibility, declared vs observed capability, and internal performance profile;
- referral commission/benefit logic must not define Service Partner status.

### 4.4 Service Catalog — ADAPT, HIGH VALUE

The existing `services_catalog` and Service Catalog UI provide name, slug, description, category, duration, active state, and CRUD mechanics.

**Keep/reuse:** catalog identity, category concept, active/inactive handling, CRUD patterns.

**Expand:**

- hierarchical taxonomy;
- Service Partner capability mapping;
- qualification requirements by service;
- property/facility applicability;
- customer commercial rules;
- service-specific evidence requirements;
- matching metadata;
- reporting/recruiting dimensions.

The current booking/quote framing is too Partner OS-centric, but the underlying catalog foundation is directly useful.

### 4.5 Leads, Deals, Pipeline — ADAPT

The existing lead system is large and should not simply become the Network OS customer model.

**Useful patterns:** stage tracking, source attribution, follow-up, search, activity, qualification, pipeline visualization.

**Network OS separation required:**

- Customer Prospect / Relationship Development;
- Service Need / Opportunity;
- Service Partner Prospect / Recruiting Pipeline.

These are distinct operational objects and should not be collapsed into one overloaded `lead` concept merely because legacy code uses it.

### 4.6 Jobs / work orders — ADAPT, HIGH VALUE

The existing Jobs implementation already contains a substantial work lifecycle including unscheduled, pending schedule, scheduled, en route, arrived, in progress, on hold, no access, reschedule required, completion pending, completed, and cancelled states. It also has appointment linkage, operational stages, payment terms, field execution panels, and work-order services.

**Strong reusable value:**

- lifecycle/state mechanics;
- work list/filter/search patterns;
- appointment linking;
- execution status concepts;
- completion-pending concept;
- no-access/reschedule/hold exception concepts;
- work-order service abstraction.

**Must be redesigned:**

- technician-centric assignment is not the Network OS primary model;
- internal technician roster and direct workforce scheduling belong to Partner OS;
- Network OS needs Service Partner matching, offer, acceptance/decline, response events, scheduled commitment, completion submission, BHIS review, customer confirmation, rework/dispute, and network performance events;
- customer revenue and Service Partner cost must not be conflated;
- work should link to Service Need, customer hierarchy, qualifications, commercial rules, and assignment history.

### 4.7 Scheduling / appointments — ADAPT

The existing Schedule is substantial and worth preserving as implementation evidence and interaction patterns.

Network OS should coordinate the promised service window and Service Partner commitment, but should not try to become every Service Partner's internal technician calendar.

Future Partner OS integration can exchange authorized schedule/status events.

### 4.8 Escalations — ADAPT, HIGH VALUE

The current Escalations page already provides pending escalation records, priority, reason, realtime updates, manual resolution, and an attention queue.

This is strongly aligned with Network OS's exception-driven operating model.

**Redesign from:** lead-specific escalation.

**To:** generic exception records that may relate to customer, property, Service Need, work order, Service Partner, qualification, SLA, evidence, invoice/cost, or integration failure.

Add owner, due time, escalation tier/path, structured reason code, resolution reason, communication requirement, and SLA impact.

### 4.9 Inspections/checklists — REUSE

The copied codebase contains mature inspection/checklist work, including checklist migrations and field UX work.

Network OS should not assume BHIS performs the inspection itself. Instead, reuse the evidence/checklist engine for:

- Service Partner completion evidence;
- service-specific required proof;
- BHIS validation;
- rework evidence;
- customer reporting;
- property/facility-specific requirements.

Direct technician execution UX should remain primarily Partner OS unless BHIS itself performs specific work.

### 4.10 MIL/media — REUSE, HIGH VALUE

The copied foundation contains a broad media subsystem including All Media, Archive, Before/After, Collections, mobile upload, review queues, quality cleanup, creator workspace, and other governed media workflows.

**Operational evidence path should be reused:** upload, identity/provenance, grouping, review, retention, before/after, evidence linkage, controlled access.

**Marketing/creator path should be isolated or deferred:** Network OS Phase 1 needs completion evidence and customer reporting, not a content-production workflow.

### 4.11 Communications — REUSE

Existing call, SMS, inbox, and document-delivery infrastructure can support Network OS's chain of accountability.

The key redesign is data association: communications must bind to managed customer/property/Service Need/work order/Service Partner records and produce authoritative operational events where required.

Email/SMS remain delivery channels, not systems of record.

### 4.12 Quotes / estimates — ADAPT

Network OS may have multiple quote/approval directions:

- Service Partner quote/cost to BHIS;
- BHIS customer quote;
- NTE approval;
- scope-change approval;
- customer authorization;
- recurring-program pricing.

Reuse document generation, status, delivery, approval, and audit patterns, but do not preserve a single direct-service estimate → customer approval → internal job assumption.

### 4.13 Invoices / financial controls — ADAPT

The existing invoice system has useful document, status, balance, receipt, deletion-control, and QuickBooks integration concepts.

The current implementation is single-sided and tied to leads/jobs/quotes. Network OS requires explicit separation of:

- customer revenue;
- Service Partner cost;
- customer invoice;
- Service Partner invoice/submission;
- approved changes;
- margin/gross contribution;
- payment states on both sides;
- reconciliation;
- exception/rework cost.

Financial-policy decisions remain separately gated.

### 4.14 Pricebook — DEFER / REUSE

A direct-service pricebook should not become the Network OS commercial model.

Reuse product/catalog/pricing UI and validation patterns later where useful, but first define customer agreements, Service Partner agreements, NTE, quote requirements, contracted rates, management/service fees, and other Network OS commercial structures.

### 4.15 Reporting / Analytics / Metrics — ADAPT

Existing analytics components should be treated primarily as UI/query-pattern assets.

Network OS dashboards should be rebuilt around:

1. Customer Capacity;
2. Service Partner Density;
3. Service Coordination;
4. Customer Trust;
5. Demand-to-Capacity Matching;
6. Network Economics.

Primary measures include Network Fulfillment Rate and First-Match Fulfillment Rate.

### 4.16 CRM Hub / Action Hub / Flow Console — ADAPT

The existing attention/console concepts fit Network OS well, but the contents must change.

The Network OS home/operations view should prioritize:

- unassigned Service Needs/work;
- Service Partner response overdue;
- unscheduled accepted work;
- SLA threats;
- missing completion evidence;
- expired qualifications affecting active work;
- customer complaints;
- rework/disputes;
- relationship follow-ups due;
- coverage gaps and external-search-required work.

### 4.17 Audit, system health, environment controls — KEEP

Audit Inspector, system/build health, data tools, environment isolation, authoritative state, and controlled automation patterns are product-family platform strengths.

They should be retained, with a deliberate Network OS authority/RLS/data-classification review before implementation changes.

### 4.18 Marketing suite — RETIRE FROM CORE NETWORK OS

The existing direct-service marketing suite should not remain a core Network OS operating area simply because it exists in the copied code.

BHIS relationship acquisition and Service Partner recruiting may later need campaign/source intelligence, but that should be defined from Network OS needs rather than inheriting Provider/Partner OS marketing funnels.

### 4.19 Referral partner features — RETIRE / SELECTIVE REUSE

Referral Partners, referral codes, commission benefits, and related tiers are not equivalent to Service Partner Network management.

Reuse source attribution or relationship patterns only where separately useful.

### 4.20 Payroll / internal workforce money — RETIRE

Payroll and internal technician compensation are Partner OS concerns. Network OS economics are based on managed customer revenue, Service Partner cost, coordination cost, exceptions/rework, and margin.

### 4.21 Technician identity/roster/field dispatch — RETIRE AS NETWORK OS DOMAIN

Technician mechanics may be useful implementation references, but Network OS should not own Service Partner internal employee rosters as a core assumption.

Network OS assigns/coordinates Service Partners and service commitments. Partner OS owns the Service Partner's internal workforce operations when used.

### 4.22 HVAC-specific partner/vertical components — RETIRE / SELECTIVE REUSE

Existing HVAC Partner dashboards and vertical portals demonstrate useful patterns for external-company status and specialized workflows, but the vertical-specific product area should not carry into Network OS.

Extract generic Service Partner, qualification, portal, and performance patterns only after requirements are approved.

## 5. New Network OS capabilities with no adequate existing equivalent

The copied foundation does not currently provide an adequate authoritative implementation for the following. These should be treated as **new Network OS domains**, not forced into legacy tables merely to save development effort:

- portfolio/region/property/facility hierarchy with relationship intelligence;
- one-minute property visit capture tied to relationship follow-up;
- authoritative Service Need / demand-intelligence object;
- Service Partner capability-by-service and geography model;
- modular qualification layers;
- Service Partner document/compliance expiration framework tied to eligibility;
- current Service Partner availability/capacity model;
- customer/property-specific preferred, mandated, and prohibited Service Partner pools;
- Service Partner offer/open/respond/accept/decline history;
- deterministic eligibility filtering;
- matching/ranking with override history;
- declared vs observed capability intelligence;
- generic exception model with ownership/SLA/escalation;
- Service Partner density/coverage-gap model;
- territory model;
- customer trust / relationship-depth metrics;
- Network Fulfillment Rate / First-Match Fulfillment Rate;
- customer agreement and Service Partner agreement rule resolution;
- two-sided Network OS economics;
- agreement-backed recurring Service Programs;
- portfolio-level managed-service customer reporting;
- controlled Partner OS ↔ Network OS integration contracts.

## 6. Recommended Phase 1 reuse strategy

Do **not** begin Phase 1 by mass-renaming legacy CRM code.

Recommended sequence:

1. Preserve the existing copied code as reference and reusable implementation inventory.
2. Define the authoritative Network OS Phase 1 domain model from approved requirements.
3. Map existing tables/components/services into that model one capability at a time.
4. Reuse components only when their authority, security, data semantics, and UX match the new requirement.
5. Prefer new clean domain objects over overloading `leads`, `partner_prospects`, or technician-centric `jobs` when doing so would create semantic debt.
6. Keep direct-service-only modules out of Network OS navigation even if they remain physically present during transition.
7. Remove or archive obsolete code only after dependency analysis and an authorized implementation slice.

## 7. Phase 1 build-vs-reuse conclusion

### Likely substantial reuse/adaptation

- contacts/organizations UI and some data concepts;
- Service Partner prospect/onboarding UI patterns;
- Service Catalog CRUD foundation;
- Jobs/work-order lifecycle utilities and list patterns;
- schedule/appointment mechanics;
- Escalation queue/realtime patterns;
- inspections/checklists/evidence;
- MIL operational media;
- communication infrastructure;
- audit/system/platform controls;
- document generation/delivery patterns;
- shared UI component system.

### Likely new authoritative domain work

- customer hierarchy/relationship model;
- Service Need;
- Service Partner capability/geography/qualification model;
- Service Partner assignment/offer/acceptance;
- generic exceptions/SLA ownership;
- matching eligibility;
- coverage/density;
- Network OS economics;
- Network OS scorecards.

### Keep out of Phase 1 core

- direct-service marketing;
- payroll;
- internal technician management;
- direct residential booking flows;
- referral commission program;
- creator/social media workflows;
- advanced AI matching;
- mandatory Partner OS adoption;
- generic multi-tenant SaaS.

## 8. Decision

The copied foundation is valuable enough to accelerate Network OS materially, but only through controlled adaptation.

The correct development posture is **domain-first reuse**, not **legacy-first conversion**.

Network OS Phase 1 requirements should now be derived from the Product Definition and this disposition, with explicit acceptance criteria and a clean authoritative model before any schema or application implementation is authorized.
