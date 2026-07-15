# V1 Module Ownership Map

**Source of truth:** `origin/main` @ `209823b`  
**Rule:** One authoritative owner per business state. Violations listed explicitly.

---

## Ownership matrix

### Lead

| Field | Definition |
| --- | --- |
| Owning module | CRM Intake (`Leads`, Call Console, field customer step) |
| Authoritative table | `public.leads` |
| Authoritative identifier | `leads.id` (uuid) |
| Create | Office CRM; `appointmentService.createCustomer`; field `InspectionFieldCustomerStep`; edge `leads` / intake paths |
| Update | CRM Leads UI; field link/address patch; stage updates via edge |
| Read | CRM, tech inspection session, quotes/jobs/invoices by `lead_id` |
| Conversion rules | Lead is the **operational customer** for money loop. Optional link to `contacts` via `contact_id`. |
| Allowed relationships | `contact_id → contacts`; denormalized address fields; optional `property_id` (pointer only in prod) |
| Forbidden duplicate ownership | Do not invent a parallel “customers” table for V1. Do not treat marketing `properties` as CRM property SoT without a repair release. |
| Violations / ambiguities | UI labels leads as “Customer”. Address also stored as freeform + `property_formatted_address`. |

---

### Customer / Contact

| Field | Definition |
| --- | --- |
| Owning module | CRM Contacts (+ Leads upsert helpers) |
| Authoritative table | `public.contacts` |
| Authoritative identifier | `contacts.id` (uuid) |
| Create / update | Contacts page; Leads contact upsert with column fallbacks |
| Read | CRM; optional join from leads |
| Conversion rules | `contacts.is_customer` exists; **money loop still keys on `lead_id`** |
| Allowed relationships | Lead may reference one contact |
| Forbidden | Treating contacts as invoice/job parent without lead |
| Violations | Dual person records (lead denormalized fields + contacts row) |

---

### Property

