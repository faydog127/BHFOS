# BHFOS Network OS — Release 1 / Slice 1 Legacy Dependency Inventory

| Field | Value |
| --- | --- |
| Status | Source inventory complete — hosted-schema verification required |
| Version | 0.1 |
| Date | 2026-08-22 |
| Product | Network OS |
| Release / Slice | Release 1 / Slice 1 — Customer Network + Service Need Foundation |
| Repository / branch | `faydog127/BHFOS` / `network-os/foundation` |
| Inventory base HEAD | `62cbfbc4339668262afff0f179dd110685504715` |
| Evidence class | SOURCE-ONLY |
| Owner | Founder |
| Implementation authority | None — inventory and readiness evidence only |

## 1. Purpose

Identify the legacy database, RLS, function, identity, tenant-scope, and application dependencies that would be touched by Release 1 / Slice 1 before an exact Network OS target data model or migration plan is approved.

This inventory satisfies the source-review portion of the implementation gates in:

- ADR-NOS-001 — Customer Hierarchy Model;
- ADR-NOS-002 — Service Need Authoritative Model;
- ADR-NOS-008 — Operational Event & Audit Model;
- ADR-NOS-010 — Identity, RBAC & RLS;
- ADR-NOS-011 — Legacy Tenant Compatibility.

This artifact does not define a deployable schema and does not authorize implementation, migration creation, migration apply, environment access, or data movement.

## 2. Evidence boundary

### Source-proven

This review inspected tracked repository evidence under:

- `command-center/supabase/migrations/`;
- `command-center/src/`;
- `docs/SUPABASE_SCHEMA.md`;
- the active Network OS Product Definition, Decision Register, requirements, ADRs, design system, and Definition of Ready.

### Not proven

The following are not established by repository source alone:

- the current hosted Supabase table and column definitions;
- which migrations are actually applied in any hosted environment;
- current hosted primary-key types, foreign keys, constraints, indexes, grants, RLS enablement, or policies;
- current row counts, duplicate rates, null rates, or data quality;
- which legacy rows are valid BHIS/Network OS business assets;
- the canonical hosted value representing the BHIS compatibility scope;
- whether dated schema documentation still matches a live environment.

All claims below therefore distinguish SOURCE-PRESENT from HOSTED-UNVERIFIED.

## 3. Executive findings

1. **The copied foundation does not contain a trustworthy canonical schema for all Slice 1 candidates.** `organizations`, `accounts`, and `services_catalog` are referenced by application code or retrofit migrations, but their canonical `CREATE TABLE` definitions are not present in the reviewed migration set.
2. **Local/bootstrap schema and hosted schema have materially diverged.** A tracked migration explicitly states that hosted `leads.property_id` is UUID while hosted `properties.id` is bigint; local bootstrap DDL defines `properties.id` as UUID.
3. **Legacy `leads` is heavily coupled to the application but cannot become the Network OS customer or Service Need authority.** It is the legacy direct-service/customer root and is used across many CRM, quote, job, marketing, inspection, and communication paths.
4. **No source-present authoritative records exist for Portfolio/Region, Relationship, customer-context Contact Role, Property Visit, or Service Need.** These require deliberate Network OS domain design.
5. **The existing service records are semantically split.** `services_catalog` appears in a generic client CRUD page without source-present DDL or tenant filtering; `price_book` has pricing/booking semantics and explicitly disables RLS.
6. **The generic `events` table is structurally reusable only after security and taxonomy design.** Its source-present DDL is generic and append-oriented, but the reviewed creation migration does not establish RLS or a Network OS event contract.
7. **`crm_tasks` may offer reusable follow-up mechanics, but its source-present DDL does not establish RLS.** Existing helper functions are tied to quote, invoice, job, and lead semantics.
8. **Tenant behavior is both a compatibility dependency and a prohibited product-semantic dependency.** The application can derive active tenant scope from URL/local storage and continue after a mismatch with the authenticated JWT claim.
9. **Tenant identifiers are not source-consistent.** Core migrations/backfills use `tvg`, while price-book code and data also use `default`.
10. **Current source cannot prove that contacts, properties, organizations, accounts, events, tasks, or service catalog records are safely scoped.** Exact target modeling must not proceed as if those access boundaries are known.

## 4. Classification method

Each dependency is classified under ADR-NOS-011:

