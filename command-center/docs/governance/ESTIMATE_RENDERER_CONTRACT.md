# Estimate v1 — Renderer Contract (Raw + Review)

Purpose: define what **must** be true for Estimate v1 artifacts so renderers remain deterministic and do not become policy engines.

This contract is intentionally narrow (v1).

## 1) Source of truth (SSOT)

SSOT is the **estimate judgment JSON** (e.g. `tmp/orchestrator-v2/estimate/estimate_judgment.sample.json`).

Renderers:
- must not infer missing business meaning
- must only format and present SSOT fields

Validators:
- must fail hard when invariants are violated
- must reject unknown policy values

## 2) Status enum (locked)

`status` must be one of:
- `draft`
- `issued`
- `approved`
- `expired`
- `superseded`

## 3) Recommendation semantics (no inference)

`options.*.recommended` is authored upstream. The renderer must treat it as:

> “the default proposed option selected by upstream business/judgment logic”

It is **not** automatically:
- best value
- cheapest
- safest

If the business wants “recommended means safest” (or similar), that meaning must be authored upstream and reflected in plain-language `recommendation.reason`.

## 4) Option commercial requirements (no bare nulls)

Every shown option must have exactly one viable commercial representation:
- `pricing` **or**
- `estimated_total` **or**
- `price_range`

`is_fully_quoted` governs how the renderer should communicate certainty:
- `true` ⇒ `pricing` must be present (subtotal/tax/total)
- `false` ⇒ option may use `estimated_total` or `price_range`

Additional v1 restriction:
- a **recommended** option must not be `price_range`-only.

Selected option rule (v1):
- selected option must include `line_items[]` and full `pricing` (subtotal/tax/total).

## 5) Boundary inheritance (explicit + enumerable)

`boundary_inheritance_policy` must be present and one of the enumerated values.

For v1, allowed:
- `render_universal_plus_selected_option`

Meaning:
- render universal “not included”
- plus selected option `scope_boundaries` (“included” + “not included”)

Unknown values must be rejected by validators (fail hard).

## 6) Evidence traceability (minimum viable)

`evidence_refs[]` must be structured objects, not strings.

Minimum for at least one evidence ref:
- `type` (e.g. `crm_quote_pdf`)
- `id` (e.g. quote number)
- `uri` (path/locator)

This is a traceability **minimum**, not a claim-binding system. Do not imply individual claims are proven unless the data model explicitly binds them.

## 7) Versioning discipline (v1)

The estimate JSON must carry a `schema_version` that starts with:
- `estimate_judgment_v1.`

Breaking changes require a new major version and must not silently change renderer behavior.