| Field | Definition |
| --- | --- |
| Owning module | **Ambiguous** — marketing/scouting `properties` vs CRM service address needs |
| Authoritative table (hosted) | `public.properties` (bigint id, `address_line_1`) — **not CRM-safe** |
| Authoritative identifier (intended CRM) | **UNKNOWN / broken** — `leads.property_id` uuid does not resolve |
| Create | Field new-lead **no longer inserts** into `properties` (hotfix #38). Other CRM paths UNKNOWN. |
| Update / read | Inspection helpers hydrate only numeric ids; UUID skipped |
| Conversion rules | V1 service address SoT for field: `property_formatted_address` → inspection/job address → `leads.address` |
| Allowed relationships | None trusted via PostgREST embed from leads |
| Forbidden | Nested `property:property_id(...)` selects from leads; assuming FK integrity |
| Violations | Local DDL uuid FK vs hosted bigint; `paymentService` still embeds `fk_leads_property` |

---

### Inspection

| Field | Definition |
| --- | --- |
| Owning module | Inspections (CRM editor + Tech PWA) |
| Authoritative table | `public.inspections` |
| Authoritative identifier | `inspections.id` (uuid) |
| Create | CRM InspectionEditor; tech queue/job flows |
| Update | Tech session/review; CRM editor; RPCs for AI/quote/state |
| Read | CRM + tech + report PDF function |
| Conversion | Optional `job_id` link; quote via `inspection_create_quote_from_price_book`; job via quote accept |
| Allowed FKs | `lead_id`, `technician_id → technicians.id`, `quote_id`, `job_id`, `invoice_id` |
| Forbidden | Auto-creating jobs without quote/accept (unless explicit product decision) |
| Violations | `property_id` stored without enforceable FK |

---

### Finding

| Field | Definition |
| --- | --- |
| Owning module | Inspections |
| Authoritative table | `public.inspection_findings` |
| Authoritative identifier | `inspection_findings.id` (uuid) |
| Create / update | AI package RPC + manual Keep/Edit/Remove; tech + CRM |
| Read | Review UI, PDF, preflight |
| Conversion | May spawn recommendations; customer visibility flags |
| Violations | Historical AI/internal visibility complexity — stabilize via tests, not redesign |

---

### Recommendation

| Field | Definition |
| --- | --- |
| Owning module | Inspections |
| Authoritative table | `public.inspection_recommendations` |
| Authoritative identifier | uuid |
| Create | Service recommendation picker; AI bridges; CRM |
| Update | Tech review / CRM |
| Conversion | Prefills quote items via price-book RPCs — **does not create jobs** |
| Violations | Finding-linked vs inspection-level (`finding_id` null) dual patterns (accepted for V1) |

---

### Estimate / Quote

| Field | Definition |
| --- | --- |
| Owning module | Sales / Quotes |
| Authoritative table (canonical) | **`public.quotes`** |
| Authoritative identifier | `quotes.id` (uuid) |
| Legacy table | `public.estimates` (UI modal; no repo CREATE migration) |
| Create | ProposalBuilder / estimate routes; inspection quote RPC; optional `createQuoteFromEstimate` |
| Update | Quote status edges; ProposalList accept |
| Conversion | Status `accepted` → DB trigger creates `jobs` (+ optional draft invoice) |
| Forbidden duplicate ownership | Two writers inventing job from estimate without quote |
| Violations | Route name “estimates” vs table `quotes`; legacy `estimates` still insertable |

---

### Job

| Field | Definition |
| --- | --- |
| Owning module | Operations / Work Orders |
| Authoritative table | `public.jobs` |
| Authoritative identifier | `jobs.id` (uuid) |
| Create | Quote-accept trigger (canonical); manual `jobService.createJob` |
| Update | Work order board, tech job detail, appointment sync |
| Read | CRM jobs, tech queue/detail |
| Conversion | From accepted quote; may link inspections |
| Technician FK | `technician_id → technicians.id` (phase 1.5) |
| Violations | `payment_status` on job vs invoice status dual authority (invoice wins in ops view) |

---

### Appointment / Schedule

| Field | Definition |
| --- | --- |
| Owning module | Scheduling (Calendar / Dispatch) |
| Authoritative table (booking) | `public.appointments` |
| Mirrored fields | `jobs.scheduled_start/end`, `jobs.technician_id` |
| Authoritative identifier | `appointments.id` (uuid) |
| Create / update | AppointmentScheduler, appointment edges, dispatch |
| Read | CRM calendar/dispatch; tech sees **jobs schedule fields** on queue (no tech calendar route) |
| Conversion | Appointment may link `job_id`; trigger syncs schedule onto job |
| Violations | Two schedule surfaces; tech phone path lacks dedicated schedule route |

---

### Invoice

| Field | Definition |
| --- | --- |
| Owning module | Finance / Invoices |
| Authoritative table | `public.invoices` |
| Authoritative identifier | `invoices.id` (uuid) |
| Create | Invoice builder; optional auto-draft on quote accept (config-gated) |
| Update | Invoice status edges; settlement RPCs |
| Read | CRM invoices; public invoice/pay tokens |
| Authority | When linked to job, **invoice status is operational payment stage authority** |
| Violations | Job `payment_status` can lag until reconciliation |

---

### Payment

| Field | Definition |
| --- | --- |
| Owning module | Finance / Payments |
| Authoritative tables | `transactions`, `payment_attempts`, applications |
| Authoritative identifier | transaction / attempt uuids |
| Create | Public pay RPC; Stripe webhook; offline/manual ledger writers |
| Update | Webhook + settlement recalculation |
| Forbidden | Direct silent edits to settled provider payment ids (immutability triggers) |
| Violations | Multiple writers historically; P0 money-model hardening partially done |

---

### Technician

| Field | Definition |
| --- | --- |
| Owning module | Ops / Settings (tech roster) |
| Authoritative table | `public.technicians` |
| Authoritative identifier | `technicians.id` (uuid) |
| Auth link | `technicians.user_id → auth.users` (unique) |
| Create / update | Admin/settings paths (exact UI ownership: partial UNKNOWN) |
| Read | Job/appointment/inspection assignment |
| Rule | Assignment FKs use **`technicians.id`**, not `user_id` |
| Violations | Older migration text and some tests still mention user_id assignment |

---

### User

| Field | Definition |
| --- | --- |
| Owning module | Auth / Settings / admin edges |
| Authoritative table | `auth.users` (+ app metadata `tenant_id`, `role`) |
| Authoritative identifier | `auth.users.id` (uuid) |
| Create | Invite/admin edges; synthetic smoke users |
| Update | Role/tenant metadata via admin functions |
| Read | Session; RLS |
| Violations | Role strings must stay consistent with TenantGuard / tech PWA gates |

---

## Cross-cutting violation register

| # | Violation | Severity seed |
| --- | --- | --- |
| V1 | `leads.property_id` uuid vs `properties.id` bigint — no enforceable relationship | P0/P1 structural |
| V2 | PostgREST relationship embeds assumed in `paymentService` and historical UI | P1 |
| V3 | Dual estimate systems (`estimates` + `quotes`) | P1/P2 |
| V4 | Dual schedule surfaces (appointments + jobs columns) | P2 |
| V5 | Dual payment stage fields (invoice vs job) — mitigated by ops view | P2 |
| V6 | Local migration DDL ≠ hosted property schema | P1 (dev/prod drift) |
| V7 | “Customer” UI means lead, not contacts | P2 UX integrity |
| V8 | Tech schedule page orphaned | P1 mobile scheduling |

---

## Ownership enforcement principles (V1)

1. **Money loop parent is `leads.id`.**  
2. **Sold work creates `quotes` then `jobs`.** Legacy `estimates` must not invent a second job path.  
3. **Invoice owns paid/invoiced operational stage when present.**  
4. **Technician assignments use `technicians.id`.**  
5. **Do not “fix” property FK by migration in the first release without an explicit approved identity design.** Prefer safe fallbacks until Release 1 (data integrity) decides the model.