- **Security-critical** — retained or replaced only with explicit authorization/RLS controls and negative tests.
- **Compatibility-only** — may remain temporarily to preserve migration or application stability but is not a Network OS product concept.
- **Obsolete** — should not shape the Network OS model and may later be retired through an authorized migration.
- **Product-semantic** — represents legacy product behavior that conflicts with Active Network OS decisions and must not be carried forward as authority.
- **Candidate reusable infrastructure** — mechanics may be reused after exact semantic, security, and migration review.

A dependency may have more than one classification because its column-level security value can differ from its UI/product meaning.

## 5. Domain dependency inventory

### 5.1 `organizations`

| Dimension | Finding |
| --- | --- |
| Source-present schema | No canonical `CREATE TABLE public.organizations` found in the reviewed migration set |
| Source-present tenant behavior | Included in `20251231_legacy_add_tenant_id.sql`; existing rows would be backfilled to `tvg`, made non-null, and indexed if the table exists |
| Application use | `ContactsPage.jsx` expects a `contacts → organizations(name)` relationship; payment-related legacy code also references organizations |
| Security evidence | `docs/SUPABASE_SCHEMA.md` reports an `Enable ALL for public` policy, but the document is not certified as current hosted evidence |
| Semantic fit | Strong conceptual candidate for Network OS Organization identity, but actual columns, keys, constraints, relationships, and access are unknown |
| Classification | Candidate reusable infrastructure; security-critical; hosted-unverified |
| Controlled disposition | **Do not adopt unchanged.** Obtain hosted schema/RLS evidence, then decide reuse versus additive Network OS organization identity |

### 5.2 `accounts`

| Dimension | Finding |
| --- | --- |
| Source-present schema | No canonical `CREATE TABLE public.accounts` found in the reviewed migration set |
| Source-present tenant behavior | Included in the legacy `tenant_id` retrofit |
| Application use | `ContactsPage.jsx` expects `contacts → accounts(type)`; `AuditInspector.jsx` reads accounts; other legacy services reference accounts |
| Semantic fit | Ambiguous generic account semantics; ADR-NOS-001 expressly rejects forcing hierarchy meaning into a generic type field when ambiguity results |
| Classification | Compatibility-only candidate; product-semantic risk; hosted-unverified |
| Controlled disposition | **Do not use as the conceptual hierarchy root.** Inspect hosted relationships before deciding whether any identity or metadata can be mapped |

### 5.3 `contacts`

| Dimension | Finding |
| --- | --- |
| Source-present bootstrap schema | UUID `id`; nullable text `tenant_id`; first/last name, company, email, phone, customer-conversion fields, timestamps |
| Relationships in bootstrap DDL | No organization, account, property-context, or contextual-role foreign keys in the source-present bootstrap definition |
| Application use | Direct list/create/update/delete behavior across contact and lead workflows; `ContactsPage.jsx` assumes hosted organization/account relationships not represented in bootstrap DDL |
| Tenant use | Index exists; UI commonly filters using `getTenantId()` derived from URL/default rather than authenticated claim |
| RLS evidence | No contact-specific RLS migration found in the reviewed migration set; dated schema documentation reports public full access |
| Semantic fit | Strong candidate for stable person identity; insufficient for multi-context roles required by ADR-NOS-001 |
| Classification | Candidate reusable infrastructure; security-critical; compatibility-only tenant dependency |
| Controlled disposition | Preserve candidate person identities only after hosted schema, duplicate, RLS, and customer-context relationship review; add contextual roles in a separate authoritative relationship model |

### 5.4 `properties`

| Dimension | Finding |
| --- | --- |
| Source-present bootstrap schema | UUID `id`; nullable text `tenant_id`; `address1`, `address2`, city, state, zip, timestamps |
| Hosted divergence evidence | `20260512180000_phase1_inspections_and_job_items.sql` states hosted `properties.id` is bigint while hosted `leads.property_id` is UUID |
| Address divergence evidence | `mlP1S1Identity.js` states hosted properties use `address_line_1` and forbids assuming local `address1` |
| Application use | Address lookup and money-loop/inspection compatibility; multiple migrations avoid or work around the incompatible join |
| Tenant use | Included in legacy retrofit and local index; no source-proven immutable-scope rule for properties |
| RLS evidence | No property-specific RLS migration found in the reviewed migration set; dated schema documentation reports public full access |
| Semantic fit | Conceptually aligned to Property/Facility, but identity, address fields, constraints, and hosted types are unsafe to assume |
| Classification | Candidate reusable data; security-critical; high migration risk; hosted-unverified |
| Controlled disposition | **Blocked from direct reuse decision.** Hosted inspection and an explicit identity/address reconciliation are mandatory before target-model approval |

