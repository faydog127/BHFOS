# Cross-Repo Terms Rules Blueprint

## Purpose

This document turns the current architecture direction into a concrete implementation plan for:

- `c:\BHFOS\TIS`
- `c:\BHFOS\command-center`
- the shared rules/content layer that both repos must consume

The goal is to prevent:

- duplicated resolver logic
- duplicated protection clause wording
- drift between Speed Mode and Controlled Mode
- historical estimate terms changing silently after later wording updates

## Current State

### TIS

Current rule and copy logic already exists locally:

- `src/utils/speedModeResolver.js`
- `src/utils/speedModeCopy.js`
- `src/pages/EstimateProposal.jsx`
- `speed-mode-resolver-json-contract.md`

Today, TIS is already acting like a domain prototype:

- it resolves status
- it resolves pricing posture and strategy
- it selects overlays and proof guidance
- it generates field-facing copy

That is useful, but it is too much authority for one app if Command Center also needs to render customer-facing terms.

### Command Center

Current estimate/proposal authoring exists in:

- `c:\BHFOS\command-center\src\pages\crm\Estimates.jsx`
- `c:\BHFOS\command-center\src\pages\crm\proposals\ProposalBuilder.jsx`

Command Center already states an architectural rule in `c:\BHFOS\command-center\ARCHITECTURE.md`:

> UI -> API endpoint -> Domain service -> Database

That means final terms generation and snapshot persistence should not live as ad hoc UI composition inside `ProposalBuilder.jsx`.

Right now, `ProposalBuilder.jsx` still directly owns `header_text` and `footer_text` editing in the page state. That is the exact area that should move behind shared rules plus a controlled persistence path.

## Decision

Use this split:

- Supabase = shared content store and snapshot record
- shared domain package = rule engine and composition brain
- TIS = field intake, Speed Mode preview, handoff inputs
- Command Center = final estimate/proposal rendering and snapshot persistence

## Recommended Near-Term Shape

Build a third shared code location first.

Recommended repo:

```text
c:\BHFOS\tvg-field-rules
```

Recommended package name:

```text
@tvg/field-rules
```

If a third repo is not practical immediately, create the same package structure in a dedicated shared location and publish or link it privately. Do not copy the same files into both app repos.

## Target Ownership Model

### Shared Domain Package Owns

- resolver input and output contracts
- statuses
- guardrails
- clause codes
- pricing posture codes
- strategy codes
- proof type codes
- section structure
- rule evaluation
- clause selection
- terms composition rules
- resolver version strings

### Supabase Owns

- clause library records
- template library records
- resolver release metadata
- rendered snapshot records
- change log and audit metadata

### TIS Owns

- field intake UI
- Speed Mode request shaping
- field preview of protection-aware output
- proof capture and proof selection UX
- handoff payload creation for Controlled Mode

### Command Center Owns

- estimate and proposal UI
- customer-facing rendering
- final snapshot creation
- write path for persisted estimate terms
- downstream artifact usage such as email, print, and approval pages

## Non-Negotiable Shared Contract

The following values must be identical across both repos:

- `status_key`
- `guardrail_code`
- `clause_code`
- `price_posture`
- `strategy_key`
- `mode`
- `proof_type`
- `resolver_version`
- `terms_section_schema_version`

If either repo forks those values, the system becomes unreliable.

## Shared Package Layout

Recommended structure:

```text
c:\BHFOS\tvg-field-rules
  package.json
  src/
    contracts/
      speedMode.ts
      controlledMode.ts
      termsSnapshot.ts
    constants/
      statuses.ts
      guardrails.ts
      clauseCodes.ts
      pricingPostures.ts
      strategies.ts
      modes.ts
      proofTypes.ts
    rules/
      resolveStatus.ts
      resolveGuardrails.ts
      resolvePricingPosture.ts
      resolveStrategy.ts
      selectProtectionClauses.ts
    compose/
      composeTerms.ts
      composeFieldPreview.ts
      composeCustomerTerms.ts
    content/
      clauseContent.ts
      templateContent.ts
    adapters/
      supabaseContentLoader.ts
    index.ts
  test/
    fixtures/
    resolver/
    composition/
```

### Package Boundary Rules

- `rules/` decides what applies
- `compose/` decides how approved content is assembled
- `content/` loads clause and template records
- apps may format presentation, but apps may not invent clause logic or clause text

## Contracts

### Shared Input Contract

Base the first shared input on the existing TIS Speed Mode contract, then extend it carefully rather than replacing it.

Recommended v1 shared input:

