# Run Folder Contract (Tenant Artifacts)

Purpose: define the **minimum contract** for committed run artifacts under `artifacts/tenants/<tenant_id>/runs/<run_folder>/`.

This contract exists to reduce brittle path assumptions by making `manifest.json` the preferred index.

## Key definitions

- `tenant_id`: tenant slug (e.g. `vent-guys`). Must match the folder name under `artifacts/tenants/`.
- `run_folder`: filesystem-safe version of `run_id` (e.g. colons replaced with dashes).
- `artifact_class`: declares what this run folder guarantees it contains.

## Required files (all classes)

- `manifest.json` (preferred index; see below)

## `manifest.json` (preferred index)

Every run manifest must include:

- `tenant_id`
- `artifact_class`
- `created_at` (non-null)
- `paths` object with these keys:
  - `judgment_json`
  - `raw_doc`
  - `review_doc`
  - `observed_bundle_root`
  - `manifest`

Tools should resolve canonical paths from `manifest.paths.*` when present.

## Artifact classes

### `ledger_lock_full`

Required (must exist on disk):
- `paths.judgment_json`
- `paths.observed_bundle_root`
- `paths.raw_doc`
- `paths.review_doc`

Classification:
- Layer 3 outputs are **internal governed artifacts**, not external product docs.

### `ledger_lock_layer2_only`

Required (must exist on disk):
- `paths.judgment_json`
- `paths.observed_bundle_root`

Allowed:
- `paths.raw_doc` / `paths.review_doc` may be null or point to future outputs.

### `legacy*`

Legacy artifacts may exist for historical reasons.
They are not baseline SSOT and may be non-self-contained.

## Consistency requirements (when applicable)

When both are present, validators must hard-fail if inconsistent:

- `manifest.run_id` ⇔ `layer2_observed_judgment.json.run_id`
- `manifest.tenant_id` ⇔ `layer2_observed_judgment.json.tenant_id`
- `manifest.paths.observed_bundle_root` ⇔ `layer2_observed_judgment.json.observed_bundle_root`