### 5.5 `leads`

| Dimension | Finding |
| --- | --- |
| Source-present bootstrap schema | UUID `id`; tenant, contact/property pointers, person/company/contact fields, service/source/referral fields, status/stage, timestamps |
| Security mechanics | Source-present tenant-scoped select/write policies use `auth.jwt().app_metadata.tenant_id`; service role has full access; tenant immutability trigger exists |
| Application coupling | Extensive direct use across CRM, customer creation, quotes, jobs, inspections, scheduling, communications, marketing, dashboards, and tests |
| Existing authority | `mlP1S1Identity.js` explicitly makes `leads` the legacy ML-P1 customer authority |
| Network OS conflict | Active ADR-NOS-001 prohibits Lead as customer hierarchy root; Active ADR-NOS-002 prohibits renaming Lead into Service Need |
| Classification | Compatibility-only; product-semantic legacy; security-critical while retained |
| Controlled disposition | Preserve only as an isolated legacy/direct-service compatibility record. Do not make it Organization, Property, Relationship, or Service Need authority. Any mapping requires stable IDs and explicit provenance |

### 5.6 Portfolio/Region

| Dimension | Finding |
| --- | --- |
| Source-present record | No authoritative Portfolio/Region record identified |
| Classification | Missing Network OS domain |
| Controlled disposition | New authoritative design required; optional hierarchy level per ADR-NOS-001 |

### 5.7 Relationship and contextual contact role

| Dimension | Finding |
| --- | --- |
| Source-present record | No dedicated BHIS customer-context Relationship record or multi-context Contact Role record identified |
| Legacy substitutes | Lead/account/contact fields and notes may carry fragments, but do not satisfy ownership, status, follow-up, preferences, strategic notes, or multi-context role requirements |
| Classification | Missing Network OS domain; legacy substitutes are product-semantic debt |
| Controlled disposition | New authoritative Relationship and contextual Contact Role designs required; legacy fragments may be mapped only through reviewed rules |

### 5.8 Property Visit / Contact Event

| Dimension | Finding |
| --- | --- |
| Source-present candidates | `inspections`, `activity_log`, generic `events`, and notes/tasks exist for other purposes |
| Semantic mismatch | `inspections` is service/field evidence tied to lead/quote/job/invoice; it is not a relationship-development property visit record |
| Classification | Missing Network OS domain; existing event/task mechanics may be reusable infrastructure |
| Controlled disposition | New authoritative Visit/Contact Event record required. Do not overload service inspections or unstructured notes |

### 5.9 Service Need

| Dimension | Finding |
| --- | --- |
| Source-present record | None identified |
| Legacy substitutes | Leads, pipeline stages, tasks, notes, estimates, quotes, and jobs carry partial demand/execution semantics |
| Network OS rule | Active ADR-NOS-002 requires a distinct authoritative record that may produce zero, one, or multiple Work Orders |
| Classification | Missing Network OS domain |
| Controlled disposition | New authoritative record required; no simple rename or table alias is acceptable |

### 5.10 `services_catalog`

| Dimension | Finding |
| --- | --- |
| Source-present schema | No canonical table DDL found; table is included in the legacy tenant retrofit if it exists |
| Application use | `ServiceCatalog.jsx` performs direct client select/insert/update/delete with no explicit tenant predicate and describes services as booking/quote services |
| Security evidence | No source-present RLS policy identified for the table |
| Semantic fit | Potential seed for a governed service taxonomy, but current booking/quote semantics and unverified access do not satisfy Network OS stable-reference governance |
| Classification | Candidate reusable data; security-critical; product-semantic/direct-service bias; hosted-unverified |
| Controlled disposition | Inspect hosted schema/data/RLS. Do not authorize direct reuse or client CRUD until stable IDs, scope, governance, deactivation, and reference-integrity rules are defined |

### 5.11 `price_book`

| Dimension | Finding |
| --- | --- |
| Source-present schema | UUID identity, tenant, code, name, category, price, price type, description, active flag, timestamps; later migrations add operational pricing fields |
| Security evidence | `20260217120000_add_price_book_rls.sql` explicitly disables RLS because the table is treated as a public catalog |
| Tenant behavior | Seed data uses `default`; application queries may merge the active tenant with `default` |
| Semantic fit | Pricing/booking artifact, not a neutral Network OS Service Catalog authority |
| Classification | Candidate mapping/reference data; product-semantic direct-service pricing; security posture unsuitable for governed administrative mutation |
| Controlled disposition | May inform service-taxonomy mapping, but must not become the Network OS service authority by default. Pricing remains outside Slice 1 |