```ts
type ResolverInput = {
  property_type: PropertyType;
  scope_band: ScopeBand;
  access: AccessBand;
  confidence: ConfidenceBand;
  visible_condition: VisibleCondition;
  proof_available: YesNoNull;
  proof_strength: ProofStrength | null;
  decision_maker_present: YesNoNull;
  managed_scope_credible: YesNoNull;
  entry_option_safe: YesNoNull;
  internal_review_flag: YesNoNull;
  source_repo: "tis" | "command_center";
  source_record_id?: string | null;
  mode: "speed" | "controlled";
};
```

### Shared Output Contract

Recommended v1 shared output:

```ts
type ResolverOutput = {
  resolver_version: string;
  content_version: string;
  valid: boolean;
  status_key: StatusKey;
  action_command: string;
  risk_warning: string;
  price_posture: PricePosture;
  strategy_key: StrategyKey;
  required_protection_clauses: ClauseCode[];
  applied_clause_codes: ClauseCode[];
  header_text: string;
  conditions_text: string;
  footer_text: string;
  warning_messages: string[];
  handoff_target: "none" | "controlled_mode" | "internal_review";
  snapshot_schema_version: string;
};
```

### Snapshot Contract

Generated records must persist the rendered text, not just the inputs.

Required snapshot fields:

- source repo
- source record id
- mode
- status at generation time
- resolver version
- content version
- header text
- conditions text
- footer text
- applied clause codes
- optional custom note
- created by
- created at

## Supabase Model

Use one shared Supabase project as the authority for this system.

If TIS and Command Center are not already pointed at the same Supabase project for this capability, do not ship v1 until they are. Cross-repo consistency is more important than convenience here.

### Minimum Tables

#### `protection_clauses`

Purpose: canonical clause library.

Suggested columns:

```sql
create table protection_clauses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  plain_text text not null,
  formal_text text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  version_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `terms_templates`

Purpose: header, body wrapper, and footer template library by mode.

Suggested columns:

```sql
create table terms_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('speed', 'controlled')),
  header_template text not null,
  conditions_template text not null,
  footer_template text not null,
  active boolean not null default true,
  version_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `resolver_versions`

Purpose: immutable release metadata for logic and content compatibility.

Suggested columns:

```sql
create table resolver_versions (
  id uuid primary key default gen_random_uuid(),
  resolver_version text not null unique,
  package_version text not null,
  content_version text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

#### `estimate_terms_snapshots`

Purpose: immutable rendered outputs saved with estimates, proposals, or field handoffs.

Suggested columns:

```sql
create table estimate_terms_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_repo text not null check (source_repo in ('tis', 'command_center')),
  source_record_id text not null,
  mode text not null check (mode in ('speed', 'controlled')),
  status_key text not null,
  resolver_version text not null,
  content_version text not null,
  header_text text not null,
  conditions_text text not null,
  footer_text text not null,
  applied_clause_codes jsonb not null default '[]'::jsonb,
  custom_note_text text,
  snapshot_schema_version text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
```

### Strongly Recommended Support Tables

- `clause_change_log`
- `terms_generation_events`

These are not required for v1 launch, but they will matter quickly once wording starts changing.

## Resolver and Composition Boundaries

Recommended shared functions:

```ts
validateResolverInput(input)
resolveStatus(input)
resolveGuardrails(input, status)
resolvePricingPosture(input, status, guardrails)
resolveStrategy(input, status, pricePosture, guardrails)
selectProtectionClauses(input, status, pricePosture, strategy)
composeTerms({ mode, status, clauses, templates, warnings })
buildTermsSnapshot({ input, output, actor })
```

### Important Boundary Rule

Clause selection and clause composition are separate steps.

- selection decides which clause codes apply
- composition decides how those approved clauses become header, conditions, and footer text

That separation is what prevents copy drift.

## Repo Integration Plan

### TIS Integration

Current file anchors:

- `src/utils/speedModeResolver.js`
- `src/utils/speedModeCopy.js`
- `src/pages/EstimateProposal.jsx`

Recommended TIS changes:

1. Keep `inferSpeedModeInput` in TIS.
2. Replace local resolver authority with shared package calls.
3. Replace local clause and protection language assembly with shared composition output.
4. Keep field-facing copy adaptation in TIS only if it is a pure presentation layer over shared meaning.
5. Save a handoff bundle that includes:
   - resolver version
   - content version
   - status
   - applied clause codes
   - rendered preview text
   - proof references

### TIS Responsibility After Refactor

TIS should still decide:

- what the rep sees first
- how compact the field output looks
- how proof slots are shown

TIS should not decide:

- clause code mapping
- protected wording
- final customer-facing terms text

### Command Center Integration

Current file anchors:

- `c:\BHFOS\command-center\src\pages\crm\proposals\ProposalBuilder.jsx`
- `c:\BHFOS\command-center\src\pages\crm\Estimates.jsx`

Recommended Command Center changes:

1. Stop treating `header_text` and `footer_text` as freeform defaults in the proposal page.
2. Add an API or action boundary that calls the shared package.
3. Generate final controlled-mode output from shared content plus shared rules.
4. Persist a snapshot record at estimate or proposal generation time.
5. Allow a separate `custom_note_text` field for human additions without altering required clauses.

### Command Center Responsibility After Refactor

Command Center should own:

- estimate rendering
- proposal rendering
- send-time validation
- snapshot persistence
- downstream artifact usage

Command Center should not own:

- private copies of clause language
- private copies of status logic
- ad hoc clause assembly inside React component state

## Write Path Recommendation

Command Center architecture already requires write flows through an API or service layer.

Use this path:

```text
ProposalBuilder UI
  -> API endpoint / server action / edge function
  -> EstimateTermsService
  -> @tvg/field-rules
  -> Supabase content fetch
  -> rendered output
  -> estimate_terms_snapshots insert
  -> quotes / estimates record update
