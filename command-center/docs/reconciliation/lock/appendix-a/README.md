# Appendix A Lock Package

This folder is the enforceable governance package for Appendix A.

## Control Surface

The single control surface for Appendix A lock state is:

- `docs/reconciliation/lock/appendix-a/index.md`

If an artifact is not referenced in `index.md`, it does not count toward A-LOCK.

## Guardrails

### Rule 1 - Gate Enforcement

Appendix B execution is forbidden until `index.md` shows:

- `Current State: IMPLEMENTED AND LOCKED`

### Rule 2 - No Silent Doctrine Changes

Any Appendix A behavior change requires:

- a linked proof artifact
- or a linked decision record

### Rule 3 - No Green Without Proof

No checklist line may be treated as `GREEN` without:

- an evidence artifact path
- or a decision record path

### Rule 4 - Evidence Is Part Of The System

If behavior is not recorded, it is not considered implemented for lock purposes.

### Rule 5 - Snapshot At Lock

A-LOCK requires:

- schema snapshot
- event sample log
- core flow trace
- lock summary

### Rule 6 - No Orphan Decisions

Every decision record must be referenced in `index.md`.

### Rule 7 - No Unindexed Evidence

Evidence files that are not indexed are ignored for A-LOCK.

### Rule 8 - No Retroactive Justification

Doctrine cannot be rewritten after behavior changes without re-verification.

### Rule 9 - Manifest Integrity

`index.md` acts as the Appendix A manifest.

If a file path is listed in `index.md` and the file is missing or empty, the lock package is considered broken.

### Rule 10 - Anti-Regression

No code change within Appendix A scope is allowed after lock without:

- a new `EV-` artifact
- and an `SN-` version bump

## Artifact Prefixes

### Evidence

- `EV-YYYY-MM-DD_*`

### Decisions

- `DR-YYYY-MM-DD_*`

### Snapshots

- `SN-YYYY-MM-DD_*`

### Contracts

- `CT-YYYY-MM-DD_*`

## Folder Roles

- `evidence/` = proof that behavior works
- `decisions/` = why we chose a path or deferred it
- `snapshots/` = exact state at or approaching lock
- `contracts/` = what downstream appendices are allowed to rely on

## Contributor Rule

Any contributor touching Appendix A scope must update one of:

- evidence
- decision record
- snapshot
- contract

and then re-index the change in `index.md`.