### 5.12 `events`

| Dimension | Finding |
| --- | --- |
| Source-present schema | UUID identity, tenant, entity type/id, event type, actor type/id, JSONB payload, created time; entity and time indexes exist |
| Application use | Client-side direct inserts and reads exist; ML-P1 builders place substantial audit content inside payload JSON |
| RLS evidence | Creation migration does not enable RLS or define event policies; current hosted grants/policies are unverified |
| Semantic fit | Useful append-oriented mechanics, but current generic names/payloads do not satisfy ADR-NOS-008 taxonomy, source, occurred/recorded time, sensitivity, versioning, or audit separation requirements |
| Classification | Candidate reusable infrastructure; security-critical; taxonomy debt |
| Controlled disposition | Reuse only after exact operational-event versus security-audit separation, write ownership, payload allowlist, RLS, retention, and idempotency design |

### 5.13 `crm_tasks`

| Dimension | Finding |
| --- | --- |
| Source-present schema | UUID identity, tenant, owner user, lead/source pointers, type/title/status/due/priority/notes/metadata, timestamps |
| Existing mechanics | `ensure_follow_up_task` and queue views create follow-ups for quote/invoice/job/lead contexts |
| RLS evidence | No source-present `crm_tasks` RLS enablement/policy was identified in the reviewed migrations |
| Semantic fit | Potential reusable task/follow-up mechanics; currently tied to legacy lead and money-loop source types |
| Classification | Candidate reusable infrastructure; security-critical; compatibility-only source semantics |
| Controlled disposition | Consider adaptation only after exact ownership, source polymorphism, uniqueness/idempotency, RLS, and Network OS relationship/Service Need linkage rules |

### 5.14 `app_user_roles`

| Dimension | Finding |
| --- | --- |
| Source-present schema | UUID, auth user ID, text role, created time; later tenant retrofit may add `tenant_id` |
| Initial policy | `20251210_create_core_tables.sql` creates read access using `USING (true)` and a service-role full-access policy also using broad predicates |
| Later server helper | ML-P1 server authorization prefers tenant-scoped role rows when available, then falls back to an unscoped role row |
| Semantic fit | Existing roles use direct-service/admin/office/technician/customer language rather than the Active Network OS role families |
| Classification | Security-critical; candidate identity infrastructure; product-semantic role debt |
| Controlled disposition | Supabase Auth may be reused, but role rows and authorization helpers require a Network OS permission model, fail-closed scope rules, and removal of unscoped fallback for protected Network OS actions |

### 5.15 `tenants`, tenant switcher, and tenant utilities

| Dimension | Finding |
| --- | --- |
| Source-present table schema | No canonical `CREATE TABLE public.tenants` found in the reviewed migration set; legacy retrofit adds `tenant_id` to the table if it exists |
| Product UI | Tenant management/onboarding and a `TenantSwitcher` remain in the copied application |
| Client scope resolution | `getTenantId()` uses the first URL segment or a default; selected scope may also come from local storage |
| Auth-context behavior | `SupabaseAuthContext.jsx` labels selected URL/local-storage tenant as the active source of truth and logs—but does not block—mismatch with JWT tenant claim |
| Network OS conflict | Active DEC-NOS-014 and ADR-NOS-011 prohibit tenant selection, switching, generic provisioning, and arbitrary tenant product behavior |
| Classification | `tenant_id` as security scope: security-critical/compatibility-only. Tenant UI and selectable client scope: obsolete/product-semantic and prohibited |
| Controlled disposition | Retain only a non-user-selectable canonical BHIS compatibility scope where required. Exclude tenant switcher/management/provisioning behavior from Network OS. Derive protected scope server-side/authenticated, never from URL/local storage alone |

## 6. `tenant_id` dependency classification