```

Do not let `ProposalBuilder.jsx` write final terms snapshots directly from client-side composition logic.

## Editability Policy

Lock this before implementation.

### Editable by Rep

- optional custom note
- delivery framing copy
- internal handoff note
- proof selection where allowed

### Not Editable by Rep

- status
- guardrail outcomes
- required protection clauses
- required clause presence
- resolver version
- content version

### Editable by Admin-Level Users Only

- clause library records
- template records
- activation and deactivation of clause codes
- resolver release activation

## Versioning Policy

Use explicit version fields in every generated output.

Recommended fields:

- `resolver_version`
- `content_version`
- `snapshot_schema_version`

### Rules

- snapshots are immutable
- old estimates keep their historical rendered text
- new wording does not rewrite historical snapshots
- logic changes require a new `resolver_version`
- clause or template text changes require a new `content_version`

## Failure Behavior

Fail safe, not open.

Required fallback rules:

1. If a required clause code cannot be loaded, do not render customer-facing final terms.
2. If template content fails to load, fall back to a conservative default template that clearly marks verification dependence.
3. If resolver and content versions are incompatible, block generation and log the mismatch.
4. If a historical snapshot exists, display the stored snapshot instead of regenerating text.
5. Log every fallback event.

## Migration Policy

Do not try to rewrite old estimates during v1 rollout.

Recommended legacy handling:

- keep old records untouched
- mark old records as legacy if needed
- apply the new snapshot system only to new generated outputs

## Testing Plan

Truth-table tests are required before UI wiring.

Minimum fixture groups:

- low confidence + unknown access
- low confidence + difficult access
- medium confidence + mixed access + moderate condition
- medium confidence + large scope
- high confidence + easy access + small scope
- hazardous + difficult access
- hazardous + large scope
- commercial or high-rise + difficult access

For each fixture, assert:

- status
- price posture
- strategy
- clause codes
- header text shape
- conditions text shape
- footer text shape
- snapshot version fields

## Rollout Order

### Phase 1

Freeze:

- enums
- codes
- shared input contract
- shared output contract
- snapshot contract
- editability policy

### Phase 2

Build:

- shared package
- resolver tests
- composition tests

### Phase 3

Create:

- Supabase tables
- seed data for clauses
- seed data for templates
- resolver release records

### Phase 4

Integrate TIS first:

- replace local resolver authority
- render shared preview output
- produce handoff payload

### Phase 5

Integrate Command Center second:

- generate controlled-mode terms through the service layer
- save immutable snapshots
- use snapshots in estimate/proposal rendering

### Phase 6

Add governance:

- wording approval owner
- logic approval owner
- release checklist
- regression test gate

## Immediate Build Tasks

Recommended next seven tasks:

1. Freeze shared enums and code names from the current TIS contract.
2. Write the shared `ResolverInput`, `ResolverOutput`, and snapshot contracts.
3. Stand up the `@tvg/field-rules` package skeleton.
4. Move current TIS resolver rules into package tests before moving implementation.
5. Create Supabase migrations for clause, template, version, and snapshot tables.
6. Replace TIS local resolver calls with shared package calls.
7. Add a Command Center service endpoint that generates and persists controlled-mode terms.

## Recommended Decision on API vs Shared Package

Near-term recommendation:

- use the shared package first

Later upgrade trigger:

- move resolver execution behind an API or Edge Function once logic changes frequently, more clients appear, or coordinated deploys become a drag

That keeps v1 simple without accepting duplicated logic.

## Bottom Line

This is not a page feature.

It is a shared rules product with:

- one content authority
- one logic authority
- two application consumers
- immutable rendered snapshots

If that split is respected, TIS and Command Center can move at different UI speeds without breaking protection language consistency.