| Dependency | Current source behavior | Classification | Required handling before implementation |
| --- | --- | --- | --- |
| `organizations.tenant_id` | Conditional legacy retrofit to non-null `tvg` | Security-critical / compatibility-only / hosted-unverified | Verify hosted schema and policies; select canonical BHIS scope |
| `accounts.tenant_id` | Conditional legacy retrofit to non-null `tvg` | Compatibility-only / hosted-unverified | Inventory actual use; do not expose account/tenant switching semantics |
| `contacts.tenant_id` | Nullable in bootstrap DDL; client filters use URL/default | Security-critical | Verify hosted nullability/RLS; enforce server-derived BHIS scope |
| `properties.tenant_id` | Nullable in bootstrap; legacy retrofit may make non-null | Security-critical | Reconcile hosted bigint identity and scope before reuse |
| `leads.tenant_id` | JWT-scoped RLS and immutability present in source | Security-critical / compatibility-only | Retain for legacy isolation; do not make lead a Network OS root |
| `services_catalog.tenant_id` | Conditional retrofit; UI does not filter by tenant | Security-critical / hosted-unverified | Inspect and block unscoped direct CRUD until governed |
| `price_book.tenant_id` | Uses active tenant plus shared `default`; RLS disabled | Product-semantic pricing / compatibility | Keep outside authoritative Service Catalog; no Slice 1 pricing authority |
| `events.tenant_id` | Generic text scope; direct client insert patterns | Security-critical | Define write ownership, RLS, payload rules, and canonical BHIS scope |
| `crm_tasks.tenant_id` | Generic text scope; security-definer task creation | Security-critical / compatibility | Define RLS and allowed Network OS source types |
| `app_user_roles.tenant_id` | Retrofitted later; helper may fall back to unscoped row | Security-critical | Remove ambiguous fallback for protected Network OS actions |
| URL/local-storage tenant | User/client selectable active scope | Obsolete / prohibited product semantic | Must not authorize or scope Network OS records |
| `TenantSwitcher` and tenant admin pages | Generic multi-tenant application behavior | Obsolete / prohibited product semantic | Exclude from Network OS navigation and authority |

## 7. Identifier and schema conflicts

### 7.1 Property identity conflict

- Local bootstrap: `properties.id uuid`.
- Tracked hosted-compatibility statement: hosted `properties.id bigint`.
- Tracked lead/inspection pointer: UUID.
- Result: no foreign-key-safe property identity can be inferred from repository source.

**Gate:** obtain hosted column/constraint evidence and design a stable Network OS Property/Facility identity before any migration mapping.

### 7.2 Address-field conflict

- Local bootstrap: `address1`, `address2`, `zip`.
- Tracked hosted policy in `mlP1S1Identity.js`: `address_line_1`, with explicit prohibition against inventing `address1` on hosted properties.
- Result: field mapping is environment-dependent and cannot be assumed.

**Gate:** hosted schema inspection plus normalized address and migration mapping.

### 7.3 Customer identity conflict

- Legacy ML-P1 code calls Lead the authoritative customer.
- Active Network OS architecture requires stable Organization and Property/Facility identities independent of Lead/Contact/Work Order.
- Result: legacy IDs may serve as provenance/mapping references only.

**Gate:** explicit identity-map rules and duplicate resolution.

### 7.4 Tenant identifier conflict

- Legacy retrofit backfills `tvg`.
- Price-book seed and application fallback use `default`.
- Auth context defaults to `tvg` but may accept a URL/local-storage value.
- Result: the canonical BHIS compatibility scope is not source-proven.

**Gate:** select and document one immutable canonical BHIS scope after hosted evidence collection; define mapping for any alternate legacy values.

## 8. RLS and authorization evidence matrix

| Area | Source-present positive evidence | Source-present gap or risk | Inventory result |
| --- | --- | --- | --- |
| Leads | JWT `app_metadata.tenant_id` select/write policies; tenant immutability | Service role full access; legacy semantics | Reusable security pattern only, not reusable domain authority |
| Contacts | Tenant column/index | No reviewed contact RLS migration; dated docs report public full access | **Blocked pending hosted verification and Network OS RLS design** |
| Properties | Tenant column/index/retrofit | No reviewed property RLS migration; dated docs report public full access | **Blocked** |
| Organizations | Conditional tenant retrofit | No canonical DDL; dated docs report public full access | **Blocked** |
| Accounts | Conditional tenant retrofit | No canonical DDL or reviewed RLS | **Blocked** |
| Service catalog | Conditional tenant retrofit | Direct unscoped client CRUD; no canonical DDL/RLS | **Blocked** |
| Price book | Public read intent | RLS explicitly disabled; pricing is outside Slice 1 authority | Do not use as protected Network OS taxonomy authority |
| Events | Generic append table/indexes | No reviewed RLS/policy in creation path; direct client writes | **Blocked** |
| Tasks | Generic follow-up table/functions | No reviewed task RLS | **Blocked** |
| Roles | Auth user relationship and server helper patterns | Broad read policy; unscoped fallback; legacy role semantics | **Blocked pending Network OS permission model** |
| Client tenant context | JWT resolution utilities exist | URL/local-storage may become active scope; mismatch does not block | **Must not be reused as authorization** |

UI filtering and route hiding are not counted as positive authorization evidence.

## 9. Application dependency hotspots

### High-coupling legacy surfaces

- `command-center/src/pages/crm/Leads.jsx` and related lead pages: direct customer/contact conversion and broad lead lifecycle behavior.
- `command-center/src/pages/crm/ContactsPage.jsx`: assumes hosted contact relationships to organizations and accounts; filters by URL/default tenant.
- `command-center/src/pages/crm/ServiceCatalog.jsx`: unscoped direct CRUD against hosted-only `services_catalog` semantics.
- `command-center/src/pages/crm/FlowConsole.jsx` and `command-center/src/services/emailService.js`: direct task reads/writes.
- `command-center/src/services/mlP1S1QuoteDraftService.js` and `command-center/src/lib/mlP1S1AuditEvents.js`: legacy lead/customer and generic event contracts.
- `command-center/src/contexts/SupabaseAuthContext.jsx`, `command-center/src/lib/tenantUtils.js`, and `command-center/src/components/TenantSwitcher.jsx`: generic selectable tenant behavior.

### Reuse boundary

These files may supply interaction or infrastructure references, but none is authoritative for Network OS domain ownership, status semantics, permissions, or screen design. Direct copying would violate the active domain-first reuse rule.

## 10. Data migration inventory still required

Repository source cannot determine which actual rows should move into Network OS. Before a migration plan can be approved, a read-only evidence collection must produce:

1. exact hosted schemas for candidate tables;
2. exact keys, foreign keys, constraints, indexes, RLS enablement, policies, grants, triggers, and dependent views/functions;
3. row counts by tenant/scope value;
4. null/duplicate/invalid identity statistics;
5. organization/property/contact relationship coverage;
6. property ID/type/address-field reconciliation;
7. `tvg`, `default`, null, and other tenant/scope value counts;
8. service catalog versus price-book overlap and stable-reference usage;
9. event/task payload/source-type distributions;
10. identification of true BHIS relationship/demand assets versus Partner OS/direct-service/test/training data.

No customer row extraction or production mutation is authorized by this inventory.

## 11. Required hosted-schema evidence packet

The next evidence packet should be generated through an authorized read-only diagnostic path and must redact or aggregate customer data. It should include:

- environment identifier and evidence classification;
- exact inspected commit/tool version;
- schema metadata only unless aggregate data profiling is separately authorized;
- no secret values;
- no unrestricted contact, access-instruction, resident, payment, or qualification data;
- query text or repeatable inspection commands;
- timestamp and actor;
- explicit statement that no DDL/DML/migration was executed;
- result hashes or saved redacted outputs where practical.

If only a non-production environment is authorized, the evidence must be labeled non-production and must not be treated as proof of production schema parity.

## 12. Readiness disposition

### Source inventory gate

**PASS — SOURCE-ONLY.** The repository dependencies and material conflicts needed to plan hosted inspection are identified.

### Exact target data-model gate

**BLOCKED.** Hosted schema, identity, relationship, RLS, and data-quality evidence is missing.

### Migration/cutover gate

**BLOCKED.** No row-level migration, canonical BHIS scope, mapping, cutover, or rollback plan can be approved from repository source alone.

### Implementation authority

**NONE.** This inventory does not activate Release 1 / Slice 1 and does not authorize code, schema, migration, environment mutation, deployment, merge, or production action.

## 13. Exact next controlled action

Prepare and execute an **authorized read-only hosted-schema evidence collection** for the Slice 1 candidate objects:

- `organizations`;
- `accounts`;
- `contacts`;
- `properties`;
- `leads`;
- `services_catalog`;
- `price_book`;
- `events`;
- `crm_tasks`;
- `app_user_roles`;
- `tenants`;
- directly dependent views, functions, triggers, grants, and policies.

After that evidence is reviewed, the Command Center may draft the exact Slice 1 target domain/data model and migration-compatibility plan. No implementation packet should be prepared before those steps are complete.
